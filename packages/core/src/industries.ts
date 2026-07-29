import type { Industry, IndustryId } from './types.js';

/**
 * A deliberately coarse sector taxonomy.
 *
 * Why coarse: employer strings in FEC filings are self-reported free text
 * ("SELF", "N/A", "RETIRED", "Acme Corp."). Any taxonomy finer than this would
 * be projecting precision we do not have. 26 buckets is honest.
 *
 * This is NOT the OpenSecrets/CRP industry taxonomy. That dataset is excellent
 * but is not free for commercial reuse, so this project builds its own mapping
 * from raw disclosure text. Expect it to be noisier than CRP's hand-coded data.
 * See LIMITATIONS.md.
 */
export const INDUSTRIES: Industry[] = [
  { id: 'agriculture', label: 'Agriculture & Food', blurb: 'Farming, ranching, agribusiness, food processing and distribution.' },
  { id: 'defense', label: 'Defense & Aerospace', blurb: 'Defense contractors, aerospace manufacturers, military services.' },
  { id: 'energy-fossil', label: 'Oil, Gas & Coal', blurb: 'Extraction, refining, pipelines and fossil-fuel electricity generation.' },
  { id: 'energy-renewable', label: 'Renewable Energy', blurb: 'Solar, wind, storage, grid modernisation and clean-energy services.' },
  { id: 'finance-banking', label: 'Banking & Finance', blurb: 'Commercial and investment banks, asset managers, private equity, hedge funds.' },
  { id: 'insurance', label: 'Insurance', blurb: 'Health, property, casualty and life insurers and brokers.' },
  { id: 'real-estate', label: 'Real Estate', blurb: 'Developers, brokerages, REITs, property management, homebuilders.' },
  { id: 'health-providers', label: 'Health Providers', blurb: 'Hospitals, physician groups, nursing homes, health systems.' },
  { id: 'pharma', label: 'Pharma & Medical Devices', blurb: 'Drug manufacturers, biotech, medical device and diagnostics companies.' },
  { id: 'tech', label: 'Technology', blurb: 'Software, hardware, internet platforms, semiconductors, IT services.' },
  { id: 'telecom', label: 'Telecom & Cable', blurb: 'Wireless carriers, broadband, cable and satellite providers.' },
  { id: 'transport', label: 'Transportation', blurb: 'Airlines, railroads, trucking, shipping, logistics, rideshare.' },
  { id: 'construction', label: 'Construction', blurb: 'General contractors, engineering firms, building trades employers.' },
  { id: 'manufacturing', label: 'Manufacturing', blurb: 'Industrial, chemical, automotive and general goods manufacturing.' },
  { id: 'retail-consumer', label: 'Retail & Consumer Goods', blurb: 'Retailers, e-commerce, consumer packaged goods, restaurants chains.' },
  { id: 'legal', label: 'Lawyers & Lobbyists', blurb: 'Law firms, litigation, registered lobbying and government-affairs firms.' },
  { id: 'education', label: 'Education', blurb: 'Universities, school systems, education services and publishers.' },
  { id: 'labor-unions', label: 'Labor Unions', blurb: 'Trade unions and their affiliated political committees.' },
  { id: 'media-entertainment', label: 'Media & Entertainment', blurb: 'Broadcast, film, music, publishing, sports, advertising.' },
  { id: 'hospitality', label: 'Hotels, Travel & Gaming', blurb: 'Hotels, casinos, cruise lines, travel and tourism.' },
  { id: 'mining', label: 'Mining & Materials', blurb: 'Metals, minerals, quarrying and primary materials processing.' },
  { id: 'waste-water', label: 'Water & Waste', blurb: 'Water utilities, wastewater, waste management and recycling.' },
  { id: 'utilities-electric', label: 'Electric & Gas Utilities', blurb: 'Investor-owned utilities, electric cooperatives and public power bodies.' },
  { id: 'crypto', label: 'Crypto & Digital Assets', blurb: 'Digital-asset exchanges, custodians, blockchain infrastructure.' },
  { id: 'firearms', label: 'Firearms', blurb: 'Firearm and ammunition manufacturers, dealers and associations.' },
  { id: 'tobacco-alcohol-cannabis', label: 'Tobacco, Alcohol & Cannabis', blurb: 'Tobacco and vapour, brewers and distillers, cannabis operators.' },
  { id: 'ideological-single-issue', label: 'Ideological & Single-Issue', blurb: 'Advocacy organisations organised around a cause rather than a trade.' },
  { id: 'super-pac-unattributed', label: 'Super PAC — funding source not visible', blurb: 'An independent-expenditure committee whose own donors are disclosed in a separate filing this pipeline does not traverse. The money is real and disclosed; its industry is simply not visible from here.' },
  { id: 'party-leadership', label: 'Party & Leadership Committees', blurb: 'Party committees, leadership PACs and candidate-to-candidate transfers. Political money, not an industry — kept separate so it never inflates an industry overlap.' },
  { id: 'government', label: 'Government & Public Sector', blurb: 'Federal, state, local and tribal government bodies, and public agencies. Not a private industry — kept separate so public-sector money never reads as lobbying money.' },
  { id: 'other', label: 'Other / Unclassified', blurb: 'Could not be assigned to a sector from the disclosed text.' },
];

