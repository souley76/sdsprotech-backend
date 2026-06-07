import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  const MASTER_KEY  = env.PAYDUNYA_MASTER_KEY;
  const PRIVATE_KEY = env.PAYDUNYA_PRIVATE_KEY;
  const TOKEN_KEY   = env.PAYDUNYA_TOKEN;
  const MODE        = env.PAYDUNYA_MODE || "live";
  const SUPA_URL    = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY    = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { token, commande_id } = body;

  if (!token)
    return new Response(JSON.stringify({ error: "Token manquant" }), { status: 400, headers: CORS });

  // ── 1. Vérifier le statut du paiement auprès de PayDunya ─────
  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  let pdStatus = null;
  let pdData   = null;

  try {
    const pdRes = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, {
      headers: {
        "PAYDUNYA-MASTER-KEY":  MASTER_KEY,
        "PAYDUNYA-PRIVATE-KEY": PRIVATE_KEY,
        "PAYDUNYA-TOKEN":       TOKEN_KEY
      }
    });
    pdData = await pdRes.json();
    pdStatus = pdData?.status;
  } catch(e) {
    return new Response(JSON.stringify({ error: "Erreur vérification PayDunya", details: e.message }), { status: 500, headers: CORS });
  }

  // ── 2. Mettre à jour Supabase si paiement confirmé ───────────
  if (pdStatus === "completed" && SUPA_URL && SUPA_KEY) {
    // Chercher la commande par token ou par commande_id
    const filterParam = commande_id
      ? `commande_id=eq.${encodeURIComponent(commande_id)}`
      : `paydunya_token=eq.${encodeURIComponent(token)}`;

    try {
      await fetch(`${SUPA_URL}/rest/v1/orders?${filterParam}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey":        SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY,
          "Prefer":        "return=minimal"
        },
        body: JSON.stringify({
          status:          "confirmée",
          paydunya_status: "COMPLETED",
          paydunya_token:  token,
          paid_at:         new Date().toISOString()
        })
      });
    } catch(e) {
      // Log mais ne pas bloquer la réponse
      console.error("Supabase PATCH error:", e.message);
    }

    return new Response(JSON.stringify({ success: true, status: "completed" }), { status: 200, headers: CORS });
  }

  // Paiement pas encore confirmé ou échoué
  return new Response(JSON.stringify({
    success: false,
    status:  pdStatus || "unknown",
    details: pdData
  }), { status: 200, headers: CORS });
}
