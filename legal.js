/* Use the light/dark choice saved on the hub, if there is one. */
(function () {
  "use strict";
  try {
    var p = JSON.parse(localStorage.getItem("hub_prefs") || "{}");
    if (p && (p.theme === "light" || p.theme === "dark")) document.documentElement.setAttribute("data-theme", p.theme);
  } catch (e) {}
})();
