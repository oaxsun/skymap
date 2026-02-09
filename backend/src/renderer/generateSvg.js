import { JSDOM } from "jsdom";
import { renderStarMap, setTheme } from "./skymap.js";

/**
 * Genera el SVG del mapa estelar en servidor usando JSDOM + el renderer original.
 * @param {object} cfg
 * @param {"classic"|"inverted"} style
 * @returns {string} svgMarkup
 */
export function generateStarMapSVG(cfg, style = "classic") {
  const dom = new JSDOM(`<!doctype html><html><body><div id="mount"></div></body></html>`, {
    pretendToBeVisual: true,
  });

  // Exponer globals que el renderer usa
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  // Ajustar tema (usa document.body)
  setTheme(style);

  const mount = dom.window.document.getElementById("mount");
  renderStarMap(mount, cfg);

  // El renderer mete un <svg> dentro de mount
  const svg = mount.querySelector("svg");
  if (!svg) throw new Error("No se generó SVG");

  return svg.outerHTML;
}
