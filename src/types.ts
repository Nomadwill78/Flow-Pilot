/**
 * FlowPilot — shared type definitions.
 *
 * Everything a host application touches is declared here so that integrators
 * get full IntelliSense from a single import.
 */

/** Brand-able colour tokens. Every value is a raw CSS colour string. */
export interface FlowPilotTheme {
  /** Primary surface for the header, launcher and user bubbles. */
  primary: string;
  /** Darker companion to `primary`, used for gradients and deep text. */
  primaryDark: string;
  /** Accent used sparingly for the send button and highlights. */
  accent: string;
  /** Text colour rendered on top of `accent`. */
  accentText: string;
  /** Panel background. */
  surface: string;
  /** Recessed background for assistant bubbles and the composer. */
  surfaceMuted: string;
  /** Default body text colour. */
  text: string;
  /** Secondary text colour for timestamps and hints. */
  textMuted: string;
  /** Hairline borders. */
  border: string;
  /** Corner radius applied to the panel. */
  radius: string;
  /** Font stack for all widget text. */
  fontFamily: string;
  /** Panel drop shadow. */
  shadow: string;
}

/** Where the launcher and panel dock. */
export type FlowPilotPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

/** The verbs the agent is allowed to emit. */
export type ActionType =
  | 'click'
  | 'type'
  | 'select'
  | 'check'
  | 'scroll'
  | 'navigate'
  | 'wait'
  | 'read'
  | 'answer'
  | 'done';

/**
 * A single step proposed by the model.
 *
 * `ref` refers to the stable element id assigned by the perception layer
 * (e.g. `e12`), never a CSS selector produced by the model — this is what
 * keeps a prompt-injected page from steering the agent onto arbitrary nodes.
 */
export interface AgentAction {
  type: ActionType;
  /** Perception-assigned element reference, e.g. `e7`. */
  ref?: string;
  /** Text to type, option to select, or the answer to show the user. */
  value?: string;
  /** Short human-readable explanation shown in the activity log. */
  reason?: string;
  /** Milliseconds, for `wait`. */
  ms?: number;
  /** Same-origin path, for `navigate`. */
  url?: string;
}

/** Result of executing one action. */
export interface ActionResult {
  ok: boolean;
  action: AgentAction;
  detail: string;
}

/** One interactive element as seen by the perception layer. */
export interface PerceivedElement {
  ref: string;
  tag: string;
  role: string;
  label: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  options?: string[];
  el: Element;
}

/** A serialisable snapshot of the current page. */
export interface PageSnapshot {
  url: string;
  title: string;
  /** Visible headings and text, truncated to `maxTextChars`. */
  text: string;
  elements: PerceivedElement[];
}

/** A named business workflow bundled with the product. */
export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  /** Domain instructions appended to the system prompt. */
  systemPrompt: string;
  /** Chips rendered under the greeting. */
  suggestions: string[];
  /** Action verbs this preset may use. Narrower than the global allowlist. */
  allowedActions?: ActionType[];
  /** Extra CSS selectors this preset must never touch. */
  blockedSelectors?: string[];
  /** Opening message shown when the panel is first opened. */
  greeting?: string;
}

/** Safety configuration. */
export interface GuardrailConfig {
  /** Action verbs the agent may emit at all. */
  allowedActions: ActionType[];
  /**
   * Selectors the agent may never interact with. Matched against the element
   * and all of its ancestors, so wrapping a region in one class protects it.
   */
  blockedSelectors: string[];
  /**
   * Ask the user before running any action whose element matches one of
   * these selectors (e.g. `[data-destructive]`, `button[type=submit]`).
   */
  confirmSelectors: string[];
  /** Hard ceiling on actions per user request. */
  maxActionsPerTurn: number;
  /** Hard ceiling on model round-trips per user request. */
  maxSteps: number;
  /** Refuse to type into password/credit-card style inputs. */
  protectSensitiveInputs: boolean;
  /** Redact values matching these patterns before they leave the browser. */
  redactPatterns: RegExp[];
}

/** Telemetry hook payload. */
export interface FlowPilotEvent {
  type:
    | 'open'
    | 'close'
    | 'message'
    | 'action'
    | 'blocked'
    | 'confirm'
    | 'error'
    | 'complete';
  at: number;
  sessionId: string;
  data?: Record<string, unknown>;
}

/** Options accepted by `new FlowPilot({...})`. */
export interface FlowPilotConfig {
  /**
   * URL of your FlowPilot proxy (`server/index.js`). The browser never sees
   * an LLM API key — this is the whole point of the proxy.
   */
  endpoint: string;
  /** Short-lived token your app mints for the signed-in user. */
  token?: string;
  /** Product name shown in the header. */
  brandName?: string;
  /** Inline SVG or image URL for the header mark. */
  brandLogo?: string;
  /** Partial theme override; unspecified tokens fall back to the default. */
  theme?: Partial<FlowPilotTheme>;
  position?: FlowPilotPosition;
  /** Preset object or the id of a preset registered via `registerPreset`. */
  preset?: WorkflowPreset | string;
  /** Extra instructions appended after the preset's prompt. */
  systemPrompt?: string;
  /** Partial guardrail override; unspecified keys keep the safe default. */
  guardrails?: Partial<GuardrailConfig>;
  /** Open the panel on load. */
  autoOpen?: boolean;
  /** Render the launcher button. Set false to drive the panel yourself. */
  launcher?: boolean;
  /** Keyboard shortcut to toggle the panel. Default `mod+k`. */
  hotkey?: string | false;
  /** Arbitrary context forwarded to the model (plan, role, feature flags). */
  context?: Record<string, unknown>;
  /** Telemetry sink. */
  onEvent?: (event: FlowPilotEvent) => void;
  /**
   * Called before a confirm-gated action runs. Return false to cancel.
   * Defaults to an in-panel confirmation card.
   */
  onConfirm?: (action: AgentAction, label: string) => Promise<boolean>;
  /** Max characters of page text sent per request. Default 4000. */
  maxTextChars?: number;
  /** Max interactive elements sent per request. Default 120. */
  maxElements?: number;
  /** Log agent reasoning to the console. */
  debug?: boolean;
}

/** A chat turn as stored in the transcript. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  at: number;
}

/** Shape of the JSON returned by the proxy. */
export interface ProxyResponse {
  message?: string;
  actions?: AgentAction[];
  done?: boolean;
  error?: string;
}
