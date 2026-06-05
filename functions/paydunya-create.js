// fonctions/paydunya-create.js
// Cloudflare Pages Function — appelée par accessoires.html
// Les clés PayDunya sont lues depuis les variables d'environnement Cloudflare
// (jamais exposées dans le code frontend)

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS — autoriser sdsprotech.com
  const headers = {
    'Access-Control-Allow-Origin': 'https://sdsprotech.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();
    const { nom, phone, email, adresse, items, total } = body;

    // Validation basique
    if (!nom || !phone || !adresse || !items?.length) {
      return new Response(JSON.stringify({ ok: false, error: 'Champs manquants' }), { status: 400, headers });
    }

    // Formater le numéro : s'assurer qu'il commence par 221
    const phoneFormatted = phone.replace(/\s/g, '').replace(/^(\+221|00221)/, '').replace(/^0/, '');
    const phoneIntl = '221' + phoneFormatted;

    // Construire le payload PayDunya
    const payload = {
      invoice: {
        total_amount: total,
        description: `Commande Accessoires SDS PRO — ${nom}`,
      },
      store: {
        name: 'SDS PRO',
        tagline: 'Smartphones & Accessoires Premium Dakar',
        phone: '221770699739',
        postal_address: 'Petit Mbao, Dakar, Sénégal',
        return_url:   'https://sdsprotech.com/merci.html',
        cancel_url:   'https://sdsprotech.com/accessoires.html',
        callback_url: 'https://sdsprotech.com/fonctions/paydunya-callback',
        logo_url:     'https://sdsprotech.com/logo-sds.png',
      },
      customer: {
        name:  nom,
        phone: phoneIntl,
        email: email || 'client@sdsprotech.com',
      },
      // Détail des articles
      items: Object.fromEntries(
        items.map((item, i) => [
          String(i),
          {
            name:        item.nom,
            quantity:    item.qty,
            unit_price:  item.prix,
            total_price: item.prix * item.qty,
            description: item.categorie || 'Accessoire',
          }
        ])
      ),
      custom_data: {
        adresse_livraison: adresse,
        source: 'accessoires.html',
      },
    };

    // Appel API PayDunya
    const pdRes = await fetch('https://app.paydunya.com/api/v1/checkout-invoice/create', {
      method: 'POST',
      headers: {
        'Content-Type':          'application/json',
        'PAYDUNYA-MASTER-KEY':   env.PAYDUNYA_MASTER_KEY,
        'PAYDUNYA-PRIVATE-KEY':  env.PAYDUNYA_PRIVATE_KEY,
        'PAYDUNYA-TOKEN':        env.PAYDUNYA_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const pdData = await pdRes.json();

    if (pdData.response_code === '00' && pdData.invoice_url) {
      return new Response(JSON.stringify({
        ok:          true,
        invoice_url: pdData.invoice_url,
        token:       pdData.token,
      }), { status: 200, headers });
    } else {
      return new Response(JSON.stringify({
        ok:    false,
        error: pdData.response_text || 'Erreur PayDunya',
        raw:   pdData,
      }), { status: 200, headers });
    }

  } catch (err) {
    return new Response(JSON.stringify({
      ok:    false,
      error: err.message,
    }), { status: 500, headers });
  }
}

// Répondre aux preflight CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  'https://sdsprotech.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