export const INDUSTRY_BY_ID: Record<IndustryId, Industry> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.id, i]),
) as Record<IndustryId, Industry>;

export function industryLabel(id: IndustryId): string {
  return INDUSTRY_BY_ID[id]?.label ?? id;
}

/**
 * Keyword patterns for the offline classifier.
 *
 * Order matters: the first industry whose pattern matches wins, so more
 * specific sectors are listed before broader ones. This is intentionally
 * conservative — it would rather return 'other' than guess.
 */
const PATTERNS: { industry: IndustryId; re: RegExp; weight: number }[] = [
  { industry: 'crypto', re: /\b(crypto|blockchain|bitcoin|ethereum|digital asset|stablecoin|coinbase|kraken|ripple|web3)\w*\b/i, weight: 0.9 },
  { industry: 'firearms', re: /\b(firearm|gun (club|shop|store|manufactur)|ammunition|ammo|rifle assoc|smith ?& ?wesson|sturm.?ruger|vista outdoor|nra)\w*\b/i, weight: 0.9 },
  { industry: 'tobacco-alcohol-cannabis', re: /\b(tobacco|cigarette|vape|vapor|juul|altria|philip morris|reynolds american|brewer|brewing|distiller|winery|vineyard|spirits|anheuser|molson|constellation brands|cannabis|marijuana|dispensary)\w*\b/i, weight: 0.9 },
  { industry: 'pharma', re: /\b(pharma|pharmaceutic|biotech|biopharm|drug (maker|compan)|medical device|diagnostics|genentech|pfizer|merck|abbvie|amgen|lilly|novartis|astrazeneca|moderna|biogen|medtronic|stryker|boston scientific|johnson ?& ?johnson)\w*\b/i, weight: 0.9 },
  { industry: 'health-providers', re: /\b(hospital|health system|healthcare|health care|physician|medical (center|group|practice)|clinic|nursing (home|facility)|dental|surgeon|surgery center|hca |kaiser|ascension|mayo clinic|cleveland clinic|nurse)\w*\b/i, weight: 0.8 },
  { industry: 'insurance', re: /\b(insurance|insurer|underwrit|reinsur|actuar|assurance|allstate|geico|progressive corp|state farm|aflac|cigna|humana|unitedhealth|anthem|elevance|metlife|prudential)\w*\b/i, weight: 0.85 },
  { industry: 'finance-banking', re: /\b(bank(s|er|ers|ing)?|bancorp|bancshares|banc of|credit union|capital manage|asset manage|investment|securities|hedge fund|private equity|venture (capital|partners)|financial (services|group|corp)|brokerage|goldman sachs|morgan stanley|jpmorgan|citigroup|wells fargo|blackstone|blackrock|kkr|carlyle|apollo global|charles schwab|fidelity invest|vanguard)\w*\b/i, weight: 0.8 },
  { industry: 'real-estate', re: /\b(real estate|realtor|realty|properties|property (manage|group)|homebuild|home build|developer|development (corp|group|partners)|reit|apartment|leasing|brokerage of|coldwell|re\/max|cbre|jll |lennar|pulte|d\.?r\.? horton)\w*\b/i, weight: 0.8 },
  { industry: 'utilities-electric', re: /\b(electric (compan|corp|cooperative|power|utility|membership)|power (compan|corp|holding|light)|energy (corp|corporation|compan|holdings|group|inc)|utilit(y|ies)|edison|con edison|duke energy|southern compan|dominion energy|xcel energy|entergy|firstenergy|ameren|dte energy|exelon|pg&e|pacific gas|sempra|nrg energy|vistra|ppl corp|centerpoint|evergy|alliant energy|wec energy|nisource|eversource|avangrid|rural electric)\w*\b/i, weight: 0.8 },
  { industry: 'energy-renewable', re: /\b(solar|wind (energy|power|farm)|renewable|clean energy|photovoltaic|geothermal|battery storage|nextera|sunrun|vestas|first solar|ev charg)\w*\b/i, weight: 0.9 },
  { industry: 'energy-fossil', re: /\b(oil|gas (compan|corp|producer|pipeline)|petroleum|refin(ery|ing)|drilling|coal|fossil|midstream|upstream|exxon|chevron|conocophillips|marathon petro|valero|phillips 66|occidental|halliburton|schlumberger|slb|devon energy|pioneer natural|kinder morgan|williams compan|energy transfer|peabody|api |american petroleum)\w*\b/i, weight: 0.85 },
  { industry: 'mining', re: /\b(mining|mine (safety|operat)|minerals|quarry|smelt|metallurg|steel (corp|mill|dynamics)|aluminum|copper (mining|corp)|freeport-mcmoran|nucor|alcoa|cleveland-cliffs|rare earth)\w*\b/i, weight: 0.85 },
  { industry: 'waste-water', re: /\b(waste manage|wastewater|water (utility|district|authority|works)|sanitation|recycling|republic services|veolia|american water)\w*\b/i, weight: 0.85 },
  // "defense" alone matched "legal defense fund" on a campaign-ethics bill and
  // "self-defense" on criminal-justice bills. Require a defence-industry sense.
  { industry: 'defense', re: /\b(defense (contract|industr|spending|procurement|budget|technolog|manufactur|system)|department of defense|national defense|defence (contract|industr)|aerospace|missile|munitions|shipbuild|military|lockheed|raytheon|spacex|space exploration technologies|rtx corp|northrop|general dynamics|boeing|l3harris|huntington ingalls|bae systems|leidos|booz allen|palantir|anduril)\w*\b/i, weight: 0.9 },
  { industry: 'telecom', re: /\b(telecom|wireless|broadband|cable (compan|corp|one)|satellite|fiber optic|at&t|verizon|t-mobile|comcast|charter communi|cox communi|dish network|lumen technolog)\w*\b/i, weight: 0.85 },
  { industry: 'tech', re: /\b(software|technolog|semiconductor|internet|cloud comput|data cent|cyber ?security|artificial intelligence|computer|microsoft|google|alphabet inc|meta platforms|facebook|apple inc|amazon\b|nvidia|intel corp|oracle|salesforce|ibm|cisco|adobe|qualcomm|broadcom|advanced micro|uber technolog|airbnb|netflix|openai|anthropic)\w*\b/i, weight: 0.8 },
  { industry: 'transport', re: /\b(airline|airlines|aviation|railroad|railway|trucking|freight|logistics|shipping|maritime|port authority|transit|delta air|united airlines|american airlines|southwest airlines|fedex|ups |united parcel|union pacific|csx |norfolk southern|bnsf|tesla|general motors|ford motor|stellantis|rideshare|lyft)\w*\b/i, weight: 0.8 },
  { industry: 'construction', re: /\b(construction|contractor|engineering (firm|corp|group|compan)|excavat|paving|roofing|plumbing|electrical contract|bechtel|fluor corp|aecom|kiewit|turner construction|caterpillar)\w*\b/i, weight: 0.8 },
  { industry: 'agriculture', re: /\b(agricult|farm|farming|ranch|dairy|poultry|livestock|crop|grain|seed (compan|corp)|fertilizer|agribusiness|cotton council|cargill|adm |archer daniels|tyson foods|corteva|bayer crop|john deere|deere ?& ?co|monsanto|smithfield|land o.?lakes|farm bureau)\w*\b/i, weight: 0.85 },
  { industry: 'hospitality', re: /\b(hotel|resort|casino|gaming (corp|group)|cruise|hospitality|restaurant group|tourism|marriott|hilton|hyatt|wynn|mgm resorts|caesars|carnival corp|royal caribbean)\w*\b/i, weight: 0.85 },
  { industry: 'media-entertainment', re: /\b(broadcast|television|radio (station|group)|newspaper|publishing|film|studios|entertainment|music (group|label)|advertising|public relations|sports (league|team)|disney|warner bros|paramount global|nbcuniversal|fox corp|sinclair broadcast|nexstar|spotify)\w*\b/i, weight: 0.8 },
  { industry: 'retail-consumer', re: /\b(retail|e-?commerce|grocer|supermarket|department store|consumer (goods|products)|walmart|target corp|costco|kroger|home depot|lowe.?s|best buy|procter ?& ?gamble|unilever|nestl|pepsico|coca-cola|mcdonald.?s|starbucks|yum brands|chick-fil-a)\w*\b/i, weight: 0.75 },
  { industry: 'manufacturing', re: /\b(manufactur|industrial|chemical (compan|corp)|factory|plant operations|machinery|3m company|honeywell|general electric|ge aerospace|emerson electric|dow inc|dupont|basf|eastman chemical|whirlpool)\w*\b/i, weight: 0.7 },
  { industry: 'legal', re: /\b(law (firm|office|group)|attorney|lawyer|counsel|llp\b|legal services|lobbying|lobbyist|government (affairs|relations)|trial lawyer|akin gump|brownstein|holland ?& ?knight|squire patton|k ?& ?l gates|covington ?& ?burling)\w*\b/i, weight: 0.8 },
  { industry: 'education', re: /\b(universit|college|school district|academy|educat|teacher|professor|charter school|student loan|pearson education|k-?12)\w*\b/i, weight: 0.75 },
  { industry: 'labor-unions', re: /\b(union|afl-?cio|teamsters|seiu|afscme|uaw\b|ibew|nea |aft |united steelworkers|laborers international|carpenters (union|local)|local \d+ (union|pac)|building trades|firefighters assoc|police benevolent)\w*\b/i, weight: 0.85 },
  { industry: 'government', re: /\b(department of (health|human services|transportation|education|agriculture|labor|commerce|veterans)|state of [a-z]+|commonwealth of|county of|city of|municipal|dept\.? of|public health|housing authority|school board|federal government|u\.?s\.? (house|senate|government|department)|congress of the united states|state government|tribal (nation|council|government)|nation of|pueblo of)\w*\b/i, weight: 0.8 },
  // DELIBERATELY NARROW. An earlier version of this pattern included
  // "political action", which appears in the registered legal name of almost
  // every corporate PAC in the FEC's committee master file ("DUKE ENERGY
  // CORPORATION EMPLOYEE POLITICAL ACTION COMMITTEE"). That single token
  // silently relabelled a large share of corporate money as ideological money.
  // Only keep tokens that indicate a CAUSE rather than a filing formality.
  { industry: 'ideological-single-issue', re: /\b(club for growth|emily.?s list|sierra club|planned parenthood|human rights campaign|heritage action|league of conservation|americans for prosperity|citizens united|victory fund|pro-?choice|pro-?life|right to life|second amendment foundation)\w*\b/i, weight: 0.75 },
];

