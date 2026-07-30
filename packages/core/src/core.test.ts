import { describe, expect, it } from 'vitest';
import { classifyTextToIndustry, industryFromNaics } from './industries.js';
import { computeOverlap } from './overlap.js';
import {
  DISCLAIMER_PLAIN,
  DISCLAIMER_PLAIN_MORE,
  OVERLAP_BAND_PLAIN,
  SCORE_EXPLAINER_PLAIN,
  plainAmount,
  plainShare,
  DISCLAIMER_CARD,
  DISCLAIMER_LONG,
  DISCLAIMER_MEDIUM,
  DISCLAIMER_SHORT,
  LLM_FRAMING_RULES,
  overlapBand,
} from './disclaimer.js';
import {
  PATTERN_LIMITS,
  PATTERN_THRESHOLDS,
  PATTERN_VERDICT_LABEL,
  PATTERN_VERDICT_PLAIN,
  adjustPatterns,
  benjaminiHochberg,
  computePattern,
  describeCohortSpread,
  describePattern,
  mean,
  median,
  permutationPValue,
  seededRandom,
  type MemberObservation,
} from './patterns.js';
import type { BillClassification, DonorProfile } from './types.js';

describe('keyword industry classifier', () => {
  it('maps obvious employers', () => {
    expect(classifyTextToIndustry('Pfizer Inc').industry).toBe('pharma');
    expect(classifyTextToIndustry('Lockheed Martin').industry).toBe('defense');
    expect(classifyTextToIndustry('Exxon Mobil Corporation').industry).toBe('energy-fossil');
    expect(classifyTextToIndustry('Sunrun').industry).toBe('energy-renewable');
    expect(classifyTextToIndustry('Coinbase Global').industry).toBe('crypto');
    expect(classifyTextToIndustry('IBEW Local 58').industry).toBe('labor-unions');
  });

  it('refuses to guess on filing placeholders', () => {
    for (const junk of ['N/A', 'NONE', 'SELF', 'RETIRED', 'INFORMATION REQUESTED', '']) {
      const r = classifyTextToIndustry(junk);
      expect(r.industry).toBe('other');
      expect(r.confidence).toBe(0);
    }
  });

  it('prefers the more specific sector when several could match', () => {
    // "renewable energy" must not fall through to the fossil pattern
    expect(classifyTextToIndustry('Clean Energy Solar Partners').industry).toBe('energy-renewable');
  });

  it('maps NAICS prefixes', () => {
    expect(industryFromNaics('541511')).toBe('tech');
    expect(industryFromNaics('621111')).toBe('health-providers');
    expect(industryFromNaics('999999')).toBe(null);
    expect(industryFromNaics(undefined)).toBe(null);
  });
});

const donors: DonorProfile = {
  bioguideId: 'X000001',
  cycle: 2026,
  totalItemized: 100_000,
  byIndustry: [
    { industry: 'pharma', amount: 30_000, share: 0.3, contributionCount: 20 },
    { industry: 'health-providers', amount: 20_000, share: 0.2, contributionCount: 15 },
    { industry: 'tech', amount: 10_000, share: 0.1, contributionCount: 5 },
    { industry: 'other', amount: 40_000, share: 0.4, contributionCount: 60 },
  ],
  unclassifiedAmount: 40_000,
  unclassifiedShare: 0.4,
  sourceUrls: [],
  fetchedAt: new Date(0).toISOString(),
};

function bill(industries: BillClassification['industries']): BillClassification {
  return {
    billId: '119-hr-1',
    plainSummary: 'test',
    industries,
    method: 'keyword-fallback',
    model: null,
    inputHash: 'x',
    classifiedAt: new Date(0).toISOString(),
  };
}

describe('overlap score', () => {
  it('is the donor share when the bill is single-industry', () => {
    const r = computeOverlap(bill([{ industry: 'pharma', confidence: 0.9, rationale: '' }]), donors);
    expect(r.score).toBeCloseTo(0.3, 5);
    expect(r.matches[0]!.industry).toBe('pharma');
  });

  it('is a confidence-weighted blend across industries', () => {
    const r = computeOverlap(
      bill([
        { industry: 'pharma', confidence: 0.8, rationale: '' },
        { industry: 'tech', confidence: 0.4, rationale: '' },
      ]),
      donors,
    );
    // weights 0.8/1.2 and 0.4/1.2 -> 0.3*0.667 + 0.1*0.333
    expect(r.score).toBeCloseTo(0.3 * (0.8 / 1.2) + 0.1 * (0.4 / 1.2), 5);
  });

  it('never counts unclassified money as a match', () => {
    const r = computeOverlap(bill([{ industry: 'other', confidence: 1, rationale: '' }]), donors);
    expect(r.score).toBe(0);
    expect(r.matches).toHaveLength(0);
  });

  it('returns zero for a bill with no matching industries', () => {
    const r = computeOverlap(bill([{ industry: 'firearms', confidence: 1, rationale: '' }]), donors);
    expect(r.score).toBe(0);
  });

  it('drops low-confidence bill industries below the threshold', () => {
    const r = computeOverlap(bill([{ industry: 'pharma', confidence: 0.1, rationale: '' }]), donors);
    expect(r.score).toBe(0);
  });

  it('stays inside 0..1 and surfaces the unclassified gap', () => {
    const r = computeOverlap(
      bill([
        { industry: 'pharma', confidence: 1, rationale: '' },
        { industry: 'health-providers', confidence: 1, rationale: '' },
        { industry: 'tech', confidence: 1, rationale: '' },
      ]),
      donors,
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.method.unclassifiedDonorShare).toBe(0.4);
    expect(r.method.formula).toContain('donorShare');
  });

  it('bands are monotonic', () => {
    expect(overlapBand(0.05)).toBe('minimal');
    expect(overlapBand(0.2)).toBe('some');
    expect(overlapBand(0.45)).toBe('substantial');
    expect(overlapBand(0.9)).toBe('high');
  });
});

