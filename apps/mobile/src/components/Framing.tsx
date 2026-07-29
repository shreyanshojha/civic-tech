/**
 * The framing components.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS LOAD-BEARING. Read before changing.
 *
 * Every disclaimer string in this app comes from @ftm/core (which is
 * packages/core/src/disclaimer.ts, the single source of truth for the whole
 * project). No component here writes its own wording, so the framing cannot
 * drift between the web build and the mobile build, and cannot be softened in
 * one place without being softened everywhere.
 *
 * If you are adding a screen: import from here. Do not type a sentence about
 * correlation into a <Text>.
 *
 * <PersistentDisclaimer/> is rendered once by app/_layout.tsx, outside the
 * navigator, so it is present on every route by construction — a screen cannot
 * forget it and there is no prop that turns it off. There is deliberately no
 * dismiss control: the whole product thesis is that this framing travels with
 * the data, and a dismissable banner is a banner that gets dismissed.
 *
 * <ScoreExplainer/> must appear anywhere an overlap number does. <OverlapScore/>
 * composes it in automatically so a developer cannot render a bare number by
 * accident.
 * ---------------------------------------------------------------------------
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import {
  DISCLAIMER_LONG,
  DISCLAIMER_MEDIUM,
  DISCLAIMER_SHORT,
  OVERLAP_BAND_LABEL,
  OVERLAP_BAND_NOTE,
  SCORE_EXPLAINER,
  overlapBand,
} from '@ftm/core';
import { TNUM, useTheme, type Theme } from '../theme';

/**
 * The lead clause of DISCLAIMER_SHORT is set in bold. Derived by splitting the
 * canonical string at its first sentence boundary — never retyped, so editing
 * disclaimer.ts still changes what this banner says.
 */
const SHORT_LEAD = `${DISCLAIMER_SHORT.split('. ')[0] ?? DISCLAIMER_SHORT}.`;
const SHORT_REST = DISCLAIMER_SHORT.slice(SHORT_LEAD.length).trim();

/**
 * The permanent banner. Pinned above the safe-area inset at the bottom of every
 * screen. Not conditional on route, scroll position, or dismissal.
 */
export function PersistentDisclaimer({ bottomInset = 0 }: { bottomInset?: number }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="How to read this app"
      style={[
        styles.banner,
        {
          backgroundColor: t.paperRaised,
          borderTopColor: t.ink6,
          paddingBottom: 10 + bottomInset,
        },
      ]}
    >
      <View style={[styles.dot, { borderColor: t.accent }]} />
      <Text style={[styles.bannerText, { color: t.ink3 }]}>
        <Text style={{ fontWeight: '600', color: t.ink2 }}>{SHORT_LEAD} </Text>
        {SHORT_REST}{' '}
        <Link href="/about" style={{ color: t.accent }}>
          How the numbers work →
        </Link>
      </Text>
    </View>
  );
}

/** Medium-weight framing, for the top of any screen that shows a computed score. */
export function InlineDisclaimer({ style }: { style?: object }) {
  const t = useTheme();
  return (
    <View style={[caveatBox(t), style]}>
      <Text style={[styles.caveatText, { color: t.caveat }]}>{DISCLAIMER_MEDIUM}</Text>
    </View>
  );
}

export function ShortDisclaimer({ style }: { style?: object }) {
  const t = useTheme();
  return <Text style={[styles.short, { color: t.ink4 }, style]}>{DISCLAIMER_SHORT}</Text>;
}

export function LongDisclaimer() {
  const t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {DISCLAIMER_LONG.split('\n\n').map((p, i) => (
        <Text key={i} style={[styles.long, { color: t.ink2 }]}>
          {p}
        </Text>
      ))}
    </View>
  );
}

