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

  const { dossier_id, evenement } = body; // evenement: "validation" | "versement"
  if (!dossier_id)
    return new Response(JSON.stringify({ error: "dossier_id manquant" }), { status: 400, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  const FRAIS_MDM = 10000;

  // ── Récupérer le dossier ────────────────────────────────────
  let d = null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}` +
      `&select=dossier_id,client_nom,client_tel,client_email,user_id,appareil,statut_compte,` +
      `montant_1,montant_2,montant_3,paye_1,paye_2,paye_3,echeance_1,echeance_2,echeance_3`,
      { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    );
    const rows = await res.json();
    if (rows && rows[0]) d = rows[0];
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur Supabase", details: e.message }), { status: 500, headers: CORS });
  }
  if (!d)
    return new Response(JSON.stringify({ error: "Dossier introuvable" }), { status: 404, headers: CORS });

  // ── Email du client : champ dossier en priorité, sinon email du compte auth ──
  let destEmail = d.client_email || null;
  if (!destEmail && d.user_id) {
    try {
      const u = await fetch(`${SUPA_URL}/auth/v1/admin/users/${d.user_id}`, {
        headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY }
      });
      if (u.ok) {
        const ud = await u.json();
        destEmail = ud && ud.email ? ud.email : null;
      }
    } catch (e) {}
  }
  if (!destEmail)
    return new Response(JSON.stringify({ success: false, error: "Aucun email client disponible" }), { status: 200, headers: CORS });

  const companyName    = env.COMPANY_NAME    || "SDS PRO TECH";
  const companyPhone   = env.COMPANY_PHONE   || "+221 77 069 97 39";
  const companyWebsite = env.COMPANY_WEBSITE || "https://sdsprotech.com";
  const companyAddress = "Pikine, Dakar, Sénégal";
  const LIEN_ESPACE    = companyWebsite + "/mon-credit.html";

  const fmt = n => (n || 0).toLocaleString("fr-FR");
  const dateFr = s => s ? new Date(s).toLocaleDateString("fr-FR") : "—";

  const versements = [
    { n:1, label:"Acompte (50% + frais MDM)", montant:(d.montant_1||0)+FRAIS_MDM, paye:d.paye_1, ech:d.echeance_1 },
    { n:2, label:"Versement 2 (25%)",         montant:d.montant_2||0,             paye:d.paye_2, ech:d.echeance_2 },
    { n:3, label:"Versement 3 (25%)",         montant:d.montant_3||0,             paye:d.paye_3, ech:d.echeance_3 }
  ];

  const totalDu   = versements.reduce((s,v)=>s+v.montant,0);
  const totalPaye = versements.filter(v=>v.paye).reduce((s,v)=>s+v.montant,0);
  const pct       = totalDu ? Math.round(totalPaye/totalDu*100) : 0;

  // ── Configuration selon le type d'événement ─────────────────
  // evenement : validation | versement | verrouille | deverrouille | rappel_7j | rappel_2j
  const EVENTS = {
    validation:   { titre: "🎉 Votre crédit est validé",   badge: "ÉCHÉANCIER DE CRÉDIT",
      intro: `Votre dossier de crédit pour <strong>${d.appareil || "votre téléphone"}</strong> a été validé. Voici votre échéancier de paiement.` },
    versement:    { titre: "💰 Versement bien reçu",        badge: "ÉCHÉANCIER DE CRÉDIT",
      intro: `Nous confirmons la bonne réception de votre versement. Voici l'état actuel de votre crédit.` },
    verrouille:   { titre: "🔒 Téléphone verrouillé",        badge: "VERSEMENT EN ATTENTE",
      intro: `Votre téléphone a été <strong>verrouillé</strong> en raison d'un versement en retard. Réglez votre échéance pour le débloquer immédiatement.` },
    deverrouille: { titre: "🔓 Téléphone débloqué",          badge: "PAIEMENT CONFIRMÉ",
      intro: `Bonne nouvelle ! Votre téléphone a été <strong>déverrouillé</strong> suite à votre paiement. Merci de votre confiance.` },
    rappel_7j:    { titre: "📅 Échéance dans 7 jours",        badge: "RAPPEL DE PAIEMENT",
      intro: `Petit rappel amical : un versement arrive à échéance dans <strong>7 jours</strong>. Pensez à le régler pour éviter tout verrouillage.` },
    rappel_2j:    { titre: "⏰ Échéance dans 2 jours",        badge: "RAPPEL URGENT",
      intro: `Attention : un versement arrive à échéance dans <strong>2 jours</strong>. Réglez-le dès maintenant pour éviter le verrouillage de votre téléphone.` }
  };
  const cfg = EVENTS[evenement] || EVENTS.versement;
  const estValidation = evenement === "validation";
  const headerTitle = cfg.titre;

  // ── Lignes des versements ───────────────────────────────────
  const sectionTitle = "padding:12px 20px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;color:#0066cc;letter-spacing:2px;background:#f1f6fc;";
  const boxStyle     = "background:#ffffff;border:1px solid #dbe4ee;border-radius:12px;overflow:hidden;";

  const lignesVers = versements.map(v => {
    const statut = v.paye
      ? `<span style="color:#15803d;font-weight:700;">✅ Payé</span>`
      : `<span style="color:#0066cc;font-weight:700;">À régler · ${dateFr(v.ech)}</span>`;
    const bouton = v.paye
      ? ""
      : `<a href="${LIEN_ESPACE}" style="display:inline-block;margin-top:8px;background:#0066cc;color:#ffffff;font-size:12px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none;">💳 Régler ce versement</a>`;
    return `
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #eef2f7;">
          <div style="color:#0f172a;font-size:13px;font-weight:700;">${v.label}</div>
          <div style="color:#0066cc;font-size:16px;font-weight:800;margin:4px 0;">${fmt(v.montant)} FCFA</div>
          <div style="font-size:12px;">${statut}</div>
          ${bouton}
        </td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
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
      <div style="font-size:11px;color:#cfe2ff;margin-top:4px;letter-spacing:2px;">ACHAT ÉCHELONNÉ HALAL · DAKAR</div>
      <div style="margin-top:16px;font-size:18px;color:#ffffff;font-weight:600;">${headerTitle}</div>
    </td>
  </tr>

  <!-- Badge -->
  <tr>
    <td style="padding:20px 32px 0;text-align:center;">
      <div style="display:inline-block;background:#e7f1ff;border:1px solid #9ec5fe;border-radius:100px;padding:8px 24px;font-size:11px;color:#0066cc;letter-spacing:2px;font-weight:700;">${cfg.badge}</div>
    </td>
  </tr>

  <!-- Salutation -->
  <tr>
    <td style="padding:20px 32px 0;">
      <div style="font-size:14px;color:#0f172a;line-height:1.7;">
        Bonjour <strong>${d.client_nom || "cher client"}</strong>,<br>
        ${cfg.intro}
      </div>
    </td>
  </tr>

  <!-- Récap -->
  <tr>
    <td style="padding:18px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="${boxStyle}">
        <tr><td style="${sectionTitle}">RÉFÉRENCE DOSSIER</td></tr>
        <tr><td style="padding:10px 20px;color:#0066cc;font-size:12px;font-weight:700;font-family:monospace;">${d.dossier_id}</td></tr>
        <tr><td style="padding:0 20px 12px;color:#475569;font-size:13px;">📱 ${d.appareil || "—"}</td></tr>
      </table>
    </td>
  </tr>

  <!-- Progression -->
  <tr>
    <td style="padding:0 32px 18px;">
      <div style="background:#e7f1ff;border:1px solid #9ec5fe;border-radius:12px;padding:16px 20px;">
        <table width="100%"><tr>
          <td style="color:#334155;font-size:13px;font-weight:700;">PROGRESSION</td>
          <td style="text-align:right;color:#0066cc;font-size:20px;font-weight:800;">${pct}%</td>
        </tr></table>
        <div style="margin-top:8px;color:#475569;font-size:12px;">${fmt(totalPaye)} / ${fmt(totalDu)} FCFA réglés</div>
      </div>
    </td>
  </tr>

  <!-- Versements -->
  <tr>
    <td style="padding:0 32px 18px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="${boxStyle}">
        <tr><td style="${sectionTitle}">VOS VERSEMENTS</td></tr>
        ${lignesVers}
      </table>
    </td>
  </tr>

  <!-- CTA principal -->
  <tr>
    <td style="padding:0 32px 22px;text-align:center;">
      <a href="${LIEN_ESPACE}" style="display:inline-block;background:linear-gradient(135deg,#002a6e,#0066cc);color:#ffffff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;">🔐 Accéder à mon espace crédit</a>
      <div style="margin-top:10px;font-size:11px;color:#94a3b8;">Connectez-vous avec votre compte pour régler vos versements en toute sécurité.</div>
    </td>
  </tr>

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

  const SUJETS = {
    validation:   `🎉 Votre crédit est validé — ${companyName}`,
    versement:    `💰 Versement reçu (${pct}% payé) — ${companyName}`,
    verrouille:   `🔒 Téléphone verrouillé — versement en attente — ${companyName}`,
    deverrouille: `🔓 Téléphone débloqué — ${companyName}`,
    rappel_7j:    `📅 Rappel : échéance dans 7 jours — ${companyName}`,
    rappel_2j:    `⏰ Urgent : échéance dans 2 jours — ${companyName}`
  };
  const sujet = SUJETS[evenement] || SUJETS.versement;

  // ── Générer le PDF de la facture via PDFShift (si clé dispo) ──
  let pdfBase64 = null;
  if (env.PDFSHIFT_API_KEY) {
    try {
      const pdfRes = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + btoa("api:" + env.PDFSHIFT_API_KEY)
        },
        body: JSON.stringify({ source: html, landscape: false, use_print: false })
      });
      if (pdfRes.ok) {
        const buf = await pdfRes.arrayBuffer();
        // Convertir ArrayBuffer → base64
        let binary = "";
        const bytes = new Uint8Array(buf);
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        pdfBase64 = btoa(binary);
      }
    } catch (e) { /* PDF optionnel : on continue sans */ }
  }

  const nomFichier = `Echeancier-${d.dossier_id}.pdf`;
  const emailPayload = {
    from: `${companyName} <contact@sdsprotech.com>`,
    to:   [destEmail],
    subject: sujet,
    html
  };
  if (pdfBase64) {
    emailPayload.attachments = [{ filename: nomFichier, content: pdfBase64 }];
  }

  let sent = false, errorDetail = null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + env.RESEND_API_KEY
      },
      body: JSON.stringify(emailPayload)
    });
    sent = res.ok;
    if (!res.ok) errorDetail = await res.json();
  } catch (e) {
    errorDetail = e.message;
  }

  return new Response(JSON.stringify({
    success: sent,
    email: destEmail,
    pdf_attached: !!pdfBase64,
    error: errorDetail || undefined
  }), { status: 200, headers: CORS });
}
