/**
 * How a seat is written, in one place.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TOWN NAMES ARE HERE AND NOT OPTIONAL
 *
 * A phone user was asked to find her own representative. The address lookup
 * needs a network call; when it failed, the fallback was a list of rows reading
 * "NY-2, NY-8, NY-10, NY-12, NY-13" and nothing else. Nobody knows their
 * district number — finding it out was the whole task — so she picked a senator
 * by mistake and left.
 *
 * `districtPlaces` is the list of towns a member keeps a district office in. It
 * ships in the bundle (535 of 537 members have at least one), it is the only
 * human-readable geography available without shipping map data, and it is the
 * OFFLINE answer to "which district is mine?" — so it is rendered next to the
 * district number everywhere a member is identified, and it is searchable.
 *
 * Two members have no office list in the source data. `placesLine` returns null
 * for them and callers simply render one segment fewer; there is no filler.
 * ---------------------------------------------------------------------------
 */

export interface SeatFacts {
  chamber: 'House' | 'Senate' | string;
  state: string;
  district?: string;
  districtPlaces?: string[];
}

/**
 * The bundle stores every single-seat House district as "0" — genuine at-large
 * states and the non-voting delegate seats alike. Rendering "VT-0" would be
 * wrong, so seats are labelled rather than concatenated.
 */
export function seatLabel(m: SeatFacts): string {
  if (m.chamber === 'Senate') return `Senator · ${m.state}`;
  const d = m.district === undefined ? '' : String(m.district);
  if (d === '' || d === '0') return `Representative · ${m.state} at-large`;
  return `Representative · ${m.state}-${d}`;
}

/** "New York, Brooklyn" — the towns this member keeps a district office in. */
export function placesLine(places: string[] | undefined, max = 4): string | null {
  const list = (places ?? []).filter(Boolean).slice(0, max);
  return list.length > 0 ? list.join(', ') : null;
}

/** "Representative · NY-12 · New York, Brooklyn" */
export function seatLine(m: SeatFacts): string {
  const places = placesLine(m.districtPlaces);
  return places ? `${seatLabel(m)} · ${places}` : seatLabel(m);
}

/**
 * Does a free-text needle name one of this member's district-office towns?
 *
 * Substring rather than exact, so "brook" finds Brooklyn and a reader who half
 * remembers the spelling still gets there.
 */
export function matchesPlace(places: string[] | undefined, needle: string): boolean {
  if (!needle) return false;
  return (places ?? []).some((p) => p.toLowerCase().includes(needle));
}