describe('framing guarantees', () => {
  const all = [DISCLAIMER_SHORT, DISCLAIMER_MEDIUM, DISCLAIMER_LONG, DISCLAIMER_CARD];

  it('every disclaimer names the correlation/causation distinction', () => {
    for (const d of all) {
      expect(d.toLowerCase()).toMatch(/causation|causal|caused/);
    }
  });

  it('no disclaimer accuses anyone', () => {
    for (const d of all) {
      expect(d.toLowerCase()).not.toMatch(/\b(corrupt|bribe|bought and paid)\b/);
    }
  });

  it('LLM rules forbid causal and partisan language', () => {
    expect(LLM_FRAMING_RULES).toMatch(/Never assert or imply that a campaign contribution caused/);
    expect(LLM_FRAMING_RULES).toMatch(/Never use partisan framing/);
  });

  it('the long disclaimer states the hard-money-only limitation', () => {
    expect(DISCLAIMER_LONG).toMatch(/hard money/i);
    expect(DISCLAIMER_LONG).toMatch(/501\(c\)\(4\)|dark money/i);
  });
});

describe('stem matching regressions', () => {
  // Each of these previously failed because the pattern was a stem anchored with
  // a trailing word boundary, so it could not match the longer word it stemmed.
  it('matches inflected forms of stem patterns', () => {
    expect(classifyTextToIndustry('PFIZER PHARMACEUTICALS INC').industry).toBe('pharma');
    expect(classifyTextToIndustry('SOUTHERN COMPANY EMPLOYEES PAC').industry).toBe('utilities-electric');
    expect(classifyTextToIndustry('BLACKROCK CAPITAL MANAGEMENT').industry).toBe('finance-banking');
    expect(classifyTextToIndustry('NATIONAL ASSOCIATION OF HOMEBUILDERS').industry).toBe('real-estate');
    expect(classifyTextToIndustry('ASARCO SMELTING').industry).toBe('mining');
  });

  it('does not read a filing formality as a political cause', () => {
    // "POLITICAL ACTION COMMITTEE" is in the registered legal name of most
    // corporate PACs. It must never on its own imply an ideological committee.
    for (const name of [
      'DUKE ENERGY CORPORATION EMPLOYEE POLITICAL ACTION COMMITTEE',
      'LOCKHEED MARTIN CORPORATION EMPLOYEES POLITICAL ACTION COMMITTEE',
      'GENERIC WIDGET CO POLITICAL ACTION COMMITTEE',
    ]) {
      expect(classifyTextToIndustry(name).industry).not.toBe('ideological-single-issue');
    }
    expect(classifyTextToIndustry('DUKE ENERGY CORPORATION EMPLOYEE POLITICAL ACTION COMMITTEE').industry).toBe('utilities-electric');
  });

  it('still refuses to guess when a name says nothing', () => {
    expect(classifyTextToIndustry('GENERIC WIDGET CO POLITICAL ACTION COMMITTEE').industry).toBe('other');
  });

  it('does not match a surname that merely starts like a bank', () => {
    expect(classifyTextToIndustry('BANCROFT FAMILY TRUST').industry).not.toBe('finance-banking');
  });
});

describe('plain-language layer', () => {
  it('is shorter than the formal version but keeps the causal caveat', () => {
    expect(DISCLAIMER_PLAIN.length).toBeLessThan(DISCLAIMER_MEDIUM.length);
    // Shorter, never softer: the non-causal claim must survive simplification.
    expect(DISCLAIMER_PLAIN.toLowerCase()).toMatch(/does not prove|not proof|does not mean/);
  });

  it('reads at a low grade level — short sentences, short words', () => {
    for (const text of [DISCLAIMER_PLAIN, DISCLAIMER_PLAIN_MORE]) {
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
      const words = text.split(/\s+/).filter(Boolean);
      expect(words.length / sentences.length).toBeLessThan(16); // avg sentence length
      expect(words.filter((w) => w.length > 12).length).toBe(0); // no long words
    }
  });

  it('never accuses anyone, even in the short form', () => {
    for (const text of [DISCLAIMER_PLAIN, DISCLAIMER_PLAIN_MORE, ...Object.values(OVERLAP_BAND_PLAIN), ...Object.values(SCORE_EXPLAINER_PLAIN)]) {
      expect(text.toLowerCase()).not.toMatch(/\b(corrupt|bribe|bought|paid off|crooked)\b/);
    }
  });

  it('puts money on a human scale without editorialising', () => {
    expect(plainAmount(0)).toBe('nothing recorded');
    expect(plainAmount(950)).toBe('$950');
    expect(plainAmount(274_100)).toBe('$274 thousand');
    expect(plainAmount(3_400_000)).toBe('$3.4 million');
    expect(plainAmount(2_100_000_000)).toBe('$2.1 billion');
  });

  it('describes shares as fractions people can picture', () => {
    expect(plainShare(0)).toBe('none of it');
    expect(plainShare(0.34)).toBe('about a third of it');
    expect(plainShare(0.5)).toBe('about half of it');
    expect(plainShare(0.99)).toBe('almost all of it');
  });
});

import { explainOverlap, findOrdinaryExplanations, plainRatio } from './meaning.js';

