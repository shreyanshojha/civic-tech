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
