/**
 * Tests for the share-card text layer.
 *
 * These run without a DOM on purpose. The helpers under test take anything with
 * a measureText(), so a fake proportional font is enough to prove the layout
 * invariants that actually matter:
 *
 *   - a line never measures wider than the box it was wrapped into;
 *   - truncation lands between words, not inside one;
 *   - the disclaimer on the card is DISCLAIMER_CARD, verbatim, and the headline
 *     never acquires a causal verb.
 *
 * The pixel drawing is verified separately by rendering a real card in a
 * browser; what is guarded here is the part that silently breaks when someone
 * pastes in a 300-character bill title.
 */

import { describe, expect, it } from 'vitest';
import {
  DISCLAIMER_CARD,
  PROJECT_REPO_URL,
  PROJECT_REPO_URL_IS_PLACEHOLDER,
  PROJECT_REPO_URL_PLACEHOLDER,
} from '@ftm/core';
import {
  CARD_HEIGHT,
  CARD_SCALE,
  CARD_WIDTH,
  buildHeadline,
  buildRoleClause,
  buildScoreQualifiers,
  buildSourceLine,
  fitLines,
  shareCardAlt,
  shareCardFilename,
  truncateOnWordBoundary,
  wrapText,
  type ShareCardFinding,
  type TextMeasurer,
} from './sharecard';

/** A fake monospace-ish font: every character is `per` units wide. */
function measurer(per = 10): TextMeasurer {
  return { measureText: (t: string) => ({ width: t.length * per }) };
}

/** A fake proportional font, so the tests do not accidentally assume uniform widths. */
const proportional: TextMeasurer = {
  measureText: (t: string) => ({
    width: [...t].reduce((w, c) => w + (c === ' ' ? 4 : 'ilj.,!'.includes(c) ? 4 : 'MW'.includes(c) ? 16 : 9), 0),
  }),
};

const LOREM =
  'The Committee on Energy and Commerce reported an act to modernise the interstate transmission grid and to authorise related appropriations for each of the fiscal years two thousand twenty five through two thousand thirty.';

const FINDING: ShareCardFinding = {
  memberName: 'Alexandra Q. Villanueva',
  memberSubtitle: 'Rep. TX-18',
  billLabel: 'H.R. 1234',
  billTitle: 'To modernise the interstate electricity transmission grid, and for other purposes.',
  topIndustryLabel: 'Electric utilities',
  topIndustryAmount: 187_400,
  score: 0.41,
  cycle: 2024,
  role: 'Cosponsor',
  totalDisclosed: 452_000,
  classificationMethod: 'keyword-fallback',
};

describe('wrapText', () => {
  it('wraps a paragraph into lines that each fit the box', () => {
    const ctx = measurer(10);
    const maxWidth = 200; // 20 characters
    const lines = wrapText(ctx, LOREM, maxWidth);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(maxWidth);
    }
  });

  it('never returns a line wider than maxWidth, for any box width', () => {
    const ctx = measurer(7);
    for (const maxWidth of [40, 63, 100, 137, 260, 512, 1072]) {
      for (const line of wrapText(ctx, LOREM, maxWidth)) {
        expect(ctx.measureText(line).width).toBeLessThanOrEqual(maxWidth);
      }
    }
  });

  it('does the same with a proportional font', () => {
    for (const maxWidth of [60, 150, 400, 1072]) {
      for (const line of wrapText(proportional, LOREM, maxWidth)) {
        expect(proportional.measureText(line).width).toBeLessThanOrEqual(maxWidth);
      }
    }
  });

  it('preserves the words and their order', () => {
    const lines = wrapText(measurer(), LOREM, 240);
    expect(lines.join(' ')).toBe(LOREM);
  });

  it('breaks a single unbreakable word rather than letting it overflow', () => {
    const ctx = measurer(10);
    const lines = wrapText(ctx, 'short aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa end', 100);
    for (const line of lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(100);
    }
    expect(lines.join('')).toContain('aaaaaaaaaa');
  });

  it('collapses whitespace and drops empty input', () => {
    expect(wrapText(measurer(), '   ', 100)).toEqual([]);
    expect(wrapText(measurer(), 'a   b', 1000)).toEqual(['a b']);
  });

  it('wraps the card disclaimer inside the card content width without clipping it', () => {
    // 21px system sans over the card's 1072px inner width. ~9.5px average
    // advance is a deliberately pessimistic stand-in for a real measurement.
    const ctx = measurer(9.5);
    const lines = wrapText(ctx, DISCLAIMER_CARD, CARD_WIDTH - 128);
    expect(lines.join(' ')).toBe(DISCLAIMER_CARD);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const line of lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(CARD_WIDTH - 128);
    }
  });
});

