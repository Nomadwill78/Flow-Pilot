# Adapters — swapping the page-control engine

FlowPilot separates **what drives the page** from everything else. The chat UI,
workflow presets, guardrails, proxy and telemetry all sit above a single
interface, so you can replace the engine underneath without touching them.

## Why this seam exists

The built-in engine (`builtinAdapter`) has no third-party dependency, so
FlowPilot works the moment you install it. But you may want to:

- run **Alibaba's Page Agent**, or another vendor runtime, underneath it;
- reuse an in-house automation layer your team already trusts;
- drive a canvas or WebGL app the DOM cannot describe;
- record and replay actions in tests.

All four are the same change: supply an adapter.

## The interface

```ts
interface PageAgentAdapter {
  name: string;
  perceive(maxElements: number, maxTextChars: number): PageSnapshot | Promise<PageSnapshot>;
  describe(snapshot: PageSnapshot): string;
  execute(action: AgentAction): Promise<ActionResult>;
}
```

- **`perceive`** returns the current page as a `PageSnapshot`. Each element needs
  a `ref` matching `e\d+` — that reference is the only thing the model is allowed
  to point at, which is what stops a prompt-injected page from steering the agent
  onto arbitrary nodes.
- **`describe`** renders a snapshot into the text sent to the model.
- **`execute`** performs one action and reports what happened.

## Wrapping a runtime on `window`

`externalAdapter` handles the common case where a vendor script exposes a global.
If the global is missing it falls back to the built-in engine and logs a warning,
so a script that fails to load never breaks your app.

```ts
import { FlowPilot, externalAdapter } from 'flowpilot';

const adapter = externalAdapter({
  name: 'page-agent',
  globalKey: 'PageAgent',        // whatever the vendor script defines

  perceive: async (runtime, maxElements, maxTextChars) => {
    const snapshot = await runtime.snapshot({ limit: maxElements });

    return {
      url: location.href,
      title: document.title,
      text: snapshot.text.slice(0, maxTextChars),
      elements: snapshot.nodes.map((node, i) => ({
        ref: `e${i + 1}`,
        tag: node.tagName,
        role: node.role,
        label: node.name,
        value: node.value,
        el: node.element,
      })),
    };
  },

  execute: async (runtime, action) => {
    try {
      await runtime.perform(action.type, action.ref, action.value);
      return { ok: true, action, detail: action.reason ?? 'Done' };
    } catch (error) {
      return { ok: false, action, detail: error.message };
    }
  },
});

new FlowPilot({ endpoint: '/api/copilot', preset: 'crm-data-entry' }, adapter);
```

Note the second constructor argument — that is where the adapter goes.

## Guardrails still apply

Whatever the adapter does, guardrails run **before** `execute` is called, in
`FlowPilot.runAction`. A custom adapter cannot bypass a blocked selector, skip a
confirmation, or type into a password field. That property is what makes it safe
to hand this seam to a customer's engineering team.

The one thing an adapter must hold up: `elementForRef(ref)` has to resolve to the
real DOM element, because that is what the guardrails inspect. If your adapter
maintains its own reference map, keep the elements reachable through the built-in
`perceive` map as well, or supply DOM elements on the `el` field of each
`PerceivedElement` — which is what the example above does.

## Testing with a fake adapter

```ts
const recorded: AgentAction[] = [];

const testAdapter: PageAgentAdapter = {
  name: 'test',
  perceive: () => ({ url: '/', title: 'Test', text: '', elements: [] }),
  describe: () => 'PAGE: Test\nINTERACTIVE ELEMENTS:\n(none)',
  execute: async (action) => {
    recorded.push(action);
    return { ok: true, action, detail: 'recorded' };
  },
};
```

This is also how `demo/mock-model.js` is able to exercise the real agent loop
with no API key — except it fakes the *model* rather than the adapter, so the
perception, guardrail and action layers are all genuinely running.