describe('the "what does this mean" layer', () => {
  const base = {
    score: 0.28,
    memberName: 'A Member',
    billLabel: 'H.R. 1',
    topIndustry: 'agriculture' as const,
    topIndustryAmount: 19_000,
    totalDisclosed: 356_000,
    unattributedShare: 0.3,
    distribution: { percentile: 55, median: 0.24, n: 3000 },
    ordinary: [],
    hasVote: false,
    classificationMethod: 'llm' as const,
  };

  it('restates the arithmetic instead of interpreting it', () => {
    const m = explainOverlap(base);
    expect(m.inPlainTerms).toContain('$3 of every $10');
    expect(m.inPlainTerms).toContain('Agriculture');
  });

  it('never narrates a motive, an accusation, or an implication', () => {
    // The exhaustive check: every sentence this module can emit, across the
    // full range of inputs, must be free of causal and accusatory language.
    const forbidden = /\b(corrupt|bribe|bought|paid off|beholden|captured|in the pocket|influenced by|because of the money|suggests that|raises questions|appears to have|conflict of interest|scandal)\b/i;
    for (const score of [0, 0.1, 0.3, 0.5, 0.8, 1]) {
      for (const ordinary of [[], [{ kind: 'committee-seat' as const, text: 'x' }]]) {
        for (const dist of [null, { percentile: 5, median: 0.2, n: 3000 }, { percentile: 97, median: 0.2, n: 3000 }]) {
          const m = explainOverlap({ ...base, score, ordinary, distribution: dist });
          const all = [m.inPlainTerms, m.comparedToOthers ?? '', ...m.ordinaryReasons, ...m.whatWouldMakeItInteresting, m.bottomLine].join(' ');
          expect(all).not.toMatch(forbidden);
        }
      }
    }
  });

  it('does not say "about 0 in 100 are higher" at the top of the distribution', () => {
    const m = explainOverlap({ ...base, distribution: { percentile: 99.92, median: 0.011, n: 3590 } });
    expect(m.comparedToOthers).not.toMatch(/\b0 in 100\b/);
    expect(m.comparedToOthers).toMatch(/Fewer than 1 in 100/);
  });

  it('warns that the comparison set is mostly near-zero, so a high percentile is not extreme', () => {
    const m = explainOverlap({ ...base, distribution: { percentile: 99, median: 0.011, n: 3590 } });
    expect(m.comparedToOthers).toMatch(/barely overlap at all/);
    expect(m.comparedToOthers).toMatch(/easier than it sounds/);
  });

  it('never uses leaderboard language for the comparison', () => {
    const high = explainOverlap({ ...base, distribution: { percentile: 99, median: 0.2, n: 3000 } });
    expect(high.comparedToOthers).not.toMatch(/\b(worst|highest|top of|number one|rank)\b/i);
    expect(high.comparedToOthers).toContain('in 100');
  });

  it('suppresses the comparison when the sample is too small to mean anything', () => {
    expect(explainOverlap({ ...base, distribution: { percentile: 90, median: 0.2, n: 9 } }).comparedToOthers).toBeNull();
    expect(explainOverlap({ ...base, distribution: null }).comparedToOthers).toBeNull();
  });

  it('puts the mundane explanation first and lets it lead the bottom line', () => {
    const m = explainOverlap({
      ...base, score: 0.8,
      ordinary: [{ kind: 'committee-seat', text: 'They sit on the committee that handles this bill.' }],
    });
    expect(m.ordinaryReasons[0]).toContain('committee');
    expect(m.bottomLine).toMatch(/plain explanation/i);
  });

  it('refuses to treat a low score as exoneration', () => {
    const m = explainOverlap({ ...base, score: 0.02 });
    expect(m.bottomLine).toMatch(/not a clean bill of health/i);
  });

  it('warns when the percentage rests on a large unattributed pile', () => {
    const m = explainOverlap({ ...base, unattributedShare: 0.55 });
    expect(m.ordinaryReasons.join(' ')).toMatch(/floor, not a measurement/);
  });

  it('always tells the reader the score ignores the vote', () => {
    for (const hasVote of [true, false]) {
      const m = explainOverlap({ ...base, hasVote });
      expect(m.whatWouldMakeItInteresting.join(' ')).toMatch(/vote/i);
    }
    expect(explainOverlap({ ...base, hasVote: true }).whatWouldMakeItInteresting[0]).toMatch(/does not use their vote/);
  });

  it('derives ordinary explanations only from real fields', () => {
    const none = findOrdinaryExplanations({
      role: null, onCommitteeOfJurisdiction: false, topIndustry: 'tech', totalDisclosed: 500_000,
    });
    expect(none).toEqual([]);

    const seat = findOrdinaryExplanations({
      role: 'Sponsor', onCommitteeOfJurisdiction: true, committeeName: 'House Committee on Agriculture',
      topIndustry: 'agriculture', state: 'IA', stateColleaguesWithSameTopSector: 3, stateColleagueCount: 4,
      totalDisclosed: 500_000,
    });
    expect(seat.map((r) => r.kind)).toEqual(['committee-seat', 'sponsor', 'state-industry']);
  });

  it('flags a small denominator, because a share of very little is arithmetic not signal', () => {
    const r = findOrdinaryExplanations({
      role: null, onCommitteeOfJurisdiction: false, topIndustry: 'tech', totalDisclosed: 25_000,
    });
    expect(r[0]!.kind).toBe('small-total');
  });

  it('phrases ratios so they can be pictured', () => {
    expect(plainRatio(0)).toBe('none of every $10');
    expect(plainRatio(0.03)).toBe('less than 50 cents of every $10');
    expect(plainRatio(0.28)).toBe('about $3 of every $10');
    expect(plainRatio(0.5)).toBe('about $5 of every $10');
  });
});

import {
  PLAIN_BILL_FRAMING,
  POLICY_AREA_AUDIENCES,
  PROSE_REWRITES,
  SUBJECT_AUDIENCES,
  conditionalise,
  explainBillPlainly,
  fleschKincaidGrade,
  simplifyLegalProse,
  splitSentences,
  stripTitleRestatement,
  trimTitle,
} from './plain-bill.js';

/**
 * The plain-language layer.
 *
 * These tests are the enforcement half of the five rules written at the top of
 * plain-bill.ts. They exist because the failure mode of that module is not a
 * crash or a wrong number — it is a fluent, confident, false sentence about a
 * law, which nobody reviewing the site would be able to spot without the bill
 * open beside them.
 *
 * The fixtures are real rows from the shipped dataset, not invented text, so a
 * change to the rewrite tables is checked against the register CRS actually
 * writes in.
 */
