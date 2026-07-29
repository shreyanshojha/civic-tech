/**
 * One bill.
 *
 * Mirrors apps/web/src/pages/BillDetail.tsx, ordered by how much the reader can
 * trust each block: the Congress.gov record first, then the sector tags this
 * tool produced, then the overlap scores — which are fenced by the medium
 * disclaimer and rendered only through <OverlapScore/>.
 *
 * The exporter writes the LLM/keyword `plainSummary` and the per-sector
 * `rationale` only into apps/web/public/data/bill/<id>.json, which is not part
 * of the mobile bundle. Rather than silently dropping that, the screen says so
 * in a coverage note and links out to the authoritative text on Congress.gov.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { INDUSTRY_BY_ID, describeOverlap, shortDate, usd } from '@ftm/core';
import { getBillDetail, seatLine } from '../../src/data';
import {
  CoverageNote,
  InlineDisclaimer,
  OverlapScore,
} from '../../src/components/Framing';
import {
  Card,
  Chip,
  Empty,
  Label,
  MemberAvatar,
  MethodTag,
  Mono,
  NotFoundBody,
  Screen,
  SectionTitle,
  SourceLink,
} from '../../src/components/ui';
import { MAX_CONTENT, MONO, SERIF, TNUM, useTheme } from '../../src/theme';

export default function BillDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = getBillDetail(String(id ?? ''));
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!data) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <NotFoundBody what="No such bill in this bundle" />
        </ScrollView>
      </Screen>
    );
  }

  const { bill, sponsor, overlaps } = data;
  const label = `${bill.billType.toUpperCase()} ${bill.billNumber}`;
  const isKeywordOnly = bill.classificationMethod === 'keyword-fallback';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' }}
      >
        {/* ---- header ---------------------------------------------------- */}
        <Text style={[SERIF, { fontSize: 21, lineHeight: 28, color: t.ink0 }]}>{bill.title}</Text>
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Mono>
            {label} · {bill.congress}th Congress
          </Mono>
          {bill.introducedDate && (
            <Text style={{ fontSize: 12.5, color: t.ink4 }}>
              Introduced {shortDate(bill.introducedDate)}
            </Text>
          )}
          {bill.latestActionDate && (
            <Text style={{ fontSize: 12.5, color: t.ink4 }}>
              Last action {shortDate(bill.latestActionDate)}
            </Text>
          )}
          {bill.policyArea && <Text style={{ fontSize: 12.5, color: t.ink4 }}>· {bill.policyArea}</Text>}
        </View>
        <View style={{ marginTop: 8 }}>
          <SourceLink href={bill.congressDotGovUrl}>Read it on Congress.gov</SourceLink>
        </View>
        {bill.latestActionText && (
          <Text style={{ marginTop: 10, fontSize: 13, lineHeight: 19, color: t.ink3 }}>
            {bill.latestActionText}
          </Text>
        )}

        {/* ---- sector tags ------------------------------------------------ */}
        <View style={{ marginTop: 26 }}>
          <SectionTitle note={<MethodTag method={bill.classificationMethod} />}>
            Sectors this bill would affect
          </SectionTitle>

          {bill.industries.length === 0 ? (
            <CoverageNote>
              No sector was identified for this bill. For ceremonial resolutions, naming bills and
              internal procedural measures this is the correct answer, and no overlap is computed.
            </CoverageNote>
          ) : (
            <View style={{ gap: 8 }}>
              {bill.industries.map((i) => (
                <Card key={i.industry}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink0 }}>
                      {INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}
                    </Text>
                    <Text style={[TNUM, { fontSize: 12.5, color: t.ink4 }]}>
                      classifier confidence {Math.round(i.confidence * 100)}%
                    </Text>
                  </View>
                  <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: t.ink3 }}>
                    {INDUSTRY_BY_ID[i.industry]?.blurb ?? ''}
                  </Text>
                </Card>
              ))}
            </View>
          )}

          <View style={{ marginTop: 10, gap: 8 }}>
            <CoverageNote>
              The plain-English summary and the per-sector rationale for this bill live in the
              per-bill detail file, which the exporter writes only for the web build. This screen
              shows the sector tags and their confidences; the authoritative text of the bill is on
              Congress.gov, linked above.
            </CoverageNote>
            {isKeywordOnly && (
              <CoverageNote>
                These tags came from Library of Congress metadata and keyword matching, not from a
                language model reading the bill. They are rougher than the LLM path. Set LLM_PROVIDER
                in .env and re-run `npm run classify` at the repository root to improve them.
              </CoverageNote>
            )}
          </View>
        </View>

        {/* ---- the overlap ------------------------------------------------ */}
        <View style={{ marginTop: 26 }}>
          <SectionTitle note={`${overlaps.length} member${overlaps.length === 1 ? '' : 's'}`}>
            Members involved, and who funded them
          </SectionTitle>
          <InlineDisclaimer style={{ marginBottom: 14 }} />

          {overlaps.length === 0 ? (
            <Empty>
              No member on this bill has campaign-finance data linked in the current bundle.
            </Empty>
          ) : (
            <View style={{ gap: 10 }}>
              {overlaps.map((o) => {
                const isOpen = expanded === o.bioguideId;
                const name = o.member?.name ?? o.bioguideId;
                return (
                  <Card key={o.bioguideId}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <MemberAvatar src={o.member?.imageUrl} name={name} size={46} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                          <Link href={`/reps/${o.bioguideId}`}>
                            <Text style={{ fontSize: 15, fontWeight: '500', color: t.ink0 }}>{name}</Text>
                          </Link>
                          <Chip>{o.role}</Chip>
                        </View>
                        {o.member && (
                          <Text style={{ fontSize: 12.5, color: t.ink4 }}>{seatLine(o.member)}</Text>
                        )}
                        {o.member?.donorSummary && (
                          <Text style={{ fontSize: 12.5, color: t.ink4 }}>
                            {usd(o.member.donorSummary.totalItemized, { compact: true })} disclosed,
                            cycle {o.cycle}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={{ marginTop: 12 }}>
                      <OverlapScore score={o.score} size="md" showExplainer={false} />
                    </View>

                    <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 20, color: t.ink2 }}>
                      {describeOverlap(o, name, label)}
                    </Text>

                    <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <Pressable
                        onPress={() => setExpanded(isOpen ? null : o.bioguideId)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isOpen }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: t.radius,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: t.ink6,
                        }}
                      >
                        <Text style={{ fontSize: 12.5, color: t.ink2 }}>
                          {isOpen ? 'Hide the breakdown' : 'Show how this number was built'}
                        </Text>
                      </Pressable>
                      {o.member?.fecCandidateIds[0] && (
                        <SourceLink
                          href={`https://www.fec.gov/data/candidate/${o.member.fecCandidateIds[0]}/?cycle=${o.cycle}`}
                        >
                          FEC filings
                        </SourceLink>
                      )}
                    </View>

                    {isOpen && (
                      <View style={{ marginTop: 14, gap: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.ink6, paddingTop: 14 }}>
                        <View>
                          <Label>Shared sectors, and what each contributed to the score</Label>
                          <View style={{ marginTop: 8, gap: 10 }}>
                            {o.matches.map((m) => (
                              <View key={m.industry}>
                                <Text style={{ fontSize: 13, color: t.ink1 }}>
                                  {INDUSTRY_BY_ID[m.industry]?.label ?? m.industry}
                                </Text>
                                <Text style={[TNUM, { marginTop: 2, fontSize: 12.5, lineHeight: 18, color: t.ink3 }]}>
                                  {usd(m.donorAmount, { compact: true })} disclosed to member ·{' '}
                                  {(m.donorShare * 100).toFixed(1)}% of their money ·{' '}
                                  {Math.round(m.billConfidence * 100)}% bill relevance ·{' '}
                                  {(m.contribution * 100).toFixed(1)} pts of the score
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        <View>
                          <Label>Exact formula</Label>
                          <Text style={[MONO, { marginTop: 4, fontSize: 11.5, lineHeight: 17, color: t.ink3 }]}>
                            {o.method.formula}
                          </Text>
                          <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 17, color: t.ink4 }}>
                            {(o.method.unclassifiedDonorShare * 100).toFixed(1)}% of this member’s
                            disclosed money could not be attributed to any sector and is excluded
                            from the score above.
                          </Text>
                        </View>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* ---- context ---------------------------------------------------- */}
        <View style={{ marginTop: 26 }}>
          <SectionTitle>Committees of jurisdiction</SectionTitle>
          {bill.committeeNames.length === 0 ? (
            <Text style={{ fontSize: 13, color: t.ink4 }}>None recorded in this bundle.</Text>
          ) : (
            <View style={{ gap: 4 }}>
              {bill.committeeNames.map((c) => (
                <Text key={c} style={{ fontSize: 13, color: t.ink2 }}>
                  {c}
                </Text>
              ))}
            </View>
          )}
        </View>

        {bill.subjects.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <SectionTitle>Library of Congress subject terms</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {bill.subjects.slice(0, 18).map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </View>
            <Text style={{ marginTop: 8, fontSize: 11.5, lineHeight: 17, color: t.ink4 }}>
              Assigned by Library of Congress staff, not by this tool. They are a major input to the
              sector tags above.
            </Text>
          </View>
        )}

        <View style={{ marginTop: 26 }}>
          <SectionTitle>Provenance</SectionTitle>
          <View style={{ gap: 8 }}>
            <SourceLink href={bill.congressDotGovUrl}>congress.gov record</SourceLink>
            {sponsor && (
              <Link href={`/reps/${sponsor.bioguideId}`}>
                <Text style={{ fontSize: 12.5, color: t.ink3 }}>Sponsor: {sponsor.name} ↗</Text>
              </Link>
            )}
            <Text style={{ fontSize: 12.5, color: t.ink4 }}>{bill.cosponsorCount} cosponsors</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
