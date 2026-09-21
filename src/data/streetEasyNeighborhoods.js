// ---------------------------------------------------------------------------
// STREETEASY NEIGHBORHOOD NAMES
//
// This is StreetEasy's own neighborhood taxonomy, transcribed from the
// checkbox list in StreetEasy's rental-search "Neighborhoods" filter.
// This is the list listingLinks.js matches NTA name fragments against to find a StreetEasy
// slug that actually resolves to that neighborhood.
//
//   Manhattan "Murray Hill"     vs Queens "Murray Hill (Queens)"   -> null
//
// A few neighborhoods don't use that lowercase-dashed form as their real
// slug. StreetEasy has its own abbreviation instead. SLUG_OVERRIDES holds
// those. Confirmed: "Lower East Side" -> "les".
// ---------------------------------------------------------------------------

const AMBIGUOUS_NAMES = new Set([
  "Murray Hill (Queens)",
  "Bay Terrace (Queens)",
  "Chelsea (Staten Island)",
  "Sunnyside (Staten Island)",
]);

const SLUG_OVERRIDES = {
  "Lower East Side": "les", 
};

function slugify(label) {
  return label
    .replace(/\s*\([^)]*\)\s*$/, "")
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/[\s/]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toEntries(names) {
  return names.map((name) => ({
    name,
    slug: AMBIGUOUS_NAMES.has(name) ? null : SLUG_OVERRIDES[name] || slugify(name),
  }));
}

const MANHATTAN = [
  "Battery Park City", "Chelsea", "West Chelsea", "Chinatown", "Civic Center",
  "East Village", "Financial District", "Fulton/Seaport", "Flatiron", "NoMad",
  "Gramercy Park", "Greenwich Village", "Noho", "Little Italy",
  "Lower East Side", "Two Bridges", "Nolita", "Soho", "Hudson Square",
  "Stuyvesant Town/PCV", "Tribeca", "West Village", "Roosevelt Island",
  "Central Park South", "Midtown", "Midtown East", "Kips Bay", "Murray Hill",
  "Sutton Place", "Turtle Bay", "Beekman", "Midtown South", "Midtown West",
  "Hell's Kitchen", "Hudson Yards", "Upper West Side", "Lincoln Square",
  "Manhattan Valley", "Upper East Side", "Carnegie Hill", "Lenox Hill",
  "Upper Carnegie Hill", "Yorkville", "Central Harlem", "South Harlem",
  "East Harlem", "Hamilton Heights", "Inwood", "Marble Hill",
  "Morningside Heights", "Washington Heights", "Fort George",
  "Hudson Heights", "West Harlem", "Manhattanville",
];

const BRONX = [
  "Belmont", "Concourse", "Crotona Park East", "East Tremont", "West Farms",
  "Fordham", "Highbridge", "Hunts Point", "Longwood", "Melrose",
  "Morris Heights", "Morrisania", "Claremont", "Mott Haven", "North New York",
  "Port Morris", "University Heights", "Bedford Park", "Castle Hill",
  "City Island", "Co-op City", "Kingsbridge", "Kingsbridge Heights",
  "Laconia", "Morris Park", "Parkchester", "Pelham Bay", "Pelham Parkway",
  "Riverdale", "Fieldston", "Spuyten Duyvil", "Soundview", "Throgs Neck",
  "Locust Point", "Van Nest", "Baychester", "Bronxwood", "Country Club",
  "Eastchester", "Edenwald", "Norwood", "Pelham Gardens", "Schuylerville",
  "Tremont", "Mt. Hope", "Wakefield", "Westchester Village",
  "Westchester Square", "Williamsbridge", "Woodlawn", "Woodstock",
];

