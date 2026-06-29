(() => {
  const data = window.TRACKER_DATA || {};
  const points = (data.map_points || []).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const layersMeta = data.map_layers || [];
  const stories = data.map_stories || [];
  const transmissionLines = data.transmission_lines || [];
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = v => String(v || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
  const safeUrl = v => {
    try {
      const u = new URL(String(v || ""), location.href);
      return ["http:", "https:"].includes(u.protocol) ? esc(u.href) : "#";
    } catch {
      return "#";
    }
  };

  const LAYER_COLORS = Object.fromEntries(layersMeta.map(l => [l.id, l.color]));
  const LAYER_LABELS = Object.fromEntries(layersMeta.map(l => [l.id, l.label]));
  const STATUS_COLORS = {
    "Under construction": "#cf102d",
    "Proposed": "#3a7bd5",
    "Under review": "#5b9cf5",
    "Conditionally approved": "#f59e0b",
    "Approved": "#22a86a",
    "Operational": "#10b981",
    "Moratorium": "#e09820",
    "Utility pause": "#9c5fc9",
    "Rejected by planning commission": "#5a6070",
    "Withdrawn": "#374151",
    "Under appeal": "#6b7280",
    "Public meeting": "#5b9cf5",
    "Public signal": "#22a86a"
  };
  const pointColor = p => LAYER_COLORS[p.layer] || STATUS_COLORS[p.status] || "#cf102d";
  const layerLabel = p => LAYER_LABELS[p.layer] || p.layer || "Record";

  const REGION_COUNTIES = {
    metro_detroit: new Set([
      "Wayne", "Oakland", "Macomb", "Washtenaw", "Livingston", "Monroe", "Lenawee",
      "St. Clair", "Lapeer", "Genesee", "Hillsdale", "Sanilac"
    ]),
    west_michigan: new Set([
      "Kent", "Ottawa", "Allegan", "Muskegon", "Berrien", "Cass", "Van Buren",
      "Kalamazoo", "Barry", "Ionia", "Montcalm", "Mecosta", "Newaygo", "Oceana",
      "Mason", "Lake", "Manistee", "Benzie", "Leelanau"
    ]),
    mid_michigan: new Set([
      "Ingham", "Eaton", "Clinton", "Jackson", "Calhoun", "Branch", "Shiawassee",
      "Gratiot", "Isabella", "Clare", "Midland", "Bay", "Saginaw", "Tuscola", "Huron"
    ]),
    northern_michigan: new Set([
      "Grand Traverse", "Antrim", "Charlevoix", "Emmet", "Cheboygan", "Presque Isle",
      "Alpena", "Alcona", "Iosco", "Ogemaw", "Oscoda", "Crawford", "Kalkaska",
      "Missaukee", "Wexford", "Osceola", "Mackinac", "Chippewa", "Schoolcraft",
      "Delta", "Dickinson", "Menominee", "Marquette", "Alger", "Baraga", "Houghton",
      "Keweenaw", "Ontonagon", "Gogebic", "Iron", "Luce"
    ])
  };
  const regionForCounty = county => {
    const c = String(county || "").replace(/ County$/i, "").trim();
    for (const [key, set] of Object.entries(REGION_COUNTIES)) {
      if (set.has(c)) return key;
    }
    return "statewide";
  };

  const params = new URLSearchParams(location.search);
  const initLat = parseFloat(params.get("lat")) || 44.55;
  const initLng = parseFloat(params.get("lng")) || -85.45;
  const initZoom = parseInt(params.get("z"), 10) || 6;
  const initMode = params.get("mode") || "dark";
  const initRegion = params.get("region") || "all";
  const initFilters = params.get("f") ? new Set(params.get("f").split(",")) : null;
  const initLayers = params.get("layers") ? new Set(params.get("layers").split(",")) : null;
  const initPoint = params.get("point") || "";
  const initStory = params.get("story") || "";

  const defaultLayers = new Set(
    layersMeta.filter(l => l.default_on !== false).map(l => l.id)
  );
  if (!defaultLayers.size) ["projects", "moratoria", "meetings", "transmission"].forEach(id => defaultLayers.add(id));
  let activeLayers = initLayers && initLayers.size ? initLayers : new Set(defaultLayers);

  const darkTile = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
  });
  const dayTile = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
  });
  const satTile = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
  });

  const map = L.map("map", { zoomControl: false, scrollWheelZoom: true, attributionControl: true })
    .setView([initLat, initLng], initZoom);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  let currentMode = ["dark", "day", "sat"].includes(initMode) ? initMode : "dark";
  const setTileMode = mode => {
    [darkTile, dayTile, satTile].forEach(t => { try { map.removeLayer(t); } catch (_) {} });
    if (mode === "day") dayTile.addTo(map);
    else if (mode === "sat") satTile.addTo(map);
    else darkTile.addTo(map);
    currentMode = mode;
    $$(".tile-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    updatePermalink();
  };
  setTileMode(currentMode);
  $$(".tile-btn").forEach(b => b.addEventListener("click", () => setTileMode(b.dataset.mode)));

  const boundaryLayer = L.geoJSON(null, {
    style: { color: "#cf102d", weight: 2, opacity: 0.55, fillColor: "#cf102d", fillOpacity: 0.04 },
    interactive: false
  }).addTo(map);
  fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json")
    .then(r => r.json())
    .then(geo => {
      const mi = geo.features.find(f => f.properties?.name === "Michigan");
      if (mi) boundaryLayer.addData(mi);
    })
    .catch(() => {});

  function makeIcon(color, active = false, layer = "projects") {
    const size = active ? 28 : 22;
    const shapes = {
      moratoria: `<rect x="5" y="3" width="14" height="14" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5"/>`,
      meetings: `<circle cx="12" cy="10" r="7" fill="${color}" stroke="#fff" stroke-width="1.5"/>`,
      transmission: `<path d="M13 2L8 12h3.5l-1 10 7-12h-3.5L13 2z" fill="${color}" stroke="#fff" stroke-width="1.2"/>`,
      policy: `<polygon points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,17 5.5,21 7.5,13.5 2,9 9,9" fill="${color}" stroke="#fff" stroke-width="1.2"/>`
    };
    const inner = shapes[layer] || `<path d="M12 2c-3.3 0-6 2.5-6 5.6 0 4.2 6 12.4 6 12.4s6-8.2 6-12.4C18 4.5 15.3 2 12 2z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="7.6" r="2.2" fill="#fff" fill-opacity=".9"/>`;
    return L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`,
      className: active ? "map-pin map-pin--active" : "map-pin",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  }

  const dateLabel = value => {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
      .format(new Date(`${value}T12:00:00`));
  };

  function makePopup(p) {
    const c = pointColor(p);
    const dateStr = p.verified_date ? dateLabel(p.verified_date) : "";
    return `<div class="map-popup">
      <div class="pop-header" style="--status:${c}">
        <span class="pop-status">${esc(layerLabel(p))} · ${esc(p.status)}${p.confidence ? ` · ${esc(p.confidence)}` : ""}</span>
        <div class="pop-name">${esc(p.name)}</div>
        <div class="pop-location">${esc(p.municipality)}, ${esc(p.county)} County</div>
      </div>
      <div class="pop-body">
        ${p.developer ? `<div class="pop-row"><span class="pop-label">Developer</span><span class="pop-val">${esc(p.developer)}</span></div>` : ""}
        ${p.power_mw ? `<div class="pop-row"><span class="pop-label">Scale</span><span class="pop-val">${esc(p.power_mw)} MW</span></div>` : ""}
        ${dateStr ? `<div class="pop-row"><span class="pop-label">Verified</span><span class="pop-val">${dateStr}</span></div>` : ""}
        ${p.note ? `<p class="pop-note">${esc(p.note)}</p>` : ""}
      </div>
      <div class="pop-footer">
        <a class="pop-source" href="${safeUrl(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_name || "Source")} ↗</a>
      </div>
    </div>`;
  }

  function makeLinePopup(line) {
    return `<div class="map-popup">
      <div class="pop-header" style="--status:#9c5fc9">
        <span class="pop-status">Power & grid · ${esc(line.status)}</span>
        <div class="pop-name">${esc(line.name)}</div>
        <div class="pop-location">${esc((line.counties || []).join(", "))} ${line.length_mi ? `· ~${line.length_mi} mi` : ""}</div>
      </div>
      <div class="pop-body">
        <div class="pop-row"><span class="pop-label">Operator</span><span class="pop-val">${esc(line.operator)}</span></div>
        ${line.townships ? `<div class="pop-row"><span class="pop-label">Townships</span><span class="pop-val">${line.townships} affected</span></div>` : ""}
        ${line.note ? `<p class="pop-note">${esc(line.note)}</p>` : ""}
      </div>
      <div class="pop-footer">
        <a class="pop-source" href="${safeUrl(line.source_url)}" target="_blank" rel="noopener">${esc(line.source_name)} ↗</a>
        ${line.official_map_url ? `<a class="pop-source" href="${safeUrl(line.official_map_url)}" target="_blank" rel="noopener">Official route map ↗</a>` : ""}
      </div>
    </div>`;
  }

  function renderSelected(p) {
    const panel = $("#selected-record");
    if (!panel) return;
    if (!p) { panel.hidden = true; panel.innerHTML = ""; return; }
    const c = pointColor(p);
    panel.hidden = false;
    panel.innerHTML = `
      <div class="selected-kicker">${esc(layerLabel(p))}</div>
      <div class="selected-status" style="color:${c}">${esc(p.status)}</div>
      <h3 class="selected-name">${esc(p.name)}</h3>
      <p class="selected-meta">${esc(p.municipality)}, ${esc(p.county)} County</p>
      ${p.developer ? `<p class="selected-detail"><span>Developer</span> ${esc(p.developer)}</p>` : ""}
      ${p.power_mw ? `<p class="selected-detail"><span>Scale</span> ${esc(p.power_mw)} MW</p>` : ""}
      ${p.note ? `<p class="selected-detail"><span>Note</span> ${esc(p.note)}</p>` : ""}
      <a class="selected-link" href="${safeUrl(p.source_url)}" target="_blank" rel="noopener">Open source ↗</a>`;
  }

  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 42,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: group => {
      const count = group.getChildCount();
      const size = count > 9 ? 44 : 38;
      return L.divIcon({
        html: `<div class="cluster-bubble" style="width:${size}px;height:${size}px"><span>${count}</span></div>`,
        className: "",
        iconSize: [size, size]
      });
    }
  });

  const transmissionGroup = L.layerGroup();
  const markerMap = new Map();
  const pointByName = new Map(points.map(p => [p.name, p]));
  let activeMarker = null;
  let activePointName = null;
  const statuses = [...new Set(points.map(p => p.status))].sort();

  points.forEach(p => {
    const marker = L.marker([p.latitude, p.longitude], {
      icon: makeIcon(pointColor(p), false, p.layer),
      title: p.name
    });
    marker.bindPopup(makePopup(p), { maxWidth: 320, className: "tracker-popup", closeButton: true });
    marker.on("click", () => selectPoint(p.name, false));
    markerMap.set(p.name, marker);
  });
  map.addLayer(cluster);

  transmissionLines.forEach((line, i) => {
    if (!line.coordinates?.length) return;
    const isAlt = line.id.includes("route-b");
    const poly = L.polyline(line.coordinates, {
      color: isAlt ? "#c084fc" : "#9c5fc9",
      weight: isAlt ? 3 : 4,
      opacity: isAlt ? 0.55 : 0.85,
      dashArray: isAlt ? "10 8" : null
    });
    poly.bindPopup(makeLinePopup(line), { maxWidth: 340, className: "tracker-popup" });
    transmissionGroup.addLayer(poly);
    const mid = line.coordinates[Math.floor(line.coordinates.length / 2)];
    const label = L.marker(mid, {
      icon: L.divIcon({
        html: `<div class="line-label">${esc(line.name.replace("ITC ", ""))}</div>`,
        className: "line-label-wrap",
        iconSize: [0, 0]
      }),
      interactive: false
    });
    transmissionGroup.addLayer(label);
  });

  let activeRegion = initRegion;
  const filtersEl = $("#map-filters");
  const layersEl = $("#map-layers");
  const dirEl = $("#map-directory");
  const storiesEl = $("#map-stories");

  function pointVisible(p) {
    const layerOk = activeLayers.has(p.layer || "projects");
    const regionOk = activeRegion === "all" || regionForCounty(p.county) === activeRegion;
    const statusInp = filtersEl?.querySelector(`input[value="${CSS.escape(p.status)}"]`);
    const statusOk = !statusInp || statusInp.checked;
    return layerOk && regionOk && statusOk;
  }

  function refreshTransmission() {
    if (activeLayers.has("transmission")) map.addLayer(transmissionGroup);
    else map.removeLayer(transmissionGroup);
  }

  function refreshMarkers() {
    cluster.clearLayers();
    const visible = [];
    points.forEach(p => {
      if (pointVisible(p)) {
        cluster.addLayer(markerMap.get(p.name));
        visible.push(p);
      }
    });
    refreshTransmission();
    const countEl = $("#panel-record-count");
    if (countEl) countEl.textContent = `${visible.length} of ${points.length} records shown`;
    if (dirEl) {
      dirEl.innerHTML = [...visible].sort((a, b) => a.municipality.localeCompare(b.municipality) || a.name.localeCompare(b.name)).map(p =>
        `<button type="button" data-point="${esc(p.name)}">
          <span class="dir-dot" style="background:${pointColor(p)}"></span>
          <strong>${esc(p.name)}</strong>
          <small>${esc(p.municipality)} · ${esc(p.status)}</small>
        </button>`
      ).join("") || `<p class="dir-empty">No records match current filters.</p>`;
    }
    updateLayerCounts();
    updatePermalink();
  }

  function updateLayerCounts() {
    $$(".layer-toggle").forEach(el => {
      const id = el.dataset.layer;
      const n = points.filter(p => p.layer === id).length;
      const countSpan = el.querySelector(".layer-count");
      if (countSpan) countSpan.textContent = n;
    });
  }

  if (layersEl && layersMeta.length) {
    layersEl.innerHTML = layersMeta.map(l => {
      const n = points.filter(p => p.layer === l.id).length;
      const lineCount = l.id === "transmission" ? transmissionLines.length : 0;
      const total = l.id === "transmission" ? `${n} nodes · ${lineCount} corridors` : n;
      const on = activeLayers.has(l.id);
      return `<label class="layer-toggle ${on ? "" : "off"}" data-layer="${esc(l.id)}">
        <input type="checkbox" value="${esc(l.id)}" ${on ? "checked" : ""}>
        <span class="layer-swatch" style="background:${l.color}"></span>
        <span class="layer-copy">
          <span class="layer-name">${esc(l.label)}</span>
          <span class="layer-desc">${esc(l.description)}</span>
        </span>
        <span class="layer-count">${total}</span>
      </label>`;
    }).join("");
    layersEl.addEventListener("change", e => {
      if (!e.target.matches("input")) return;
      const id = e.target.value;
      if (e.target.checked) activeLayers.add(id);
      else activeLayers.delete(id);
      e.target.closest("label")?.classList.toggle("off", !e.target.checked);
      refreshMarkers();
    });
  }

  if (filtersEl) {
    filtersEl.innerHTML = statuses.map(s => {
      const c = STATUS_COLORS[s] || "#cf102d";
      const n = points.filter(p => p.status === s).length;
      const checked = !initFilters || initFilters.has(s);
      return `<label class="${checked ? "" : "off"}">
        <input type="checkbox" value="${esc(s)}" ${checked ? "checked" : ""}>
        <span class="filter-dot" style="background:${c}"></span>
        <span class="filter-name">${esc(s)}</span>
        <span class="filter-count">${n}</span>
      </label>`;
    }).join("");
    filtersEl.addEventListener("change", e => {
      if (!e.target.matches("input")) return;
      e.target.closest("label")?.classList.toggle("off", !e.target.checked);
      refreshMarkers();
    });
  }

  if (storiesEl && stories.length) {
    storiesEl.innerHTML = stories.map(s =>
      `<button type="button" class="story-card" data-story="${esc(s.id)}">
        <span class="story-kicker">${esc(s.kicker)}</span>
        <strong>${esc(s.title)}</strong>
        <small>${esc(s.region)}</small>
      </button>`
    ).join("");
    storiesEl.addEventListener("click", e => {
      const btn = e.target.closest("[data-story]");
      if (!btn) return;
      openStory(btn.dataset.story);
    });
  }

  function openStory(id) {
    const story = stories.find(s => s.id === id);
    if (!story) return;
    $$(".story-card").forEach(c => c.classList.toggle("active", c.dataset.story === id));
    const panel = $("#story-detail");
    if (panel) {
      panel.hidden = false;
      panel.innerHTML = `
        <div class="story-detail-kicker">${esc(story.kicker)} · ${esc(story.region)}</div>
        <h3>${esc(story.title)}</h3>
        <p>${esc(story.summary)}</p>
        <div class="story-detail-actions">
          <a href="${safeUrl(story.source_url)}" target="_blank" rel="noopener">${esc(story.source_name)} ↗</a>
          ${story.layer ? `<button type="button" data-focus-layer="${esc(story.layer)}">Show ${esc(LAYER_LABELS[story.layer] || story.layer)} layer</button>` : ""}
        </div>`;
      panel.querySelector("[data-focus-layer]")?.addEventListener("click", ev => {
        const layerId = ev.target.dataset.focusLayer;
        activeLayers.add(layerId);
        const inp = layersEl?.querySelector(`input[value="${CSS.escape(layerId)}"]`);
        if (inp) { inp.checked = true; inp.closest("label")?.classList.remove("off"); }
        refreshMarkers();
      });
    }
    if (story.fly_to) {
      map.flyTo([story.fly_to.lat, story.fly_to.lng], story.fly_to.zoom || 8, { animate: true, duration: 0.9 });
    }
    if (window.innerWidth <= 768) $("#map-sidebar")?.classList.add("open");
    updatePermalink(id);
  }

  $("#show-all")?.addEventListener("click", () => {
    $$("#map-filters input").forEach(inp => { inp.checked = true; inp.closest("label")?.classList.remove("off"); });
    $$(".region-chip").forEach(chip => chip.classList.toggle("active", chip.dataset.region === "all"));
    activeRegion = "all";
    activeLayers = new Set(layersMeta.map(l => l.id));
    $$("#map-layers input").forEach(inp => { inp.checked = true; inp.closest("label")?.classList.remove("off"); });
    refreshMarkers();
  });

  $$(".region-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.region === activeRegion);
    chip.addEventListener("click", () => {
      activeRegion = chip.dataset.region;
      $$(".region-chip").forEach(c => c.classList.toggle("active", c.dataset.region === activeRegion));
      refreshMarkers();
    });
  });

  function selectPoint(name, fly = true) {
    const marker = markerMap.get(name);
    const p = pointByName.get(name);
    if (!marker || !p) return;
    if (activeMarker && activeMarker !== marker && activePointName) {
      const prev = pointByName.get(activePointName);
      if (prev) activeMarker.setIcon(makeIcon(pointColor(prev), false, prev.layer));
    }
    activeMarker = marker;
    activePointName = name;
    marker.setIcon(makeIcon(pointColor(p), true, p.layer));
    $$("#map-directory button").forEach(btn => btn.classList.toggle("active", btn.dataset.point === name));
    renderSelected(p);
    if (fly) {
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 10), { animate: true, duration: 0.7 });
      setTimeout(() => marker.openPopup(), 750);
    }
    if (window.innerWidth <= 768) $("#map-sidebar")?.classList.add("open");
    updatePermalink();
  }

  function flyToPoint(name) { selectPoint(name, true); }

  if (dirEl) {
    dirEl.addEventListener("click", e => {
      const btn = e.target.closest("button[data-point]");
      if (btn) flyToPoint(btn.dataset.point);
    });
  }

  const searchEl = $("#map-search");
  const searchResults = $("#search-results");
  if (searchEl && searchResults) {
    searchEl.addEventListener("input", () => {
      const q = searchEl.value.trim().toLowerCase();
      if (!q || q.length < 2) { searchResults.innerHTML = ""; searchResults.hidden = true; return; }
      const matches = points.filter(p =>
        pointVisible(p) && (
          p.name.toLowerCase().includes(q) ||
          p.municipality.toLowerCase().includes(q) ||
          p.county.toLowerCase().includes(q) ||
          (p.developer || "").toLowerCase().includes(q) ||
          (p.note || "").toLowerCase().includes(q)
        )
      ).slice(0, 10);
      searchResults.hidden = matches.length === 0;
      searchResults.innerHTML = matches.map(p =>
        `<button type="button" data-point="${esc(p.name)}">
          <span class="dir-dot" style="background:${pointColor(p)}"></span>
          <span><strong>${esc(p.name)}</strong><small>${esc(p.municipality)} · ${esc(layerLabel(p))}</small></span>
        </button>`
      ).join("");
    });
    searchResults.addEventListener("click", e => {
      const btn = e.target.closest("button[data-point]");
      if (!btn) return;
      flyToPoint(btn.dataset.point);
      searchEl.value = "";
      searchResults.innerHTML = "";
      searchResults.hidden = true;
    });
  }

  function updatePermalink(storyId) {
    const c = map.getCenter();
    const p = new URLSearchParams();
    p.set("lat", c.lat.toFixed(4));
    p.set("lng", c.lng.toFixed(4));
    p.set("z", map.getZoom());
    if (currentMode !== "dark") p.set("mode", currentMode);
    if (activeRegion !== "all") p.set("region", activeRegion);
    const activeFilters = $$("#map-filters input:checked").map(i => i.value);
    if (activeFilters.length !== statuses.length) p.set("f", activeFilters.join(","));
    if (activeLayers.size !== layersMeta.length) p.set("layers", [...activeLayers].join(","));
    if (activePointName) p.set("point", activePointName);
    const sid = storyId || $$(".story-card.active")[0]?.dataset.story;
    if (sid) p.set("story", sid);
    history.replaceState(null, "", `?${p.toString()}`);
  }
  map.on("moveend zoomend", () => updatePermalink());

  $("#copy-link")?.addEventListener("click", () => {
    updatePermalink();
    navigator.clipboard.writeText(location.href).then(() => {
      const btn = $("#copy-link");
      if (btn) { btn.textContent = "Copied"; setTimeout(() => { btn.textContent = "Copy link"; }, 2000); }
    });
  });

  const externalMap = data.map_meta?.external_map;
  if (externalMap) {
    const link = $("#external-map-link");
    if (link) { link.href = externalMap.url; link.textContent = externalMap.label; link.hidden = false; }
  }

  const updEl = $("#map-updated");
  if (updEl && data.updated_at) {
    updEl.textContent = new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: "America/Detroit"
    }).format(new Date(data.updated_at));
  }

  const toggleBtn = $("#sidebar-toggle");
  const sidebar = $("#map-sidebar");
  const sidebarHeader = $("#sidebar-header");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      const open = sidebar.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", String(open));
      toggleBtn.textContent = open ? "Close panel" : "Open panel";
    });
  }
  if (sidebarHeader && sidebar) {
    sidebarHeader.addEventListener("click", () => {
      if (window.innerWidth > 768) return;
      const open = sidebar.classList.toggle("open");
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-expanded", String(open));
        toggleBtn.textContent = open ? "Close panel" : "Open panel";
      }
    });
  }

  refreshMarkers();
  if (initStory) openStory(initStory);
  else if (initPoint && markerMap.has(initPoint)) selectPoint(initPoint, true);
})();