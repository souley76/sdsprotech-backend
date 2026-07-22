import { CORS_HEADERS, handleOptions } from "../_helpers";

// ╔══════════════════════════════════════════════════════════════════╗
// ║ CREDIT-CHECKOUT — VERSION RÉÉCRITE (4 versements + sécurité)     ║
// ║ Appelé par mon-credit.html et l'app : { dossier_id,              ║
// ║ numero_versement } → { success, payment_url }                    ║
// ║                                                                  ║
// ║ ✅ Le montant vient UNIQUEMENT de Supabase (jamais du client)    ║
// ║ ✅ 4 versements : 1 = acompte 50% + frais MDM, 2-4 = mensualités ║
// ║ ✅ Ordre imposé : impossible de payer le 3 avant le 2            ║
// ║ ✅ commande_id = "<dossier_id>-<n>" (format lu par paydunya-ipn) ║
// ║ ✅ Fusionné avec ton fichier d'origine : token du versement      ║
// ║    enregistré dans token_1..token_4 comme avant.                 ║
// ╚══════════════════════════════════════════════════════════════════╝

const FRAIS_MDM = 10000;      // frais MDM ajoutés à l'acompte (versement 1)
const NB_VERSEMENTS = 4;      // 1 acompte + 3 mensualités

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  // ── 1. Lecture et validation du body ─────────────────────────
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const dossier_id = String(body.dossier_id || "").trim();
  const n = parseInt(body.numero_versement, 10);

  if (!/^CRED-[A-Za-z0-9_-]{4,40}$/.test(dossier_id))
    return new Response(JSON.stringify({ error: "dossier_id invalide" }), { status: 400, headers: CORS });

  if (![1, 2, 3, 4].includes(n))
    return new Response(JSON.stringify({ error: "numero_versement invalide (1 à " + NB_VERSEMENTS + ")" }), { status: 400, headers: CORS });

  // ── 2. Environnement ─────────────────────────────────────────
  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const MASTER_KEY  = env.PAYDUNYA_MASTER_KEY;
  const PRIVATE_KEY = env.PAYDUNYA_PRIVATE_KEY;
  const TOKEN       = env.PAYDUNYA_TOKEN;
  const MODE        = env.PAYDUNYA_MODE || "live";

  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });
  if (!MASTER_KEY || !PRIVATE_KEY || !TOKEN)
    return new Response(JSON.stringify({ error: "Clés PayDunya manquantes" }), { status: 500, headers: CORS });

  // ── 3. Charger le dossier (source de vérité des montants) ────
  let dossier = null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}` +
      `&select=dossier_id,client_nom,client_tel,client_email,appareil,statut_compte,` +
      `montant_1,montant_2,montant_3,montant_4,paye_1,paye_2,paye_3,paye_4,` +
      `echeance_1,echeance_2,echeance_3,echeance_4`,
      { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    );
    const rows = await res.json();
    if (rows && rows[0]) dossier = rows[0];
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur Supabase", details: e.message }), { status: 500, headers: CORS });
  }

  if (!dossier)
    return new Response(JSON.stringify({ error: "Dossier introuvable" }), { status: 404, headers: CORS });

  if (dossier.statut_compte !== "valide")
    return new Response(JSON.stringify({
      error: dossier.statut_compte === "solde"
        ? "Ce crédit est déjà entièrement réglé 🎉"
        : "Ce dossier n'est pas encore payable (statut : " + (dossier.statut_compte || "inconnu") + ")"
    }), { status: 400, headers: CORS });

  // ── 4. Vérifications du versement demandé ────────────────────
  if (dossier[`paye_${n}`])
    return new Response(JSON.stringify({ error: "Ce versement est déjà réglé ✅" }), { status: 400, headers: CORS });

  // Ordre imposé : tous les versements précédents doivent être payés
  for (let i = 1; i < n; i++) {
    const mPrec = dossier[`montant_${i}`];
    if (mPrec !== null && mPrec !== undefined && !dossier[`paye_${i}`]) {
      return new Response(JSON.stringify({ error: `Réglez d'abord le versement ${i}.` }), { status: 400, headers: CORS });
    }
  }

  const base = Number(dossier[`montant_${n}`] || 0);
  if (!(base > 0))
    return new Response(JSON.stringify({
      error: n === 4
        ? "Montant du versement 4 introuvable — exécutez la migration SQL (montant_4) sur ce dossier."
        : "Montant du versement introuvable pour ce dossier."
    }), { status: 400, headers: CORS });

  const montant = n === 1 ? base + FRAIS_MDM : base;

  // ── 5. Créer la facture PayDunya (montant 100% serveur) ──────
  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  const SITE_URL = env.COMPANY_WEBSITE || "https://sdsprotech.com";
  const commande_id = `${dossier_id}-${n}`; // ⚠️ format attendu par paydunya-ipn (CRED-xxxx-N)
  const libelle = `${dossier.appareil || "Téléphone"} — Versement ${n}/${NB_VERSEMENTS}` +
                  (n === 1 ? " (acompte + frais MDM)" : " (mensualité)");

  const payload = {
    invoice: {
      items: {
        item_0: {
          name: libelle,
          quantity: 1,
          unit_price: montant,
          total_price: montant,
          description: `Crédit ${dossier_id} — versement ${n}/${NB_VERSEMENTS}`
        }
      },
      taxes: {},
      total_amount: montant,
      description: `Crédit ${dossier_id} — ${dossier.client_nom || "Client"} — versement ${n}`
    },
    store: {
      name: env.COMPANY_NAME || "SDS ProTech",
      tagline: "Achat échelonné halal · Dakar",
      phone: env.COMPANY_PHONE || "",
      postal_address: "Pikine, Dakar, Sénégal",
      website_url: SITE_URL,
      logo_url: SITE_URL + "/logo.png"
    },
    actions: {
      cancel_url:   SITE_URL + "/mon-credit.html?statut=annule",
      return_url:   SITE_URL + "/mon-credit.html?statut=succes",
      callback_url: "https://sdsprotech-backend.pages.dev/paydunya-ipn"
    },
    custom_data: {
      commande_id,
      dossier_id,
      numero_versement: n,
      client_nom: dossier.client_nom || "",
      client_tel: dossier.client_tel || "",
      client_email: dossier.client_email || ""
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

  // ── 6. Enregistrer le token du versement dans le dossier ────
  if (result.token) {
    const patch = {};
    patch[`token_${n}`] = result.token; // colonnes token_1..token_4
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
    success: true,
    payment_url: result.response_text, // URL fournie par PayDunya — la seule valide
    token: result.token,
    versement: n,
    montant,
    commande_id
  }), { status: 200, headers: CORS });
}
