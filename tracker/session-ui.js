/* Populate the signed-in account chip and support a safe sign-out. */
(function () {
  var button = document.getElementById("trace-signout");
  var account = document.getElementById("trace-account");
  var accountName = document.getElementById("trace-account-name");
  var accountAvatar = document.getElementById("trace-account-avatar");
  var accountRole = document.getElementById("trace-account-role");
  if (!button || !account) return;

  var isLocalDemo = (location.hostname === "localhost" || location.hostname === "127.0.0.1") && location.port === "3000";
  var API = isLocalDemo ? "http://localhost:4000/api" : "/api";

  fetch(API + "/auth/me", { credentials: "include" })
    .then(function (response) {
      if (!response.ok) return null;
      return response.json();
    })
    .then(function (session) {
      if (!session || !session.authenticated) {
        account.hidden = true;
        button.hidden = true;
        return;
      }

      var username = String(session.username || "Account");
      var role = String(session.role || "user").toUpperCase();
      accountName.textContent = username;
      accountAvatar.textContent = (Array.from(username.trim())[0] || "U").toUpperCase();
      accountRole.textContent = role;
      account.setAttribute("aria-label", "Signed in as " + username + " (" + role + ")");
      account.hidden = false;
      button.hidden = false;
    })
    .catch(function () {
      account.hidden = true;
      button.hidden = true;
    });

  button.addEventListener("click", async function () {
    button.disabled = true;
    button.textContent = "Signing out…";
    try {
      var response = await fetch(API + "/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Logout request failed");
      window.location.replace("/");
    } catch (_error) {
      button.disabled = false;
      button.textContent = "Sign out";
      window.alert("Sign out failed. Please check your connection and try again.");
    }
  });
})();
