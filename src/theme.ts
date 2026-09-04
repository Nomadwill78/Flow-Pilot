import type { FlowPilotTheme } from './types.js';

/**
 * Default palette — Nomad Consulting brand.
 * White-label customers override any subset via `config.theme`.
 */
export const defaultTheme: FlowPilotTheme = {
  primary: '#003766',      // Nomad Navy
  primaryDark: '#00172C',  // Deep Midnight
  accent: '#FFB300',       // Compass Gold
  accentText: '#00172C',
  surface: '#FFFFFF',      // Bright White
  surfaceMuted: '#F4F1EA', // Soft Sand
  text: '#00172C',
  textMuted: '#5B6B7B',
  border: '#E3DED2',
  radius: '16px',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  shadow: '0 24px 60px -12px rgba(0, 23, 44, 0.35)',
};

/** A ready-made dark theme integrators can pass straight through. */
export const darkTheme: FlowPilotTheme = {
  ...defaultTheme,
  primary: '#0A2540',
  primaryDark: '#04121F',
  surface: '#0F1B26',
  surfaceMuted: '#16242F',
  text: '#EAF1F7',
  textMuted: '#93A5B4',
  border: '#22323F',
  shadow: '0 24px 60px -12px rgba(0, 0, 0, 0.6)',
};

export function resolveTheme(overrides?: Partial<FlowPilotTheme>): FlowPilotTheme {
  return { ...defaultTheme, ...(overrides ?? {}) };
}

/** Emit the theme as CSS custom properties scoped to the widget root. */
export function themeToCssVars(theme: FlowPilotTheme): string {
  return [
    `--fp-primary:${theme.primary}`,
    `--fp-primary-dark:${theme.primaryDark}`,
    `--fp-accent:${theme.accent}`,
    `--fp-accent-text:${theme.accentText}`,
    `--fp-surface:${theme.surface}`,
    `--fp-surface-muted:${theme.surfaceMuted}`,
    `--fp-text:${theme.text}`,
    `--fp-text-muted:${theme.textMuted}`,
    `--fp-border:${theme.border}`,
    `--fp-radius:${theme.radius}`,
    `--fp-font:${theme.fontFamily}`,
    `--fp-shadow:${theme.shadow}`,
  ].join(';');
}
