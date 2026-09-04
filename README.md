# FlowPilot

**A white-label AI copilot you can drop into any web app.**

Your users type what they want in plain English. FlowPilot performs it — clicking
buttons, filling forms, setting filters, navigating your app — inside the user's
own logged-in browser session.

```ts
import { FlowPilot } from 'flowpilot';

new FlowPilot({
  endpoint: '/api/copilot',      // your proxy — API keys stay server-side
  brandName: 'Acme Assistant',
  preset: 'crm-data-entry',
});
```

That is the whole integration.

---

## What's in the box

| Path | What it is |
| --- | --- |
| `src/` | The TypeScript library — perception, guardrails, action engine, chat UI |
| `server/` | Production Node proxy — auth, rate limiting, provider abstraction, usage logs |
| `presets/` | Five business workflows as editable JSON |
| `demo/` | A working admin dashboard with FlowPilot embedded — your sales demo |
| `landing-page/` | A complete sales page with pricing and FAQ |
| `docs/ADAPTERS.md` | How to swap the page-control engine |
| `QUICKSTART.md` | Get it running in 10 minutes |
| `BUSINESS-GUIDE.md` | Pricing, positioning, objection handling, launch plan |

Built bundle: **~13 KB gzipped**, zero runtime dependencies.

---

## How it works

```
User types  →  Read the page  →  Your proxy → LLM  →  Check guardrails  →  Act
                     ↑                                                       │
                     └───────────── repeat until done ───────────────────────┘
```

1. **Read the page.** Every visible interactive element is captured with its
   accessible label and a stable reference (`e12`). Structured text, not
   screenshots — cheaper, faster, and more accurate on dense B2B interfaces.
2. **Ask the model.** Your proxy adds the workflow prompt and calls your LLM.
   The API key never reaches the browser.
3. **Check guardrails.** Every proposed action is validated against your policy
   *before* it touches the DOM. Blocked controls stay blocked no matter what the
   model returns.
4. **Act.** Native browser event sequences, so React, Vue and Angular controlled
   inputs actually update. Then the loop repeats against the fresh page.

### A note on Alibaba's Page Agent

FlowPilot ships with its **own** DOM perception and action engine
(`src/perception.ts`, `src/actions.ts`), so it works standalone with no
third-party runtime. Alibaba's Page Agent — or a vendor SDK, or your own
automation layer — plugs in through the `PageAgentAdapter` interface without
touching the chat UI, presets, guardrails or proxy. See
[`docs/ADAPTERS.md`](docs/ADAPTERS.md).

---

## Quick start

```bash
# 1. Build the library
npm install
npm run build

# 2. Run the proxy
cd server
npm install
cp .env.example .env      # add your LLM_API_KEY
npm start                 # → http://localhost:8787

# 3. Open the demo (in another terminal, from the repo root)
npx serve .               # → http://localhost:3000/demo/
```

The demo runs with a built-in mock model, so it works with **no API key at all** —
useful on a sales call. Press **Connect live AI** in the demo toolbar to point it
at your real proxy.

Full walkthrough: [`QUICKSTART.md`](QUICKSTART.md).

---

## Configuration

```ts
new FlowPilot({
  endpoint: '/api/copilot',        // required — your proxy URL
  token: user.copilotToken,        // short-lived JWT your app mints

  brandName: 'Acme Assistant',
  brandLogo: '<svg>…</svg>',       // inline SVG or an image URL
  theme: { primary: '#003766', accent: '#FFB300' },
  position: 'bottom-right',

  preset: 'dashboard-reports',     // preset id, or a WorkflowPreset object
  systemPrompt: 'Extra instructions appended after the preset.',

  guardrails: {
    blockedSelectors: ['[data-danger]', '#billing-section'],
    confirmSelectors: ['button[type=submit]'],
    maxActionsPerTurn: 12,
    maxSteps: 6,
  },

  context: { plan: 'enterprise', role: user.role },
  onEvent: (event) => analytics.track(`copilot.${event.type}`, event.data),

  autoOpen: false,
  hotkey: 'mod+k',                 // or false to disable
});
```

Every option is documented with types in [`src/types.ts`](src/types.ts).

### Methods

