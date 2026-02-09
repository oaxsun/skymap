import express from "express";
import cors from "cors";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import Stripe from "stripe";

const app = express();

// --------------------
// Stripe (Checkout)
// --------------------
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const REQUIRE_PAYMENT = String(process.env.REQUIRE_PAYMENT || "").toLowerCase() !== "false";

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" }) : null;

// In-memory cache (Render free tier may restart; we also verify with Stripe API on demand)
const paidSessions = new Set();

// Webhook MUST use raw body
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try{
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(400).send("Stripe webhook not configured");

    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed"){
      const session = event.data.object;
      if (session?.id && session?.payment_status === "paid"){
        paidSessions.add(session.id);
      }
    }

    res.json({ received: true });
  }catch(e){
    console.error("Webhook error:", e.message || e);
    res.status(400).send(`Webhook Error: ${e.message || "unknown"}`);
  }
});

// JSON body for the rest of the API
app.use(express.json({ limit: "2mb" }));


// --------------------
// CORS
// --------------------
// Prefer CORS_ORIGINS (comma-separated). Keep FRONTEND_ORIGIN for backward-compat.
// Examples:
//   CORS_ORIGINS=http://localhost:3000,https://skymap.vercel.app
//   FRONTEND_ORIGIN=https://skymap.vercel.app
const CORS_ORIGINS_RAW = process.env.CORS_ORIGINS || "";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";

const allowedOrigins = (CORS_ORIGINS_RAW ? CORS_ORIGINS_RAW.split(",") : [])
  .map(s => s.trim())
  .filter(Boolean);
if (FRONTEND_ORIGIN && !allowedOrigins.includes(FRONTEND_ORIGIN)) {
  allowedOrigins.push(FRONTEND_ORIGIN);
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / server-to-server
    if (allowedOrigins.length === 0) return cb(null, true); // dev: allow all if not set
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked for origin: " + origin));
  },
  credentials: true,
}));

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --------------------
// Create Stripe Checkout Session
// --------------------
app.post("/api/create-checkout-session", async (req, res) => {
  try{
    if (!stripe) return res.status(400).json({ error: "Stripe no está configurado (falta STRIPE_SECRET_KEY)" });

    const sizeKey = String(req.body?.sizeKey || "S").toUpperCase();
    const format = String(req.body?.format || "pdf").toLowerCase();

    // Precios por tamaño (centavos)
    const currency = String(process.env.CURRENCY || "mxn").toLowerCase();
    const prices = {
      S: Number(process.env.PRICE_S_CENTS || 19900),
      M: Number(process.env.PRICE_M_CENTS || 29900),
      L: Number(process.env.PRICE_L_CENTS || 39900),
      XL: Number(process.env.PRICE_XL_CENTS || 49900),
    };
    const unitAmount = prices[sizeKey] || prices.S;

    const successUrl = process.env.FRONTEND_SUCCESS_URL || (process.env.FRONTEND_BASE_URL ? `${process.env.FRONTEND_BASE_URL.replace(/\/$/, "")}/generator.html` : "");
    const cancelUrl  = process.env.FRONTEND_CANCEL_URL  || (process.env.FRONTEND_BASE_URL ? `${process.env.FRONTEND_BASE_URL.replace(/\/$/, "")}/generator.html?canceled=1` : "");

    if (!successUrl || !cancelUrl){
      return res.status(400).json({
        error: "Faltan FRONTEND_BASE_URL (o FRONTEND_SUCCESS_URL/FRONTEND_CANCEL_URL) en el backend."
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: `SkyMap Poster ${sizeKey}`,
            description: `Formato: ${format.toUpperCase()}`,
          }
        }
      }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { sizeKey, format }
    });

    res.json({ url: session.url });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: e.message || "No se pudo crear sesión de pago" });
  }
});

// --------------------
// Payment status (used by generator.html to enable Download)
// --------------------
app.get("/api/payment-status", async (req, res) => {
  try{
    const sessionId = String(req.query.session_id || "").trim();
    if (!sessionId) return res.status(400).json({ error: "Falta session_id", paid: false });

    if (paidSessions.has(sessionId)) return res.json({ paid: true });

    if (!stripe){
      return res.json({ paid: false, reason: "Stripe no configurado" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session?.payment_status === "paid";
    if (paid) paidSessions.add(sessionId);

    res.json({ paid });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: e.message || "No se pudo verificar pago", paid: false });
  }
});


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

    // Optional: require a paid Stripe session to generate the final PDF
    const sessionId = String(req.body.session_id || "").trim();
    if (REQUIRE_PAYMENT && stripe){
      if (!sessionId) return res.status(402).send("Missing session_id");
      if (!paidSessions.has(sessionId)){
        const s = await stripe.checkout.sessions.retrieve(sessionId).catch(()=> null);
        if (!s || s.payment_status !== "paid"){
          return res.status(402).send("Payment required");
        }
        paidSessions.add(sessionId);
      }
    }

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
