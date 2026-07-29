/**
 * About & limitations.
 *
 * The long-form framing, the score explainer in full, the exact overlap
 * formula, the coverage notes for THIS bundle, and the privacy statement.
 *
 * Every sentence of framing on this screen is imported from @ftm/core. The only
 * prose written here is the description of what this particular client does and
 * does not do at runtime, which is a fact about the app rather than about the
 * data.
 */

import { ScrollView, Text, View } from 'react-native';
import {
  DISCLAIMER_MEDIUM,
  shortDate,
  NO_ACCUSATION,
  OVERLAP_BAND_LABEL,
  OVERLAP_BAND_NOTE,
  PROJECT_NAME,
  PROJECT_REPO_URL,
  PROJECT_TAGLINE,
  SCORE_EXPLAINER,
} from '@ftm/core';
import { INDEX } from '../src/data';
import { CoverageNote, LongDisclaimer } from '../src/components/Framing';
import { Card, Label, Screen, SectionTitle, SourceLink } from '../src/components/ui';
import { MAX_CONTENT, MONO, SERIF, useTheme } from '../src/theme';

const BANDS = ['minimal', 'some', 'substantial', 'high'] as const;

const PRIVACY = [
  'No network requests. Every figure in this app was bundled into it at build time. There is no API client, no data refresh, and nothing to switch off — it works identically with the device offline, forever.',
  'No analytics and no telemetry. No crash reporter, no event tracking, no advertising or device identifier.',
  'No account, no sign-in, no sync, no payment code, no ads.',
  'Nothing you search for is stored. The search box filters an in-memory list and keeps no history.',
  'The only outbound action possible is a link you tap yourself to a primary government record, which opens in your browser outside this app.',
];

export default function About() {
  const t = useTheme();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: MAX_CONTENT, width: '100%', alignSelf: 'center' }}
      >
        <Text style={[SERIF, { fontSize: 24, lineHeight: 31, color: t.ink0 }]}>{PROJECT_NAME}</Text>
        <Text style={{ marginTop: 8, fontSize: 14.5, lineHeight: 21, color: t.ink2 }}>
          {PROJECT_TAGLINE}
        </Text>

        {/* First section on the screen, and not a restatement of the
            correlation paragraph below it. "Not proof" is a claim about
            evidence; this is the answer to the question a reader arrives with
            after seeing their own representative named next to a dollar figure,
            which is whether this app is accusing that person of something.
            Left unanswered, readers answered it themselves and answered it
            uncharitably. Same wording as the web /about because it comes from
            @ftm/core, and the same neutral ink as every other paragraph here —
            it is not a coverage caveat and must not borrow that styling. */}
        <View style={{ marginTop: 26 }}>
          <SectionTitle>This is not an accusation</SectionTitle>
          <Text style={{ fontSize: 14.5, lineHeight: 22, color: t.ink1 }}>{NO_ACCUSATION}</Text>
        </View>

        <View style={{ marginTop: 26 }}>
          <SectionTitle>The claim this tool makes</SectionTitle>
          <Text style={{ fontSize: 14.5, lineHeight: 22, color: t.ink1 }}>{DISCLAIMER_MEDIUM}</Text>
        </View>

        <View style={{ marginTop: 26 }}>
          <SectionTitle>Read this before you draw a conclusion</SectionTitle>
          <LongDisclaimer />
        </View>

        <View style={{ marginTop: 26 }}>
          <SectionTitle>How the overlap score works</SectionTitle>
          <View style={{ gap: 14 }}>
            <View>
              <Label>What it is</Label>
              <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 21, color: t.ink2 }}>
                {SCORE_EXPLAINER.what}
              </Text>
            </View>
            <View>
              <Label>What it is not</Label>
              <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 21, color: t.ink2 }}>
                {SCORE_EXPLAINER.whatItIsNot}
              </Text>
            </View>
            <View>
              <Label>How to use it</Label>
              <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 21, color: t.ink2 }}>
                {SCORE_EXPLAINER.howToUse}
              </Text>
            </View>
            <View>
              <Label>The exact formula</Label>
              <Text style={[MONO, { marginTop: 4, fontSize: 12, lineHeight: 18, color: t.ink3 }]}>
                {INDEX.overlapFormula}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 26 }}>
          <SectionTitle>The bands, and what each one means</SectionTitle>
          <View style={{ gap: 8 }}>
            {BANDS.map((b) => (
              <Card key={b}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink0 }}>
                  {OVERLAP_BAND_LABEL[b]}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: t.ink3 }}>
                  {OVERLAP_BAND_NOTE[b]}
                </Text>
              </Card>
            ))}
          </View>
          <Text style={{ marginTop: 10, fontSize: 12.5, lineHeight: 18, color: t.ink4 }}>
            The bands are described in words and drawn with one neutral ink ramp. There is no
            red/green scale anywhere in this app, because a high overlap is not a verdict.
          </Text>
        </View>

        <View style={{ marginTop: 26 }}>
          <SectionTitle>What is and is not in this bundle</SectionTitle>
          <View style={{ gap: 8 }}>
            {INDEX.coverageNotes.map((n, i) => (
              <CoverageNote key={i}>{n}</CoverageNote>
            ))}
            <CoverageNote>
              This mobile client reads the top-level export files only. Per-bill plain-English
              summaries and complete per-member donor breakdowns are written by the exporter solely
              into the web build, so bill and member screens here reconstruct what they can from the
              bundled files and say so where they fall short.
            </CoverageNote>
          </View>
          <Text style={{ marginTop: 10, fontSize: 12.5, lineHeight: 18, color: t.ink4 }}>
            Bundle generated {shortDate(INDEX.generatedAt)} · FEC cycle {INDEX.cycle}{' '}
            · {INDEX.congress}th Congress · sources: FEC {INDEX.sources.openfec}, Congress{' '}
            {INDEX.sources.congress}, classification {INDEX.sources.classification}.
          </Text>
        </View>

        <View style={{ marginTop: 26 }}>
          <SectionTitle>What this app does on your device</SectionTitle>
          <View style={{ gap: 8 }}>
            {PRIVACY.map((p) => (
              <Text key={p} style={{ fontSize: 14, lineHeight: 21, color: t.ink2 }}>
                · {p}
              </Text>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 26 }}>
          <SectionTitle>Primary sources</SectionTitle>
          <View style={{ gap: 8 }}>
            <SourceLink href="https://www.fec.gov/data/">FEC campaign finance</SourceLink>
            <SourceLink href="https://www.congress.gov/">Congress.gov</SourceLink>
            <SourceLink href="https://www.usaspending.gov/">USASpending.gov</SourceLink>
          </View>
          <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 19, color: t.ink3 }}>
            MIT licensed. A personal open-source project, not a company and not a commercial product.
            Source: {PROJECT_REPO_URL}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
