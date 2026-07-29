/**
 * Bills list, with sector filter and search.
 *
 * Mirrors apps/web/src/pages/Bills.tsx, including the "hr 1234" / "hr1234"
 * number-matching behaviour and the sector chip row with per-sector counts.
 */

import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { INDUSTRY_BY_ID, shortDate } from '@ftm/core';
import type { IndustryId } from '@ftm/core';
import { BILLS, memberById, type BillSummary } from '../../src/data';
import { ShortDisclaimer } from '../../src/components/Framing';
import {
  Chip,
  ChipRow,
  Divider,
  Empty,
  MethodTag,
  Mono,
  Screen,
  SearchField,
  SectionTitle,
  Segmented,
} from '../../src/components/ui';
import { MAX_CONTENT, useTheme } from '../../src/theme';

type SortKey = 'recent' | 'overlap' | 'cosponsors' | 'title';
type Chamber = 'all' | 'house' | 'senate';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'overlap', label: 'Overlap' },
  { value: 'cosponsors', label: 'Cosponsors' },
  { value: 'title', label: 'A–Z' },
];

const CHAMBERS: { value: Chamber; label: string }[] = [
  { value: 'all', label: 'Both chambers' },
  { value: 'house', label: 'House' },
  { value: 'senate', label: 'Senate' },
];

export default function Bills() {
  const t = useTheme();
  const params = useLocalSearchParams<{ industry?: string }>();

  const [q, setQ] = useState('');
  const [industry, setIndustry] = useState<IndustryId | 'all'>(
    (params.industry as IndustryId | undefined) ?? 'all',
  );
  const [chamber, setChamber] = useState<Chamber>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const industryCounts = useMemo(() => {
    const m = new Map<IndustryId, number>();
    for (const b of BILLS) for (const i of b.industries) m.set(i.industry, (m.get(i.industry) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // "hr 1234" and "hr1234" should both find H.R. 1234.
    const numberMatch = /^([a-z]{1,7})\s*\.?\s*(\d+)$/.exec(needle);

    const out = BILLS.filter((b) => {
      if (industry !== 'all' && !b.industries.some((i) => i.industry === industry)) return false;
      if (chamber === 'house' && !/^h/.test(b.billType)) return false;
      if (chamber === 'senate' && !/^s/.test(b.billType)) return false;
      if (!needle) return true;
      if (numberMatch && b.billType === numberMatch[1] && b.billNumber === numberMatch[2]) return true;
      return (
        b.title.toLowerCase().includes(needle) ||
        `${b.billType} ${b.billNumber}`.includes(needle) ||
        (b.policyArea ?? '').toLowerCase().includes(needle) ||
        b.subjects.some((s) => s.toLowerCase().includes(needle)) ||
        b.committeeNames.some((c) => c.toLowerCase().includes(needle))
      );
    });

    return out.sort((a, b) => {
      switch (sort) {
        case 'overlap':
          return (b.topOverlap?.score ?? -1) - (a.topOverlap?.score ?? -1);
        case 'cosponsors':
          return b.cosponsorCount - a.cosponsorCount;
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return String(b.latestActionDate ?? '').localeCompare(String(a.latestActionDate ?? ''));
      }
    });
  }, [q, industry, chamber, sort]);

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews={false}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={
          <Empty>No bills match those filters. Try clearing the sector filter or the search text.</Empty>
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 14, lineHeight: 21, color: t.ink3 }}>
              Legislation from the {BILLS[0]?.congress ?? ''}th Congress, tagged with the sectors it
              would plausibly affect. Tags are produced by this tool, not by Congress — open any bill
              to see how confident each tag is.
            </Text>
            <ShortDisclaimer style={{ marginTop: 8 }} />

            <View style={{ marginTop: 14, gap: 10 }}>
              <SearchField
                value={q}
                onChangeText={setQ}
                placeholder="Title, number (e.g. hr 1234), subject or committee…"
                accessibilityLabel="Filter bills"
              />
              <Segmented options={CHAMBERS} value={chamber} onChange={setChamber} />
              <Segmented options={SORTS} value={sort} onChange={setSort} />
              <ChipRow>
                <Chip active={industry === 'all'} onPress={() => setIndustry('all')} trailing={String(BILLS.length)}>
                  All sectors
                </Chip>
                {industryCounts.map(([id, n]) => (
                  <Chip
                    key={id}
                    active={industry === id}
                    onPress={() => setIndustry(industry === id ? 'all' : id)}
                    trailing={String(n)}
                  >
                    {INDUSTRY_BY_ID[id]?.label ?? id}
                  </Chip>
                ))}
              </ChipRow>
            </View>

            <View style={{ marginTop: 18 }}>
              <SectionTitle note={`${filtered.length.toLocaleString()} of ${BILLS.length.toLocaleString()}`}>
                Results
              </SectionTitle>
            </View>
          </View>
        }
        renderItem={({ item }) => <BillRow bill={item} />}
      />
    </Screen>
  );
}

function BillRow({ bill }: { bill: BillSummary }) {
  const t = useTheme();
  const sponsor = bill.sponsorBioguideId ? memberById().get(bill.sponsorBioguideId) : undefined;

  return (
    <Link href={`/bills/${bill.id}`}>
      <View style={{ paddingVertical: 12, width: '100%' }}>
        <Mono>
          {bill.billType.toUpperCase()} {bill.billNumber}
        </Mono>
        <Text style={{ marginTop: 2, fontSize: 14.5, lineHeight: 20, color: t.ink1 }}>{bill.title}</Text>

        <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {sponsor && (
            <Text style={{ fontSize: 12.5, color: t.ink4 }}>Sponsor {sponsor.name}</Text>
          )}
          <Text style={{ fontSize: 12.5, color: t.ink4 }}>{bill.cosponsorCount} cosponsors</Text>
          {bill.latestActionDate && (
            <Text style={{ fontSize: 12.5, color: t.ink4 }}>
              Last action {shortDate(bill.latestActionDate)}
            </Text>
          )}
          {bill.overlapCount > 0 && (
            <Text style={{ fontSize: 12.5, color: t.ink3 }}>
              {bill.overlapCount} member{bill.overlapCount === 1 ? '' : 's'} with overlapping donor
              sectors
            </Text>
          )}
        </View>

        {bill.industries.length > 0 && (
          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {bill.industries.slice(0, 4).map((i) => (
              <Chip key={i.industry} trailing={`${Math.round(i.confidence * 100)}%`}>
                {INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}
              </Chip>
            ))}
            <MethodTag method={bill.classificationMethod} />
          </View>
        )}
      </View>
    </Link>
  );
}
