/* Show a sign-out control for authenticated sessions and return to the login page. */
(function () {
  var button = document.getElementById("trace-signout");
  if (!button) return;

  var isLocalDemo = (location.hostname === "localhost" || location.hostname === "127.0.0.1") && location.port === "3000";
  var API = isLocalDemo ? "http://localhost:4000/api" : "/api";

  fetch(API + "/auth/me", { credentials: "include" })
    .then(function (response) {
      if (!response.ok) return null;
      return response.json();
    })
    .then(function (user) {
      if (user && user.authenticated) button.hidden = false;
    })
    .catch(function () {});

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
