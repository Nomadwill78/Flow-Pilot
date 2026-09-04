import type {
  AgentAction,
  ChatMessage,
  FlowPilotConfig,
  FlowPilotEvent,
  GuardrailConfig,
  PageSnapshot,
  ProxyResponse,
  WorkflowPreset,
} from './types.js';
import { resolveTheme } from './theme.js';
import { elementForRef } from './perception.js';
import { evaluate, redact, resolveGuardrails } from './guardrails.js';
import { ChatUI } from './ui.js';
import { getPreset, genericPreset } from './presets.js';
import { builtinAdapter, type PageAgentAdapter } from './adapter.js';

/**
 * FlowPilot — the orchestrator.
 *
 * Owns the agent loop: perceive the page → ask the model (through your proxy)
 * → validate each proposed action against guardrails → execute → repeat until
 * the model says it's done or a limit is hit.
 */
export class FlowPilot {
  private config: Required<Pick<FlowPilotConfig, 'endpoint'>> & FlowPilotConfig;
  private preset: WorkflowPreset;
  private guardrails: GuardrailConfig;
  private ui: ChatUI;
  private adapter: PageAgentAdapter;
  private transcript: ChatMessage[] = [];
  private sessionId: string;
  private aborted = false;
  private running = false;
  private hotkeyHandler?: (event: KeyboardEvent) => void;

