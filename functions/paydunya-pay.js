import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  const MASTER_KEY = env.PAYDUNYA_MASTER_KEY;
  const PRIVATE_KEY = env.PAYDUNYA_PRIVATE_KEY;
  const TOKEN = env.PAYDUNYA_TOKEN;
  const MODE = env.PAYDUNYA_MODE || "live";

  if (!MASTER_KEY || !PRIVATE_KEY || !TOKEN) {
    return new Response(JSON.stringify({ error: "Clés PayDunya manquantes" }), { status: 500, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS });
  }

  const {
    client_nom,
    client_tel,
    client_email,
    client_address,
    user_id,
    articles,
    return_url,
    cancel_url,
    produit_id,
    storage,
    color,
    qty,
    charger,
    icloud,
    boutique_id,
    cart_items,
    items, // alias front React
  } = body;

  const LIVRAISON = 10000;
  const CHARGEUR = 15000;
  const ICLOUD = 5000;

  const commande_id = String(body.commande_id || "").trim();
  if (!client_nom || !client_tel || !commande_id) {
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: CORS });
  }
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(commande_id)) {
    return new Response(JSON.stringify({ error: "commande_id invalide" }), { status: 400, headers: CORS });
  }
  if (/^(CRED|FORM)-/i.test(commande_id)) {
    return new Response(
      JSON.stringify({ error: "Ce type de commande passe par son propre canal de paiement." }),
      { status: 400, headers: CORS }
    );
  }

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  const toPosInt = (val) => {
    const n = parseInt(val, 10);
    return Number.isInteger(n) && n > 0 && String(n) === String(val).trim() ? n : null;
  };

  // Normaliser panier : cart_items OU items (React)
  const rawCart = Array.isArray(cart_items) && cart_items.length
    ? cart_items
    : Array.isArray(items) && items.length
      ? items
      : null;

  let montant = 0;
  let hasIcloud = false;
  let hasCharger = false;

  // ── CAS 1 : panier multi ─────────────────────────────────────
  if (rawCart && SUPA_URL && SUPA_KEY) {
    try {
      const allowedTables = ["products", "accessoires", "ordinateurs"];
      const byTable = {};

      for (const item of rawCart) {
        const table = allowedTables.includes(item.table)
          ? item.table
          : "products";
        (byTable[table] = byTable[table] || []).push(item);
      }

      for (const table of Object.keys(byTable)) {
        const list = byTable[table];
        const validItems = list
          .map((i) => ({
            ...i,
            produit_id: toPosInt(i.produit_id ?? i.id),
          }))
          .filter((i) => i.produit_id !== null);

        const ids = [...new Set(validItems.map((i) => i.produit_id))];
        if (!ids.length) continue;

        const selectCols = table === "products" ? "id,prix,variantes" : "id,prix";
        const res = await fetch(
          `${SUPA_URL}/rest/v1/${table}?id=in.(${ids.join(",")})&select=${selectCols}`,
          {
            headers: {
              apikey: SUPA_KEY,
              Authorization: "Bearer " + SUPA_KEY,
            },
          }
        );
        const rows = await res.json();
        if (!Array.isArray(rows) || !rows.length) continue;

        for (const item of validItems) {
          const row = rows.find((r) => r.id === item.produit_id);
          if (!row) continue;

          const qtyNum = Math.max(1, Math.min(10, parseInt(item.qty) || 1));
          let prixUnit = row.prix || 0;

          if (table === "products") {
            let variantes = [];
            if (Array.isArray(row.variantes)) variantes = row.variantes;
            else if (row.variantes) {
              try {
                variantes = JSON.parse(row.variantes);
              } catch (_) {
                variantes = [];
              }
            }

            const st = item.storage || item.stockage || null;
            const col = item.color || item.couleur || null;

            if (variantes.length && (st || col)) {
              let v = null;
              if (st && col) v = variantes.find((x) => x.stockage === st && x.couleur === col);
              if (!v && st) v = variantes.find((x) => x.stockage === st);
              if (v && v.prix) prixUnit = v.prix;
            }

            if (item.charger) {
              prixUnit += CHARGEUR;
              hasCharger = true;
            }
            if (item.icloud) {
              prixUnit += ICLOUD;
              hasIcloud = true;
            }
          }

          montant += prixUnit * qtyNum;
        }
      }
    } catch (e) {
      console.error("Cart prix lookup error:", e.message);
    }
  }

  // ── CAS 2 : produit unique ───────────────────────────────────
  const produitIdNum = toPosInt(produit_id);
  if (montant <= 0 && produitIdNum && SUPA_URL && SUPA_KEY) {
    try {
      const prodRes = await fetch(
        `${SUPA_URL}/rest/v1/products?id=eq.${produitIdNum}&select=prix,variantes`,
        {
          headers: {
            apikey: SUPA_KEY,
            Authorization: "Bearer " + SUPA_KEY,
          },
        }
      );
      const prods = await prodRes.json();

      if (prods && prods[0]) {
        const prod = prods[0];
        let variantes = Array.isArray(prod.variantes) ? prod.variantes : [];
        let prixBase = prod.prix || 0;

        if (variantes.length && (storage || color)) {
          let variante = null;
          if (storage && color)
            variante = variantes.find((v) => v.stockage === storage && v.couleur === color);
          if (!variante && storage)
            variante = variantes.find((v) => v.stockage === storage);
          if (variante && variante.prix) prixBase = variante.prix;
        }

        const qtyNum = Math.max(1, Math.min(10, parseInt(qty) || 1));
        const chargerAmt = charger ? CHARGEUR * qtyNum : 0;
        const icloudAmt = icloud ? ICLOUD * qtyNum : 0;
        if (charger) hasCharger = true;
        if (icloud) hasIcloud = true;
        montant = prixBase * qtyNum + chargerAmt + icloudAmt;
      } else {
        for (const table of ["accessoires", "ordinateurs"]) {
          const accRes = await fetch(
            `${SUPA_URL}/rest/v1/${table}?id=eq.${produitIdNum}&select=prix`,
            {
              headers: {
                apikey: SUPA_KEY,
                Authorization: "Bearer " + SUPA_KEY,
              },
            }
          );
          const accs = await accRes.json();
          if (accs && accs[0]) {
            const qtyNum = Math.max(1, Math.min(10, parseInt(qty) || 1));
            montant = accs[0].prix * qtyNum;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Prix lookup error:", e.message);
    }
  }

  // Livraison Dakar (fixe si commande valide)
  if (montant > 0) montant += LIVRAISON;

  if (montant <= 0) {
    return new Response(
      JSON.stringify({
        error: "Impossible de vérifier le prix de la commande. Actualisez la page et réessayez.",
      }),
      { status: 400, headers: CORS }
    );
  }

  // ── Insert order ─────────────────────────────────────────────
  if (SUPA_URL && SUPA_KEY) {
    try {
      const supaRes = await fetch(SUPA_URL + "/rest/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPA_KEY,
          Authorization: "Bearer " + SUPA_KEY,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          commande_id,
          client_name: client_nom,
          user_name: client_nom,
          user_email: client_email || null,
          phone: client_tel,
          telephone: client_tel,
          user_id: user_id || null,
          address: client_address || null,
          adresse: client_address || null,
          product: articles || "",
          produit: articles || "",
          amount: montant,
          total: montant,
          prix: montant,
          currency: "XOF",
          operator: "PayDunya",
          paiement: "PayDunya",
          status: "en_attente",
          paydunya_status: "PENDING",
          boutique_id: boutique_id || null,
          created_at: new Date().toISOString(),
        }),
      });
      if (!supaRes.ok) console.error("Orders insert error:", supaRes.status, await supaRes.text());
    } catch (e) {
      console.error("Orders insert exception:", e.message);
    }
  }

  // ── PayDunya ─────────────────────────────────────────────────
  const BASE_URL =
    MODE === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";
  const SITE_URL = env.COMPANY_WEBSITE || "https://sdsprotech.com";

  const payload = {
    invoice: {
      items: {
        item_0: {
          name: articles || "Commande SDS ProTech",
          quantity: 1,
          unit_price: montant,
          total_price: montant,
          description: `Commande #${commande_id}`,
        },
      },
      taxes: {},
      total_amount: montant,
      description: `Commande #${commande_id} — ${client_nom}`,
    },
    store: {
      name: env.COMPANY_NAME || "SDS ProTech",
      tagline: "Boutique smartphones Dakar",
      phone: env.COMPANY_PHONE || "",
      postal_address: "Dakar, Sénégal",
      website_url: SITE_URL,
      logo_url: SITE_URL + "/logo.png",
    },
    actions: {
      cancel_url:
        cancel_url || SITE_URL + "/panier?commande=" + commande_id + "&statut=annule",
      return_url:
        return_url || SITE_URL + "/mes-commandes?commande=" + commande_id + "&statut=succes",
      callback_url: "https://sdsprotech-backend.pages.dev/paydunya-ipn",
    },
    custom_data: {
      commande_id,
      client_nom,
      client_tel,
      client_email: client_email || "",
      client_address: client_address || "",
      boutique_id: boutique_id || "",
      has_charger: hasCharger,
      has_icloud: hasIcloud,
    },
  };

  let pdRes;
  try {
    pdRes = await fetch(`${BASE_URL}/checkout-invoice/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": MASTER_KEY,
        "PAYDUNYA-PRIVATE-KEY": PRIVATE_KEY,
        "PAYDUNYA-TOKEN": TOKEN,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Connexion PayDunya échouée", details: err.message }),
      { status: 500, headers: CORS }
    );
  }

  const result = await pdRes.json();
  if (!pdRes.ok || result.response_code !== "00") {
    return new Response(JSON.stringify({ error: "Erreur PayDunya", details: result }), {
      status: 400,
      headers: CORS,
    });
  }

  if (SUPA_URL && SUPA_KEY && result.token) {
    try {
      await fetch(
        `${SUPA_URL}/rest/v1/orders?commande_id=eq.${encodeURIComponent(commande_id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPA_KEY,
            Authorization: "Bearer " + SUPA_KEY,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            paydunya_token: result.token,
            payment_url: result.response_text || null,
          }),
        }
      );
    } catch (e) {}
  }

  return new Response(
    JSON.stringify({
      success: true,
      payment_url: result.response_text,
      token: result.token,
      montant,
    }),
    { status: 200, headers: CORS }
  );
}
