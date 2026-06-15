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

  // ── 1. Récupérer la commande EXISTANTE dans Supabase ──────────
  let order = null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/orders?commande_id=eq.${encodeURIComponent(commande_id)}` +
      `&select=status,paydunya_status,paydunya_token,amount,total,prix,product,produit,` +
      `client_name,user_name,phone,telephone,user_email,address,adresse`,
      { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    );
    const rows = await res.json();
    if (rows && rows[0]) order = rows[0];
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur Supabase", details: e.message }), { status: 500, headers: CORS });
  }

  if (!order)
    return new Response(JSON.stringify({ error: "Commande introuvable" }), { status: 404, headers: CORS });

  // ── 2. Déjà payée ? ───────────────────────────────────────────
  const st = order.status || order.paydunya_status;
  if (['confirmée', 'confirmee', 'PAID', 'COMPLETED', 'livre', 'livré'].includes(st)) {
    return new Response(JSON.stringify({ success: true, status: 'completed' }), { status: 200, headers: CORS });
  }

  // ── 3. Si on a un token, vérifier d'abord son statut côté PayDunya ──
  if (order.paydunya_token) {
    try {
      const confirmRes = await fetch(`${BASE_URL}/checkout-invoice/confirm/${order.paydunya_token}`, {
        headers: {
          "PAYDUNYA-MASTER-KEY":  env.PAYDUNYA_MASTER_KEY,
          "PAYDUNYA-PRIVATE-KEY": env.PAYDUNYA_PRIVATE_KEY,
          "PAYDUNYA-TOKEN":       env.PAYDUNYA_TOKEN
        }
      });
      const confirmData = await confirmRes.json();
      if (confirmData?.status === "completed") {
        await fetch(`${SUPA_URL}/rest/v1/orders?commande_id=eq.${encodeURIComponent(commande_id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({ status: "confirmée", paydunya_status: "COMPLETED", paid_at: new Date().toISOString() })
        });
        return new Response(JSON.stringify({ success: true, status: 'completed' }), { status: 200, headers: CORS });
      }
    } catch (e) { /* on continue : on régénère une facture fraîche */ }
  }

  // ── 4. Régénérer une facture PayDunya FRAÎCHE (même commande_id) ──
  //     C'est la seule façon fiable d'obtenir une URL de paiement valide :
  //     l'URL ne se construit jamais à la main, elle vient de response_text.
  const MASTER_KEY  = env.PAYDUNYA_MASTER_KEY;
  const PRIVATE_KEY = env.PAYDUNYA_PRIVATE_KEY;
  const TOKEN       = env.PAYDUNYA_TOKEN;
  if (!MASTER_KEY || !PRIVATE_KEY || !TOKEN)
    return new Response(JSON.stringify({ error: "Clés PayDunya manquantes" }), { status: 500, headers: CORS });

  const montant = Number(order.amount || order.total || order.prix || 0);
  if (!(montant > 0))
    return new Response(JSON.stringify({ error: "Montant introuvable pour cette commande" }), { status: 400, headers: CORS });

  const articles  = order.product || order.produit || "Commande SDS ProTech";
  const clientNom = order.client_name || order.user_name || "Client";
  const clientTel = order.phone || order.telephone || "";
  const SITE_URL  = env.COMPANY_WEBSITE || "https://sdsprotech.com";

  const payload = {
    invoice: {
      items: {
        item_0: {
          name: articles, quantity: 1, unit_price: montant, total_price: montant,
          description: `Commande #${commande_id}`
        }
      },
      taxes: {},
      total_amount: montant,
      description: `Commande #${commande_id} — ${clientNom}`
    },
    store: {
      name: env.COMPANY_NAME || "SDS ProTech",
      tagline: "Boutique smartphones Dakar",
      phone: env.COMPANY_PHONE || "",
      postal_address: "Dakar, Sénégal",
      website_url: SITE_URL,
      logo_url: SITE_URL + "/logo.png"
    },
    actions: {
      cancel_url:   SITE_URL + "/produit.html?commande=" + commande_id + "&statut=annule",
      return_url:   SITE_URL + "/produit.html?commande=" + commande_id + "&statut=succes",
      callback_url: "https://sdsprotech-backend.pages.dev/paydunya-ipn"
    },
    custom_data: { commande_id, client_nom: clientNom, client_tel: clientTel }
  };

  let pdRes, result;
  try {
    pdRes = await fetch(`${BASE_URL}/checkout-invoice/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY":  MASTER_KEY,
        "PAYDUNYA-PRIVATE-KEY": PRIVATE_KEY,
        "PAYDUNYA-TOKEN":       TOKEN
      },
      body: JSON.stringify(payload)
    });
    result = await pdRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Connexion PayDunya échouée", details: err.message }), { status: 500, headers: CORS });
  }

  if (!pdRes.ok || result.response_code !== "00")
    return new Response(JSON.stringify({ error: "Erreur PayDunya", details: result }), { status: 400, headers: CORS });

  // ── 5. Mettre à jour le token (PAS de nouvelle commande → pas de doublon) ──
  if (result.token) {
    try {
      await fetch(`${SUPA_URL}/rest/v1/orders?commande_id=eq.${encodeURIComponent(commande_id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ paydunya_token: result.token, paydunya_status: "PENDING" })
      });
    } catch (e) {}
  }

  return new Response(JSON.stringify({
    success: true,
    payment_url: result.response_text,  // URL fournie par PayDunya — la seule valide
    token: result.token
  }), { status: 200, headers: CORS });
}
