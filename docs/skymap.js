import { STARS, CONSTELLATIONS } from "./catalog.js";

let currentSVG = null;

const THEME = {
  classic: { bg: "#0b1020", fg: "#e8ecff", faint: "rgba(232,236,255,.35)", faint2: "rgba(232,236,255,.18)" },
  inverted: { bg: "#f7f8ff", fg: "#0b1020", faint: "rgba(11,16,32,.35)", faint2: "rgba(11,16,32,.18)" },
};

let activeTheme = THEME.classic;

export function setTheme(style) {
  activeTheme = style === "inverted" ? THEME.inverted : THEME.classic;
  document.body.style.background = activeTheme.bg;
  document.body.style.color = activeTheme.fg;
}

/**
 * Renderiza un mapa estelar “visible” (hemisferio superior) en SVG.
 * Proyección: azimutal equidistante (centro = cenit, borde = horizonte).
 */
export function renderStarMap(mountEl, cfg) {
  const { title, lat, lon, date, overlay } = cfg;

  // Limpia
  mountEl.innerHTML = "";

  const size = 900; // preview (export PNG puede re-escalar)
  const margin = 40;
  const R = (size - margin * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const svg = el("svg", {
    width: size,
    height: size + 140,
    viewBox: `0 0 ${size} ${size + 140}`,
    style: `background:${activeTheme.bg}; border-radius: 18px; box-shadow: 0 18px 60px rgba(0,0,0,.35);`
  });

  // Fondo del círculo
  svg.appendChild(el("circle", {
    cx, cy, r: R,
    fill: "transparent",
    stroke: activeTheme.faint2,
    "stroke-width": 2
  }));

  // Horizonte
  svg.appendChild(el("circle", {
    cx, cy, r: R,
    fill: "transparent",
    stroke: activeTheme.faint2,
    "stroke-dasharray": "6 6",
    "stroke-width": 1.5
  }));

  // Cardinales
  const card = [
    ["N", 0], ["E", 90], ["S", 180], ["O", 270]
  ];
  for (const [lab, azDeg] of card) {
    const p = projectAzAlt(azDeg, 0, cx, cy, R);
    svg.appendChild(text(lab, p.x, p.y - 8, 12, 700, activeTheme.faint));
  }

  // Fecha y lugar
  const subtitle = `${fmtDate(date)} · lat ${lat.toFixed(4)}°, lon ${lon.toFixed(4)}°`;
  svg.appendChild(text(title, cx, size + 50, 24, 800, activeTheme.fg, "middle"));
  svg.appendChild(text(subtitle, cx, size + 78, 12, 500, activeTheme.faint, "middle"));

  // Cálculos de cielo
  const lst = localSiderealTimeDeg(date, lon);
  const latRad = deg2rad(lat);

  // Construir lista de estrellas visibles
  const visible = [];
  for (let i = 0; i < STARS.length; i++) {
    const [name, raDeg, decDeg, mag] = STARS[i];
    const { azDeg, altDeg } = raDecToAzAlt(raDeg, decDeg, latRad, lst);
    if (altDeg > 0) visible.push({ i, name, raDeg, decDeg, mag, azDeg, altDeg });
  }

  // Constelaciones
  if (overlay === "stars+const" || overlay === "const") {
    for (const [cname, segs] of Object.entries(CONSTELLATIONS)) {
      for (const [a, b] of segs) {
        const A = starAzAltByIndex(a, latRad, lst);
        const B = starAzAltByIndex(b, latRad, lst);
        if (!A || !B) continue;
        if (A.altDeg <= 0 || B.altDeg <= 0) continue;

        const p1 = projectAzAlt(A.azDeg, A.altDeg, cx, cy, R);
        const p2 = projectAzAlt(B.azDeg, B.altDeg, cx, cy, R);

        svg.appendChild(el("line", {
          x1: p1.x, y1: p1.y,
          x2: p2.x, y2: p2.y,
          stroke: activeTheme.faint2,
          "stroke-width": 1.2
        }));
      }
    }
  }

  // Estrellas
  if (overlay === "stars" || overlay === "stars+const") {
    for (const s of visible) {
      const p = projectAzAlt(s.azDeg, s.altDeg, cx, cy, R);
      const r = starRadiusFromMag(s.mag);

      svg.appendChild(el("circle", {
        cx: p.x,
        cy: p.y,
        r,
        fill: activeTheme.fg,
        opacity: starOpacityFromMag(s.mag)
      }));
    }
  }

  // Mini grid (altitudes)
  for (const alt of [15, 30, 45, 60, 75]) {
    svg.appendChild(el("circle", {
      cx, cy,
      r: (R * (90 - alt)) / 90,
      fill: "transparent",
      stroke: activeTheme.faint2,
      "stroke-width": 1,
      opacity: 0.5
    }));
  }

  // Footer pequeño
  svg.appendChild(text("Generado localmente (SVG).", cx, size + 112, 11, 500, activeTheme.faint2, "middle"));

  mountEl.appendChild(svg);
  currentSVG = svg;
}

export function exportSVG(filename = "mapa-estelar.svg") {
  if (!currentSVG) throw new Error("No hay SVG para exportar");

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(currentSVG);

  // Namespaces
  if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
    source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  download(url, filename);
  URL.revokeObjectURL(url);
}

export async function exportPNG(filename = "mapa-estelar.png", outSizePx = 2000) {
  if (!currentSVG) throw new Error("No hay SVG para exportar");

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(currentSVG);
  if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
    source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Render SVG -> Canvas
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.src = svgUrl;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = outSizePx;
  canvas.height = Math.round(outSizePx * (currentSVG.viewBox.baseVal.height / currentSVG.viewBox.baseVal.width));

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  URL.revokeObjectURL(svgUrl);

  const pngUrl = canvas.toDataURL("image/png");
  download(pngUrl, filename);
}

// -------------------- Astronomía (básica) --------------------

function raDecToAzAlt(raDeg, decDeg, latRad, lstDeg) {
  // Hour angle H = LST - RA
  let H = deg2rad(wrapDeg(lstDeg - raDeg));
  const dec = deg2rad(decDeg);

  // Altitude
  const sinAlt = Math.sin(dec) * Math.sin(latRad) + Math.cos(dec) * Math.cos(latRad) * Math.cos(H);
  const alt = Math.asin(clamp(sinAlt, -1, 1));

  // Azimuth (desde el norte, hacia el este)
  const y = -Math.sin(H);
  const x = Math.tan(dec) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(H);
  let az = Math.atan2(y, x); // [-pi, pi]
  az = wrapRad(az);

  return { azDeg: rad2deg(az), altDeg: rad2deg(alt) };
}

function localSiderealTimeDeg(date, lonDeg) {
  // Aproximación estándar:
  // GMST (deg) ≈ 280.46061837 + 360.98564736629 * d
  // donde d = días desde J2000.0 (JD - 2451545.0)
  const jd = toJulianDate(date);
  const d = jd - 2451545.0;
  const gmst = wrapDeg(280.46061837 + 360.98564736629 * d);
  const lst = wrapDeg(gmst + lonDeg);
  return lst;
}

function toJulianDate(date) {
  // JD = unix_ms / 86400000 + 2440587.5
  return date.getTime() / 86400000 + 2440587.5;
}

// -------------------- Proyección y dibujo --------------------

function projectAzAlt(azDeg, altDeg, cx, cy, R) {
  // Azimut 0=N, 90=E.
  // Proyección azimutal equidistante: distancia radial ∝ (90 - alt)
  const r = (R * (90 - altDeg)) / 90;
  const a = deg2rad(azDeg);
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  return { x, y };
}

function starRadiusFromMag(mag) {
  // mag más bajo = más brillante
  // Ajuste simple: valores pensados para preview 900px
  const t = clamp((2.5 - mag) / 4.5, 0, 1); // [-1.5..3] aprox
  return 0.6 + t * 2.6;
}

function starOpacityFromMag(mag) {
  const t = clamp((3.0 - mag) / 5.5, 0.15, 1);
  return t;
}

function starAzAltByIndex(i, latRad, lstDeg) {
  const s = STARS[i];
  if (!s) return null;
  const [, raDeg, decDeg] = s;
  return raDecToAzAlt(raDeg, decDeg, latRad, lstDeg);
}

// -------------------- Helpers DOM --------------------

function el(tag, attrs = {}) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

function text(str, x, y, size, weight, fill, anchor = "middle") {
  const t = el("text", {
    x, y,
    fill,
    "font-size": size,
    "font-weight": weight,
    "text-anchor": anchor,
    "font-family": "system-ui, -apple-system, Segoe UI, Roboto, Arial"
  });
  t.textContent = str;
  return t;
}

function download(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

// -------------------- Math helpers --------------------

function deg2rad(d) { return d * Math.PI / 180; }
function rad2deg(r) { return r * 180 / Math.PI; }

function wrapDeg(d) {
  d %= 360;
  return d < 0 ? d + 360 : d;
}

function wrapRad(r) {
  r %= (2 * Math.PI);
  return r < 0 ? r + 2 * Math.PI : r;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function fmtDate(date) {
  // Formato local simple
  return date.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}