export interface KeywordMatch {
  industry: IndustryId;
  confidence: number;
  matchedOn: string | null;
  /**
   * True when the source text carries no industry information *at all* —
   * "RETIRED", "SELF", "NOT EMPLOYED", "HOMEMAKER" and friends. These are not
   * classification failures; they are contributions with no employer to
   * classify. The UI reports them separately from money we simply could not
   * resolve, because conflating the two overstates how much is unknown.
   */
  placeholder: boolean;
}

/** Employer strings that carry no industry signal, in FEC filings. */
export const NON_EMPLOYER_PATTERN =
  /^(n\/?a|none|n\.a\.|null|self|self.?employed|selfemployed|retired|not employed|non.?employed|unemployed|homemaker|house ?wife|house ?husband|student|requested|information requested|best efforts|refused|declined|\.|-|--|\*)$/i;

/**
 * Deterministic, offline, zero-cost classifier.
 *
 * Used for: (a) users who set LLM_PROVIDER=none, (b) as the fallback whenever
 * an LLM call fails, (c) as a sanity check on LLM output in tests.
 *
 * Returns `other` with confidence 0 when nothing matches — it does not guess.
 */
export function classifyTextToIndustry(...texts: (string | undefined | null)[]): KeywordMatch {
  const haystack = texts.filter(Boolean).join(' | ').trim();
  if (!haystack) return { industry: 'other', confidence: 0, matchedOn: null, placeholder: true };

  // Filings frequently contain these placeholders. Treat them as unclassifiable
  // rather than letting a stray substring match send them somewhere wrong.
  if (NON_EMPLOYER_PATTERN.test(haystack.trim())) {
    return { industry: 'other', confidence: 0, matchedOn: null, placeholder: true };
  }

  for (const p of PATTERNS) {
    const m = haystack.match(p.re);
    if (m) return { industry: p.industry, confidence: p.weight, matchedOn: m[0], placeholder: false };
  }
  return { industry: 'other', confidence: 0, matchedOn: null, placeholder: false };
}

