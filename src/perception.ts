import type { PageSnapshot, PerceivedElement } from './types.js';

/**
 * Perception layer.
 *
 * Reads the live DOM into a compact, structured text description. This is the
 * cheap alternative to screenshot-based agents: no vision tokens, no headless
 * browser, and it works on whatever the signed-in user can already see.
 */

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type=hidden])',
  'select',
  'textarea',
  '[role=button]',
  '[role=link]',
  '[role=tab]',
  '[role=menuitem]',
  '[role=checkbox]',
  '[role=switch]',
  '[role=option]',
  '[contenteditable=true]',
  '[data-fp-action]',
].join(',');

/** Elements we never describe to the model, whatever the host page says. */
const ALWAYS_IGNORED = [
  '.flowpilot-root',
  'script',
  'style',
  'noscript',
  'template',
  '[data-fp-ignore]',
  '[aria-hidden=true]',
].join(',');

let refCounter = 0;
const refMap = new Map<string, Element>();

/** True when the element is actually rendered and reachable by a user. */
function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return false;
  const style = window.getComputedStyle(el as HTMLElement);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  // Off-screen in the scroll direction is still fine — the agent can scroll.
  return rect.bottom > -2000 && rect.top < window.innerHeight + 2000;
}

/** Best-effort human label, mirroring how a screen reader would name it. */
function labelFor(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const target = document.getElementById(labelledBy);
    if (target?.textContent) return target.textContent.trim();
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    if (el.labels?.length) {
      const text = Array.from(el.labels)
        .map((l) => labelTextWithoutControls(l))
        .filter(Boolean)
        .join(' ');
      if (text) return text;
    }
    if (!(el instanceof HTMLSelectElement) && el.placeholder) return el.placeholder.trim();
    if (el.name) return el.name.trim();
  }

  const title = el.getAttribute('title');
  if (title) return title.trim();

  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 80);

  const alt = el.querySelector('img[alt]')?.getAttribute('alt');
  if (alt) return alt.trim();

  return el.getAttribute('data-fp-action') ?? el.tagName.toLowerCase();
}

/**
 * Text of a <label>, minus any form control nested inside it.
 *
 * A wrapping label like `<label>Status <select><option>All</option>…</select></label>`
 * would otherwise be read as "Status AllShippedProcessing…", which is both
 * noisy and actively misleading to the model.
 */
function labelTextWithoutControls(label: HTMLLabelElement): string {
  const clone = label.cloneNode(true) as HTMLLabelElement;
  clone.querySelectorAll('input, select, textarea, button, [role=listbox]').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function roleFor(el: Element): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type;
    if (type === 'checkbox' || type === 'radio') return type;
    if (type === 'submit' || type === 'button') return 'button';
    return 'textbox';
  }
  return 'element';
}

/**
 * Walk the page and build a snapshot.
 *
 * @param maxElements Cap on interactive elements described to the model.
 * @param maxTextChars Cap on page prose sent along for context.
 */
export function perceive(maxElements = 120, maxTextChars = 4000): PageSnapshot {
  refCounter = 0;
  refMap.clear();

  const ignored = new Set<Element>();
  document.querySelectorAll(ALWAYS_IGNORED).forEach((node) => {
    ignored.add(node);
    node.querySelectorAll('*').forEach((child) => ignored.add(child));
  });

  const elements: PerceivedElement[] = [];
  const candidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR));

  for (const el of candidates) {
    if (elements.length >= maxElements) break;
    if (ignored.has(el)) continue;
    if (!isVisible(el)) continue;

    const ref = `e${++refCounter}`;
    refMap.set(ref, el);

    const perceived: PerceivedElement = {
      ref,
      tag: el.tagName.toLowerCase(),
      role: roleFor(el),
      label: labelFor(el),
      el,
    };

    if (el instanceof HTMLInputElement) {
      perceived.value = el.type === 'password' ? '«hidden»' : el.value;
      perceived.placeholder = el.placeholder || undefined;
      perceived.disabled = el.disabled;
    } else if (el instanceof HTMLTextAreaElement) {
      perceived.value = el.value;
      perceived.placeholder = el.placeholder || undefined;
      perceived.disabled = el.disabled;
    } else if (el instanceof HTMLSelectElement) {
      perceived.value = el.value;
      perceived.disabled = el.disabled;
      perceived.options = Array.from(el.options)
        .slice(0, 40)
        .map((o) => o.text.trim());
    } else if (el instanceof HTMLButtonElement) {
      perceived.disabled = el.disabled;
    }

    elements.push(perceived);
  }

  return {
    url: window.location.href,
    title: document.title,
    text: readableText(maxTextChars, ignored),
    elements,
  };
}

/** Headings, table rows and paragraphs — enough for "summarise this page". */
function readableText(maxChars: number, ignored: Set<Element>): string {
  const parts: string[] = [];
  const nodes = document.querySelectorAll(
    'h1,h2,h3,h4,p,li,td,th,[data-fp-context]',
  );

  for (const node of Array.from(nodes)) {
    if (ignored.has(node)) continue;
    if (!isVisible(node)) continue;
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2) continue;

    const tag = node.tagName.toLowerCase();
    const prefix = /^h[1-4]$/.test(tag) ? '# ' : tag === 'li' ? '- ' : '';
    parts.push(prefix + text.slice(0, 300));

    if (parts.join('\n').length > maxChars) break;
  }

  return parts.join('\n').slice(0, maxChars);
}

/** Resolve a model-supplied ref back to the live element. */
export function elementForRef(ref: string): Element | undefined {
  return refMap.get(ref);
}

/** Compact, token-cheap rendering of a snapshot for the system prompt. */
export function snapshotToPrompt(snapshot: PageSnapshot): string {
  const lines = snapshot.elements.map((e) => {
    const bits = [`[${e.ref}]`, e.role, `"${e.label}"`];
    if (e.value) bits.push(`value="${e.value.slice(0, 60)}"`);
    if (e.options?.length) bits.push(`options=[${e.options.slice(0, 12).join('|')}]`);
    if (e.disabled) bits.push('(disabled)');
    return bits.join(' ');
  });

  return [
    `PAGE: ${snapshot.title}`,
    `URL: ${snapshot.url}`,
    '',
    'VISIBLE CONTENT:',
    snapshot.text || '(no readable text)',
    '',
    'INTERACTIVE ELEMENTS:',
    lines.join('\n') || '(none)',
  ].join('\n');
}
