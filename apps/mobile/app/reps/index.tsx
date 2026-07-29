/**
 * Representatives list, with search and chamber/state filters.
 *
 * Mirrors apps/web/src/pages/Reps.tsx, minus the optional address lookup — that
 * is the one feature of the web build that makes an outbound request, and this
 * app makes none at all. Name / state / chamber search is entirely local
 * because legislators.json is already inside the app.
 */

import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { INDUSTRY_BY_ID, usd } from '@ftm/core';
import { INDEX, LEGISLATORS, STATES, fecUrl, seatLine, type MemberSummary } from '../../src/data';
import { ShortDisclaimer } from '../../src/components/Framing';
import {
  Chip,
  ChipRow,
  Divider,
  Empty,
  MemberAvatar,
  PartyTag,
  Screen,
  SearchField,
  SectionTitle,
  Segmented,
  SourceLink,
} from '../../src/components/ui';
import { MAX_CONTENT, TNUM, useTheme } from '../../src/theme';

type Chamber = 'all' | 'House' | 'Senate';
type SortKey = 'name' | 'money' | 'state';

const CHAMBERS: { value: Chamber; label: string }[] = [
  { value: 'all', label: 'Both chambers' },
  { value: 'House', label: 'House' },
  { value: 'Senate', label: 'Senate' },
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'money', label: 'Disclosed' },
  { value: 'state', label: 'State' },
];

export default function Reps() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [chamber, setChamber] = useState<Chamber>('all');
  const [state, setState] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = LEGISLATORS.filter((m) => {
      if (chamber !== 'all' && m.chamber !== chamber) return false;
      if (state !== 'all' && m.state !== state) return false;
      if (!needle) return true;
      return (
        m.name.toLowerCase().includes(needle) ||
        (m.lastName ?? '').toLowerCase().includes(needle) ||
        m.state.toLowerCase() === needle ||
        m.committees.some((c) => c.committeeName.toLowerCase().includes(needle))
      );
    });

    return out.sort((a, b) => {
      switch (sort) {
        case 'money':
          return (b.donorSummary?.totalItemized ?? -1) - (a.donorSummary?.totalItemized ?? -1);
        case 'state':
          return a.state.localeCompare(b.state) || a.name.localeCompare(b.name);
        default:
          return (a.lastName ?? a.name).localeCompare(b.lastName ?? b.name);
      }
    });
  }, [q, chamber, state, sort]);

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.bioguideId}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews={false}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={<Empty>No member matches those filters.</Empty>}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 14, lineHeight: 21, color: t.ink3 }}>
              Every current member in the bundle, with the sectors that disclosed the most money to
              them in FEC cycle {INDEX.cycle}. Party is shown as a plain letter and is never used to
              sort, rank or colour anything here.
            </Text>
            <ShortDisclaimer style={{ marginTop: 8 }} />

            <View style={{ marginTop: 14, gap: 10 }}>
              <SearchField
                value={q}
                onChangeText={setQ}
                placeholder="Name, state code (e.g. TX), or committee…"
                accessibilityLabel="Filter representatives"
              />
              <Segmented options={CHAMBERS} value={chamber} onChange={setChamber} />
              <Segmented options={SORTS} value={sort} onChange={setSort} />
              <ChipRow>
                <Chip active={state === 'all'} onPress={() => setState('all')}>
                  All states
                </Chip>
                {STATES().map((st) => (
                  <Chip key={st} active={state === st} onPress={() => setState(state === st ? 'all' : st)}>
                    {st}
                  </Chip>
                ))}
              </ChipRow>
            </View>

            <View style={{ marginTop: 18 }}>
              <SectionTitle note={`${filtered.length} of ${LEGISLATORS.length}`}>Results</SectionTitle>
            </View>
          </View>
        }
        renderItem={({ item }) => <MemberRow m={item} />}
      />
    </Screen>
  );
}

/** One member, as a row. Party is a letter, never a colour. */
function MemberRow({ m }: { m: MemberSummary }) {
  const t = useTheme();
  const fec = fecUrl(m, INDEX.cycle);

  return (
    <View style={{ paddingVertical: 12, flexDirection: 'row', gap: 12 }}>
      <MemberAvatar src={m.imageUrl} name={m.name} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Link href={`/reps/${m.bioguideId}`}>
            <Text style={{ fontSize: 15, fontWeight: '500', color: t.ink0 }}>{m.name}</Text>
          </Link>
          <PartyTag party={m.party} />
        </View>

        <Text style={{ marginTop: 2, fontSize: 12.5, color: t.ink4 }}>
          {seatLine(m)}
          {m.committees.length > 0
            ? ` · ${m.committees.length} committee assignment${m.committees.length === 1 ? '' : 's'}`
            : ''}
        </Text>

        {m.donorSummary ? (
          <>
            <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
              <Text style={[TNUM, { fontSize: 13, fontWeight: '500', color: t.ink1 }]}>
                {usd(m.donorSummary.totalItemized, { compact: true })}
              </Text>
              <Text style={{ fontSize: 12.5, color: t.ink4 }}>disclosed, cycle {INDEX.cycle}</Text>
              {fec && <SourceLink href={fec}>FEC filings</SourceLink>}
            </View>

            {m.donorSummary.top.length > 0 && (
              <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {m.donorSummary.top.map((x) => (
                  <Chip key={x.industry} trailing={usd(x.amount, { compact: true })}>
                    {INDUSTRY_BY_ID[x.industry]?.label ?? x.industry}
                  </Chip>
                ))}
                {m.donorSummary.unclassifiedShare > 0 && (
                  <Text style={{ fontSize: 11.5, color: t.ink4 }}>
                    {(m.donorSummary.unclassifiedShare * 100).toFixed(0)}% of their money is not
                    attributed to any sector
                  </Text>
                )}
              </View>
            )}
          </>
        ) : (
          <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 18, color: t.ink4 }}>
            No campaign-finance record is linked to this member in the current bundle.
          </Text>
        )}
      </View>
    </View>
  );
}
