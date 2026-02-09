import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { generateStarMapSVG } from "./renderer/generateSvg.js";

dotenv.config();

const app = express();

// --- Config ---
const PORT = Number(process.env.PORT || 3001);

// In dev, allow your local static server (e.g. http://localhost:5173 or http://127.0.0.1:5500)
// In prod, set FRONTEND_ORIGIN to your domain.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    credentials: false,
  })
);

// JSON for normal API endpoints (Stripe webhook will need raw body later)
app.use(express.json({ limit: "1mb" }));

// --- Health ---
app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// --- Spotify (existing logic moved from your old server.js) ---
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiryMs = 0;

async function getAppToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Faltan SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET en variables de entorno.");
  }

  const now = Date.now();
  if (cachedToken && now < tokenExpiryMs - 30_000) return cachedToken;

  const body = new URLSearchParams({ grant_type: "client_credentials" });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) throw new Error("No pude obtener token Spotify: " + (await res.text()));
  const data = await res.json();

  cachedToken = data.access_token;
  tokenExpiryMs = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// Buscar tracks (oficial)
app.get("/api/spotify/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Falta q" });

    const token = await getAppToken();
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "8");

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return res.status(r.status).send(await r.text());

    const data = await r.json();
    const items = (data.tracks?.items || []).map((t) => ({
      id: t.id,
      name: t.name,
      artists: t.artists?.map((a) => a.name).join(", "),
      album: t.album?.name,
      image: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || null,
      uri: t.uri,
    }));

    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// Spotify Code (scannable SVG)
app.get("/api/spotify/code", async (req, res) => {
  try {
    const uri = String(req.query.uri || "").trim();
    if (!uri.startsWith("spotify:")) return res.status(400).json({ error: "uri inválido" });

    const colorBg = "000000";
    const colorCode = "white";
    const size = "640";

    const codeUrl = `https://scannables.scdn.co/uri/plain/svg/${colorBg}/${colorCode}/${size}/${encodeURIComponent(uri)}`;
    const r = await fetch(codeUrl);
    if (!r.ok) return res.status(r.status).send(await r.text());

    const svg = await r.text();
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.send(svg);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});


// --- Generate PDF (server-side) ---
// Body: { title, subtitle, lat, lon, dateTimeISO, overlay, style, size: "S"|"M"|"L"|"XL" }

// Nota: Puppeteer soporta A4/A3/A2 como "format", pero A1/A0 se definen en mm.
function getPdfOptionsBySize(sizeKey) {
  switch (String(sizeKey || "S").toUpperCase()) {
    case "S":
      return { format: "A4" }; // 210×297mm
    case "M":
      return { format: "A2" }; // 420×594mm
    case "L":
      return { width: "594mm", height: "841mm" }; // A1
    case "XL":
      return { width: "841mm", height: "1189mm" }; // A0
    default:
      return { format: "A4" };
  }
}
app.post("/api/generate-pdf", async (req, res) => {
  try {
    const {
      title = "NIGHT SKY",
      subtitle = "",
      lat,
      lon,
      dateTimeISO,
      overlay = "",
      style = "classic",
      size = "S",
    } = req.body || {};

    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return res.status(400).json({ error: "Lat/Lon inválidos" });
    }

    const dt = dateTimeISO ? new Date(dateTimeISO) : new Date();
    if (Number.isNaN(dt.getTime())) {
      return res.status(400).json({ error: "dateTimeISO inválido" });
    }

    const sizeKey = String(size || "S").toUpperCase();
    const pdfSizeOptions = getPdfOptionsBySize(sizeKey);

    // El renderer actual incluye texto dentro del SVG; aquí solo concatenamos overlay/subtitle si aplica
    const svg = generateStarMapSVG(
      {
        title: String(title).slice(0, 120),
        lat: latNum,
        lon: lonNum,
        date: dt,
        overlay: String(subtitle ? `${subtitle} • ${overlay}` : overlay).slice(0, 220),
      },
      style === "inverted" ? "inverted" : "classic"
    );

    // HTML wrapper para imprimir a PDF
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#ffffff}
    .page{width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0}
    /* Asegurar que el SVG use todo el ancho útil */
    svg{max-width:100%;height:auto}
  </style>
</head>
<body>
  <div class="page">${svg}</div>
</body>
</html>`;

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      ...pdfSizeOptions,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="skymap-${sizeKey}.pdf"`);
    return res.send(pdf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo generar el PDF" });
  }
});


app.listen(PORT, () => {
  console.log(`API OK http://localhost:${PORT}`);
  console.log(`FRONTEND_ORIGIN=${FRONTEND_ORIGIN}`);
});
