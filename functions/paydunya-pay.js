import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  const MASTER_KEY  = env.PAYDUNYA_MASTER_KEY;
  const PRIVATE_KEY = env.PAYDUNYA_PRIVATE_KEY;
  const PUBLIC_KEY  = env.PAYDUNYA_PUBLIC_KEY;  // ← AVANT : TOKEN
  const MODE        = env.PAYDUNYA_MODE || "live";

  if (!MASTER_KEY || !PRIVATE_KEY || !PUBLIC_KEY) {
    return new Response(JSON.stringify({ 
      error: "Clés PayDunya manquantes",
      manquant: { master: !MASTER_KEY, private: !PRIVATE_KEY, public: !PUBLIC_KEY }
    }), { status: 500, headers: CORS });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { client_nom, client_tel, client_email, articles, total, commande_id, return_url, cancel_url } = body;

  if (!client_nom || !client_tel || !total || !commande_id)
    return new Response(JSON.stringify({ error: "Champs requis manquants", recu: body }), { status: 400, headers: CORS });

  const montant = Number(total);
  if (isNaN(montant) || montant <= 0)
    return new Response(JSON.stringify({ error: "Montant invalide" }), { status: 400, headers: CORS });

  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  const SITE_URL = env.COMPANY_WEBSITE || "https://sdsprotech.com";

  const payload = {
    invoice: {
      items: {
        item_0: {
          name:        articles || "Commande SDS ProTech",
          quantity:    1,
          unit_price:  montant,
          total_price: montant,
          description: `Commande #${commande_id}`
        }
      },
      taxes: {},
      total_amount: montant,
      description:  `Commande #${commande_id} — ${client_nom}`
    },
    store: {
      name:           env.COMPANY_NAME  || "SDS ProTech",
      tagline:        "Boutique smartphones Dakar",
      phone:          env.COMPANY_PHONE || "",
      postal_address: "Dakar, Sénégal",
      website_url:    SITE_URL,
      logo_url:       SITE_URL + "/logo.png"
    },
    actions: {
      cancel_url:   cancel_url || SITE_URL + "/accessoires.html?commande=" + commande_id + "&statut=annule",
      return_url:   return_url || SITE_URL + "/accessoires.html?commande=" + commande_id + "&statut=succes",
      callback_url: "https://sdsprotech-backend.pages.dev/paydunya-ipn"
    },
    custom_data: { commande_id, client_nom, client_tel, client_email: client_email || "" }
  };

  let pdRes;
  try {
    pdRes = await fetch(`${BASE_URL}/checkout-invoice/create`, {
      method: "POST",
      headers: {
        "Content-Type":         "application/json",
        "PAYDUNYA-MASTER-KEY":  MASTER_KEY,
        "PAYDUNYA-PRIVATE-KEY": PRIVATE_KEY,
        "PAYDUNYA-PUBLIC-KEY":  PUBLIC_KEY    // ← AVANT : PAYDUNYA-TOKEN
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Connexion PayDunya échouée", details: err.message }), { status: 500, headers: CORS });
  }

  const result = await pdRes.json();

  if (!pdRes.ok || result.response_code !== "00") {
    return new Response(JSON.stringify({ error: "Erreur PayDunya", details: result }), { status: 400, headers: CORS });
  }

  // ── Sauvegarde Supabase (champs minimaux pour éviter les erreurs colonne) ──
  let supaDebug = null;

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const orderData = {
        commande_id,
        client_name:     client_nom,
        email:           client_email || null,
        phone:           client_tel,
        product:         articles || "",
        amount:          montant,
        currency:        "XOF",
        operator:        "PayDunya",
        status:          "en_attente",
        paydunya_status: "PENDING",
        paydunya_token:  result.token,
        created_at:      new Date().toISOString()
      };

      const supaRes = await fetch(env.SUPABASE_URL + "/rest/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":        env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
          "Prefer":        "return=representation"
        },
        body: JSON.stringify(orderData)
      });

      const supaBody = await supaRes.text();
      supaDebug = { status: supaRes.status, ok: supaRes.ok, body: supaBody };

      if (!supaRes.ok) {
        console.error("[PAYDUNYA] Supabase error:", supaRes.status, supaBody);
      }
    } catch (e) {
      supaDebug = { error: e.message };
      console.error("[PAYDUNYA] Supabase exception:", e.message);
    }
  }

  return new Response(JSON.stringify({
    success:     true,
    payment_url: result.response_text,
    token:       result.token,
    _debug:      supaDebug
  }), { status: 200, headers: CORS });
}
