import type { IndustryId } from './types.js';

/**
 * Curated organisation knowledge.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A regular expression cannot know that "Defend American Jobs" is a
 * crypto-industry super PAC or that "SLF PAC" is the Senate Leadership Fund.
 * That knowledge lives in people's heads and in reporting, not in the name.
 *
 * The LLM layer can supply it when a user brings a key. This table supplies a
 * useful slice of it to everyone else, for free and offline. It is checked in
 * deliberately so that the no-key experience is still honest and informative.
 *
 * RULES FOR ADDING ENTRIES — please follow these in pull requests:
 *  1. Only add an entry you can support with a public, citable source. Put the
 *     source in the `note` field.
 *  2. Classify the ECONOMIC INTEREST, not the politics. "Which sector's money
 *     is this" — never "which side is this".
 *  3. If a committee's funding is genuinely mixed or unknown, use
 *     'super-pac-unattributed' rather than picking the most newsworthy option.
 *  4. Do not add entries that encode a judgement about a candidate or party.
 *
 * Matching is case-insensitive on a normalised form of the committee name.
 * `exact` entries must match the whole name; `contains` entries match anywhere.
 */

export interface OrgKnowledgeEntry {
  match: string;
  kind: 'exact' | 'contains';
  industry: IndustryId;
  confidence: number;
  note: string;
}

