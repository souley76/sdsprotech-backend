// fonctions/paydunya-create.js
// Cloudflare Pages Function — PayDunya checkout invoice

export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();
    const { nom, phone, email, adresse, items, total } = body;

    if (!nom || !phone || !adresse || !items?.length) {
      return new Response(JSON.stringify({ ok: false, error: 'Champs manquants' }), { status: 400, headers });
    }

    // Nettoyer le numéro : retirer espaces, +221, 00221, garder 9 chiffres
    const phoneClean = phone.replace(/\s/g, '').replace(/^(\+221|00221)/, '');
    const phoneIntl  = '221' + phoneClean;

    // URL selon mode test ou live
    // En test : https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create
    // En live  : https://app.paydunya.com/api/v1/checkout-invoice/create
    const isLive = env.PAYDUNYA_MODE === 'live';
    const apiUrl = isLive
      ? 'https://app.paydunya.com/api/v1/checkout-invoice/create'
      : 'https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create';

    const payload = {
      invoice: {
        total_amount: total,
        description:  `Commande Accessoires SDS PRO — ${nom}`,
      },
      store: {
        name:         'SDS PRO',
        tagline:      'Smartphones & Accessoires Dakar',
        phone:        '221770699739',
        postal_address: 'Petit Mbao, Dakar, Sénégal',
        return_url:   'https://sdsprotech.com/merci.html',
        cancel_url:   'https://sdsprotech.com/accessoires.html',
        callback_url: 'https://sdsprotech.com/fonctions/paydunya-ipn',
        logo_url:     'https://sdsprotech.com/logo-sds.png',
      },
      customer: {
        name:  nom,
        phone: phoneIntl,
        email: email || 'client@sdsprotech.com',
      },
      items: Object.fromEntries(
        items.map((item, i) => [String(i), {
          name:        item.nom,
          quantity:    item.qty,
          unit_price:  item.prix,
          total_price: item.prix * item.qty,
          description: item.categorie || 'Accessoire',
        }])
      ),
      custom_data: {
        adresse_livraison: adresse,
        source: 'accessoires.html',
      },
    };

    const pdRes = await fetch(apiUrl, {
      method:  'POST',
      headers: {
        'Content-Type':          'application/json',
        'PAYDUNYA-MASTER-KEY':   env.PAYDUNYA_MASTER_KEY,
        'PAYDUNYA-PRIVATE-KEY':  env.PAYDUNYA_PRIVATE_KEY,
        'PAYDUNYA-TOKEN':        env.PAYDUNYA_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const pdData = await pdRes.json();

    // Log pour debug dans Cloudflare
    console.log('PayDunya response:', JSON.stringify(pdData));

    if (pdData.response_code === '00' && pdData.invoice_url) {
      return new Response(JSON.stringify({
        ok:          true,
        invoice_url: pdData.invoice_url,
        token:       pdData.token,
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({
      ok:    false,
      error: pdData.response_text || 'Erreur PayDunya',
      code:  pdData.response_code,
      raw:   pdData,
    }), { status: 200, headers });

  } catch (err) {
    console.error('paydunya-create error:', err.message);
    return new Response(JSON.stringify({
      ok:    false,
      error: err.message,
    }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
