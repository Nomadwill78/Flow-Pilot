import type { AgentAction, ActionResult, PageSnapshot } from './types.js';
import { perceive, snapshotToPrompt } from './perception.js';
import { execute } from './actions.js';

/**
 * Page-agent adapter.
 *
 * FlowPilot ships with a self-contained DOM engine (`builtinAdapter`) so the
 * product works out of the box with zero third-party runtime. The interface
 * below is the seam: point it at Alibaba's Page Agent, a vendor SDK, or your
 * own automation layer and the rest of FlowPilot — chat UI, presets,
 * guardrails, proxy — is unchanged.
 *
 * See docs/ADAPTERS.md for a worked example.
 */
export interface PageAgentAdapter {
  /** Human-readable id, surfaced in telemetry. */
  name: string;
  /** Read the current page into a structured snapshot. */
  perceive(maxElements: number, maxTextChars: number): PageSnapshot | Promise<PageSnapshot>;
  /** Render a snapshot into the text handed to the model. */
  describe(snapshot: PageSnapshot): string;
  /** Perform one action against the live page. */
  execute(action: AgentAction): Promise<ActionResult>;
}

/** The default engine. No external dependency. */
export const builtinAdapter: PageAgentAdapter = {
  name: 'flowpilot-dom',
  perceive: (maxElements, maxTextChars) => perceive(maxElements, maxTextChars),
  describe: (snapshot) => snapshotToPrompt(snapshot),
  execute: (action) => execute(action),
};

/**
 * Wrap an external page-agent runtime exposed on `window`.
 *
 * Pass the global's name and thin mapping functions; FlowPilot handles the
 * chat loop, guardrails and telemetry around it. Falls back to the builtin
 * engine when the global is absent, so a missing script never breaks the app.
 */
export function externalAdapter(options: {
  name: string;
  globalKey: string;
  perceive: (runtime: unknown, maxElements: number, maxTextChars: number) => PageSnapshot | Promise<PageSnapshot>;
  describe?: (snapshot: PageSnapshot) => string;
  execute: (runtime: unknown, action: AgentAction) => Promise<ActionResult>;
}): PageAgentAdapter {
  const runtime = (globalThis as Record<string, unknown>)[options.globalKey];

  if (!runtime) {
    console.warn(
      `[FlowPilot] "${options.globalKey}" not found on window — falling back to the built-in DOM engine.`,
    );
    return builtinAdapter;
  }

  return {
    name: options.name,
    perceive: (maxElements, maxTextChars) => options.perceive(runtime, maxElements, maxTextChars),
    describe: options.describe ?? snapshotToPrompt,
    execute: (action) => options.execute(runtime, action),
  };
}
