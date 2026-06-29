(() => {
  const data = window.TRACKER_DATA || {};
  const points = (data.map_points || []).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const esc = v => String(v || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUrl = v => { try { const u = new URL(String(v||""),location.href); return ["http:","https:"].includes(u.protocol)?esc(u.href):"#"; } catch{return "#";} };

  // Color palette — red brand for active, muted for passive
  const colors = {
    "Under construction":            "#cf102d",
    "Proposed":                      "#3a7bd5",
    "Moratorium":                    "#e09820",
    "Utility pause":                 "#9c5fc9",
    "Rejected by planning commission":"#5a6070",
    "Approved":                      "#22a86a"
  };
  const fallback = "#cf102d";

  // Dark tile layer
  const map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true
  }).setView([44.55, -85.45], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '© <a href="https://openstreetmap.org/copyright" style="color:#4e5468">OpenStreetMap</a>'
  }).addTo(map);

  // Custom glowing marker icon
  function makeIcon(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="14" fill="${color}" fill-opacity=".12"/>
      <circle cx="18" cy="18" r="8" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width=".8" stroke-opacity=".5"/>
      <circle cx="18" cy="18" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"
        style="filter:drop-shadow(0 0 5px ${color})"/>
      <circle cx="16.5" cy="16.5" r="1.2" fill="#fff" fill-opacity=".9"/>
    </svg>`;
    return L.divIcon({
      html: svg,
      className: "",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -22]
    });
  }

  // Popup HTML
  function makePopup(p) {
    const color = colors[p.status] || fallback;
    return `<div class="map-popup">
      <div class="pop-header" style="--c:${color}">
        <span class="pop-status">${esc(p.status)}${p.confidence ? ` · ${esc(p.confidence)}` : ""}</span>
        <div class="pop-name">${esc(p.name)}</div>
        <div class="pop-location">${esc(p.municipality)}, ${esc(p.county)} County</div>
      </div>
      <div class="pop-body">
        ${p.developer ? `<div class="pop-row"><span class="pop-label">Developer</span><span class="pop-val">${esc(p.developer)}</span></div>` : ""}
        ${p.power_mw  ? `<div class="pop-row"><span class="pop-label">Scale</span><span class="pop-val">${esc(p.power_mw)} MW reported</span></div>` : ""}
        ${p.note      ? `<p class="pop-note">${esc(p.note)}</p>` : ""}
      </div>
      <div class="pop-footer">
        <a class="pop-source" href="${safeUrl(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_name || "Source")}</a>
      </div>
    </div>`;
  }

  // Layers
  const layers = new Map();
  const markers = new Map();
  const statuses = [...new Set(points.map(p => p.status))];
  statuses.forEach(s => layers.set(s, L.layerGroup().addTo(map)));

  points.forEach(p => {
    const color = colors[p.status] || fallback;
    const marker = L.marker([p.latitude, p.longitude], {
      icon: makeIcon(color),
      title: p.name
    }).bindPopup(makePopup(p), { maxWidth: 320 });
    marker.addTo(layers.get(p.status));
    markers.set(p.name, marker);
  });

  // Filters
  const filtersEl = document.querySelector("#map-filters");
  filtersEl.innerHTML = statuses.map(s => {
    const color = colors[s] || fallback;
    const count = points.filter(p => p.status === s).length;
    return `<label data-status="${esc(s)}">
      <input type="checkbox" value="${esc(s)}" checked>
      <span class="filter-dot" style="--marker:${color}; background:${color}; box-shadow:0 0 7px ${color};"></span>
      <span class="filter-name">${esc(s)}</span>
      <span class="filter-count">${count}</span>
    </label>`;
  }).join("");

  filtersEl.addEventListener("change", e => {
    if (!e.target.matches("input")) return;
    const label = e.target.closest("label");
    const layer = layers.get(e.target.value);
    if (e.target.checked) { layer.addTo(map); label.classList.remove("off"); }
    else { map.removeLayer(layer); label.classList.add("off"); }
  });

  document.querySelector("#show-all").addEventListener("click", () => {
    filtersEl.querySelectorAll("input").forEach(inp => {
      inp.checked = true;
      inp.closest("label").classList.remove("off");
      layers.get(inp.value).addTo(map);
    });
  });

  // Directory
  const dirEl = document.querySelector("#map-directory");
  dirEl.innerHTML = [...points].sort((a,b) => a.name.localeCompare(b.name)).map(p => {
    const color = colors[p.status] || fallback;
    return `<button type="button" data-point="${esc(p.name)}">
      <span class="dir-dot" style="--marker:${color}; background:${color}; box-shadow:0 0 6px ${color};"></span>
      <strong>${esc(p.name)}</strong>
      <small>${esc(p.municipality)} · ${esc(p.status)}</small>
    </button>`;
  }).join("");

  dirEl.addEventListener("click", e => {
    const btn = e.target.closest("button[data-point]");
    if (!btn) return;
    const marker = markers.get(btn.dataset.point);
    if (!marker) return;
    const p = points.find(pt => pt.name === btn.dataset.point);
    if (p) {
      const inp = [...filtersEl.querySelectorAll("input")].find(i => i.value === p.status);
      if (inp && !inp.checked) {
        inp.checked = true;
        inp.closest("label").classList.remove("off");
        layers.get(p.status).addTo(map);
      }
    }
    map.setView(marker.getLatLng(), 10, { animate: true });
    marker.openPopup();
    // close mobile sidebar
    const sidebar = document.querySelector("#map-sidebar");
    if (sidebar) { sidebar.classList.remove("open"); }
  });

  // Legend
  const legendEl = document.querySelector("#hud-legend");
  if (legendEl) {
    legendEl.innerHTML = `<div class="legend-title">Status key</div>` +
      statuses.map(s => {
        const color = colors[s] || fallback;
        return `<div class="legend-row">
          <span class="legend-swatch" style="background:${color}; color:${color};"></span>
          ${esc(s)}
        </div>`;
      }).join("");
  }

  // HUD record count
  const countEl = document.querySelector("#hud-record-count");
  if (countEl) countEl.textContent = `${points.length} records`;

  // Updated timestamp
  const updEl = document.querySelector("#map-updated");
  if (updEl && data.updated_at) {
    updEl.textContent = `Updated ${new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", timeZone: "America/Detroit"
    }).format(new Date(data.updated_at))}`;
  }

  // Mobile sidebar toggle
  const toggleBtn = document.querySelector("#sidebar-toggle");
  const sidebar = document.querySelector("#map-sidebar");
  const sidebarHeader = document.querySelector("#sidebar-header");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      const open = sidebar.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", String(open));
      toggleBtn.textContent = open ? "Close ↓" : "Filter & Directory ↑";
    });
  }
  // Also tap sidebar header on mobile to toggle
  if (sidebarHeader && sidebar) {
    sidebarHeader.addEventListener("click", e => {
      if (window.innerWidth <= 768 && !e.target.closest("button")) {
        sidebar.classList.toggle("open");
      }
    });
  }
})();
