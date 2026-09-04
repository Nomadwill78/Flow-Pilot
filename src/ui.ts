import type { AgentAction, FlowPilotPosition, FlowPilotTheme } from './types.js';
import { themeToCssVars } from './theme.js';

/**
 * Chat UI.
 *
 * Rendered into a Shadow DOM so the host application's CSS can never leak in
 * and break the widget — and the widget's styles can never leak out and break
 * the host. That isolation is what makes this safe to drop into a stranger's
 * app, which is the entire white-label promise.
 */

const ICONS = {
  send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  spark: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.2"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
};

const POSITION_CSS: Record<FlowPilotPosition, string> = {
  'bottom-right': 'bottom:24px;right:24px;',
  'bottom-left': 'bottom:24px;left:24px;',
  'top-right': 'top:24px;right:24px;',
  'top-left': 'top:24px;left:24px;',
};

export interface UICallbacks {
  onSend: (text: string) => void;
  onStop: () => void;
  onToggle: (open: boolean) => void;
}

export class ChatUI {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private panel!: HTMLElement;
  private log!: HTMLElement;
  private input!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private launcher!: HTMLButtonElement;
  private suggestionBar!: HTMLElement;
  private statusEl!: HTMLElement;
  private open = false;
  private busy = false;

  constructor(
    private theme: FlowPilotTheme,
    private position: FlowPilotPosition,
    private brandName: string,
    private brandLogo: string | undefined,
    private showLauncher: boolean,
    private callbacks: UICallbacks,
  ) {
    this.host = document.createElement('div');
    this.host.className = 'flowpilot-root';
    this.host.setAttribute('data-fp-ignore', 'true');
    this.root = this.host.attachShadow({ mode: 'open' });
    this.render();
    document.body.appendChild(this.host);
  }

