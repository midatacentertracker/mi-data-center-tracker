/* Mobile map boot — Safari/Chrome cache bust + legacy HUD strip */
(function () {
  "use strict";
  var BUILD = "20260706c";
  var STORE_KEY = "mi-map-build";

  if (location.search.indexOf("v=" + BUILD) < 0) {
    try { sessionStorage.setItem(STORE_KEY, BUILD); } catch (_) {}
    location.replace(location.pathname + "?v=" + BUILD + location.hash);
    return;
  }

  try { sessionStorage.setItem(STORE_KEY, BUILD); } catch (_) {}

  function applyMobileBoot() {
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    document.documentElement.classList.add("map-mobile");
    document.querySelector(".map-hud")?.remove();

    var style = document.getElementById("map-mobile-runtime");
    if (!style) {
      style = document.createElement("style");
      style.id = "map-mobile-runtime";
      style.textContent = [
        ".map-hud{display:none!important;visibility:hidden!important}",
        ".map-topbar-brand,.map-topbar-actions,.map-mob-toolbar,.tile-toggle{display:none!important}",
        ".map-mob-head{display:flex!important}",
        ".map-topbar{height:calc(env(safe-area-inset-top,0px) + 48px)!important;padding:calc(4px + env(safe-area-inset-top,0px)) 12px 4px!important}",
        "#map{top:calc(env(safe-area-inset-top,0px) + 48px)!important;bottom:calc(40px + env(safe-area-inset-bottom,0px))!important}",
        ".map-panel{position:fixed!important;bottom:0!important;left:0!important;right:0!important;width:100%!important;top:auto!important}"
      ].join("");
      document.head.appendChild(style);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyMobileBoot);
  } else {
    applyMobileBoot();
  }
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) applyMobileBoot();
  });
})();