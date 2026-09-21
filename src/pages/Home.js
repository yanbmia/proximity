import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "../styles/globals.css";
import logo from "../styles/logo.png";
import { BsShield, BsTree, BsTrainFront } from "react-icons/bs";
import { FiShoppingCart } from "react-icons/fi";
import { PiPersonSimpleBikeBold } from "react-icons/pi";
import { FaUniversity } from "react-icons/fa";
import { BiMoneyWithdraw } from "react-icons/bi";
import nyuPin from "../styles/icons/nyu.jpg";
import columbiaPin from "../styles/icons/columbia.jpeg";
import { buildListingLinks } from "../utils/listingLinks";

// Campus coordinates used for both the map pins below and the
// distance_from_nyu / distance_from_columbia values baked into
// neighborhoods.geojson (verified to reproduce those exact distances).
const NYU_COORDS = [-73.9965, 40.7295];
const COLUMBIA_COORDS = [-73.9626, 40.8075];

// Official MTA bullet colors by route code, used both for the subway-lines
// map layer (data-driven via each feature's own "color" property, baked in
// when subway_lines.geojson was built) and for the station click-popup
// route bullets below (looked up here directly, since subway_lines.geojson
// is loaded asynchronously as a URL and isn't available synchronously).
const MTA_ROUTE_COLORS = {
  "1": "#EE352E",
  "2": "#EE352E",
  "3": "#EE352E",
  "4": "#00933C",
  "5": "#00933C",
  "6": "#00933C",
  "7": "#B933AD",
  A: "#0039A6",
  C: "#0039A6",
  E: "#0039A6",
  B: "#FF6319",
  D: "#FF6319",
  F: "#FF6319",
  M: "#FF6319",
  G: "#6CBE45",
  J: "#996633",
  Z: "#996633",
  L: "#A7A9AC",
  N: "#FCCC0A",
  Q: "#FCCC0A",
  R: "#FCCC0A",
  W: "#FCCC0A",
  S: "#808183",
  SIR: "#0039A6",
};

// Estimates a travel-time ETA (in minutes) from a straight-line distance
// (meters) to a campus. There's no live routing/Directions API in this app,
// so this is a heuristic blend of NYC walking and transit speeds:
//  - Under ~0.5mi, assume walking the whole way (~3 mph).
//  - Beyond that, assume a mix of walking + subway/bus, with a flat
//    walk-to-station/wait overhead, at an effective ~9 mph average --
//    a commonly cited rough figure for NYC transit trips of a few miles.
const estimateETA = (distanceMeters) => {
  if (distanceMeters == null || isNaN(distanceMeters)) return null;
  const miles = distanceMeters / 1609.34;
  let minutes;
  if (miles < 0.5) {
    minutes = (miles / 3) * 60;
  } else {
    minutes = 8 + (miles / 9) * 60;
  }
  return Math.max(1, Math.round(minutes));
};

// Neighborhood names come from our own geojson rather than user input, but
// these strings are injected as HTML into the popups below, so escape them
// anyway instead of relying on the data staying trusted.
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Matches Tailwind's `sm` breakpoint. Below it the pinned popup is too
// cramped to be useful, so the sidebar panel carries the listing links
// instead (see the detail panel in the sidebar).
const isDesktopWidth = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(min-width: 640px)").matches;

