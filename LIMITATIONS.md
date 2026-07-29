# What this tool cannot do

This is the most important document in the repository. If you read nothing else, read
this.

Follow the Money puts two public records next to each other. That is genuinely useful,
and it is also much less than it can look like. Below is an honest list of everything
this tool cannot tell you, ordered roughly by how badly each one could mislead someone.

---

## 1. It cannot prove causation. It cannot even suggest it.

The tool computes an **overlap**: how much of a member's disclosed money came from
sectors a bill would affect. That is a co-occurrence in two public datasets.

It is not evidence that:

- a contribution influenced a vote,
- a vote was offered in exchange for money,
- a member acted against their own judgement or their constituents' interests,
- or that anything improper happened at all.

**Every one of the following explains a high overlap at least as well as influence
does, and usually better:**

- Members seek committee assignments relevant to their districts. A member from a
  farming district joins the Agriculture Committee.
- Industries concentrated in a district donate to that district's representative.
  That is what a district *is*.
- Donors give to legislators who already agree with them. Money follows position far
  more often than position follows money — this is the single best-supported finding
  in the political science literature on campaign contributions.
- Party position, ideology, constituent pressure, personal conviction and the actual
  substance of the bill are all more likely explanations for any given vote.

The academic literature on whether contributions change roll-call votes is genuinely
mixed, and the studies that find effects generally find small ones, concentrated in
low-salience, low-visibility legislative activity rather than in headline votes. This
tool cannot distinguish any of that. It reports a number and stops.

**If you are about to say "this proves…" — it does not.**

---

## 2. It only sees disclosed, itemized "hard money"

The campaign-finance half of this tool comes from Federal Election Commission filings.
That means large, structural parts of political money are simply **invisible** here:

| Not visible | Why |
|---|---|
| **Dark money** | 501(c)(4) "social welfare" organisations are not required to disclose donors. Their spending does not appear in FEC contribution filings at all. |
| **The source of super PAC money** | Super PAC *contributions to candidates* are visible. Who funded the super PAC is disclosed in a **separate** filing that this pipeline does not traverse. The UI labels this money "funding source not visible" rather than assigning it a sector. In the current dataset that is a large share of the total. |
| **Unitemized contributions** | Contributions below the FEC itemization threshold are reported only as aggregate totals, with no donor information. |
| **Lobbying expenditure** | Reported under the Lobbying Disclosure Act, a completely different system. Not ingested here. Lobbying spend typically dwarfs campaign contributions. |
| **Bundling** | A bundler who assembles many individual contributions is often more consequential than any single donor. Bundling disclosure is narrow and is not modelled here. |
| **The revolving door** | Staff and members moving to and from industry is arguably a bigger channel of influence than money. Entirely absent. |
| **State and local money** | Federal filings only. |
| **In-kind support, coordinated spending, party transfers** | Partially or wholly outside what is modelled. |
| **Anything after the last FEC filing deadline** | Filings lag. Recent money is missing. |

A member could receive nothing from a sector in this dataset and still be surrounded by
that sector's money. **Absence of an overlap is not evidence of independence.**

---

## 3. Sector attribution is noisy, and the tool tells you how noisy

There is no official "which industry is this donor" field in FEC data. Sector
assignment is inferred:

- For **committee (PAC) money**, from the committee's registered name and connected
  organisation. Usually reliable; occasionally wrong.
- For **individual money**, from the donor's **self-reported employer string**. These
  are free text typed by campaign staff: `SELF`, `N/A`, `RETIRED`, `INFORMATION
  REQUESTED`, misspellings, abbreviations, and shell names all appear.

Consequences you should hold in mind:

- A meaningful share of money **cannot be attributed to any sector**. Every member's
  page reports that share explicitly. It is excluded from every score rather than
  quietly distributed.
- Money from filings with **no employer at all** (retired, self-employed, homemaker) is
  reported as its own separate figure — it is not a classification failure, there is
  simply nothing to classify.
- The taxonomy is **deliberately coarse** (about 30 buckets). Anything finer would
  project precision the source data does not have.
- This project does **not** use the OpenSecrets/CRP industry codes, which are
  hand-curated and much better, because they are not freely licensed for commercial
  reuse. Expect this to be noisier than CRP-derived tools.