  constructor(config: FlowPilotConfig, adapter: PageAgentAdapter = builtinAdapter) {
    if (!config.endpoint) {
      throw new Error('[FlowPilot] `endpoint` is required — point it at your FlowPilot proxy.');
    }

    this.config = config as Required<Pick<FlowPilotConfig, 'endpoint'>> & FlowPilotConfig;
    this.adapter = adapter;
    this.sessionId = `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    this.preset = resolvePreset(config.preset);
    this.guardrails = resolveGuardrails(
      config.guardrails,
      this.preset.allowedActions,
      this.preset.blockedSelectors,
    );

    this.ui = new ChatUI(
      resolveTheme(config.theme),
      config.position ?? 'bottom-right',
      config.brandName ?? 'Copilot',
      config.brandLogo,
      config.launcher !== false,
      {
        onSend: (text) => void this.send(text),
        onStop: () => this.stop(),
        onToggle: (open) => this.emit({ type: open ? 'open' : 'close', at: Date.now(), sessionId: this.sessionId }),
      },
    );

    this.ui.addMessage('assistant', this.preset.greeting ?? genericPreset.greeting!);
    this.ui.setSuggestions(this.preset.suggestions ?? []);

    this.installHotkey();
    if (config.autoOpen) this.open();
  }

  // --- public API -----------------------------------------------------------

  open(): void {
    this.ui.toggle(true);
  }

  close(): void {
    this.ui.toggle(false);
  }

  toggle(): void {
    this.ui.toggle();
  }

  /** Stop the current run at the next safe checkpoint. */
  stop(): void {
    if (this.running) {
      this.aborted = true;
      this.ui.addStep('Stopping…');
    }
  }

  /** Swap workflows at runtime, e.g. when the user changes section of your app. */
  setPreset(preset: WorkflowPreset | string): void {
    this.preset = resolvePreset(preset);
    this.guardrails = resolveGuardrails(
      this.config.guardrails,
      this.preset.allowedActions,
      this.preset.blockedSelectors,
    );
    this.ui.setSuggestions(this.preset.suggestions ?? []);
  }

  /** Rotate the per-user token without recreating the widget. */
  setToken(token: string): void {
    this.config.token = token;
  }

  /** Send a message programmatically — useful for "Ask the copilot" buttons. */
  async ask(text: string): Promise<void> {
    this.open();
    this.ui.addMessage('user', text);
    await this.send(text, false);
  }

  destroy(): void {
    if (this.hotkeyHandler) window.removeEventListener('keydown', this.hotkeyHandler);
    this.ui.destroy();
  }

  // --- agent loop -----------------------------------------------------------

  private async send(text: string, echo = true): Promise<void> {
    if (this.running) return;
    if (echo) this.ui.addMessage('user', text);

    this.transcript.push({ role: 'user', content: text, at: Date.now() });
    this.emit({ type: 'message', at: Date.now(), sessionId: this.sessionId, data: { text } });

    this.running = true;
    this.aborted = false;
    this.ui.setBusy(true, 'Reading the page…');

    let actionsUsed = 0;

    try {
      for (let step = 0; step < this.guardrails.maxSteps; step++) {
        if (this.aborted) break;

        const snapshot = await this.adapter.perceive(
          this.config.maxElements ?? 120,
          this.config.maxTextChars ?? 4000,
        );

        this.ui.setBusy(true, 'Thinking…');
        const response = await this.callProxy(snapshot);

        if (response.error) {
          this.ui.addMessage('error', response.error);
          this.emit({ type: 'error', at: Date.now(), sessionId: this.sessionId, data: { error: response.error } });
          break;
        }

        if (response.message) {
          this.ui.addMessage('assistant', response.message);
          this.transcript.push({ role: 'assistant', content: response.message, at: Date.now() });
        }

        const actions = response.actions ?? [];
        if (!actions.length || response.done) break;

        this.ui.setBusy(true, 'Working…');
        let pageChanged = false;

        for (const action of actions) {
          if (this.aborted) break;
          if (actionsUsed >= this.guardrails.maxActionsPerTurn) {
            this.ui.addStep('Action limit reached for this request.', true);
            break;
          }

          const ran = await this.runAction(action);
          actionsUsed++;

          if (ran === 'stop') {
            this.aborted = true;
            break;
          }
          if (ran === 'changed') pageChanged = true;
        }

        // Terminal verbs mean the model believes the job is finished.
        if (actions.some((a) => a.type === 'done')) break;
        if (!pageChanged) break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      this.ui.addMessage('error', message);
      this.emit({ type: 'error', at: Date.now(), sessionId: this.sessionId, data: { error: message } });
    } finally {
      this.running = false;
      this.aborted = false;
      this.ui.setBusy(false);
      this.emit({ type: 'complete', at: Date.now(), sessionId: this.sessionId, data: { actionsUsed } });
    }
  }

  /** Validate then perform one action. */
  private async runAction(action: AgentAction): Promise<'ok' | 'changed' | 'stop'> {
    const element = action.ref ? elementForRef(action.ref) : undefined;
    // The label shown in a confirmation card is recovered from the live element,
    // so no PerceivedElement needs to be threaded through here.
    const verdict = evaluate(action, element, undefined, this.guardrails);

    if (verdict.decision === 'block') {
      this.ui.addStep(verdict.reason, true);
      this.emit({ type: 'blocked', at: Date.now(), sessionId: this.sessionId, data: { action, reason: verdict.reason } });
      return 'ok';
    }

    if (verdict.decision === 'confirm') {
      this.emit({ type: 'confirm', at: Date.now(), sessionId: this.sessionId, data: { action } });
      const approved = this.config.onConfirm
        ? await this.config.onConfirm(action, verdict.label)
        : await this.ui.askConfirm(action, verdict.label);
      if (!approved) {
        this.ui.addStep('Cancelled by user.', true);
        return 'stop';
      }
    }

    if (action.type === 'answer') {
      if (action.value) this.ui.addMessage('assistant', action.value);
      return 'ok';
    }

    const result = await this.adapter.execute(action);
    this.ui.addStep(result.ok ? (action.reason ?? result.detail) : result.detail, !result.ok);
    this.emit({ type: 'action', at: Date.now(), sessionId: this.sessionId, data: { action, result } });

    if (!result.ok) return 'ok';
    // Reads don't mutate the page, so they don't justify another perception pass.
    return action.type === 'read' ? 'ok' : 'changed';
  }

  /** POST the turn to the customer's proxy. The browser never holds an API key. */
  private async callProxy(snapshot: PageSnapshot): Promise<ProxyResponse> {
    const pageDescription = redact(
      this.adapter.describe(snapshot),
      this.guardrails.redactPatterns,
    );

    const body = {
      sessionId: this.sessionId,
      preset: this.preset.id,
      systemPrompt: [this.preset.systemPrompt, this.config.systemPrompt].filter(Boolean).join('\n\n'),
      allowedActions: this.guardrails.allowedActions,
      messages: this.transcript.slice(-12),
      page: pageDescription,
      context: this.config.context ?? {},
    };

    if (this.config.debug) console.debug('[FlowPilot] →', body);

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) return { error: 'You have hit the usage limit. Please try again shortly.' };
      if (response.status === 401 || response.status === 403) {
        return { error: 'Your session expired. Please refresh the page.' };
      }
      return { error: `Assistant unavailable (${response.status}). ${text.slice(0, 140)}` };
    }

    const json = (await response.json()) as ProxyResponse;
    if (this.config.debug) console.debug('[FlowPilot] ←', json);
    return json;
  }

  private installHotkey(): void {
    const hotkey = this.config.hotkey ?? 'mod+k';
    if (hotkey === false) return;

    const [modifier, key] = hotkey.includes('+') ? hotkey.split('+') : ['', hotkey];
    this.hotkeyHandler = (event: KeyboardEvent) => {
      const modPressed = modifier === 'mod' ? event.metaKey || event.ctrlKey : true;
      if (modPressed && event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this.hotkeyHandler);
  }

  private emit(event: FlowPilotEvent): void {
    try {
      this.config.onEvent?.(event);
    } catch {
      // Never let a customer's analytics callback break the copilot.
    }
  }
}

function resolvePreset(preset: FlowPilotConfig['preset']): WorkflowPreset {
  if (!preset) return genericPreset;
  if (typeof preset === 'string') {
    const found = getPreset(preset);
    if (!found) {
      console.warn(`[FlowPilot] Unknown preset "${preset}" — using the generic assistant.`);
      return genericPreset;
    }
    return found;
  }
  return preset;
}
