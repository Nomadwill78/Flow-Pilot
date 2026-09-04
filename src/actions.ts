import type { ActionResult, AgentAction } from './types.js';
import { elementForRef } from './perception.js';

/**
 * Action layer.
 *
 * Dispatches real, trusted-ish browser events rather than calling `.click()`
 * blindly — React, Vue and Angular all listen for the native input/change
 * sequence, so a naive `el.value = x` silently does nothing in most modern
 * apps. This is the part integrators would otherwise spend a week getting wrong.
 */

const HIGHLIGHT_CLASS = 'flowpilot-highlight';

function ensureHighlightStyles(): void {
  if (document.getElementById('flowpilot-highlight-styles')) return;
  const style = document.createElement('style');
  style.id = 'flowpilot-highlight-styles';
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid var(--fp-accent, #FFB300) !important;
      outline-offset: 2px !important;
      border-radius: 4px;
      transition: outline-color .2s ease;
    }
  `;
  document.head.appendChild(style);
}

/** Briefly ring the element the agent is about to touch, so users can follow along. */
export async function highlight(el: Element, ms = 420): Promise<void> {
  ensureHighlightStyles();
  el.classList.add(HIGHLIGHT_CLASS);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(ms);
  el.classList.remove(HIGHLIGHT_CLASS);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Set a value on a controlled React/Vue input.
 *
 * Frameworks patch the value setter on the element instance, so we reach for
 * the prototype's native setter and then fire `input` — that is what makes
 * the framework's own state update.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

async function typeInto(el: Element, value: string, humanize: boolean): Promise<string> {
  if (el instanceof HTMLElement && el.isContentEditable) {
    el.focus();
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return `Typed into "${el.getAttribute('aria-label') ?? 'editor'}"`;
  }

  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    throw new Error('Target is not a text field.');
  }

  el.focus();
  setNativeValue(el, '');
  el.dispatchEvent(new Event('input', { bubbles: true }));

  if (humanize && value.length <= 120) {
    // Typing character-by-character keeps autocomplete and validation widgets
    // in sync; long values are set in one shot to stay responsive.
    let buffer = '';
    for (const char of value) {
      buffer += char;
      setNativeValue(el, buffer);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(12);
    }
  } else {
    setNativeValue(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
  return `Typed "${value.slice(0, 40)}"`;
}

function selectOption(el: Element, value: string): string {
  if (!(el instanceof HTMLSelectElement)) throw new Error('Target is not a dropdown.');
  const options = Array.from(el.options);
  const match =
    options.find((o) => o.value === value) ??
    options.find((o) => o.text.trim().toLowerCase() === value.trim().toLowerCase()) ??
    options.find((o) => o.text.trim().toLowerCase().includes(value.trim().toLowerCase()));

  if (!match) throw new Error(`No option matching "${value}".`);
  el.value = match.value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return `Selected "${match.text.trim()}"`;
}

function clickElement(el: Element): string {
  if (el instanceof HTMLElement) {
    el.focus?.();
    // Full pointer sequence — some component libraries only listen for mousedown.
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', { ...opts, isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
    return `Clicked "${(el.textContent ?? '').trim().slice(0, 40) || el.tagName.toLowerCase()}"`;
  }
  throw new Error('Target is not clickable.');
}

function setChecked(el: Element, value: string | undefined): string {
  if (!(el instanceof HTMLInputElement)) throw new Error('Target is not a checkbox.');
  const desired = value === undefined ? !el.checked : value !== 'false' && value !== 'off';
  if (el.checked !== desired) el.click();
  return `${desired ? 'Checked' : 'Unchecked'} "${el.name || el.id || 'checkbox'}"`;
}

function readElement(el: Element): string {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 500) || '(empty)';
}

/** Execute a validated action. Assumes guardrails have already approved it. */
export async function execute(
  action: AgentAction,
  options: { humanizeTyping?: boolean; showHighlight?: boolean } = {},
): Promise<ActionResult> {
  const { humanizeTyping = true, showHighlight = true } = options;

  try {
    if (action.type === 'wait') {
      await sleep(Math.min(action.ms ?? 500, 5000));
      return { ok: true, action, detail: `Waited ${action.ms ?? 500}ms` };
    }

    if (action.type === 'scroll') {
      const amount = Number(action.value ?? '600');
      window.scrollBy({ top: Number.isFinite(amount) ? amount : 600, behavior: 'smooth' });
      await sleep(320);
      return { ok: true, action, detail: 'Scrolled' };
    }

    if (action.type === 'navigate') {
      const url = new URL(action.url ?? '/', window.location.origin);
      window.location.assign(url.toString());
      return { ok: true, action, detail: `Navigating to ${url.pathname}` };
    }

    if (action.type === 'answer' || action.type === 'done') {
      return { ok: true, action, detail: action.value ?? '' };
    }

    const el = action.ref ? elementForRef(action.ref) : undefined;
    if (!el) {
      return { ok: false, action, detail: `Element ${action.ref} not found — the page may have changed.` };
    }

    if (showHighlight) await highlight(el);

    let detail: string;
    switch (action.type) {
      case 'click':
        detail = clickElement(el);
        break;
      case 'type':
        detail = await typeInto(el, action.value ?? '', humanizeTyping);
        break;
      case 'select':
        detail = selectOption(el, action.value ?? '');
        break;
      case 'check':
        detail = setChecked(el, action.value);
        break;
      case 'read':
        detail = readElement(el);
        break;
      default:
        return { ok: false, action, detail: `Unsupported action "${action.type}".` };
    }

    // Give the host app a beat to re-render before the next perception pass.
    await sleep(220);
    return { ok: true, action, detail };
  } catch (error) {
    return {
      ok: false,
      action,
      detail: error instanceof Error ? error.message : 'Action failed.',
    };
  }
}
