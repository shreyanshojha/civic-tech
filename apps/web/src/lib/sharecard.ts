/**
 * The share-card renderer.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS LOAD-BEARING. Read before changing.
 *
 * A share card is the one artefact of this project that travels *without* the
 * site around it. Someone screenshots a finding, drops it in a group chat, and
 * every piece of framing the app so carefully keeps on screen is gone. So the
 * framing has to be inside the pixels:
 *
 *   1. DISCLAIMER_CARD is painted into the image itself, in a reserved band at
 *      the foot of the card, at a size you can actually read (21px at 1200×630)
 *      and at full ink contrast. It is laid out first, and everything else is
 *      fitted into the space that is left over — so it can never be pushed off
 *      the canvas by a long name or a long bill title.
 *   2. The wording comes from @ftm/core. Nothing here writes its own sentence.
 *   3. The headline states two disclosed facts next to each other and stops.
 *      "$X of the $Y disclosed to <member> — a cosponsor of <bill> — came from
 *      donors this tool classifies as <sector>." Never "bought", "influenced",
 *      "in exchange for", and never a sector as the subject of a verb of
 *      giving. See buildHeadline().
 *   4. The score is drawn on the same single-hue ink ramp the app uses. No red,
 *      no green, no party colour. A high score is not a verdict.
 *   5. THE THREE QUALIFIERS TRAVEL WITH THE NUMBER. A user council read a real
 *      card and found that the disclaimer survived the trip but the three facts
 *      that actually neutralise the percentage did not:
 *
 *        (a) the member's ROLE on the bill. The old copy said "who is listed
 *            on", which implies the member was found on a list. Every one of
 *            them is a sponsor, a cosponsor, or a member of a committee with
 *            jurisdiction, and saying which is both more accurate and less
 *            insinuating.
 *        (b) the DENOMINATOR. "$20K … 80%" invites the reader to work out a
 *            $25,000 total that is nowhere on the card. The total disclosed is
 *            now in the headline, so the share is checkable from the image.
 *        (c) the CLASSIFICATION METHOD. The percentage depends on a machine
 *            guess about what the bill affects. A card that shows the number at
 *            the same epistemic weight as the dollar figure — which is a hard
 *            fact from a filing — is overstating it.
 *
 *      All three are laid out inside the reserved space, above the disclaimer
 *      band, so none of them can be crowded off by a long name or title.
 *
 * Everything here is pure drawing against a 2D context. No React, no network,
 * no fonts or images fetched, no third-party library — the card is composed
 * from system fonts on an offscreen canvas in the reader's own browser, so
 * generating one tells nobody, including us, that it happened.
 * ---------------------------------------------------------------------------
 */

import {
  DISCLAIMER_CARD,
  OVERLAP_BAND_LABEL,
  PROJECT_NAME,
  PROJECT_REPO_URL,
  classificationMethodLabel,
  overlapBand,
  usd,
} from '@ftm/core';

/**
 * The finding a card is made from. This is the public contract of
 * <ShareCardButton/> and is consumed as-is by BillDetail and RepDetail.
 *
 * `role`, `totalDisclosed` and `classificationMethod` are the three qualifiers
 * described in point 5 of the header comment. They are optional in the type
 * only so that a caller that genuinely does not know one (an older bundle with
 * no donor profile, say) degrades to a shorter, still-true sentence rather than
 * printing "undefined" — never so that a call site can skip passing them.
 */
export interface ShareCardFinding {
  memberName: string;
  memberSubtitle: string; // e.g. "Rep. TX-18"
  billLabel: string; // e.g. "H.R. 1234"
  billTitle: string;
  topIndustryLabel: string | null;
  topIndustryAmount: number | null;
  score: number; // 0..1
  cycle: number | null;
  /** "Sponsor" | "Cosponsor" | "Committee member" — as the bill record records it. */
  role?: string | null;
  /** The member's total disclosed for the cycle: the denominator the score is a share of. */
  totalDisclosed?: number | null;
  /** How the bill's sector tags were derived — 'llm', 'keyword-fallback', … */
  classificationMethod?: string | null;
  /** True when the measure is a tribute, memorial, naming or procedural item. */
  isCeremonial?: boolean;
  /** Confidence of the sector tag that drives the score, when there is only one. */
  topIndustryConfidence?: number | null;
}

