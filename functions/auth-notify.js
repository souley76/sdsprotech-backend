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

  const { evenement, access_token, device_hash, user_agent } = body;
  if (!evenement || !access_token)
    return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: CORS });

  const SUPA_URL  = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY  = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const SUPA_ANON = (env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  // ── Identifier le client via son token ──────────────────────
  let user = null;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_ANON || SUPA_KEY, "Authorization": "Bearer " + access_token }
    });
    if (!r.ok)
      return new Response(JSON.stringify({ error: "Token invalide" }), { status: 401, headers: CORS });
    user = await r.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification token" }), { status: 500, headers: CORS });
  }
  const userId = user && user.id;
  const email  = user && user.email;
  const nom    = (user && user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || "";
  if (!userId || !email)
    return new Response(JSON.stringify({ error: "Utilisateur introuvable" }), { status: 404, headers: CORS });

  // ── Lieu via les en-têtes Cloudflare ────────────────────────
  const ville = request.headers.get("cf-ipcity") || "";
  const pays  = request.headers.get("cf-ipcountry") || "";
  const ip    = request.headers.get("cf-connecting-ip") || "";
  const lieu  = [ville, pays].filter(Boolean).join(", ") || "Localisation inconnue";

  // ── Heure (Dakar / GMT) ─────────────────────────────────────
  const maintenant = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Dakar", dateStyle: "full", timeStyle: "short" });

  // ── Décoder l'OS et le navigateur depuis le user-agent ──────
  const ua = user_agent || request.headers.get("user-agent") || "";
  const osDe = (s) => {
    if (/iphone|ipad|ipod/i.test(s)) return "iOS (iPhone/iPad)";
    if (/android/i.test(s)) return "Android";
    if (/windows/i.test(s)) return "Windows";
    if (/mac os|macintosh/i.test(s)) return "macOS";
    if (/linux/i.test(s)) return "Linux";
    return "Système inconnu";
  };
  const navDe = (s) => {
    if (/edg\//i.test(s)) return "Microsoft Edge";
    if (/chrome|crios/i.test(s) && !/edg\//i.test(s)) return "Google Chrome";
    if (/firefox|fxios/i.test(s)) return "Mozilla Firefox";
    if (/safari/i.test(s) && !/chrome|crios/i.test(s)) return "Safari";
    if (/opr\/|opera/i.test(s)) return "Opera";
    return "Navigateur inconnu";
  };
  const os  = osDe(ua);
  const nav = navDe(ua);

  const companyName    = env.COMPANY_NAME    || "SDS PRO TECH";
  const companyPhone   = env.COMPANY_PHONE   || "+221 77 069 97 39";
  const companyWebsite = env.COMPANY_WEBSITE || "https://sdsprotech.com";

  // ════════════════════════════════════════════════════════════
  // ── ALERTE NOUVELLE CONNEXION (seulement si nouvel appareil) ─
  // ════════════════════════════════════════════════════════════
  if (evenement === "connexion") {
    if (!device_hash)
      return new Response(JSON.stringify({ ok: true, skipped: "no device_hash" }), { status: 200, headers: CORS });

    // Ignorer si le compte vient d'être créé (< 3 min) → c'est l'email de bienvenue qui gère
    try {
      const cree = user.created_at ? new Date(user.created_at).getTime() : 0;
      if (cree && (Date.now() - cree) < 180000) {
        return new Response(JSON.stringify({ ok: true, skipped: "compte récent" }), { status: 200, headers: CORS });
      }
    } catch (e) {}

    // L'appareil est-il déjà connu ?
    let connu = false;
    try {
      const r = await fetch(
        `${SUPA_URL}/rest/v1/appareils_connus?user_id=eq.${userId}&device_hash=eq.${encodeURIComponent(device_hash)}&select=id`,
        { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
      );
      const rows = await r.json();
      connu = Array.isArray(rows) && rows.length > 0;
    } catch (e) {}

    if (connu) {
      // Mettre à jour la dernière vue, pas d'email
      try {
        await fetch(`${SUPA_URL}/rest/v1/appareils_connus?user_id=eq.${userId}&device_hash=eq.${encodeURIComponent(device_hash)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY, "Prefer": "return=minimal" },
          body: JSON.stringify({ derniere_vue: new Date().toISOString() })
        });
      } catch (e) {}
      return new Response(JSON.stringify({ ok: true, nouveau: false }), { status: 200, headers: CORS });
    }

    // Nouvel appareil → enregistrer + envoyer l'alerte
    try {
      await fetch(`${SUPA_URL}/rest/v1/appareils_connus`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify({ user_id: userId, device_hash, user_agent: ua, lieu })
      });
    } catch (e) {}

    const htmlAlerte = buildEmail({
      companyName, companyWebsite, companyPhone,
      titre: "🔔 Nouvelle connexion détectée",
      badge: "ALERTE DE SÉCURITÉ",
      intro: `Bonjour${nom ? " " + nom : ""},<br>Une connexion à votre compte ${companyName} vient d'être effectuée depuis un <strong>nouvel appareil</strong>. Si c'était bien vous, aucune action n'est nécessaire.`,
      details: [
        ["📍 Lieu", lieu],
        ["🕐 Date et heure", maintenant],
        ["💻 Système", os],
        ["🌐 Navigateur", nav]
      ],
      alerte: `Si vous n'êtes pas à l'origine de cette connexion, changez immédiatement votre mot de passe et contactez-nous au ${companyPhone}.`
    });

    await envoyer(env, email, `🔔 Nouvelle connexion à votre compte — ${companyName}`, htmlAlerte);
    return new Response(JSON.stringify({ ok: true, nouveau: true, lieu, os, nav }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── EMAIL DE BIENVENUE (à l'inscription) ────────────────────
  // ════════════════════════════════════════════════════════════
  if (evenement === "bienvenue") {
    // Enregistrer aussi cet appareil comme connu (évite une alerte juste après)
    if (device_hash) {
      try {
        await fetch(`${SUPA_URL}/rest/v1/appareils_connus`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY, "Prefer": "return=minimal" },
          body: JSON.stringify({ user_id: userId, device_hash, user_agent: ua, lieu })
        });
      } catch (e) {}
    }

    const htmlBienvenue = buildEmail({
      companyName, companyWebsite, companyPhone,
      titre: "🎉 Bienvenue chez " + companyName,
      badge: "VOTRE COMPTE EST CRÉÉ",
      intro: `Bonjour${nom ? " " + nom : ""},<br>Merci de votre inscription chez <strong>${companyName}</strong> ! Votre compte est désormais actif. Vous pouvez commander vos smartphones, suivre vos achats échelonnés et accéder à nos services en toute simplicité.`,
      details: [
        ["🛍️ Boutique", "Smartphones & accessoires"],
        ["💳 Achat échelonné", "Payez en plusieurs fois"],
        ["🔒 Sécurité", "Vos données sont protégées"]
      ],
      alerte: null
    });

    await envoyer(env, email, `🎉 Bienvenue chez ${companyName} !`, htmlBienvenue);
    return new Response(JSON.stringify({ ok: true, bienvenue: true }), { status: 200, headers: CORS });
  }

  return new Response(JSON.stringify({ error: "Événement inconnu" }), { status: 400, headers: CORS });
}

// ── Envoi via Resend ──────────────────────────────────────────
async function envoyer(env, to, subject, html) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.RESEND_API_KEY },
      body: JSON.stringify({
        from: `${env.COMPANY_NAME || "SDS PRO TECH"} <contact@sdsprotech.com>`,
        to: [to], subject, html
      })
    });
  } catch (e) {}
}

// ── Template email (charte SDS, thème clair) ──────────────────
function buildEmail({ companyName, companyWebsite, companyPhone, titre, badge, intro, details, alerte }) {
  const lignes = details.map(([k, v]) => `
    <tr>
      <td style="padding:10px 20px;color:#64748b;font-size:12px;width:42%;border-bottom:1px solid #eef2f7;">${k}</td>
      <td style="padding:10px 20px;color:#0f172a;font-size:13px;font-weight:600;border-bottom:1px solid #eef2f7;">${v}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:30px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe4ee;">
  <tr><td style="background:linear-gradient(135deg,#002a6e,#0066cc);padding:28px 32px;text-align:center;">
    <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:3px;">${companyName}</div>
    <div style="font-size:11px;color:#cfe2ff;margin-top:4px;letter-spacing:2px;">SMARTPHONES &amp; ACCESSOIRES · DAKAR</div>
    <div style="margin-top:16px;font-size:18px;color:#ffffff;font-weight:600;">${titre}</div>
  </td></tr>
  <tr><td style="padding:20px 32px 0;text-align:center;">
    <div style="display:inline-block;background:#e7f1ff;border:1px solid #9ec5fe;border-radius:100px;padding:8px 24px;font-size:11px;color:#0066cc;letter-spacing:2px;font-weight:700;">${badge}</div>
  </td></tr>
  <tr><td style="padding:20px 32px 0;"><div style="font-size:14px;color:#0f172a;line-height:1.7;">${intro}</div></td></tr>
  <tr><td style="padding:18px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dbe4ee;border-radius:12px;overflow:hidden;">${lignes}</table>
  </td></tr>
  ${alerte ? `<tr><td style="padding:0 32px 20px;">
    <div style="background:#fff4f4;border:1px solid #f5b5b5;border-radius:12px;padding:16px 20px;font-size:13px;color:#9b1c1c;line-height:1.7;">⚠️ ${alerte}</div>
  </td></tr>` : ""}
  <tr><td style="padding:0 32px 24px;text-align:center;">
    <a href="${companyWebsite}" style="display:inline-block;background:linear-gradient(135deg,#002a6e,#0066cc);color:#ffffff;font-size:14px;font-weight:700;padding:13px 30px;border-radius:12px;text-decoration:none;">Accéder à mon compte</a>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;background:#f8fafc;">
    <div style="font-size:10px;color:#94a3b8;">${companyName} · ${companyPhone} · Email automatique — Ne pas répondre</div>
  </td></tr>
</table></td></tr></table></body></html>`;
}
