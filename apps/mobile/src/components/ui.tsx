/**
 * Shared UI primitives, mirroring apps/web/src/components/ui.tsx.
 *
 * Rules encoded here so screens cannot break them:
 *  - Party is rendered as a plain neutral letter, never as a colour. See
 *    <PartyTag/>: it has one style regardless of party.
 *  - Money is always tabular-numeral and always labelled with its cycle.
 *  - Industry bars use one hue; sector identity comes from the label, not from
 *    a colour the reader has to decode.
 *  - Every figure gets a route back to the primary filing: <SourceLink/>.
 */

import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { INDUSTRY_BY_ID, usd } from '@ftm/core';
import type { IndustryId } from '@ftm/core';
import { MONO, TNUM, useTheme } from '../theme';

// ---------------------------------------------------------------------------

export function Screen({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.paper }}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.paperRaised,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.ink6,
          borderRadius: t.radius,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[s.label, { color: t.ink4 }]}>{children}</Text>;
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        marginBottom: 12,
        paddingBottom: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.ink6,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink0 }}>{children}</Text>
      {note !== undefined &&
        (typeof note === 'string' ? (
          <Text style={{ fontSize: 12, color: t.ink4 }}>{note}</Text>
        ) : (
          note
        ))}
    </View>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ minWidth: 130, flexGrow: 1, flexBasis: '44%' }}>
      <Label>{label}</Label>
      <Text style={[TNUM, { marginTop: 2, fontSize: 20, fontWeight: '600', color: t.ink0 }]}>
        {value}
      </Text>
      {sub !== undefined &&
        (typeof sub === 'string' ? (
          <Text style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17, color: t.ink4 }}>{sub}</Text>
        ) : (
          sub
        ))}
    </View>
  );
}

/**
 * Party is a fact about a person and is shown as such. It is never used to
 * colour, sort, rank or filter anything anywhere in this application.
 */
export function PartyTag({ party }: { party?: string }) {
  const t = useTheme();
  if (!party) return null;
  const letter = /^dem/i.test(party)
    ? 'D'
    : /^rep/i.test(party)
      ? 'R'
      : /^ind/i.test(party)
        ? 'I'
        : party.slice(0, 1).toUpperCase();
  return (
    <View
      accessibilityLabel={party}
      style={{
        minWidth: 19,
        height: 19,
        paddingHorizontal: 4,
        borderRadius: 3,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.ink6,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: t.ink3 }}>{letter}</Text>
    </View>
  );
}

export function Chip({
  children,
  active = false,
  onPress,
  trailing,
}: {
  children: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  trailing?: string;
}) {
  const t = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? t.accentLine : t.ink6,
        backgroundColor: active ? t.accentSoft : t.paperRaised,
      }}
    >
      <Text style={{ fontSize: 12, color: active ? t.accent : t.ink2 }}>{children}</Text>
      {trailing !== undefined && (
        <Text style={[TNUM, { fontSize: 12, color: t.ink4 }]}>{trailing}</Text>
      )}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      {body}
    </Pressable>
  );
}

/**
 * A visible provenance link. Every figure in this app must be traceable to a
 * primary government record. Tapping it leaves the app entirely — this is the
 * only outbound action the app can take, and it is always reader-initiated.
 */
export function SourceLink({ href, children }: { href: string; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(href);
      }}
      accessibilityRole="link"
      hitSlop={6}
    >
      <Text style={{ fontSize: 12, color: t.ink4 }}>
        {children ?? 'Primary source'} <Text style={{ color: t.accent }}>↗</Text>
      </Text>
    </Pressable>
  );
}

export function MethodTag({ method }: { method: string | null | undefined }) {
  if (!method) return null;
  const map: Record<string, string> = {
    llm: 'Classified by a language model',
    'keyword-fallback': 'Classified from Library of Congress metadata (no language model)',
    keyword: 'Matched by keyword',
    'committee-type': 'From the FEC committee record',
    naics: 'From the NAICS industry code',
    placeholder: 'No employer on file',
    unassigned: 'Not attributed',
  };
  return <Chip>{map[method] ?? method}</Chip>;
}