describe('the plain-language bill layer', () => {
  // 119-hr-1703: a CRS summary, in the standard CRS shape — short title
  // restated, then the operative sentence.
  const wheelchair = {
    title: 'Choices for Increased Mobility Act of 2026',
    billType: 'hr',
    policyArea: 'Health',
    subjects: ['Medicare', 'Health technology, devices, supplies', 'Health care costs and insurance'],
    officialSummary:
      'Choices for Increased Mobility Act of 2025 This bill requires the Centers for Medicare & Medicaid Services (CMS) to establish specific billing codes under Medicare for certain materials used in ultralightweight manual wheelchairs. Specifically, the CMS must establish at least two billing codes for the base of the wheelchair.',
  };
  // 119-hr-9970: no summary anywhere. Two thirds of the dataset looks like this.
  const titleOnly = {
    title:
      'To amend title XVIII of the Social Security Act to ensure appropriate payments for ambulance services under the Medicare program.',
    billType: 'hr',
    policyArea: 'Health',
    subjects: [] as string[],
    officialSummary: null,
  };
  // 119-hres-153: a condolence resolution. The class of measure that must never
  // be described as doing anything.
  const condolence = {
    title:
      'Expressing condolences to the families, friends, and loved ones of the victims of the crash of American Eagle Flight 5342.',
    billType: 'hres',
    policyArea: 'Congress',
    subjects: ['Congressional tributes'],
    officialSummary: null,
  };

  // --- rule 1: nothing has happened yet ------------------------------------
  it('never states that a bill has already had an effect', () => {
    // The indicative third-person verb is the exact shape of the error: "This
    // bill requires the CMS to…" reads as a description of current law.
    const indicative = /\bThis (?:bill|measure|resolution|joint resolution|act)\s+(?!would\b|has not\b)[a-z]+s\b/;
    for (const input of [wheelchair, titleOnly, condolence]) {
      const p = explainBillPlainly(input);
      const emitted = [p.whatItDoes, p.whoItTouches, p.everydayEffect, p.titleInPlainWords ?? ''].join(' ');
      // The one exception is the attributed fallback, which describes the
      // DOCUMENT rather than the world and says so before quoting it.
      const quoted = /The official summary says:/.test(emitted);
      if (!quoted) expect(emitted).not.toMatch(indicative);
      // Note "Nothing has changed yet." is the compliant sentence, so the
      // pattern targets the assertion, not the word.
      expect(emitted).not.toMatch(/\b(now requires|is now the (law|rule)|became law|took effect|currently requires|already requires)\b/i);
    }
    const p = explainBillPlainly(wheelchair);
    expect(p.whatItDoes).toMatch(/\bwould\b/);
    expect(p.everydayEffect).toContain(PLAIN_BILL_FRAMING.notLawYet);
    expect(p.everydayEffect).toMatch(/^If it passed/);
  });

  it('rewrites the CRS present tense into the conditional, including a second coordinated verb', () => {
    expect(conditionalise('This bill requires the FDA to act.')).toBe('This bill would require the FDA to act.');
    // The bug this catches: "would extend and modifies" — a present-tense
    // assertion smuggled into a conditional sentence, in the hardest place to
    // see it.
    expect(conditionalise('This bill extends and modifies the Act.')).toBe('This bill would extend and change the Act.');
    // "This act" must never be printed about a measure that is not an act.
    expect(conditionalise('This act expands the boundaries.')).toBe('This measure would widen the boundaries.');
    // An unknown verb is attributed rather than conjugated by rule, because
    // guessing a stem produces "this bill ha the effect of".
    expect(conditionalise('This bill hornswoggles the agency.')).toBe(
      'The official summary says: This bill hornswoggles the agency.',
    );
  });

  it('keeps every effect sentence conditional and says most bills never become law', () => {
    for (const input of [wheelchair, titleOnly]) {
      const p = explainBillPlainly(input);
      expect(p.everydayEffect).toContain('never become law');
      expect(p.everydayEffect).toMatch(/\b(If it passed|would)\b/);
    }
    // A simple resolution does not become law even if it passes, and saying
    // "most bills never become law" about one would be the wrong caveat.
    const res = explainBillPlainly({ ...titleOnly, billType: 'sres' });
    expect(res.everydayEffect).toContain(PLAIN_BILL_FRAMING.neverBecomesLaw);
  });

  // --- rule 2: no evaluation -----------------------------------------------
  it('never says a bill is good, bad, needed or dangerous', () => {
    const evaluative =
      /\b(good|bad|terrible|dangerous|harmful|beneficial|sensible|common-?sense|corrupt|giveaway|loophole|handout|radical|extreme|scandal|wasteful|generous|overdue|long-overdue)\b/i;
    const everySentence = [
      ...Object.values(PLAIN_BILL_FRAMING),
      ...SUBJECT_AUDIENCES.flatMap((a) => [a.who, a.where]),
      ...Object.values(POLICY_AREA_AUDIENCES).flatMap((a) => [a.who, a.where]),
    ];
    for (const s of everySentence) expect(s).not.toMatch(evaluative);
  });

  it('strips the sponsor\'s own praise out of a title rather than repeating it', () => {
    // "To improve" is a claim about the result, made by the person who wrote
    // the bill. Echoing it in our own sentence is endorsing it.
    expect(simplifyLegalProse('To improve the Head Start Act')).toBe('To change the Head Start Act');
    expect(simplifyLegalProse('To expand and improve participation')).toBe('To expand and change participation');
    expect(simplifyLegalProse('To strengthen the rules')).toBe('To tighten the rules');
    // …but a statute's NAME is not praise, and must survive intact.
    expect(simplifyLegalProse('the Tax Reform Act of 1986 applies')).toContain('Tax Reform Act');
  });

  // --- rule 3: who it reaches, never who profits ---------------------------
  it('never names anyone as benefiting, gaining or profiting from a bill', () => {
    const causal = /\b(benefit|benefits|profit|profits|gains?|stands to|wins|winners|losers|rewards?|payoff|in return)\b/i;
    for (const a of SUBJECT_AUDIENCES) {
      expect(a.who).not.toMatch(causal);
      expect(a.where).not.toMatch(causal);
    }
    for (const a of Object.values(POLICY_AREA_AUDIENCES)) {
      expect(a.who).not.toMatch(causal);
      expect(a.where).not.toMatch(causal);
    }
    for (const s of Object.values(PLAIN_BILL_FRAMING)) expect(s).not.toMatch(causal);
  });

  it('answers "who does this reach" with people, in words they would use themselves', () => {
    expect(explainBillPlainly(wheelchair).whoItTouches).toContain('People on Medicare');
    expect(
      explainBillPlainly({ ...wheelchair, subjects: ['Aviation and airports'] }).whoItTouches,
    ).toBe('Anyone who flies.');
    expect(
      explainBillPlainly({ ...wheelchair, subjects: ['Elementary and secondary education'] }).whoItTouches,
    ).toBe('School districts, and children in them.');
    // The same audience reached by two subject terms must not print twice.
    const farm = explainBillPlainly({ ...wheelchair, policyArea: 'Agriculture and Food', subjects: ['Farm produce', 'Agricultural prices'] });
    expect(farm.whoItTouches).toBe('Farmers, and anyone who buys food.');
    // No subject match and no policy area: say so rather than guess.
    expect(explainBillPlainly({ ...wheelchair, policyArea: null, subjects: [] }).whoItTouches).toBe(
      PLAIN_BILL_FRAMING.audienceUnknown,
    );
  });

  // --- rule 4: a title is not a summary ------------------------------------
  it('says plainly that only the title exists, and does not paraphrase it into a description', () => {
    const p = explainBillPlainly(titleOnly);
    expect(p.confidence).toBe('title-only');
    expect(p.whatItDoes).toBe(PLAIN_BILL_FRAMING.titleOnly);
    expect(p.whatItDoes).toMatch(/only|all we have/i);
    expect(p.whatItDoes).toMatch(/open the bill/i);
    // The trimmed title is offered SEPARATELY and labelled as the title, so it
    // can never be read as a summary of the law — that conflation is the bug
    // this whole module exists to fix.
    expect(p.titleInPlainWords).not.toBeNull();
    expect(p.whatItDoes).not.toContain(p.titleInPlainWords!);
    expect(PLAIN_BILL_FRAMING.titleRestatementLead).toMatch(/title/i);
  });

  it('turns the title into plain words without asserting anything about current law', () => {
    // Title XVIII is Medicare. A reader told "title XVIII" learns nothing.
    expect(trimTitle(titleOnly.title)).toBe(
      'Would change Medicare rules so that they ensure appropriate payments for ambulance services under the Medicare program.',
    );
    expect(trimTitle(titleOnly.title)).toMatch(/^Would\b/);
    // "and for other purposes" grants nothing and restricts nothing.
    expect(trimTitle('To require a report on widgets, and for other purposes.')).toBe(
      'Would require a report on widgets.',
    );
    // A bare marketing short title cannot be improved, so nothing is offered.
    expect(trimTitle('SHARE Act of 2025')).toBeNull();
  });

  // --- rule 5: ceremonial measures ----------------------------------------
  it('reuses isCeremonialMeasure and says plainly that nothing changes', () => {
    const p = explainBillPlainly(condolence);
    expect(p.confidence).toBe('ceremonial');
    expect(p.whatItDoes).toBe(PLAIN_BILL_FRAMING.ceremonial);
    expect(p.whatItDoes).toMatch(/tribute or a commemoration/);
    expect(p.whatItDoes).toMatch(/does not change any law/);
    expect(p.whoItTouches).toMatch(/^Nobody directly/);
    expect(p.everydayEffect).toBe(PLAIN_BILL_FRAMING.ceremonialEffect);

    const postOffice = explainBillPlainly({
      title: 'To designate the facility of the United States Postal Service located at 1 Main Street as the John Doe Post Office.',
      billType: 'hr', policyArea: 'Government Operations and Politics', subjects: [], officialSummary: null,
    });
    expect(postOffice.confidence).toBe('ceremonial');
    expect(postOffice.whoItTouches).toMatch(/renames a building/);

    // Congress running its own house is not a tribute, and calling it one is a
    // plain factual error in the sentence a reader trusts most.
    const committees = explainBillPlainly({
      title: 'Electing Members to certain standing committees of the House of Representatives.',
      billType: 'hres', policyArea: 'Congress', subjects: ['Congressional committees'], officialSummary: null,
    });
    expect(committees.whatItDoes).toBe(PLAIN_BILL_FRAMING.ceremonialProcedural);
  });

  it('does not call a Congressional Review Act repeal a housekeeping measure', () => {
    // These nullify federal rules. policy-areas.ts intends to exempt them but
    // its test looks for "congressional disapproval of the rule", and every one
    // in this dataset says "congressional disapproval UNDER CHAPTER 8 OF TITLE
    // 5, UNITED STATES CODE, of the rule", so the exemption never fires.
    const cra = explainBillPlainly({
      title:
        'Providing for congressional disapproval under chapter 8 of title 5, United States Code, of the rule submitted by the Bureau of Land Management relating to the Miles City Field Office.',
      billType: 'hjres',
      policyArea: 'Public Lands and Natural Resources',
      subjects: ['Land use and conservation'],
      officialSummary:
        'This joint resolution opens certain land administered by the Bureau of Land Management (BLM) in eastern Montana to coal leasing. Specifically, it nullifies the rule issued by the Bureau of Land Management.',
    });
    expect(cra.confidence).toBe('crs-summary');
    expect(cra.whatItDoes).toBe(
      'This joint resolution would open certain land administered by the federal land agency in eastern Montana to coal leasing.',
    );
  });

  it('lets the CRS summary outvote a commemorative subject term on a substantive bill', () => {
    // The National Defense Authorization Act carries the subject "Awards and
    // medals" because it contains medal provisions, and was therefore being
    // described to readers as a tribute that changes no law.
    const ndaa = explainBillPlainly({
      title: 'National Defense Authorization Act for Fiscal Year 2026',
      billType: 's',
      policyArea: 'Armed Forces and National Security',
      subjects: ['Awards and medals', 'Military procurement'],
      officialSummary:
        'National Defense Authorization Act for Fiscal Year 2026 This bill sets forth policies and authorities for FY2026 for Department of Defense (DOD) programs and activities.',
    });
    expect(ndaa.confidence).toBe('crs-summary');
    expect(ndaa.whatItDoes).toContain('would set out policies');
  });

  // --- the rewrite table ---------------------------------------------------
  it('carries a written justification for every rewrite it will make', () => {
    for (const r of PROSE_REWRITES) {
      expect(r.why.length, `${r.from} has no real justification`).toBeGreaterThan(40);
      expect(r.from).toBeInstanceOf(RegExp);
    }
  });

  it('drops the CRS restatement of the title, which is the noise that made the old field useless', () => {
    expect(stripTitleRestatement('Fight Illicit Pill Presses Act This bill broadens the scope.')).toBe(
      'This bill broadens the scope.',
    );
    // Two short titles, which CRS also does: "X Act of 2025 or the Y Act…".
    expect(
      stripTitleRestatement('Support And Value Expectant Moms Act of 2025 or the SAVE Act of 2025 This bill prohibits X.'),
    ).toBe('This bill prohibits X.');
    // No anchor: return it untouched rather than guess where the title ended.
    expect(stripTitleRestatement('Sets forth policies.')).toBe('Sets forth policies.');
  });

  it('simplifies legislative boilerplate without dropping a qualifier that changes the law', () => {
    expect(simplifyLegalProse('The Secretary shall issue a rule.')).toBe('The Secretary must issue a rule.');
    expect(simplifyLegalProse('The Secretary shall not issue a rule.')).toBe('The Secretary must not issue a rule.');
    expect(simplifyLegalProse('Notwithstanding any other provision of law, the rule applies.')).toBe(
      'Even if another law says otherwise, the rule applies.',
    );
    // "Subject to the availability of appropriations" is the qualifier readers
    // most often miss: the activity is authorised but not funded.
    expect(simplifyLegalProse('Subject to the availability of appropriations, the agency may act.')).toContain(
      'only if Congress puts up the money',
    );
    expect(simplifyLegalProse('not later than 180 days after the date of enactment of this Act')).toBe(
      'within 180 days after the day this becomes law',
    );
    // An acronym gloss is dropped only when the name it glossed has been made
    // plain; a parenthetical carrying content is never touched.
    expect(simplifyLegalProse('the Environmental Protection Agency (EPA) must report')).toBe('the EPA must report');
    expect(simplifyLegalProse('requires (1) a report and (2) a plan')).toBe('requires (1) a report and (2) a plan');
    // The adjective "appropriate" must survive; only the verb is rewritten.
    expect(simplifyLegalProse('to ensure appropriate payments')).toBe('to ensure appropriate payments');
    expect(simplifyLegalProse('This bill appropriates $5 million')).toBe('This bill sets aside money $5 million');
    // No doubled prepositions or orphaned commas from a deletion.
    expect(simplifyLegalProse('To require a report, and for other purposes.')).toBe('To require a report.');
    for (const s of [
      'in fiscal year 2026 the agency acts',
      'continuing FY2026 appropriations for the Department of Defense',
      'the Department of the Treasury and the Department of Energy',
    ]) {
      expect(simplifyLegalProse(s)).not.toMatch(/ {2}|the the|,,|\s,/);
    }
  });

  // --- reading level -------------------------------------------------------
  it('writes its own sentences at grade 6 or below, because that is the whole feature', () => {
    for (const [key, text] of Object.entries(PLAIN_BILL_FRAMING)) {
      // `sourceCrs` has to name the Congressional Research Service, which is
      // eight syllables of proper noun no rewrite can shorten. Everything this
      // module says in its own voice clears grade 6.
      const ceiling = key === 'sourceCrs' ? 6.5 : 6;
      expect(fleschKincaidGrade(text), `${key}: "${text}"`).toBeLessThanOrEqual(ceiling);
    }
  });

  it('measures reading grade the standard way, and does not split on "U.S."', () => {
    expect(splitSentences('The U.S. acts. It reports.')).toEqual(['The U.S. acts.', 'It reports.']);
    expect(fleschKincaidGrade('The cat sat on the mat.')).toBeLessThan(2);
    expect(fleschKincaidGrade('Notwithstanding the aforementioned statutory considerations, promulgation proceeds.')).toBeGreaterThan(14);
  });

  // --- determinism ---------------------------------------------------------
  it('is pure, so the same bill produces the same words on every pipeline run', () => {
    for (const input of [wheelchair, titleOnly, condolence]) {
      expect(explainBillPlainly(input)).toEqual(explainBillPlainly(input));
    }
    expect(explainBillPlainly(wheelchair).source).toBe(PLAIN_BILL_FRAMING.sourceCrs);
    expect(explainBillPlainly(titleOnly).source).toBe(PLAIN_BILL_FRAMING.sourceTitleOnly);
    expect(explainBillPlainly(condolence).source).toBe(PLAIN_BILL_FRAMING.sourceCeremonial);
  });

  it('treats a stub summary as no summary, rather than rewording it into false confidence', () => {
    const stub = explainBillPlainly({ ...titleOnly, officialSummary: 'Sets forth policies.' });
    expect(stub.confidence).toBe('title-only');
  });
});

