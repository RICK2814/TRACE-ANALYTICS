/*! Simple analytics tracker.
 *  Usage: <script src="tracker.js" data-api="https://your-api/api/events"></script>
 */
(function () {
  var script = document.currentScript;
  var API = (script && script.getAttribute("data-api")) || "http://localhost:4000/api/events";
  var KEY = "cf_session";
  var TIMEOUT = 30 * 60 * 1000; // new session after 30 min of inactivity

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Session id lives in localStorage and is renewed after inactivity.
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
        headers: { "Content-Type": "text/plain" }, // simple request, no preflight
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

  // Single page apps: count route changes as page views.
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
