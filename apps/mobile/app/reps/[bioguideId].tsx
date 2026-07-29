/**
 * One member of Congress.
 *
 * Mirrors apps/web/src/pages/RepDetail.tsx, and is ordered by how much the
 * reader can trust each block:
 *   1. Who they are — straight from the Congress.gov record.
 *   2. What was disclosed to the FEC — a filing, not an inference.
 *   3. What this tool computed on top of that — the overlap scores, fenced by
 *      the disclaimer and never rendered as a bare number.
 *   4. Federal spending in their state — context only, and labelled as such.
 *
 * The coverage gaps are shown in line rather than in a footnote, because a
 * percentage that silently excludes money is a misleading percentage. That
 * includes the gap introduced by this app specifically: the full donor
 * breakdown lives in the per-member detail file the exporter writes only for
 * the web build, so what is shown here is a reconstruction from the bundled
 * top-level files. See src/data.ts.
 */

import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { INDUSTRY_BY_ID, shortDate, usd } from '@ftm/core';
import { INDEX, fecUrl, getMemberDetail, seatLine } from '../../src/data';
import { CoverageNote, InlineDisclaimer, OverlapScore, ScoreExplainer } from '../../src/components/Framing';
import {
  Card,
  Chip,
  Empty,
  IndustryBars,
  Label,
  MemberAvatar,
  Mono,
  NotFoundBody,
  PartyTag,
  Screen,
  SectionTitle,
  SourceLink,
  Stat,
} from '../../src/components/ui';
import { MAX_CONTENT, SERIF, TNUM, useTheme } from '../../src/theme';

