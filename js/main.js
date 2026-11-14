import * as home from "./section-home.js";
import * as productivity from "./section-productivity.js";
import * as identity from "./section-identity.js";

var NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "productivity", label: "Productivity System" },
  { id: "identity", label: "Identity" }
];

// Logo: een F opgebouwd uit dashboard-balken (stam + twee balken van
// verschillende lengte) met een groene "live"-stip. Inline, niet als <img>,
// zodat css/dashboard.css de losse onderdelen kan animeren. Het woordmerk
// "FLO." is zelf getekend uit dezelfde bouwstenen (afgeronde balken + ring).
var LOGO_MARK =
  '<svg viewBox="0 0 64 64" role="img" aria-label="Flo">' +
  '<defs>' +
  '<linearGradient id="lm-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262626"/><stop offset="1" stop-color="#0c0c0c"/></linearGradient>' +
  '<linearGradient id="lm-fg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfcfcf"/></linearGradient>' +
  '</defs>' +
  '<rect class="lm-tile" width="64" height="64" rx="17" fill="url(#lm-bg)"/>' +
  '<rect x=".5" y=".5" width="63" height="63" rx="16.5" fill="none" stroke="#fff" stroke-opacity=".12"/>' +
  '<rect class="lm-grow lm-stem" x="19" y="15" width="9" height="34" rx="4.5" fill="url(#lm-fg)"/>' +
  '<rect class="lm-grow lm-top" x="19" y="15" width="27" height="9" rx="4.5" fill="url(#lm-fg)"/>' +
  '<rect class="lm-grow lm-mid" x="19" y="28.5" width="15" height="9" rx="4.5" fill="url(#lm-fg)"/>' +
  '<circle class="lm-pulse" cx="41.5" cy="33" r="4.5" fill="#10b981"/>' +
  '<circle class="lm-dot" cx="41.5" cy="33" r="4.5" fill="#10b981"/>' +
  '</svg>';

var LOGO_WORD =
  '<svg class="wordmark" viewBox="0 0 50 14" role="img" aria-label="Flo" fill="currentColor">' +
  '<g class="wm-l"><rect x="0" y="0" width="3.2" height="14" rx="1.6"/><rect x="0" y="0" width="10" height="3.2" rx="1.6"/><rect x="0" y="5.4" width="7" height="3.2" rx="1.6"/></g>' +
  '<g class="wm-l"><rect x="14" y="0" width="3.2" height="14" rx="1.6"/><rect x="14" y="10.8" width="9.5" height="3.2" rx="1.6"/></g>' +
  '<g class="wm-l"><circle cx="34.5" cy="7" r="5.4" fill="none" stroke="currentColor" stroke-width="3.2"/></g>' +
  '<circle class="wm-dot" cx="46.6" cy="12.2" r="1.8" fill="#10b981"/>' +
  '</svg>';

var appEl = document.getElementById("app");
var currentSection = "home";
var hasRenderedOnce = false;

renderShell();

function renderShell() {
  // De intro-animatie op het logo/wordmark hoort alleen bij het openen
  // van de app te spelen, niet bij elke keer dat je van pagina wisselt
  // (renderShell() bouwt de hele shell inclusief brand opnieuw op).
  var brandClass = hasRenderedOnce ? "brand" : "brand brand-animate";
  hasRenderedOnce = true;

  appEl.innerHTML =
    '<div class="app-shell">' +
    '<nav class="side-nav">' +
    '<div class="' + brandClass + '"><div class="logo">' + LOGO_MARK + '</div><div>' + LOGO_WORD + '<div class="tagline">Life dashboard</div></div></div>' +
    '<div class="nav-list">' +
    NAV_ITEMS.map(function (item) {
      return '<div class="nav-item ' + (item.id === currentSection ? "active" : "") + '" data-section="' + item.id + '">' + item.label + "</div>";
    }).join("") +
    "</div>" +
    "</nav>" +
    '<main class="main-content">' +
    '<div id="section-content"></div>' +
    "</main>" +
    "</div>";

  appEl.querySelectorAll("[data-section]").forEach(function (el) {
    el.addEventListener("click", function () {
      currentSection = el.getAttribute("data-section");
      renderShell();
    });
  });

  mountSection(currentSection);
}

function navigateTo(id) {
  currentSection = id;
  renderShell();
}

function mountSection(id) {
  var contentEl = document.getElementById("section-content");
  try {
    if (id === "home") home.init(contentEl, navigateTo);
    else if (id === "productivity") productivity.init(contentEl);
    else if (id === "identity") identity.init(contentEl);
  } catch (err) {
    var msg = (err && err.message) || String(err);
    contentEl.innerHTML = '<div class="empty-drop" style="padding:40px 20px;">Kon deze sectie niet laden: ' + msg + '</div>';
  }
}
