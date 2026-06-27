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

  const { action, dossier_id, admin_secret } = body;

  // ── 2. Sécurité : secret admin partagé ──────────────────────
  // Empêche n'importe qui d'appeler ce backend pour valider un dossier.
  if (!env.ADMIN_SECRET || admin_secret !== env.ADMIN_SECRET)
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: CORS });

  if (!dossier_id || !action)
    return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  const H_READ  = { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };
  const H_WRITE = { ...H_READ, "Content-Type": "application/json", "Prefer": "return=minimal" };
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
            }
          } catch(e) {}
        }
      }
    }

    return new Response(JSON.stringify({ success: true, action: "marquer_paye", versement: num }), { status: 200, headers: CORS });
  }

  return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers: CORS });
}
