import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  // ── 1. Lecture du body ──────────────────────────────────────
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { action, dossier_id, access_token } = body;

  if (!action)
    return new Response(JSON.stringify({ error: "Action manquante" }), { status: 400, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const SUPA_ANON = (env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  const H_READ  = { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };
  const H_WRITE = { ...H_READ, "Content-Type": "application/json", "Prefer": "return=minimal" };

  // ── SÉCURITÉ : vérifier le token de session de l'admin ──────
  // 1) Le token doit être un token de session Supabase valide
  // 2) Le user correspondant doit avoir role='admin' dans profiles
  if (!access_token)
    return new Response(JSON.stringify({ error: "Non autorisé (token manquant)" }), { status: 401, headers: CORS });

  let adminUserId = null;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_ANON || SUPA_KEY, "Authorization": "Bearer " + access_token }
    });
    if (!userRes.ok)
      return new Response(JSON.stringify({ error: "Non autorisé (token invalide)" }), { status: 401, headers: CORS });
    const userData = await userRes.json();
    adminUserId = userData && userData.id;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification token", details: e.message }), { status: 500, headers: CORS });
  }
  if (!adminUserId)
    return new Response(JSON.stringify({ error: "Non autorisé (utilisateur introuvable)" }), { status: 401, headers: CORS });

  // Vérifier le rôle admin via service role (lecture fiable, contourne RLS)
  try {
    const profRes = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=eq.${adminUserId}&select=role`,
      { headers: H_READ }
    );
    const profRows = await profRes.json();
    const role = profRows && profRows[0] && profRows[0].role;
    if (role !== "admin")
      return new Response(JSON.stringify({ error: "Accès refusé (rôle non admin)" }), { status: 403, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification rôle", details: e.message }), { status: 500, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── ACTION : LISTER tous les dossiers (lecture admin) ───────
  // ════════════════════════════════════════════════════════════
  if (action === "lister") {
    try {
      const res = await fetch(
        `${SUPA_URL}/rest/v1/credit_phones?select=*&order=created_at.desc`,
        { headers: H_READ }
      );
      const rows = await res.json();
      return new Response(JSON.stringify({ success: true, dossiers: Array.isArray(rows) ? rows : [] }), { status: 200, headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Erreur lecture Supabase", details: e.message }), { status: 500, headers: CORS });
    }
  }

  // ── Les actions suivantes nécessitent un dossier_id ─────────
  if (!dossier_id)
    return new Response(JSON.stringify({ error: "dossier_id manquant" }), { status: 400, headers: CORS });

  const dossierUrl = `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`;

  // Helpers
  const patchDossier = (patch) =>
    fetch(dossierUrl, { method: "PATCH", headers: H_WRITE, body: JSON.stringify(patch) });
  const insertNotif = (notif) =>
    fetch(`${SUPA_URL}/rest/v1/notifications`, { method: "POST", headers: H_WRITE, body: JSON.stringify(notif) }).catch(()=>{});

  // ── 3. Charger le dossier (pour user_id, nom, etc.) ─────────
  let dossier = null;
  try {
    const res = await fetch(
      `${dossierUrl}&select=dossier_id,user_id,client_nom,statut_compte,device_id`,
      { headers: H_READ }
    );
    const rows = await res.json();
    if (rows && rows[0]) dossier = rows[0];
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur lecture Supabase", details: e.message }), { status: 500, headers: CORS });
  }
  if (!dossier)
    return new Response(JSON.stringify({ error: "Dossier introuvable" }), { status: 404, headers: CORS });

  // ════════════════════════════════════════════════════════════
  // ── ACTION : VALIDER ────────────────────────────────────────
  // ════════════════════════════════════════════════════════════
  if (action === "valider") {
    const device_id = (body.device_id || "").trim();
    if (!device_id)
      return new Response(JSON.stringify({ error: "device_id requis" }), { status: 400, headers: CORS });

    // Calcul des échéances : acompte aujourd'hui (J), versement 2 à J+30, versement 3 à J+60
    const d = (days) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + days);
      return dt.toISOString().slice(0, 10); // YYYY-MM-DD
    };

    const patch = {
      statut_compte: "valide",
      device_id,
      valide_at:  new Date().toISOString(),
      echeance_1: d(0),
      echeance_2: d(30),
      echeance_3: d(60)
    };

    const upd = await patchDossier(patch);
    if (!upd.ok) {
      const t = await upd.text();
      return new Response(JSON.stringify({ error: "Échec mise à jour", details: t }), { status: 500, headers: CORS });
    }

    await insertNotif({
      dossier_id, user_id: dossier.user_id || null, pour_admin: false,
      titre: "Compte validé ✅",
      message: "Votre dossier de crédit a été validé. Vous pouvez procéder au paiement de l'acompte.",
      type: "succes"
    });

    // Email échéancier de crédit (ne bloque pas la réponse en cas d'échec)
    try {
      await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossier_id, evenement: "validation" })
      });
    } catch (e) {}

    return new Response(JSON.stringify({
      success: true, action: "valider",
      echeances: { echeance_1: patch.echeance_1, echeance_2: patch.echeance_2, echeance_3: patch.echeance_3 }
    }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── ACTION : REFUSER ────────────────────────────────────────
  // ════════════════════════════════════════════════════════════
  if (action === "refuser") {
    const motif = (body.motif || "Documents non conformes").toString().slice(0, 500);

    const upd = await patchDossier({
      statut_compte: "refuse",
      motif_refus: motif,
      refuse_at: new Date().toISOString()
    });
    if (!upd.ok) {
      const t = await upd.text();
      return new Response(JSON.stringify({ error: "Échec mise à jour", details: t }), { status: 500, headers: CORS });
    }

    await insertNotif({
      dossier_id, user_id: dossier.user_id || null, pour_admin: false,
      titre: "Dossier refusé",
      message: "Malheureusement, nous n'avons pas pu valider vos documents. Motif : " + motif,
      type: "refus"
    });

    // Email au client : dossier refusé (le motif est déjà en base, credit-notify le relira)
    await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossier_id, evenement: "refuse" })
    }).catch(()=>{});

    return new Response(JSON.stringify({ success: true, action: "refuser" }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── ACTION : MARQUER VERSEMENT PAYÉ (manuel, cash/Wave) ─────
  // ════════════════════════════════════════════════════════════
  if (action === "marquer_paye") {
    const num = parseInt(body.numero_versement, 10);
    if (![1, 2, 3].includes(num))
      return new Response(JSON.stringify({ error: "numero_versement invalide" }), { status: 400, headers: CORS });

    const patch = {};
    patch[`paye_${num}`] = true;
    patch[`paye_${num}_at`] = new Date().toISOString();

    const upd = await patchDossier(patch);
    if (!upd.ok) {
      const t = await upd.text();
      return new Response(JSON.stringify({ error: "Échec mise à jour", details: t }), { status: 500, headers: CORS });
    }

    // Si le téléphone était verrouillé et qu'on encaisse un versement → déverrouiller
    if (dossier.device_id) {
      let locked = false;
      try {
        const r = await fetch(`${dossierUrl}&select=lost_mode_actif`, { headers: H_READ });
        const rows = await r.json();
        locked = rows && rows[0] && rows[0].lost_mode_actif;
      } catch(e) {}

      if (locked) {
        const MDM_KEY = (env.SIMPLEMDM_API_KEY || "").trim();
        if (MDM_KEY) {
          try {
            const mdmRes = await fetch(`https://a.simplemdm.com/api/v1/devices/${dossier.device_id}/lost_mode`, {
              method: "DELETE",
              headers: { "Authorization": "Basic " + btoa(MDM_KEY + ":") }
            });
            if (mdmRes.ok || mdmRes.status === 202) {
              await patchDossier({ lost_mode_actif: false, unlock_at: new Date().toISOString() });
              await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dossier_id, evenement: "deverrouille" })
              }).catch(()=>{});
            }
          } catch(e) {}
        }
      }
    }

    // Email au client : versement reçu
    await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossier_id, evenement: "versement" })
    }).catch(()=>{});

    // Vérifier si les 3 versements sont désormais payés → passer en "solde"
    try {
      const r = await fetch(`${dossierUrl}&select=paye_1,paye_2,paye_3,statut_compte`, { headers: H_READ });
      const rows = await r.json();
      const d = rows && rows[0];
      if (d && d.paye_1 && d.paye_2 && d.paye_3 && d.statut_compte === "valide") {
        await patchDossier({ statut_compte: "solde", solde_at: new Date().toISOString() });
        await insertNotif({
          dossier_id, user_id: dossier.user_id || null, pour_admin: false,
          titre: "Crédit soldé 🎉",
          message: "Félicitations, vous avez réglé l'intégralité de votre crédit. Le téléphone vous appartient pleinement.",
          type: "succes"
        });
      }
    } catch(e) {}

    return new Response(JSON.stringify({ success: true, action: "marquer_paye", versement: num }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── ACTION : MARQUER / RETIRER LITIGE (admin) ──────────────
  // ════════════════════════════════════════════════════════════
  if (action === "marquer_litige") {
    const upd = await patchDossier({ litige_en_cours: true });
    if (!upd.ok) {
      const t = await upd.text();
      return new Response(JSON.stringify({ error: "Échec mise à jour", details: t }), { status: 500, headers: CORS });
    }
    await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossier_id, evenement: "litige" })
    }).catch(()=>{});
    return new Response(JSON.stringify({ success: true, action: "marquer_litige" }), { status: 200, headers: CORS });
  }

  if (action === "retirer_litige") {
    const upd = await patchDossier({ litige_en_cours: false });
    if (!upd.ok) {
      const t = await upd.text();
      return new Response(JSON.stringify({ error: "Échec mise à jour", details: t }), { status: 500, headers: CORS });
    }
    await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossier_id, evenement: "litige_retire" })
    }).catch(()=>{});
    return new Response(JSON.stringify({ success: true, action: "retirer_litige" }), { status: 200, headers: CORS });
  }
  // ════════════════════════════════════════════════════════════
  // ── ACTION : VERROUILLER (manuel, via SimpleMDM lost mode) ──
  // ════════════════════════════════════════════════════════════
  if (action === "verrouiller") {
    if (!dossier.device_id)
      return new Response(JSON.stringify({ error: "Aucun device_id sur ce dossier" }), { status: 400, headers: CORS });

    const MDM_KEY = (env.SIMPLEMDM_API_KEY || "").trim();
    if (!MDM_KEY)
      return new Response(JSON.stringify({ error: "SimpleMDM non configuré" }), { status: 500, headers: CORS });

    const MESSAGE = "SECK DIGITAL SERVICES PRO. Cher client, votre versement est en attente. Pour debloquer votre telephone, connectez-vous a votre compte sur sdsprotech.com et reglez votre echeance. Pour toute question contactez-nous. Merci de votre confiance.";
    const PHONE   = env.COMPANY_PHONE || "+221770699739";

    try {
      const form = new URLSearchParams();
      form.set("message", MESSAGE);
      form.set("phone_number", PHONE);
      const mdmRes = await fetch(`https://a.simplemdm.com/api/v1/devices/${dossier.device_id}/lost_mode`, {
        method: "POST",
        headers: { "Authorization": "Basic " + btoa(MDM_KEY + ":"), "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });
      if (mdmRes.ok || mdmRes.status === 202) {
        await patchDossier({ lost_mode_actif: true, lock_at: new Date().toISOString() });
        await insertNotif({
          dossier_id, pour_admin: true,
          titre: "Téléphone verrouillé 🔒",
          message: `${dossier.client_nom || "Client"} : appareil ${dossier.device_id} verrouillé manuellement.`,
          type: "alerte"
        });
        await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dossier_id, evenement: "verrouille" })
        }).catch(()=>{});
        return new Response(JSON.stringify({ success: true, action: "verrouiller" }), { status: 200, headers: CORS });
      }
      const t = await mdmRes.text();
      return new Response(JSON.stringify({ error: "Échec SimpleMDM", status: mdmRes.status, details: t }), { status: 502, headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Erreur SimpleMDM", details: e.message }), { status: 500, headers: CORS });
    }
  }

  // ════════════════════════════════════════════════════════════
  // ── ACTION : DEVERROUILLER (manuel) ────────────────────────
  // ════════════════════════════════════════════════════════════
  if (action === "deverrouiller") {
    if (!dossier.device_id)
      return new Response(JSON.stringify({ error: "Aucun device_id sur ce dossier" }), { status: 400, headers: CORS });

    const MDM_KEY = (env.SIMPLEMDM_API_KEY || "").trim();
    if (!MDM_KEY)
      return new Response(JSON.stringify({ error: "SimpleMDM non configuré" }), { status: 500, headers: CORS });

    try {
      const mdmRes = await fetch(`https://a.simplemdm.com/api/v1/devices/${dossier.device_id}/lost_mode`, {
        method: "DELETE",
        headers: { "Authorization": "Basic " + btoa(MDM_KEY + ":") }
      });
      if (mdmRes.ok || mdmRes.status === 202) {
        await patchDossier({ lost_mode_actif: false, unlock_at: new Date().toISOString() });
        await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dossier_id, evenement: "deverrouille" })
        }).catch(()=>{});
        return new Response(JSON.stringify({ success: true, action: "deverrouiller" }), { status: 200, headers: CORS });
      }
      const t = await mdmRes.text();
      return new Response(JSON.stringify({ error: "Échec SimpleMDM", status: mdmRes.status, details: t }), { status: 502, headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Erreur SimpleMDM", details: e.message }), { status: 500, headers: CORS });
    }
  }

  return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers: CORS });
}