const Home = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const wholeFoodsMarkersRef = useRef([]); // ref to store Whole Foods markers
  const traderJoesMarkersRef = useRef([]); // ref to store Trader Joe's markers
  const nyuMarkerRef = useRef([]); // ref to store the NYU campus marker
  const columbiaMarkerRef = useRef([]); // ref to store the Columbia campus marker
  // Tracks latest nyu/columbia toggle state for use inside the map's hover
  // handlers, which are registered once on mount and would otherwise close
  // over stale state.
  const universityFilterRef = useRef({ nyu: false, columbia: false });
  // Same reason as universityFilterRef: the neighborhood click handler is
  // registered once inside the map's "load" callback, so reading budget state
  // directly would capture whatever it was on mount and never update. The
  // listing links need the *current* slider value.
  const budgetFilterRef = useRef({ showBudget: false, budgetMax: 2750 });
  // The pinned click popup, kept so a second click can replace it rather than
  // stacking popups, and so hover can tell whether one is currently open.
  const neighborhoodPopupRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);

  // The neighborhood the user last clicked. Drives the sidebar detail panel;
  // null means nothing is selected and the panel is hidden.
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);

  // Centered on NYC (all 5 boroughs)
  const [lng, setLng] = useState(-73.9731);
  const [lat, setLat] = useState(40.7113);
  const [zoom, setZoom] = useState(10.2);

  const [showInfo, setShowInfo] = useState(false);

  // Mobile-only: the floating sidebar becomes a bottom sheet below the `xl`
  // breakpoint, collapsed to a small handle by default so it doesn't cover
  // the map. Irrelevant on desktop, where the sidebar is always fully shown.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [showBoroughColors, setShowBoroughColors] = useState(false);
  const [showParks, setShowParks] = useState(false);
  const [showCrime, setShowCrime] = useState(false);
  const [showGrocery, setShowGrocery] = useState(false);
  //groceries
  const [traderJoes, setTraderJoes] = useState(false);
  const [wholeFoods, setWholeFoods] = useState(false);

  const [showUniversity, setShowUniversity] = useState(false);
  //university (schools)
  const [nyu, setNyu] = useState(false);
  const [columbia, setColumbia] = useState(false);

  const [showSubway, setShowSubway] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetMax, setBudgetMax] = useState(2750);
  const [showBikeshare, setShowBikeshare] = useState(false);

  const removeAllMarkers = (markerRef) => {
    markerRef.current.forEach((marker) => {
      marker.remove();
    });
    markerRef.current.length = 0; // Clear the ref array
  };

  const showMarkers = () => {
    if (!map.current) return;

    const traderjoes_res = require("../data/trader_joes_coordinates.geojson");
    const wholefoods_res = require("../data/whole_foods_coordinates.geojson");
    if (wholeFoods) {
      fetch(wholefoods_res)
        .then((r) => r.json())
        .then((data) => {
          removeAllMarkers(wholeFoodsMarkersRef);
          data.features.forEach((feature) => {
            const coordinates = feature.geometry.coordinates;
            const marker = new maplibregl.Marker({
              color: "#2FD98A",
              scale: 0.65,
            })
              .setLngLat(coordinates)
              .addTo(map.current);
            wholeFoodsMarkersRef.current.push(marker);
          });
        })
        .catch((error) => {
          console.error(
            "There was an issue loading the Whole Foods data:",
            error
          );
        });
    } else {
      removeAllMarkers(wholeFoodsMarkersRef);
    }

    if (traderJoes) {
      fetch(traderjoes_res)
        .then((r) => r.json())
        .then((data) => {
          removeAllMarkers(traderJoesMarkersRef);
          data.features.forEach((feature) => {
            const coordinates = feature.geometry.coordinates;
            const marker = new maplibregl.Marker({
              color: "#FF5C5C",
              scale: 0.65,
            })
              .setLngLat(coordinates)
              .addTo(map.current);
            traderJoesMarkersRef.current.push(marker);
          });
        })
        .catch((error) => {
          console.error(
            "There was an issue loading the Trader Joe's data:",
            error
          );
        });
    } else {
      removeAllMarkers(traderJoesMarkersRef);
    }

    if (nyu) {
      if (nyuMarkerRef.current.length === 0) {
        const el = document.createElement("img");
        el.src = nyuPin;
        el.alt = "NYU";
        el.style.width = "36px";
        el.style.height = "36px";
        el.style.cursor = "pointer";
        el.style.boxShadow = "0 0 0 1px #464648, 0 2px 10px rgba(15,15,17,0.7)";
        el.style.borderRadius = "3px";
        const marker = new maplibregl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat(NYU_COORDS)
          .addTo(map.current);
        nyuMarkerRef.current.push(marker);
      }
    } else {
      removeAllMarkers(nyuMarkerRef);
    }

    if (columbia) {
      if (columbiaMarkerRef.current.length === 0) {
        const el = document.createElement("img");
        el.src = columbiaPin;
        el.alt = "Columbia";
        el.style.width = "36px";
        el.style.height = "36px";
        el.style.cursor = "pointer";
        el.style.boxShadow = "0 0 0 1px #464648, 0 2px 10px rgba(15,15,17,0.7)";
        el.style.borderRadius = "3px";
        const marker = new maplibregl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat(COLUMBIA_COORDS)
          .addTo(map.current);
        columbiaMarkerRef.current.push(marker);
      }
    } else {
      removeAllMarkers(columbiaMarkerRef);
    }
  };

  // Each *_score in the data runs 0-3, but the conventions are NOT
  // consistent: for some filters a high score means more desirable
  // (nyu/columbia = closest to campus, crime = safest, park = closest),
  // while for others a low score means more desirable (trader_joes,
  // whole_foods, subway, bikeshare = closest). To make shading mean one
  // thing everywhere -- darker = more desirable -- we convert every active
  // filter to a 0 (worst) .. 3 (best) "desirability" value, flipping the
  // ones whose raw convention is inverted, then average those, normalize
  // to 0-1, and map higher desirability -> higher opacity (darker). A
  // visibility floor keeps the weakest matches legible instead of fading
  // into the basemap.
  //
  // Filters where a HIGHER score already means more desirable:
  const HIGHER_IS_BETTER = new Set([
    "nyu_score",
    "columbia_score",
    "crime_score",
    "park_score",
  ]);
  // (trader_joes_score, whole_foods_score, subway_score, bikeshare_score
  //  are lower-is-better and get flipped below.)
  const MIN_OPACITY = 0.12;
  const SCORE_RANGE = 0.75;
  const BUDGET_PENALTY = 0.45;

  const updateOpacity = () => {
    if (!map.current) return;

    // Collect the active filters' score keys, then convert each to a
    // desirability value: 0 (worst) .. 3 (best). For higher-is-better
    // keys the raw score is already desirability; for the rest we flip it
    // with (3 - score).
    const activeScoreKeys = [];
    if (showParks) activeScoreKeys.push("park_score");
    if (showCrime) activeScoreKeys.push("crime_score");
    if (showBikeshare) activeScoreKeys.push("bikeshare_score");
    if (wholeFoods) activeScoreKeys.push("whole_foods_score");
    if (traderJoes) activeScoreKeys.push("trader_joes_score");
    if (nyu) activeScoreKeys.push("nyu_score");
    if (columbia) activeScoreKeys.push("columbia_score");
    if (showSubway) activeScoreKeys.push("subway_score");

    const desirabilityExprs = activeScoreKeys.map((key) =>
      HIGHER_IS_BETTER.has(key)
        ? ["get", key]
        : ["-", 3, ["get", key]]
    );

    let opacityExpression = 1;

    if (desirabilityExprs.length > 0) {
      const sumExpr = ["+", ...desirabilityExprs];
      const avgExpr =
        desirabilityExprs.length === 1
          ? sumExpr
          : ["/", sumExpr, desirabilityExprs.length];
      const normalizedExpr = ["/", avgExpr, 3]; // 0 (worst) - 1 (best)
      // More desirable -> darker: opacity grows with desirability.
      opacityExpression = [
        "+",
        ["-", 1, SCORE_RANGE],
        ["*", normalizedExpr, SCORE_RANGE],
      ];
    }

    if (showBudget) {
      opacityExpression = [
        "-",
        opacityExpression,
        [
          "case",
          [">=", ["get", "cost"], budgetMax],
          BUDGET_PENALTY,
          0, // default (no decrease)
        ],
      ];
    }

    // Clamp to [MIN_OPACITY, 1] so shading is always both visible and capped
    opacityExpression = ["max", MIN_OPACITY, ["min", 1, opacityExpression]];

    // Set the calculated opacity expression to the 'score-fill' layer
    map.current.setPaintProperty(
      "score-fill",
      "fill-opacity",
      opacityExpression
    );
  };

  useEffect(() => {
    const neighborhoods = require("../data/neighborhoods.geojson");
    const subwayLines = require("../data/subway_lines.geojson");
    const subwayStations = require("../data/subway_stations.geojson");

    //SETTING INITIAL MAP IN NYC
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: [lng, lat],
      zoom: zoom,
      minZoom: 9.5,
    });

    //ADDING REGION FILLS AND OUTLINES

    map.current.on("load", () => {
     try {
      // Adding neighborhoods source
      map.current.addSource("neighborhoods", {
        type: "geojson",
        data: neighborhoods,
      });

      // Neighborhood fill layer NECESSARY FOR MOUSEMOVE
      map.current.addLayer({
        id: "neighborhood-fill",
        type: "fill",
        source: "neighborhoods",
        paint: {
          "fill-color": "transparent",
        },
      });

      // Neighborhood outline layer
      map.current.addLayer({
        id: "neighborhood-outline",
        type: "line",
        source: "neighborhoods",
        paint: {
          "line-color": "#464648",
          "line-width": 1,
          "line-opacity": 0.5,
        },
      });

      // Score fill layer (using same neighborhoods source). Fill color is
      // fully opaque -- all shading contrast comes from the fill-opacity
      // expression in updateOpacity(), so it isn't pre-washed-out by a
      // baked-in alpha here.
      map.current.addLayer({
        id: "score-fill",
        type: "fill",
        source: "neighborhoods",
        paint: {
          "fill-color": "#8130FA",
        },
      });

      // Score outline layer (using same neighborhoods source) -- a crisp
      // white "grout line" between shaded neighborhoods.
      map.current.addLayer({
        id: "score-outline",
        type: "line",
        source: "neighborhoods",
        paint: {
          "line-color": "#8A858C",
          "line-width": 1,
          "line-opacity": 0.35,
        },
      });

      // SUBWAY LINES + STATIONS

      map.current.addSource("subway-lines", {
        type: "geojson",
        data: subwayLines,
      });

      map.current.addLayer({
        id: "subway-lines-casing",
        type: "line",
        source: "subway-lines",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#0F0F11",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });
      map.current.addLayer({
        id: "subway-lines-layer",
        type: "line",
        source: "subway-lines",
        layout: { visibility: "none" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.5,
          "line-opacity": 0.95,
        },
      });

      map.current.addSource("subway-stations", {
        type: "geojson",
        data: subwayStations,
      });

      // Station dots: small white-ringed circles, scaling up slightly on
      // zoom so they stay legible without overwhelming the map when zoomed
      // out across all 445 stations.
      map.current.addLayer({
        id: "subway-stations-layer",
        type: "circle",
        source: "subway-stations",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 15, 5.5],
          "circle-color": "#F1F1F1",
          "circle-stroke-color": "#0F0F11",
          "circle-stroke-width": 1.5,
        },
      });

      // POPUP BASED ON NEIGHBORHOOD/BOROUGH
      const popupDiv = document.createElement("div");
      popupDiv.style.position = "absolute";
      popupDiv.style.backgroundColor = "rgba(28, 27, 30, 0.96)";
      popupDiv.style.color = "#f1f1f1";
      popupDiv.style.padding = "10px 12px";
      popupDiv.style.borderRadius = "3px";
      popupDiv.style.border = "1px solid #464648";
      popupDiv.style.boxShadow = "0 8px 28px rgba(15, 15, 17, 0.65)";
      popupDiv.style.backdropFilter = "blur(6px)";
      popupDiv.style.pointerEvents = "none"; // Allow mouse events to pass through
      popupDiv.style.display = "none"; // Initially hidden
      document.body.appendChild(popupDiv);

      // Builds the popup HTML, appending an ETA line for each selected
      // school (NYU/Columbia) based on that neighborhood's precomputed
      // straight-line distance to campus.
      const buildPopupHTML = (boro, name, properties) => {
        const { nyu, columbia } = universityFilterRef.current;
        let etaLines = "";
        if (nyu) {
          const eta = estimateETA(properties.distance_from_nyu);
          if (eta != null) {
            etaLines += `<p style="color:#bebabf; font-family:'Geist Mono',ui-monospace,monospace; font-size:11px; letter-spacing:0.08em; margin-top:6px; text-align:center;">NYU ETA \u00b7 ~${eta} MIN</p>`;
          }
        }
        if (columbia) {
          const eta = estimateETA(properties.distance_from_columbia);
          if (eta != null) {
            etaLines += `<p style="color:#bebabf; font-family:'Geist Mono',ui-monospace,monospace; font-size:11px; letter-spacing:0.08em; margin-top:3px; text-align:center;">COLUMBIA ETA \u00b7 ~${eta} MIN</p>`;
          }
        }
        return `

            <div>
            <h3 style="color:#f1f1f1; text-align:center; font-family:'Geist Mono',ui-monospace,monospace; font-size:11px; font-weight:500; letter-spacing:0.08em; text-transform:uppercase;">${boro}</h3>
            <p style="color:#f1f1f1; font-size:14px; font-weight:300; letter-spacing:0.02em; text-align:center; margin-top:3px;">${name}</p>
            ${etaLines}
          </div>
            `;
      };

      map.current.on(
        "mouseenter",
        ["neighborhood-fill", "score-fill"],
        (e) => {
          // A pinned click popup is showing; don't also trail a hover
          // tooltip under the cursor as the user moves toward its links.
          if (neighborhoodPopupRef.current) return;
          if (e.features.length > 1) {
            const { name } = e.features[0].properties;
            const { boro } = e.features[1].properties;

            if (name && boro) {
              popupDiv.innerHTML = buildPopupHTML(
                boro,
                name,
                e.features[0].properties
              );
              popupDiv.style.display = "block"; // Show the popup
            }
          }
        }
      );

      map.current.on(
        "mousemove",
        ["neighborhood-fill", "score-fill"],
        (e) => {
          if (neighborhoodPopupRef.current) return;
          if (e.features.length > 1) {
            const { name } = e.features[0].properties;
            const { boro } = e.features[1].properties;

            if (name && boro) {
              popupDiv.innerHTML = buildPopupHTML(
                boro,
                name,
                e.features[0].properties
              );
              popupDiv.style.display = "block"; // Show the popup
            }
          }
          // Update the position of the popup
          const x = e.originalEvent.clientX;
          const y = e.originalEvent.clientY;
          popupDiv.style.left = `${x}px`;
          popupDiv.style.top = `${y}px`;
          popupDiv.style.transform = "translate(-50%, -140%)";
        }
      );

      map.current.on(
        "mouseleave",
        ["neighborhood-fill", "score-fill"],
        () => {
          popupDiv.style.display = "none"; // Hide the popup
        }
      );

      // NEIGHBORHOOD CLICK: pins a popup with the neighborhood's details and
      // deep links out to apartment listings for it. The hover tooltip above
      // can't hold these -- it has pointer-events: none and follows the
      // cursor -- so this is a separate, pinned maplibregl popup, the same
      // pattern the subway-station popup below already uses.
      map.current.on("click", ["neighborhood-fill", "score-fill"], (e) => {
        if (!e.features || !e.features.length) return;
        const props = e.features[0].properties;
        if (!props || !props.name) return;

        // Feeds the sidebar detail panel, which is what mobile sees.
        setSelectedNeighborhood(props);

        // On phones the sheet is usually collapsed to a handle, so the panel
        // we just populated would be scrolled out of sight. Open it.
        if (!isDesktopWidth()) {
          setSidebarCollapsed(false);
          return; // no pinned popup at this width -- the panel has it
        }

        // Read the budget through the ref, not from state: this callback was
        // registered once on mount and would otherwise hold the mount-time
        // slider value forever.
        const { showBudget: budgetOn, budgetMax: budgetCap } =
          budgetFilterRef.current;
        // Only apply a price cap if the user actually turned Budget on --
        // otherwise the slider's idle default would silently filter their
        // results to a number they never chose.
        const maxRent = budgetOn ? budgetCap : null;
        const links = buildListingLinks(props, maxRent);

        const linkRows = links
          .map(
            (l) => `<a href="${escapeHtml(l.href)}" target="_blank" rel="noreferrer noopener"
                 style="display:flex; align-items:baseline; justify-content:space-between; gap:10px;
                        padding:7px 9px; margin-bottom:4px; border:1px solid #2e2d31; border-radius:3px;
                        background:#19191c; text-decoration:none;">
                 <span style="color:#8130fa; font-size:13px; font-weight:400; white-space:nowrap;">${escapeHtml(l.label)} &#8599;</span>
                 <span style="color:#8a858c; font-family:'Geist Mono',ui-monospace,monospace;
                              font-size:10px; letter-spacing:0.04em; text-align:right; flex:1 1 auto;">${escapeHtml(l.scope)}</span>
               </a>`
          )
          .join("");

        const rentLine =
          props.cost != null
            ? `<p style="color:#bebabf; font-size:12px; font-weight:300; margin-top:3px;">
                 Est. 1BR rent &middot; $${escapeHtml(props.cost)}/mo</p>`
            : "";

        const popup = new maplibregl.Popup({
          closeButton: true,
          offset: 12,
          maxWidth: "290px",
        })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="min-width:225px;">
              <p style="color:#8a858c; font-family:'Geist Mono',ui-monospace,monospace;
                        font-size:10px; font-weight:500; letter-spacing:0.08em;
                        text-transform:uppercase;">${escapeHtml(props.boro)}</p>
              <p style="color:#f1f1f1; font-size:15px; font-weight:500;
                        letter-spacing:-0.01em; margin-top:2px;">${escapeHtml(props.name)}</p>
              ${rentLine}
              <div style="border-top:1px solid #2e2d31; margin:11px 0 9px;"></div>
              <p style="color:#f1f1f1; font-family:'Geist Mono',ui-monospace,monospace;
                        font-size:10px; font-weight:500; letter-spacing:0.08em;
                        text-transform:uppercase; margin-bottom:7px;">Find apartments</p>
              ${linkRows}

            </div>`
          )
          .addTo(map.current);

        // Replace rather than stack, and let hover resume once it's dismissed.
        if (neighborhoodPopupRef.current) neighborhoodPopupRef.current.remove();
        neighborhoodPopupRef.current = popup;
        popup.on("close", () => {
          if (neighborhoodPopupRef.current === popup) {
            neighborhoodPopupRef.current = null;
          }
        });
        // The trailing hover tooltip is suppressed while this is open; make
        // sure whatever was on screen at click time goes away too.
        popupDiv.style.display = "none";
      });

      map.current.on("mouseenter", ["neighborhood-fill", "score-fill"], () => {
        map.current.getCanvas().style.cursor = "pointer";
      });
      map.current.on("mouseleave", ["neighborhood-fill", "score-fill"], () => {
        map.current.getCanvas().style.cursor = "";
      });

      // STATION CLICK POPUP: shows the station name and a colored bullet
      // for each line it serves (MTA_ROUTE_COLORS, defined above the
      // component, since the GeoJSON source loads asynchronously).
      map.current.on("click", "subway-stations-layer", (e) => {
        const { name, routes } = e.features[0].properties;
        const routeList =
          typeof routes === "string" ? JSON.parse(routes) : routes;

        const bullets = routeList
          .map((r) => {
            const color = MTA_ROUTE_COLORS[r] || "#808183";
            return `<span style="display:inline-flex; align-items:center; justify-content:center;
                width:20px; height:20px; border-radius:50%; background:${color};
                color:#0b0b0d; font-family:'Geist Mono',ui-monospace,monospace; font-size:11px;
                font-weight:500; margin:2px;">${r}</span>`;
          })
          .join("");

        new maplibregl.Popup({ closeButton: true, offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="min-width:140px;">
              <p style="color:#f1f1f1; font-size:14px; font-weight:300; letter-spacing:0.02em; margin-bottom:7px;">${name}</p>
              <div style="display:flex; flex-wrap:wrap; margin:-2px;">${bullets}</div>
            </div>`
          )
          .addTo(map.current);
      });

      map.current.on("mouseenter", "subway-stations-layer", () => {
        map.current.getCanvas().style.cursor = "pointer";
      });
      map.current.on("mouseleave", "subway-stations-layer", () => {
        map.current.getCanvas().style.cursor = "";
      });

      //UPDATE ZOOM AND CENTER OF MAP BASED ON DRAG
      map.current.on("move", () => {
        setZoom(map.current.getZoom().toFixed(2));
      });

      map.current.on("drag", () => {
        const center = map.current.getCenter();
        const newLng = Math.max(-74.27, Math.min(-73.68, center.lng));
        const newLat = Math.max(40.49, Math.min(40.93, center.lat));

        if (center.lng !== newLng || center.lat !== newLat) {
          map.current.setCenter(new maplibregl.LngLat(newLng, newLat));
        }
      });

      setMapLoaded(true);
     } catch (err) {
      // maplibre-gl swallows errors thrown inside "load" listeners on
      // Safari (see maplibre/maplibre-gl-js#4532), turning a normal
      // ReferenceError into a confusing internal crash instead of a
      // readable stack trace. Log it ourselves so the real cause shows up.
      // eslint-disable-next-line no-console
      console.error("Error inside map 'load' handler:", err);
     }
    });
  }, []);

  //SECOND USE EFFECT TO UPDATE THINGS WITHOUT RERENDER

  useEffect(() => {
    universityFilterRef.current = { nyu, columbia };
    // Keep the click handler's view of the budget current (see budgetFilterRef).
    budgetFilterRef.current = { showBudget, budgetMax };

    if (map.current && map.current.isStyleLoaded() && mapLoaded) {
      updateOpacity();
      showMarkers();

      // Subway lines + station dots are static datasets
      const subwayVisibility = showSubway ? "visible" : "none";
      map.current.setLayoutProperty(
        "subway-lines-casing",
        "visibility",
        subwayVisibility
      );
      map.current.setLayoutProperty(
        "subway-lines-layer",
        "visibility",
        subwayVisibility
      );
      map.current.setLayoutProperty(
        "subway-stations-layer",
        "visibility",
        subwayVisibility
      );

      map.current.setPaintProperty(
        "score-fill",
        "fill-color",
        showBoroughColors
          ? [
              "match",
              ["get", "boro"],
              "Manhattan",
              "#5AA7FF", // blue
              "Brooklyn",
              "#FF9F45", // orange
              "Queens",
              "#3FD9A0", // green
              "Bronx",
              "#FF5C7A", // red
              "Staten Island",
              "#8130FA", // purple
              "#5AA7FF", // Default value if no match
            ]
          : "#8130FA" // static fill color; fill-opacity carries the shading
      );
    }
  }, [
    showBoroughColors,
    showParks,
    showCrime,
    showBikeshare,
    wholeFoods,
    traderJoes,
    nyu,
    columbia,
    showSubway,
    showBudget,
    budgetMax,
    map.current,
  ]);

  // Entry animation for the sidebar/modal rows. This used to be an
  // IntersectionObserver adding an "is-revealed" class imperatively via
  // classList -- but every filter row's own className already depends on
  // its own toggle state (for the active/inactive coloring), so clicking a
  // row makes React recompute and overwrite that row's class attribute.
  // React has no idea "is-revealed" was ever there (it was added outside
  // React's own render), so it silently drops it on the next class-string
  // rewrite -- which is exactly what happens the instant you click the row
  // that owns it. The row snaps back to the [data-reveal] "opacity: 0"
  // resting state and, since the observer had already unobserved it, never
  // gets it back. That's the "button disappears on click" bug.
  //
  // Fix: don't mutate classes outside of React. The animate-px-reveal
  // class below is baked directly into each element's own className
  // template, so it's part of the same string React diffs and re-renders
  // every time -- there's nothing left for a re-render to accidentally
  // drop. It's a CSS animation (see index.css / tailwind.config.js) that
  // plays once when the element is created and holds its end state
  // (animation-fill-mode: both), so it still gives the staggered fade-in
  // on first mount without needing any imperative JS at all.

  const handleZoomIn = () => {
    map.current.zoomTo(map.current.getZoom() + 1, { duration: 200 });
  };

  const handleZoomOut = () => {
    map.current.zoomTo(map.current.getZoom() - 1, { duration: 200 });
  };

  return (
    <>
      <div
        className={`${
          showInfo ? " opacity-50" : "opacity-100"
        }  bg-ink-900 relative h-screen w-screen overflow-hidden`}
        onClick={() => setShowInfo(false)}
      >
        {/* FLOATING SIDEBAR (sm and up) / BOTTOM SHEET (below sm) */}
        <div
          className={`fixed sm:absolute z-20 bottom-0 left-0 right-0
              sm:top-4 sm:left-4 sm:bottom-4 sm:right-auto
              w-full max-w-[346px] mx-auto sm:mx-0 sm:max-h-none
              ${sidebarCollapsed ? "max-h-14" : "max-h-[70vh]"}
              sm:rounded-xl rounded-t-xl shadow-panel ring-1 ring-rule-soft
              overflow-y-auto px-scroll bg-ink-900/95 backdrop-blur-md
              transition-[max-height] duration-380 ease-brand`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{ width: "100%" }}
            className="relative bg-ink-850/90 backdrop-blur-md border-b border-rule-soft sm:rounded-t-xl rounded-t-xl sticky top-0 z-10 sm:p-4 p-2 pt-3 flex items-center gap-2.5 sm:cursor-default cursor-pointer"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
          >
            {/* Drag handle, mobile only -- signals the sheet can be toggled */}
            <span className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-sm bg-rule" />
            <img
              src={logo}
              alt="logo"
              className="sm:w-7 sm:h-7 w-5 h-5"
            />
            <h1 className="text-paper font-mono title">
              PROXIMITY
            </h1>
            <button
              type="button"
              aria-label="About Proximity"
              className="px-interactive px-focus ml-auto flex items-center justify-center rounded-sm
                  text-paper-mid border border-rule sm:h-6 sm:w-6 w-5 h-5 font-medium
                  hover:text-brand-ink hover:bg-brand hover:border-brand cursor-pointer
                  font-mono sm:text-micro text-xxs"
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo(true);
              }}
            >
              i
            </button>
            {/* Chevron, mobile only -- shows expand/collapse state */}
            <span
              className={`sm:hidden flex items-center justify-center text-paper-low transition-transform duration-380 ease-brand ${
                sidebarCollapsed ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </div>
          <div className="flex flex-col sm:py-4 sm:px-3 py-2 px-2 rounded-b-xl">
            <div className="px-stagger flex flex-col gap-1.5 pb-2 bodyText">
              {/* University -- expands to NYU/Columbia sub-toggles */}
              <div
                className={`px-interactive animate-px-reveal rounded-sm border ${
                  showUniversity
                    ? "bg-ink-800 border-cat-uni/35"
                    : "bg-ink-850 border-rule-soft hover:border-rule hover:bg-ink-800"
                }`}
              >
                <div
                  onClick={() => {
                    if (showUniversity) {
                      setShowUniversity(false);
                      setNyu(false);
                      setColumbia(false);
                    } else {
                      setShowUniversity(true);
                    }
                  }}
                  className="flex items-center gap-2.5 w-full sm:py-2.5 sm:px-2.5 py-1.5 px-2 cursor-pointer"
                >
                  <span
                    className={`px-interactive flex items-center justify-center shrink-0 rounded-sm bg-cat-uni text-ink-900 sm:w-7 sm:h-7 w-5 h-5 ${
                      showUniversity ? "opacity-100 ring-1 ring-inset ring-ink-900/25" : "opacity-40"
                    }`}
                  >
                    <FaUniversity className="sm:w-3.5 sm:h-3.5 w-2.5 h-2.5" />
                  </span>
                  <span
                    className={`px-interactive ${
                      showUniversity ? "text-paper" : "text-paper-mid"
                    }`}
                  >
                    University
                  </span>
                </div>
                {showUniversity && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="px-panel-in grid grid-cols-2 sm:gap-2 gap-1 sm:px-2.5 px-2 sm:pb-2.5 pb-2"
                  >
                    <div
                      onClick={() => setNyu(!nyu)}
                      className={`${
                        nyu
                          ? "bg-cat-uni border-cat-uni text-ink-900"
                          : "bg-ink-850 border-rule-soft text-paper-mid hover:border-rule hover:text-paper"
                      } px-interactive text-center border rounded-sm sm:px-2 px-0.5 py-1.5 cursor-pointer bodyText2`}
                    >
                      NYU
                    </div>
                    <div
                      onClick={() => setColumbia(!columbia)}
                      className={`${
                        columbia
                          ? "bg-cat-uni border-cat-uni text-ink-900"
                          : "bg-ink-850 border-rule-soft text-paper-mid hover:border-rule hover:text-paper"
                      } px-interactive text-center border rounded-sm sm:px-2 px-0.5 py-1.5 cursor-pointer bodyText2`}
                    >
                      Columbia
                    </div>
                  </div>
                )}
              </div>

              {/* Safety -- simple toggle, no sub-options */}
              <div
                onClick={() => setShowCrime(!showCrime)}
                className={`px-interactive animate-px-reveal flex items-center gap-2.5 w-full sm:py-2.5 sm:px-2.5 py-1.5 px-2 rounded-sm border cursor-pointer ${
                  showCrime
                    ? "bg-ink-800 border-cat-safety/35"
                    : "bg-ink-850 border-rule-soft hover:border-rule hover:bg-ink-800"
                }`}
              >
                <span
                  className={`px-interactive flex items-center justify-center shrink-0 rounded-sm bg-cat-safety text-ink-900 sm:w-7 sm:h-7 w-5 h-5 ${
                    showCrime ? "opacity-100 ring-1 ring-inset ring-ink-900/25" : "opacity-40"
                  }`}
                >
                  <BsShield className="sm:w-3.5 sm:h-3.5 w-2.5 h-2.5" />
                </span>
                <span
                  className={`px-interactive ${
                    showCrime ? "text-paper" : "text-paper-mid"
                  }`}
                >
                  Safety
                </span>
              </div>

              {/* Parks -- simple toggle, no sub-options */}
              <div
                onClick={() => setShowParks(!showParks)}
                className={`px-interactive animate-px-reveal flex items-center gap-2.5 w-full sm:py-2.5 sm:px-2.5 py-1.5 px-2 rounded-sm border cursor-pointer ${
                  showParks
                    ? "bg-ink-800 border-cat-parks/35"
                    : "bg-ink-850 border-rule-soft hover:border-rule hover:bg-ink-800"
                }`}
              >
                <span
                  className={`px-interactive flex items-center justify-center shrink-0 rounded-sm bg-cat-parks text-ink-900 sm:w-7 sm:h-7 w-5 h-5 ${
                    showParks ? "opacity-100 ring-1 ring-inset ring-ink-900/25" : "opacity-40"
                  }`}
                >
                  <BsTree className="sm:w-3.5 sm:h-3.5 w-2.5 h-2.5" />
                </span>
                <span
                  className={`px-interactive ${
                    showParks ? "text-paper" : "text-paper-mid"
                  }`}
                >
                  Parks
                </span>
              </div>

              {/* Grocery Chains -- expands to Trader Joe's/Whole Foods sub-toggles */}
              <div
                className={`px-interactive animate-px-reveal rounded-sm border ${
                  showGrocery
                    ? "bg-ink-800 border-cat-grocery/35"
                    : "bg-ink-850 border-rule-soft hover:border-rule hover:bg-ink-800"
                }`}
              >
                <div
                  onClick={() => {
                    if (showGrocery) {
                      setShowGrocery(false);
                      setWholeFoods(false);
                      setTraderJoes(false);
                    } else {
                      setShowGrocery(true);
                    }
                  }}
                  className="flex items-center gap-2.5 w-full sm:py-2.5 sm:px-2.5 py-1.5 px-2 cursor-pointer"
                >
                  <span
                    className={`px-interactive flex items-center justify-center shrink-0 rounded-sm bg-cat-grocery text-ink-900 sm:w-7 sm:h-7 w-5 h-5 ${
                      showGrocery ? "opacity-100 ring-1 ring-inset ring-ink-900/25" : "opacity-40"
                    }`}
                  >
                    <FiShoppingCart className="sm:w-3.5 sm:h-3.5 w-2.5 h-2.5" />
                  </span>
                  <span
                    className={`px-interactive ${
                      showGrocery ? "text-paper" : "text-paper-mid"
                    }`}
                  >
                    Grocery Chains
                  </span>
                </div>
                {showGrocery && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="px-panel-in grid grid-cols-2 sm:gap-2 gap-1 sm:px-2.5 px-2 sm:pb-2.5 pb-2"
                  >
                    <div
                      onClick={() => setTraderJoes(!traderJoes)}
                      className={`${
                        traderJoes
                          ? "bg-cat-grocery border-cat-grocery text-ink-900"
                          : "bg-ink-850 border-rule-soft text-paper-mid hover:border-rule hover:text-paper"
                      } px-interactive text-center border rounded-sm sm:px-2 px-0.5 py-1.5 cursor-pointer bodyText2`}
                    >
                      Trader Joe's
                    </div>
                    <div
                      onClick={() => setWholeFoods(!wholeFoods)}
                      className={`${
                        wholeFoods
                          ? "bg-cat-grocery border-cat-grocery text-ink-900"
                          : "bg-ink-850 border-rule-soft text-paper-mid hover:border-rule hover:text-paper"
                      } px-interactive text-center border rounded-sm sm:px-2 px-0.5 py-1.5 cursor-pointer bodyText2`}
                    >
                      Whole Foods
                    </div>
                  </div>
                )}
              </div>

              {/* Subway Stations -- simple toggle, no sub-options */}
              <div
                onClick={() => setShowSubway(!showSubway)}
                className={`px-interactive animate-px-reveal flex items-center gap-2.5 w-full sm:py-2.5 sm:px-2.5 py-1.5 px-2 rounded-sm border cursor-pointer ${
                  showSubway
                    ? "bg-ink-800 border-cat-subway/35"
                    : "bg-ink-850 border-rule-soft hover:border-rule hover:bg-ink-800"
                }`}
              >
                <span
                  className={`px-interactive flex items-center justify-center shrink-0 rounded-sm bg-cat-subway text-ink-900 sm:w-7 sm:h-7 w-5 h-5 ${
                    showSubway ? "opacity-100 ring-1 ring-inset ring-ink-900/25" : "opacity-40"
                  }`}
                >
                  <BsTrainFront className="sm:w-3.5 sm:h-3.5 w-2.5 h-2.5" />
                </span>
                <span
                  className={`px-interactive ${
                    showSubway ? "text-paper" : "text-paper-mid"
                  }`}
                >
                  Subway Stations
                </span>
              </div>

              {/* Budget -- expands to the rent slider */}
              <div
                className={`px-interactive animate-px-reveal rounded-sm border ${
                  showBudget
                    ? "bg-ink-800 border-cat-budget/35"
                    : "bg-ink-850 border-rule-soft hover:border-rule hover:bg-ink-800"
                }`}
              >
                <div
                  onClick={() => setShowBudget(!showBudget)}
                  className="flex items-center gap-2.5 w-full sm:py-2.5 sm:px-2.5 py-1.5 px-2 cursor-pointer"
                >
                  <span
                    className={`px-interactive flex items-center justify-center shrink-0 rounded-sm bg-cat-budget text-ink-900 sm:w-7 sm:h-7 w-5 h-5 ${
                      showBudget ? "opacity-100 ring-1 ring-inset ring-ink-900/25" : "opacity-40"
                    }`}
                  >
                    <BiMoneyWithdraw className="sm:w-3.5 sm:h-3.5 w-2.5 h-2.5" />
                  </span>
                  <span
                    className={`px-interactive ${
                      showBudget ? "text-paper" : "text-paper-mid"
                    }`}
                  >
                    Budget
                  </span>
                </div>
                {showBudget && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="px-panel-in bodyText2 sm:px-2.5 px-2 sm:pb-2.5 pb-2"
                  >
                    <div className="slidecontainer">
                      <p className="text-paper-low pb-2">Max Monthly Rent (1BR):</p>
                      <input
                        onChange={(e) => {
                          setBudgetMax(parseInt(e.target.value));
                        }}
                        type="range"
                        min="2000"
                        max="4000"
                        step="50"
                        value={budgetMax}
                        className="slider px-focus"
                        id="myRange"
                      />
                      <div className="flex flex-col gap-0.5 mt-2.5 py-2 px-2.5 bg-ink-850 rounded-sm w-full mx-auto border border-rule-soft">
                        <p className="text-paper-low">Max 1BR Rent: </p>
                        <span className="text-paper font-medium">${budgetMax}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BikeShare -- simple toggle, no sub-options */}
              <div
                onClick={() => setShowBikeshare(!showBikeshare)}
                className={`px-interactive animate-px-reveal flex items-center gap-2.5 w-full sm:py-2.5 sm:px-2.5 py-1.5 px-2 rounded-sm border cursor-pointer ${
                  showBikeshare
                    ? "bg-ink-800 border-cat-bike/35"
                    : "bg-ink-850 border-rule-soft hover:border-rule hover:bg-ink-800"
                }`}
              >
                <span
                  className={`px-interactive flex items-center justify-center shrink-0 rounded-sm bg-cat-bike text-ink-900 sm:w-7 sm:h-7 w-5 h-5 ${
                    showBikeshare ? "opacity-100 ring-1 ring-inset ring-ink-900/25" : "opacity-40"
                  }`}
                >
                  <PiPersonSimpleBikeBold className="sm:w-3.5 sm:h-3.5 w-2.5 h-2.5" />
                </span>
                <span
                  className={`px-interactive ${
                    showBikeshare ? "text-paper" : "text-paper-mid"
                  }`}
                >
                  BikeShare
                </span>
              </div>
            </div>

            {/* SELECTED NEIGHBORHOOD -- mobile only. On desktop the pinned map
                popup carries this; at phone widths a popup over the map is too
                cramped, so the same links land here instead. */}
            {selectedNeighborhood && (
              <div className="sm:hidden px-panel-in mt-2 pt-3 border-t border-rule-soft">
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <p className="px-label text-micro text-paper-low">
                      {selectedNeighborhood.boro}
                    </p>
                    <p className="text-paper text-bodymd font-medium mt-0.5">
                      {selectedNeighborhood.name}
                    </p>
                    {selectedNeighborhood.cost != null && (
                      <p className="text-paper-mid text-bodysm mt-0.5">
                        Est. 1BR rent &middot; ${selectedNeighborhood.cost}/mo
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Clear selected neighborhood"
                    onClick={() => setSelectedNeighborhood(null)}
                    className="px-interactive px-focus ml-auto shrink-0 flex items-center justify-center
                        rounded-sm border border-rule text-paper-mid w-5 h-5 font-mono text-micro
                        hover:text-brand-ink hover:bg-brand hover:border-brand cursor-pointer"
                  >
                    &times;
                  </button>
                </div>

                <p className="px-label text-micro text-paper mt-3 mb-1.5">
                  Find apartments
                </p>
                <div className="flex flex-col gap-1">
                  {buildListingLinks(
                    selectedNeighborhood,
                    showBudget ? budgetMax : null
                  ).map((link) => (
                    <a
                      key={link.id}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="px-interactive px-focus flex items-baseline justify-between gap-2
                          rounded-sm border border-rule-soft bg-ink-850 px-2 py-1.5
                          hover:border-rule hover:bg-ink-800"
                    >
                      <span className="text-brand text-bodysm whitespace-nowrap">{link.label} &#8599;</span>
                      <span className="font-mono text-paper-low text-[10px] tracking-wide text-right">
                        {link.scope}
                      </span>
                    </a>
                  ))}
                </div>
                <p className="text-paper-lav text-[10px] font-light leading-snug mt-2">
                  Each result covers the area named next to it (a
                  neighborhood, borough, or ZIP), which only approximates
                  this outline.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="absolute inset-0 h-screen w-screen">
          <div
            className="absolute top-2 right-2 z-10 flex flex-col shadow-panel animate-px-reveal"
          >
            <button
              aria-label="Zoom in"
              className="px-interactive px-focus text-lg font-normal text-paper-mid rounded-t-sm border border-rule-soft bg-ink-850/95 backdrop-blur-md hover:bg-ink-800 hover:border-rule hover:text-paper p-1 w-9 h-9"
              onClick={handleZoomIn}
            >
              +
            </button>
            <button
              aria-label="Zoom out"
              className="px-interactive px-focus text-lg font-normal text-paper-mid rounded-b-sm border border-rule-soft border-t-0 bg-ink-850/95 backdrop-blur-md hover:bg-ink-800 hover:border-rule hover:text-paper p-1 w-9 h-9"
              onClick={handleZoomOut}
            >
              -
            </button>
          </div>

          <div
            className={`absolute right-2 z-10 flex flex-col transition-[bottom] duration-380 ease-brand animate-px-reveal ${
              sidebarCollapsed ? "bottom-20 sm:bottom-8" : "bottom-[72vh] sm:bottom-8"
            }`}
          >
            <button
              className={`px-interactive px-focus px-label text-micro sm:text-label rounded-sm border
                  backdrop-blur-md shadow-panel px-2.5 py-2 w-full whitespace-nowrap ${
                    showBoroughColors
                      ? "bg-brand border-brand text-brand-ink hover:bg-brand-hi hover:border-brand-hi"
                      : "bg-ink-850/95 border-rule-soft text-paper-mid hover:bg-ink-800 hover:border-rule hover:text-paper"
                  }`}
              onClick={() => {
                setShowBoroughColors(!showBoroughColors);
              }}
            >
              {showBoroughColors
                ? "Hide Borough Colors"
                : "Show Borough Colors"}
            </button>
          </div>

          <div ref={mapContainer} className="top-0 h-full w-full" />
        </div>
      </div>
      {showInfo ? (
        <div className="absolute z-30 opacity-100 left-0 right-0 mx-auto about-container">
          <div
            className="px-scroll max-h-[80vh] overflow-y-auto bg-ink-900/97 backdrop-blur-md
              border border-rule-soft rounded-xl shadow-panel
              pt-8 pb-12 md:px-10 px-5"
          >
            {/* The container is 80vw; the reference centers its body copy in a
                fixed measure rather than letting it run the full width. */}
            <div className="px-stagger max-w-[78ch] mx-auto">
              <div className="text-headmd text-paper mb-3 animate-px-reveal">
                <b className="font-medium">How does Proximity work?</b>
              </div>
              <div className="text-bodymd text-paper-mid max-w-[62ch] animate-px-reveal">
                Proximity helps you discover neighborhoods in New York
                City, based on your preferences.
              </div>
              <ul
                className="px-stagger animate-px-reveal list-decimal ml-5 mt-4 text-bodymd text-paper-mid marker:text-paper-lav marker:font-mono max-w-[70ch]"
              >
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">Adding Filters</b>: From the left sidebar, add filters to
                  narrow down your search.
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">View Map</b>: The map is interactive and will update as you
                  add filters. Darker areas are the better matches for your
                  preferences.
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">See Boroughs</b>: On the bottom right, toggle "Show
                  Borough Colors" to color-coordinate the map by each
                  neighborhood's borough.
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">Find Apartments</b>: Click on a neighborhood to see apartment listings in that area.
                </li>
              </ul>

              <div className="border-t border-rule-soft mt-9 mb-6" />

              <div className="text-headmd text-paper mb-3 animate-px-reveal">
                <b className="font-medium">Where is the data from?</b>
              </div>
              <div className="text-bodymd text-paper-mid max-w-[62ch] animate-px-reveal">
                The data is sourced from several public datasets, with
                additional processing to aggregate the disparate datasets into a
                convenient and accessible format.
              </div>
              <ul
                className="px-stagger animate-px-reveal ml-5 mt-4 list-disc text-bodymd text-paper-mid marker:text-paper-lav max-w-[70ch]"
              >
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">Neighborhoods and Boroughs</b>: 2020 Neighborhood
                  Tabulation Areas (NTA),{" "}
                  <a
                    href="https://data.cityofnewyork.us"
                    target="_blank"
                    rel="noreferrer"
                    className="px-interactive text-brand hover:text-brand-hi underline underline-offset-2 decoration-brand/40 hover:decoration-brand-hi"
                  >
                    NYC Open Data
                  </a>
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">Grocery Chains</b>: Trader Joe's and Whole Foods store
                  locator listings
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">Parks</b>:{" "}
                  <a
                    href="https://data.cityofnewyork.us"
                    target="_blank"
                    rel="noreferrer"
                    className="px-interactive text-brand hover:text-brand-hi underline underline-offset-2 decoration-brand/40 hover:decoration-brand-hi"
                  >
                    NYC Open Data
                  </a>{" "}
                  (NYC Parks Properties)
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">BikeShare</b>:{" "}
                  <a
                    href="https://citibikenyc.com/system-data"
                    target="_blank"
                    rel="noreferrer"
                    className="px-interactive text-brand hover:text-brand-hi underline underline-offset-2 decoration-brand/40 hover:decoration-brand-hi"
                  >
                    Citi Bike GBFS feed
                  </a>
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">Subway Stations &amp; Lines</b>:{" "}
                  <a
                    href="https://data.ny.gov"
                    target="_blank"
                    rel="noreferrer"
                    className="px-interactive text-brand hover:text-brand-hi underline underline-offset-2 decoration-brand/40 hover:decoration-brand-hi"
                  >
                    MTA Subway Stations and Subway Service Lines, Open Data NY
                  </a>
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">Safety</b>:{" "}
                  <a
                    href="https://data.cityofnewyork.us"
                    target="_blank"
                    rel="noreferrer"
                    className="px-interactive text-brand hover:text-brand-hi underline underline-offset-2 decoration-brand/40 hover:decoration-brand-hi"
                  >
                    NYPD Complaint Data, NYC Open Data
                  </a>
                </li>
                <li className="mt-2.5 pl-1">
                  <b className="text-paper font-medium">Housing Prices</b>:{" "}
                  <a
                    href="https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html"
                    target="_blank"
                    rel="noreferrer"
                    className="px-interactive text-brand hover:text-brand-hi underline underline-offset-2 decoration-brand/40 hover:decoration-brand-hi"
                  >
                    HUD Small Area Fair Market Rents
                  </a>{" "}
                  (1BR, calculated by ZIP code)
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <></>
      )}
    </>
  );

};

export default Home;