export const ORG_KNOWLEDGE: OrgKnowledgeEntry[] = [
  // --- Crypto / digital assets ---------------------------------------------
  { match: 'FAIRSHAKE', kind: 'contains', industry: 'crypto', confidence: 0.95, note: 'Crypto-industry super PAC network; funders are digital-asset firms.' },
  { match: 'DEFEND AMERICAN JOBS', kind: 'contains', industry: 'crypto', confidence: 0.9, note: 'Fairshake-affiliated crypto-industry super PAC.' },
  { match: 'PROTECT PROGRESS', kind: 'contains', industry: 'crypto', confidence: 0.9, note: 'Fairshake-affiliated crypto-industry super PAC.' },
  { match: 'DIGITAL FREEDOM FUND', kind: 'contains', industry: 'crypto', confidence: 0.7, note: 'Digital-asset advocacy committee.' },
  { match: 'BLOCKCHAIN ASSOCIATION', kind: 'contains', industry: 'crypto', confidence: 0.95, note: 'Digital-asset trade association.' },

  // --- Named employers a first-time reader recognised and the site did not ---
  // A reader in Alabama opened her own congressman's donor list and saw
  // DRUMMOND COMPANY, MOTOROLA SOLUTIONS, GENERAL ATOMICS and BLUE ORIGIN all
  // filed under "Other / Unclassified". Her point stands on its own: a reader who
  // recognises a name the tool does not stops trusting the tool, on exactly the
  // page where it is asking to be trusted. These are large, unambiguous
  // employers whose sector is a matter of public record, and the keyword
  // classifier misses them because nothing in the name states the industry.
  { match: 'DRUMMOND COMPANY', kind: 'contains', industry: 'mining', confidence: 0.95, note: 'Alabama-based coal mining company; see its own corporate description of coal operations.' },
  { match: 'MOTOROLA SOLUTIONS', kind: 'contains', industry: 'telecom', confidence: 0.9, note: 'Land-mobile radio and public-safety communications equipment maker.' },
  { match: 'GENERAL ATOMICS', kind: 'contains', industry: 'defense', confidence: 0.95, note: 'Defence contractor; maker of the MQ-9 Reaper and nuclear technologies.' },
  { match: 'BLUE ORIGIN', kind: 'contains', industry: 'defense', confidence: 0.85, note: 'Launch and space systems company holding NASA and Space Force contracts. Classified aerospace/defence, which is the sector its federal revenue sits in.' },
  { match: 'MAYNARD NEXSEN', kind: 'contains', industry: 'legal', confidence: 0.95, note: 'Law firm (Birmingham, Alabama).' },
  { match: 'PILOT CATASTROPHE', kind: 'contains', industry: 'insurance', confidence: 0.9, note: 'Insurance catastrophe claims adjusting firm (Mobile, Alabama).' },
  { match: 'NATIONAL RURAL WATER ASSOCIATION', kind: 'contains', industry: 'waste-water', confidence: 0.95, note: 'Trade association of rural water and wastewater utilities.' },
  { match: 'FARM CREDIT COUNCIL', kind: 'contains', industry: 'agriculture', confidence: 0.9, note: 'Trade association of the Farm Credit System agricultural lenders.' },
  { match: 'ASSOCIATED BUILDERS AND CONTRACTORS', kind: 'contains', industry: 'construction', confidence: 0.95, note: 'Construction industry trade association.' },

  // --- Trade associations, by sector ---------------------------------------
  { match: 'AMERICAN BANKERS ASSOCIATION', kind: 'contains', industry: 'finance-banking', confidence: 0.95, note: 'Banking trade association.' },
  { match: 'INDEPENDENT COMMUNITY BANKERS', kind: 'contains', industry: 'finance-banking', confidence: 0.95, note: 'Community banking trade association.' },
  { match: 'CREDIT UNION NATIONAL ASSOCIATION', kind: 'contains', industry: 'finance-banking', confidence: 0.95, note: 'Credit union trade association.' },
  { match: 'MORTGAGE BANKERS ASSOCIATION', kind: 'contains', industry: 'finance-banking', confidence: 0.95, note: 'Mortgage lending trade association.' },
  { match: 'INVESTMENT COMPANY INSTITUTE', kind: 'contains', industry: 'finance-banking', confidence: 0.9, note: 'Asset management trade association.' },
  { match: 'SECURITIES INDUSTRY AND FINANCIAL MARKETS', kind: 'contains', industry: 'finance-banking', confidence: 0.95, note: 'SIFMA — securities trade association.' },
  { match: 'BDA PAC', kind: 'exact', industry: 'finance-banking', confidence: 0.7, note: 'Bond Dealers of America political action committee.' },
  { match: 'NATIONAL ASSOCIATION OF REALTORS', kind: 'contains', industry: 'real-estate', confidence: 0.95, note: 'Realtor trade association.' },
  { match: 'NATIONAL ASSOCIATION OF HOME BUILDERS', kind: 'contains', industry: 'real-estate', confidence: 0.95, note: 'Homebuilder trade association.' },
  { match: 'NATIONAL MULTIFAMILY HOUSING', kind: 'contains', industry: 'real-estate', confidence: 0.9, note: 'Apartment industry trade association.' },
  { match: 'AMERICAN COUNCIL OF ENGINEERING COMPANIES', kind: 'contains', industry: 'construction', confidence: 0.95, note: 'Engineering firm trade association (ACEC).' },
  { match: 'ASSOCIATED GENERAL CONTRACTORS', kind: 'contains', industry: 'construction', confidence: 0.95, note: 'Construction trade association.' },
  { match: 'ASSOCIATED BUILDERS AND CONTRACTORS', kind: 'contains', industry: 'construction', confidence: 0.95, note: 'Construction trade association.' },
  { match: 'NATIONAL ASSOCIATION OF MANUFACTURERS', kind: 'contains', industry: 'manufacturing', confidence: 0.95, note: 'Manufacturing trade association.' },
  { match: 'AMERICAN CHEMISTRY COUNCIL', kind: 'contains', industry: 'manufacturing', confidence: 0.95, note: 'Chemical manufacturing trade association.' },
  { match: 'NATIONAL COTTON COUNCIL', kind: 'contains', industry: 'agriculture', confidence: 0.95, note: 'Cotton industry trade association.' },
  { match: 'AMERICAN FARM BUREAU', kind: 'contains', industry: 'agriculture', confidence: 0.95, note: 'Farm trade federation.' },
  { match: 'NATIONAL CATTLEMEN', kind: 'contains', industry: 'agriculture', confidence: 0.95, note: 'Beef producer trade association.' },
  { match: 'NATIONAL PORK PRODUCERS', kind: 'contains', industry: 'agriculture', confidence: 0.95, note: 'Pork producer trade association.' },
  { match: 'AMERICAN SUGAR', kind: 'contains', industry: 'agriculture', confidence: 0.9, note: 'Sugar industry committee.' },
  { match: 'NATIONAL CORN GROWERS', kind: 'contains', industry: 'agriculture', confidence: 0.95, note: 'Corn producer trade association.' },
  { match: 'AMERICAN CRYSTAL SUGAR', kind: 'contains', industry: 'agriculture', confidence: 0.95, note: 'Sugar cooperative.' },
  { match: 'NATIONAL RURAL ELECTRIC COOPERATIVE', kind: 'contains', industry: 'utilities-electric', confidence: 0.95, note: 'Electric cooperative trade association (NRECA).' },
  { match: 'EDISON ELECTRIC INSTITUTE', kind: 'contains', industry: 'utilities-electric', confidence: 0.95, note: 'Investor-owned electric utility trade association.' },
  { match: 'AMERICAN PUBLIC POWER', kind: 'contains', industry: 'utilities-electric', confidence: 0.9, note: 'Public power utility association.' },
  { match: 'AMERICAN GAS ASSOCIATION', kind: 'contains', industry: 'utilities-electric', confidence: 0.85, note: 'Natural gas utility trade association.' },
  { match: 'AMERICAN HOSPITAL ASSOCIATION', kind: 'contains', industry: 'health-providers', confidence: 0.95, note: 'Hospital trade association.' },
  { match: 'AMERICAN MEDICAL ASSOCIATION', kind: 'contains', industry: 'health-providers', confidence: 0.95, note: 'Physician membership association.' },
  { match: 'AMERICAN DENTAL ASSOCIATION', kind: 'contains', industry: 'health-providers', confidence: 0.95, note: 'Dental membership association.' },
  { match: 'AMERICAN ACADEMY OF', kind: 'contains', industry: 'health-providers', confidence: 0.6, note: 'Medical specialty academies; verify individually.' },
  { match: 'PHARMACEUTICAL RESEARCH AND MANUFACTURERS', kind: 'contains', industry: 'pharma', confidence: 0.95, note: 'PhRMA — drug manufacturer trade association.' },
  { match: 'BIOTECHNOLOGY INNOVATION ORGANIZATION', kind: 'contains', industry: 'pharma', confidence: 0.95, note: 'Biotech trade association.' },
  { match: 'ADVAMED', kind: 'contains', industry: 'pharma', confidence: 0.9, note: 'Medical device trade association.' },
  { match: 'AMERICAS HEALTH INSURANCE PLANS', kind: 'contains', industry: 'insurance', confidence: 0.95, note: 'AHIP — health insurer trade association.' },
  { match: 'NATIONAL ASSOCIATION OF INSURANCE', kind: 'contains', industry: 'insurance', confidence: 0.9, note: 'Insurance trade association.' },
  { match: 'INDEPENDENT INSURANCE AGENTS', kind: 'contains', industry: 'insurance', confidence: 0.95, note: 'Insurance agent trade association.' },
  { match: 'AMERICAN PETROLEUM INSTITUTE', kind: 'contains', industry: 'energy-fossil', confidence: 0.95, note: 'Oil and gas trade association.' },
  { match: 'INDEPENDENT PETROLEUM ASSOCIATION', kind: 'contains', industry: 'energy-fossil', confidence: 0.95, note: 'Independent oil producer association.' },
  { match: 'NATIONAL MINING ASSOCIATION', kind: 'contains', industry: 'mining', confidence: 0.95, note: 'Mining trade association.' },
  { match: 'SOLAR ENERGY INDUSTRIES', kind: 'contains', industry: 'energy-renewable', confidence: 0.95, note: 'Solar trade association.' },
  { match: 'AMERICAN CLEAN POWER', kind: 'contains', industry: 'energy-renewable', confidence: 0.95, note: 'Renewable energy trade association.' },
  { match: 'NATIONAL ASSOCIATION OF BROADCASTERS', kind: 'contains', industry: 'media-entertainment', confidence: 0.95, note: 'Broadcast trade association.' },
  { match: 'MOTION PICTURE ASSOCIATION', kind: 'contains', industry: 'media-entertainment', confidence: 0.95, note: 'Film studio trade association.' },
  { match: 'RECORDING INDUSTRY ASSOCIATION', kind: 'contains', industry: 'media-entertainment', confidence: 0.95, note: 'Music industry trade association.' },
  { match: 'NCTA', kind: 'exact', industry: 'telecom', confidence: 0.85, note: 'Cable and broadband trade association.' },
  { match: 'CTIA', kind: 'contains', industry: 'telecom', confidence: 0.85, note: 'Wireless carrier trade association.' },
  { match: 'USTELECOM', kind: 'contains', industry: 'telecom', confidence: 0.95, note: 'Broadband provider trade association.' },
  { match: 'AMERICAN TRUCKING', kind: 'contains', industry: 'transport', confidence: 0.95, note: 'Trucking trade association.' },
  { match: 'AIRLINES FOR AMERICA', kind: 'contains', industry: 'transport', confidence: 0.95, note: 'Airline trade association.' },
  { match: 'ASSOCIATION OF AMERICAN RAILROADS', kind: 'contains', industry: 'transport', confidence: 0.95, note: 'Railroad trade association.' },
  { match: 'UNITED PARCEL SERVICE', kind: 'contains', industry: 'transport', confidence: 0.95, note: 'UPS corporate PAC.' },
  { match: 'SPACE EXPLORATION TECHNOLOGIES', kind: 'contains', industry: 'defense', confidence: 0.9, note: 'SpaceX corporate PAC; launch and defense contracting.' },
  { match: 'AEROSPACE INDUSTRIES ASSOCIATION', kind: 'contains', industry: 'defense', confidence: 0.95, note: 'Aerospace and defense trade association.' },
  { match: 'NATIONAL RESTAURANT ASSOCIATION', kind: 'contains', industry: 'retail-consumer', confidence: 0.95, note: 'Restaurant trade association.' },
  { match: 'NATIONAL RETAIL FEDERATION', kind: 'contains', industry: 'retail-consumer', confidence: 0.95, note: 'Retail trade association.' },
  { match: 'NATIONAL BEER WHOLESALERS', kind: 'contains', industry: 'tobacco-alcohol-cannabis', confidence: 0.95, note: 'Beer distributor trade association.' },
  { match: 'WINE AND SPIRITS WHOLESALERS', kind: 'contains', industry: 'tobacco-alcohol-cannabis', confidence: 0.95, note: 'Alcohol distributor trade association.' },
  { match: 'AMERICAN GAMING ASSOCIATION', kind: 'contains', industry: 'hospitality', confidence: 0.95, note: 'Casino trade association.' },
  { match: 'AMERICAN HOTEL', kind: 'contains', industry: 'hospitality', confidence: 0.9, note: 'Hotel trade association.' },
  { match: 'AMERICAN ASSOCIATION FOR JUSTICE', kind: 'contains', industry: 'legal', confidence: 0.95, note: 'Trial lawyer association.' },
  { match: 'AMERICAN BAR ASSOCIATION', kind: 'contains', industry: 'legal', confidence: 0.9, note: 'Lawyer membership association.' },
  { match: 'WASTE MANAGEMENT', kind: 'contains', industry: 'waste-water', confidence: 0.9, note: 'Waste services corporate PAC.' },

  // --- Labor ----------------------------------------------------------------
  { match: 'AFL-CIO', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'Labor federation.' },
  { match: 'TEAMSTERS', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'Labor union.' },
  { match: 'SERVICE EMPLOYEES INTERNATIONAL', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'SEIU.' },
  { match: 'AFSCME', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'Public employee union.' },
  { match: 'NATIONAL EDUCATION ASSOCIATION', kind: 'contains', industry: 'labor-unions', confidence: 0.9, note: 'Teachers union.' },
  { match: 'AMERICAN FEDERATION OF TEACHERS', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'Teachers union.' },
  { match: 'UNITED AUTO WORKERS', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'Auto workers union.' },
  { match: 'INTERNATIONAL BROTHERHOOD OF ELECTRICAL WORKERS', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'IBEW.' },
  { match: 'UNITED STEELWORKERS', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'Steelworkers union.' },
  { match: 'LABORERS INTERNATIONAL', kind: 'contains', industry: 'labor-unions', confidence: 0.95, note: 'LIUNA.' },
  { match: 'MACHINISTS', kind: 'contains', industry: 'labor-unions', confidence: 0.85, note: 'IAM machinists union.' },
  { match: 'PLUMBERS', kind: 'contains', industry: 'labor-unions', confidence: 0.8, note: 'Plumbers and pipefitters union.' },
  { match: 'SHEET METAL', kind: 'contains', industry: 'labor-unions', confidence: 0.8, note: 'SMART union.' },
  { match: 'OPERATING ENGINEERS', kind: 'contains', industry: 'labor-unions', confidence: 0.9, note: 'IUOE union.' },

  // --- Party, leadership and caucus committees ------------------------------
  { match: 'SENATE LEADERSHIP FUND', kind: 'contains', industry: 'party-leadership', confidence: 0.95, note: 'Party-aligned leadership super PAC.' },
  { match: 'SLF PAC', kind: 'exact', industry: 'party-leadership', confidence: 0.85, note: 'Senate Leadership Fund affiliate.' },
  { match: 'SENATE MAJORITY PAC', kind: 'contains', industry: 'party-leadership', confidence: 0.95, note: 'Party-aligned leadership super PAC.' },
  { match: 'CONGRESSIONAL LEADERSHIP FUND', kind: 'contains', industry: 'party-leadership', confidence: 0.95, note: 'Party-aligned leadership super PAC.' },
  { match: 'HOUSE MAJORITY PAC', kind: 'contains', industry: 'party-leadership', confidence: 0.95, note: 'Party-aligned leadership super PAC.' },
  { match: 'CONGRESSIONAL PROGRESSIVE CAUCUS', kind: 'contains', industry: 'party-leadership', confidence: 0.9, note: 'Congressional caucus committee.' },
  { match: 'CHC BOLD PAC', kind: 'contains', industry: 'party-leadership', confidence: 0.9, note: 'Congressional Hispanic Caucus committee.' },
  { match: 'NEW DEMOCRAT', kind: 'contains', industry: 'party-leadership', confidence: 0.85, note: 'Congressional caucus committee.' },
  { match: 'BLUE DOG', kind: 'contains', industry: 'party-leadership', confidence: 0.85, note: 'Congressional caucus committee.' },
  { match: 'GOPAC', kind: 'contains', industry: 'party-leadership', confidence: 0.85, note: 'Party-building committee.' },
  { match: 'AMERIPAC', kind: 'contains', industry: 'party-leadership', confidence: 0.8, note: 'Leadership PAC.' },
  { match: 'SENATE CONSERVATIVES FUND', kind: 'contains', industry: 'party-leadership', confidence: 0.85, note: 'Party-aligned candidate-support committee.' },
  { match: 'DLGA', kind: 'exact', industry: 'party-leadership', confidence: 0.8, note: 'Democratic Lieutenant Governors Association.' },
  { match: 'RGA', kind: 'exact', industry: 'party-leadership', confidence: 0.8, note: 'Republican Governors Association.' },
  { match: 'DGA', kind: 'exact', industry: 'party-leadership', confidence: 0.8, note: 'Democratic Governors Association.' },
  { match: 'LEADERSHIP FUND', kind: 'contains', industry: 'party-leadership', confidence: 0.6, note: 'Naming convention for leadership PACs; low confidence.' },
  { match: 'LEADERS WE DESERVE', kind: 'contains', industry: 'party-leadership', confidence: 0.75, note: 'Candidate-recruitment committee.' },

  // --- Cause and membership organisations -----------------------------------
  { match: 'VOTEVETS', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'Veterans advocacy organisation.' },
  { match: 'UNITED DEMOCRACY PROJECT', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.85, note: 'Foreign-policy advocacy super PAC.' },
  { match: 'EMILY', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.8, note: "EMILY's List — candidate-recruitment advocacy group." },
  { match: 'CLUB FOR GROWTH', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'Fiscal policy advocacy organisation.' },
  { match: 'SIERRA CLUB', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'Environmental advocacy organisation.' },
  { match: 'LEAGUE OF CONSERVATION VOTERS', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'Environmental advocacy organisation.' },
  { match: 'PLANNED PARENTHOOD', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'Reproductive health advocacy organisation.' },
  { match: 'SUSAN B ANTHONY', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'Anti-abortion advocacy organisation.' },
  { match: 'HUMAN RIGHTS CAMPAIGN', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'LGBTQ advocacy organisation.' },
  { match: 'NATIONAL RIFLE ASSOCIATION', kind: 'contains', industry: 'firearms', confidence: 0.95, note: 'Firearms membership and advocacy organisation.' },
  { match: 'GUN OWNERS OF AMERICA', kind: 'contains', industry: 'firearms', confidence: 0.95, note: 'Firearms advocacy organisation.' },
  { match: 'EVERYTOWN', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'Gun-safety advocacy organisation.' },
  { match: 'GIFFORDS', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.85, note: 'Gun-safety advocacy organisation.' },
  { match: 'MEDICARE FOR ALL', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.85, note: 'Single-payer health policy advocacy committee.' },
  { match: 'WORKING FAMILIES PARTY', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.8, note: 'Minor party / labor-aligned advocacy organisation.' },
  { match: 'CHAMBER OF COMMERCE', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.6, note: 'Cross-sector business federation; not attributable to one industry.' },
  { match: 'NATIONAL FEDERATION OF INDEPENDENT BUSINESS', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.7, note: 'Small-business federation spanning many sectors.' },
  // --- Professional services -----------------------------------------------
  { match: 'AMERICAN INSTITUTE OF CERTIFIED PUBLIC ACCOUNTANTS', kind: 'contains', industry: 'legal', confidence: 0.8, note: 'AICPA — accounting profession association; grouped with professional services.' },
  { match: 'ERNST & YOUNG', kind: 'contains', industry: 'legal', confidence: 0.85, note: 'Audit and professional-services firm.' },
  { match: 'ERNST AND YOUNG', kind: 'contains', industry: 'legal', confidence: 0.85, note: 'Audit and professional-services firm.' },
  { match: 'DELOITTE', kind: 'contains', industry: 'legal', confidence: 0.85, note: 'Audit and professional-services firm.' },
  { match: 'PRICEWATERHOUSECOOPERS', kind: 'contains', industry: 'legal', confidence: 0.85, note: 'Audit and professional-services firm.' },
  { match: 'KPMG', kind: 'contains', industry: 'legal', confidence: 0.85, note: 'Audit and professional-services firm.' },
  { match: 'ACCENTURE', kind: 'contains', industry: 'tech', confidence: 0.8, note: 'IT and consulting services.' },

  // --- Finance --------------------------------------------------------------
  { match: 'UBS', kind: 'contains', industry: 'finance-banking', confidence: 0.9, note: 'Investment bank.' },
  { match: 'CREDIT SUISSE', kind: 'contains', industry: 'finance-banking', confidence: 0.9, note: 'Investment bank.' },
  { match: 'AMERICAN COUNCIL OF LIFE INSURERS', kind: 'contains', industry: 'insurance', confidence: 0.95, note: 'Life insurance trade association.' },
  { match: 'PROPERTY CASUALTY INSURERS', kind: 'contains', industry: 'insurance', confidence: 0.95, note: 'Insurance trade association.' },

  // --- Health professions ---------------------------------------------------
  { match: 'AMERICAN OPTOMETRIC ASSOCIATION', kind: 'contains', industry: 'health-providers', confidence: 0.95, note: 'Optometry profession association.' },
  { match: 'AMERICAN SOCIETY OF ANESTHESIOLOGISTS', kind: 'contains', industry: 'health-providers', confidence: 0.95, note: 'Physician specialty society.' },
  { match: 'AMERICAN COLLEGE OF', kind: 'contains', industry: 'health-providers', confidence: 0.6, note: 'Medical specialty colleges; verify individually.' },
  { match: 'AMERICAN PODIATRIC', kind: 'contains', industry: 'health-providers', confidence: 0.9, note: 'Podiatry profession association.' },
  { match: 'AMERICAN CHIROPRACTIC', kind: 'contains', industry: 'health-providers', confidence: 0.9, note: 'Chiropractic profession association.' },
  { match: 'AMERICAN PHYSICAL THERAPY', kind: 'contains', industry: 'health-providers', confidence: 0.9, note: 'Physical therapy profession association.' },
  { match: 'AMERICAN OSTEOPATHIC', kind: 'contains', industry: 'health-providers', confidence: 0.9, note: 'Osteopathic physician association.' },
  { match: 'NATIONAL ASSOCIATION OF CHAIN DRUG STORES', kind: 'contains', industry: 'retail-consumer', confidence: 0.9, note: 'Pharmacy retail trade association.' },
  { match: 'NATIONAL COMMUNITY PHARMACISTS', kind: 'contains', industry: 'health-providers', confidence: 0.9, note: 'Independent pharmacy association.' },

  // --- Autos, transport, industrials ---------------------------------------
  { match: 'NATIONAL AUTOMOBILE DEALERS ASSOCIATION', kind: 'contains', industry: 'retail-consumer', confidence: 0.9, note: 'Car dealership trade association.' },
  { match: 'TOYOTA MOTOR', kind: 'contains', industry: 'transport', confidence: 0.9, note: 'Automaker corporate PAC.' },
  { match: 'GENERAL MOTORS', kind: 'contains', industry: 'transport', confidence: 0.9, note: 'Automaker corporate PAC.' },
  { match: 'FORD MOTOR', kind: 'contains', industry: 'transport', confidence: 0.9, note: 'Automaker corporate PAC.' },
  { match: 'TEXTRON', kind: 'contains', industry: 'defense', confidence: 0.85, note: 'Aerospace and defense manufacturer.' },
  { match: 'NATIONAL STONE, SAND & GRAVEL', kind: 'contains', industry: 'mining', confidence: 0.95, note: 'Aggregates industry trade association.' },
  { match: 'CRH AMERICAS', kind: 'contains', industry: 'construction', confidence: 0.85, note: 'Building materials producer.' },
  { match: 'VULCAN MATERIALS', kind: 'contains', industry: 'mining', confidence: 0.9, note: 'Aggregates producer.' },
  { match: 'KOCH', kind: 'contains', industry: 'energy-fossil', confidence: 0.8, note: 'Diversified industrial group with major refining and chemicals operations.' },

  // --- Retail, media, other -------------------------------------------------
  { match: 'NATIONAL ASSOCIATION OF CONVENIENCE STORES', kind: 'contains', industry: 'retail-consumer', confidence: 0.9, note: 'Convenience retail trade association.' },
  { match: 'COX ENTERPRISES', kind: 'contains', industry: 'media-entertainment', confidence: 0.85, note: 'Media and communications group.' },
  { match: 'AMERICAN SENIORS HOUSING', kind: 'contains', industry: 'real-estate', confidence: 0.9, note: 'Seniors housing industry association.' },
  { match: 'NATIONAL APARTMENT ASSOCIATION', kind: 'contains', industry: 'real-estate', confidence: 0.9, note: 'Apartment industry association.' },
  { match: 'NATIONAL SHOOTING SPORTS FOUNDATION', kind: 'contains', industry: 'firearms', confidence: 0.95, note: 'Firearms industry trade association.' },
  { match: 'AMERICAN ISRAEL PUBLIC AFFAIRS', kind: 'contains', industry: 'ideological-single-issue', confidence: 0.9, note: 'Foreign-policy advocacy organisation (AIPAC).' },
  { match: 'NATIONAL RURAL LETTER CARRIERS', kind: 'contains', industry: 'labor-unions', confidence: 0.9, note: 'Postal workers union.' },
  { match: 'LETTER CARRIERS', kind: 'contains', industry: 'labor-unions', confidence: 0.85, note: 'Postal workers union.' },
  { match: 'AIR LINE PILOTS ASSOCIATION', kind: 'contains', industry: 'labor-unions', confidence: 0.9, note: 'Airline pilots union.' },
  { match: 'NATIONAL AIR TRAFFIC CONTROLLERS', kind: 'contains', industry: 'labor-unions', confidence: 0.9, note: 'Air traffic controllers union.' },
];

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();

const EXACT = new Map<string, OrgKnowledgeEntry>();
const CONTAINS: OrgKnowledgeEntry[] = [];
for (const e of ORG_KNOWLEDGE) {
  if (e.kind === 'exact') EXACT.set(norm(e.match), e);
  else CONTAINS.push({ ...e, match: norm(e.match) });
}
// Longest patterns first so the most specific match wins.
CONTAINS.sort((a, b) => b.match.length - a.match.length);

export interface OrgLookup {
  industry: IndustryId;
  confidence: number;
  note: string;
}

/** Looks a committee or employer name up in the curated table. */
export function lookupOrg(name: string | undefined | null): OrgLookup | null {
  if (!name) return null;
  const n = norm(name);
  if (!n) return null;
  const exact = EXACT.get(n);
  if (exact) return { industry: exact.industry, confidence: exact.confidence, note: exact.note };
  for (const e of CONTAINS) {
    if (n.includes(e.match)) return { industry: e.industry, confidence: e.confidence, note: e.note };
  }
  return null;
}
