/**
 * The jargon this site cannot avoid, and what each word means.
 *
 * ---------------------------------------------------------------------------
 * The rule: a term of art gets glossed the first time it appears on a page, in
 * one tap, in the reader's flow. Not in a separate glossary page nobody visits,
 * and not in a `title=` tooltip, which does not exist on a phone.
 *
 * These are definitions of words used by Congress and the FEC, not framing
 * language. The framing language — every sentence about what this site does and
 * does not claim — lives in packages/core/src/disclaimer.ts and nowhere else,
 * and nothing here restates or softens it.
 *
 * Each definition must be: one or two short sentences, no word in it that would
 * itself need a gloss, and true. If a plain wording would make a term sound
 * more (or less) significant than it is, the longer wording wins.
 * ---------------------------------------------------------------------------
 */

export interface GlossaryEntry {
  /** How it is shown when the component is not given its own children. */
  label: string;
  /** Plain-language definition. One or two short sentences. */
  def: string;
}

export const GLOSSARY = {
  cosponsor: {
    label: 'cosponsor',
    def: 'A member who signs on to a bill someone else wrote, to show support. Cosponsoring is not a vote.',
  },
  sponsor: {
    label: 'sponsor',
    def: 'The member who introduced the bill. One bill has one sponsor.',
  },
  committee: {
    label: 'committee of jurisdiction',
    def: 'The group of members that handles this subject. A bill goes to them first, and most bills stop there.',
  },
  itemized: {
    label: 'itemized',
    def: 'Money big enough that the law makes the campaign name who it came from. Smaller gifts are reported as a lump sum, so this tool cannot see them.',
  },
  pac: {
    label: 'PAC',
    def: 'A political action committee: a fund set up by a company, union or group to give money to campaigns.',
  },
  superpac: {
    label: 'super PAC',
    def: 'A group that spends on its own to support or oppose a candidate. It cannot give money to the campaign, and its spending is not counted here.',
  },
  cycle: {
    label: 'cycle',
    def: 'The two-year run-up to an election. Campaign money is reported one cycle at a time.',
  },
  hr: {
    label: 'H.R.',
    def: 'A House bill. If it passes the House and the Senate and is signed, it becomes law.',
  },
  hres: {
    label: 'H.Res.',
    def: 'A House resolution. It states an opinion or sets House rules. It does not become law.',
  },
  hardMoney: {
    label: 'hard money',
    def: 'Money given straight to a campaign, with limits and public reporting. It is the only kind this tool can see.',
  },
  rollCall: {
    label: 'roll-call vote',
    def: 'A vote where each member is recorded by name. Many decisions never get one.',
  },
  confidence: {
    label: 'classifier confidence',
    def: 'How sure this tool is that a bill touches a sector. It says nothing about any member or any money.',
  },
  crs: {
    label: 'CRS summary',
    def: 'A neutral plain summary written by the Congressional Research Service, the research arm of Congress.',
  },
  disclosed: {
    label: 'disclosed',
    def: 'Reported to the government and published. Money that was never reported cannot appear here at all.',
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