/** Returns every industry a text plausibly touches, not just the first. */
export function classifyTextToIndustries(text: string, limit = 5): KeywordMatch[] {
  const out: KeywordMatch[] = [];
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (m) out.push({ industry: p.industry, confidence: p.weight, matchedOn: m[0], placeholder: false });
  }
  return out.slice(0, limit);
}

/** Maps a NAICS 2-digit prefix to a sector, for USASpending awards. */
export function industryFromNaics(naics?: string): IndustryId | null {
  if (!naics) return null;
  const two = naics.slice(0, 2);
  const map: Record<string, IndustryId> = {
    '11': 'agriculture',
    '21': 'mining',
    '22': 'energy-fossil',
    '23': 'construction',
    '31': 'manufacturing',
    '32': 'manufacturing',
    '33': 'manufacturing',
    '42': 'retail-consumer',
    '44': 'retail-consumer',
    '45': 'retail-consumer',
    '48': 'transport',
    '49': 'transport',
    '51': 'media-entertainment',
    '52': 'finance-banking',
    '53': 'real-estate',
    '54': 'tech',
    '55': 'other',
    '56': 'waste-water',
    '61': 'education',
    '62': 'health-providers',
    '71': 'media-entertainment',
    '72': 'hospitality',
    '81': 'other',
    '92': 'other',
  };
  return map[two] ?? null;
}

export function isIndustryId(v: string): v is IndustryId {
  return INDUSTRIES.some((i) => i.id === v);
}
