/* export.js
   ==========================================================
   Exporter (PNG / JPG / PDF) para Sky Art Creator
   - ES Module
   - Exporta el póster “calcado” al preview, incluyendo
     posiciones reales del texto (sin Y hardcode).
   ========================================================== */

export function createExporter(core) {
  const {
    state,
    posterEl,
    mapCanvasEl,
    EXPORT_SIZES,
    POSTER_W,
    POSTER_H,

    clamp,
    cmToPx,
    computeRenderTokens,
    getStyleDef, // (no obligatorio)
    isPoster,
    updatePosterFrameInsetPx,
    syncThickness,
    rgbaFromHex,
    getDateTimeString,
    renderPosterText,
    applyAutoTextSizing,
  } = core || {};

  if (!state) throw new Error("[export.js] Falta `state` en createExporter()");
  if (!posterEl) throw new Error("[export.js] Falta `posterEl` (#poster) en createExporter()");
  if (!mapCanvasEl) throw new Error("[export.js] Falta `mapCanvasEl` (#mapCanvas) en createExporter()");
  if (!Array.isArray(EXPORT_SIZES)) throw new Error("[export.js] Falta `EXPORT_SIZES` (array) en createExporter()");
  if (!POSTER_W || !POSTER_H) throw new Error("[export.js] Faltan `POSTER_W/POSTER_H` en createExporter()");

  function downloadDataURL(dataURL, filename) {
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ===========================
  // ✅ PDF REAL con jsPDF (descarga directa, sin print)
  // ===========================
  function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (window.__jspdfLoadingPromise) return window.__jspdfLoadingPromise;

    window.__jspdfLoadingPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
      s.async = true;
      s.onload = () => {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error("jsPDF cargó pero no se encontró window.jspdf.jsPDF"));
      };
      s.onerror = () => reject(new Error("No se pudo cargar jsPDF (CDN)."));
      document.head.appendChild(s);
    });

    return window.__jspdfLoadingPromise;
  }

  async function downloadPDFfromCanvas(posterCanvas, Wpx, Hpx, dpi, filename) {
    const jsPDF = await loadJsPDF();

    // ✅ JPEG evita PDF en blanco por PNG/alpha/tamaño
    const jpgDataURL = posterCanvas.toDataURL("image/jpeg", 0.98);

    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("No se pudo cargar la imagen para PDF"));
      img.src = jpgDataURL;
    });

    const safeDpi = Number(dpi) || 300;
    const wPt = (Wpx / safeDpi) * 72;
    const hPt = (Hpx / safeDpi) * 72;

    const doc = new jsPDF({
      orientation: wPt >= hPt ? "l" : "p",
      unit: "pt",
      format: [wPt, hPt],
      compress: true,
    });

    doc.addImage(img, "JPEG", 0, 0, wPt, hPt, undefined, "FAST");
    doc.save(filename);
  }

  // ---------------------------
  // ✅ Texto calcado del preview
  // ---------------------------
  function getRectRelToPoster(el) {
    if (!el) return null;

    // ⚠️ IMPORTANTE:
    // El preview puede estar escalado (CSS transform / --previewZoom dinámico).
    // getBoundingClientRect() devuelve medidas YA escaladas. Para exportar 1:1
    // contra el póster base (POSTER_W/POSTER_H), convertimos a coordenadas "no escaladas".
    const pr = posterEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();

    // factor de zoom real del póster en el preview
    const zoomX = pr.width / POSTER_W;
    const zoomY = pr.height / POSTER_H;

    return {
      x: (r.left - pr.left) / zoomX,
      y: (r.top - pr.top) / zoomY,
      w: r.width / zoomX,
      h: r.height / zoomY,
    };
  }

  function drawDomTextLikePreview(ctx, tokens, el, text, sx, sy, familyFallback) {
    if (!el) return;
    if (!text) return;

    const rr = getRectRelToPoster(el);
    if (!rr) return;

    const cs = getComputedStyle(el);
    const weight = cs.fontWeight || "700";
    const opacity = Number(cs.opacity || 1);

    const align = (cs.textAlign || "left");
    let canvasAlign = "left";
    if (align.includes("center")) canvasAlign = "center";
    else if (align.includes("right")) canvasAlign = "right";

    const xPx =
      (canvasAlign === "left")
        ? rr.x
        : (canvasAlign === "center")
          ? (rr.x + rr.w / 2)
          : (rr.x + rr.w);

    const family = familyFallback || "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const fontSizeBase = parseFloat(cs.fontSize || "16");
    let size = fontSizeBase * sy;
    const maxW = rr.w * sx;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.textAlign = canvasAlign;
    ctx.textBaseline = "top";
    ctx.fillStyle = tokens.posterInk;

    while (size > (fontSizeBase * sy) * 0.55) {
      ctx.font = `${weight} ${Math.max(1, Math.round(size))}px ${family}`;
      if (ctx.measureText(text).width <= maxW) break;
      size -= 1;
    }

    ctx.font = `${weight} ${Math.max(1, Math.round(size))}px ${family}`;
    ctx.fillText(
      text,
      Math.round(xPx * sx),
      Math.round(rr.y * sy)
    );

    ctx.restore();
  }

  // ===========================
  // ✅ EXPORT PRINCIPAL
  // ===========================
  async function exportPoster(format, sizeKey) {
    const sz = EXPORT_SIZES.find(x => x.key === sizeKey) || EXPORT_SIZES[0];
    const dpi = state.export?.dpi || 300;

    let W, H;
    if (sz.type === "px") { W = sz.w; H = sz.h; }
    else { W = cmToPx(sz.w, dpi); H = cmToPx(sz.h, dpi); }

    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;

    const ctx = out.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const tokens = computeRenderTokens();
    updatePosterFrameInsetPx();
    syncThickness();

    const frameOn = (!isPoster()) && !!state.map.posterFrameEnabled;
    const marginOn = (!isPoster()) && !!state.map.posterMarginEnabled && !frameOn;

    const POSTER_FRAME_EDGE_GAP_PX = 0;
    const POSTER_MARGIN_EDGE_GAP_PX = 50;
    const POSTER_MARGIN_THICKNESS_FIXED = 4;

    const edgeFrameX = Math.round(POSTER_FRAME_EDGE_GAP_PX * (W / POSTER_W));
    const edgeFrameY = Math.round(POSTER_FRAME_EDGE_GAP_PX * (H / POSTER_H));
    const edgeMarginX = Math.round(POSTER_MARGIN_EDGE_GAP_PX * (W / POSTER_W));
    const edgeMarginY = Math.round(POSTER_MARGIN_EDGE_GAP_PX * (H / POSTER_H));

    const framePx = frameOn ? clamp(state.map.posterFrameInsetPx, 0, 160) : 0;
    const frameX = Math.round(framePx * (W / POSTER_W));
    const frameY = Math.round(framePx * (H / POSTER_H));

    ctx.fillStyle = tokens.posterBg;
    ctx.fillRect(0, 0, W, H);

    if (frameOn) {
      ctx.fillStyle = tokens.posterInk;
      ctx.fillRect(edgeFrameX, edgeFrameY, W - edgeFrameX * 2, H - edgeFrameY * 2);
    }

    const innerX = edgeFrameX + frameX;
    const innerY = edgeFrameY + frameY;

    ctx.fillStyle = tokens.posterBg;
    ctx.fillRect(innerX, innerY, W - innerX * 2, H - innerY * 2);

    if (marginOn) {
      const thick = POSTER_MARGIN_THICKNESS_FIXED;
      const thickScaled = Math.max(1, Math.round(thick * (W / POSTER_W)));
      ctx.save();
      ctx.strokeStyle = rgbaFromHex(tokens.posterInk, 1);
      ctx.lineWidth = thickScaled;
      ctx.globalAlpha = 1;
      const half = thickScaled / 2;
      ctx.strokeRect(
        edgeMarginX + half,
        edgeMarginY + half,
        W - (edgeMarginX * 2) - thickScaled,
        H - (edgeMarginY * 2) - thickScaled
      );
      ctx.restore();
    }

    const sx = W / POSTER_W;
    const sy = H / POSTER_H;

    const css = getComputedStyle(posterEl);
    const mapW0 = parseFloat(css.getPropertyValue("--mapW")) || 780;
    const mapH0 = parseFloat(css.getPropertyValue("--mapH")) || 780;

    const mapW = Math.round(mapW0 * sx);
    const mapH = Math.round(mapH0 * sy);

    const mapX = Math.round((W - mapW) / 2);
    const mapY = Math.round(innerY + (70 * sy));

    ctx.drawImage(mapCanvasEl, mapX, mapY, mapW, mapH);

    try {
      renderPosterText();
      applyAutoTextSizing();
    } catch (_) {}

    const family = state.text?.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const $titleEl  = document.getElementById("pTitle");
    const $subEl    = document.getElementById("pSubtitle");
    const $placeEl  = document.getElementById("pPlace");
    const $coordsEl = document.getElementById("pCoords");
    const $dtEl     = document.getElementById("pDatetime");

    const TITLE_MAX = 120;
    const SUB_MAX = 240;

    const title = String(state.text?.title || "").slice(0, TITLE_MAX);
    const sub = String(state.text?.subtitle || "").slice(0, SUB_MAX);

    if (state.visible?.title)    drawDomTextLikePreview(ctx, tokens, $titleEl,  title, sx, sy, family);
    if (state.visible?.subtitle) drawDomTextLikePreview(ctx, tokens, $subEl,    sub,   sx, sy, family);
    if (state.visible?.place)    drawDomTextLikePreview(ctx, tokens, $placeEl,  state.text?.place || "",  sx, sy, family);
    if (state.visible?.coords)   drawDomTextLikePreview(ctx, tokens, $coordsEl, state.text?.coords || "", sx, sy, family);
    if (state.visible?.datetime) drawDomTextLikePreview(ctx, tokens, $dtEl,     getDateTimeString(),      sx, sy, family);

    if (format === "png" || format === "jpg") {
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const quality = format === "jpg" ? 0.95 : undefined;
      const url = out.toDataURL(mime, quality);
      downloadDataURL(url, `poster_${sizeKey}.${format}`);
      return;
    }

    try {
      await downloadPDFfromCanvas(out, W, H, dpi || 300, `poster_${sizeKey}.pdf`);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el PDF. Revisa bloqueadores o intenta otro navegador.");
    }
  }

  return { exportPoster };
}
