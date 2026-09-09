import * as home from "./section-home.js";
import * as productivity from "./section-productivity.js";
import * as health from "./section-health.js";
import * as suerte from "./section-suerte.js";
import * as identity from "./section-identity.js";

var NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "productivity", label: "Productivity System" },
  { id: "health", label: "Health" },
  { id: "suerte", label: "Finance" },
  { id: "identity", label: "Identity" }
];

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
    '<div class="' + brandClass + '"><div class="logo"><img src="assets/logo-f.png" alt="F"></div><div><img class="wordmark-img" src="assets/wordmark.png" alt="Flo\'s Dashboard"><div class="tagline">Life dashboard</div></div></div>' +
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
    else if (id === "health") health.init(contentEl);
    else if (id === "suerte") suerte.init(contentEl);
    else if (id === "identity") identity.init(contentEl);
  } catch (err) {
    var msg = (err && err.message) || String(err);
    contentEl.innerHTML = '<div class="empty-drop" style="padding:40px 20px;">Kon deze sectie niet laden: ' + msg + '</div>';
  }
}
