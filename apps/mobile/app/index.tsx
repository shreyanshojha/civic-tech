/**
 * Home / overview.
 *
 * Mirrors apps/web/src/pages/Home.tsx: the hero claim, a global search over the
 * bundled index, the headline counts, the "what this shows / what it does not
 * show" pair, the largest overlaps in the dataset, the coverage notes, and the
 * long disclaimer at the foot.
 *
 * The search is entirely local — search.json is already inside the app, so no
 * query leaves the device. That is stated on screen, next to the field.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { INDUSTRY_BY_ID, PROJECT_TAGLINE, shortDate, usd } from '@ftm/core';
import {
  BILLS,
  INDEX,
  OVERLAPS,
  billById,
  memberById,
  searchAll,
  searchHref,
  seatLine,
} from '../src/data';
import { CoverageNote, LongDisclaimer, OverlapScore, ShortDisclaimer } from '../src/components/Framing';
import {
  Card,
  Chip,
  Divider,
  Empty,
  MemberAvatar,
  Mono,
  Screen,
  SearchField,
  SectionTitle,
  Stat,
} from '../src/components/ui';
import { MAX_CONTENT, SERIF, useTheme } from '../src/theme';

const SHOWS = [
  'Which sectors gave disclosed money to a member of Congress, and how much.',
  'Which sectors a bill would plausibly affect, and how confident that tagging is.',
  'Where those two lists overlap — expressed as a share of disclosed money.',
  'A link to the primary government filing behind every single number.',
];

const DOES_NOT_SHOW = [
  'Any claim that a contribution caused a vote, a bill, or an outcome.',
  'Undisclosed money, dark money, or 501(c)(4) spending — all invisible here.',
  'A judgement about any member, party, sector, or bill.',
  'A substitute for reading the bill, or for actual investigative journalism.',
];

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');

  const results = useMemo(() => searchAll(q, 20), [q]);

  const topOverlaps = useMemo(
    () =>
      OVERLAPS.filter((o) => billById().has(o.billId) && memberById().has(o.bioguideId)).slice(0, 6),
    [],
  );

  const recentBills = useMemo(() => BILLS.filter((b) => b.industries.length > 0).slice(0, 6), []);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- hero ----------------------------------------------------- */}
        <Text style={[SERIF, { fontSize: 26, lineHeight: 33, color: t.ink0 }]}>
          Public money records and public legislative records, side by side.
        </Text>
        <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 23, color: t.ink2 }}>
          Every figure here comes from a government filing you can open yourself. This app does one
          thing: it puts the money next to the legislation and shows you where they touch.{' '}
          <Text style={{ fontWeight: '600' }}>
            It does not tell you why anyone voted the way they did, because it cannot know.
          </Text>
        </Text>
        <ShortDisclaimer style={{ marginTop: 10 }} />

        {/* ---- global search -------------------------------------------- */}
        <View style={{ marginTop: 18 }}>
          <SearchField
            value={q}
            onChangeText={setQ}
            placeholder="Search a surname, a bill number, a sector…"
            accessibilityLabel="Search members, bills and sectors"
          />
          <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 17, color: t.ink4 }}>
            Everything is searched on this device from data bundled inside the app. No query — and no
            byte of anything you type — leaves the phone.
          </Text>

          {q.trim().length >= 2 && (
            <Card style={{ marginTop: 10, padding: 0 }}>
              {results.length === 0 ? (
                <Empty>Nothing matches “{q.trim()}”.</Empty>
              ) : (
                results.map((r, i) => {
                  const href = searchHref(r);
                  return (
                    <View key={`${r.t}:${r.id}:${i}`}>
                      {i > 0 && <Divider />}
                      <Pressable
                        disabled={!href}
                        onPress={() => href && router.push(href as never)}
                        style={{ paddingHorizontal: 14, paddingVertical: 10 }}
                        accessibilityRole={href ? 'link' : 'text'}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Chip>{r.t}</Chip>
                          <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: t.ink1 }}>
                            {r.label}
                          </Text>
                        </View>
                        <Text numberOfLines={2} style={{ marginTop: 3, fontSize: 12.5, color: t.ink4 }}>
                          {r.sub}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </Card>
          )}
        </View>

        {/* ---- counts ---------------------------------------------------- */}
        <View style={{ marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
          <Stat
            label="Members tracked"
            value={(INDEX.counts.legislators ?? 0).toLocaleString()}
            sub="Current House and Senate"
          />
          <Stat
            label="Bills"
            value={(INDEX.counts.bills ?? 0).toLocaleString()}
            sub={`${INDEX.congress}th Congress`}
          />
          <Stat
            label="Disclosed contributions"
            value={usd(INDEX.counts.contributionDollars ?? 0, { compact: true })}
            sub={`FEC cycle ${INDEX.cycle} · itemized hard money only`}
          />
          <Stat
            label="Federal awards"
            value={(INDEX.counts.awards ?? 0).toLocaleString()}
            sub="Contracts and grants, as context"
          />
        </View>

        {/* ---- browse ---------------------------------------------------- */}
        <View style={{ marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <NavButton href="/bills" label="Browse bills" />
          <NavButton href="/reps" label="Browse representatives" />
          <NavButton href="/about" label="About & limitations" />
        </View>

        {/* ---- what this is / is not ------------------------------------- */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle>What this shows</SectionTitle>
          <Bullets items={SHOWS} />
        </View>
        <View style={{ marginTop: 22 }}>
          <SectionTitle>What it does not show</SectionTitle>
          <Bullets items={DOES_NOT_SHOW} />
        </View>

        {/* ---- largest overlaps ------------------------------------------ */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle note={<Link href="/bills" style={{ color: t.accent, fontSize: 12 }}>All bills →</Link>}>
            Largest overlaps in this dataset
          </SectionTitle>
          <Text style={{ marginBottom: 14, fontSize: 13.5, lineHeight: 20, color: t.ink3 }}>
            These are the member–bill pairs where the sectors that funded a member overlap most with
            the sectors a bill would affect. A high number here is common and often entirely ordinary
            — members seek committees relevant to their districts, and the industries in a district
            fund its representative. Read these as questions, not findings.
          </Text>

          {topOverlaps.length === 0 ? (
            <CoverageNote>
              No overlaps are present in this bundle. That happens when bills have been ingested but
              campaign-finance data has not. Run `npm run pipeline` from the repository root and
              rebuild the app.
            </CoverageNote>
          ) : (
            <View style={{ gap: 10 }}>
              {topOverlaps.map((o) => {
                const member = memberById().get(o.bioguideId)!;
                const bill = billById().get(o.billId)!;
                return (
                  <Card key={`${o.billId}:${o.bioguideId}`}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <MemberAvatar src={member.imageUrl} name={member.name} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/reps/${member.bioguideId}`} style={{ color: t.ink0 }}>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink0 }}>
                            {member.name}
                          </Text>
                        </Link>
                        <Text style={{ fontSize: 12.5, color: t.ink4 }}>{seatLine(member)}</Text>
                        <Link href={`/bills/${bill.id}`}>
                          <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 18, color: t.ink2 }}>
                            <Text style={{ color: t.ink4 }}>
                              {bill.billType.toUpperCase()} {bill.billNumber}{' '}
                            </Text>
                            {bill.title.length > 90 ? `${bill.title.slice(0, 90)}…` : bill.title}
                          </Text>
                        </Link>
                      </View>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      {/* Band label always rendered; explainer lives on the detail screen. */}
                      <OverlapScore score={o.score} size="sm" showExplainer={false} />
                    </View>
                    {o.matches[0] && (
                      <Text style={{ marginTop: 8, fontSize: 12.5, color: t.ink4 }}>
                        Largest shared sector:{' '}
                        {INDUSTRY_BY_ID[o.matches[0].industry]?.label ?? o.matches[0].industry} ·{' '}
                        {usd(o.matches[0].donorAmount, { compact: true })} disclosed
                      </Text>
                    )}
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* ---- recent bills ---------------------------------------------- */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle note={<Link href="/bills" style={{ color: t.accent, fontSize: 12 }}>Browse and filter →</Link>}>
            Recently active legislation
          </SectionTitle>
          <View>
            {recentBills.map((b, i) => (
              <View key={b.id}>
                {i > 0 && <Divider />}
                <Link href={`/bills/${b.id}`}>
                  <View style={{ paddingVertical: 10 }}>
                    <Mono>
                      {b.billType.toUpperCase()} {b.billNumber}
                    </Mono>
                    <Text style={{ marginTop: 2, fontSize: 14, lineHeight: 19, color: t.ink1 }}>
                      {b.title}
                    </Text>
                    <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {b.industries.slice(0, 3).map((ind) => (
                        <Chip key={ind.industry} trailing={`${Math.round(ind.confidence * 100)}%`}>
                          {INDUSTRY_BY_ID[ind.industry]?.label ?? ind.industry}
                        </Chip>
                      ))}
                    </View>
                  </View>
                </Link>
              </View>
            ))}
          </View>
        </View>

        {/* ---- coverage --------------------------------------------------- */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle note={<Link href="/about" style={{ color: t.accent, fontSize: 12 }}>Full limitations →</Link>}>
            What is and is not in this dataset
          </SectionTitle>
          <View style={{ gap: 8 }}>
            {INDEX.coverageNotes.map((n, i) => (
              <CoverageNote key={i}>{n}</CoverageNote>
            ))}
          </View>
          <Text style={{ marginTop: 10, fontSize: 12.5, lineHeight: 18, color: t.ink4 }}>
            Bundle generated {shortDate(INDEX.generatedAt)} · sources: FEC{' '}
            {INDEX.sources.openfec}, Congress {INDEX.sources.congress}, classification{' '}
            {INDEX.sources.classification}. Nothing is fetched at runtime — this is the data that
            shipped inside the app.
          </Text>
        </View>

        {/* ---- the long version -------------------------------------------- */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle>Read this before you draw a conclusion</SectionTitle>
          <LongDisclaimer />
          <Text style={{ marginTop: 16, fontSize: 13, color: t.ink4 }}>{PROJECT_TAGLINE}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Bullets({ items }: { items: string[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {items.map((x) => (
        <Text key={x} style={{ fontSize: 14, lineHeight: 21, color: t.ink2 }}>
          · {x}
        </Text>
      ))}
    </View>
  );
}

function NavButton({ href, label }: { href: string; label: string }) {
  const t = useTheme();
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="link"
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: t.radius,
          borderWidth: 1,
          borderColor: t.accentLine,
          backgroundColor: t.accentSoft,
        }}
      >
        <Text style={{ fontSize: 13.5, color: t.accent, fontWeight: '500' }}>{label}</Text>
      </Pressable>
    </Link>
  );
}
