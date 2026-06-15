import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { commande_id } = body;
  if (!commande_id)
    return new Response(JSON.stringify({ error: "commande_id manquant" }), { status: 400, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const MODE     = env.PAYDUNYA_MODE || "live";
  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  // 1. Chercher la commande dans Supabase pour récupérer le token PayDunya
  let token = null;
  let orderStatus = null;

  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/orders?commande_id=eq.${encodeURIComponent(commande_id)}&select=paydunya_token,status,paydunya_status`,
      {
        headers: {
          "apikey":        SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY
        }
      }
    );
    const rows = await res.json();
    if (rows && rows[0]) {
      token       = rows[0].paydunya_token;
      orderStatus = rows[0].status || rows[0].paydunya_status;
    }
  } catch(e) {
    return new Response(JSON.stringify({ error: "Erreur Supabase" }), { status: 500, headers: CORS });
  }

  // 2. Si déjà payé
  if (['confirmée','PAID','COMPLETED','livre'].includes(orderStatus)) {
    return new Response(JSON.stringify({ success: true, status: 'completed' }), { status: 200, headers: CORS });
  }

  // 3. Si on a le token → vérifier statut et renvoyer le lien
  if (token) {
    try {
      const confirmRes = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, {
        headers: {
          "PAYDUNYA-MASTER-KEY":  env.PAYDUNYA_MASTER_KEY,
          "PAYDUNYA-PRIVATE-KEY": env.PAYDUNYA_PRIVATE_KEY,
          "PAYDUNYA-TOKEN":       env.PAYDUNYA_TOKEN
        }
      });
      const confirmData = await confirmRes.json();

      if (confirmData?.status === "completed") {
        // Mettre à jour Supabase
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
            body: JSON.stringify({ status: "confirmée", paydunya_status: "COMPLETED", paid_at: new Date().toISOString() })
          }
        );
        return new Response(JSON.stringify({ success: true, status: 'completed' }), { status: 200, headers: CORS });
      }

      // Paiement encore en attente — renvoyer le lien PayDunya (page client, pas l'API)
      const paymentUrl = confirmData?.invoice?.checkout_url
        || confirmData?.response_text
        || `https://payment.paydunya.com/checkout/invoice/${token}`;

      return new Response(JSON.stringify({ success: true, payment_url: paymentUrl, token }), { status: 200, headers: CORS });

    } catch(e) {
      return new Response(JSON.stringify({ error: "Erreur PayDunya" }), { status: 500, headers: CORS });
    }
  }

  // 4. Pas de token — commande introuvable
  return new Response(JSON.stringify({ error: "Commande introuvable ou token absent" }), { status: 404, headers: CORS });
}
