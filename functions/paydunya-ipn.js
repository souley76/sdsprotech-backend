import { CORS_HEADERS, handleOptions } from "../_helpers";

// ╔══════════════════════════════════════════════════════════════════╗
// ║ PAYDUNYA-IPN — VERSION CORRIGÉE                                  ║
// ║ ✅ 4 versements crédit (acompte + 3 mensualités)                 ║
// ║ ✅ FAILLE CORRIGÉE : le montant réellement payé est maintenant   ║
// ║    comparé au montant attendu du versement AVANT de marquer      ║
// ║    "payé" et de déverrouiller le téléphone. Avant, une facture   ║
// ║    de n'importe quel montant avec un commande_id "CRED-xxx-N"    ║
// ║    suffisait à déverrouiller un téléphone.                       ║
// ║ ✅ Clé interne ajoutée sur les appels credit-notify / notify     ║
// ╚══════════════════════════════════════════════════════════════════╝

const FRAIS_MDM = 10000;

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestGet(context) {
  const CORS = CORS_HEADERS(context.env);
  return new Response(JSON.stringify({
    ok: true,
    service: "paydunya-ipn",
    message: "Endpoint IPN actif. Utilisez POST pour les notifications de paiement."
  }), { status: 200, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  // ── Lecture body — PayDunya envoie form-urlencoded OU JSON ───
  let token = null;
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      token = body.data?.invoice?.token || body.token || null;
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      token = params.get("data[invoice][token]") || params.get("token") || null;
      if (!token) {
        try {
          const parsed = JSON.parse(decodeURIComponent(text));
          token = parsed.data?.invoice?.token || parsed.token || null;
        } catch(_) {}
      }
    }
  } catch(e) {
    return new Response(JSON.stringify({ error: "Lecture body échouée" }), { status: 400, headers: CORS });
  }

  const MASTER_KEY = env.PAYDUNYA_MASTER_KEY;
  if (!token || !MASTER_KEY)
    return new Response(JSON.stringify({ error: "Token manquant", contentType }), { status: 400, headers: CORS });

  // ── Vérification paiement via API PayDunya ──────────────────
  const MODE = env.PAYDUNYA_MODE || "live";
  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  let confirmData;
  try {
    const confirmRes = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, {
      method: "GET",
      headers: {
        "Content-Type":         "application/json",
        "PAYDUNYA-MASTER-KEY":  env.PAYDUNYA_MASTER_KEY,
        "PAYDUNYA-PRIVATE-KEY": env.PAYDUNYA_PRIVATE_KEY,
        "PAYDUNYA-TOKEN":       env.PAYDUNYA_TOKEN
      }
    });
    confirmData = await confirmRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Vérification PayDunya échouée" }), { status: 500, headers: CORS });
  }

  const statut      = confirmData?.status;
  const commande_id = confirmData?.custom_data?.commande_id;
  const client_nom  = confirmData?.custom_data?.client_nom  || "";
  const client_tel  = confirmData?.custom_data?.client_tel  || "";
  const client_adr  = confirmData?.custom_data?.client_address || "";
  const montant     = Number(confirmData?.invoice?.total_amount || 0);
  const articles    = confirmData?.invoice?.items?.item_0?.name || "";

  const statusMap = { completed: "PAID", pending: "PENDING", cancelled: "FAILED", failed: "FAILED" };
  const internalStatus = statusMap[statut] || "PENDING";

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  // Headers internes (clé anti-spam pour credit-notify / notify)
  const H_NOTIFY = { "Content-Type": "application/json", "X-Internal-Key": (env.INTERNAL_KEY || "").trim() };
  const H_SUPA_R = { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };
  const H_SUPA_W = { ...H_SUPA_R, "Content-Type": "application/json", "Prefer": "return=minimal" };

  // ════════════════════════════════════════════════════════════
  // ── CAS FORMATION : commande_id commence par "FORM-" ────────
  // ════════════════════════════════════════════════════════════
  if (commande_id && commande_id.startsWith("FORM-") && internalStatus === "PAID" && SUPA_URL && SUPA_KEY) {
    const course_id = confirmData?.custom_data?.course_id || null;
    const user_id   = confirmData?.custom_data?.user_id || null;

    // Passer l'achat en "paid" (par commande_id, sinon par user+course)
    try {
      const filtre = `commande_id=eq.${encodeURIComponent(commande_id)}`;
      const upd = await fetch(`${SUPA_URL}/rest/v1/purchases?${filtre}`, {
        method: "PATCH",
        headers: { ...H_SUPA_W, "Prefer": "return=representation" },
        body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString(), paydunya_token: token })
      });
      const rows = await upd.json();
      // Si aucune ligne mise à jour (achat pending non trouvé), créer la ligne payée
      if ((!Array.isArray(rows) || rows.length === 0) && user_id && course_id) {
        await fetch(`${SUPA_URL}/rest/v1/purchases`, {
          method: "POST",
          headers: H_SUPA_W,
          body: JSON.stringify({
            user_id, course_id, status: "paid",
            amount: montant || 15000,
            email: confirmData?.custom_data?.client_email || null,
            paydunya_token: token, commande_id,
            paid_at: new Date().toISOString(), created_at: new Date().toISOString()
          })
        });
      }
    } catch (e) {}

    return new Response(JSON.stringify({ ok: true, type: "formation", commande_id }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── CAS CRÉDIT PHONE : commande_id commence par "CRED-" ──────
  // ════════════════════════════════════════════════════════════
  if (commande_id && commande_id.startsWith("CRED-") && internalStatus === "PAID") {
    // Format attendu : CRED-XXXXXXXX-N  →  dossier = CRED-XXXXXXXX, versement = N
    const lastDash = commande_id.lastIndexOf("-");
    const dossier_id = commande_id.substring(0, lastDash);
    const numVersement = parseInt(commande_id.substring(lastDash + 1), 10);

    if (dossier_id && [1, 2, 3, 4].includes(numVersement) && SUPA_URL && SUPA_KEY) {

      // 1. ✅ D'ABORD récupérer le dossier (montants attendus + état)
      let dossier = null;
      try {
        const res = await fetch(
          `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}` +
          `&select=device_id,lost_mode_actif,client_nom,user_id,statut_compte,` +
          `montant_1,montant_2,montant_3,montant_4,paye_1,paye_2,paye_3,paye_4`,
          { headers: H_SUPA_R }
        );
        const rows = await res.json();
        if (rows && rows[0]) dossier = rows[0];
      } catch(e) {}

      if (!dossier) {
        return new Response(JSON.stringify({ ok: false, type: "credit", error: "Dossier introuvable" }), { status: 200, headers: CORS });
      }

      // 2. ✅ FAILLE CORRIGÉE : vérifier le montant réellement payé.
      //    Sans ce contrôle, une facture forgée de 100 FCFA avec un
      //    commande_id "CRED-xxx-N" marquait le versement payé et
      //    déverrouillait le téléphone.
      const base = Number(dossier[`montant_${numVersement}`] || 0);
      const attendu = numVersement === 1 ? base + FRAIS_MDM : base;

      if (!(attendu > 0) || montant + 1 < attendu) { // tolérance d'arrondi de 1 FCFA
        // On n'accrédite rien ; on alerte l'admin.
        try {
          await fetch(`${SUPA_URL}/rest/v1/notifications`, {
            method: "POST",
            headers: H_SUPA_W,
            body: JSON.stringify({
              dossier_id, pour_admin: true,
              titre: "⚠️ Paiement crédit suspect (montant insuffisant)",
              message: `Paiement de ${montant} FCFA reçu pour le versement ${numVersement} du dossier ${dossier_id}, montant attendu : ${attendu} FCFA. Versement NON validé — vérifiez ce paiement.`,
              type: "alerte"
            })
          });
        } catch(e) {}
        return new Response(JSON.stringify({ ok: false, type: "credit", error: "Montant insuffisant", attendu, recu: montant }), { status: 200, headers: CORS });
      }

      // 3. Marquer le versement payé
      const patch = {};
      patch[`paye_${numVersement}`] = true;
      patch[`paye_${numVersement}_at`] = new Date().toISOString();

      try {
        await fetch(`${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`, {
          method: "PATCH",
          headers: H_SUPA_W,
          body: JSON.stringify(patch)
        });
      } catch(e) {}

      // 4. Si le téléphone était verrouillé → DELETE SimpleMDM (déverrouiller)
      if (dossier.lost_mode_actif && dossier.device_id) {
        const MDM_KEY = (env.SIMPLEMDM_API_KEY || "").trim();
        if (MDM_KEY) {
          try {
            const mdmRes = await fetch(`https://a.simplemdm.com/api/v1/devices/${dossier.device_id}/lost_mode`, {
              method: "DELETE",
              headers: { "Authorization": "Basic " + btoa(MDM_KEY + ":") }
            });
            if (mdmRes.ok || mdmRes.status === 202) {
              await fetch(`${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`, {
                method: "PATCH",
                headers: H_SUPA_W,
                body: JSON.stringify({ lost_mode_actif: false, unlock_at: new Date().toISOString() })
              });
              // Email au client : téléphone débloqué
              await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
                method: "POST",
                headers: H_NOTIFY,
                body: JSON.stringify({ dossier_id, evenement: "deverrouille" })
              }).catch(()=>{});
            }
          } catch(e) {}
        }
      }

      // 5. ✅ Si les 4 versements sont payés → passer le dossier en "solde"
      //    (compatibilité : un ancien dossier sans montant_4 se solde en 3 versements)
      const v4Requis = !(dossier.montant_4 === null || dossier.montant_4 === undefined);
      const tousPayes =
        (numVersement === 1 || dossier.paye_1) &&
        (numVersement === 2 || dossier.paye_2) &&
        (numVersement === 3 || dossier.paye_3) &&
        (!v4Requis || numVersement === 4 || dossier.paye_4);
      if (tousPayes && dossier.statut_compte === "valide") {
        try {
          await fetch(`${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`, {
            method: "PATCH",
            headers: H_SUPA_W,
            body: JSON.stringify({ statut_compte: "solde", solde_at: new Date().toISOString() })
          });
          await fetch(`${SUPA_URL}/rest/v1/notifications`, {
            method: "POST",
            headers: H_SUPA_W,
            body: JSON.stringify({
              dossier_id, user_id: dossier.user_id || null, pour_admin: false,
              titre: "Credit solde",
              message: "Felicitations, vous avez regle l'integralite de votre credit. Le telephone vous appartient pleinement.",
              type: "succes"
            })
          });
        } catch(e) {}
      }

      // 6. Notification admin
      try {
        await fetch(`${SUPA_URL}/rest/v1/notifications`, {
          method: "POST",
          headers: H_SUPA_W,
          body: JSON.stringify({
            dossier_id, pour_admin: true,
            titre: "Versement crédit payé 💰",
            message: `${dossier.client_nom || client_nom} a payé le versement ${numVersement} (${montant} FCFA). Téléphone déverrouillé si nécessaire.`,
            type: "succes"
          })
        });
      } catch(e) {}

      // 7. Email échéancier au client (récap + liens versements restants)
      try {
        await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
          method: "POST",
          headers: H_NOTIFY,
          body: JSON.stringify({ dossier_id, evenement: "versement" })
        });
      } catch(e) {}

      return new Response(JSON.stringify({ ok: true, type: "credit", dossier: dossier_id, versement: numVersement }), { status: 200, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: false, type: "credit", error: "Référence versement invalide" }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── CAS NORMAL : commande classique (comportement existant) ──
  // ════════════════════════════════════════════════════════════
  if (SUPA_URL && SUPA_KEY && commande_id) {
    try {
      await fetch(
        `${SUPA_URL}/rest/v1/orders?commande_id=eq.${encodeURIComponent(commande_id)}`,
        {
          method: "PATCH",
          headers: H_SUPA_W,
          body: JSON.stringify({
            status:          internalStatus,
            paydunya_status: statut?.toUpperCase() || "PENDING",
            paydunya_token:  token,
            paid_at:         internalStatus === "PAID" ? new Date().toISOString() : null
          })
        }
      );
    } catch (dbErr) { console.error("Supabase error:", dbErr.message); }
  }

  if (internalStatus === "PAID" && env.RESEND_API_KEY) {
    try {
      await fetch("https://sdsprotech-backend.pages.dev/notify", {
        method: "POST",
        headers: H_NOTIFY,
        body: JSON.stringify({
          client_nom, client_tel,
          client_email: confirmData?.custom_data?.client_email || "",
          client_adr, articles,
          total:          montant ? montant + " XOF" : "—",
          operateur:      "PayDunya",
          date:           new Date().toLocaleString("fr-FR"),
          commande_id,
          paydunya_token: token
        })
      });
    } catch (notifErr) { console.error("Notify error:", notifErr.message); }
  }

  return new Response(JSON.stringify({ ok: true, status: internalStatus }), {
    status: 200, headers: CORS
  });
}
