// ---------------------------------------------------------------------------
// LISTING DEEP LINKS
//
// Builds "show me apartments here" search URLs for a neighborhood, from data
// the map already has (name, zip, boro) plus the current budget slider value.
//
// WHY NAME-MATCHING AGAINST A SEPARATE STREETEASY NAME LIST, RATHER THAN
// SLUGGING THE NTA NAME DIRECTLY:
// The names in neighborhoods.geojson are 2020 NTA labels, and most of them
// have no counterpart in any listing site's neighborhood taxonomy -- 93 of
// the 197 are compound ("Carroll Gardens-Cobble Hill-Gowanus-Red Hook") and
// 32 are parenthetical ("Bushwick (West)"). Slugging an NTA name directly
// would produce mostly-broken links.
//
// Instead this matches fragments of the NTA name against
// streetEasyNeighborhoods.js, a transcription of StreetEasy's own
// neighborhood picker, and links to whichever of its real neighborhoods it
// can find inside the NTA name ("Carroll Gardens-Cobble Hill-Gowanus-Red
// Hook" -> four separate links, one per real neighborhood). Every NTA
// feature does carry a valid 5-digit `zip` and a borough too, so an NTA name
// with no recognizable match, and Zillow's ZIP-scoped link, fall back to
// those instead.
//
// A borough or ZIP link is an approximation of an NTA polygon, not the same
// shape. The UI says so rather than implying the results are exactly this
// neighborhood.
//
// ---------------------------------------------------------------------------
// VERIFICATION LOG -- these sites change their URL formats and will silently
// IGNORE a filter they no longer understand, which is worse than no filter at
// all (the user thinks they're seeing capped prices and they are not). So
// each format is either CONFIRMED by loading it and checking the filter
// actually took effect, or marked ASSUMED.
//
//   CONFIRMED  streeteasy.com/for-rent/west-chelsea/price:-4500|beds%3C=1?sort_by=se_score
//              (checked 2026-09-21) -- confirms the /for-rent/<slug>/ shape
//              scopes to an actual StreetEasy neighborhood (not just a
//              borough), that the price and beds filters share one
//              pipe-delimited path segment with a literal, NOT
//              percent-encoded, `|`, that `beds%3C=1` (bed count <= 1, i.e.
//              studio or 1-bedroom) is the working beds filter, and that
//              `?sort_by=se_score` is appended as an ordinary query param
//              after the filter segment.
//
//              This supersedes an earlier check (2026-09-20) that had found
//              `beds%3C2` with both `%3C` and `|` percent-encoded
//              (`%7C`) -- that shape is no longer used below. `%3C` for `<`
//              is kept (it lands inside an href attribute value; see below).
//
//   CONFIRMED  "Lower East Side" -> "les" (checked 2026-09-21) -- StreetEasy
//              abbreviates this one rather than using the lowercase-dashed
//              form; see SLUG_OVERRIDES in streetEasyNeighborhoods.js.
//
//   ASSUMED    Every StreetEasy slug below other than "west-chelsea" and
//              "les" --
//              i.e. every other neighborhood slug in
//              streetEasyNeighborhoods.js, and the five borough-level slugs
//              (manhattan, brooklyn, queens, bronx, staten-island) used as
//              the fallback when no neighborhood match is found. These
//              follow the same `/for-rent/<slug>/...` shape as the
//              confirmed link and are derived the same simple way
//              (lowercase, spaces/slashes to dashes) from names either
//              StreetEasy's own picker shows (neighborhoods) or that were
//              previously checked against the live site (boroughs -- see
//              git history for that earlier check). "Low risk a slug is
//              wrong" is not the same as "checked": if a link 404s or
//              silently drops a filter, it's a one-line fix in
//              streetEasyNeighborhoods.js or STREETEASY_BOROUGH_SLUGS below.
//
//   CONFIRMED  zillow.com/new-york-ny-11222/rentals/
//              -> "Rental Listings in 11222". ZIP scoping works.
//   REJECTED   zillow.com/new-york-ny-11222/rentals/0-1_beds/-3300_price/
//              -> returned UNFILTERED results ($3,931+ and $4,511+ listings
//                 against a $3,300 cap). Zillow accepted the URL and dropped
//                 both filters silently. Do not reintroduce this path syntax.
// ---------------------------------------------------------------------------

import { STREETEASY_NEIGHBORHOODS_BY_BORO } from "../data/streetEasyNeighborhoods.js";

// StreetEasy takes a borough itself as a `/for-rent/<slug>/` area, same as a
// neighborhood -- used when no part of the NTA name matches a known
// StreetEasy neighborhood.
const STREETEASY_BOROUGH_SLUGS = {
  Manhattan: "manhattan",
  Brooklyn: "brooklyn",
  Queens: "queens",
  Bronx: "bronx",
  "Staten Island": "staten-island",
};

// Studio + 1 bedroom, StreetEasy's inclusive `<=` beds filter (see log).
const STREETEASY_BEDS_FILTER = "beds%3C=1";

function normalizeForMatch(raw) {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bst\.?\s+/gi, "saint ")
    .replace(/\bmt\.?\s+/gi, "mount ")
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/[\s/-]+/g, " ")
    .trim();
}

