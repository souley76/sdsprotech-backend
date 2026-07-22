import { CORS_HEADERS, handleOptions } from "../_helpers";

// ╔══════════════════════════════════════════════════════════════════╗
// ║ PAYDUNYA-PAY — VERSION CORRIGÉE                                  ║
// ║ ✅ FAILLE CORRIGÉE : "total_fallback" supprimé. Avant, si le     ║
// ║    prix n'était pas vérifiable, on acceptait le montant envoyé   ║
// ║    par le client → un attaquant pouvait payer 1 000 FCFA pour    ║
// ║    un iPhone. Maintenant : prix invérifiable = refus.            ║
// ║ ✅ FAILLE CORRIGÉE : les commande_id "CRED-" et "FORM-" sont     ║
// ║    bloqués ici. Avant, un attaquant pouvait forger un            ║
// ║    commande_id CRED-xxx-2, payer une petite somme, et l'IPN      ║
// ║    marquait son versement crédit payé + déverrouillait le tel.   ║
// ║ ✅ _debug (clés, corps des réponses Supabase) retiré des         ║
// ║    réponses envoyées au client.                                  ║
// ║ ✅ commande_id validé + encodé dans les URLs Supabase.           ║
// ╚══════════════════════════════════════════════════════════════════╝

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
    articles, return_url, cancel_url,
    produit_id, storage, color, qty, charger,
    cart_items
  } = body;

  const commande_id = String(body.commande_id || "").trim();

  if (!client_nom || !client_tel || !commande_id)
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: CORS });

  // ✅ Format strict du commande_id (évite l'injection dans les filtres PostgREST)
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(commande_id))
    return new Response(JSON.stringify({ error: "commande_id invalide" }), { status: 400, headers: CORS });

  // ✅ Préfixes réservés : le crédit passe par /credit-checkout,
  //    les formations par leur propre tunnel. Jamais par ici.
  if (/^(CRED|FORM)-/i.test(commande_id))
    return new Response(JSON.stringify({ error: "Ce type de commande passe par son propre canal de paiement." }), { status: 400, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  // Valide qu'une valeur est un entier positif (ID Supabase). Retourne null sinon.
  const toPosInt = (val) => {
    const n = parseInt(val, 10);
    return (Number.isInteger(n) && n > 0 && String(n) === String(val).trim()) ? n : null;
  };

  // ── Recalcul du prix CÔTÉ SERVEUR depuis Supabase ────────────
  let montant = 0;

  // ── CAS 1 : Panier multi-produits (cart_items) — accessoires ET/OU ordinateurs ───
  if (Array.isArray(cart_items) && cart_items.length > 0 && SUPA_URL && SUPA_KEY) {
    try {
      // Regrouper les items par table d'origine (products / accessoires / ordinateurs)
      const allowedTables = ['products', 'accessoires', 'ordinateurs'];
      const byTable = {};
      for (const item of cart_items) {
        const table = allowedTables.includes(item.table) ? item.table : 'accessoires';
        (byTable[table] = byTable[table] || []).push(item);
      }

      for (const table of Object.keys(byTable)) {
        const items = byTable[table];
        // Ne garder que les produit_id valides (entiers positifs)
        const validItems = items
          .map(i => ({ ...i, produit_id: toPosInt(i.produit_id) }))
          .filter(i => i.produit_id !== null);
        const ids = [...new Set(validItems.map(i => i.produit_id))];
        if (ids.length === 0) continue;

        // products a des variantes (prix par stockage/couleur), pas les autres tables
        const selectCols = (table === 'products') ? 'id,prix,variantes' : 'id,prix';
        const res = await fetch(
          `${SUPA_URL}/rest/v1/${table}?id=in.(${ids.join(',')})&select=${selectCols}`,
          { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
        );
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          for (const item of validItems) {
            const row = rows.find(r => r.id === item.produit_id);
            if (!row) continue;
            const qtyNum = Math.max(1, Math.min(10, parseInt(item.qty) || 1));
            let prixUnit = row.prix || 0;

            // Prix de variante (iPhone : stockage/couleur)
            if (table === 'products') {
              const variantes = Array.isArray(row.variantes) ? row.variantes
                : (row.variantes ? (()=>{ try{return JSON.parse(row.variantes);}catch(_){return [];} })() : []);
              if (variantes.length > 0 && (item.storage || item.color)) {
                let v = null;
                if (item.storage && item.color)
                  v = variantes.find(x => x.stockage === item.storage && x.couleur === item.color);
                if (!v && item.storage)
                  v = variantes.find(x => x.stockage === item.storage);
                if (v && v.prix) prixUnit = v.prix;
              }
              // Supplément chargeur éventuel
              if (item.charger) prixUnit += 15000;
            }

            montant += prixUnit * qtyNum;
          }
        }
      }
    } catch(e) {
      console.error("Cart prix lookup error:", e.message);
    }
  }

  // ── CAS 2 : Produit unique iPhone (produit_id) ───────────────
  const produitIdNum = toPosInt(produit_id);
  if (montant <= 0 && produitIdNum && SUPA_URL && SUPA_KEY) {
    try {
      const prodRes = await fetch(
        `${SUPA_URL}/rest/v1/products?id=eq.${produitIdNum}&select=prix,variantes`,
        { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
      );
      const prods = await prodRes.json();
      if (prods && prods[0]) {
        const prod = prods[0];
        const variantes = Array.isArray(prod.variantes) ? prod.variantes : [];
        let prixBase = prod.prix || 0;

        if (variantes.length > 0 && (storage || color)) {
          let variante = null;
          if (storage && color)
            variante = variantes.find(v => v.stockage === storage && v.couleur === color);
          if (!variante && storage)
            variante = variantes.find(v => v.stockage === storage);
          if (variante && variante.prix)
            prixBase = variante.prix;
        }

        const qtyNum     = Math.max(1, Math.min(10, parseInt(qty) || 1));
        const chargerAmt = charger ? 15000 * qtyNum : 0;
        montant = prixBase * qtyNum + chargerAmt;
      } else {
        // Chercher dans accessoires puis ordinateurs (produit unique)
        for (const table of ['accessoires', 'ordinateurs']) {
          const accRes = await fetch(
            `${SUPA_URL}/rest/v1/${table}?id=eq.${produitIdNum}&select=prix`,
            { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
          );
          const accs = await accRes.json();
          if (accs && accs[0]) {
            const qtyNum = Math.max(1, Math.min(10, parseInt(qty) || 1));
            montant = accs[0].prix * qtyNum;
            break;
          }
        }
      }
    } catch(e) {
      console.error("Prix lookup error:", e.message);
    }
  }

  // ── ✅ Plus de fallback client : prix invérifiable = refus ───
  if (montant <= 0) {
    return new Response(JSON.stringify({
      error: "Impossible de vérifier le prix de la commande. Actualisez la page et réessayez."
    }), { status: 400, headers: CORS });
  }

  // ── 1. Enregistrer la commande AVANT PayDunya ─────────────────
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
      if (!supaRes.ok) console.error("Orders insert error:", supaRes.status, await supaRes.text());
    } catch (e) {
      console.error("Orders insert exception:", e.message);
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
    return new Response(JSON.stringify({ error: "Connexion PayDunya échouée", details: err.message }), { status: 500, headers: CORS });
  }

  const result = await pdRes.json();

  if (!pdRes.ok || result.response_code !== "00")
    return new Response(JSON.stringify({ error: "Erreur PayDunya", details: result }), { status: 400, headers: CORS });

  // ── 3. Mettre à jour le token PayDunya dans la commande ───────
  if (SUPA_URL && SUPA_KEY && result.token) {
    try {
      await fetch(`${SUPA_URL}/rest/v1/orders?commande_id=eq.${encodeURIComponent(commande_id)}`, {
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
    token:       result.token
  }), { status: 200, headers: CORS });
}
