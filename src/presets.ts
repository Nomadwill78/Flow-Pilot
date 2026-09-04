import type { WorkflowPreset } from './types.js';

import ecommerceSupport from '../presets/ecommerce-support.json';
import crmDataEntry from '../presets/crm-data-entry.json';
import dashboardReports from '../presets/dashboard-reports.json';
import formAutomation from '../presets/form-automation.json';
import accessibilityNavigator from '../presets/accessibility-navigator.json';

/**
 * The five workflows that ship with FlowPilot.
 *
 * The JSON files under `presets/` are the source of truth so that customers on
 * a white-label licence can edit a workflow without touching TypeScript.
 */
const builtin: WorkflowPreset[] = [
  ecommerceSupport as WorkflowPreset,
  crmDataEntry as WorkflowPreset,
  dashboardReports as WorkflowPreset,
  formAutomation as WorkflowPreset,
  accessibilityNavigator as WorkflowPreset,
];

const registry = new Map<string, WorkflowPreset>(builtin.map((p) => [p.id, p]));

/** Add or replace a preset at runtime. Returns the registered preset. */
export function registerPreset(preset: WorkflowPreset): WorkflowPreset {
  registry.set(preset.id, preset);
  return preset;
}

export function getPreset(id: string): WorkflowPreset | undefined {
  return registry.get(id);
}

export function listPresets(): WorkflowPreset[] {
  return Array.from(registry.values());
}

/** A neutral fallback used when no preset is configured. */
export const genericPreset: WorkflowPreset = {
  id: 'generic',
  name: 'Assistant',
  description: 'General-purpose copilot for any web application.',
  greeting: 'Hi! Tell me what you want to do on this page and I\'ll take care of it.',
  systemPrompt:
    'You are a helpful copilot embedded in a web application. Complete the user\'s request by interacting with the page. Prefer the shortest correct path, and never invent information that is not visible on the page.',
  suggestions: ['What can I do on this page?', 'Summarise this page for me'],
};

export { builtin as builtinPresets };