| Method | Purpose |
| --- | --- |
| `open()` / `close()` / `toggle()` | Control the panel |
| `ask(text)` | Send a message programmatically — for "Ask the copilot" buttons |
| `setPreset(preset)` | Swap workflows when the user changes section |
| `setToken(token)` | Rotate the auth token without recreating the widget |
| `stop()` | Interrupt the current run |
| `destroy()` | Remove the widget entirely |

---

## Safety

This is the part that gets you through a security review.

**Marking controls in your HTML:**

```html
<button data-fp-block>Delete workspace</button>     <!-- never touchable -->
<button data-fp-confirm>Save changes</button>       <!-- must ask first -->
<div data-fp-ignore>…</div>                         <!-- invisible to the copilot -->
<div data-fp-context>Order #1042 · shipped</div>    <!-- extra context to read -->
```

**Enforced by default, with no configuration:**

- Password, credit-card, CVV and SSN fields refuse typed input.
- Every `button[type=submit]` and anything labelled delete/remove requires
  confirmation.
- Navigation is same-origin only — an agent that can be talked off-site is an
  exfiltration channel.
- Page text is wrapped in untrusted-content markers, and the guardrails never
  consult the model: a blocked control stays blocked even if the model insists.
- PII-shaped strings (emails, card numbers, SSNs, API keys) are redacted before
  the page description leaves the browser. **This is a deliberate trade-off:** a
  copilot cannot read back an email address it never received. If your workflow
  needs to (a CRM copilot reading a contact record, say), narrow the patterns:

  ```ts
  import { defaultGuardrails } from 'flowpilot';

  guardrails: {
    redactPatterns: defaultGuardrails.redactPatterns.filter(
      (p) => !p.source.includes('@'),   // keep emails readable
    ),
  }
  ```
- The server validates every action again — a malformed element reference never
  reaches a customer's DOM.

**The proxy refuses to start** with `ALLOWED_ORIGINS` empty or `AUTH_MODE=none`
in production. Those are the two mistakes that turn a copilot into someone
else's free API budget.

---

## Workflow presets

| id | Use case |
| --- | --- |
| `ecommerce-support` | Order status, tracking, returns, refunds |
| `crm-data-entry` | Turn a pasted email or call note into a filled CRM record |
| `dashboard-reports` | Plain-English control of a complex analytics dashboard |
| `form-automation` | Guided completion of long multi-step forms |
| `accessibility-navigator` | Hands-free navigation for assistive-tech users |

Each is a tuned prompt plus its own safety policy. Presets may only **narrow**
the permitted action set and **add** blocked selectors — a preset can never widen
what the copilot is allowed to do.

Add your own:

```ts
import { registerPreset } from 'flowpilot';

registerPreset({
  id: 'invoice-approval',
  name: 'Invoice Approval',
  description: 'Walks an approver through the invoice queue.',
  systemPrompt: 'You help finance staff review and approve invoices…',
  suggestions: ['Show invoices over $5,000', 'Approve the Acme invoice'],
  allowedActions: ['click', 'select', 'read', 'answer', 'done'],
  blockedSelectors: ['[data-payment-run]'],
});
```

---

## Deploying

**Landing page and demo** (static, from the repo root so both are served):

```bash
npx vercel --prod
```

`vercel.json` routes `/` to the landing page and `/demo` to the demo.

**Proxy** — any Node host (Railway, Render, Fly, a container). Set the
environment variables from `server/.env.example`, and put it on the same domain
as your app if you can, so the widget can send cookies without CORS.

---

## Testing

An end-to-end smoke test drives the real widget against the demo app:

```bash
npm install && npx playwright install chromium   # one-time
npm run build
npx serve .                                      # one terminal
npm run test:smoke                               # another
```

It asserts that the copilot navigates and filters a real table, fills a form,
stops before a confirm-gated submit, and is refused by a `data-fp-block` control.
Only the model is mocked — perception, guardrails and the action engine all run
for real.

---

## Browser support

Chrome, Edge, Firefox and Safari — anything with Shadow DOM and `fetch`. The
widget renders inside a shadow root, so your CSS and its CSS cannot collide.

---

## Licence

Commercial. See [`LICENSE.md`](LICENSE.md).
