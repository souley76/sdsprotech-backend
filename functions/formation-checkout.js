import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestGet(context) {
  const CORS = CORS_HEADERS(context.env);
  return new Response(JSON.stringify({ ok: true, service: "formation-checkout", message: "Utilisez POST." }), { status: 200, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  const MASTER_KEY  = env.PAYDUNYA_MASTER_KEY;
  const PRIVATE_KEY = env.PAYDUNYA_PRIVATE_KEY;
  const TOKEN       = env.PAYDUNYA_TOKEN;
  const MODE        = env.PAYDUNYA_MODE || "live";

  if (!MASTER_KEY || !PRIVATE_KEY || !TOKEN)
    return new Response(JSON.stringify({ message: "Clés PayDunya manquantes" }), { status: 500, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ message: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { course_id, email, user_id } = body;
  if (!course_id || !user_id)
    return new Response(JSON.stringify({ message: "Paramètres manquants" }), { status: 400, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ message: "Supabase non configuré" }), { status: 500, headers: CORS });

  // Prix de la formation
  const MONTANT = 15000;
  const TITRE   = "Formation — Les Fondements du Trading";

  // commande unique : FORM-<course>-<8 derniers chiffres du temps>
  const commande_id = `FORM-${course_id}-${Date.now().toString().slice(-8)}`;

  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  const SITE_URL = env.COMPANY_WEBSITE || "https://sdsprotech.com";

  const payload = {
    invoice: {
      items: {
        item_0: {
          name:        TITRE,
          quantity:    1,
          unit_price:  MONTANT,
          total_price: MONTANT,
          description: `Accès à vie — ${course_id}`
        }
      },
      taxes: {},
      total_amount: MONTANT,
      description:  `${TITRE} — accès à vie`
    },
    store: {
      name:           env.COMPANY_NAME  || "SDS PRO TECH",
      tagline:        "Formation Trading — Dakar",
      phone:          env.COMPANY_PHONE || "",
      postal_address: "Dakar, Sénégal",
      website_url:    SITE_URL,
      logo_url:       SITE_URL + "/logo.png"
    },
    actions: {
      cancel_url:   SITE_URL + "/salle-visionnage.html?statut=annule",
      return_url:   SITE_URL + "/salle-visionnage.html?statut=succes",
      callback_url: "https://sdsprotech-backend.pages.dev/paydunya-ipn"
    },
    custom_data: {
      commande_id,
      type: "formation",
      course_id,
      user_id,
      client_email: email || ""
    }
  };

  let pdRes, result;
  try {
    pdRes = await fetch(`${BASE_URL}/checkout-invoice/create`, {
      method: "POST",
      headers: {
        "Content-Type":         "application/json",
        "PAYDUNYA-MASTER-KEY":  MASTER_KEY,
        "PAYDUNYA-PRIVATE-KEY": PRIVATE_KEY,
        "PAYDUNYA-TOKEN":       TOKEN
      },
      body: JSON.stringify(payload)
    });
    result = await pdRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ message: "Connexion PayDunya échouée : " + err.message }), { status: 500, headers: CORS });
  }

  if (!pdRes.ok || result.response_code !== "00")
    return new Response(JSON.stringify({ message: "Erreur PayDunya", details: result }), { status: 400, headers: CORS });

  // Enregistrer un achat "pending" (l'IPN le passera en "paid")
  try {
    await fetch(`${SUPA_URL}/rest/v1/purchases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        user_id,
        course_id,
        status: "pending",
        amount: MONTANT,
        email: email || null,
        paydunya_token: result.token,
        commande_id,
        created_at: new Date().toISOString()
      })
    });
  } catch (e) { /* non bloquant */ }

  return new Response(JSON.stringify({
    checkout_url: result.response_text,  // URL fournie par PayDunya
    token: result.token,
    commande_id
  }), { status: 200, headers: CORS });
}
