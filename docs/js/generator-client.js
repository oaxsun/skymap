// docs/js/generator-client.js
const API_URL = window.API_URL || "http://localhost:3001"; // cambia a tu Render cuando lo subas

const $ = (id) => document.getElementById(id);

function getPayload() {
  const date = String($("date").value || "").trim();
  const time = String($("time").value || "").trim();
  const iso = date && time ? new Date(`${date}T${time}:00`).toISOString() : new Date().toISOString();

  return {
    title: $("title").value.trim(),
    subtitle: $("subtitle").value.trim(),
    style: $("style").value,
    lat: Number($("lat").value),
    lon: Number($("lon").value),
    dateTimeISO: iso,
    overlay: $("overlay").value.trim(),
  };
}

function setStatus(msg) {
  $("status").textContent = msg || "";
}

const backdrop = $("modalBackdrop");

$("openSizes").addEventListener("click", () => {
  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");
});

$("closeModal").addEventListener("click", () => {
  backdrop.style.display = "none";
  backdrop.setAttribute("aria-hidden", "true");
});

backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) $("closeModal").click();
});

document.querySelectorAll(".sizeBtn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const size = btn.dataset.size; // S(A4) | M(A2) | L(A1) | XL(A0)
    $("closeModal").click();
    setStatus("Generando PDF…");

    try {
      const payload = getPayload();
      const r = await fetch(`${API_URL}/api/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, size }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo generar el PDF");
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);

      // Abre ventana nueva para descargar/visualizar
      window.open(url, "_blank", "noopener,noreferrer");

      // Nota: si quieres descarga directa, reemplaza por <a download>
      setStatus("Listo. Se abrió una pestaña con tu PDF.");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
      alert(e.message);
    }
  });
});
