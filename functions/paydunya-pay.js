import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  const MASTER_KEY  = env.PAYDUNYA_MASTER_KEY;
  const PRIVATE_KEY = env.PAYDUNYA_PRIVATE_KEY;
  const TOKEN       = env.PAYDUNYA_TOKEN;
  const MODE        = env.PAYDUNYA_MODE || "live";

  if (!MASTER_KEY || !PRIVATE_KEY || !TOKEN)
    return new Response(JSON.stringify({ error: "Clés PayDunya manquantes" }), { status: 500, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const {
    client_nom, client_tel, client_email, client_address, user_id,
    articles, commande_id, return_url, cancel_url,
    produit_id, storage, color, qty, charger
  } = body;

  if (!client_nom || !client_tel || !commande_id)
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  // ── Recalcul du prix CÔTÉ SERVEUR depuis Supabase ────────────
  let montant = 0;

  if (produit_id && SUPA_URL && SUPA_KEY) {
    try {
      // Chercher d'abord dans products (Supabase)
      const prodRes = await fetch(
        `${SUPA_URL}/rest/v1/products?id=eq.${encodeURIComponent(produit_id)}&select=prix,variantes`,
        { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
      );
      const prods = await prodRes.json();
      if (prods && prods[0]) {
        const prod = prods[0];
        const variantes = Array.isArray(prod.variantes) ? prod.variantes : [];
        let prixBase = prod.prix || 0;

        // Chercher variante exacte (stockage + couleur)
        if (variantes.length > 0 && (storage || color)) {
          let variante = null;
          if (storage && color)
            variante = variantes.find(v => v.stockage === storage && v.couleur === color);
          if (!variante && storage)
            variante = variantes.find(v => v.stockage === storage);
          if (variante && variante.prix)
            prixBase = variante.prix;
        }

        const qtyNum     = Math.max(1, Math.min(10, parseInt(qty) || 1)); // max 10
        const chargerAmt = charger ? 15000 * qtyNum : 0;
        montant = prixBase * qtyNum + chargerAmt;
      }
    } catch(e) {
      console.error("Prix lookup error:", e.message);
    }
  }

  // Fallback : si produit pas dans Supabase, utiliser le total envoyé par le client
  // mais avec une limite max de sécurité (10 000 000 FCFA)
  if (montant <= 0) {
    const totalFallback = Number(body.total_fallback || 0);
    if (totalFallback > 0 && totalFallback <= 10000000) {
      montant = totalFallback;
    } else {
      return new Response(JSON.stringify({ error: "Impossible de vérifier le prix. Réessayez." }), { status: 400, headers: CORS });
    }
  }

  // ── 1. Enregistrer la commande AVANT PayDunya ─────────────────
  let supaDebug = { has_url: !!SUPA_URL, has_key: !!SUPA_KEY, key_length: SUPA_KEY.length };

  if (SUPA_URL && SUPA_KEY) {
    try {
      const supaRes = await fetch(SUPA_URL + "/rest/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":        SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY,
          "Prefer":        "return=minimal"
        },
        body: JSON.stringify({
          commande_id,
          client_name:     client_nom,
          user_name:       client_nom,
          user_email:      client_email || null,
          phone:           client_tel,
          telephone:       client_tel,
          user_id:         user_id || null,
          address:         client_address || null,
          adresse:         client_address || null,
          product:         articles || "",
          produit:         articles || "",
          amount:          montant,
          total:           montant,
          prix:            montant,
          currency:        "XOF",
          operator:        "PayDunya",
          paiement:        "PayDunya",
          status:          "en_attente",
          paydunya_status: "PENDING",
          created_at:      new Date().toISOString()
        })
      });
      const supaBody = await supaRes.text();
      supaDebug = { ...supaDebug, insert_status: supaRes.status, insert_ok: supaRes.ok, insert_body: supaBody };
    } catch (e) {
      supaDebug = { ...supaDebug, insert_error: e.message };
    }
  }

  // ── 2. Appeler PayDunya ───────────────────────────────────────
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
      cancel_url:   cancel_url || SITE_URL + "/produit.html?commande=" + commande_id + "&statut=annule",
      return_url:   return_url || SITE_URL + "/produit.html?commande=" + commande_id + "&statut=succes",
      callback_url: "https://sdsprotech-backend.pages.dev/paydunya-ipn"
    },
    custom_data: { commande_id, client_nom, client_tel, client_email: client_email || "", client_address: client_address || "" }
  };

  let pdRes;
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
  } catch (err) {
    return new Response(JSON.stringify({ error: "Connexion PayDunya échouée", details: err.message, _debug: supaDebug }), { status: 500, headers: CORS });
  }

  const result = await pdRes.json();

  if (!pdRes.ok || result.response_code !== "00")
    return new Response(JSON.stringify({ error: "Erreur PayDunya", details: result, _debug: supaDebug }), { status: 400, headers: CORS });

  // ── 3. Mettre à jour le token PayDunya dans la commande ───────
  if (SUPA_URL && SUPA_KEY && result.token) {
    try {
      await fetch(`${SUPA_URL}/rest/v1/orders?commande_id=eq.${commande_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey":        SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY,
          "Prefer":        "return=minimal"
        },
        body: JSON.stringify({ paydunya_token: result.token })
      });
    } catch(e) {}
  }

  return new Response(JSON.stringify({
    success:     true,
    payment_url: result.response_text,
    token:       result.token,
    _debug:      supaDebug
  }), { status: 200, headers: CORS });
}
