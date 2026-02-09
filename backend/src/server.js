import express from "express";
import cors from "cors";
import multer from "multer";
import { PDFDocument } from "pdf-lib";

const app = express();

// --------------------
// CORS
// --------------------
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / server-to-server
    if (!FRONTEND_ORIGIN) return cb(null, true); // dev: allow all
    if (origin === FRONTEND_ORIGIN) return cb(null, true);
    return cb(new Error("CORS blocked for origin: " + origin));
  }
}));

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --------------------
// PDF endpoint
// Receives a JPEG file + wpx/hpx/dpi and returns a PDF with exact size.
// --------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 } // 35MB
});

function mmToPt(mm){
  return (Number(mm) * 72) / 25.4;
}

function pxToPt(px, dpi){
  return (Number(px) / Number(dpi)) * 72;
}

app.post("/api/pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Missing file");

    const wpx = Number(req.body.wpx);
    const hpx = Number(req.body.hpx);
    const dpi = Number(req.body.dpi) || 300;
    const filename = String(req.body.filename || "skymap.pdf");

    if (!Number.isFinite(wpx) || !Number.isFinite(hpx) || wpx <= 0 || hpx <= 0) {
      return res.status(400).send("Invalid wpx/hpx");
    }

    // Create PDF with exact physical size matching the pixel size at given DPI
    const wPt = pxToPt(wpx, dpi);
    const hPt = pxToPt(hpx, dpi);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([wPt, hPt]);

    const jpg = await pdfDoc.embedJpg(req.file.buffer);

    // Draw full bleed
    page.drawImage(jpg, { x: 0, y: 0, width: wPt, height: hPt });

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    // inline so it opens in new tab; user can download from there
    res.setHeader("Content-Disposition", `inline; filename="${filename.replace(/"/g, "")}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).send("PDF generation failed");
  }
});

// --------------------
// Optional Spotify proxy (kept from original server.js)
// Will only work if env vars are provided.
// --------------------
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiryMs = 0;

async function getAppToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("Missing Spotify env vars");
  const now = Date.now();
  if (cachedToken && now < tokenExpiryMs - 30_000) return cachedToken;

  const body = new URLSearchParams({ grant_type: "client_credentials" });

  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  cachedToken = data.access_token;
  tokenExpiryMs = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

app.get("/api/spotify/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Falta q" });

    const token = await getAppToken();
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "8");

    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
    if (!r.ok) return res.status(r.status).send(await r.text());

    const data = await r.json();
    const items = (data.tracks?.items || []).map(t => ({
      id: t.id,
      name: t.name,
      artists: t.artists?.map(a => a.name).join(", "),
      album: t.album?.name,
      image: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || null,
      uri: t.uri,
    }));

    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

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

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`API ready on :${port}`));
