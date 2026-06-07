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

  // ── Template HTML partagé ──────────────────────────────────
  function buildHtml(isClient) {
    const headerTitle = isClient
      ? "✅ Votre commande est confirmée"
      : "🔔 Nouvelle commande reçue";
    const badge = isClient
      ? "CONFIRMATION DE COMMANDE"
      : "COMMANDE EN ATTENTE DE TRAITEMENT";

    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0d1b2a;border-radius:16px;overflow:hidden;border:1px solid rgba(0,200,255,0.2);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#001540,#003080);padding:28px 32px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#00e5ff;letter-spacing:3px;">${companyName}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px;letter-spacing:2px;">SMARTPHONES & ACCESSOIRES · DAKAR</div>
      <div style="margin-top:16px;font-size:18px;color:#fff;font-weight:600;">${headerTitle}</div>
    </td>
  </tr>

  <!-- Badge -->
  <tr>
    <td style="padding:20px 32px 0;text-align:center;">
      <div style="display:inline-block;background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.4);border-radius:100px;padding:8px 24px;font-size:11px;color:#00e5ff;letter-spacing:2px;">${badge}</div>
    </td>
  </tr>

  <!-- Références -->
  <tr>
    <td style="padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,100,255,0.06);border:1px solid rgba(0,200,255,0.15);border-radius:12px;overflow:hidden;">
        <tr><td colspan="2" style="padding:12px 20px;border-bottom:1px solid rgba(0,200,255,0.1);font-size:11px;font-weight:700;color:#00e5ff;letter-spacing:2px;">RÉFÉRENCES DE TRANSACTION</td></tr>
        <tr>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.5);font-size:12px;width:45%;border-bottom:1px solid rgba(255,255,255,0.05);">🔖 N° Commande</td>
          <td style="padding:10px 20px;color:#00e5ff;font-size:12px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.05);font-family:monospace;">${refCmd}</td>
        </tr>
        <tr>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.5);font-size:12px;">🔐 Réf. PayDunya</td>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.7);font-size:11px;font-family:monospace;">${refToken}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Infos client -->
  <tr>
    <td style="padding:0 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,100,255,0.06);border:1px solid rgba(0,200,255,0.15);border-radius:12px;overflow:hidden;">
        <tr><td colspan="2" style="padding:12px 20px;border-bottom:1px solid rgba(0,200,255,0.1);font-size:11px;font-weight:700;color:#00e5ff;letter-spacing:2px;">INFORMATIONS CLIENT</td></tr>
        <tr>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.5);font-size:12px;width:45%;border-bottom:1px solid rgba(255,255,255,0.05);">👤 Nom</td>
          <td style="padding:10px 20px;color:#fff;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">${client_nom || "—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.5);font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05);">📞 Téléphone</td>
          <td style="padding:10px 20px;color:#00e5ff;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">${client_tel || "—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.5);font-size:12px;">📍 Adresse livraison</td>
          <td style="padding:10px 20px;color:#fff;font-size:13px;">${client_adr || "—"}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Détails commande -->
  <tr>
    <td style="padding:0 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,100,255,0.06);border:1px solid rgba(0,200,255,0.15);border-radius:12px;overflow:hidden;">
        <tr><td colspan="2" style="padding:12px 20px;border-bottom:1px solid rgba(0,200,255,0.1);font-size:11px;font-weight:700;color:#00e5ff;letter-spacing:2px;">DÉTAILS DE LA COMMANDE</td></tr>
        <tr>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.5);font-size:12px;width:45%;border-bottom:1px solid rgba(255,255,255,0.05);">🛒 Produit(s)</td>
          <td style="padding:10px 20px;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${articles || "—"}</td>
        </tr>
        <tr>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.5);font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05);">💳 Paiement</td>
          <td style="padding:10px 20px;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${operateur || "PayDunya"}</td>
        </tr>
        <tr>
          <td style="padding:10px 20px;color:rgba(255,255,255,0.5);font-size:12px;">🕐 Date</td>
          <td style="padding:10px 20px;color:#fff;font-size:13px;">${orderDate}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Total -->
  <tr>
    <td style="padding:0 32px 20px;">
      <div style="background:linear-gradient(135deg,rgba(0,33,255,0.2),rgba(0,200,255,0.1));border:1px solid rgba(0,200,255,0.3);border-radius:12px;padding:18px 24px;">
        <table width="100%"><tr>
          <td style="color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;">TOTAL PAYÉ</td>
          <td style="text-align:right;color:#00e5ff;font-size:24px;font-weight:700;">${total || "—"}</td>
        </tr></table>
      </div>
    </td>
  </tr>

  ${isClient ? `
  <!-- Message client -->
  <tr>
    <td style="padding:0 32px 20px;">
      <div style="background:rgba(0,255,100,0.05);border:1px solid rgba(0,255,100,0.2);border-radius:12px;padding:16px 20px;font-size:13px;color:rgba(255,255,255,0.8);line-height:1.7;">
        ✅ <strong style="color:#00ff88;">Votre commande a bien été reçue.</strong><br>
        Notre équipe vous contactera dans les <strong>24h</strong> pour confirmer la livraison.<br>
        📦 Livraison Dakar : <strong>Gratuite · 24-48h</strong><br>
        🛡️ Blindé + 👜 Pochette inclus gratuitement.
      </div>
    </td>
  </tr>` : ""}

  <!-- Infos entreprise -->
  <tr>
    <td style="padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
        <tr><td colspan="2" style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;">INFORMATIONS ENTREPRISE</td></tr>
        <tr>
          <td style="padding:8px 20px;color:rgba(255,255,255,0.4);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.04);">🏢 Société</td>
          <td style="padding:8px 20px;color:rgba(255,255,255,0.7);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.04);">${companyName} · RCCM: SN DKR 2026 A 16899</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;color:rgba(255,255,255,0.4);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.04);">📍 Adresse</td>
          <td style="padding:8px 20px;color:rgba(255,255,255,0.7);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.04);">${companyAddress}</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;color:rgba(255,255,255,0.4);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.04);">📞 Contact</td>
          <td style="padding:8px 20px;color:rgba(255,255,255,0.7);font-size:11px;border-bottom:1px solid rgba(255,255,255,0.04);">${companyPhone}</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;color:rgba(255,255,255,0.4);font-size:11px;">🌐 Site</td>
          <td style="padding:8px 20px;font-size:11px;"><a href="${companyWebsite}" style="color:#00e5ff;text-decoration:none;">${companyWebsite}</a></td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:16px 32px;border-top:1px solid rgba(0,200,255,0.1);text-align:center;">
      <div style="font-size:10px;color:rgba(255,255,255,0.25);">NINEA: 013038395 · Email automatique — ${companyName} · Ne pas répondre</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
  }

  const errors = [];

  // ── 1. Email marchand ───────────────────────────────────────
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: `${companyName} <contact@sdsprotech.com>`,
        to:   [companyEmail],
        subject: `🔔 Nouvelle commande #${refCmd} — ${client_nom || "Client"} — ${total || ""}`,
        html: buildHtml(false)
      })
    });
    if (!res.ok) {
      const d = await res.json();
      errors.push({ target: "marchand", error: d });
    }
  } catch(e) { errors.push({ target: "marchand", error: e.message }); }

  // ── 2. Email client (si email fourni) ───────────────────────
  if (client_email) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + env.RESEND_API_KEY
        },
        body: JSON.stringify({
          from: `${companyName} <contact@sdsprotech.com>`,
          to:   [client_email],
          subject: `✅ Confirmation de votre commande — ${companyName}`,
          html: buildHtml(true)
        })
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
    errors: errors.length > 0 ? errors : undefined
  }), { status: 200, headers: CORS });
}
