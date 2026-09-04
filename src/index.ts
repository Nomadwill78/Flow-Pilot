/**
 * FlowPilot — white-label AI copilot for web apps.
 *
 * Quick start:
 *
 *   import { FlowPilot } from 'flowpilot';
 *
 *   new FlowPilot({
 *     endpoint: 'https://copilot.yourcompany.com/api/agent',
 *     token: currentUser.copilotToken,
 *     brandName: 'Acme Assistant',
 *     preset: 'crm-data-entry',
 *   });
 */
export { FlowPilot } from './FlowPilot.js';
export { builtinAdapter, externalAdapter } from './adapter.js';
export type { PageAgentAdapter } from './adapter.js';
export { defaultTheme, darkTheme, resolveTheme } from './theme.js';
export { defaultGuardrails, resolveGuardrails } from './guardrails.js';
export { registerPreset, getPreset, listPresets, builtinPresets, genericPreset } from './presets.js';
export { perceive, snapshotToPrompt, elementForRef } from './perception.js';
export { execute as executeAction } from './actions.js';
export type * from './types.js';

import { FlowPilot } from './FlowPilot.js';
import type { FlowPilotConfig } from './types.js';

/**
 * Convenience factory for script-tag users, where the UMD bundle exposes the
 * whole module as `window.FlowPilot`:
 *
 *   FlowPilot.init({ endpoint: '/api/agent', preset: 'crm-data-entry' });
 */
export function init(config: FlowPilotConfig): FlowPilot {
  return new FlowPilot(config);
}
