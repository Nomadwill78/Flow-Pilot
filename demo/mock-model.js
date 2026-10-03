/**
 * Demo-only mock model.
 *
 * This is NOT part of the product — it exists so the demo runs on a static
 * host with no API key, which is what you want on a sales call.
 *
 * Importantly, it fakes only the *model*. Everything else is the real
 * FlowPilot: real DOM perception, real guardrails, real action execution. The
 * dashboard really is being driven. Flip the "Live AI" switch to route the same
 * loop through your actual proxy instead.
 */
(function () {
  /**
   * Each turn declares the elements it needs (`find`) and the actions to take
   * once they resolve. A turn whose elements are not on screen is skipped, so
   * the scripts work no matter which view the demo starts on.
   */
  const scripts = [
    {
      match: /refund|return/i,
      turns: [
        {
          find: [{ label: /^orders$/i, role: 'button|link|tab', as: 'nav' }],
          actions: (r) => [{ type: 'click', ref: r.nav, reason: 'Open the Orders view' }],
          message: 'Opening the orders table.',
        },
        {
          find: [{ label: /status/i, role: 'select', as: 'status' }],
          actions: (r) => [
            { type: 'select', ref: r.status, value: 'Refund requested', reason: 'Filter to refund requests' },
          ],
          message: 'Filtering the status column to "Refund requested".',
        },
        {
          actions: () => [{ type: 'done', reason: 'Task complete' }],
          message: '3 orders are awaiting a refund decision, totalling $1,284. The oldest — #1042 — has been waiting 6 days.',
          done: true,
        },
      ],
    },
    {
      match: /add|create|new customer|contact|lead/i,
      turns: [
        {
          find: [{ label: /^customers$/i, role: 'button|link|tab', as: 'nav' }],
          actions: (r) => [{ type: 'click', ref: r.nav, reason: 'Open the Customers view' }],
          message: 'Opening the customers section.',
        },
        {
          find: [{ label: /new customer/i, role: 'button', as: 'add' }],
          actions: (r) => [{ type: 'click', ref: r.add, reason: 'Open the new customer form' }],
          message: 'Opening the new customer form.',
        },
        {
          find: [
            { label: /full name/i, role: 'textbox', as: 'name' },
            { label: /email/i, role: 'textbox', as: 'email' },
            { label: /company/i, role: 'textbox', as: 'company' },
            { label: /plan/i, role: 'select', as: 'plan' },
          ],
          actions: (r) => [
            { type: 'type', ref: r.name, value: 'Dana Whitfield', reason: 'Fill the contact name' },
            { type: 'type', ref: r.email, value: 'dana@brightpath.io', reason: 'Fill the email' },
            { type: 'type', ref: r.company, value: 'BrightPath Logistics', reason: 'Fill the company' },
            { type: 'select', ref: r.plan, value: 'Enterprise', reason: 'Set the plan' },
          ],
          message: 'Filling in the details from your note.',
        },
        {
          actions: () => [{ type: 'done', reason: 'Awaiting user review' }],
          message: "Filled in name, email, company and plan. Review it and press Save — I won't submit that without your approval.",
          done: true,
        },
      ],
    },
    {
      match: /revenue|report|quarter|sales|how did we|how are we/i,
      turns: [
        {
          find: [{ label: /^dashboard$/i, role: 'button|link|tab', as: 'nav' }],
          actions: (r) => [{ type: 'click', ref: r.nav, reason: 'Open the Dashboard' }],
          message: 'Opening the dashboard.',
        },
        {
          find: [{ label: /reporting period/i, role: 'select', as: 'period' }],
          actions: (r) => [
            { type: 'select', ref: r.period, value: 'Last quarter', reason: 'Set the reporting period' },
          ],
          message: 'Switching the reporting period to last quarter.',
        },
        {
          actions: () => [{ type: 'done', reason: 'Reported the figures' }],
          message: 'Last quarter closed at $284,910 across 1,247 orders, at a $228 average order value — ahead of this quarter to date.',
          done: true,
        },
      ],
    },
    {
      match: /delete|remove|wipe|drop|destroy/i,
      turns: [
        {
          find: [{ label: /^settings$/i, role: 'button|link|tab', as: 'nav' }],
          actions: (r) => [{ type: 'click', ref: r.nav, reason: 'Open Settings' }],
          message: 'Opening settings.',
        },
        {
          find: [{ label: /delete workspace/i, role: 'button', as: 'del' }],
          actions: (r) => [{ type: 'click', ref: r.del, reason: 'Attempt to delete the workspace' }],
          message: 'Attempting that now — watch the guardrail.',
        },
        {
          actions: () => [{ type: 'done', reason: 'Blocked by policy' }],
          message: "That control is protected by your guardrail policy, so I can't press it. A human with the right permission has to do that one.",
          done: true,
        },
      ],
    },
    {
      match: /run the same-origin navigation smoke test/i,
      turns: [
        {
          actions: () => [{
            type: 'navigate',
            url: `${window.location.pathname}#flowpilot-navigation-check`,
            reason: 'Open the same page with a test marker',
          }],
          message: 'Opening the requested page after confirmation.',
        },
      ],
    },
    {
      match: /run the off-site navigation smoke test/i,
      turns: [
        {
          actions: () => [{
            type: 'navigate',
            url: 'https://example.com/',
            reason: 'Attempt an off-site navigation for the safety test',
          }],
          message: 'Checking whether off-site navigation is blocked.',
        },
      ],
    },
  ];

  const state = { script: null, turn: 0 };

  /** Pull `[e12] role "Label"` lines out of the page description FlowPilot sent. */
  function parseElements(page) {
    const out = [];
    const pattern = /\[(e\d+)\]\s+(\S+)\s+"([^"]*)"/g;
    let match;
    while ((match = pattern.exec(page))) {
      out.push({ ref: match[1], role: match[2], label: match[3] });
    }
    return out;
  }

  function resolveRefs(finders, page) {
    const elements = parseElements(page);
    const refs = {};
    for (const finder of finders || []) {
      const roleRe = finder.role ? new RegExp(`^(${finder.role})$`, 'i') : null;
      const hit = elements.find(
        (el) => finder.label.test(el.label) && (!roleRe || roleRe.test(el.role)),
      );
      if (hit) refs[finder.as] = hit.ref;
    }
    return refs;
  }

  const realFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url ?? '';

    if (!url.includes('/__demo__/agent')) {
      return realFetch(input, init);
    }

    const body = JSON.parse(init?.body ?? '{}');
    const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';

    // A new user message starts a new script; follow-ups continue it.
    if (state.turn === 0 || state.lastText !== text) {
      state.script = scripts.find((s) => s.match.test(text)) ?? fallback;
      state.turn = 0;
      state.lastText = text;
    }

    const turn = state.script.turns[state.turn];
    state.turn++;

    // A little latency so the demo feels like a real model, not a canned script.
    await new Promise((resolve) => setTimeout(resolve, 550 + Math.random() * 400));

    if (!turn) {
      state.turn = 0;
      return jsonResponse({ message: '', actions: [], done: true });
    }

    const refs = resolveRefs(turn.find, body.page ?? '');

    // Drop any action whose element is not currently on screen. A turn that
    // loses every action is skipped entirely — that is how the scripts stay
    // correct regardless of which view the demo happens to be on.
    const actions = turn.actions(refs).filter((a) => !('ref' in a) || typeof a.ref === 'string');

    if (turn.done) state.turn = 0;

    if (!actions.length && !turn.done) {
      // Nothing to do this turn; advance immediately rather than stalling.
      return jsonResponse({ message: '', actions: [{ type: 'wait', ms: 60 }], done: false });
    }

    return jsonResponse({
      message: turn.message,
      actions,
      done: Boolean(turn.done),
    });
  };

  function jsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  window.__flowpilotDemoMock = { reset: () => { state.turn = 0; state.script = null; } };
})();
