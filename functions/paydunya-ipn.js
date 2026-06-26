import { CORS_HEADERS, handleOptions } from "../_helpers";

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
  const montant     = confirmData?.invoice?.total_amount;
  const articles    = confirmData?.invoice?.items?.item_0?.name || "";

  const statusMap = { completed: "PAID", pending: "PENDING", cancelled: "FAILED", failed: "FAILED" };
  const internalStatus = statusMap[statut] || "PENDING";

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  // ════════════════════════════════════════════════════════════
  // ── CAS CRÉDIT PHONE : commande_id commence par "CRED-" ──────
  // ════════════════════════════════════════════════════════════
  if (commande_id && commande_id.startsWith("CRED-") && internalStatus === "PAID") {
    // Format attendu : CRED-XXXXXXXX-N  →  dossier = CRED-XXXXXXXX, versement = N
    const lastDash = commande_id.lastIndexOf("-");
    const dossier_id = commande_id.substring(0, lastDash);
    const numVersement = parseInt(commande_id.substring(lastDash + 1), 10);

    if (dossier_id && [1,2,3].includes(numVersement) && SUPA_URL && SUPA_KEY) {
      // 1. Marquer le versement payé
      const patch = {};
      patch[`paye_${numVersement}`] = true;
      patch[`paye_${numVersement}_at`] = new Date().toISOString();

      try {
        await fetch(`${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(patch)
        });
      } catch(e) {}

      // 2. Récupérer le dossier pour le device_id et l'état de verrouillage
      let dossier = null;
      try {
        const res = await fetch(
          `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}&select=device_id,lost_mode_actif,client_nom`,
          { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
        );
        const rows = await res.json();
        if (rows && rows[0]) dossier = rows[0];
      } catch(e) {}

      // 3. Si le téléphone était verrouillé → DELETE SimpleMDM (déverrouiller)
      if (dossier && dossier.lost_mode_actif && dossier.device_id) {
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
                headers: {
                  "Content-Type": "application/json",
                  "apikey": SUPA_KEY,
                  "Authorization": "Bearer " + SUPA_KEY,
                  "Prefer": "return=minimal"
                },
                body: JSON.stringify({ lost_mode_actif: false, unlock_at: new Date().toISOString() })
              });
            }
          } catch(e) {}
        }
      }

      // 4. Notification admin
      try {
        await fetch(`${SUPA_URL}/rest/v1/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            dossier_id, pour_admin: true,
            titre: "Versement crédit payé 💰",
            message: `${dossier?.client_nom || client_nom} a payé le versement ${numVersement}. Téléphone déverrouillé si nécessaire.`,
            type: "succes"
          })
        });
      } catch(e) {}
    }

    return new Response(JSON.stringify({ ok: true, type: "credit", dossier: dossier_id, versement: numVersement }), { status: 200, headers: CORS });
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
          headers: {
            "Content-Type": "application/json",
            "apikey":        SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer":        "return=minimal"
          },
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
        headers: { "Content-Type": "application/json" },
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