// Builds, once per borough, the list of StreetEasy neighborhood entries with
// their match tokens attached, longest-name-first so a compound neighborhood
// ("Carroll Gardens", "Bedford-Stuyvesant") is matched whole before its
// individual words could be tried against anything else.
const MATCH_CANDIDATES_BY_BORO = Object.fromEntries(
  Object.entries(STREETEASY_NEIGHBORHOODS_BY_BORO).map(([boro, entries]) => [
    boro,
    entries
      .map((e) => ({ ...e, tokens: normalizeForMatch(e.name).split(" ").filter(Boolean) }))
      .sort((a, b) => b.tokens.length - a.tokens.length),
  ])
);

/**
 * Finds every StreetEasy neighborhood whose name appears as a whole,
 * non-overlapping word sequence inside an NTA name, e.g.
 * "Carroll Gardens-Cobble Hill-Gowanus-Red Hook" (Brooklyn) matches Carroll
 * Gardens, Cobble Hill, Gowanus, and Red Hook individually. A recognized but
 * unslugged (ambiguous, see streetEasyNeighborhoods.js) match still consumes
 * its words -- it just isn't returned -- so it can't also be picked up as
 * some other, shorter candidate.
 *
 * @param {string} ntaName
 * @param {string} boro
 * @returns {{name: string, slug: string}[]}
 */
export function matchStreetEasyNeighborhoods(ntaName, boro) {
  const candidates = MATCH_CANDIDATES_BY_BORO[boro];
  if (!ntaName || !candidates) return [];

  const ntaTokens = normalizeForMatch(ntaName).split(" ").filter(Boolean);
  const used = new Array(ntaTokens.length).fill(false);
  const found = []; // { index, name, slug }

  for (const candidate of candidates) {
    const n = candidate.tokens.length;
    if (n === 0) continue;
    for (let i = 0; i + n <= ntaTokens.length; i++) {
      if (used.slice(i, i + n).some(Boolean)) continue;
      let matches = true;
      for (let j = 0; j < n; j++) {
        if (ntaTokens[i + j] !== candidate.tokens[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        for (let j = 0; j < n; j++) used[i + j] = true;
        if (candidate.slug) {
          found.push({ index: i, name: candidate.name, slug: candidate.slug });
        }
        break; // a given candidate name won't recur inside one NTA name
      }
    }
  }

  // Left-to-right order, matching how the NTA name itself reads.
  return found.sort((a, b) => a.index - b.index).map(({ name, slug }) => ({ name, slug }));
}

function buildFilterSegment(maxRent) {
  const priceSegment = maxRent ? `price:-${maxRent}|` : "";
  return `${priceSegment}${STREETEASY_BEDS_FILTER}`;
}

/**
 * StreetEasy rental search URL(s) for an NTA feature: one per real
 * StreetEasy neighborhood recognized inside its name, or a single
 * borough-scoped link if none was recognized.
 *
 * @param {object} props     a neighborhood feature's properties (name, boro)
 * @param {number|null} maxRent  price cap, or null to omit the filter entirely
 * @returns {{id: string, label: string, href: string, scope: string}[]}
 */
export function buildStreetEasyLinks(props, maxRent) {
  const { name, boro } = props || {};
  if (!boro) return [];

  const filters = buildFilterSegment(maxRent);
  const scopeSuffix = maxRent ? `under $${maxRent} · studio–1BR` : "studio–1BR";

  const matches = matchStreetEasyNeighborhoods(name, boro);
  if (matches.length > 0) {
    return matches.map(({ name: matchedName, slug }) => ({
      id: `streeteasy-${slug}`,
      label: "StreetEasy",
      href: `https://streeteasy.com/for-rent/${slug}/${filters}?sort_by=se_score`,
      scope: `${matchedName} · ${scopeSuffix}`,
    }));
  }

  const boroughSlug = STREETEASY_BOROUGH_SLUGS[boro];
  if (!boroughSlug) return [];
  return [
    {
      id: `streeteasy-${boroughSlug}`,
      label: "StreetEasy",
      href: `https://streeteasy.com/for-rent/${boroughSlug}/${filters}?sort_by=se_score`,
      scope: `${boro} · ${scopeSuffix}`,
    },
  ];
}

/**
 * ZIP-scoped Zillow rental search.
 *
 * NOTE: this deliberately carries NO price or bedroom filter. The path-based
 * filter syntax was tested and Zillow silently ignored it (see the REJECTED
 * entry above), and a link that looks filtered but isn't is worse than an
 * honest unfiltered one. The UI labels this link as ZIP-scoped only, and the
 * StreetEasy link is the one that carries the budget. If a filter format is
 * ever verified to work, add it here and record the check in the log above.
 *
 * @param {string} zip  5-digit ZIP
 * @returns {string|null}
 */
export function buildZillowUrl(zip) {
  if (!zip || !/^\d{5}$/.test(zip)) return null;
  return `https://www.zillow.com/new-york-ny-${zip}/rentals/`;
}

/**
 * Everything the UI needs to render the listing links for one neighborhood.
 * Returns an array so the popup and the sidebar panel render identically from
 * one source.
 *
 * @param {object} props     a neighborhood feature's properties
 * @param {number|null} maxRent  the active budget cap, or null if the Budget
 *                               filter is switched off -- in which case no
 *                               price cap is applied rather than quietly
 *                               inventing one from the slider's idle value
 */
export function buildListingLinks(props, maxRent) {
  const { zip } = props || {};
  const links = [...buildStreetEasyLinks(props, maxRent)];

  const zillow = buildZillowUrl(zip);
  if (zillow) {
    links.push({
      id: "zillow",
      label: "Zillow",
      href: zillow,
      scope: `ZIP ${zip}`,
    });
  }

  return links;
}
