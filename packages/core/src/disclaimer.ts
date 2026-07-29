/**
 * SINGLE SOURCE OF TRUTH for the framing language of this project.
 *
 * Every surface — web UI, mobile UI, generated share cards, CLI output, LLM
 * prompts, exported JSON — imports its disclaimer text from this file. Nothing
 * hard-codes its own wording. If you are adding a new view or a new generated
 * artifact, import from here rather than writing your own sentence.
 *
 * The project's core claim is narrow on purpose:
 *
 *   "Money was disclosed. A vote happened. Here are both, side by side."
 *
 * It is NOT: "this money caused this vote."
 *
 * There is a test (disclaimer.test.ts) and a repo audit script that will fail
 * if these constants are removed or if a view stops rendering them.
 */

/** The one-line version. Used in banners, footers, and on share cards. */
export const DISCLAIMER_SHORT =
  'Correlation, not causation. This shows a pattern in public records — not proof that money influenced any vote.';

/** The medium version. Used on detail pages, above any computed score. */
export const DISCLAIMER_MEDIUM =
  'This tool places two public records next to each other: who donated to a member of Congress, and what that member legislated on. Any overlap you see is a correlation, not causation. It is not evidence of a quid pro quo, of influence, or of wrongdoing. Legislators routinely receive support from industries in their district for the same reason they legislate on them: those industries are there.';

/** The full version. Used in the About page, the README, and LIMITATIONS.md. */
export const DISCLAIMER_LONG = [
  'Follow the Money shows correlations between publicly disclosed campaign contributions and legislative activity. It does not, and cannot, show causation.',
  'A high overlap score means only this: an industry that gave money to a legislator also has a stake in a bill that legislator worked on. That is an extremely common situation with entirely ordinary explanations. Members of Congress seek committee assignments relevant to their districts. Industries concentrated in a district donate to that district\'s representative. Constituent interest, party position, ideology, personal conviction, and the substance of the bill itself are all far more likely explanations for any given vote than a contribution.',
  'This tool also sees only part of the money. It covers only disclosed "hard money" reported to the Federal Election Commission — and, depending on how the dataset was built, possibly only the committee-to-candidate half of that. It does not see 501(c)(4) spending, most dark money, unreported coordination, lobbying expenditure, bundling, or the revolving door. Independent expenditures are excluded deliberately, because money an outside group spends for or against a candidate is not a contribution the campaign received. Every page states which of these apply to the dataset in front of you.',
  'Treat anything you find here as a question worth asking, never as an answer. If something looks significant, the next step is a journalist, a primary source, or a FOIA request — not a screenshot.',
].join('\n\n');

/** The line printed on every generated share card image. Must fit on one or two lines. */
export const DISCLAIMER_CARD =
  'Correlation, not causation. Public records shown side by side — not proof of influence or wrongdoing.';

/** Attached to every LLM-generated text so the model output itself carries the framing. */
export const DISCLAIMER_LLM_SUFFIX =
  'This summary is machine-generated from the public bill text and may be incomplete or wrong. Read the bill.';

/**
 * Injected into every LLM system prompt in this project. Keeps generated text
 * from drifting into causal or accusatory language.
 */
export const LLM_FRAMING_RULES = [
  'You are assisting a nonpartisan civic-data tool that displays public records side by side.',
  'Hard rules for everything you write:',
  '1. Never assert or imply that a campaign contribution caused, influenced, or was exchanged for any legislative action.',
  '2. Never characterise a legislator, party, industry, or bill as good, bad, corrupt, captured, or bought.',
  '3. Never use partisan framing. Do not mention party affiliation unless it is part of a neutral factual field you were given.',
  '4. Use plain, calm, factual language. Paraphrase source text in your own words; never reproduce long verbatim passages.',
  '5. If the source material is insufficient, say so plainly rather than speculating.',
].join('\n');

/** How to read an overlap score, in plain language. Shown next to every score. */
export const SCORE_EXPLAINER = {
  what: 'The overlap score compares two lists: the industries that gave the most disclosed money to this member, and the industries this bill is most likely to affect. A higher number means the two lists share more of the same industries, weighted by how much money and how confident the bill classification is.',
  whatItIsNot:
    'The score says nothing about how the member voted, whether the bill is good or bad, or whether the money mattered. A representative from a farming district will score high on an agriculture bill. That is what representation looks like, not what corruption looks like.',
  howToUse:
    'Use it to decide what is worth a closer look. Then read the bill, read the member\'s stated reasoning, and check the primary filings — all of which are linked from this page.',
} as const;