export default function RepDetail() {
  const t = useTheme();
  const { bioguideId } = useLocalSearchParams<{ bioguideId: string }>();
  const data = getMemberDetail(String(bioguideId ?? ''));

  /**
   * Committee rows arrive one per subcommittee code, so the same full committee
   * appears several times. Collapse by name and keep any stated role.
   */
  const committees = useMemo(() => {
    const byName = new Map<string, { name: string; role?: string }>();
    for (const c of data?.member.committees ?? []) {
      const existing = byName.get(c.committeeName);
      if (!existing) byName.set(c.committeeName, { name: c.committeeName, role: c.role });
      else if (!existing.role && c.role) existing.role = c.role;
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (!data) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <NotFoundBody what="No such member in this bundle" />
        </ScrollView>
      </Screen>
    );
  }

  const { member, donorProfile, overlaps, stateAwards } = data;
  const fec = fecUrl(member, INDEX.cycle);
  const awardTotal = stateAwards.reduce((s, a) => s + a.amount, 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' }}
      >
        {/* ---- header ---------------------------------------------------- */}
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <MemberAvatar src={member.imageUrl} name={member.name} size={72} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Text style={[SERIF, { fontSize: 22, lineHeight: 28, color: t.ink0 }]}>{member.name}</Text>
              <PartyTag party={member.party} />
            </View>
            <Text style={{ marginTop: 3, fontSize: 13.5, color: t.ink3 }}>
              {seatLine(member)}
              {member.party ? ` · ${member.party}` : ''}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 12, gap: 8 }}>
          <SourceLink href={member.sourceUrl}>Their congress.gov page</SourceLink>
          {member.officialUrl && <SourceLink href={member.officialUrl}>Official website</SourceLink>}
          {fec && <SourceLink href={fec}>FEC filings</SourceLink>}
        </View>

        {committees.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Label>Committee memberships</Label>
            <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {committees.map((c) => (
                <Chip key={c.name} trailing={c.role}>
                  {c.name}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {/* ---- disclosed money -------------------------------------------- */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle note={`FEC cycle ${INDEX.cycle}`}>Who disclosed money to this member</SectionTitle>

          {!donorProfile || donorProfile.totalItemized <= 0 ? (
            <Empty>
              No itemized campaign-finance record is linked to {member.name} in this data bundle.
              That is a gap in the bundle, not a statement that no money was raised.
            </Empty>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
                <Stat
                  label="Total disclosed"
                  value={usd(donorProfile.totalItemized, { compact: true })}
                  sub={`Itemized hard money, cycle ${donorProfile.cycle}`}
                />
                <Stat
                  label="Placed in a sector"
                  value={`${((1 - donorProfile.unclassifiedShare) * 100).toFixed(1)}%`}
                  sub="of the disclosed total"
                />
                <Stat
                  label="Not placed"
                  value={`${(donorProfile.unclassifiedShare * 100).toFixed(1)}%`}
                  sub="excluded from every score below"
                />
              </View>

              <View style={{ marginTop: 20 }}>
                <Label>By sector</Label>
                <View style={{ marginTop: 8 }}>
                  <IndustryBars rows={donorProfile.byIndustry} />
                </View>
                <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 17, color: t.ink4 }}>
                  Shares are of the full disclosed total, so they add up to less than 100% by exactly
                  the amount that could not be placed.
                </Text>
              </View>

              <View style={{ marginTop: 14, gap: 8 }}>
                <CoverageNote>
                  {`${(donorProfile.unclassifiedShare * 100).toFixed(1)}% of this member's disclosed money is not attributed to any sector. `}
                  {'Part of it is money with no employer to classify — the filing lists the donor as ' +
                    'RETIRED, SELF-EMPLOYED, NOT EMPLOYED or HOMEMAKER, which is a property of the ' +
                    'filing rather than a failure of this tool. The rest has an employer on file that ' +
                    'neither the keyword map nor the classifier could place, which is a genuine ' +
                    'coverage gap and the reason the sector percentages should be read as a floor.'}
                </CoverageNote>
                <CoverageNote>
                  {'The sector list above is reconstructed from the data bundled in this app: the ' +
                    'exporter’s top-three summary for this member' +
                    (donorProfile.reconstructed
                      ? ', plus every sector that appears in their overlap rows. '
                      : '. ') +
                    'The complete per-member breakdown is written only to the web build’s ' +
                    'member/<id>.json. Sectors that fall outside both lists are not shown here.'}
                </CoverageNote>
              </View>
            </>
          )}
        </View>

        {/* ---- overlaps ---------------------------------------------------- */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle note={`${overlaps.length} bill${overlaps.length === 1 ? '' : 's'}`}>
            Bills they touched, next to the sectors that funded them
          </SectionTitle>
          <InlineDisclaimer style={{ marginBottom: 14 }} />

          {overlaps.length === 0 ? (
            <Empty>
              No bill in this bundle both involves {member.name} and has a sector tag that overlaps
              their disclosed donor sectors.
            </Empty>
          ) : (
            <>
              <View style={{ gap: 10 }}>
                {overlaps.slice(0, 25).map((o) => (
                  <Card key={o.billId}>
                    {o.bill ? (
                      <Link href={`/bills/${o.bill.id}`}>
                        <View>
                          <Mono>
                            {o.bill.billType.toUpperCase()} {o.bill.billNumber}
                          </Mono>
                          <Text style={{ marginTop: 2, fontSize: 14, lineHeight: 19, color: t.ink1 }}>
                            {o.bill.title}
                          </Text>
                        </View>
                      </Link>
                    ) : (
                      <Mono>{o.billId}</Mono>
                    )}
                    <View style={{ marginTop: 12 }}>
                      <OverlapScore score={o.score} size="sm" showExplainer={false} />
                    </View>
                    {o.matches[0] && (
                      <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 18, color: t.ink4 }}>
                        Largest shared sector:{' '}
                        {INDUSTRY_BY_ID[o.matches[0].industry]?.label ?? o.matches[0].industry} ·{' '}
                        {usd(o.matches[0].donorAmount, { compact: true })} disclosed ·{' '}
                        {Math.round(o.matches[0].billConfidence * 100)}% bill relevance
                      </Text>
                    )}
                  </Card>
                ))}
              </View>
              {/* The explainer appears once for the whole list, never omitted. */}
              <ScoreExplainer />
              {overlaps.length > 25 && (
                <Text style={{ marginTop: 12, fontSize: 12.5, color: t.ink4 }}>
                  Showing the 25 largest of {overlaps.length}. The bundled overlaps file is capped by
                  the exporter at the top 2,000 rows overall, so low-scoring pairs may be missing
                  entirely.
                </Text>
              )}
            </>
          )}
        </View>

        {/* ---- federal spending, as context ------------------------------- */}
        <View style={{ marginTop: 28 }}>
          <SectionTitle note={`${stateAwards.length} shown`}>
            Federal awards in {member.state}
          </SectionTitle>
          <Text style={{ fontSize: 13, lineHeight: 19, color: t.ink3 }}>
            Context only. These are federal contracts and grants that landed in this member’s state.
            They are not attributed to the member, are not a result of anything they did, and are not
            an input to any score on this screen.
          </Text>
          {stateAwards.length === 0 ? (
            <Empty>No federal awards for this state are in the bundle.</Empty>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              <Text style={[TNUM, { fontSize: 13, color: t.ink2 }]}>
                {usd(awardTotal, { compact: true })} across the {stateAwards.length} largest awards
                shown.
              </Text>
              {stateAwards.slice(0, 8).map((a) => (
                <View key={a.id}>
                  <Text style={{ fontSize: 13, color: t.ink1 }}>{a.recipientName}</Text>
                  <Text style={[TNUM, { fontSize: 12.5, color: t.ink4 }]}>
                    {usd(a.amount, { compact: true })} · {a.awardingAgency ?? 'federal agency'} ·{' '}
                    {shortDate(a.actionDate)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
