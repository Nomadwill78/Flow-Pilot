# FlowPilot Quickstart

Ten minutes from clone to a working copilot. Written assuming you have not done
this before.

---

## What you need

- **Node.js 18 or newer.** Check with `node --version`. If that errors, install
  it from [nodejs.org](https://nodejs.org).
- **An API key from an AI provider.** Anthropic, OpenAI, Google — any of them.
- A terminal, and about ten minutes.

---

## Step 1 — Build the library (2 min)

From the project folder:

```bash
npm install
npm run build
```

You should see `dist/flowpilot.es.js` and `dist/flowpilot.umd.js` appear. That is
the file your customers will load.

---

## Step 2 — Look at the demo before anything else (1 min)

```bash
npx serve .
```

Open **http://localhost:3000/demo/** and click the circular button in the bottom
right. Try:

> show me refund requests

Watch the orders table actually filter. Then try:

> delete the workspace

Watch the guardrail refuse it.

The demo uses a built-in mock model, so **this works with no API key**. That is
deliberate: you can run a sales demo on a plane.

---

## Step 3 — Run the real proxy (4 min)

The proxy is what keeps your API key off the internet. Never skip it and call an
AI provider directly from the browser — anyone can read your key from the
network tab and spend your money.

```bash
cd server
npm install
cp .env.example .env
```

Open `server/.env` and set three things:

```bash
LLM_API_KEY=sk-your-real-key-here
LLM_MODEL=claude-sonnet-5
AUTH_MODE=none          # development only — see step 5
```

Then:

```bash
npm start
```

You should see `[FlowPilot] proxy listening on :8787`.

Check it:

```bash
curl http://localhost:8787/health
```

### Using a provider other than Anthropic

| Provider | `LLM_BASE_URL` | `LLM_PROTOCOL` |
| --- | --- | --- |
| Anthropic | `https://api.anthropic.com/v1` | `anthropic` |
| OpenAI | `https://api.openai.com/v1` | `openai` |
| Groq | `https://api.groq.com/openai/v1` | `openai` |
| Alibaba DashScope | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `openai` |
| Ollama (local) | `http://localhost:11434/v1` | `openai` |

Set `LLM_MODEL` to a model that provider actually offers.

---

## Step 4 — Connect the demo to your real model (1 min)

With the proxy running, go back to the demo and press **Connect live AI** in the
top bar. Enter:

```
http://localhost:8787/api/agent
```

Leave the token blank (you set `AUTH_MODE=none`). Now the copilot is running on
a real model against the demo dashboard — go off-script and ask it anything.

---

## Step 5 — Put it in your own app (2 min)

Add the script and initialise it:

```html
<script src="/path/to/flowpilot.umd.js"></script>
<script>
  FlowPilot.init({
    endpoint: '/api/copilot',
    brandName: 'Acme Assistant',
    preset: 'dashboard-reports',
    theme: { primary: '#003766', accent: '#FFB300' },
  });
</script>
```

Or with a bundler:

```ts
import { FlowPilot } from 'flowpilot';

new FlowPilot({
  endpoint: '/api/copilot',
  token: currentUser.copilotToken,
  brandName: 'Acme Assistant',
  preset: 'dashboard-reports',
});
```

### Before production: turn auth back on

In `server/.env`:

```bash
NODE_ENV=production
AUTH_MODE=jwt
JWT_SECRET=<a long random string>
JWT_ISSUER=your-app
ALLOWED_ORIGINS=https://app.yourcompany.com
```

Then mint a short-lived token for each signed-in user in your existing backend:

```js
import jwt from 'jsonwebtoken';

const copilotToken = jwt.sign(
  { sub: user.id, plan: user.plan },
  process.env.JWT_SECRET,
  { issuer: 'your-app', expiresIn: '30m' },
);
```

Pass it to the widget as `token`. The proxy verifies it and uses `sub` for
per-user rate limiting.

The proxy **refuses to start** in production with auth off or origins unset.
That is intentional — those are the two mistakes that get expensive.

---

## Step 6 — Mark up your app (the only real work)

This is where you spend your actual time, and it is worth doing carefully.

**1. Protect anything dangerous:**

```html
<button data-fp-block>Delete account</button>
<button data-fp-confirm>Submit payment</button>
```

**2. Label your buttons.** The copilot reads accessible labels. An icon-only
button with no label is invisible to it — and to screen readers:

```html
<!-- Before: the copilot sees "button" -->
<button><svg>…</svg></button>

<!-- After: the copilot sees "Export report" -->
<button aria-label="Export report"><svg>…</svg></button>
```

**3. Hide the noise:**

```html
<div data-fp-ignore>…cookie banner, chat widget, ad slot…</div>
```

**4. Give it useful context:**

```html
<div data-fp-context>Viewing order #1042, status: shipped, total $312.00</div>
```

---

## Troubleshooting

**The copilot says it can't find an element.**
It only sees what is *visible*. Elements inside a closed accordion, an unopened
modal, or a `hidden` section do not exist to it — it has to click to open them
first, like a user would. Check the labels are meaningful, too.

**Actions run but nothing changes in my React app.**
The action engine dispatches native events using the prototype value setter,
which handles controlled inputs correctly. If a custom component still ignores
it, add `data-fp-action="describe what it does"` to the real interactive element
rather than its wrapper.

**"Assistant unavailable" in the panel.**
Look at the proxy's terminal output — the real error is logged there and
deliberately not sent to the browser. Usually a wrong `LLM_API_KEY`, a model
name the provider doesn't offer, or a `LLM_BASE_URL`/`LLM_PROTOCOL` mismatch.

**CORS errors in the browser console.**
Add your app's origin to `ALLOWED_ORIGINS` in `server/.env`, comma-separated,
with the scheme and no trailing slash.

**It hits the action limit.**
Raise `guardrails.maxActionsPerTurn` and `maxSteps`. If a routine task needs
more than a dozen actions, a preset with sharper instructions usually beats
raising the ceiling.

---

## What next

- Tune a preset in `presets/*.json` against your real screens. This is the
  single highest-leverage thing you can do.
- Read [`BUSINESS-GUIDE.md`](BUSINESS-GUIDE.md) for pricing and go-to-market.
- Read [`docs/ADAPTERS.md`](docs/ADAPTERS.md) to swap the page-control engine.