const BROOKLYN = [
  "Bedford-Stuyvesant", "Ocean Hill", "Stuyvesant Heights", "Boerum Hill",
  "Brooklyn Heights", "Bushwick", "Carroll Gardens", "Cobble Hill",
  "Downtown Brooklyn", "DUMBO", "Vinegar Hill", "East New York", "City Line",
  "Cypress Hills", "New Lots", "Starrett City", "Fort Greene", "Gowanus",
  "Greenpoint", "Park Slope", "Red Hook", "Sunset Park", "Williamsburg",
  "Bath Beach", "Bay Ridge", "Fort Hamilton", "Bensonhurst", "Borough Park",
  "Mapleton", "Brighton Beach", "Columbia St Waterfront District",
  "Coney Island", "Crown Heights", "Weeksville", "Ditmas Park",
  "Fiske Terrace", "Dyker Heights", "Flatbush", "Gravesend", "Kensington",
  "Ocean Parkway", "Prospect Heights", "Prospect Lefferts Gardens", "Seagate",
  "Bergen Beach", "Brownsville", "Canarsie", "Clinton Hill", "East Flatbush",
  "Farragut", "Wingate", "Flatlands", "Gerritsen Beach", "Greenwood",
  "Manhattan Beach", "Marine Park", "Midwood", "Mill Basin", "Old Mill Basin",
  "Prospect Park South", "Sheepshead Bay", "Homecrest", "Madison",
];

const QUEENS = [
  "Astoria", "Ditmars-Steinway", "College Point", "Corona", "East Elmhurst",
  "Elmhurst", "Flushing", "East Flushing", "Murray Hill (Queens)",
  "Forest Hills", "Glendale", "Jackson Heights", "Long Island City",
  "Hunters Point", "Maspeth", "Middle Village", "North Corona", "Rego Park",
  "Ridgewood", "Sunnyside", "Whitestone", "Beechhurst", "Malba", "Woodside",
  "Auburndale", "Bayside", "Bay Terrace (Queens)", "Douglaston",
  "Fresh Meadows", "Hollis", "Howard Beach", "Hamilton Beach", "Lindenwood",
  "Old Howard Beach", "Ramblersville", "Rockwood Park", "Jamaica",
  "Kew Gardens", "Kew Gardens Hills", "Laurelton", "Little Neck",
  "Ozone Park", "Richmond Hill", "South Jamaica", "South Ozone Park",
  "St. Albans", "Woodhaven", "Bellerose", "Briarwood", "Brookville",
  "Cambria Heights", "Clearview", "Floral Park", "Glen Oaks", "Hillcrest",
  "Jamaica Estates", "New Hyde Park", "Oakland Gardens", "Pomonok",
  "Queens Village", "Arverne", "Bayswater", "Belle Harbor", "Breezy Point",
  "Broad Channel", "Edgemere", "Far Rockaway", "Hammels", "Neponsit",
  "Rockaway Park", "Rosedale", "South Richmond Hill", "Springfield Gardens",
  "Utopia",
];

const STATEN_ISLAND = [
  "Arlington", "Clifton", "Elm Park", "Grymes Hill", "Howland Hook",
  "Mariners Harbor", "New Brighton", "Park Hill", "Port Richmond",
  "Rosebank", "Saint George", "Shore Acres", "Silver Lake", "Stapleton",
  "Tompkinsville", "West Brighton", "Arrochar", "Bay Terrace",
  "Dongan Hills", "Egbertville", "Emerson Hill", "Fort Wadsworth",
  "Grant City", "Grasmere", "Lighthouse Hill", "Midland Beach", "New Dorp",
  "New Dorp Beach", "Oakwood", "Oakwood Beach", "Ocean Breeze",
  "Richmondtown", "South Beach", "Todt Hill", "Bulls Head",
  "Castleton Corners", "Graniteville", "Manor Heights", "Meiers Corners",
  "New Springville", "Sunnyside (Staten Island)", "Westerleigh",
  "Willowbrook", "Annadale", "Arden Heights", "Charleston", "Eltingville",
  "Great Kills", "Greenridge", "Huguenot", "Pleasant Plains", "Princes Bay",
  "Richmond Valley", "Rossville", "Tottenville", "Woodrow", "Bloomfield",
  "Chelsea (Staten Island)", "Travis",
];

// A couple of NTA names spell a place differently than StreetEasy's picker
const MANHATTAN_ALIASES = [
  { name: "Gramercy", slug: slugify("Gramercy Park") },
  { name: "Stuyvesant Town", slug: slugify("Stuyvesant Town/PCV") },
];

export const STREETEASY_NEIGHBORHOODS_BY_BORO = {
  Manhattan: [...toEntries(MANHATTAN), ...MANHATTAN_ALIASES],
  Bronx: toEntries(BRONX),
  Brooklyn: toEntries(BROOKLYN),
  Queens: toEntries(QUEENS),
  "Staten Island": toEntries(STATEN_ISLAND),
};