export function ScoreExplainer({ open: initial = false }: { open?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(initial);
  return (
    <View style={{ marginTop: 8 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
      >
        <Text style={[styles.explainerToggle, { color: t.ink3, textDecorationColor: t.ink5 }]}>
          {open ? 'Hide' : 'What does this number mean?'}
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            marginTop: 8,
            gap: 10,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.ink6,
            backgroundColor: t.paper,
            borderRadius: t.radius,
            padding: 12,
          }}
        >
          <ExplainerBlock label="What it is" body={SCORE_EXPLAINER.what} />
          <ExplainerBlock label="What it is not" body={SCORE_EXPLAINER.whatItIsNot} />
          <ExplainerBlock label="How to use it" body={SCORE_EXPLAINER.howToUse} />
        </View>
      )}
    </View>
  );
}

function ExplainerBlock({ label, body }: { label: string; body: string }) {
  const t = useTheme();
  return (
    <View>
      <Text style={[styles.label, { color: t.ink4 }]}>{label}</Text>
      <Text style={[styles.explainerBody, { color: t.ink2 }]}>{body}</Text>
    </View>
  );
}

/**
 * The only sanctioned way to render an overlap score.
 *
 * It always renders the band label and (unless the caller is a dense list that
 * links straight through to a screen that shows it) the explainer, so a score
 * can never appear stripped of its meaning. The bar uses the neutral ink ramp —
 * never a red/green scale, which would imply a verdict.
 */
export function OverlapScore({
  score,
  size = 'md',
  showExplainer = true,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showExplainer?: boolean;
}) {
  const t = useTheme();
  const band = overlapBand(score);
  const pct = Math.round(score * 100);
  const rampColor = { minimal: t.ramp[0], some: t.ramp[1], substantial: t.ramp[2], high: t.ramp[3] }[band];
  const numberSize = { sm: 18, md: 24, lg: 34 }[size];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <Text style={[TNUM, { fontSize: numberSize, fontWeight: '600', color: t.ink0 }]}>{pct}%</Text>
        {/* The band label is not optional. A bare number is never rendered. */}
        <Text style={{ fontSize: 13, color: t.ink3 }}>{OVERLAP_BAND_LABEL[band]}</Text>
      </View>
      <View
        accessibilityRole="image"
        accessibilityLabel={`Overlap ${pct} percent. ${OVERLAP_BAND_LABEL[band]}.`}
        style={{
          marginTop: 6,
          height: 6,
          width: '100%',
          borderRadius: 999,
          backgroundColor: t.ink7,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            borderRadius: 999,
            backgroundColor: rampColor,
            width: `${Math.max(2, Math.min(100, pct))}%`,
          }}
        />
      </View>
      <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 17, color: t.ink3 }}>
        {OVERLAP_BAND_NOTE[band]}
      </Text>
      {showExplainer && <ScoreExplainer />}
    </View>
  );
}

/**
 * Amber note used ONLY for data-coverage caveats, never for judgements.
 *
 * Children are always wrapped in a <Text>. React Native throws on a bare string
 * inside a <View>, and it is easy to trip that by passing two adjacent string
 * expressions — the wrapper makes the component safe to call either way.
 */
export function CoverageNote({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={caveatBox(t)}>
      <Text style={[styles.caveatText, { color: t.caveat }]}>{children}</Text>
    </View>
  );
}

function caveatBox(t: Theme) {
  return {
    backgroundColor: t.caveatSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.caveatLine,
    borderRadius: t.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
  };
}

const styles = StyleSheet.create({
  banner: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    marginTop: 4,
    width: 13,
    height: 13,
    borderRadius: 999,
    borderWidth: 1.4,
  },
  bannerText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  caveatText: { fontSize: 13, lineHeight: 19.5 },
  short: { fontSize: 12.5, lineHeight: 17 },
  long: { fontSize: 15, lineHeight: 23 },
  label: {
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 3,
  },
  explainerToggle: {
    fontSize: 12.5,
    textDecorationLine: 'underline',
  },
  explainerBody: { fontSize: 13, lineHeight: 19 },
});