describe('truncateOnWordBoundary', () => {
  it('leaves short text alone', () => {
    expect(truncateOnWordBoundary('A short title', 40)).toBe('A short title');
  });

  it('cuts on a word boundary, never mid-word', () => {
    const out = truncateOnWordBoundary(LOREM, 60);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(60);

    const body = out.slice(0, -1);
    // Every word that survives must be a whole word from the source.
    const words = body.split(' ');
    const sourceWords = LOREM.split(' ');
    words.forEach((w, i) => expect(sourceWords[i]).toBe(w));
  });

  it('never exceeds the character budget', () => {
    for (const max of [5, 12, 30, 61, 120, 400]) {
      expect(truncateOnWordBoundary(LOREM, max).length).toBeLessThanOrEqual(max);
    }
  });

  it('does not leave dangling punctuation before the ellipsis', () => {
    expect(truncateOnWordBoundary('Alpha beta, gamma delta epsilon', 14)).toBe('Alpha beta…');
  });

  it('hard-cuts only when there is no boundary to land on', () => {
    expect(truncateOnWordBoundary('aaaaaaaaaaaaaaaaaaaa', 10)).toBe('aaaaaaaaa…');
  });
});

describe('fitLines', () => {
  it('clamps to maxLines and ellipsises the last one', () => {
    const ctx = measurer(10);
    const lines = fitLines(ctx, LOREM, 200, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    for (const line of lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(200);
    }
  });

  it('ends the clamped line on a word boundary', () => {
    const ctx = measurer(10);
    const [, second] = fitLines(ctx, LOREM, 200, 2);
    const tail = second.slice(0, -1);
    expect(LOREM.startsWith(fitLines(ctx, LOREM, 200, 2)[0])).toBe(true);
    expect(LOREM).toContain(tail);
  });

  it('returns everything when it already fits', () => {
    const lines = fitLines(measurer(10), 'Short enough', 1000, 3);
    expect(lines).toEqual(['Short enough']);
  });

  it('keeps a very long single word inside the box', () => {
    const ctx = measurer(10);
    const lines = fitLines(ctx, 'x'.repeat(400), 150, 2);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(150);
    }
  });

  it('returns nothing when given no room', () => {
    expect(fitLines(measurer(), LOREM, 200, 0)).toEqual([]);
  });
});

