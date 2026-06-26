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

  const { dossier_id, numero_versement } = body;
  const num = parseInt(numero_versement, 10);

  if (!dossier_id || ![1, 2, 3].includes(num))
    return new Response(JSON.stringify({ error: "Paramètres invalides" }), { status: 400, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  const FRAIS_MDM = 10000; // frais MDM ajoutés à l'acompte (versement 1)

  // ── 1. Récupérer le dossier côté serveur ────────────────────
  let dossier = null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}` +
      `&select=dossier_id,client_nom,client_tel,client_email,appareil,statut_compte,` +
      `montant_1,montant_2,montant_3,paye_1,paye_2,paye_3`,
      { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    );
    const rows = await res.json();
    if (rows && rows[0]) dossier = rows[0];
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur Supabase", details: e.message }), { status: 500, headers: CORS });
  }

  if (!dossier)
    return new Response(JSON.stringify({ error: "Dossier introuvable" }), { status: 404, headers: CORS });

  // ── 2. Vérifications métier ─────────────────────────────────
  if (dossier.statut_compte !== "valide")
    return new Response(JSON.stringify({ error: "Dossier non validé" }), { status: 403, headers: CORS });

  if (dossier[`paye_${num}`] === true)
    return new Response(JSON.stringify({ error: "Versement déjà payé" }), { status: 409, headers: CORS });

  // ── 3. Calcul du montant CÔTÉ SERVEUR ───────────────────────
  let montant = Number(dossier[`montant_${num}`] || 0);
  if (num === 1) montant += FRAIS_MDM; // acompte + frais MDM

  if (!(montant > 0))
    return new Response(JSON.stringify({ error: "Montant invalide" }), { status: 400, headers: CORS });

  // ── 4. Créer la facture PayDunya ────────────────────────────
  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  const SITE_URL    = env.COMPANY_WEBSITE || "https://sdsprotech.com";
  const commande_id = `${dossier_id}-${num}`; // ex : CRED-XXXXXXXX-1
  const libelle     = num === 1 ? "Acompte (50%) + frais MDM" : `Versement ${num} (25%)`;
  const clientNom   = dossier.client_nom  || "Client";
  const clientTel   = dossier.client_tel  || "";
  const clientMail  = dossier.client_email || "";

  const payload = {
    invoice: {
      items: {
        item_0: {
          name:        `${dossier.appareil || "Téléphone"} — ${libelle}`,
          quantity:    1,
          unit_price:  montant,
          total_price: montant,
          description: `Crédit ${commande_id}`
        }
      },
      taxes: {},
      total_amount: montant,
      description:  `Crédit ${commande_id} — ${clientNom} — ${libelle}`
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
      cancel_url:   SITE_URL + "/credit-halal.html?dossier=" + dossier_id + "&statut=annule",
      return_url:   SITE_URL + "/credit-halal.html?dossier=" + dossier_id + "&statut=succes",
      callback_url: "https://sdsprotech-backend.pages.dev/paydunya-ipn"
    },
    custom_data: {
      commande_id,
      client_nom: clientNom,
      client_tel: clientTel,
      client_email: clientMail,
      type: "credit",
      dossier_id,
      versement: num
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
    return new Response(JSON.stringify({ error: "Connexion PayDunya échouée", details: err.message }), { status: 500, headers: CORS });
  }

  if (!pdRes.ok || result.response_code !== "00")
    return new Response(JSON.stringify({ error: "Erreur PayDunya", details: result }), { status: 400, headers: CORS });

  // ── 5. Enregistrer le token du versement dans le dossier ────
  if (result.token) {
    const patch = {};
    patch[`token_${num}`] = result.token;
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
    } catch (e) {}
  }

  return new Response(JSON.stringify({
    success:     true,
    payment_url: result.response_text,
    token:       result.token,
    montant,
    versement:   num,
    commande_id
  }), { status: 200, headers: CORS });
}