describe('who a bill reaches when the librarians have not labelled it yet', () => {
  it('reads the statute the title names rather than giving up', () => {
    // 154 bills in this dataset have no policy area and no subject terms. A
    // title that says it amends title XVIII has still told us the answer: that
    // title IS Medicare. This is reading a citation, not guessing at a bill.
    const p = explainBillPlainly({
      title:
        'To amend title XVIII of the Social Security Act to ensure appropriate payments for ambulance services under the Medicare program.',
      billType: 'hr', policyArea: null, subjects: [], officialSummary: null,
    });
    expect(p.whoItTouches).toBe('People on Medicare.');
    // …and it still refuses to describe the bill, because a title is not a
    // summary (rule 4).
    expect(p.whatItDoes).toBe(PLAIN_BILL_FRAMING.titleOnly);
  });

  it('says so plainly when even the title names nothing recognisable', () => {
    const p = explainBillPlainly({ title: 'SHARE Act of 2025', billType: 'hr', policyArea: null, subjects: [], officialSummary: null });
    expect(p.whoItTouches).toBe(PLAIN_BILL_FRAMING.audienceUnknown);
  });
});

// ---------------------------------------------------------------------------
// COHORT PATTERNS
//
// This is the only module in the project that makes a claim about a group of
// named people, so it gets the heaviest tests. The five rules in its header are
// each asserted below, plus the arithmetic — because a wrong p-value here would
// not look wrong on the page. It would look authoritative.
// ---------------------------------------------------------------------------
describe('cohort pattern statistics', () => {
  const obs = (
    share: number, i: number, party = 'Democrat', state = 'CA', total = 1_000_000,
  ): MemberObservation => ({
    bioguideId: `X${i}`, name: `Member ${i}`, state, party, share, attributionRate: 0.4, total,
  });

  /** A cohort clearly above baseline, spread across states and both parties. */
  function buildInput(cohortShares: number[], baselineShares: number[]) {
    const states = ['CA', 'TX', 'NY', 'OH', 'FL', 'WA', 'GA', 'IL', 'PA', 'AZ', 'CO', 'MI'];
    return {
      committeeCode: 'HSBA', committeeName: 'House Committee on Test', chamber: 'House',
      sector: 'finance-banking', sectorLabel: 'Banking & finance',
      cohort: cohortShares.map((s, i) =>
        obs(s, i, i % 2 === 0 ? 'Democrat' : 'Republican', states[i % states.length])),
      baseline: baselineShares.map((s, i) =>
        obs(s, 1000 + i, i % 2 === 0 ? 'Democrat' : 'Republican', states[i % states.length])),
      iterations: 400,
    };
  }

  it('computes mean and median without being fooled by an even count', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(mean([])).toBe(0);
    expect(median([])).toBe(0);
  });

  it('never returns a p-value of zero, however extreme the gap', () => {
    // A p-value of exactly 0 is never a true statement about a permutation test:
    // it means "no shuffle beat this in the ones we tried", not "impossible".
    const p = permutationPValue(Array(30).fill(0.9), Array(60).fill(0.0), 500);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.01);
  });

  it('reports p = 1 when the cohort is not above the baseline', () => {
    // One-sided on purpose: a cohort receiving LESS is not evidence for the
    // pattern being described, and must not come out looking significant.
    expect(permutationPValue(Array(20).fill(0.1), Array(40).fill(0.5), 200)).toBe(1);
  });

  it('finds nothing when there is nothing there', () => {
    const shares = [0.05, 0.06, 0.04, 0.05, 0.055, 0.045, 0.05, 0.06, 0.04, 0.05, 0.05, 0.05];
    const input = buildInput(shares, [...shares, ...shares, ...shares]);
    const p = computePattern(input);
    expect(p).not.toBeNull();
    expect(p!.pValue).toBeGreaterThan(0.05);
    expect(adjustPatterns([p!])[0]!.verdict).not.toBe('worth-a-look');
  });

  it('is deterministic — the same input gives the same p-value', () => {
    // If this drifts, every figure on the site changes between builds and no
    // reader can reproduce what they are looking at.
    const input = buildInput(Array(15).fill(0.2), Array(40).fill(0.05));
    expect(computePattern(input)!.pValue).toBe(computePattern(input)!.pValue);
    expect(seededRandom(7)()).toBe(seededRandom(7)());
  });

  it('refuses to judge a cohort too small to test', () => {
    // Returning null is different from finding nothing, and callers must not
    // conflate them.
    expect(computePattern(buildInput(Array(5).fill(0.5), Array(50).fill(0.01)))).toBeNull();
    expect(computePattern(buildInput(Array(20).fill(0.5), Array(9).fill(0.01)))).toBeNull();
  });

  it('excludes members whose totals are too small to mean anything', () => {
    const input = buildInput(Array(14).fill(0.2), Array(40).fill(0.05));
    input.cohort.push(obs(0.99, 99, 'Democrat', 'CA', 5_000));
    expect(computePattern(input)!.cohort.n).toBe(14);
  });

  it('collapses a pattern that is really just five members (rule 3)', () => {
    // Five enormous values and everybody else at baseline. The headline ratio
    // looks strong; the trimmed one must not.
    const cohort = [0.9, 0.9, 0.9, 0.9, 0.9, ...Array(10).fill(0.05)];
    const p = adjustPatterns([computePattern(buildInput(cohort, Array(60).fill(0.05)))!])[0]!;
    expect(p.checks.trimmedRatio).toBeLessThan(PATTERN_THRESHOLDS.minTrimmedRatio);
    expect(p.verdict).not.toBe('worth-a-look');
    expect(p.failedChecks.join(' ')).toMatch(/five highest/i);
  });

  it('rejects a gap that holds in only one party', () => {
    const states = ['CA', 'TX', 'NY', 'OH', 'FL', 'WA', 'GA', 'IL', 'PA', 'AZ'];
    const input = {
      ...buildInput(Array(16).fill(0.2), Array(50).fill(0.05)),
      // Democrats high, Republicans at baseline.
      cohort: Array.from({ length: 16 }, (_, i) =>
        obs(i % 2 === 0 ? 0.3 : 0.05, i, i % 2 === 0 ? 'Democrat' : 'Republican', states[i % states.length])),
    };
    const p = adjustPatterns([computePattern(input)!])[0]!;
    expect(p.checks.holdsInBothParties).toBe(false);
    expect(p.failedChecks.join(' ')).toMatch(/both parties/i);
  });

  it('rejects a gap concentrated in a couple of states', () => {
    // Every high member from the same two states: "that industry is simply big
    // there" is the likely explanation and the committee is incidental.
    const cohort = Array.from({ length: 16 }, (_, i) =>
      obs(i < 10 ? 0.4 : 0.05, i, i % 2 === 0 ? 'Democrat' : 'Republican', i < 5 ? 'NY' : 'CT'));
    const p = adjustPatterns([computePattern({ ...buildInput([], Array(50).fill(0.05)), cohort })!])[0]!;
    expect(p.checks.geographicallySpread).toBe(false);
    expect(p.failedChecks.join(' ')).toMatch(/clustered in a few states/i);
  });

  it('rejects a large multiple built out of a rounding error', () => {
    // 0.4% against 0.1% is a 4x ratio a reader cannot act on. Ratio is
    // scale-free, which is exactly what makes it dangerous on a tiny sector.
    const p = adjustPatterns([computePattern(buildInput(Array(20).fill(0.004), Array(60).fill(0.001)))!])[0]!;
    expect(p.ratio).toBeGreaterThan(PATTERN_THRESHOLDS.minRatio);
    expect(p.verdict).not.toBe('worth-a-look');
    expect(p.failedChecks.join(' ')).toMatch(/rounding error/i);
  });

  it('flags cohorts whose money is traceable at different rates', () => {
    const input = buildInput(Array(16).fill(0.2), Array(50).fill(0.05));
    input.cohort = input.cohort.map((o) => ({ ...o, attributionRate: 0.8 }));
    input.baseline = input.baseline.map((o) => ({ ...o, attributionRate: 0.2 }));
    const p = adjustPatterns([computePattern(input)!])[0]!;
    expect(p.checks.attributionComparable).toBe(false);
    expect(p.failedChecks.join(' ')).toMatch(/traced to any sector/i);
  });

  it('never emits an infinite ratio (rule: a reader must be able to act on it)', () => {
    const p = computePattern(buildInput(Array(16).fill(0.3), Array(50).fill(0)))!;
    expect(Number.isFinite(p.ratio)).toBe(true);
  });

  it('corrects for multiple comparisons, and monotonically', () => {
    const q = benjaminiHochberg([0.001, 0.008, 0.02, 0.04, 0.6]);
    // BH is monotone non-decreasing by construction; a q below its own p is a bug.
    for (let i = 1; i < q.length; i++) expect(q[i]!).toBeGreaterThanOrEqual(q[i - 1]!);
    expect(q[0]!).toBeCloseTo(0.005, 6);
    expect(q[4]!).toBeCloseTo(0.6, 6);
    expect(Math.max(...q)).toBeLessThanOrEqual(1);
    expect(benjaminiHochberg([])).toEqual([]);
  });

  it('buries a real-looking gap once a thousand other pairs were tested', () => {
    // The whole reason BH exists here. p = 0.004 alone is "significant"; the
    // same p as one of 1,200 screened comparisons is unremarkable.
    const alone = benjaminiHochberg([0.004])[0]!;
    const among = benjaminiHochberg([0.004, ...Array(1199).fill(0.5)])[0]!;
    expect(alone).toBeLessThan(PATTERN_THRESHOLDS.maxQValue);
    expect(among).toBeGreaterThan(PATTERN_THRESHOLDS.maxQValue);
  });

  it('keeps failed patterns instead of hiding them (rule 4)', () => {
    const weak = computePattern(buildInput(Array(16).fill(0.051), Array(50).fill(0.05)))!;
    const strong = computePattern(buildInput(Array(16).fill(0.3), Array(50).fill(0.05)))!;
    expect(adjustPatterns([weak, strong])).toHaveLength(2);
  });

  it('never asserts a cause, ranks a person, or overclaims (rules 1, 2, 5)', () => {
    const p = adjustPatterns([computePattern(buildInput(Array(20).fill(0.3), Array(60).fill(0.05)))!])[0]!;
    const prose = [
      describePattern(p), describeCohortSpread(p),
      ...PATTERN_LIMITS,
      ...Object.values(PATTERN_VERDICT_PLAIN), ...Object.values(PATTERN_VERDICT_LABEL),
      ...p.failedChecks,
    ].join(' ');
    // No causal or accusatory verb anywhere in this module's reader-facing text.
    expect(prose).not.toMatch(/\b(caused|because of the money|in exchange|bought|bribe|corrupt|paid off|influenced|quid pro quo)\b/i);
    // No language that turns a distribution into an intention.
    expect(prose).not.toMatch(/\b(targets|rewards|buys|captured)\b/i);
    // Rule 5: nothing stronger than "worth a look". Matching the bare word
    // "proof" was the first attempt and it failed on the verdict copy, which
    // says "not proof of anything" — i.e. it flagged the disclaimer for
    // containing the word it exists to deny. So this looks for the assertion,
    // and then separately requires the denial to still be there.
    expect(prose).not.toMatch(/\b(this proves|is proof that|proves that|demonstrates that)\b/i);
    expect(PATTERN_VERDICT_PLAIN['worth-a-look']).toMatch(/not proof/i);
    // The unresolvable limit must actually be stated, not implied.
    expect(PATTERN_LIMITS.join(' ')).toMatch(/which came first/i);
    expect(describePattern(p)).toMatch(/receive/);
  });

  it('describes the spread in members, not in averages', () => {
    // "43 of 51 members" is the number a reader can weigh. A ratio of means is
    // not, and must not be the headline sentence.
    const p = adjustPatterns([computePattern(buildInput(Array(20).fill(0.3), Array(60).fill(0.05)))!])[0]!;
    expect(describeCohortSpread(p)).toMatch(/\d+ of the committee's \d+ members/);
  });
});
