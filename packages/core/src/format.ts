export function usd(n: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '$0';
  if (opts.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '0%';
  return `${(n * 100).toFixed(digits)}%`;
}

export function billLabel(billType: string, billNumber: string): string {
  const map: Record<string, string> = {
    hr: 'H.R.',
    s: 'S.',
    hjres: 'H.J.Res.',
    sjres: 'S.J.Res.',
    hconres: 'H.Con.Res.',
    sconres: 'S.Con.Res.',
    hres: 'H.Res.',
    sres: 'S.Res.',
  };
  return `${map[billType.toLowerCase()] ?? billType.toUpperCase()} ${billNumber}`;
}

export function shortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Truncate on a word boundary. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const i = cut.lastIndexOf(' ');
  return `${cut.slice(0, i > 40 ? i : max)}…`;
}

/** Neutral chamber/state/district line: "Rep. · TX-18" — never colour-coded. */
export function memberLine(chamber: string, state: string, district?: string): string {
  const title = chamber === 'Senate' ? 'Sen.' : 'Rep.';
  return district ? `${title} · ${state}-${district}` : `${title} · ${state}`;
}

/**
 * How a value was derived, in plain language.
 *
 * One map, because the same sentence has to appear in three places that cannot
 * import each other: the `<MethodTag/>` chip in the web UI, the share-card
 * renderer (which has no React in it), and any CLI or export that needs to say
 * where a tag came from. A card that shows a classification-derived percentage
 * without saying how the classification was made is asking the reader to trust
 * the number more than the method deserves.
 */
export const CLASSIFICATION_METHOD_LABEL: Record<string, string> = {
  llm: 'Classified by a language model',
  'keyword-fallback': 'Classified from Library of Congress metadata (no language model)',
  keyword: 'Matched by keyword',
  'committee-type': 'From the FEC committee record',
  naics: 'From the NAICS industry code',
  placeholder: 'No employer on file',
  unassigned: 'Not attributed',
};

/** The label for a method, falling back to the raw key so nothing renders blank. */
export function classificationMethodLabel(method?: string | null): string | null {
  if (!method) return null;
  return CLASSIFICATION_METHOD_LABEL[method] ?? method;
}
