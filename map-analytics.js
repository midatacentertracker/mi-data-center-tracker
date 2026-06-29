/* Michigan Data Center Tracker — privacy-friendly map engagement analytics */
(function (global) {
  const QUEUE_KEY = "mi_map_analytics_queue";
  const STATS_KEY = "mi_map_analytics_stats";
  const SESSION_KEY = "mi_map_analytics_session";
  const MAX_QUEUE = 200;

  const config = {
    endpoint: "",
    plausibleDomain: "",
    debug: false
  };

  let sessionId = "";
  let sessionStart = 0;
  let activeMs = 0;
  let lastActiveAt = 0;
  let heartbeatTimer = null;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function slugify(value) {
    return String(value || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "unknown";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function ensureSession() {
    if (sessionId) return sessionId;
    const existing = readJson(SESSION_KEY, null);
    const maxAge = 30 * 60 * 1000;
    if (existing?.id && Date.now() - (existing.started_at_ms || 0) < maxAge) {
      sessionId = existing.id;
      sessionStart = existing.started_at_ms || Date.now();
      return sessionId;
    }
    sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStart = Date.now();
    writeJson(SESSION_KEY, { id: sessionId, started_at_ms: sessionStart });
    return sessionId;
  }

  function bumpStats(mutator) {
    const stats = readJson(STATS_KEY, {
      map_loads: 0,
      marker_clicks: 0,
      searches: 0,
      filter_changes: 0,
      layer_toggles: 0,
      tab_views: {},
      records: {},
      total_active_seconds: 0
    });
    mutator(stats);
    writeJson(STATS_KEY, stats);
    return stats;
  }

  function enqueue(event) {
    const queue = readJson(QUEUE_KEY, []);
    queue.push(event);
    while (queue.length > MAX_QUEUE) queue.shift();
    writeJson(QUEUE_KEY, queue);
    if (config.debug) console.info("[map-analytics]", event.name, event.props || {});
  }

  function sendBeacon(event) {
    if (!config.endpoint) return;
    try {
      const body = JSON.stringify(event);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(config.endpoint, new Blob([body], { type: "application/json" }));
      } else {
        fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true
        }).catch(() => {});
      }
    } catch (_) {}
  }

  function track(name, props = {}) {
    ensureSession();
    bumpStats(stats => {
      if (name === "search") stats.searches = (stats.searches || 0) + 1;
      if (name === "filter_change") stats.filter_changes = (stats.filter_changes || 0) + 1;
      if (name === "layer_toggle") stats.layer_toggles = (stats.layer_toggles || 0) + 1;
      if (name === "tab_view" && props.tab) {
        stats.tab_views = stats.tab_views || {};
        stats.tab_views[props.tab] = (stats.tab_views[props.tab] || 0) + 1;
      }
    });
    const payload = {
      name,
      at: nowIso(),
      session_id: sessionId,
      path: location.pathname,
      props: { ...props }
    };
    enqueue(payload);
    sendBeacon(payload);
    if (config.plausibleDomain && global.plausible) {
      try {
        global.plausible(name, { props });
      } catch (_) {}
    }
  }

  function recordAttention(recordId, recordName, layer, status) {
    const id = slugify(recordId || recordName);
    bumpStats(stats => {
      stats.marker_clicks = (stats.marker_clicks || 0) + 1;
      if (!stats.records[id]) {
        stats.records[id] = {
          name: recordName || id,
          layer: layer || "",
          status: status || "",
          views: 0,
          last_viewed_at: null
        };
      }
      stats.records[id].views += 1;
      stats.records[id].last_viewed_at = nowIso();
    });
    track("marker_click", {
      record_id: id,
      record_name: recordName,
      layer,
      status
    });
  }

  function markActive() {
    const now = Date.now();
    if (lastActiveAt) activeMs += Math.min(now - lastActiveAt, 60000);
    lastActiveAt = now;
  }

  function markIdle() {
    if (!lastActiveAt) return;
    activeMs += Math.min(Date.now() - lastActiveAt, 60000);
    lastActiveAt = 0;
  }

  function flushSessionTime() {
    markActive();
    const seconds = Math.round(activeMs / 1000);
    if (seconds < 5) return;
    bumpStats(stats => {
      stats.total_active_seconds = (stats.total_active_seconds || 0) + seconds;
    });
    track("session_time", { seconds, cumulative_seconds: getStats().total_active_seconds });
    activeMs = 0;
  }

  function init(options = {}) {
    Object.assign(config, options);
    ensureSession();
    bumpStats(stats => { stats.map_loads = (stats.map_loads || 0) + 1; });
    track("map_load", {
      referrer: document.referrer || "",
      viewport: `${window.innerWidth}x${window.innerHeight}`
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        markIdle();
        flushSessionTime();
      } else {
        markActive();
      }
    });
    window.addEventListener("pagehide", () => {
      markIdle();
      flushSessionTime();
    });
    window.addEventListener("focus", markActive);
    window.addEventListener("blur", () => { markIdle(); flushSessionTime(); });

    markActive();
    heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        markActive();
        if (activeMs >= 30000) flushSessionTime();
      }
    }, 15000);
  }

  function getQueue() {
    return readJson(QUEUE_KEY, []);
  }

  function getStats() {
    return readJson(STATS_KEY, {});
  }

  function getTopRecords(limit = 10) {
    const stats = getStats();
    return Object.entries(stats.records || {})
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, limit);
  }

  function getSponsorReport() {
    const stats = getStats();
    return {
      generated_at: nowIso(),
      map_loads: stats.map_loads || 0,
      marker_clicks: stats.marker_clicks || 0,
      searches: stats.searches || 0,
      filter_changes: stats.filter_changes || 0,
      layer_toggles: stats.layer_toggles || 0,
      total_active_minutes: Math.round((stats.total_active_seconds || 0) / 60),
      tab_views: stats.tab_views || {},
      top_records: getTopRecords(12)
    };
  }

  global.MapAnalytics = {
    init,
    track,
    recordAttention,
    getQueue,
    getStats,
    getTopRecords,
    getSponsorReport
  };
})(window);