/** Horizontal bar list of industry amounts. One hue, magnitude by length. */
export function IndustryBars({
  rows,
  showAmounts = true,
}: {
  rows: { industry: IndustryId; amount: number; share: number }[];
  showAmounts?: boolean;
}) {
  const t = useTheme();
  if (rows.length === 0) {
    return (
      <Text style={{ fontSize: 13, color: t.ink4 }}>
        No sector-attributable money in this cycle.
      </Text>
    );
  }
  const top = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={r.industry}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, color: t.ink2 }}>
              {INDUSTRY_BY_ID[r.industry]?.label ?? r.industry}
            </Text>
            {showAmounts && (
              <Text style={[TNUM, { fontSize: 13, color: t.ink3 }]}>
                {usd(r.amount, { compact: true })}{' '}
                <Text style={{ color: t.ink4 }}>{(r.share * 100).toFixed(1)}%</Text>
              </Text>
            )}
          </View>
          <View
            style={{
              marginTop: 4,
              height: 4,
              borderRadius: 999,
              backgroundColor: t.ink7,
              overflow: 'hidden',
            }}
          >
            {/* One hue. Length carries the magnitude, colour carries nothing. */}
            <View
              style={{
                height: '100%',
                borderRadius: 999,
                backgroundColor: t.ink3,
                width: `${Math.max(1.5, (r.amount / top) * 100)}%`,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Member portrait placeholder.
 *
 * The bundle carries a portrait URL for most members, and the web build renders
 * it. This app deliberately does NOT: fetching it would be a network request,
 * and this app makes none — the whole client is offline by construction (see
 * index.ts). Initials are used instead. The photograph is one tap away on the
 * member's congress.gov page, which every member screen links to.
 *
 * The `src` prop is accepted so callers read the same as the web build's, and is
 * intentionally ignored.
 */
export function MemberAvatar({
  name,
  size = 44,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  const t = useTheme();
  const initials = name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.ink6,
        backgroundColor: t.ink7,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Text style={{ fontSize: size * 0.28, fontWeight: '600', color: t.ink4 }}>{initials}</Text>
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.ink4}
      accessibilityLabel={accessibilityLabel}
      autoCorrect={false}
      autoCapitalize="none"
      style={{
        height: 40,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.ink6,
        borderRadius: t.radius,
        backgroundColor: t.paperRaised,
        paddingHorizontal: 12,
        fontSize: 14,
        color: t.ink1,
      }}
    />
  );
}

/** A single-choice segmented control. Neutral in every state. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.ink6,
        borderRadius: t.radius,
        overflow: 'hidden',
      }}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              backgroundColor: active ? t.accentSoft : t.paperRaised,
              borderLeftWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderLeftColor: t.ink6,
            }}
          >
            <Text style={{ fontSize: 12.5, color: active ? t.accent : t.ink3 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontally scrolling chip row, used for sector and state filters. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingRight: 16 }}
    >
      {children}
    </ScrollView>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[MONO, { fontSize: 12, color: t.ink4 }]}>{children}</Text>;
}

export function Loading({ what = 'data' }: { what?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 40 }}>
      <ActivityIndicator color={t.accent} />
      <Text style={{ fontSize: 13, color: t.ink4 }}>Loading {what}…</Text>
    </View>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text style={{ paddingVertical: 32, textAlign: 'center', fontSize: 13, color: t.ink4 }}>
      {children}
    </Text>
  );
}

export function NotFoundBody({ what, hint }: { what: string; hint?: string }) {
  const t = useTheme();
  return (
    <Card>
      <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink0 }}>{what}</Text>
      <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 19, color: t.ink3 }}>
        {hint ??
          'This app reads a static data bundle that ships inside it. If a record is missing, ' +
            'regenerate the bundle from the repository root with `npm run export` and rebuild.'}
      </Text>
    </Card>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.ink6 }} />;
}

const s = StyleSheet.create({
  label: {
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});
