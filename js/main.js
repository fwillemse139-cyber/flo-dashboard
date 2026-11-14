import * as home from "./section-home.js";
import * as productivity from "./section-productivity.js";
import * as portfolio from "./section-portfolio.js";
import * as identity from "./section-identity.js";

var NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "productivity", label: "Productivity System" },
  { id: "portfolio", label: "Portfolio" },
  { id: "identity", label: "Identity" }
];

// Logo: een italic "F" met schuin afgesneden armen en voet (één vormtaal,
// de arm-uiteinden wijzen omhoog = groei) op een felgroene tegel. Inline, niet
// als <img>, zodat css/dashboard.css de onderdelen apart kan animeren. Het
// woordmerk "FLO." is uit dezelfde schuine bouwstenen getekend.
var LOGO_MARK =
  '<svg viewBox="0 0 64 64" role="img" aria-label="Flo">' +
  '<defs>' +
  '<linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ef0b0"/><stop offset=".55" stop-color="#10b981"/><stop offset="1" stop-color="#047857"/></linearGradient>' +
  '<radialGradient id="lm-hi" cx=".25" cy=".1" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="lm-fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9fbea"/></linearGradient>' +
  '<linearGradient id="lm-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
  '<filter id="lm-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#023a2a" flood-opacity=".45"/></filter>' +
  '<clipPath id="lm-clip"><rect width="64" height="64" rx="18"/></clipPath>' +
  '</defs>' +
  '<g class="lm-tile"><rect width="64" height="64" rx="18" fill="url(#lm-bg)"/><rect width="64" height="64" rx="18" fill="url(#lm-hi)"/><rect x=".5" y=".5" width="63" height="63" rx="17.5" fill="none" stroke="#fff" stroke-opacity=".22"/></g>' +
  '<g filter="url(#lm-sh)"><g transform="translate(32 32) skewX(-8) translate(-32 -32)" fill="url(#lm-fg)" stroke="url(#lm-fg)" stroke-width="2.6" stroke-linejoin="round">' +
  '<polygon class="lm-part lm-stem" points="20.3,15.3 28.7,15.3 28.7,43.6 24.4,47.9 20.3,47.9"/>' +
  '<polygon class="lm-part lm-top" points="26,15.3 48.5,15.3 44.2,24.4 26,24.4"/>' +
  '<polygon class="lm-part lm-mid" points="26,30.4 40.6,30.4 37.2,38.6 26,38.6"/>' +
  '</g></g>' +
  '<g clip-path="url(#lm-clip)"><g class="lm-sheen"><rect x="0" y="-8" width="22" height="80" fill="url(#lm-shine)" transform="skewX(-20)"/></g></g>' +
  '</svg>';

var LOGO_WORD =
  '<svg class="wordmark" viewBox="0 0 54 16" role="img" aria-label="Flo" fill="currentColor">' +
  '<g transform="translate(27 8) skewX(-8) translate(-27 -8)" stroke="currentColor" stroke-width=".7" stroke-linejoin="round">' +
  '<g class="wm-l"><polygon points="1,1 4.9,1 4.9,12.8 2.9,15 1,15"/><polygon points="3,1 11.6,1 10.1,4.8 3,4.8"/><polygon points="3,7.4 9.4,7.4 8.1,10.9 3,10.9"/></g>' +
  '<g class="wm-l"><polygon points="16,1 19.9,1 19.9,15 16,15"/><polygon points="18,11.4 27.2,11.4 25.6,15 18,15"/></g>' +
  '<g class="wm-l"><circle cx="38" cy="8" r="5.1" fill="none" stroke-width="3.8"/></g>' +
  '<circle class="wm-dot" cx="50.3" cy="13.3" r="2.2" fill="#10b981" stroke="none"/>' +
  '</g></svg>';

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
    else if (id === "portfolio") portfolio.init(contentEl);
    else if (id === "identity") identity.init(contentEl);
  } catch (err) {
    var msg = (err && err.message) || String(err);
    contentEl.innerHTML = '<div class="empty-drop" style="padding:40px 20px;">Kon deze sectie niet laden: ' + msg + '</div>';
  }
}