/** Bands used for describing (never colour-coding as good/bad) a score. */
export type OverlapBand = 'minimal' | 'some' | 'substantial' | 'high';

export function overlapBand(score: number): OverlapBand {
  if (score < 0.15) return 'minimal';
  if (score < 0.35) return 'some';
  if (score < 0.6) return 'substantial';
  return 'high';
}

export const OVERLAP_BAND_LABEL: Record<OverlapBand, string> = {
  minimal: 'Minimal overlap',
  some: 'Some overlap',
  substantial: 'Substantial overlap',
  high: 'High overlap',
};

export const OVERLAP_BAND_NOTE: Record<OverlapBand, string> = {
  minimal:
    'Few or none of this member\'s top disclosed donor industries have an obvious stake in this bill.',
  some: 'A small share of this member\'s top disclosed donor industries overlap with the industries this bill is likely to affect.',
  substantial:
    'A meaningful share of this member\'s top disclosed donor industries overlap with the industries this bill is likely to affect. This is common and expected for members on relevant committees.',
  high: 'Most of this member\'s top disclosed donor industries overlap with the industries this bill is likely to affect. Common for specialist committee members; worth reading the bill and the member\'s stated position.',
};

/**
 * Repo URL stamped onto share cards. Points at source, not a hosted service.
 *
 * ---------------------------------------------------------------------------
 * THIS IS A PLACEHOLDER AND MUST BE SET BEFORE PUBLISHING.
 *
 * The previous value was `github.com/OWNER/follow-the-money`, which looks like a
 * real attribution and resolves to nothing. It was painted into every generated
 * share card, so every image this project has ever produced carried a dead link
 * back to the caveats — the one thing a card recipient needs.
 *
 * A card that says "no source URL set" is honest. A card that links to a 404 is
 * not. So the placeholder now says what it is, in the pixels, and three things
 * make sure it cannot be published by accident:
 *
 *   1. PROJECT_REPO_URL_IS_PLACEHOLDER below, which the UI reads to warn the
 *      reader (see components/ShareCard.tsx) and to suppress a broken hyperlink
 *      (see pages/About.tsx);
 *   2. `node scripts/audit-repo.mjs`, which FAILS while the placeholder stands;
 *   3. CONTRIBUTING.md, which lists this as a pre-publication step.
 *
 * To publish: replace PROJECT_REPO_URL with the real host-and-path (no scheme,
 * e.g. `github.com/yourname/follow-the-money`). Nothing else needs changing —
 * the boolean, the audit and the warning all switch off on their own.
 * ---------------------------------------------------------------------------
 */
export const PROJECT_REPO_URL_PLACEHOLDER = 'unpublished build — PROJECT_REPO_URL not set';

export const PROJECT_REPO_URL: string = PROJECT_REPO_URL_PLACEHOLDER;

/**
 * True while PROJECT_REPO_URL is not a real, resolvable repository path.
 *
 * Deliberately broader than an equality check: `OWNER`, an empty string and
 * `example.com` are the three other ways this constant has historically been
 * left unset, and each of them produces the same dead link on a card.
 */
export const PROJECT_REPO_URL_IS_PLACEHOLDER: boolean =
  PROJECT_REPO_URL.trim() === '' ||
  PROJECT_REPO_URL === PROJECT_REPO_URL_PLACEHOLDER ||
  /\bOWNER\b/.test(PROJECT_REPO_URL) ||
  /\bexample\.(com|org|net)\b/i.test(PROJECT_REPO_URL);

/** Shown wherever the placeholder is surfaced to a human. One sentence, no jargon. */
export const PROJECT_REPO_URL_WARNING =
  'This build has no public source URL: set PROJECT_REPO_URL before publishing, or the image cannot link anyone back to the method and the caveats.';

export const PROJECT_NAME = 'Follow the Money';
export const PROJECT_TAGLINE = 'Public money records and public legislative records, side by side.';
