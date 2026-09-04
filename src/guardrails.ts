import type { ActionType, AgentAction, GuardrailConfig, PerceivedElement } from './types.js';

/**
 * Guardrails.
 *
 * The model is untrusted input. So is the page it reads — a hostile comment
 * on a CRM record can try to talk the agent into clicking "Delete account".
 * Every action is therefore validated here, against config the *host app*
 * controls, before it ever reaches the DOM.
 */

export const defaultGuardrails: GuardrailConfig = {
  allowedActions: ['click', 'type', 'select', 'check', 'scroll', 'read', 'answer', 'wait', 'done'],
  blockedSelectors: [
    '[data-fp-block]',
    '.flowpilot-root',
    'input[type=password]',
    'input[autocomplete*=cc-]',
    'input[name*=card i]',
    'input[name*=cvv i]',
    'input[name*=ssn i]',
    '[data-danger]',
    'a[href^="mailto:"]',
    'a[href^="tel:"]',
  ],
  confirmSelectors: [
    '[data-fp-confirm]',
    '[data-destructive]',
    'button[type=submit]',
    '[aria-label*=delete i]',
    '[aria-label*=remove i]',
  ],
  maxActionsPerTurn: 12,
  maxSteps: 6,
  protectSensitiveInputs: true,
  redactPatterns: [
    /\b\d{3}-\d{2}-\d{4}\b/g,                       // US SSN
    /\b(?:\d[ -]*?){13,19}\b/g,                     // card-length digit runs
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // email
    /\b(sk|pk)-[A-Za-z0-9]{16,}\b/g,                // API keys
  ],
};

export function resolveGuardrails(
  overrides?: Partial<GuardrailConfig>,
  presetActions?: ActionType[],
  presetBlocked?: string[],
): GuardrailConfig {
  const merged: GuardrailConfig = { ...defaultGuardrails, ...(overrides ?? {}) };

  // A preset may only *narrow* the action set, never widen it.
  if (presetActions?.length) {
    merged.allowedActions = merged.allowedActions.filter((a) => presetActions.includes(a));
  }
  // Blocked selectors are always additive — presets can add, never remove.
  merged.blockedSelectors = [
    ...defaultGuardrails.blockedSelectors,
    ...(overrides?.blockedSelectors ?? []),
    ...(presetBlocked ?? []),
  ];

  return merged;
}

export type Verdict =
  | { decision: 'allow' }
  | { decision: 'confirm'; label: string }
  | { decision: 'block'; reason: string };

/** Does the element, or any ancestor, match one of these selectors? */
function matchesUpTree(el: Element, selectors: string[]): string | null {
  for (const selector of selectors) {
    try {
      if (el.closest(selector)) return selector;
    } catch {
      // A malformed selector from config shouldn't take the widget down.
      continue;
    }
  }
  return null;
}

const SENSITIVE_INPUT = /password|cc-|credit|card|cvv|cvc|ssn|social|routing|account-number/i;

function isSensitiveInput(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.type === 'password') return true;
  const haystack = [el.name, el.id, el.autocomplete, el.getAttribute('aria-label') ?? '']
    .join(' ')
    .toLowerCase();
  return SENSITIVE_INPUT.test(haystack);
}

/** Decide whether a single proposed action may run. */
export function evaluate(
  action: AgentAction,
  element: Element | undefined,
  perceived: PerceivedElement | undefined,
  config: GuardrailConfig,
): Verdict {
  if (!config.allowedActions.includes(action.type)) {
    return { decision: 'block', reason: `Action "${action.type}" is not enabled for this workspace.` };
  }

  // Verbs that never touch the page.
  if (action.type === 'answer' || action.type === 'done' || action.type === 'wait' || action.type === 'read') {
    return { decision: 'allow' };
  }

  if (action.type === 'scroll') return { decision: 'allow' };

  if (action.type === 'navigate') {
    const target = action.url ?? '';
    // Same-origin only. An agent that can be talked into an off-site
    // navigation is an exfiltration channel.
    try {
      const resolved = new URL(target, window.location.origin);
      if (resolved.origin !== window.location.origin) {
        return { decision: 'block', reason: 'Navigation outside this site is not permitted.' };
      }
    } catch {
      return { decision: 'block', reason: 'Invalid navigation target.' };
    }
    return { decision: 'confirm', label: `Navigate to ${target}` };
  }

  if (!element) {
    return { decision: 'block', reason: `Element "${action.ref}" is no longer on the page.` };
  }

  const blocked = matchesUpTree(element, config.blockedSelectors);
  if (blocked) {
    return { decision: 'block', reason: `That control is protected (${blocked}).` };
  }

  if (action.type === 'type' && config.protectSensitiveInputs && isSensitiveInput(element)) {
    return { decision: 'block', reason: 'Typing into credential or payment fields is disabled.' };
  }

  const needsConfirm = matchesUpTree(element, config.confirmSelectors);
  if (needsConfirm) {
    const label = perceived?.label ?? element.textContent?.trim().slice(0, 60) ?? 'this control';
    return { decision: 'confirm', label: `${action.type} "${label}"` };
  }

  return { decision: 'allow' };
}

/** Strip PII-shaped strings out of anything leaving the browser. */
export function redact(text: string, patterns: RegExp[]): string {
  let out = text;
  for (const pattern of patterns) {
    out = out.replace(new RegExp(pattern.source, pattern.flags), '«redacted»');
  }
  return out;
}
