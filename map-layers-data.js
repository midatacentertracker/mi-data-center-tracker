/* Transmission corridors, featured stories, and layer metadata — loaded after content-data.js */
Object.assign(window.TRACKER_DATA || {}, {
  map_meta: {
    version: "2026-06-29",
    record_count_note: "Every pin is sourced. Township-level coordinates unless noted.",
    external_map: {
      label: "ITC official route map",
      url: "https://www.mifuturegrid.com/oneida-sabine-lake/"
    }
  },
  map_stories: [
    {
      id: "itc-oneida-sabine",
      title: "50 miles of new power lines through Mid-Michigan",
      kicker: "Power & grid",
      summary: "ITC Michigan is proposing a high-voltage line from Oneida Township (southwest of Grand Ledge) to a new Sabine Lake substation near Fowlerville — crossing 15 townships in Eaton, Ingham and Livingston counties. Residents cite farmland, property values and transparency concerns as data center load drives grid upgrades.",
      region: "Mid-Michigan",
      source_name: "WKAR Public Media",
      source_url: "https://www.wkar.org/wkar-news/2026-01-25/proposed-transmission-line-would-cross-15-townships-mid-michigan-residents-demand-answers-as-meetings-start-monday",
      layer: "transmission",
      fly_to: { lat: 42.72, lng: -84.45, zoom: 9 }
    },
    {
      id: "moratorium-wave",
      title: "~50 communities have hit pause",
      kicker: "Local response",
      summary: "Temporary moratoria now cover an area comparable to Rhode Island, according to Michigan Public reporting. Townships and cities are studying zoning, water, noise and infrastructure before accepting new data center applications.",
      region: "Statewide",
      source_name: "Michigan Public",
      source_url: "https://www.michiganpublic.org/environment-climate-change/2026-06-10/as-data-centers-expand-in-michigan-so-do-environmental-and-economic-concerns",
      layer: "moratoria",
      fly_to: { lat: 43.0, lng: -84.5, zoom: 7 }
    },
    {
      id: "saline-stargate",
      title: "Saline Township: Michigan's first hyperscale build",
      kicker: "Active construction",
      summary: "Related Digital's 1.4 GW campus for Oracle and OpenAI broke ground in June 2026. DTE Energy is seeking MPSC approval for power contracts that critics warn could affect ratepayers.",
      region: "Southeast Michigan",
      source_name: "Engineering News-Record",
      source_url: "https://www.enr.com/articles/63087-record-16b-data-center-project-advances-in-michigan",
      layer: "projects",
      fly_to: { lat: 42.166, lng: -83.782, zoom: 11 }
    }
  ],
  map_layers: [
    {
      id: "projects",
      label: "Projects",
      description: "Proposed, approved, under construction and operational sites",
      color: "#cf102d",
      default_on: true
    },
    {
      id: "moratoria",
      label: "Moratoria & pauses",
      description: "Local temporary bans and zoning pauses",
      color: "#e09820",
      default_on: true
    },
    {
      id: "meetings",
      label: "Public meetings",
      description: "Upcoming hearings and government sessions",
      color: "#5b9cf5",
      default_on: true
    },
    {
      id: "transmission",
      label: "Power & grid",
      description: "Transmission corridors and grid infrastructure",
      color: "#9c5fc9",
      default_on: true
    },
    {
      id: "policy",
      label: "Capitol & policy",
      description: "State-level rallies, legislation and regulatory actions",
      color: "#22a86a",
      default_on: false
    }
  ],
  transmission_lines: [
    {
      id: "itc-oneida-sabine-route-a",
      name: "ITC Oneida–Sabine Lake (Route A)",
      operator: "ITC Michigan",
      status: "Proposed — route under review",
      voltage: "High voltage",
      length_mi: 50,
      counties: ["Eaton", "Ingham", "Livingston"],
      townships: 15,
      note: "Preliminary route option. MPSC will select final path; site work unlikely before 2027. See official map for parcel-level detail.",
      source_name: "Michigan Public",
      source_url: "https://www.michiganpublic.org/transportation-infrastructure/2025-12-22/routes-proposed-for-high-voltage-transmission-line-in-eaton-ingham-livingston-counties",
      official_map_url: "https://www.mifuturegrid.com/oneida-sabine-lake/",
      coordinates: [
        [42.695, -84.872],
        [42.710, -84.820],
        [42.755, -84.746],
        [42.748, -84.620],
        [42.737, -84.555],
        [42.717, -84.427],
        [42.705, -84.320],
        [42.698, -84.220],
        [42.700, -84.120],
        [42.705, -84.015]
      ]
    },
    {
      id: "itc-oneida-sabine-route-b",
      name: "ITC Oneida–Sabine Lake (Route B)",
      operator: "ITC Michigan",
      status: "Proposed — alternate route",
      voltage: "High voltage",
      length_mi: 50,
      counties: ["Eaton", "Ingham", "Livingston"],
      townships: 15,
      note: "Second preliminary option published by ITC. Community listening sessions held Jan–Feb 2026 across Okemos, Lansing, Holt, Williamston and Fowlerville.",
      source_name: "WKAR Public Media",
      source_url: "https://www.wkar.org/wkar-news/2026-01-25/proposed-transmission-line-would-cross-15-townships-mid-michigan-residents-demand-answers-as-meetings-start-monday",
      official_map_url: "https://www.mifuturegrid.com/oneida-sabine-lake/",
      coordinates: [
        [42.695, -84.872],
        [42.730, -84.780],
        [42.780, -84.650],
        [42.770, -84.520],
        [42.750, -84.400],
        [42.735, -84.280],
        [42.720, -84.150],
        [42.710, -84.050],
        [42.705, -84.015]
      ]
    },
    {
      id: "lbwl-south-reinforcement",
      name: "BWL South Reinforcement (Lansing)",
      operator: "Lansing Board of Water & Light",
      status: "Planned",
      voltage: "Transmission reinforcement",
      length_mi: null,
      counties: ["Ingham"],
      townships: null,
      note: "BWL transmission reinforcement project in the Lansing area — separate from ITC corridor but part of the broader grid build-out discussion around large new loads.",
      source_name: "Lansing BWL",
      source_url: "https://www.lbwl.com/about-bwl/lansing-energy-tomorrow/south-reinforcement-transmission-line-project",
      official_map_url: "https://www.lbwl.com/about-bwl/lansing-energy-tomorrow/south-reinforcement-transmission-line-project",
      coordinates: [
        [42.732, -84.555],
        [42.715, -84.520],
        [42.690, -84.490],
        [42.665, -84.470]
      ]
    }
  ]
});