/**
 * Whether a finding is strong enough to be turned into a redistributable image.
 *
 * ---------------------------------------------------------------------------
 * WHY A GATE EXISTS AT ALL
 *
 * A review of this tool by a congressional chief of staff generated this card
 * from a real page:
 *
 *   "Lawyers & Lobbyists gave $43.3K of the $2.9M disclosed to [Member],
 *    a cosponsor of H.Res. 1252"
 *   — a resolution memorialising law enforcement officers killed in the line
 *     of duty. Overlap score: 1%.
 *
 * The resolution passed by voice vote with 123 cosponsors. The sector tag came
 * from a keyword match. The score was 1%. And the tool offered a one-click
 * button to publish it as an image.
 *
 * Everything on the site can be careful; the card is the part that leaves and
 * travels without any of it. So the card is not offered at all when the finding
 * underneath it is too weak to survive being seen alone. Refusing to make an
 * image is always available and always safe; an image, once made, is not
 * retractable.
 * ---------------------------------------------------------------------------
 */
export const SHARE_MIN_SCORE = 0.1;
export const SHARE_MIN_SINGLE_TAG_CONFIDENCE = 0.6;

export interface ShareEligibility {
  eligible: boolean;
  /** Shown to the reader in place of the button. Plain language, no blame. */
  reason: string | null;
}

export function shareEligibility(finding: ShareCardFinding): ShareEligibility {
  if (finding.isCeremonial) {
    return {
      eligible: false,
      reason:
        'No image for this one. This is a tribute or procedural measure, and putting a donor figure next to it would imply a connection that is not there.',
    };
  }
  if (!Number.isFinite(finding.score) || finding.score < SHARE_MIN_SCORE) {
    return {
      eligible: false,
      reason:
        `No image for this one. The overlap is under ${Math.round(SHARE_MIN_SCORE * 100)}%, which is too small to mean anything once the picture is separated from this page.`,
    };
  }
  if (
    finding.classificationMethod === 'keyword-fallback' &&
    typeof finding.topIndustryConfidence === 'number' &&
    finding.topIndustryConfidence < SHARE_MIN_SINGLE_TAG_CONFIDENCE
  ) {
    return {
      eligible: false,
      reason:
        'No image for this one. The industry tag behind this number came from word matching rather than a reading of the bill, and it is not confident enough to travel on its own.',
    };
  }
  return { eligible: true, reason: null };
}

/** Logical card size. Chosen to match the 1.91:1 box every social preview crops to. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
/** Backing-store multiplier. The PNG is 2400×1260 so text stays crisp when rescaled. */
export const CARD_SCALE = 2;

/**
 * Palette, mirrored from the light half of styles.css.
 *
 * Deliberately not read from CSS custom properties: the card is a file that
 * outlives the tab it was made in, so it must not change appearance based on
 * the generating reader's colour scheme. Same input, same pixels, always.
 */
const INK_0 = '#0c0d0e';
const INK_1 = '#1c1f22';
const INK_2 = '#3a4046';
const INK_3 = '#5c646c';
const INK_4 = '#868f98';
const INK_5 = '#b6bec5';
const INK_6 = '#dde1e5';
const INK_7 = '#eef0f2';
const PAPER = '#fbfbfa';
const ACCENT = '#1f5f5b';

/** System stacks only — nothing is fetched to draw a card. */
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, Cambria, "Times New Roman", ui-serif, serif';
const MONO = 'ui-monospace, Menlo, Consolas, "Courier New", monospace';

