/*! Simple analytics tracker.
 * Usage: <script src="/tracker.js" data-api="/api/events"></script>
 */
(function () {
  var script = document.currentScript;
  var configuredAPI = script && script.getAttribute("data-api");
  var isLocalDemo = (location.hostname === "localhost" || location.hostname === "127.0.0.1") && location.port === "3000";
  var API = configuredAPI || (isLocalDemo ? "http://localhost:4000/api/events" : "/api/events");
  var KEY = "cf_session";
  var TIMEOUT = 30 * 60 * 1000;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function session() {
    var now = Date.now(), s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!s || !s.id || now - s.last > TIMEOUT) s = { id: uuid(), last: now };
    s.last = now;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s.id;
  }

  function pageUrl() { return location.origin + location.pathname; }

  function send(evt) {
    var payload = Object.assign({
      session_id: session(),
      url: pageUrl(),
      timestamp: new Date().toISOString()
    }, evt);
    try {
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function pageView() { send({ type: "page_view" }); }
  pageView();

  document.addEventListener("click", function (e) {
    var de = document.documentElement;
    send({
      type: "click",
      x: Math.round(e.pageX),
      y: Math.round(e.pageY),
      page_w: Math.max(de.scrollWidth, de.clientWidth),
      page_h: Math.max(de.scrollHeight, de.clientHeight)
    });
  }, true);

  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      var before = pageUrl();
      var r = orig.apply(this, arguments);
      if (pageUrl() !== before) pageView();
      return r;
    };
  });
  window.addEventListener("popstate", pageView);
})();
