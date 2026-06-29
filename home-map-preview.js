/**
 * Homepage live-map thumbnail — rotates through zoomed views and layer filters.
 */
(function (global) {
  const SVG_SIZE = { w: 1200, h: 720 };
  const GEO = { north: 45.48, south: 41.7, west: -87.02, east: -82.38 };
  const PAD = { left: 92, right: 88, top: 36, bottom: 44 };
  const MAP_BG = ["#dfe8f2", "#c8d6e6"];
  const LAYER_COLORS = {
    projects: "#cf102d",
    moratoria: "#d4a017",
    meetings: "#4a8fe7",
    transmission: "#8b5cf6",
    policy: "#22a86a",
    generation: "#5c6b7a"
  };

  const SLIDE_DEFS = [
    {
      id: "statewide",
      label: "Statewide view",
      kicker: "Projects · moratoria · hearings",
      layers: ["projects", "moratoria", "meetings"],
      href: "map.html"
    },
    {
      id: "metro",
      label: "Metro Detroit",
      kicker: "Active proposals",
      layers: ["projects"],
      fit: p => p.longitude > -84.05 && p.latitude < 42.85,
      minZoom: { w: 380, h: 240 },
      href: "map.html?lat=42.35&lng=-83.55&zoom=9&layers=projects"
    },
    {
      id: "moratoria",
      label: "Moratoria wave",
      kicker: "Local pauses mapped",
      layers: ["moratoria"],
      href: "map.html?layers=moratoria"
    },
    {
      id: "generation",
      label: "Power generation",
      kicker: "Plants & grid nodes",
      layers: ["generation"],
      href: "map.html?layers=generation"
    },
    {
      id: "grid",
      label: "Power & grid",
      kicker: "Transmission corridors",
      layers: ["transmission"],
      lines: true,
      fit: p => p.layer === "transmission" || (p.latitude > 42.62 && p.latitude < 42.82 && p.longitude > -85.1 && p.longitude < -83.8),
      minZoom: { w: 420, h: 300 },
      href: "map.html?layers=transmission"
    },
    {
      id: "meetings",
      label: "Public hearings",
      kicker: "Upcoming sessions",
      layers: ["meetings"],
      fit: p => p.layer === "meetings",
      minZoom: { w: 360, h: 260 },
      href: "map.html?layers=meetings"
    }
  ];

  let countyMarkup = "";
  let countyPromise = null;

  function project(lat, lng) {
    const innerW = SVG_SIZE.w - PAD.left - PAD.right;
    const innerH = SVG_SIZE.h - PAD.top - PAD.bottom;
    const x = PAD.left + ((lng - GEO.west) / (GEO.east - GEO.west)) * innerW;
    const y = PAD.top + ((GEO.north - lat) / (GEO.north - GEO.south)) * innerH;
    return [x, y];
  }

  function iconInner(layer, color, status = "") {
    const shapes = {
      moratoria: `<rect x="5" y="5" width="14" height="14" rx="2.2" fill="${color}" stroke="#fff" stroke-width="1.6"/>`,
      meetings: `<circle cx="12" cy="12" r="7.2" fill="${color}" stroke="#fff" stroke-width="1.6"/>`,
      transmission: `<path d="M12 2.5L7.5 12.5H11l-1 9.5 6.5-11.5H13.5L12 2.5z" fill="${color}" stroke="#fff" stroke-width="1.3"/>`,
      policy: `<polygon points="12,2.5 15,9.5 22,9.5 16.5,14 18.5,21.5 12,17.5 5.5,21.5 7.5,14 2,9.5 9,9.5" fill="${color}" stroke="#fff" stroke-width="1.2"/>`,
      generation: `<rect x="4" y="9" width="16" height="10" rx="2" fill="${color}" stroke="#fff" stroke-width="1.3"/><rect x="10" y="4" width="4" height="6.5" fill="${color}" stroke="#fff" stroke-width="1.2"/>`
    };
    const genShapes = {
      Nuclear: `<circle cx="12" cy="12" r="2.4" fill="${color}" stroke="#fff" stroke-width="1.1"/><ellipse cx="12" cy="12" rx="8.5" ry="3.2" fill="none" stroke="${color}" stroke-width="1.3"/><ellipse cx="12" cy="12" rx="8.5" ry="3.2" fill="none" stroke="${color}" stroke-width="1.3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.5" ry="3.2" fill="none" stroke="${color}" stroke-width="1.3" transform="rotate(-60 12 12)"/>`,
      Wind: `<path d="M12 4v16M12 12L6.5 18M12 12l5.5 6" stroke="${color}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2.4" fill="${color}" stroke="#fff" stroke-width="1.2"/>`,
      Solar: `<circle cx="12" cy="12" r="4.5" fill="${color}" stroke="#fff" stroke-width="1.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`
    };
    if (layer === "generation" && genShapes[status]) return genShapes[status];
    if (shapes[layer]) return shapes[layer];
    return `<path d="M12 2.2c-3.2 0-5.8 2.4-5.8 5.4 0 4 5.8 11.8 5.8 11.8s5.8-7.8 5.8-11.8c0-3-2.6-5.4-5.8-5.4z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="7.5" r="2" fill="#fff" fill-opacity=".92"/>`;
  }

  function loadCountyMarkup() {
    if (countyMarkup) return Promise.resolve(countyMarkup);
    if (countyPromise) return countyPromise;
    countyPromise = fetch("home-map-preview.svg?v=20260701p")
      .then(res => {
        if (!res.ok) throw new Error(`preview svg ${res.status}`);
        return res.text();
      })
      .then(text => {
        const match = text.match(/<g fill="#e8eef4"[^>]*>([\s\S]*?)<\/g>/);
        countyMarkup = match ? match[1] : "";
        return countyMarkup;
      })
      .catch(() => {
        countyMarkup = "";
        return countyMarkup;
      });
    return countyPromise;
  }

  function computeView(points, slide) {
    const layers = new Set(slide.layers);
    const filtered = points.filter(p => {
      if (!layers.has(p.layer || "projects")) return false;
      return slide.fit ? slide.fit(p) : true;
    });

    if (!filtered.length) return { x: 0, y: 0, w: SVG_SIZE.w, h: SVG_SIZE.h, count: 0 };

    const coords = filtered.map(p => project(p.latitude, p.longitude));
    const xs = coords.map(c => c[0]);
    const ys = coords.map(c => c[1]);

    if (slide.lines && !slide.fit) {
      return { x: 0, y: 0, w: SVG_SIZE.w, h: SVG_SIZE.h, count: filtered.length };
    }

    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const padX = Math.max(spanX * 0.22, 48);
    const padY = Math.max(spanY * 0.22, 40);

    let w = spanX + padX * 2;
    let h = spanY + padY * 2;
    if (slide.minZoom) {
      w = Math.max(w, slide.minZoom.w);
      h = Math.max(h, slide.minZoom.h);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let x = cx - w / 2;
    let y = cy - h / 2;

    x = Math.max(0, Math.min(x, SVG_SIZE.w - w));
    y = Math.max(0, Math.min(y, SVG_SIZE.h - h));
    w = Math.min(w, SVG_SIZE.w - x);
    h = Math.min(h, SVG_SIZE.h - y);

    return { x, y, w, h, count: filtered.length };
  }

  function expandViewForLines(view, lines, minZoom) {
    if (!lines?.length) return view;
    const pts = lines.flatMap(l => (l.coordinates || []).map(([lat, lng]) => project(lat, lng)));
    if (!pts.length) return view;
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const minX = Math.min(...xs, view.x);
    const minY = Math.min(...ys, view.y);
    const maxX = Math.max(...xs, view.x + view.w);
    const maxY = Math.max(...ys, view.y + view.h);
    const padX = 36;
    const padY = 28;
    let w = maxX - minX + padX * 2;
    let h = maxY - minY + padY * 2;
    if (minZoom) {
      w = Math.max(w, minZoom.w);
      h = Math.max(h, minZoom.h);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let x = Math.max(0, cx - w / 2);
    let y = Math.max(0, cy - h / 2);
    w = Math.min(w, SVG_SIZE.w - x);
    h = Math.min(h, SVG_SIZE.h - y);
    return { ...view, x, y, w, h };
  }

  function buildSlides(data) {
    const points = (data.map_points || []).filter(
      p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    );

    return SLIDE_DEFS.map(def => {
      let view = computeView(points, def);
      if (def.lines) view = expandViewForLines(view, data.transmission_lines, def.minZoom);
      if (!def.fit && !def.lines) {
        view = { x: 0, y: 0, w: SVG_SIZE.w, h: SVG_SIZE.h, count: view.count };
      }
      return { ...def, view };
    }).filter(slide => slide.count > 0 || slide.lines);
  }

  function renderMarker(point, layers, focus) {
    if (!layers.has(point.layer || "projects")) return "";
    const [x, y] = project(point.latitude, point.longitude);
    const color = LAYER_COLORS[point.layer] || LAYER_COLORS.projects;
    const focused = focus
      && Math.abs(point.latitude - focus.lat) < 0.08
      && Math.abs(point.longitude - focus.lng) < 0.12;
    const size = focused ? 20 : 16;
    const glow = focused ? 13 : 10;
    const inner = iconInner(point.layer, color, point.status);
    const cls = focused ? ' class="home-map-preview-pulse"' : "";
    return `<g transform="translate(${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)})"${cls}>
<circle cx="${(size / 2).toFixed(1)}" cy="${(size / 2).toFixed(1)}" r="${glow}" fill="${color}" opacity=".22"/>
<svg x="0" y="0" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>
</g>`;
  }

  function renderLines(lines, view) {
    if (!lines?.length) return "";
    return lines.map(line => {
      const coords = (line.coordinates || [])
        .map(([lat, lng]) => project(lat, lng))
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
      if (!coords) return "";
      return `<polyline points="${coords}" fill="none" stroke="${LAYER_COLORS.transmission}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
<polyline points="${coords}" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/>`;
    }).join("");
  }

  function renderSlideSvg(slide, data) {
    const { view, id } = slide;
    const layers = new Set(slide.layers);
    const points = (data.map_points || []).filter(
      p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    );
    const pointMarkup = points.map(p => renderMarker(p, layers, slide.focus)).join("");
    const lineMarkup = slide.lines ? renderLines(data.transmission_lines, view) : "";
    const vb = `${view.x} ${view.y} ${view.w} ${view.h}`;
    const tint = slide.id === "moratoria"
      ? `<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="rgba(212,160,23,.06)"/>`
      : "";

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs>
<linearGradient id="bg-${id}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="${MAP_BG[0]}"/>
<stop offset="100%" stop-color="${MAP_BG[1]}"/>
</linearGradient>
</defs>
<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#bg-${id})"/>
<path d="M0,0 L220,0 L180,720 L0,720 Z" fill="#b8cfe0" opacity=".4"/>
<path d="M1020,0 L1200,0 L1200,720 L980,720 Z" fill="#b8cfe0" opacity=".4"/>
<g fill="#e8eef4" stroke="#8fa3b8" stroke-width="1.1" stroke-linejoin="round">${countyMarkup}</g>
${tint}
<g>${lineMarkup}${pointMarkup}</g>
</svg>`;
  }

  function layerSwatch(slide) {
    const layer = slide.layers[0] || "projects";
    const color = LAYER_COLORS[layer] || LAYER_COLORS.projects;
    const inner = iconInner(layer, color);
    return `<span class="home-map-preview-swatch home-map-preview-swatch--icon" style="color:${color}"><svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg></span>`;
  }

  async function init(options = {}) {
    const root = document.getElementById(options.slidesId || "home-map-preview-slides");
    const link = document.getElementById(options.linkId || "home-map-preview-link");
    const chip = document.getElementById(options.chipId || "home-map-preview-chip");
    const dotsRoot = document.getElementById(options.dotsId || "home-map-preview-dots");
    if (!root || !link) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let mapData = options.mapData || null;

    try {
      await loadCountyMarkup();
      if (!mapData) {
        const version = options.mapVersion || "20260701w";
        mapData = await global.HomeStats.loadMapData(`map-data.json?v=${version}`);
      }
    } catch (err) {
      console.error("[home-map-preview]", err);
      root.innerHTML = `<img src="home-map-preview.svg?v=20260701p" width="1200" height="720" alt="" loading="lazy" decoding="async">`;
      return;
    }

    const slides = buildSlides(mapData);
    if (!slides.length) return;

    root.innerHTML = slides.map((slide, i) => `
      <div class="home-map-preview-slide${i === 0 ? " is-active" : ""}" data-slide="${slide.id}" data-href="${slide.href}">
        ${renderSlideSvg(slide, mapData)}
      </div>`).join("");

    if (dotsRoot) {
      dotsRoot.innerHTML = slides.map((_, i) =>
        `<button type="button" class="home-map-preview-dot${i === 0 ? " is-active" : ""}" aria-label="Map view ${i + 1}"></button>`
      ).join("");
    }

    const slideEls = [...root.querySelectorAll(".home-map-preview-slide")];
    const dots = dotsRoot ? [...dotsRoot.querySelectorAll(".home-map-preview-dot")] : [];
    let index = 0;
    let timer = null;

    const applySlide = next => {
      index = ((next % slideEls.length) + slideEls.length) % slideEls.length;
      const slide = slides[index];
      slideEls.forEach((el, i) => el.classList.toggle("is-active", i === index));
      dots.forEach((el, i) => el.classList.toggle("is-active", i === index));
      link.href = slide.href;
      if (chip) {
        chip.innerHTML = `${layerSwatch(slide)}<span class="home-map-preview-chip-text"><strong>${slide.label}</strong><span>${slide.kicker}</span></span>`;
      }
      return index;
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      stop();
      if (reducedMotion.matches || slideEls.length < 2) return;
      timer = setInterval(() => applySlide(index + 1), 3800);
    };

    dots.forEach((dot, i) => {
      dot.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        applySlide(i);
        start();
      });
    });

    link.addEventListener("mouseenter", stop);
    link.addEventListener("mouseleave", start);
    link.addEventListener("focusin", stop);
    link.addEventListener("focusout", start);

    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) stop();
      else start();
    });

    applySlide(0);
    start();
  }

  global.HomeMapPreview = { init, SLIDE_DEFS };
})(window);