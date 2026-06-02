import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(env);
  const CORS = CORS_HEADERS(env);

  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers: CORS });

  if (!env.RESEND_API_KEY)
    return new Response(JSON.stringify({ error: "RESEND_API_KEY manquante" }), { status: 500, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { client_nom, client_tel, client_adr, articles, total, operateur, date } = body;

  const to = env.COMPANY_EMAIL || "contact@sdsprotech.com";
  const companyName = env.COMPANY_NAME || "SDS PRO";

  // ── Email HTML ──────────────────────────────────────────────
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0d1b2a;border-radius:16px;overflow:hidden;border:1px solid rgba(0,200,255,0.2);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#001540,#003080);padding:28px 32px;text-align:center;">
            <div style="font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:#00e5ff;letter-spacing:3px;">${companyName}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;letter-spacing:1px;">NOUVELLE COMMANDE REÇUE</div>
          </td>
        </tr>

        <!-- Badge -->
        <tr>
          <td style="padding:24px 32px 0;text-align:center;">
            <div style="display:inline-block;background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.4);border-radius:100px;padding:8px 24px;font-size:13px;color:#00e5ff;letter-spacing:2px;">
              🔔 COMMANDE EN ATTENTE DE TRAITEMENT
            </div>
          </td>
        </tr>

        <!-- Infos client -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,100,255,0.06);border:1px solid rgba(0,200,255,0.15);border-radius:12px;overflow:hidden;">
              <tr><td colspan="2" style="padding:14px 20px;border-bottom:1px solid rgba(0,200,255,0.1);font-size:11px;font-weight:700;color:#00e5ff;letter-spacing:2px;">INFORMATIONS CLIENT</td></tr>
              <tr>
                <td style="padding:12px 20px;color:rgba(255,255,255,0.5);font-size:12px;width:40%;border-bottom:1px solid rgba(255,255,255,0.05);">👤 Nom</td>
                <td style="padding:12px 20px;color:#fff;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">${client_nom || "—"}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;color:rgba(255,255,255,0.5);font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05);">📞 Téléphone</td>
                <td style="padding:12px 20px;color:#00e5ff;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">${client_tel || "—"}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;color:rgba(255,255,255,0.5);font-size:12px;">📍 Adresse</td>
                <td style="padding:12px 20px;color:#fff;font-size:13px;">${client_adr || "—"}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Commande -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,100,255,0.06);border:1px solid rgba(0,200,255,0.15);border-radius:12px;overflow:hidden;">
              <tr><td colspan="2" style="padding:14px 20px;border-bottom:1px solid rgba(0,200,255,0.1);font-size:11px;font-weight:700;color:#00e5ff;letter-spacing:2px;">DÉTAILS DE LA COMMANDE</td></tr>
              <tr>
                <td style="padding:12px 20px;color:rgba(255,255,255,0.5);font-size:12px;width:40%;border-bottom:1px solid rgba(255,255,255,0.05);">🛒 Articles</td>
                <td style="padding:12px 20px;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${articles || "—"}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;color:rgba(255,255,255,0.5);font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05);">💳 Paiement</td>
                <td style="padding:12px 20px;color:#fff;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${operateur || "—"}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;color:rgba(255,255,255,0.5);font-size:12px;">🕐 Date</td>
                <td style="padding:12px 20px;color:#fff;font-size:13px;">${date || new Date().toLocaleString("fr-FR")}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Total -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:linear-gradient(135deg,rgba(0,33,255,0.2),rgba(0,200,255,0.1));border:1px solid rgba(0,200,255,0.3);border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
              <table width="100%"><tr>
                <td style="color:rgba(255,255,255,0.7);font-size:14px;font-weight:600;">TOTAL À ENCAISSER</td>
                <td style="text-align:right;color:#00e5ff;font-size:22px;font-weight:700;">${total || "—"}</td>
              </tr></table>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(0,200,255,0.1);text-align:center;">
            <div style="font-size:11px;color:rgba(255,255,255,0.3);">Email automatique — ${companyName} • Ne pas répondre à cet email</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Envoi via Resend ────────────────────────────────────────
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: `${companyName} <contact@sdsprotech.com>`,
        to: [to],
        subject: `🔔 Nouvelle commande — ${client_nom || "Client"} — ${total || ""}`,
        html
      })
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok)
      return new Response(JSON.stringify({ error: "Resend error", details: resendData }), { status: 500, headers: CORS });

    return new Response(JSON.stringify({ success: true, id: resendData.id }), { status: 200, headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Erreur réseau Resend", details: err.message }), { status: 500, headers: CORS });
  }
}
