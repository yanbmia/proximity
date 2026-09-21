// ---------------------------------------------------------------------------
// LISTING DEEP LINKS
//
// Builds "show me apartments here" search URLs for a neighborhood, from data
// the map already has (zip, boro) plus the current budget slider value.
//
// WHY ZIP AND BOROUGH, AND NOT NEIGHBOURHOOD NAME:
// The names in neighborhoods.geojson are 2020 NTA labels, and most of them
// have no counterpart in any listing site's neighborhood taxonomy -- 93 of
// the 197 are compound ("Carroll Gardens-Cobble Hill-Gowanus-Red Hook") and
// 32 are parenthetical ("Bushwick (West)"). Slugging those would produce
// mostly-broken links. Every feature does carry a valid 5-digit `zip` and a
// borough, so those are what these builders key on.
//
// A ZIP is an approximation of an NTA polygon, not the same shape. The UI
// says so rather than implying the results are exactly this neighborhood.
//
// ---------------------------------------------------------------------------
// VERIFICATION LOG -- these sites change their URL formats and will silently
// IGNORE a filter they no longer understand, which is worse than no filter at
// all (the user thinks they're seeing capped prices and they are not). So
// each format is either CONFIRMED by loading it and checking the filter
// actually took effect, or marked ASSUMED. Checked 2026-09-20.
//
//   CONFIRMED  streeteasy.com/for-rent/brooklyn/price:-3300%7Cbeds%3C1
//              -> "Brooklyn NY Apartments for Rent under $3,300". Confirms
//                 the /for-rent/<borough-slug>/ shape, the price cap, the
//                 pipe-delimited filter segment, and the `<` operator.
//   CONFIRMED  streeteasy.com/for-rent/nyc/price:-3300%7Cbeds:1%7Carea:301
//              -> "Greenpoint, Brooklyn NY Apartments for Rent under $3,300".
//                 Confirms `beds:N` and that neighborhood scoping needs an
//                 internal numeric area id (which is why we use boroughs).
//   CONFIRMED  zillow.com/new-york-ny-11222/rentals/
//              -> "Rental Listings in 11222". ZIP scoping works.
//   REJECTED   zillow.com/new-york-ny-11222/rentals/0-1_beds/-3300_price/
//              -> returned UNFILTERED results ($3,931+ and $4,511+ listings
//                 against a $3,300 cap). Zillow accepted the URL and dropped
//                 both filters silently. Do not reintroduce this path syntax.
//
//   ASSUMED    The four non-Brooklyn borough slugs below, and `beds<2`
//              specifically (rather than the `beds<1` that was confirmed).
//              StreetEasy started returning "Access denied" to the automated
//              browser partway through checking, so these could not be
//              loaded. The risk is low -- they only vary from a confirmed
//              URL by a borough name or a single digit -- but "low" is not
//              "checked". To confirm: open each of these in a normal browser
//              and look for "<Borough> NY Apartments for Rent under $3,300"
//              in the page title. A wrong slug 404s, it does not fail quietly.
//
//                https://streeteasy.com/for-rent/manhattan/price:-3300%7Cbeds%3C2
//                https://streeteasy.com/for-rent/queens/price:-3300%7Cbeds%3C2
//                https://streeteasy.com/for-rent/bronx/price:-3300%7Cbeds%3C2
//                https://streeteasy.com/for-rent/staten-island/price:-3300%7Cbeds%3C2
//
//              If one is wrong it is a one-word fix in the slug map below
//              (the likely alternates are "the-bronx" and "statenisland").
// ---------------------------------------------------------------------------

// StreetEasy scopes by borough here rather than by neighborhood: its
// neighborhood filter takes an internal numeric area id (area:301 = Greenpoint),
// and there is no published mapping from NTA polygons to those ids.
const STREETEASY_BOROUGH_SLUGS = {
  Manhattan: "manhattan", // assumed -- see log
  Brooklyn: "brooklyn", // confirmed against the live site
  Queens: "queens", // assumed -- see log
  Bronx: "bronx", // assumed -- see log (alternate: "the-bronx")
  "Staten Island": "staten-island", // assumed -- see log (alternate: "statenisland")
};

// Studio + 1 bedroom. StreetEasy's `<` operator is exclusive, so "fewer than
// 2 bedrooms" is studios and 1-bedrooms.
const STREETEASY_MAX_BEDS_EXCLUSIVE = 2;

/**
 * Borough-scoped StreetEasy rental search, with the price cap and
 * studio/1-bedroom filter applied.
 *
 * @param {string} boro      borough name as it appears in the geojson
 * @param {number|null} maxRent  price cap, or null to omit the filter entirely
 * @returns {string|null} url, or null if the borough isn't recognised
 */
export function buildStreetEasyUrl(boro, maxRent) {
  const slug = STREETEASY_BOROUGH_SLUGS[boro];
  if (!slug) return null;

  // StreetEasy takes filters as a pipe-delimited path segment. Both the `<`
  // and the `|` are percent-encoded here (%3C, %7C) so the URL matches the
  // form that was actually verified against the live site, and so the href
  // survives being escaped into the popup's innerHTML without a raw `<`
  // landing in an attribute value.
  const filters = [`beds%3C${STREETEASY_MAX_BEDS_EXCLUSIVE}`];
  if (maxRent) filters.unshift(`price:-${maxRent}`);

  return `https://streeteasy.com/for-rent/${slug}/${filters.join("%7C")}`;
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
  const { zip, boro } = props || {};
  const links = [];

  const streetEasy = buildStreetEasyUrl(boro, maxRent);
  if (streetEasy) {
    links.push({
      id: "streeteasy",
      label: "StreetEasy",
      href: streetEasy,
      // Deliberately explicit: this is borough-wide, not this polygon.
      scope: maxRent ? `${boro} · under $${maxRent} · studio–1BR` : `${boro} · studio–1BR`,
    });
  }

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