describe('card copy', () => {
  it('uses DISCLAIMER_CARD verbatim — the card must not invent its own wording', () => {
    expect(shareCardAlt(FINDING)).toContain(DISCLAIMER_CARD);
    // Guard the constant itself against being softened away entirely.
    expect(DISCLAIMER_CARD).toMatch(/correlation, not causation/i);
  });

  it('states the facts side by side without asserting cause', () => {
    const headline = buildHeadline(FINDING);
    expect(headline).toBe(
      '$187.4K of the $452.0K disclosed to Alexandra Q. Villanueva — a cosponsor of H.R. 1234 — came from donors this tool classifies as Electric utilities.',
    );
  });

  /**
   * A sector is not a legal person and cannot contribute to anything. Worse,
   * corporations are barred from contributing to federal candidates outright,
   * so "Electric utilities gave $187.4K to <named member>" — painted into a
   * shareable image — asserted a crime by two named parties. The money is the
   * subject of the sentence now and the sector is a classification of the
   * donors, which is what the data actually contains.
   */
  it('never makes a sector the giver', () => {
    const givingVerb = /\b(?:sector|industry|utilities|finance|pharma|[A-Z][a-z]+)\s+(?:gave|gives|donated|contributed|funded|paid)\b/;
    for (const f of [FINDING, { ...FINDING, totalDisclosed: null }, { ...FINDING, cycle: null }]) {
      expect(buildHeadline(f)).not.toMatch(givingVerb);
      expect(shareCardAlt(f)).not.toMatch(givingVerb);
    }
    expect(buildHeadline(FINDING)).toContain('came from donors this tool classifies as');
  });

  it('carries the denominator, so the share is checkable from the image alone', () => {
    // The council's finding: "$20K … 80%" invited the reader to work out a
    // total that appeared nowhere on the card.
    expect(buildHeadline(FINDING)).toContain('of the $452.0K disclosed to');
    // …and degrades to a shorter true sentence when the total is genuinely unknown.
    expect(buildHeadline({ ...FINDING, totalDisclosed: null })).toBe(
      '$187.4K disclosed to Alexandra Q. Villanueva — a cosponsor of H.R. 1234 — came from donors this tool classifies as Electric utilities.',
    );
  });

  it('names the role instead of the "listed on" euphemism', () => {
    expect(buildRoleClause('Sponsor')).toBe('the sponsor of');
    expect(buildRoleClause('Cosponsor')).toBe('a cosponsor of');
    expect(buildRoleClause('Committee member')).toBe('a member of a committee with jurisdiction over');
    expect(buildRoleClause('Cosponsor or committee member')).toBe('a cosponsor of, or on a committee handling,');
    // An unknown role falls back rather than guessing the worse-sounding option.
    expect(buildRoleClause(null)).toBe('listed on');
    expect(buildHeadline({ ...FINDING, role: null })).toContain('— listed on H.R. 1234 —');
  });

  it('states the denominator and the classification method under the score', () => {
    const [denominator, method] = buildScoreQualifiers(FINDING);
    expect(denominator).toContain('$452.0K disclosed to this member');
    expect(denominator).toContain('in the 2024 cycle');
    expect(denominator).toContain('not a share of all money raised');
    expect(method).toContain('machine classification');
    expect(method).toContain('Library of Congress metadata (no language model)');
  });

  it('still says the score rests on a classification when the method is unknown', () => {
    const [, method] = buildScoreQualifiers({ ...FINDING, classificationMethod: null });
    expect(method).toBe('Which sectors the bill affects is a machine classification, not a finding.');
  });

  it('puts all three qualifiers in the alt text as well as the pixels', () => {
    const alt = shareCardAlt(FINDING);
    expect(alt).toContain('a cosponsor of H.R. 1234');
    expect(alt).toContain('$452.0K');
    expect(alt).toContain('machine classification');
  });

  it('never uses a causal or accusatory verb', () => {
    const banned =
      /\b(bought|buys|buying|purchased|influenced|influence|bribe\w*|corrupt\w*|captured|bankrolled|paid for|in exchange|in return|quid pro quo|because of)\b/i;
    const findings: ShareCardFinding[] = [
      FINDING,
      { ...FINDING, topIndustryLabel: null, topIndustryAmount: null },
      { ...FINDING, topIndustryAmount: 0 },
      { ...FINDING, cycle: null },
    ];
    for (const f of findings) {
      expect(buildHeadline(f)).not.toMatch(banned);
      expect(buildSourceLine(f)).not.toMatch(banned);
      // The disclaimer itself says "not proof of influence"; that negation is
      // the point, so it is excluded before checking our own prose.
      expect(shareCardAlt(f).replace(DISCLAIMER_CARD, '')).not.toMatch(banned);
    }
  });

  it('falls back to the bare fact when there is no top sector', () => {
    expect(buildHeadline({ ...FINDING, topIndustryLabel: null, topIndustryAmount: null })).toBe(
      'Alexandra Q. Villanueva is a cosponsor of H.R. 1234.',
    );
  });

  it('labels the cycle when there is one and stays honest when there is not', () => {
    expect(buildSourceLine(FINDING)).toBe('Disclosed itemized FEC contributions, 2024 cycle');
    expect(buildSourceLine({ ...FINDING, cycle: null })).toBe('Disclosed itemized FEC contributions');
  });

  it('carries the score, its band and the disclaimer in the alt text', () => {
    const alt = shareCardAlt(FINDING);
    expect(alt).toContain('41 percent');
    expect(alt).toContain('Substantial overlap');
    expect(alt).toContain(FINDING.billTitle);
  });

  it('produces a filesystem-safe filename', () => {
    expect(shareCardFilename(FINDING)).toBe('follow-the-money-h-r-1234-alexandra-q-villanueva.png');
    expect(shareCardFilename({ ...FINDING, memberName: '', billLabel: '' })).toMatch(/^[a-z0-9.-]+\.png$/);
  });
});

describe('card geometry', () => {
  it('is a 1200×630 social box rendered at 2x', () => {
    expect([CARD_WIDTH, CARD_HEIGHT]).toEqual([1200, 630]);
    expect(CARD_SCALE).toBe(2);
  });

  it('watermarks a source location, never a hosted service or a scheme', () => {
    expect(PROJECT_REPO_URL).not.toMatch(/^https?:\/\//);
    expect(PROJECT_REPO_URL.trim()).not.toBe('');
  });
});

describe('the repo-URL publication gate', () => {
  /**
   * The old value was `github.com/OWNER/follow-the-money`: it looked like real
   * attribution, resolved to nothing, and was painted into every PNG. These
   * tests do not require the URL to be *set* — an unpublished checkout is a
   * legitimate state — only that when it is not set, the fact is detectable
   * rather than disguised as a working link.
   */
  it('never ships the OWNER placeholder again', () => {
    expect(PROJECT_REPO_URL).not.toMatch(/\bOWNER\b/);
  });

  it('flags an unset URL instead of silently watermarking a dead link', () => {
    expect(PROJECT_REPO_URL_IS_PLACEHOLDER).toBe(PROJECT_REPO_URL === PROJECT_REPO_URL_PLACEHOLDER);
    if (PROJECT_REPO_URL_IS_PLACEHOLDER) {
      // The watermark has to read as a placeholder to a human looking at the PNG.
      expect(PROJECT_REPO_URL).toMatch(/unpublished|not set/i);
    } else {
      expect(PROJECT_REPO_URL).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}\/\S+/i);
    }
  });
});