- The curated organisation table in `packages/core/src/org-knowledge.ts` is a
  best-effort list maintained by contributors. It can be wrong or out of date.

---

## 4. The bill classification is a guess, and its confidence is not a probability

"Which sectors would this bill affect" is a judgement call. The tool makes it one of
two ways:

- **Offline** (default): from the Congressional Research Service policy area and the
  Library of Congress legislative subject terms. Human-curated metadata, but coarse —
  a policy area of "Health" does not distinguish hospitals from insurers from drug
  manufacturers.
- **With your LLM key**: a language model reads the title, subjects and official
  summary. Better, and capable of being confidently wrong.

Either way:

- The **confidence number is the classifier's own opinion**. It is not a calibrated
  probability, not a statistical measure, and not validated against ground truth.
- Bills with no identified sector produce **no overlap at all**. In a typical run a
  large fraction of bills fall in this bucket. Their absence from the overlap views
  means nothing about their importance.
- The model reads the **summary**, not the full legislative text. A consequential
  provision buried in a long bill can be missed entirely.
- LLM-generated summaries are **machine-generated and can be wrong**. The bill itself
  is always linked; it is the authoritative text.

---

## 5. The overlap score is a share, not a verdict

The score answers exactly one narrow question:

> *Weighting each sector by how central it is to this bill, what share of this member's
> disclosed money came from those sectors?*

It deliberately does **not** incorporate:

- **How the member voted.** A member who voted against every interest that funded them
  scores identically to one who voted with them.
- **Whether the bill helps or hurts** the sector. A bill that would devastate an
  industry scores exactly like one that would enrich it.
- **Whether the member had any influence** over the bill's fate.
- **Any comparison to a baseline.** There is no "expected" overlap to compare against,
  so a 40% score is not "40% more than normal" — it is just 40% of their disclosed
  money.

Members whose money is heavily unattributed will show **lower** scores, purely because
unattributed money is excluded. Low scores are not clean bills of health.

---

## 6. Coverage is partial and depends on how you ran it

The dataset you are looking at reflects the scope *you* configured:

- Bills are capped by `FTM_MAX_BILLS` and selected by most-recently-updated. This is
  not a random or complete sample.
- Federal awards are capped and biased toward large awards; the smallest award included
  is shown on the spending page.
- Without a Congress.gov key there are **no roll-call vote positions at all**.
- Without an OpenFEC key there is **no individual-donor money**, only committee money.
- Contributions to people who are not current members of Congress are counted in
  headline totals but attributed to nobody.

The site reports all of this on its own pages. Do not compare two people's numbers
without checking that both have comparable coverage.

---

## 7. It is not investigative journalism, and it is not a legal finding

This tool can help you decide **what is worth looking at**. It cannot do the looking.

If something here seems significant, the honest next steps are:

1. **Read the bill.** It is linked from every bill page.
2. **Read the member's stated reasoning** — floor statements, press releases,
   committee testimony.
3. **Open the primary FEC filings.** Every figure links to one.
4. **Check the timing.** Did the money precede or follow the position?
5. **Look for the counter-example.** Did members with the same funding vote the other
   way? Did members with no such funding vote the same way? That comparison is what
   distinguishes a pattern from a coincidence, and this tool does not make it for you.
6. **Talk to a journalist** who covers the beat. Newsrooms have the sourcing, the
   context and the legal review that a static site does not.

Nothing produced by this tool should be characterised as evidence of a crime, a
violation, or an ethics breach. It is not, and presenting it that way would be both
wrong and unfair to the person named.

---

## 8. Things that are simply out of scope

- Anything outside the US federal government.
- Anything before the configured election cycle and Congress.
- Executive branch, judiciary, regulatory agencies, state legislatures.
- The actual content of legislative negotiation, which is mostly unrecorded.
- Any assessment of whether a bill is good policy.

---

## If you find an error

Sector misclassifications, bad organisation mappings and parsing bugs are expected and
welcome as issues or pull requests — see [CONTRIBUTING.md](CONTRIBUTING.md). Please
include the primary source that shows what the correct value is.

Corrections that make the tool **less** confident are just as valuable as ones that
make it more informative, and will be treated that way.
