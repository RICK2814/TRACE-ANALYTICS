/* Shared account dropdown for Admin and User pages. */
(function () {
  var trigger = document.getElementById("trace-account-trigger");
  var menu = document.getElementById("trace-account-menu");
  var dropdown = document.getElementById("trace-account-dropdown");
  var signIn = document.getElementById("trace-signin");
  var signOut = document.getElementById("trace-signout");
  var nameNode = document.getElementById("trace-account-name");
  var avatarNode = document.getElementById("trace-account-avatar");
  var roleNode = document.getElementById("trace-account-role");
  var menuTitle = document.getElementById("trace-account-menu-title");
  var menuDescription = document.getElementById("trace-account-menu-description");
  if (!trigger || !menu || !dropdown || !signIn || !signOut) return;

  var isLocalDemo = (location.hostname === "localhost" || location.hostname === "127.0.0.1") && location.port === "3000";
  var API = isLocalDemo ? "http://localhost:4000/api" : "/api";

  function closeMenu() {
    dropdown.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Open account menu");
  }
  function toggleMenu() {
    var opening = dropdown.hidden;
    dropdown.hidden = !opening;
    trigger.setAttribute("aria-expanded", String(opening));
    trigger.setAttribute("aria-label", opening ? "Close account menu" : "Open account menu");
  }
  function showGuest() {
    if (nameNode) nameNode.textContent = "Account";
    if (avatarNode) avatarNode.textContent = "A";
    if (roleNode) roleNode.textContent = "GUEST";
    if (menuTitle) menuTitle.textContent = "Welcome to Trail Co.";
    if (menuDescription) menuDescription.textContent = "Sign in to access your account.";
    signIn.hidden = false;
    signOut.hidden = true;
  }

  trigger.addEventListener("click", toggleMenu);
  document.addEventListener("click", function (event) {
    if (!menu.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  fetch(API + "/auth/me", { credentials: "include", cache: "no-store" })
    .then(function (response) {
      if (!response.ok) return null;
      return response.json();
    })
    .then(function (session) {
      if (!session || !session.authenticated) {
        showGuest();
        return;
      }
      var username = String(session.username || "Account");
      var role = String(session.role || "user").toUpperCase();
      if (nameNode) nameNode.textContent = username;
      if (avatarNode) avatarNode.textContent = (Array.from(username.trim())[0] || "U").toUpperCase();
      if (roleNode) roleNode.textContent = role;
      if (menuTitle) menuTitle.textContent = "Signed in as " + username;
      if (menuDescription) menuDescription.textContent = role + " account";
      signIn.hidden = true;
      signOut.hidden = false;
    })
    .catch(showGuest);

  signIn.addEventListener("click", function () { closeMenu(); });
  signOut.addEventListener("click", async function () {
    signOut.disabled = true;
    signOut.textContent = "Signing out…";
    try {
      var response = await fetch(API + "/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Logout request failed");
      window.location.replace("/");
    } catch (_error) {
      signOut.disabled = false;
      signOut.textContent = "Sign out ↗";
      window.alert("Sign out failed. Please check your connection and try again.");
    }
  });
})();
