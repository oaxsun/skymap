(() => {
  const POSTER_W = 900;
  const POSTER_H = 1200;

  const POSTER_FRAME_EDGE_GAP_PX = 0;
  const POSTER_MARGIN_EDGE_GAP_PX = 50;

  const POSTER_FRAME_PCT_MAX = 0.06;
  const POSTER_FRAME_PCT_DEFAULT = POSTER_FRAME_PCT_MAX;

  // ✅ fijos
  const POSTER_MARGIN_THICKNESS_FIXED = 4; // margen fijo
  const OUTLINE_THICKNESS_FIXED = 4;       // ✅ contorno fijo = 4

  const TITLE_MAX = 120;
  const SUB_MAX = 240;

  const state = {
    step: 0,

    visible: { title: true, subtitle: true, place: true, coords: true, datetime: true },

    text: {
      title: "NIGHT SKY",
      subtitle: "A moment to remember",
      place: "Mexico City, MX",
      coords: "19.4326, -99.1332",
      date: "1995-12-25",
      time: "19:30",
      fontKey: "system",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    },

    map: {
      styleId: "classic",

      showGrid: false,
      // ✅ slider opacidad retícula (default = 60%, max = 60%)
      gridOpacity: 0.60,

      showConstellations: true,

      colorTheme: "mono",
      mapZoom: 1.0,

      backgroundMode: "match",

      // ✅ Moderno: SÍ permite marco y margen (solo Poster los fuerza OFF)
      posterFrameEnabled: false,
      posterFramePct: POSTER_FRAME_PCT_DEFAULT,
      posterFrameInsetPx: Math.round(POSTER_W * POSTER_FRAME_PCT_DEFAULT),

      posterMarginEnabled: true,
      posterMarginThickness: POSTER_MARGIN_THICKNESS_FIXED,

      mapCircleMarginEnabled: true,
      mapCircleInsetPct: 0.10,
      mapCircleMarginThickness: OUTLINE_THICKNESS_FIXED,

      constellationSize: 2.0,
      seed: 12345,

      stylePrefs: {
        classic:   { frame: false, margin: true,  outline: true  },
        moderno:   { frame: false, margin: false, outline: false },
        poster:    { frame: false, margin: false, outline: false },
        romantico: { frame: false, margin: false, outline: true  },
      }
    },

    export: {
      sizeKey: "digital_900x1200",
      format: "png",
      dpi: 300,
    }
  };

  const STEPS = [
    { key: "design", label: "Diseño" },
    { key: "content", label: "Contenido" },
    { key: "export", label: "Exportar" },
  ];

  const MAP_STYLES = [
    { id: "classic",   name: "Clásico",   layout: "classic", shape: "circle" },
    { id: "moderno",   name: "Moderno",   layout: "minimal", shape: "circle" },
    { id: "poster",    name: "Poster",    layout: "classic", shape: "rect"   },
    { id: "romantico", name: "Romántico", layout: "classic", shape: "heart"  },
  ];

  const FONT_PRESETS = [
    { key: "system", name: "System (Default)", css: "system-ui, -apple-system, Segoe UI, Roboto, Arial" },
    { key: "inter", name: "Inter-like (Sans)", css: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" },
    { key: "georgia", name: "Georgia (Serif)", css: "Georgia, 'Times New Roman', Times, serif" },
    { key: "times", name: "Times New Roman (Serif)", css: "'Times New Roman', Times, serif" },
    { key: "mono", name: "Monospace", css: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" },
    { key: "rounded", name: "Rounded (Friendly)", css: "'Trebuchet MS', 'Verdana', system-ui, Arial" },
  ];

  const COLOR_THEMES = [
    { id: "mono",      name: "Mono" },
    { id: "marino",    name: "Marino" },
    { id: "ice",       name: "Hielo" },
    { id: "warm",      name: "Cálido" },
    { id: "forest",    name: "Bosque" },
    { id: "rose",      name: "Caramelo" },
    { id: "neonBlue",  name: "Neón Azul" },
    { id: "neonGreen", name: "Neón Verde" },
    { id: "neonRose",  name: "Neón Rosa" },
  ];

  const EXPORT_SIZES = [
    { key: "digital_900x1200", title: "Digital (900×1200 px)", sub: "Ideal para pantalla / pruebas rápidas", type: "px", w: 900, h: 1200 },
    { key: "45x60cm_300dpi",   title: "45×60 cm (300 dpi)",    sub: "Impresión normal", type: "cm", w: 45, h: 60 },
    { key: "60x80cm_300dpi",   title: "60×80 cm (300 dpi)",    sub: "Impresión grande", type: "cm", w: 60, h: 80 },
    { key: "90x120cm_300dpi",  title: "90×120 cm (300 dpi)",   sub: "Impresión premium", type: "cm", w: 90, h: 120 },
  ];

  const $poster = document.getElementById("poster");
  const $canvas = document.getElementById("mapCanvas");
  const $previewArea = document.getElementById("previewArea");
  const $previewStage = document.querySelector(".previewStage");

  const $pTitle = document.getElementById("pTitle");
  const $pSubtitle = document.getElementById("pSubtitle");
  const $pPlace = document.getElementById("pPlace");
  const $pCoords = document.getElementById("pCoords");
  const $pDatetime = document.getElementById("pDatetime");

  const $tabs = document.getElementById("tabs");
  const $section = document.getElementById("sectionContainer");

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function mulberry32(seed){
    let t = seed >>> 0;
    return function() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash32(str){
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function isNeonThemeId(id){
    return String(id || "").startsWith("neon");
  }

  function colorsFor(theme){
    const THEMES = {
      mono:      { bg: "#0A0B0D", star: "#FFFFFF" },
      marino:    { bg: "#0B0D12", star: "#FFFFFF" },
      ice:       { bg: "#071016", star: "#E9F6FF" },
      warm:      { bg: "#140E0A", star: "#F6E7C9" },
      forest:    { bg: "#06130E", star: "#EAF7F1" },
      rose:      { bg: "#16080C", star: "#FFE9EF" },
      neonBlue:  { bg: "#05050A", star: "#4EA7FF" },
      neonGreen: { bg: "#05050A", star: "#3CFF9B" },
      neonRose:  { bg: "#05050A", star: "#FF4FD8" },
    };
    return THEMES[theme] || THEMES.mono;
  }

  function getStyleDef(){
    return MAP_STYLES.find(s => s.id === state.map.styleId) || MAP_STYLES[0];
  }

  function isGridAllowedForCurrentStyle(){
    return (state.map.styleId === "classic" || state.map.styleId === "moderno");
  }

  function isModern(){ return state.map.styleId === "moderno"; }
  function isPoster(){ return state.map.styleId === "poster"; }

  function getSelectedThemeName(){
    return (COLOR_THEMES.find(t => t.id === state.map.colorTheme)?.name) || "Mono";
  }

  function formatDateDDMMYYYY(iso){
    const s = String(iso || "").trim();
    if (!s) return "";
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `${m[3]}.${m[2]}.${m[1]}`;
  }

  function getDateTimeString(){
    const d = (state.text.date || "").trim();
    const t = (state.text.time || "").trim();
    const dd = d ? formatDateDDMMYYYY(d) : "";
    if (!dd && !t) return "";
    if (dd && t) return `${dd} ${t}`;
    return dd || t;
  }

  function updateSeedFromDateTime(){
    const key = `${(state.text.coords||"").trim()}|${(state.text.date||"").trim()}|${(state.text.time||"").trim()}`;
    state.map.seed = hash32(key);
  }

  function hexToRgb(hex){
    if (!hex) return { r:255, g:255, b:255 };
    let h = String(hex).trim();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
    const n = parseInt(h, 16);
    if (!Number.isFinite(n)) return { r:255, g:255, b:255 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbaFromHex(hex, a){
    const { r,g,b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  function computeRenderTokens(){
    const th = colorsFor(state.map.colorTheme);
    const neon = isNeonThemeId(state.map.colorTheme);

    if (neon){
      return {
        posterBg: "#000000",
        posterInk: th.star,
        mapBg: "#000000",
        stars: th.star,
        gridLine: th.star,
        constLine: th.star,
        constNode: th.star,
        outline: th.star,
        theme: th,
        neon: true,
      };
    }

    if (state.map.backgroundMode === "white"){
      return {
        posterBg: "#FFFFFF",
        posterInk: th.bg,
        mapBg: th.bg,
        stars: th.star,
        gridLine: "#FFFFFF",
        constLine: "#FFFFFF",
        constNode: "#FFFFFF",
        outline: "#FFFFFF",
        theme: th,
        neon: false,
      };
    }

    return {
      posterBg: th.bg,
      posterInk: "#FFFFFF",
      mapBg: th.bg,
      stars: "#FFFFFF",
      gridLine: "#FFFFFF",
      constLine: "#FFFFFF",
      constNode: "#FFFFFF",
      outline: "#FFFFFF",
      theme: th,
      neon: false,
    };
  }

  function syncThickness(){
    state.map.posterMarginThickness = POSTER_MARGIN_THICKNESS_FIXED;
    state.map.mapCircleMarginThickness = OUTLINE_THICKNESS_FIXED;
  }

  function updatePreviewZoom(){
    const isMobile = window.matchMedia("(max-width: 980px)").matches;
    if (isMobile) return;
    if (!$previewArea) return;

    const w = $previewArea.clientWidth - 32;
    const h = $previewArea.clientHeight - 32;
    if (w <= 0 || h <= 0) return;

    const z = Math.min(w / POSTER_W, h / POSTER_H);
    const finalZ = clamp(z * 0.98, 0.35, 0.95);
    document.documentElement.style.setProperty("--previewZoom", finalZ.toFixed(4));
  }

  // ==========================================================
  // ✅ Watermark: SIEMPRE ON (sin toggle), opacidad fija 5%
  // ==========================================================
  let $watermark = null;

  function ensurePreviewWatermarkLayer(){
    if ($watermark) return;
    if (!$previewStage) return;

    $watermark = document.getElementById("watermark");
    if (!$watermark){
      $watermark = document.createElement("div");
      $watermark.id = "watermark";
      $previewStage.appendChild($watermark);
    }

    Object.assign($watermark.style, {
      position: "absolute",
      inset: "0px",
      zIndex: "60",
      pointerEvents: "none",
      backgroundRepeat: "repeat",
      backgroundPosition: "0 0",
      backgroundSize: "auto",
      mixBlendMode: "normal",
      opacity: "1",
      borderRadius: "inherit",
      userSelect: "none",
    });
  }

  function makeWatermarkDataUri({
    text = "skyartcreator",
    fontSize = 18,
    opacity = 0.05, // ✅ fijo 5%
    angle = -45,
    gap = 120,
    color = "#FFFFFF"
  } = {}){
    const safeText = String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${gap}" height="${gap}">
  <defs>
    <style>
      .wm{
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        font-weight: 700;
        font-size: ${fontSize}px;
        letter-spacing: 1.4px;
      }
    </style>
  </defs>
  <g opacity="${opacity}">
    <g transform="translate(${gap/2} ${gap/2}) rotate(${angle}) translate(${-gap/2} ${-gap/2})">
      <text x="0" y="${gap/2}" fill="${color}" class="wm">${safeText}</text>
    </g>
  </g>
</svg>`.trim();

    const encoded = encodeURIComponent(svg)
      .replace(/%0A/g, "")
      .replace(/%20/g, " ");

    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  }

  function applyPreviewWatermark(tokens){
    ensurePreviewWatermarkLayer();
    if (!$watermark) return;

    const isNeon = isNeonThemeId(state.map.colorTheme);
    const isWhiteBg = (!isNeon && state.map.backgroundMode === "white");
    const color = isWhiteBg ? (tokens.posterInk || "#111111") : "#FFFFFF";

    const uri = makeWatermarkDataUri({
      text: "skyartcreator",
      fontSize: 18,
      opacity: 0.05,
      angle: -45,
      gap: 120,
      color
    });

    $watermark.style.backgroundImage = `url("${uri}")`;
  }

  // --------------------------
  // Autosize texto
  // --------------------------
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");

  function fitFontToWidth({ text, family, weight, maxWidth, start, min }){
    let size = start;
    while (size > min){
      mctx.font = `${weight} ${Math.round(size)}px ${family}`;
      const w = mctx.measureText(text).width;
      if (w <= maxWidth) break;
      size -= 1;
    }
    return Math.max(min, size);
  }

  function applyAutoTextSizing(){
    const family = state.text.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const bottom = document.getElementById("bottomText");
    if (!bottom) return;

    const maxW = bottom.clientWidth;
    if (!maxW) return;

    const baseTitle = isPoster() ? 46 : 54;
    const baseSub   = isPoster() ? 16 : 18;

    const titleText = ($pTitle.textContent || "").trim();
    const subText = ($pSubtitle.textContent || "").trim();

    if (titleText){
      const size = fitFontToWidth({
        text: titleText,
        family,
        weight: 900,
        maxWidth: maxW,
        start: baseTitle,
        min: 22,
      });
      $pTitle.style.fontSize = `${size}px`;
    }

    if (subText){
      const size = fitFontToWidth({
        text: subText,
        family,
        weight: 650,
        maxWidth: maxW,
        start: baseSub,
        min: 12,
      });
      $pSubtitle.style.fontSize = `${size}px`;
    }
  }

  // --------------------------
  // CAPAS: marco + papel + margen
  // --------------------------
  let $posterFrameArea = null;
  let $posterPaper = null;
  let $posterMarginLine = null;

  function ensurePosterLayers(){
    if (!$posterFrameArea){
      $posterFrameArea = document.createElement("div");
      $posterFrameArea.id = "posterFrameArea";
      Object.assign($posterFrameArea.style, {
        position: "absolute",
        inset: "0px",
        borderRadius: "0px",
        zIndex: "0",
        pointerEvents: "none",
        background: "transparent",
        opacity: "0",
      });
      $poster.insertBefore($posterFrameArea, $poster.firstChild);
    }

    if (!$posterPaper){
      $posterPaper = document.createElement("div");
      $posterPaper.id = "posterPaper";
      Object.assign($posterPaper.style, {
        position: "absolute",
        inset: "0px",
        borderRadius: "0px",
        zIndex: "1",
        pointerEvents: "none",
        background: "transparent",
      });
      $poster.insertBefore($posterPaper, $poster.firstChild.nextSibling);
    }

    if (!$posterMarginLine){
      $posterMarginLine = document.createElement("div");
      $posterMarginLine.id = "posterMarginLine";
      Object.assign($posterMarginLine.style, {
        position: "absolute",
        inset: "0px",
        borderRadius: "0px",
        zIndex: "2",
        pointerEvents: "none",
        border: "0px solid transparent",
        boxSizing: "border-box",
      });
      $poster.insertBefore($posterMarginLine, $poster.firstChild.nextSibling.nextSibling);
    }

    const inner = $poster.querySelector(".posterInner");
    if (inner) inner.style.zIndex = "3";
  }

  function updatePosterFrameInsetPx(){
    const pct = clamp(state.map.posterFramePct ?? POSTER_FRAME_PCT_DEFAULT, 0, POSTER_FRAME_PCT_MAX);
    state.map.posterFramePct = pct;
    state.map.posterFrameInsetPx = Math.round(POSTER_W * pct);
  }

  function applyPosterFrameAndMargin(tokens){
    ensurePosterLayers();
    updatePosterFrameInsetPx();
    syncThickness();

    // ✅ Poster: fuerza OFF marco/margen
    if (isPoster()){
      state.map.posterFrameEnabled = false;
      state.map.posterMarginEnabled = false;
    }

    const frameEdge = POSTER_FRAME_EDGE_GAP_PX;
    const marginEdge = POSTER_MARGIN_EDGE_GAP_PX;

    const frameOn = !!state.map.posterFrameEnabled && !isPoster();
    const marginOn = !!state.map.posterMarginEnabled && !frameOn && !isPoster();

    // ✅ sin puntas redondeadas cuando hay marco o margen
    $poster.style.borderRadius = (frameOn || marginOn) ? "0px" : "26px";

    const framePx = frameOn ? clamp(state.map.posterFrameInsetPx, 0, 160) : 0;

    $poster.style.background = tokens.posterBg;
    $poster.style.color = tokens.posterInk;

    if (frameOn){
      $posterFrameArea.style.opacity = "1";
      $posterFrameArea.style.background = tokens.posterInk;
      $posterFrameArea.style.inset = `${frameEdge}px`;
    } else {
      $posterFrameArea.style.opacity = "0";
      $posterFrameArea.style.background = "transparent";
      $posterFrameArea.style.inset = `${frameEdge}px`;
    }

    const innerInset = frameEdge + framePx;
    $posterPaper.style.background = tokens.posterBg;
    $posterPaper.style.inset = `${innerInset}px`;

    const thickness = POSTER_MARGIN_THICKNESS_FIXED;
    $posterMarginLine.style.inset = `${marginEdge}px`;
    $posterMarginLine.style.borderWidth = marginOn ? `${thickness}px` : "0px";
    $posterMarginLine.style.borderStyle = "solid";
    $posterMarginLine.style.borderColor = marginOn ? rgbaFromHex(tokens.posterInk, 1) : "transparent";

    const baseBottom = isPoster() ? 60 : 100;
    const safeBottomWhenMarginOn = marginEdge + thickness + 18;
    const finalBottom = marginOn ? Math.max(baseBottom, safeBottomWhenMarginOn) : baseBottom;
    $poster.style.setProperty("--bottomTextBottom", `${finalBottom}px`);
  }

  function applyPosterLayoutByStyle(){
    const st = getStyleDef();

    $poster.classList.toggle("classic", st.layout === "classic");
    $poster.classList.toggle("rectStyle", st.shape === "rect");

    if (st.shape === "rect") {
      $poster.style.setProperty("--mapW", "820px");
      $poster.style.setProperty("--mapH", "860px");
    } else {
      $poster.style.setProperty("--mapW", "780px");
      $poster.style.setProperty("--mapH", "780px");
    }
  }

  function applyPosterPaddingLayout(){
    const edge = POSTER_FRAME_EDGE_GAP_PX;
    const frame = (!isPoster() && state.map.posterFrameEnabled) ? clamp(state.map.posterFrameInsetPx, 0, 160) : 0;
    const pad = edge + frame;
    $poster.style.setProperty("--posterPad", `${pad}px`);
  }

  function setMapSizeFromPosterPad(){
    const st = getStyleDef();
    if (st.shape !== "circle") return;

    const base = isModern() ? 740 : 780;
    const frame = (!isPoster() && state.map.posterFrameEnabled) ? clamp(state.map.posterFrameInsetPx, 0, 160) : 0;
    const size = clamp(base - Math.round(frame * 0.6), 600, base);

    $poster.style.setProperty("--mapW", `${size}px`);
    $poster.style.setProperty("--mapH", `${size}px`);
  }

  function heartPath(ctx, cx, cy, size){
    const s = size / 18;
    ctx.beginPath();
    const steps = 220;
    for (let i = 0; i <= steps; i++){
      const t = (i / steps) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      // ✅ fórmula correcta (sin duplicar cos(3t))
      const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
      const px = cx + x * s * 1.10;
      const py = cy - y * s * 1.15;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // ==========================================================
  // ✅ Retícula: con opacidad configurable (0.05..0.60)
  // ==========================================================
  function drawGlobeGridWithRadius(ctx, cx, cy, R, gridLine, opacityMul = 1){
    const tiltX = 24 * Math.PI / 180;
    const sinX = Math.sin(tiltX), cosX = Math.cos(tiltX);

    const baseAlphaFront = 0.70;
    const baseAlphaBack  = 0.18;

    const alphaFront = clamp(baseAlphaFront * opacityMul, 0, 1);
    const alphaBack  = clamp(baseAlphaBack  * opacityMul, 0, 1);

    const lwFront = 1.35;
    const lwBack  = 1.00;

    function project(lat, lon){
      let x = Math.cos(lat) * Math.cos(lon);
      let y = Math.sin(lat);
      let z = Math.cos(lat) * Math.sin(lon);

      const y2 = y * cosX - z * sinX;
      const z2 = y * sinX + z * cosX;
      y = y2; z = z2;

      return { sx: cx + x * R, sy: cy - y * R, z };
    }

    function shouldSkipLine(points){
      if (!points || points.length < 6) return false;

      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      for (const p of points){
        if (p.sx < xMin) xMin = p.sx;
        if (p.sx > xMax) xMax = p.sx;
        if (p.sy < yMin) yMin = p.sy;
        if (p.sy > yMax) yMax = p.sy;
      }
      const xRange = xMax - xMin;
      const yRange = yMax - yMin;

      const a = points[0];
      const b = points[points.length - 1];
      const dx = b.sx - a.sx;
      const dy = b.sy - a.sy;

      // ✅ protege líneas verticales fuertes
      if (Math.abs(dx) < 1.0 && Math.abs(dy) > 22) return false;

      // ✅ mata horizontales perfectas
      if (yRange < 1.6 && xRange > 18) return true;

      if (Math.abs(dy) < 1.0 && Math.abs(dx) > 30){
        const denom = Math.hypot(dx, dy) || 1;
        let maxDev = 0;
        for (let i = 1; i < points.length - 1; i++){
          const p = points[i];
          const dev = Math.abs(dy * p.sx - dx * p.sy + b.sx * a.sy - b.sy * a.sx) / denom;
          if (dev > maxDev) maxDev = dev;
        }
        if (maxDev < 1.2) return true;
      }

      return false;
    }

    function strokePath(points, alpha, lw){
      if (!points || points.length < 2) return;
      if (shouldSkipLine(points)) return;

      ctx.save();
      ctx.strokeStyle = gridLine;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(points[0].sx, points[0].sy);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].sx, points[i].sy);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // Horizontales
    const latsDeg = [-60, -40, -20, 0, 20, 40, 60];
    const lonSteps = 240;

    for (const latDeg of latsDeg){
      const lat = latDeg * Math.PI / 180;
      const frontPts = [];
      const backPts  = [];

      for (let i = 0; i <= lonSteps; i++){
        const lon = (i / lonSteps) * Math.PI * 2;
        const p = project(lat, lon);
        if (p.z >= 0) frontPts.push(p);
        else backPts.push(p);
      }

      strokePath(backPts,  alphaBack,  lwBack);
      strokePath(frontPts, alphaFront, lwFront);
    }

    // Verticales
    const baseLonsDeg = [];
    for (let d = -75; d <= 75; d += 15) baseLonsDeg.push(d);
    baseLonsDeg.push(-90, 90);

    const lonsDeg = [];
    for (const b of baseLonsDeg){
      lonsDeg.push(b);
      lonsDeg.push(b + 180);
    }

    const latSteps = 260;

    for (const lonDeg of lonsDeg){
      const lon = (lonDeg * Math.PI / 180) % (Math.PI * 2);
      const frontPts = [];
      const backPts  = [];

      for (let i = 0; i <= latSteps; i++){
        const lat = (-90 + (i / latSteps) * 180) * Math.PI / 180;
        const p = project(lat, lon);
        if (p.z >= 0) frontPts.push(p);
        else backPts.push(p);
      }

      strokePath(backPts,  alphaBack,  lwBack);
      strokePath(frontPts, alphaFront, lwFront);
    }

    ctx.restore();

    // borde globo
    ctx.save();
    ctx.globalAlpha = clamp(0.14 * opacityMul, 0, 1);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = gridLine;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawStars(ctx, w, h, rand, starsColor){
    const N = Math.floor(680 + rand()*80);
    for (let i = 0; i < N; i++){
      const x = rand() * w;
      const y = rand() * h;

      const big = rand() > 0.92;
      const r = big ? (1.5 + rand() * 1.8) : (rand() * 1.2);
      const a = big ? (0.75 + rand() * 0.25) : (0.35 + rand() * 0.55);

      ctx.beginPath();
      ctx.globalAlpha = a;
      ctx.fillStyle = starsColor;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawConstellations(ctx, w, h, rand, constLine, constNode, lineW, nodeR){
    const count = 6;
    ctx.save();
    ctx.lineWidth = lineW;
    ctx.strokeStyle = constLine;
    ctx.fillStyle = constNode;

    const safeMinX = 36, safeMaxX = w - 36;
    const safeMinY = 36, safeMaxY = h - 36;

    for (let c = 0; c < count; c++){
      const cx = safeMinX + rand() * (safeMaxX - safeMinX);
      const cy = safeMinY + rand() * (safeMaxY - safeMinY);

      const points = 4 + Math.floor(rand() * 4);
      const pts = [];
      const rx = 40 + rand() * 110;
      const ry = 40 + rand() * 110;

      for (let i = 0; i < points; i++){
        const a = rand() * Math.PI * 2;
        const r1 = 0.35 + rand() * 0.75;
        const x = clamp(cx + Math.cos(a) * rx * r1, safeMinX, safeMaxX);
        const y = clamp(cy + Math.sin(a) * ry * r1, safeMinY, safeMaxY);
        pts.push({ x, y });
      }

      const mx = pts.reduce((s,p)=>s+p.x,0)/pts.length;
      const my = pts.reduce((s,p)=>s+p.y,0)/pts.length;
      pts.sort((p1,p2)=>Math.atan2(p1.y-my,p1.x-mx)-Math.atan2(p2.y-my,p2.x-mx));

      ctx.globalAlpha = 1;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();

      ctx.globalAlpha = 1;
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, nodeR, 0, Math.PI*2);
        ctx.fill();
      });
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Rect: retícula NO se zoom; zoom solo estrellas + constelaciones
  function drawRectMap(ctx, mapW, mapH, tokens, rand, showOutline, outlineW, conLineW, nodeR){
    ctx.save();

    ctx.fillStyle = tokens.mapBg;
    ctx.fillRect(0,0,mapW,mapH);

    if (state.map.showGrid && isGridAllowedForCurrentStyle()){
      const cx = mapW/2, cy = mapH/2;
      const R = Math.min(mapW, mapH) * 0.48;
      const mul = clamp(Number(state.map.gridOpacity ?? 0.60), 0.05, 0.60);
      drawGlobeGridWithRadius(ctx, cx, cy, R, tokens.gridLine, mul);
    }

    const z = clamp(state.map.mapZoom || 1, 1.0, 1.6);
    ctx.save();
    if (z !== 1){
      ctx.translate(mapW/2, mapH/2);
      ctx.scale(z, z);
      ctx.translate(-mapW/2, -mapH/2);
    }

    drawStars(ctx, mapW, mapH, rand, tokens.stars);
    if (state.map.showConstellations){
      drawConstellations(ctx, mapW, mapH, rand, tokens.constLine, tokens.constNode, conLineW, nodeR);
    }
    ctx.restore();

    ctx.restore();

    if (showOutline){
      ctx.save();
      ctx.strokeStyle = tokens.outline;
      ctx.lineWidth = outlineW;
      ctx.globalAlpha = 1;
      const half = outlineW / 2;
      ctx.strokeRect(half, half, mapW - outlineW, mapH - outlineW);
      ctx.restore();
    }
  }

  function drawMap(){
    syncThickness();

    const mapW = Math.round(parseFloat(getComputedStyle($poster).getPropertyValue("--mapW")) || 780);
    const mapH = Math.round(parseFloat(getComputedStyle($poster).getPropertyValue("--mapH")) || 780);

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    $canvas.width = mapW * dpr;
    $canvas.height = mapH * dpr;
    $canvas.style.width = mapW + "px";
    $canvas.style.height = mapH + "px";

    const ctx = $canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const st = getStyleDef();
    const tokens = computeRenderTokens();
    const rand = mulberry32(state.map.seed);

    const cs = clamp(state.map.constellationSize, 1, 4);
    const conLineW = 0.9 + cs * 0.55;
    const nodeR = 1.6 + cs * 0.35;

    const outlineEnabled = !!state.map.mapCircleMarginEnabled;
    const outlineW = OUTLINE_THICKNESS_FIXED;

    const frameOn = (!isPoster()) && !!state.map.posterFrameEnabled;
    const marginOn = (!isPoster()) && !!state.map.posterMarginEnabled && !frameOn;

    const shouldInset = frameOn || marginOn;
    const insetPad = shouldInset
      ? Math.round(Math.min(mapW, mapH) * (state.map.mapCircleInsetPct || 0.10))
      : 0;

    ctx.clearRect(0, 0, mapW, mapH);

    const z = clamp(state.map.mapZoom || 1, 1.0, 1.6);
    const gridMul = clamp(Number(state.map.gridOpacity ?? 0.60), 0.05, 0.60);

    if (st.shape === "circle"){
      const cx = mapW/2, cy = mapH/2;
      const rOuter = Math.min(mapW,mapH)/2;
      const rContent = rOuter - insetPad;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rContent, 0, Math.PI*2);
      ctx.clip();

      ctx.fillStyle = tokens.mapBg;
      ctx.fillRect(0,0,mapW,mapH);

      if (state.map.showGrid && isGridAllowedForCurrentStyle()){
        drawGlobeGridWithRadius(ctx, cx, cy, rContent, tokens.gridLine, gridMul);
      }

      ctx.save();
      if (z !== 1){
        ctx.translate(cx, cy);
        ctx.scale(z, z);
        ctx.translate(-cx, -cy);
      }

      drawStars(ctx, mapW, mapH, rand, tokens.stars);
      if (state.map.showConstellations){
        drawConstellations(ctx, mapW, mapH, rand, tokens.constLine, tokens.constNode, conLineW, nodeR);
      }
      ctx.restore();

      ctx.restore(); // clip

      if (outlineEnabled){
        ctx.save();
        ctx.strokeStyle = tokens.outline;
        ctx.lineWidth = outlineW;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, rContent - outlineW/2), 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    if (st.shape === "heart"){
      const cx = mapW/2;
      const cy = mapH/2 - Math.round(mapH * 0.06);

      const baseSize = Math.min(mapW, mapH) * (0.5227 * 0.95);
      const size = clamp(baseSize - insetPad * 0.95, baseSize * 0.70, baseSize);

      ctx.save();
      heartPath(ctx, cx, cy, size);
      ctx.clip();

      ctx.fillStyle = tokens.mapBg;
      ctx.fillRect(0,0,mapW,mapH);

      // si quieres retícula dentro del corazón, se puede, pero la mantengo off igual que tu estilo
      // (solo se activa si showGrid está ON)
      if (state.map.showGrid && isGridAllowedForCurrentStyle()){
        drawGlobeGridWithRadius(ctx, cx, cy, size * 0.60, tokens.gridLine, gridMul);
      }

      ctx.save();
      if (z !== 1){
        ctx.translate(cx, cy);
        ctx.scale(z, z);
        ctx.translate(-cx, -cy);
      }

      drawStars(ctx, mapW, mapH, rand, tokens.stars);
      if (state.map.showConstellations){
        drawConstellations(ctx, mapW, mapH, rand, tokens.constLine, tokens.constNode, conLineW, nodeR);
      }
      ctx.restore();

      ctx.restore(); // clip

      if (outlineEnabled){
        ctx.save();
        ctx.strokeStyle = tokens.outline;
        ctx.lineWidth = outlineW;
        ctx.globalAlpha = 1;
        heartPath(ctx, cx, cy, size);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    if (st.shape === "rect"){
      drawRectMap(ctx, mapW, mapH, tokens, rand, outlineEnabled, outlineW, conLineW, nodeR);
      return;
    }
  }

  function renderPosterFont(){
    $poster.style.fontFamily = state.text.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  }

  function renderPosterText(){
    $pTitle.style.display = state.visible.title ? "block" : "none";
    $pSubtitle.style.display = state.visible.subtitle ? "block" : "none";
    $pPlace.style.display = state.visible.place ? "block" : "none";
    $pCoords.style.display = state.visible.coords ? "block" : "none";
    $pDatetime.style.display = state.visible.datetime ? "block" : "none";

    const title = String(state.text.title || "").slice(0, TITLE_MAX);
    const sub = String(state.text.subtitle || "").slice(0, SUB_MAX);

    state.text.title = title;
    state.text.subtitle = sub;

    $pTitle.textContent = title;
    $pSubtitle.textContent = sub;
    $pPlace.textContent = state.text.place || "";
    $pCoords.textContent = state.text.coords || "";
    $pDatetime.textContent = getDateTimeString();

    applyAutoTextSizing();
  }

  function renderPosterAndMap(){
    const tokens = computeRenderTokens();

    applyPosterLayoutByStyle();
    applyPosterFrameAndMargin(tokens);
    applyPosterPaddingLayout();
    setMapSizeFromPosterPad();

    drawMap();
    renderPosterText();

    applyPreviewWatermark(tokens);

    updatePreviewZoom();
  }

  function toggleSwitch(checked, onChange){
    const t = document.createElement("div");
    t.className = "toggle" + (checked ? " on" : "");
    t.role = "switch";
    t.tabIndex = 0;
    t.setAttribute("aria-checked", String(!!checked));

    function set(val){
      checked = !!val;
      t.className = "toggle" + (checked ? " on" : "");
      t.setAttribute("aria-checked", String(checked));
      onChange(checked);
    }

    t.onclick = (e) => { e.stopPropagation(); set(!checked); };
    t.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        set(!checked);
      }
    };
    return t;
  }

  function renderTabs(){
    $tabs.innerHTML = "";
    STEPS.forEach((s, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sheetTab" + (idx === state.step ? " active" : "");
      b.textContent = `${idx + 1}) ${s.label}`;
      b.onclick = () => { state.step = idx; renderAll(); };
      $tabs.appendChild(b);
    });
  }

  function makeFourPointStarSvg(color){
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.style.opacity = "0.95";

    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", "M7 0 L8.8 5.2 L14 7 L8.8 8.8 L7 14 L5.2 8.8 L0 7 L5.2 5.2 Z");
    p.setAttribute("fill", color || "rgba(255,255,255,0.92)");
    svg.appendChild(p);
    return svg;
  }

  function renderSwatchGrid({ title, items, activeId, onPick, dotBg, starColor }){
    const wrap = document.createElement("div");
    wrap.className = "formRow";
    wrap.innerHTML = `<div class="label">${title}</div>`;

    const grid = document.createElement("div");
    grid.className = "swatchGrid";

    items.forEach(it => {
      const tile = document.createElement("div");
      tile.className = "swatchTile" + (activeId === it.id ? " active" : "");

      const dot = document.createElement("div");
      dot.className = "swatchDot";
      dot.style.background = dotBg(it);

      dot.appendChild(makeFourPointStarSvg(starColor(it)));

      const name = document.createElement("div");
      name.className = "swatchName";
      name.textContent = it.name;

      // ✅ beige SOLO para el texto del color “Cálido”
      if (it.id === "warm") name.style.color = "#F6E7C9";

      tile.appendChild(dot);
      tile.appendChild(name);

      tile.onclick = () => onPick(it.id);
      grid.appendChild(tile);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  function groupGap(){
    const g = document.createElement("div");
    g.className = "groupGap";
    return g;
  }

  function fieldCard(label, enabled, onToggle, renderBody){
    const card = document.createElement("div");
    card.className = 'fieldCard';

    const header = document.createElement("div");
    header.className = "fieldHeader";

    const lab = document.createElement("div");
    lab.className = "fieldLabel";
    lab.textContent = label;

    const toggle = toggleSwitch(!!enabled, (val) => onToggle(val));

    header.appendChild(lab);
    header.appendChild(toggle);
    card.appendChild(header);

    if (enabled && typeof renderBody === "function"){
      const body = document.createElement("div");
      body.className = "fieldBody";
      renderBody(body);
      card.appendChild(body);
    }

    return card;
  }

  function loadPrefsForStyle(styleId){
    const p = state.map.stylePrefs[styleId];
    if (!p) return;

    state.map.posterFrameEnabled = (styleId === "poster") ? false : !!p.frame;
    state.map.posterMarginEnabled = (styleId === "poster") ? false : !!p.margin;
    state.map.mapCircleMarginEnabled = !!p.outline;
  }

  function savePrefsForStyle(styleId){
    const p = state.map.stylePrefs[styleId] || (state.map.stylePrefs[styleId] = { frame:false, margin:false, outline:false });

    p.frame = (styleId === "poster") ? false : !!state.map.posterFrameEnabled;
    p.margin = (styleId === "poster") ? false : !!state.map.posterMarginEnabled;
    p.outline = !!state.map.mapCircleMarginEnabled;
  }

  function drawStyleTextSkeleton(ctx, w, h, styleId, color){
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.28;

    const padX = 22;
    const bottomPad = 20;

    if (styleId === "classic"){
      const titleW = Math.round(w * 0.58);
      const subW   = Math.round(w * 0.38);
      const x1 = Math.round((w - titleW)/2);
      const x2 = Math.round((w - subW)/2);

      const yTitle = h - bottomPad - 52;
      const ySub   = h - bottomPad - 38;
      const yMeta1 = h - bottomPad - 20;
      const yMeta2 = h - bottomPad - 10;
      const yMeta3 = h - bottomPad;

      ctx.fillRect(x1, yTitle, titleW, 6);
      ctx.globalAlpha = 0.20;
      ctx.fillRect(x2, ySub, subW, 5);

      ctx.globalAlpha = 0.18;
      const metaW = Math.round(w * 0.46);
      const xm = Math.round((w - metaW)/2);
      ctx.fillRect(xm, yMeta1, metaW, 4);
      ctx.fillRect(xm, yMeta2, metaW * 0.88, 4);
      ctx.fillRect(xm, yMeta3, metaW * 0.76, 4);
    }
    else if (styleId === "poster"){
      const titleW = Math.round(w * 0.52);
      const subW   = Math.round(w * 0.34);
      const x1 = Math.round((w - titleW)/2);
      const x2 = Math.round((w - subW)/2);

      const yTitle = h - bottomPad - 56;
      const ySub   = h - bottomPad - 42;
      const yMeta1 = h - bottomPad - 24;
      const yMeta2 = h - bottomPad - 14;
      const yMeta3 = h - bottomPad - 4;

      ctx.fillRect(x1, yTitle, titleW, 6);
      ctx.globalAlpha = 0.20;
      ctx.fillRect(x2, ySub, subW, 5);

      ctx.globalAlpha = 0.18;
      const metaW = Math.round(w * 0.44);
      const xm = Math.round((w - metaW)/2);
      ctx.fillRect(xm, yMeta1, metaW, 4);
      ctx.fillRect(xm, yMeta2, metaW * 0.88, 4);
      ctx.fillRect(xm, yMeta3, metaW * 0.76, 4);
    }
    else {
      const x = padX;
      const titleW = Math.round(w * 0.55);
      const subW   = Math.round(w * 0.36);

      const yTitle = h - bottomPad - 52;
      const ySub   = h - bottomPad - 38;
      const yMeta1 = h - bottomPad - 20;
      const yMeta2 = h - bottomPad - 10;
      const yMeta3 = h - bottomPad;

      ctx.fillRect(x, yTitle, titleW, 6);
      ctx.globalAlpha = 0.20;
      ctx.fillRect(x, ySub, subW, 5);

      ctx.globalAlpha = 0.18;
      ctx.fillRect(x, yMeta1, Math.round(w * 0.46), 4);
      ctx.fillRect(x, yMeta2, Math.round(w * 0.40), 4);
      ctx.fillRect(x, yMeta3, Math.round(w * 0.32), 4);
    }

    ctx.restore();
  }

  function renderSectionDesign(){
    $section.innerHTML = "";

    const t = document.createElement("div");
    t.className = "title";
    t.textContent = "Diseño";

    const s = document.createElement("div");
    s.className = "sub";
    s.textContent = "Selecciona un estilo de poster, los colores y las opcines de personalizacion para tu mapa o genera un aleatorio. ¡Cada mapa es unico y diferente!";

    $section.appendChild(t);
    $section.appendChild(s);

    const randomBtn = document.createElement("button");
    randomBtn.type = "button";
    randomBtn.className = "btn primary";
    randomBtn.style.width = "100%";
    randomBtn.textContent = "Poster Aleatorio";
    randomBtn.onclick = () => {
      const r = Math.random;
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      const pickBool = () => r() > 0.5;
      const pickRange = (min, max) => min + r() * (max - min);

      const prevStyle = state.map.styleId;
      savePrefsForStyle(prevStyle);

      state.map.styleId = pick(MAP_STYLES).id;
      state.map.colorTheme = pick(COLOR_THEMES).id;

      loadPrefsForStyle(state.map.styleId);

      if (isPoster()){
        state.map.posterFrameEnabled = false;
        state.map.posterMarginEnabled = false;
      }

      state.map.showGrid = isGridAllowedForCurrentStyle() ? pickBool() : false;
      state.map.showConstellations = pickBool();
      state.map.constellationSize = Math.round(pickRange(1, 4) * 2) / 2;
      state.map.mapZoom = Math.round(pickRange(1.0, 1.6) * 20) / 20;

      // ✅ grid opacity se queda dentro de 0.05..0.60
      state.map.gridOpacity = clamp(state.map.gridOpacity ?? 0.60, 0.05, 0.60);

      if (isNeonThemeId(state.map.colorTheme)) state.map.backgroundMode = "match";

      state.map.seed = (Math.random() * 1e9) | 0;

      renderPosterAndMap();
      renderAll();
    };
    $section.appendChild(randomBtn);

    $section.appendChild(groupGap());

    const styleRow = document.createElement("div");
    styleRow.className = "formRow";
    styleRow.innerHTML = `<div class="label">Estilos</div>`;

    const grid = document.createElement("div");
    grid.className = "styleGrid";

    MAP_STYLES.forEach(st => {
      const tile = document.createElement("div");
      tile.className = "styleTile" + (state.map.styleId === st.id ? " active" : "");

      const poster = document.createElement("div");
      poster.className = "stylePoster";

      const c = document.createElement("canvas");
      c.width = 180; c.height = 240;
      const ctx = c.getContext("2d");

      const tokens = computeRenderTokens();
      ctx.clearRect(0,0,180,240);
      ctx.fillStyle = tokens.posterBg;
      ctx.fillRect(0,0,180,240);

      ctx.save();
      const mx = 22, my = 18, mw = 136, mh = (st.shape === "rect") ? 140 : 136;

      if (st.shape === "circle"){
        ctx.beginPath();
        ctx.arc(mx+mw/2, my+mw/2, mw/2, 0, Math.PI*2);
        ctx.clip();
      } else if (st.shape === "heart"){
        const cx = mx + mw/2;
        const cy = my + mw/2 - 6;
        const size = mw * 0.50;
        heartPath(ctx, cx, cy, size);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(mx, my, mw, mh);
        ctx.clip();
      }

      ctx.fillStyle = tokens.mapBg;
      ctx.fillRect(mx,my,mw,mh);

      const rr = mulberry32(202600 + st.id.length * 17);
      for (let i=0;i<160;i++){
        const x = mx + rr()*mw;
        const y = my + rr()*mh;
        ctx.globalAlpha = 0.22 + rr()*0.55;
        ctx.fillStyle = tokens.stars;
        ctx.beginPath();
        ctx.arc(x,y,rr()*0.9,0,Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      const showOutlinePreview = (st.id === "classic" || st.id === "romantico");
      if (showOutlinePreview && st.shape !== "rect"){
        ctx.save();
        ctx.strokeStyle = tokens.outline;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2;
        if (st.shape === "circle"){
          ctx.beginPath();
          ctx.arc(mx+mw/2, my+mw/2, mw/2 - 2, 0, Math.PI*2);
          ctx.stroke();
        } else if (st.shape === "heart"){
          const cx = mx + mw/2;
          const cy = my + mw/2 - 6;
          const size = mw * 0.50;
          heartPath(ctx, cx, cy, size);
          ctx.stroke();
        }
        ctx.restore();
      }

      drawStyleTextSkeleton(ctx, 180, 240, st.id, tokens.posterInk);
      poster.appendChild(c);

      const name = document.createElement("div");
      name.className = "styleNameLabel";
      name.textContent = st.name;

      tile.appendChild(poster);
      tile.appendChild(name);

      tile.onclick = () => {
        const prevStyle = state.map.styleId;
        savePrefsForStyle(prevStyle);

        state.map.styleId = st.id;
        loadPrefsForStyle(st.id);

        if (isPoster()){
          state.map.posterFrameEnabled = false;
          state.map.posterMarginEnabled = false;
        }

        if (!isGridAllowedForCurrentStyle()) state.map.showGrid = false;

        renderPosterAndMap();
        renderAll();
      };

      grid.appendChild(tile);
    });

    styleRow.appendChild(grid);
    $section.appendChild(styleRow);

    $section.appendChild(groupGap());

    $section.appendChild(renderSwatchGrid({
      title: "Color del Mapa estelar",
      items: COLOR_THEMES,
      activeId: state.map.colorTheme,
      onPick: (id) => {
        state.map.colorTheme = id;
        if (isNeonThemeId(id)) state.map.backgroundMode = "match";
        renderPosterAndMap();
        renderAll();
      },
      dotBg: (it) => {
        const neon = isNeonThemeId(it.id);
        if (neon) return "#000000";
        return colorsFor(it.id).bg;
      },
      starColor: (it) => {
        const neon = isNeonThemeId(it.id);
        if (neon) return colorsFor(it.id).star;
        return "#FFFFFF";
      }
    }));

    $section.appendChild(groupGap());

    const isNeon = isNeonThemeId(state.map.colorTheme);
    const bgItems = isNeon ? [{ id:"match", name: getSelectedThemeName() }] : [
      { id:"match", name: getSelectedThemeName() },
      { id:"white", name: "Blanco" },
    ];

    $section.appendChild(renderSwatchGrid({
      title: "Color de fondo",
      items: bgItems,
      activeId: state.map.backgroundMode,
      onPick: (id) => {
        state.map.backgroundMode = id;
        renderPosterAndMap();
        renderAll();
      },
      dotBg: (it) => {
        if (it.id === "white") return "#FFFFFF";
        return colorsFor(state.map.colorTheme).bg;
      },
      starColor: (it) => {
        if (it.id === "white") return "#000000";
        return "#FFFFFF";
      }
    }));

    $section.appendChild(groupGap());

    // ✅ Marco/Margen aparecen también en Moderno (solo se ocultan en Poster)
    if (!isPoster()){
      $section.appendChild(fieldCard(
        "Marco del póster",
        !!state.map.posterFrameEnabled,
        (val) => {
          state.map.posterFrameEnabled = val;
          if (val) state.map.posterMarginEnabled = false;
          savePrefsForStyle(state.map.styleId);
          renderPosterAndMap();
          renderAll();
        },
        (body) => {
          const label = document.createElement("div");
          label.className = "label";
          label.textContent = "Tamaño";
          body.appendChild(label);

          const r = document.createElement("input");
          r.type = "range";
          r.min = "0.00";
          r.max = String(POSTER_FRAME_PCT_MAX);
          r.step = "0.005";
          r.value = String(state.map.posterFramePct ?? POSTER_FRAME_PCT_DEFAULT);
          r.oninput = () => {
            state.map.posterFramePct = Number(r.value);
            updatePosterFrameInsetPx();
            renderPosterAndMap();
            renderAll();
          };
          body.appendChild(r);
        }
      ));

      // ✅ margen fijo: NO mostrar body (no hay slider)
      $section.appendChild(fieldCard(
        "Margen del poster",
        !!state.map.posterMarginEnabled,
        (val) => {
          state.map.posterMarginEnabled = val;
          if (val) state.map.posterFrameEnabled = false;
          savePrefsForStyle(state.map.styleId);
          renderPosterAndMap();
          renderAll();
        },
        null
      ));

      $section.appendChild(groupGap());
    }

    // ✅ contorno fijo: NO mostrar body (no hay slider)
    $section.appendChild(fieldCard(
      "Contorno del mapa",
      !!state.map.mapCircleMarginEnabled,
      (val) => {
        state.map.mapCircleMarginEnabled = val;
        savePrefsForStyle(state.map.styleId);
        drawMap();
        renderAll();
      },
      null
    ));

    $section.appendChild(fieldCard(
      "Constelaciones",
      !!state.map.showConstellations,
      (val) => {
        state.map.showConstellations = val;
        drawMap();
        renderAll();
      },
      (body) => {
        const label = document.createElement("div");
        label.className = "label sliderLabel";
        label.textContent = "Tamaño";
        body.appendChild(label);

        const r = document.createElement("input");
        r.type = "range";
        r.min = "1";
        r.max = "4";
        r.step = "0.5";
        r.value = String(state.map.constellationSize);
        r.oninput = () => { state.map.constellationSize = Number(r.value); drawMap(); };
        body.appendChild(r);
      }
    ));

    // ✅ Retícula (toggle + slider opacidad)
    if (isGridAllowedForCurrentStyle()){
      $section.appendChild(fieldCard(
        "Retícula",
        !!state.map.showGrid,
        (val) => { state.map.showGrid = val; drawMap(); renderAll(); },
        (body) => {
          const label = document.createElement("div");
          label.className = "label sliderLabel";
          const pct = Math.round(clamp(Number(state.map.gridOpacity ?? 0.60), 0.05, 0.60) * 100);
          label.textContent = `Transparencia (${pct}%)`;
          body.appendChild(label);

          const r = document.createElement("input");
          r.type = "range";
          r.min = "0.05";
          r.max = "0.60"; // ✅ max = 60%
          r.step = "0.01";
          r.value = String(clamp(Number(state.map.gridOpacity ?? 0.60), 0.05, 0.60));
          r.oninput = () => {
            state.map.gridOpacity = Number(r.value);
            const pct2 = Math.round(state.map.gridOpacity * 100);
            label.textContent = `Transparencia (${pct2}%)`;
            drawMap();
          };
          body.appendChild(r);
        }
      ));
    } else {
      state.map.showGrid = false;
    }

    $section.appendChild(groupGap());

    const seedCard = document.createElement("div");
    seedCard.className = "formRow";
    seedCard.innerHTML = `<div class="label">Nuevo cielo</div>`;
    const seedBtn = document.createElement("button");
    seedBtn.type = "button";
    seedBtn.className = "btn ghost";
    seedBtn.style.width = "100%";
    seedBtn.textContent = "Generar nuevo cielo";
    seedBtn.onclick = () => { state.map.seed = (Math.random() * 1e9) | 0; drawMap(); };
    seedCard.appendChild(seedBtn);
    $section.appendChild(seedCard);

    const zoomCard = document.createElement("div");
    zoomCard.className = "formRow";
    zoomCard.innerHTML = `<div class="label">Zoom de Estrellas</div>`;
    const mapZoomRange = document.createElement("input");
    mapZoomRange.type = "range";
    mapZoomRange.min = "1.00";
    mapZoomRange.max = "1.60";
    mapZoomRange.step = "0.05";
    mapZoomRange.value = String(state.map.mapZoom);
    mapZoomRange.oninput = () => { state.map.mapZoom = Number(mapZoomRange.value); drawMap(); };
    zoomCard.appendChild(mapZoomRange);
    $section.appendChild(zoomCard);

    const btns = document.createElement("div");
    btns.className = "btnRow";
    const left = document.createElement("div");
    const right = document.createElement("div");

    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn primary";
    next.textContent = "Siguiente →";
    next.onclick = () => { state.step = 1; renderAll(); };

    right.appendChild(next);
    btns.appendChild(left);
    btns.appendChild(right);
    $section.appendChild(btns);
  }

  function renderSectionContent(){
    $section.innerHTML = "";

    const t = document.createElement("div");
    t.className = "title";
    t.textContent = "Contenido";

    const s = document.createElement("div");
    s.className = "sub";
    s.textContent = "Activa cada campo y escribe su contenido.";

    const fontRow = document.createElement("div");
    fontRow.className = "formRow";
    fontRow.innerHTML = `<div class="label">Fuente</div>`;
    const fontSel = document.createElement("select");
    fontSel.className = "select";
    FONT_PRESETS.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.key;
      opt.textContent = f.name;
      fontSel.appendChild(opt);
    });
    fontSel.value = state.text.fontKey;
    fontSel.onchange = () => {
      const key = fontSel.value;
      state.text.fontKey = key;
      const found = FONT_PRESETS.find(f => f.key === key) || FONT_PRESETS[0];
      state.text.fontFamily = found.css;
      renderPosterFont();
      renderPosterText();
    };
    fontRow.appendChild(fontSel);

    $section.appendChild(t);
    $section.appendChild(s);
    $section.appendChild(fontRow);

    $section.appendChild(fieldCard(
      "Título",
      state.visible.title,
      (val) => { state.visible.title = val; renderPosterText(); renderAll(); },
      (body) => {
        const inp = document.createElement("input");
        inp.className = "fieldInput";
        inp.value = state.text.title || "";
        inp.maxLength = TITLE_MAX;
        inp.oninput = () => { state.text.title = inp.value; renderPosterText(); };
        body.appendChild(inp);
      }
    ));

    $section.appendChild(fieldCard(
      "Mensaje",
      state.visible.subtitle,
      (val) => { state.visible.subtitle = val; renderPosterText(); renderAll(); },
      (body) => {
        const inp = document.createElement("input");
        inp.className = "fieldInput";
        inp.value = state.text.subtitle || "";
        inp.maxLength = SUB_MAX;
        inp.oninput = () => { state.text.subtitle = inp.value; renderPosterText(); };
        body.appendChild(inp);
      }
    ));

    $section.appendChild(fieldCard(
      "Lugar",
      state.visible.place,
      (val) => { state.visible.place = val; renderPosterText(); renderAll(); },
      (body) => {
        const inp = document.createElement("input");
        inp.className = "fieldInput";
        inp.value = state.text.place || "";
        inp.oninput = () => { state.text.place = inp.value; renderPosterText(); };
        body.appendChild(inp);
      }
    ));

    $section.appendChild(fieldCard(
      "Coordenadas",
      state.visible.coords,
      (val) => { state.visible.coords = val; renderPosterText(); renderAll(); },
      (body) => {
        const inp = document.createElement("input");
        inp.className = "fieldInput";
        inp.value = state.text.coords || "";
        inp.oninput = () => {
          state.text.coords = inp.value;
          updateSeedFromDateTime();
          renderPosterText();
          drawMap();
        };
        body.appendChild(inp);
      }
    ));

    $section.appendChild(fieldCard(
      "Fecha / hora",
      state.visible.datetime,
      (val) => { state.visible.datetime = val; renderPosterText(); renderAll(); },
      (body) => {
        const dateInp = document.createElement("input");
        dateInp.className = "fieldInput";
        dateInp.type = "date";
        dateInp.value = state.text.date || "";
        dateInp.oninput = () => {
          state.text.date = dateInp.value;
          updateSeedFromDateTime();
          renderPosterText();
          drawMap();
        };
        body.appendChild(dateInp);

        const spacer = document.createElement("div");
        spacer.style.height = "10px";
        body.appendChild(spacer);

        const timeInp = document.createElement("input");
        timeInp.className = "fieldInput";
        timeInp.type = "time";
        timeInp.value = state.text.time || "";
        timeInp.oninput = () => {
          state.text.time = timeInp.value;
          updateSeedFromDateTime();
          renderPosterText();
          drawMap();
        };
        body.appendChild(timeInp);
      }
    ));

    const btns = document.createElement("div");
    btns.className = "btnRow";
    const left = document.createElement("div");
    const right = document.createElement("div");

    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "btn ghost";
    prev.textContent = "← Anterior";
    prev.onclick = () => { state.step = 0; renderAll(); };

    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn primary";
    next.textContent = "Siguiente →";
    next.onclick = () => { state.step = 2; renderAll(); };

    left.appendChild(prev);
    right.appendChild(next);
    btns.appendChild(left);
    btns.appendChild(right);
    $section.appendChild(btns);
  }

  function cmToPx(cm, dpi){
    const inches = cm / 2.54;
    return Math.round(inches * dpi);
  }

  function downloadDataURL(dataURL, filename){
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
  function loadJsPDF(){
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

  async function downloadPDFfromCanvas(posterCanvas, Wpx, Hpx, dpi, filename){
    const jsPDF = await loadJsPDF();

    // ✅ JPEG evita PDF en blanco por PNG/alpha/tamaño
    const jpgDataURL = posterCanvas.toDataURL("image/jpeg", 0.98);

    // esperar carga real
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("No se pudo cargar la imagen para PDF"));
      img.src = jpgDataURL;
    });

    const safeDpi = Number(dpi) || 300;

    // px -> pulgadas -> puntos (72pt = 1in)
    const wPt = (Wpx / safeDpi) * 72;
    const hPt = (Hpx / safeDpi) * 72;

    const doc = new jsPDF({
      orientation: wPt >= hPt ? "l" : "p",
      unit: "pt",
      format: [wPt, hPt],
      compress: true,
    });

    // full-bleed
    doc.addImage(img, "JPEG", 0, 0, wPt, hPt, undefined, "FAST");
    doc.save(filename);
  }

  async function exportPoster(format, sizeKey){
    const sz = EXPORT_SIZES.find(x => x.key === sizeKey) || EXPORT_SIZES[0];
    const dpi = state.export.dpi || 300;

    let W, H;
    if (sz.type === "px"){ W = sz.w; H = sz.h; }
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

    const edgeFrameX = Math.round(POSTER_FRAME_EDGE_GAP_PX * (W / POSTER_W));
    const edgeFrameY = Math.round(POSTER_FRAME_EDGE_GAP_PX * (H / POSTER_H));
    const edgeMarginX = Math.round(POSTER_MARGIN_EDGE_GAP_PX * (W / POSTER_W));
    const edgeMarginY = Math.round(POSTER_MARGIN_EDGE_GAP_PX * (H / POSTER_H));

    const framePx = frameOn ? clamp(state.map.posterFrameInsetPx, 0, 160) : 0;
    const frameX = Math.round(framePx * (W / POSTER_W));
    const frameY = Math.round(framePx * (H / POSTER_H));

    ctx.fillStyle = tokens.posterBg;
    ctx.fillRect(0, 0, W, H);

    if (frameOn){
      ctx.fillStyle = tokens.posterInk;
      ctx.fillRect(edgeFrameX, edgeFrameY, W - edgeFrameX*2, H - edgeFrameY*2);
    }

    const innerX = edgeFrameX + frameX;
    const innerY = edgeFrameY + frameY;

    ctx.fillStyle = tokens.posterBg;
    ctx.fillRect(innerX, innerY, W - innerX*2, H - innerY*2);

    if (marginOn){
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

    const mapW = Math.round(parseFloat(getComputedStyle($poster).getPropertyValue("--mapW")) * sx);
    const mapH = Math.round(parseFloat(getComputedStyle($poster).getPropertyValue("--mapH")) * sy);

    const mapX = Math.round((W - mapW) / 2);
    const mapY = Math.round(innerY + (70 * sy));
    ctx.drawImage($canvas, mapX, mapY, mapW, mapH);

    // ✅ Texto exportado: Moderno = alineado izquierda
    const family = state.text.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = tokens.posterInk;

    function fitCanvasFont(text, startPx, minPx, weight, maxWidth){
      let size = startPx;
      while (size > minPx){
        ctx.font = `${weight} ${Math.round(size)}px ${family}`;
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 1;
      }
      return Math.max(minPx, size);
    }

    function drawTextFit(text, x, y, startPx, minPx, weight, align, alpha, maxWidth){
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = align;
      ctx.textBaseline = "top";
      const size = fitCanvasFont(text, startPx, minPx, weight, maxWidth);
      ctx.font = `${weight} ${Math.round(size)}px ${family}`;
      ctx.fillText(text, Math.round(x), Math.round(y));
      ctx.restore();
    }

    const show = state.visible;
    const stNow = getStyleDef();
    const isModernStyle = (stNow.id === "moderno");

    const padX = Math.round(110 * sx);
    const maxWText = W - padX * 2;

    const textAlign = isModernStyle ? "left" : "center";
    const textX = isModernStyle ? padX : (W / 2);

    // ✅ Y dinámico: calcado al preview (corrige desfases por previewZoom / responsive)
const posterEl = document.getElementById("poster");
const pTitleEl = document.getElementById("pTitle");
const pSubEl   = document.getElementById("pSubtitle");
const pPlaceEl = document.getElementById("pPlace");
const pCoordsEl= document.getElementById("pCoords");
const pDTEl    = document.getElementById("pDatetime");

const pr = posterEl ? posterEl.getBoundingClientRect() : null;
const zoomY = pr ? (pr.height / POSTER_H) : 1;

function relTop(el){
  if (!pr || !el) return 0;
  const r = el.getBoundingClientRect();
  return (r.top - pr.top) / zoomY; // devuelve en coordenadas del póster base (900x1200)
}

const yTitle    = Math.round(relTop(pTitleEl) * sy);
const ySubtitle = Math.round(relTop(pSubEl)   * sy);
const yPlace    = Math.round(relTop(pPlaceEl) * sy);
const yCoords   = Math.round(relTop(pCoordsEl)* sy);
const yDT       = Math.round(relTop(pDTEl)    * sy);const title = String(state.text.title || "").slice(0, TITLE_MAX);
    const sub = String(state.text.subtitle || "").slice(0, SUB_MAX);

    if (show.title)    drawTextFit(title, textX, yTitle, 54 * sy, 22 * sy, 900, textAlign, 1, maxWText);
    if (show.subtitle) drawTextFit(sub,   textX, ySubtitle, 18 * sy, 12 * sy, 650, textAlign, 0.85, maxWText);

    if (show.place)    drawTextFit(state.text.place || "",  textX, yPlace, 14 * sy, 11 * sy, 650, textAlign, 0.82, maxWText);
    if (show.coords)   drawTextFit(state.text.coords || "", textX, yCoords, 14 * sy, 11 * sy, 650, textAlign, 0.82, maxWText);
    if (show.datetime) drawTextFit(getDateTimeString(),     textX, yDT,    14 * sy, 11 * sy, 650, textAlign, 0.82, maxWText);

    if (format === "png" || format === "jpg"){
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const quality = format === "jpg" ? 0.95 : undefined;
      const url = out.toDataURL(mime, quality);
      downloadDataURL(url, `poster_${sizeKey}.${format}`);
      return;
    }

    // ✅ PDF REAL (sin print) — descarga directa
    try {
      await downloadPDFfromCanvas(out, W, H, dpi || 300, `poster_${sizeKey}.pdf`);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el PDF. Revisa bloqueadores o intenta otro navegador.");
    }
  }

  function renderSectionExport(){
    $section.innerHTML = "";

    const t = document.createElement("div");
    t.className = "title";
    t.textContent = "Exportar";

    const s = document.createElement("div");
    s.className = "sub";
    s.textContent = "Selecciona formato y exporta tu póster.";

    const sizeRow = document.createElement("div");
    sizeRow.className = "formRow";
    sizeRow.innerHTML = `<div class="label">Medidas</div>`;

    const sizeSel = document.createElement("select");
    sizeSel.className = "select";
    EXPORT_SIZES.forEach(sz => {
      const opt = document.createElement("option");
      opt.value = sz.key;
      opt.textContent = `${sz.title} — ${sz.sub}`;
      sizeSel.appendChild(opt);
    });
    sizeSel.value = state.export.sizeKey;
    sizeSel.onchange = () => { state.export.sizeKey = sizeSel.value; };
    sizeRow.appendChild(sizeSel);

    const formatRow = document.createElement("div");
    formatRow.className = "formRow";
    formatRow.innerHTML = `<div class="label">Formato</div>`;

    const formatSel = document.createElement("select");
    formatSel.className = "select";
    [
      ["png","PNG · Mejor calidad"],
      ["jpg","JPG · Archivo más ligero"],
      ["pdf","PDF · Perfecto para imprimir"]
    ].forEach(([v,n]) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = n;
      formatSel.appendChild(opt);
    });
    formatSel.value = state.export.format;
    formatSel.onchange = () => { state.export.format = formatSel.value; };
    formatRow.appendChild(formatSel);

    const btns = document.createElement("div");
    btns.className = "btnRow";
    const left = document.createElement("div");
    const right = document.createElement("div");

    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "btn ghost";
    prev.textContent = "← Anterior";
    prev.onclick = () => { state.step = 1; renderAll(); };

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn primary";
    exportBtn.textContent = "Exportar";
    exportBtn.onclick = () => { exportPoster(state.export.format, state.export.sizeKey); };

    left.appendChild(prev);
    right.appendChild(exportBtn);
    btns.appendChild(left);
    btns.appendChild(right);

    $section.appendChild(t);
    $section.appendChild(s);
    $section.appendChild(sizeRow);
    $section.appendChild(formatRow);
    $section.appendChild(btns);
  }

  function renderSection(){
    if (state.step === 0) return renderSectionDesign();
    if (state.step === 1) return renderSectionContent();
    return renderSectionExport();
  }

  function renderAll(){
    if (isNeonThemeId(state.map.colorTheme)) state.map.backgroundMode = "match";

    if (isPoster()){
      state.map.posterFrameEnabled = false;
      state.map.posterMarginEnabled = false;
    }

    // clamp retícula
    state.map.gridOpacity = clamp(Number(state.map.gridOpacity ?? 0.60), 0.05, 0.60);

    renderTabs();
    renderSection();
    renderPosterFont();
    renderPosterAndMap();
  }

  // Init
  updateSeedFromDateTime();
  ensurePosterLayers();
  ensurePreviewWatermarkLayer();
  loadPrefsForStyle(state.map.styleId);

  applyPosterLayoutByStyle();
  applyPosterPaddingLayout();
  setMapSizeFromPosterPad();

  updatePreviewZoom();
  renderAll();

  window.addEventListener("resize", () => {
    updatePreviewZoom();
    drawMap();
    applyAutoTextSizing();
    applyPreviewWatermark(computeRenderTokens());
  });
})();
