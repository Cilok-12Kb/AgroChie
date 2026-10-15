import { Router } from "express";
import { randomBytes } from "node:crypto";

// Halaman uji development untuk login Google. HANYA aktif bila nodeEnv bukan "production";
// di production rute ini meneruskan ke notFound (404). Pengaturan CORS/cookie global tidak diubah.

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** HTML halaman uji. clientId bukan rahasia; tetap di-escape karena masuk ke atribut HTML. */
export function renderGoogleLoginPage({ clientId, nonce }) {
  const id = escapeHtml(clientId ?? "");
  const body = id
    ? `<div id="g_id_onload" data-client_id="${id}" data-callback="onGoogleCredential" data-auto_prompt="false"></div>
  <div class="g_id_signin" data-type="standard" data-size="large" data-text="signin_with"></div>`
    : `<p><strong>GOOGLE_CLIENT_ID belum diisi di backend/.env.</strong> Isi lalu mulai ulang server.</p>`;
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Uji login Google (development)</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <h1>Uji login Google (khusus development)</h1>
  ${body}
  <h2>Hasil</h2>
  <pre id="out">Belum masuk.</pre>
  <script nonce="${nonce}">
    const out = document.getElementById("out");
    const show = (label, status, data) => {
      out.textContent += "\\n\\n" + label + " -> HTTP " + status + "\\n" + JSON.stringify(data, null, 2);
    };
    async function onGoogleCredential(response) {
      out.textContent = "Mengirim ke POST /api/auth/google ...";
      try {
        const r = await fetch("/api/auth/google", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken: response.credential }),
        });
        show("POST /api/auth/google", r.status, await r.json().catch(() => null));
        const me = await fetch("/api/auth/me", { credentials: "same-origin" });
        show("GET /api/auth/me", me.status, await me.json().catch(() => null));
      } catch (e) {
        out.textContent += "\\nGalat jaringan: " + e.message;
      }
    }
    window.onGoogleCredential = onGoogleCredential;
  </script>
</body>
</html>`;
}

/** cfg: { nodeEnv, googleClientId }. Pabrik agar mudah diuji tanpa .env. */
export function createDevRoutes(cfg) {
  const router = Router();
  router.get("/google-login", (_req, res, next) => {
    if (cfg.nodeEnv === "production") return next(); // jatuh ke notFound -> 404
    const nonce = randomBytes(16).toString("base64");
    // CSP helmet bawaan memblokir skrip Google; longgarkan HANYA untuk halaman ini, dengan nonce.
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' https://accounts.google.com/gsi/client`,
        "frame-src https://accounts.google.com/gsi/",
        "connect-src 'self' https://accounts.google.com/gsi/",
        "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
        "img-src 'self' data: https://*.googleusercontent.com",
      ].join("; "),
    );
    // Popup Google butuh COOP yang mengizinkan popup (bawaan helmet: same-origin). Hanya untuk halaman ini.
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.type("html").send(renderGoogleLoginPage({ clientId: cfg.googleClientId, nonce }));
  });
  return router;
}
