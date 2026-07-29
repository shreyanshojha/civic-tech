/**
 * Design tokens, mirrored 1:1 from apps/web/src/styles.css.
 *
 * ---------------------------------------------------------------------------
 * THE SAME DESIGN PRINCIPLES BIND THIS APP. Read before adding a colour.
 *
 * 1. NO PARTISAN COLOUR. Red and blue are never used to encode party, and party
 *    is never used to sort, rank, or colour anything. There is no saturated red
 *    or blue in this palette for exactly that reason. A reader must not be able
 *    to tell at a glance "which side" a screen is about.
 *
 * 2. NO ALARM COLOURS ON SCORES. A high overlap score is not "bad" and must not
 *    be rendered in red. All overlap magnitudes use one single-hue ink ramp, so
 *    the eye reads "more / less", never "good / bad". See `ramp` below — the
 *    four steps differ only in weight.
 *
 * 3. DATA-FORWARD, NOT TABLOID. Numbers get the weight; the chrome recedes.
 *    No exclamation, no gradients, no drop shadows on data.
 *
 * 4. THE DISCLAIMER IS PART OF THE DESIGN, not an afterthought bolted to the
 *    bottom. It has a reserved, permanent place in the layout — the root layout
 *    renders it so a screen cannot omit it.
 *
 * Amber (`caveat`) is used ONLY for coverage caveats and data-gap notices,
 * never for scores and never for any judgement about a person.
 * ---------------------------------------------------------------------------
 */

import { createContext, useContext, useSyncExternalStore } from 'react';
import { Platform, useColorScheme } from 'react-native';

export interface Theme {
  scheme: 'light' | 'dark';
  ink0: string;
  ink1: string;
  ink2: string;
  ink3: string;
  ink4: string;
  ink5: string;
  ink6: string;
  ink7: string;
  paper: string;
  paperRaised: string;
  accent: string;
  accentSoft: string;
  accentLine: string;
  caveat: string;
  caveatSoft: string;
  caveatLine: string;
  radius: number;
  /** The one ramp used to show magnitude. Single hue, varying only in weight. */
  ramp: [string, string, string, string];
}

const LIGHT: Theme = {
  scheme: 'light',
  ink0: '#0c0d0e',
  ink1: '#1c1f22',
  ink2: '#3a4046',
  ink3: '#5c646c',
  ink4: '#868f98',
  ink5: '#b6bec5',
  ink6: '#dde1e5',
  ink7: '#eef0f2',
  paper: '#fbfbfa',
  paperRaised: '#ffffff',
  accent: '#1f5f5b',
  accentSoft: '#e6efee',
  accentLine: '#b9d2cf',
  caveat: '#7a5b18',
  caveatSoft: '#fbf3e0',
  caveatLine: '#e8d9b0',
  radius: 6,
  ramp: ['#dde1e5', '#b6bec5', '#5c646c', '#1c1f22'],
};

const DARK: Theme = {
  scheme: 'dark',
  ink0: '#f4f6f7',
  ink1: '#e4e8ea',
  ink2: '#c2c9ce',
  ink3: '#98a2aa',
  ink4: '#6f7a83',
  ink5: '#49525a',
  ink6: '#2b3238',
  ink7: '#1d2328',
  paper: '#14181b',
  paperRaised: '#1a1f23',
  accent: '#6fbdb5',
  accentSoft: '#17302e',
  accentLine: '#2c4d4a',
  caveat: '#d9bd77',
  caveatSoft: '#2c2617',
  caveatLine: '#4a3f22',
  radius: 6,
  ramp: ['#2b3238', '#49525a', '#98a2aa', '#e4e8ea'],
};

export const themes = { light: LIGHT, dark: DARK };

const ThemeContext = createContext<Theme>(LIGHT);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function canMatchMedia(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  );
}

function subscribeToWebScheme(onChange: () => void): () => void {
  if (!canMatchMedia()) return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const getWebScheme = (): 'light' | 'dark' =>
  canMatchMedia() && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';

/** During static rendering there is no `prefers-color-scheme`; assume light. */
const getWebSchemeOnServer = (): 'light' | 'dark' => 'light';

/**
 * Resolves the colour scheme ONCE, at the root, and hands the resulting token
 * set down by context. Every component reads it with `useTheme()`.
 *
 * On native, `useColorScheme()` is authoritative and correct on first render.
 *
 * The web build needs more care. `expo export --platform web` statically
 * renders every route in Node, where no media query exists, and
 * react-native-web's Appearance module then keeps the server's answer after
 * hydration until a media *change* event fires — so a reader whose OS is in
 * dark mode gets a light first paint that never corrects itself. Reading
 * `matchMedia` through `useSyncExternalStore` is the fix React provides for
 * exactly this shape of problem: it renders the server snapshot while
 * hydrating, then re-renders with the real client value immediately afterwards.
 *
 * Doing it here, once, also means one media listener for the whole app rather
 * than one per component.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const nativeScheme = useColorScheme();
  const webScheme = useSyncExternalStore(
    subscribeToWebScheme,
    getWebScheme,
    getWebSchemeOnServer,
  );

  const scheme = (Platform.OS === 'web' ? webScheme : nativeScheme) ?? 'light';
  const theme = scheme === 'dark' ? DARK : LIGHT;

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Tabular numerals, so figures in a column line up. Mirrors `.tnum`. */
export const TNUM = { fontVariant: ['tabular-nums' as const] };

/**
 * Font stacks. Native needs a single resolvable family name; web takes a CSS
 * stack. No custom font is bundled — system faces only, so the app stays small
 * and needs no font download at runtime.
 */
export const MONO = {
  fontFamily: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  }),
};

export const SERIF = {
  fontFamily: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  }),
};

/** Max readable measure, matching the web build's `max-w-content`. */
export const MAX_CONTENT = 760;