  private render(): void {
    const style = document.createElement('style');
    style.textContent = this.css();

    const container = document.createElement('div');
    container.className = 'fp-container';
    container.setAttribute('style', themeToCssVars(this.theme));
    container.innerHTML = this.html();

    this.root.append(style, container);

    this.panel = container.querySelector('.fp-panel') as HTMLElement;
    this.log = container.querySelector('.fp-log') as HTMLElement;
    this.input = container.querySelector('.fp-input') as HTMLTextAreaElement;
    this.sendBtn = container.querySelector('.fp-send') as HTMLButtonElement;
    this.launcher = container.querySelector('.fp-launcher') as HTMLButtonElement;
    this.suggestionBar = container.querySelector('.fp-suggestions') as HTMLElement;
    this.statusEl = container.querySelector('.fp-status') as HTMLElement;

    if (!this.showLauncher) this.launcher.style.display = 'none';

    this.launcher.addEventListener('click', () => this.toggle());
    (container.querySelector('.fp-close') as HTMLElement).addEventListener('click', () => this.toggle(false));
    this.sendBtn.addEventListener('click', () => this.submit());

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.submit();
      }
    });
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = `${Math.min(this.input.scrollHeight, 120)}px`;
    });
  }

  private html(): string {
    const logo = this.brandLogo
      ? this.brandLogo.trim().startsWith('<')
        ? this.brandLogo
        : `<img src="${escapeAttr(this.brandLogo)}" alt="" />`
      : ICONS.spark;

    return `
      <button class="fp-launcher" aria-label="Open ${escapeAttr(this.brandName)}">
        ${ICONS.spark}
      </button>
      <section class="fp-panel" role="dialog" aria-label="${escapeAttr(this.brandName)}" aria-modal="false">
        <header class="fp-header">
          <div class="fp-brand">
            <span class="fp-mark">${logo}</span>
            <div>
              <div class="fp-title">${escapeHtml(this.brandName)}</div>
              <div class="fp-status">Ready</div>
            </div>
          </div>
          <button class="fp-close" aria-label="Close">${ICONS.close}</button>
        </header>
        <div class="fp-log" role="log" aria-live="polite"></div>
        <div class="fp-suggestions"></div>
        <div class="fp-composer">
          <textarea class="fp-input" rows="1" placeholder="Ask me to do something…" aria-label="Message"></textarea>
          <button class="fp-send" aria-label="Send">${ICONS.send}</button>
        </div>
        <div class="fp-footer">Powered by ${escapeHtml(this.brandName)}</div>
      </section>
    `;
  }

  private css(): string {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .fp-container {
        position: fixed; ${POSITION_CSS[this.position]}
        z-index: 2147483000;
        font-family: var(--fp-font);
        display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
      }
      .fp-launcher {
        width: 56px; height: 56px; border-radius: 50%; border: 0; cursor: pointer;
        background: linear-gradient(135deg, var(--fp-primary), var(--fp-primary-dark));
        color: #fff; box-shadow: var(--fp-shadow);
        display: grid; place-items: center; order: 2;
        transition: transform .18s ease, box-shadow .18s ease;
      }
      .fp-launcher:hover { transform: translateY(-2px) scale(1.04); }
      .fp-launcher:focus-visible { outline: 3px solid var(--fp-accent); outline-offset: 3px; }
      .fp-panel {
        order: 1;
        width: min(400px, calc(100vw - 32px));
        height: min(620px, calc(100vh - 120px));
        background: var(--fp-surface);
        border-radius: var(--fp-radius);
        box-shadow: var(--fp-shadow);
        border: 1px solid var(--fp-border);
        display: none; flex-direction: column; overflow: hidden;
        animation: fp-in .22s cubic-bezier(.2,.8,.2,1);
      }
      .fp-panel[data-open="true"] { display: flex; }
      @keyframes fp-in { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
      .fp-header {
        background: linear-gradient(135deg, var(--fp-primary), var(--fp-primary-dark));
        color: #fff; padding: 14px 16px;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
      }
      .fp-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .fp-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: rgba(255,255,255,.14); flex: none; }
      .fp-mark img, .fp-mark svg { width: 22px; height: 22px; }
      .fp-title { font-size: 14px; font-weight: 650; letter-spacing: -.01em; }
      .fp-status { font-size: 11.5px; opacity: .82; margin-top: 1px; }
      .fp-close { background: transparent; border: 0; color: #fff; opacity: .8; cursor: pointer; padding: 4px; border-radius: 6px; }
      .fp-close:hover { opacity: 1; background: rgba(255,255,255,.12); }
      .fp-log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--fp-surface); }
      .fp-msg { max-width: 86%; padding: 10px 13px; border-radius: 14px; font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
      .fp-msg.user { align-self: flex-end; background: var(--fp-primary); color: #fff; border-bottom-right-radius: 4px; }
      .fp-msg.assistant { align-self: flex-start; background: var(--fp-surface-muted); color: var(--fp-text); border-bottom-left-radius: 4px; }
      .fp-msg.error { align-self: flex-start; background: #FDECEC; color: #8A1C1C; border: 1px solid #F5C6C6; }
      .fp-step {
        align-self: flex-start; display: flex; align-items: flex-start; gap: 8px;
        font-size: 12px; color: var(--fp-text-muted); padding: 6px 10px;
        background: var(--fp-surface-muted); border-radius: 10px; max-width: 90%;
        border-left: 3px solid var(--fp-accent);
      }
      .fp-step.blocked { border-left-color: #C62828; color: #8A1C1C; }
      .fp-confirm { align-self: stretch; background: var(--fp-surface-muted); border: 1px solid var(--fp-border); border-radius: 12px; padding: 12px; font-size: 13px; color: var(--fp-text); }
      .fp-confirm p { margin: 0 0 10px; }
      .fp-confirm-actions { display: flex; gap: 8px; }
      .fp-btn { border: 0; border-radius: 8px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
      .fp-btn.primary { background: var(--fp-accent); color: var(--fp-accent-text); }
      .fp-btn.ghost { background: transparent; color: var(--fp-text-muted); border: 1px solid var(--fp-border); }
      .fp-typing { align-self: flex-start; display: flex; gap: 4px; padding: 10px 13px; background: var(--fp-surface-muted); border-radius: 14px; }
      .fp-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--fp-text-muted); animation: fp-bounce 1.3s infinite; }
      .fp-typing span:nth-child(2) { animation-delay: .18s; }
      .fp-typing span:nth-child(3) { animation-delay: .36s; }
      @keyframes fp-bounce { 0%,60%,100% { transform: translateY(0); opacity:.5 } 30% { transform: translateY(-4px); opacity:1 } }
      .fp-suggestions { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; }
      .fp-chip {
        font-family: inherit; font-size: 12px; padding: 6px 11px; border-radius: 999px; cursor: pointer;
        background: var(--fp-surface); color: var(--fp-primary); border: 1px solid var(--fp-border);
      }
      .fp-chip:hover { background: var(--fp-surface-muted); }
      .fp-composer { display: flex; gap: 8px; padding: 12px 14px; border-top: 1px solid var(--fp-border); background: var(--fp-surface); align-items: flex-end; }
      .fp-input {
        flex: 1; resize: none; border: 1px solid var(--fp-border); border-radius: 11px;
        padding: 10px 12px; font-family: inherit; font-size: 13.5px; line-height: 1.45;
        color: var(--fp-text); background: var(--fp-surface-muted); max-height: 120px; outline: none;
      }
      .fp-input:focus { border-color: var(--fp-primary); background: var(--fp-surface); }
      .fp-send {
        width: 38px; height: 38px; flex: none; border: 0; border-radius: 10px; cursor: pointer;
        background: var(--fp-accent); color: var(--fp-accent-text); display: grid; place-items: center;
      }
      .fp-send:disabled { opacity: .45; cursor: not-allowed; }
      .fp-footer { text-align: center; font-size: 10.5px; color: var(--fp-text-muted); padding: 0 0 10px; letter-spacing: .02em; }
      @media (max-width: 480px) {
        .fp-container { left: 12px; right: 12px; bottom: 12px; align-items: stretch; }
        .fp-panel { width: 100%; height: min(80vh, 560px); }
        .fp-launcher { align-self: flex-end; }
      }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    `;
  }

  // --- public API -----------------------------------------------------------

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.panel.setAttribute('data-open', String(this.open));
    if (this.open) setTimeout(() => this.input.focus(), 60);
    this.callbacks.onToggle(this.open);
  }

  isOpen(): boolean {
    return this.open;
  }

  setSuggestions(items: string[]): void {
    this.suggestionBar.innerHTML = '';
    for (const item of items) {
      const chip = document.createElement('button');
      chip.className = 'fp-chip';
      chip.textContent = item;
      chip.addEventListener('click', () => {
        this.suggestionBar.innerHTML = '';
        this.callbacks.onSend(item);
      });
      this.suggestionBar.appendChild(chip);
    }
  }

  addMessage(role: 'user' | 'assistant' | 'error', text: string): void {
    const el = document.createElement('div');
    el.className = `fp-msg ${role}`;
    el.textContent = text;
    this.log.appendChild(el);
    this.scroll();
  }

  /** One line in the visible activity log, so users can see what the agent did. */
  addStep(text: string, blocked = false): void {
    const el = document.createElement('div');
    el.className = `fp-step${blocked ? ' blocked' : ''}`;
    el.textContent = (blocked ? '⛔ ' : '⚡ ') + text;
    this.log.appendChild(el);
    this.scroll();
  }

  /** Render an in-panel approval card and resolve with the user's choice. */
  askConfirm(action: AgentAction, label: string): Promise<boolean> {
    return new Promise((resolve) => {
      const card = document.createElement('div');
      card.className = 'fp-confirm';
      const question = document.createElement('p');
      question.textContent = `Allow me to ${label}?`;
      const actions = document.createElement('div');
      actions.className = 'fp-confirm-actions';

      const yes = document.createElement('button');
      yes.className = 'fp-btn primary';
      yes.textContent = 'Allow';
      const no = document.createElement('button');
      no.className = 'fp-btn ghost';
      no.textContent = 'Cancel';

      const finish = (value: boolean) => {
        actions.remove();
        question.textContent = value ? `Approved: ${label}` : `Cancelled: ${label}`;
        resolve(value);
      };
      yes.addEventListener('click', () => finish(true));
      no.addEventListener('click', () => finish(false));

      actions.append(yes, no);
      card.append(question, actions);
      this.log.appendChild(card);
      this.scroll();
      void action;
    });
  }

  setBusy(busy: boolean, status = busy ? 'Working…' : 'Ready'): void {
    this.busy = busy;
    this.statusEl.textContent = status;
    // While a run is in flight the send button becomes a stop button, so it
    // stays enabled — but its label has to say so, or users think it's broken.
    this.sendBtn.innerHTML = busy ? ICONS.stop : ICONS.send;
    this.sendBtn.setAttribute('aria-label', busy ? 'Stop' : 'Send');
    this.sendBtn.title = busy ? 'Stop the current task' : 'Send';
    this.input.placeholder = busy ? 'Working… press stop to interrupt' : 'Ask me to do something…';
    this.sendBtn.disabled = false;
    if (busy) this.showTyping();
    else this.hideTyping();
  }

  private showTyping(): void {
    if (this.log.querySelector('.fp-typing')) return;
    const el = document.createElement('div');
    el.className = 'fp-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    this.log.appendChild(el);
    this.scroll();
  }

  private hideTyping(): void {
    this.log.querySelector('.fp-typing')?.remove();
  }

  private submit(): void {
    if (this.busy) {
      this.callbacks.onStop();
      return;
    }
    const text = this.input.value.trim();
    if (!text) return;
    this.input.value = '';
    this.input.style.height = 'auto';
    this.suggestionBar.innerHTML = '';
    this.callbacks.onSend(text);
  }

  private scroll(): void {
    this.log.scrollTop = this.log.scrollHeight;
  }

  destroy(): void {
    this.host.remove();
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