/** The ink ramp used for overlap magnitude. Mirrors .ramp-0…3 — one hue, never red/green. */
const BAND_INK: Record<ReturnType<typeof overlapBand>, string> = {
  minimal: INK_5,
  some: INK_4,
  substantial: INK_3,
  high: INK_1,
};

const PAD = 64;
const INNER = CARD_WIDTH - PAD * 2;

/** The only thing a text-measuring helper needs. Lets the helpers be unit-tested without a DOM. */
export interface TextMeasurer {
  measureText(text: string): { width: number };
}

/* -------------------------------------------------------------------------- */
/* Text fitting                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Greedy word wrap against the context's *current* font.
 *
 * Set ctx.font before calling. The guarantee callers rely on is that no
 * returned line measures wider than maxWidth — a word longer than the whole
 * line is broken by character rather than allowed to bleed off the canvas.
 * (A single character wider than maxWidth is emitted alone; there is nothing
 * else to do, and it cannot happen at the sizes this card uses.)
 */
export function wrapText(ctx: TextMeasurer, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = String(text ?? '').split('\n');

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = '';
      }
      // The word alone may still be too wide (a URL, an unspaced string).
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
      } else {
        const pieces = breakWord(ctx, word, maxWidth);
        lines.push(...pieces.slice(0, -1));
        line = pieces[pieces.length - 1] ?? '';
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

/** Hard-breaks a single over-long word so that no fragment exceeds maxWidth. */
function breakWord(ctx: TextMeasurer, word: string, maxWidth: number): string[] {
  const out: string[] = [];
  let piece = '';
  for (const ch of word) {
    const candidate = piece + ch;
    if (piece && ctx.measureText(candidate).width > maxWidth) {
      out.push(piece);
      piece = ch;
    } else {
      piece = candidate;
    }
  }
  if (piece) out.push(piece);
  return out.length > 0 ? out : [''];
}

/**
 * Truncate on a word boundary. Never mid-word, never longer than maxChars.
 *
 * The only case that cuts inside a word is a single "word" longer than the
 * whole budget, where there is no boundary to land on.
 */
export function truncateOnWordBoundary(text: string, maxChars: number): string {
  const s = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (maxChars <= 1) return s.length <= maxChars ? s : '…';
  if (s.length <= maxChars) return s;

  const budget = maxChars - 1; // one char reserved for the ellipsis
  const boundary = s.slice(0, budget + 1).lastIndexOf(' ');
  const head = boundary > 0 ? s.slice(0, boundary) : s.slice(0, budget);
  return `${trimTrailingPunctuation(head)}…`;
}

function trimTrailingPunctuation(s: string): string {
  return s.replace(/[\s,;:.\-–—]+$/, '');
}

/**
 * Wrap to at most maxLines, ellipsising the last line on a word boundary.
 *
 * This is what keeps a 300-character bill title from running off the bottom of
 * the card: it is clipped in the text layer, so the drawing layer never has to
 * think about overflow.
 */
export function fitLines(
  ctx: TextMeasurer,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const all = wrapText(ctx, text, maxWidth);
  if (maxLines <= 0) return [];
  if (all.length <= maxLines) return all;

  const kept = all.slice(0, maxLines);
  const last = kept[maxLines - 1];
  const words = last.split(' ');

  // Drop whole words off the end until the line plus its ellipsis fits.
  let candidate = `${trimTrailingPunctuation(last)}…`;
  while (words.length > 1 && ctx.measureText(candidate).width > maxWidth) {
    words.pop();
    candidate = `${trimTrailingPunctuation(words.join(' '))}…`;
  }
  if (ctx.measureText(candidate).width > maxWidth) {
    // Single unbreakable word: fall back to a character break, still bounded.
    const pieces = breakWord(ctx, `${last}…`, maxWidth);
    candidate = pieces[0];
  }
  kept[maxLines - 1] = candidate;
  return kept;
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The member's relationship to the bill, as a clause the headline can use.
 *
 * "who is listed on" was the old wording for every case. It is a euphemism that
 * reads worse than the truth: it implies the member turned up on some list,
 * when in fact the bill record says exactly what they are. Where the role is
 * genuinely unknown we fall back to the vaguer phrasing rather than guessing —
 * an unknown role is a gap in the bundle, not licence to pick the worst-sounding
 * option.
 */
export function buildRoleClause(role?: string | null): string {
  const r = String(role ?? '').trim().toLowerCase();
  if (r === 'sponsor') return 'the sponsor of';
  if (r === 'cosponsor') return 'a cosponsor of';
  if (r === 'committee member') return 'a member of a committee with jurisdiction over';
  // The member-page bundle records the sponsor but not which of the other two a
  // member is, so that call site passes the honest disjunction rather than
  // picking one. Kept as an explicit branch so it reads as a deliberate choice.
  if (r === 'cosponsor or committee member') return 'a cosponsor of, or on a committee handling,';
  if (r) return `${/^[aeiou]/.test(r) ? 'an' : 'a'} ${r} on`;
  return 'listed on';
}

/**
 * The headline. Disclosed facts, adjacent, with no verb joining them that a
 * reader could mistake for a claim about cause — and no verb that assigns the
 * act of giving to something that cannot give.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SUBJECT OF THIS SENTENCE CHANGED
 *
 * It used to read "Electric utilities gave $187.4K of the $452.0K disclosed to
 * X". Grammatically the sector is the one doing the giving, and the sector did
 * not give anything. What is in the data is (a) contributions from political
 * action committees, which are real entities that really contributed, and (b)
 * contributions from individuals, bucketed by whatever employer each of them
 * typed on their own filing. Corporations may not contribute to federal
 * candidates at all — so "Electric utilities gave" states, on a shareable
 * image, that a felony occurred.
 *
 * The money is the subject now, and the sector is where this tool put the
 * donors. Same two facts, same denominator, no invented actor.
 * ---------------------------------------------------------------------------
 *
 * Not allowed anywhere in this project: "bought", "paid for", "influenced",
 * "in exchange for", "in return for", "bankrolled". If you are tempted to add
 * one, the answer is no — see DISCLAIMER_LONG.
 *
 * The denominator is in the sentence, not implied by it: "$20K of the $25.1K
 * disclosed to X" is checkable from the image alone, whereas "$20K … 80%" asks
 * the reader to reverse-engineer a total they were never shown.
 */
export function buildHeadline(finding: ShareCardFinding): string {
  const { topIndustryLabel, topIndustryAmount, memberName, billLabel, totalDisclosed } = finding;
  const member = truncateOnWordBoundary(memberName, 60);
  const roleClause = buildRoleClause(finding.role);

  if (topIndustryLabel && typeof topIndustryAmount === 'number' && topIndustryAmount > 0) {
    const amount = usd(topIndustryAmount, { compact: true });
    const denominator =
      typeof totalDisclosed === 'number' && totalDisclosed > 0
        ? `${amount} of the ${usd(totalDisclosed, { compact: true })} disclosed to`
        : `${amount} disclosed to`;
    return `${denominator} ${member} — ${roleClause} ${billLabel} — came from donors this tool classifies as ${topIndustryLabel}.`;
  }
  return `${member} is ${roleClause} ${billLabel}.`;
}

/** The provenance line under the header rule. States what the numbers are, and are not. */
export function buildSourceLine(finding: ShareCardFinding): string {
  return finding.cycle
    ? `Disclosed itemized FEC contributions, ${finding.cycle} cycle`
    : 'Disclosed itemized FEC contributions';
}

/**
 * The two qualifier lines drawn under the score bar.
 *
 * Line 1 names the denominator again, in the score's own terms, so the number
 * above the bar cannot be read as a share of "all money" or of anything else.
 * Line 2 says where the classification the score depends on came from. Both are
 * returned as plain strings so the drawing layer can wrap them, and so a test
 * can assert their content without a canvas.
 */
export function buildScoreQualifiers(finding: ShareCardFinding): string[] {
  const lines: string[] = [];

  const denominator =
    typeof finding.totalDisclosed === 'number' && finding.totalDisclosed > 0
      ? `the ${usd(finding.totalDisclosed, { compact: true })} disclosed to this member${finding.cycle ? ` in the ${finding.cycle} cycle` : ''}`
      : 'this member’s disclosed money';
  lines.push(
    `A weighted share of ${denominator} that came from sectors this bill would affect — not a share of all money raised.`,
  );

  const method = classificationMethodLabel(finding.classificationMethod);
  lines.push(
    method
      ? `Which sectors the bill affects is a machine classification, not a finding: ${lowerFirst(method)}.`
      : 'Which sectors the bill affects is a machine classification, not a finding.',
  );

  return lines;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Alt text for the on-screen preview. Carries the same facts as the pixels. */
export function shareCardAlt(finding: ShareCardFinding): string {
  const band = OVERLAP_BAND_LABEL[overlapBand(finding.score)];
  const title = finding.billTitle.trim().replace(/[.\s]+$/, '');
  return [
    `Share card. ${buildHeadline(finding)}`,
    `Bill title: ${title}.`,
    `Overlap score ${Math.round(finding.score * 100)} percent — ${band}.`,
    ...buildScoreQualifiers(finding),
    DISCLAIMER_CARD,
  ].join(' ');
}

/** A filename that says what the image is without needing to be opened. */
export function shareCardFilename(finding: ShareCardFinding): string {
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'finding';
  return `follow-the-money-${slug(finding.billLabel)}-${slug(finding.memberName)}.png`;
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                     */
/* -------------------------------------------------------------------------- */

type Ctx = CanvasRenderingContext2D;

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** Letter-spaced small caps label, matching the .label token. Drawn by hand so we
 *  do not depend on ctx.letterSpacing, which is not universally available. */
function drawTracked(ctx: Ctx, text: string, x: number, y: number, tracking: number): void {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
}

function drawLines(ctx: Ctx, lines: string[], x: number, firstBaseline: number, lineHeight: number): number {
  let y = firstBaseline;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y - lineHeight;
}

/**
 * Paint one card onto a 2D context already scaled to logical units.
 *
 * Layout is computed bottom-up: the disclaimer band claims its space first and
 * the editorial content is fitted into what remains. That ordering is the whole
 * point — no input can crowd the framing out of the image.
 */
export function drawShareCard(ctx: Ctx, finding: ShareCardFinding): void {
  const band = overlapBand(finding.score);
  const pct = Math.round(Math.max(0, Math.min(1, finding.score)) * 100);

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // --- paper -------------------------------------------------------------
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // One restrained accent rule. No gradient, no shadow: the data carries the page.
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, CARD_WIDTH, 6);

  // --- the disclaimer band, laid out FIRST --------------------------------
  const DISCLAIMER_SIZE = 21; // legible at full size and still readable in a timeline crop
  const DISCLAIMER_LEADING = 28;
  ctx.font = `${DISCLAIMER_SIZE}px ${SANS}`;
  const disclaimerLines = wrapText(ctx, DISCLAIMER_CARD, INNER);

  const footerHeight = 22 + disclaimerLines.length * DISCLAIMER_LEADING + 14 + 20 + 18;
  const footerTop = CARD_HEIGHT - footerHeight;

  ctx.fillStyle = INK_7;
  ctx.fillRect(0, footerTop, CARD_WIDTH, footerHeight);
  ctx.fillStyle = INK_6;
  ctx.fillRect(0, footerTop, CARD_WIDTH, 1);

  // Full ink contrast: this is the sentence that has to survive being screenshotted.
  ctx.fillStyle = INK_1;
  ctx.font = `${DISCLAIMER_SIZE}px ${SANS}`;
  const disclaimerBottom = drawLines(ctx, disclaimerLines, PAD, footerTop + 22 + DISCLAIMER_SIZE - 5, DISCLAIMER_LEADING);

  // Watermark: the source repo, never a hosted domain — anyone can rebuild this.
  const watermarkBaseline = disclaimerBottom + 32;
  ctx.font = `17px ${MONO}`;
  ctx.fillStyle = INK_3;
  ctx.fillText(PROJECT_REPO_URL, PAD, watermarkBaseline);
  ctx.textAlign = 'right';
  ctx.font = `17px ${SANS}`;
  ctx.fillStyle = INK_4;
  ctx.fillText('Sources: FEC · Congress.gov', CARD_WIDTH - PAD, watermarkBaseline);
  ctx.textAlign = 'left';

  // --- header -------------------------------------------------------------
  ctx.font = `600 24px ${SANS}`;
  ctx.fillStyle = INK_1;
  ctx.fillText(PROJECT_NAME, PAD, 68);

  ctx.textAlign = 'right';
  ctx.font = `18px ${SANS}`;
  ctx.fillStyle = INK_4;
  ctx.fillText(buildSourceLine(finding), CARD_WIDTH - PAD, 68);
  ctx.textAlign = 'left';

  ctx.fillStyle = INK_6;
  ctx.fillRect(PAD, 90, INNER, 1);

  // --- fit the editorial block into the space that is left ----------------
  //
  // Measured before anything below it is drawn, so the score block can be
  // nudged up to close a gap on a short finding without ever being allowed to
  // move down into the disclaimer band.
  const HEADLINE_SIZE = 40;
  const HEADLINE_LEADING = 46;
  const TITLE_LEADING = 32;
  const BAR_HEIGHT = 14;
  const QUALIFIER_SIZE = 16;
  const QUALIFIER_LEADING = 22;
  const contentTop = 104;

  // The two qualifier lines (denominator + classification method) claim their
  // space before the bar is positioned, for the same reason the disclaimer band
  // does: they are the sentences that stop the percentage above them being
  // over-read, so they must not be the thing that gets squeezed out.
  ctx.font = `${QUALIFIER_SIZE}px ${SANS}`;
  // Two sentences, up to two lines each. The cap is 4 rather than 3 because at
  // 16px over 1072px the denominator sentence routinely takes two lines on its
  // own, and clipping the *second* sentence would silently drop the
  // classification caveat — which is the one a reader is least likely to supply
  // for themselves.
  const qualifierLines = buildScoreQualifiers(finding)
    .flatMap((line) => fitLines(ctx, line, INNER, 2))
    .slice(0, 4);
  const qualifierBlockHeight = 12 + qualifierLines.length * QUALIFIER_LEADING;

  // Lowest the bar may ever sit: everything under it has to fit above the band.
  const floorBarY = footerTop - (BAR_HEIGHT + qualifierBlockHeight + 16);
  const contentBottom = floorBarY - 74 - 22;

  ctx.font = `19px ${SANS}`;
  const titleLines = fitLines(ctx, `“${finding.billTitle}”`, INNER, 2);
  const metaHeight = titleLines.length * TITLE_LEADING + 28;

  const headlineRoom = contentBottom - contentTop - metaHeight;
  const headlineMaxLines = Math.max(1, Math.min(3, Math.floor(headlineRoom / HEADLINE_LEADING)));

  ctx.font = `600 ${HEADLINE_SIZE}px ${SERIF}`;
  const headlineLines = fitLines(ctx, buildHeadline(finding), INNER, headlineMaxLines);

  const headlineBottom = contentTop + HEADLINE_SIZE - 4 + (headlineLines.length - 1) * HEADLINE_LEADING;
  const titleBottom = headlineBottom + 40 + (titleLines.length - 1) * TITLE_LEADING;
  const subtitleBaseline = titleBottom + 30;

  // Split any leftover room between the two blocks rather than dumping it all
  // in the middle of the card.
  const slack = Math.max(0, contentBottom - subtitleBaseline);
  const barY = floorBarY - Math.min(Math.round(slack * 0.55), 72);
  const labelBaseline = barY - 74;

  // --- score block ---------------------------------------------------------
  ctx.font = `600 14px ${SANS}`;
  ctx.fillStyle = INK_4;
  drawTracked(ctx, 'OVERLAP SCORE', PAD, labelBaseline, 1.2);

  ctx.font = `600 52px ${SANS}`;
  ctx.fillStyle = INK_0;
  const numberBaseline = barY - 22;
  const numberText = `${pct}%`;
  ctx.fillText(numberText, PAD, numberBaseline);
  const numberWidth = ctx.measureText(numberText).width;

  ctx.font = `22px ${SANS}`;
  ctx.fillStyle = INK_3;
  ctx.fillText(OVERLAP_BAND_LABEL[band], PAD + numberWidth + 16, numberBaseline);

  // Track plus fill, single hue. Magnitude reads as more/less, never good/bad.
  ctx.fillStyle = INK_7;
  roundedRect(ctx, PAD, barY, INNER, BAR_HEIGHT, BAR_HEIGHT / 2);
  ctx.fill();
  ctx.strokeStyle = INK_6;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = BAND_INK[band];
  roundedRect(ctx, PAD, barY, Math.max(BAR_HEIGHT, (INNER * pct) / 100), BAR_HEIGHT, BAR_HEIGHT / 2);
  ctx.fill();

  ctx.font = `${QUALIFIER_SIZE}px ${SANS}`;
  ctx.fillStyle = INK_3; // one step darker than the old INK_4: these have to be read
  drawLines(ctx, qualifierLines, PAD, barY + BAR_HEIGHT + 12 + QUALIFIER_SIZE - 4, QUALIFIER_LEADING);

  // --- editorial block ----------------------------------------------------
  ctx.font = `600 ${HEADLINE_SIZE}px ${SERIF}`;
  ctx.fillStyle = INK_0;
  drawLines(ctx, headlineLines, PAD, contentTop + HEADLINE_SIZE - 4, HEADLINE_LEADING);

  ctx.font = `19px ${SANS}`;
  ctx.fillStyle = INK_2;
  drawLines(ctx, titleLines, PAD, headlineBottom + 40, TITLE_LEADING);

  // Seat · bill · role. The role is repeated here in its bare form because the
  // headline's version is a clause inside a sentence, and a reader skimming the
  // metadata line should not have to parse prose to find it.
  ctx.font = `18px ${SANS}`;
  ctx.fillStyle = INK_4;
  const roleTag = String(finding.role ?? '').trim();
  ctx.fillText(
    [truncateOnWordBoundary(finding.memberSubtitle, 48), finding.billLabel, roleTag]
      .filter(Boolean)
      .join(' · '),
    PAD,
    subtitleBaseline,
  );

  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* Canvas plumbing — all of it client-side                                     */
/* -------------------------------------------------------------------------- */

/**
 * Render a finding to a detached canvas at CARD_SCALE device pixels.
 *
 * Nothing here touches the network or the document tree: the canvas is never
 * appended anywhere unless a caller chooses to.
 */
export function renderShareCard(finding: ShareCardFinding, doc: Document = document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas');
  canvas.width = CARD_WIDTH * CARD_SCALE;
  canvas.height = CARD_HEIGHT * CARD_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser would not give us a 2D canvas, so the card cannot be drawn.');
  ctx.scale(CARD_SCALE, CARD_SCALE);
  drawShareCard(ctx, finding);
  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode the card as a PNG.'))),
      'image/png',
    );
  });
}

/** Save a blob to disk via an object URL. No upload, no round-trip, no service. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the click a tick to be handled before the URL stops resolving.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** True when this browser can put an image on the clipboard. Callers degrade, never break. */
export function canCopyImages(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'
  );
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  if (!canCopyImages()) throw new Error('This browser cannot copy images to the clipboard.');
  const blob = await canvasToPngBlob(canvas);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
