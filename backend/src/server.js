import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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

app.listen(PORT, () => {
  console.log(`API OK http://localhost:${PORT}`);
  console.log(`FRONTEND_ORIGIN=${FRONTEND_ORIGIN}`);
});
