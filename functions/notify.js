import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  if (!env.RESEND_API_KEY)
    return new Response(JSON.stringify({ error: "RESEND_API_KEY manquante" }), { status: 500, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const {
    client_nom, client_tel, client_email, client_adr,
    articles, total, operateur, date,
    commande_id, paydunya_token
  } = body;

  const companyName    = env.COMPANY_NAME    || "SDS PRO TECH";
  const companyEmail   = env.COMPANY_EMAIL   || "contact@sdsprotech.com";
  const companyPhone   = env.COMPANY_PHONE   || "+221 77 069 97 39";
  const companyWebsite = env.COMPANY_WEBSITE || "https://sdsprotech.com";
  const companyAddress = "Pikine, Dakar, Sénégal";
  const orderDate      = date || new Date().toLocaleString("fr-FR");
  const refCmd         = commande_id || "—";
  const refToken       = paydunya_token || "—";

  // ── Template HTML partagé (thème CLAIR — lisible partout) ───
  function buildHtml(isClient) {
    const headerTitle = isClient
      ? "✅ Votre commande est confirmée"
      : "🔔 Nouvelle commande reçue";
    const badge = isClient
      ? "CONFIRMATION DE COMMANDE"
      : "COMMANDE EN ATTENTE DE TRAITEMENT";

    const sectionTitle = "padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;color:#0066cc;letter-spacing:2px;background:#f1f6fc;";
    const cellLabel    = "padding:10px 20px;color:#64748b;font-size:12px;width:45%;border-bottom:1px solid #eef2f7;";
    const cellLabelEnd = "padding:10px 20px;color:#64748b;font-size:12px;width:45%;";
    const cellValue    = "padding:10px 20px;color:#0f172a;font-size:13px;font-weight:600;border-bottom:1px solid #eef2f7;";
    const cellValueEnd = "padding:10px 20px;color:#0f172a;font-size:13px;font-weight:600;";
    const boxStyle     = "background:#ffffff;border:1px solid #dbe4ee;border-radius:12px;overflow:hidden;";

    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe4ee;">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#002a6e,#0066cc);padding:28px 32px;text-align:center;">
      <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:3px;">${companyName}</div>
      <div style="font-size:11px;color:#cfe2ff;margin-top:4px;letter-spacing:2px;">SMARTPHONES &amp; ACCESSOIRES · DAKAR</div>
      <div style="margin-top:16px;font-size:18px;color:#ffffff;font-weight:600;">${headerTitle}</div>
    </td>
  </tr>

  <!-- Badge -->
  <tr>
    <td style="padding:20px 32px 0;text-align:center;">
      <div style="display:inline-block;background:#e7f1ff;border:1px solid #9ec5fe;border-radius:100px;padding:8px 24px;font-size:11px;color:#0066cc;letter-spacing:2px;font-weight:700;">${badge}</div>
    </td>
  </tr>

  <!-- Références -->
  <tr>
    <td style="padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="${boxStyle}">
        <tr><td colspan="2" style="${sectionTitle}">RÉFÉRENCES DE TRANSACTION</td></tr>
        <tr>
          <td style="${cellLabel}">🔖 N° Commande</td>
          <td style="padding:10px 20px;color:#0066cc;font-size:12px;font-weight:700;border-bottom:1px solid #eef2f7;font-family:monospace;">${refCmd}</td>
        </tr>
        <tr>
          <td style="${cellLabelEnd}">🔐 Réf. PayDunya</td>
          <td style="padding:10px 20px;color:#334155;font-size:11px;font-family:monospace;">${refToken}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Infos client -->
  <tr>
    <td style="padding:0 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="${boxStyle}">
        <tr><td colspan="2" style="${sectionTitle}">INFORMATIONS CLIENT</td></tr>
        <tr>
          <td style="${cellLabel}">👤 Nom</td>
          <td style="${cellValue}">${client_nom || "—"}</td>
        </tr>
        <tr>
          <td style="${cellLabel}">📞 Téléphone</td>
          <td style="padding:10px 20px;color:#0066cc;font-size:13px;font-weight:600;border-bottom:1px solid #eef2f7;">${client_tel || "—"}</td>
        </tr>
        <tr>
          <td style="${cellLabelEnd}">📍 Adresse livraison</td>
          <td style="${cellValueEnd}">${client_adr || "—"}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Détails commande -->
  <tr>
    <td style="padding:0 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="${boxStyle}">
        <tr><td colspan="2" style="${sectionTitle}">DÉTAILS DE LA COMMANDE</td></tr>
        <tr>
          <td style="${cellLabel}">🛒 Produit(s)</td>
          <td style="${cellValue}">${articles || "—"}</td>
        </tr>
        <tr>
          <td style="${cellLabel}">💳 Paiement</td>
          <td style="${cellValue}">${operateur || "PayDunya"}</td>
        </tr>
        <tr>
          <td style="${cellLabelEnd}">🕐 Date</td>
          <td style="${cellValueEnd}">${orderDate}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Total -->
  <tr>
    <td style="padding:0 32px 20px;">
      <div style="background:#e7f1ff;border:1px solid #9ec5fe;border-radius:12px;padding:18px 24px;">
        <table width="100%"><tr>
          <td style="color:#334155;font-size:14px;font-weight:700;">TOTAL PAYÉ</td>
          <td style="text-align:right;color:#0066cc;font-size:24px;font-weight:800;">${total || "—"}</td>
        </tr></table>
      </div>
    </td>
  </tr>

  ${isClient ? `
  <!-- Message client -->
  <tr>
    <td style="padding:0 32px 20px;">
      <div style="background:#e9fbef;border:1px solid #86e3a8;border-radius:12px;padding:16px 20px;font-size:13px;color:#14532d;line-height:1.7;">
        ✅ <strong style="color:#15803d;">Votre commande a bien été reçue.</strong><br>
        Notre équipe vous contactera dans les <strong>24h</strong> pour confirmer la livraison.<br>
        📦 Livraison Dakar : <strong>Gratuite · 24-48h</strong><br>
        🛡️ Blindé + 👜 Pochette inclus gratuitement.
      </div>
    </td>
  </tr>` : ""}

  <!-- Infos entreprise -->
  <tr>
    <td style="padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td colspan="2" style="padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;color:#64748b;letter-spacing:2px;">INFORMATIONS ENTREPRISE</td></tr>
        <tr>
          <td style="padding:8px 20px;color:#94a3b8;font-size:11px;border-bottom:1px solid #eef2f7;width:30%;">🏢 Société</td>
          <td style="padding:8px 20px;color:#475569;font-size:11px;border-bottom:1px solid #eef2f7;">${companyName} · RCCM: SN DKR 2026 A 16899</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;color:#94a3b8;font-size:11px;border-bottom:1px solid #eef2f7;">📍 Adresse</td>
          <td style="padding:8px 20px;color:#475569;font-size:11px;border-bottom:1px solid #eef2f7;">${companyAddress}</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;color:#94a3b8;font-size:11px;border-bottom:1px solid #eef2f7;">📞 Contact</td>
          <td style="padding:8px 20px;color:#475569;font-size:11px;border-bottom:1px solid #eef2f7;">${companyPhone}</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;color:#94a3b8;font-size:11px;">🌐 Site</td>
          <td style="padding:8px 20px;font-size:11px;"><a href="${companyWebsite}" style="color:#0066cc;text-decoration:none;">${companyWebsite}</a></td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;background:#f8fafc;">
      <div style="font-size:10px;color:#94a3b8;">NINEA: 013038395 · Email automatique — ${companyName} · Ne pas répondre</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
  }

  // ── Générer le PDF de la facture via PDFShift (HTML client) ──
  async function genererPdf(htmlContent) {
    if (!env.PDFSHIFT_API_KEY) return null;
    try {
      const pdfRes = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + btoa("api:" + env.PDFSHIFT_API_KEY)
        },
        body: JSON.stringify({ source: htmlContent, landscape: false, use_print: false })
      });
      if (!pdfRes.ok) return null;
      const buf = await pdfRes.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    } catch (e) { return null; }
  }

  // Le PDF reprend la version "client" (confirmation), facture propre
  const pdfBase64 = await genererPdf(buildHtml(true));
  const nomFichier = `Facture-${refCmd}.pdf`;

  const errors = [];

  // ── 1. Email marchand ───────────────────────────────────────
  try {
    const payloadMarchand = {
      from: `${companyName} <contact@sdsprotech.com>`,
      to:   [companyEmail],
      subject: `🔔 Nouvelle commande #${refCmd} — ${client_nom || "Client"} — ${total || ""}`,
      html: buildHtml(false)
    };
    if (pdfBase64) payloadMarchand.attachments = [{ filename: nomFichier, content: pdfBase64 }];
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.RESEND_API_KEY },
      body: JSON.stringify(payloadMarchand)
    });
    if (!res.ok) {
      const d = await res.json();
      errors.push({ target: "marchand", error: d });
    }
  } catch(e) { errors.push({ target: "marchand", error: e.message }); }

  // ── 2. Email client (si email fourni) ───────────────────────
  if (client_email) {
    try {
      const payloadClient = {
        from: `${companyName} <contact@sdsprotech.com>`,
        to:   [client_email],
        subject: `✅ Confirmation de votre commande — ${companyName}`,
        html: buildHtml(true)
      };
      if (pdfBase64) payloadClient.attachments = [{ filename: nomFichier, content: pdfBase64 }];
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.RESEND_API_KEY },
        body: JSON.stringify(payloadClient)
      });
      if (!res.ok) {
        const d = await res.json();
        errors.push({ target: "client", error: d });
      }
    } catch(e) { errors.push({ target: "client", error: e.message }); }
  }

  return new Response(JSON.stringify({
    success: errors.length === 0,
    client_email_sent: !!client_email,
    pdf_attached: !!pdfBase64,
    errors: errors.length > 0 ? errors : undefined
  }), { status: 200, headers: CORS });
}
