// ============================================================================
//  SDS PRO - VERSEMENT MANUEL A LA BOUTIQUE (declenche par le bouton admin)
//
//  Route Cloudflare : /verser-boutique  (POST)
//  Body : { order_id, note }  + en-tete Authorization Bearer <jwt admin>
//
//  Verifie que l'appelant est admin, que la livraison est confirmee, calcule
//  commission/net, envoie l'argent via PayDunya Disbursement vers le numero
//  mobile money de la boutique, puis journalise le resultat.
//
//  PREREQUIS (variables d'env du Worker) :
//    PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN, PAYDUNYA_MODE
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function baseDisburse(env) {
  const mode = (env.PAYDUNYA_MODE || 'live').toLowerCase();
  return mode === 'test'
    ? 'https://app.sandbox.paydunya.com/api/v2/disburse'
    : 'https://app.paydunya.com/api/v2/disburse';
}
function entetesPD(env) {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': env.PAYDUNYA_MASTER_KEY,
    'PAYDUNYA-PRIVATE-KEY': env.PAYDUNYA_PRIVATE_KEY,
    'PAYDUNYA-TOKEN': env.PAYDUNYA_TOKEN,
  };
}

async function sbSelect(env, chemin, jwt) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const txt = await res.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (_) {}
  if (!res.ok) throw new Error(`SELECT ${chemin}: ${res.status} ${txt}`);
  return d;
}

// Verifie que le JWT appartient a un admin SDS (via la RPC est_admin_sds)
async function estAdmin(env, jwt) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/est_admin_sds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${jwt}`,   // ← le JWT de l'utilisateur, pas la service key
    },
    body: '{}',
  });
  if (!res.ok) return false;
  const d = await res.json();
  return d === true;
}

async function sbRpcService(env, nom, params) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(params),
  });
  const txt = await res.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (_) {}
  if (!res.ok) throw new Error(`RPC ${nom}: ${res.status} ${txt}`);
  return d;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Methode non autorisee' }), { status: 405, headers: CORS });

  // 1) Authentification : JWT admin obligatoire
  const auth = request.headers.get('Authorization') || '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return new Response(JSON.stringify({ error: 'Non authentifie' }), { status: 401, headers: CORS });
  if (!(await estAdmin(env, jwt)))
    return new Response(JSON.stringify({ error: 'Reserve a l administration' }), { status: 403, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400, headers: CORS }); }
  const { order_id, note } = body;
  if (!order_id) return new Response(JSON.stringify({ error: 'order_id requis' }), { status: 400, headers: CORS });

  try {
    // 2) Recuperer commande + boutique
    const rows = await sbSelect(env,
      `orders?id=eq.${encodeURIComponent(order_id)}&select=id,amount,prix,boutique_id,livraison_confirmee,versement_statut`);
    const order = Array.isArray(rows) ? rows[0] : rows;
    if (!order) throw new Error('Commande introuvable');
    if (!order.boutique_id) throw new Error('Commande sans boutique');
    if (order.versement_statut === 'verse') throw new Error('Deja verse');
    if (!order.livraison_confirmee) throw new Error('Livraison non confirmee');

    const b = await sbSelect(env,
      `boutiques?id=eq.${order.boutique_id}&select=payout_numero,payout_operateur,commission_pct`);
    const boutique = Array.isArray(b) ? b[0] : b;
    if (!boutique || !boutique.payout_numero) throw new Error('Numero de versement non configure');

    const montant = Number(order.amount ?? order.prix ?? 0);
    const pct = Number(boutique.commission_pct ?? 10);
    const net = Math.round(montant - montant * pct / 100);
    if (net <= 0) throw new Error('Montant net invalide');

    // 3) Envoi PayDunya Disbursement
    const pdRes = await fetch(`${baseDisburse(env)}/get-invoice`, {
      method: 'POST',
      headers: entetesPD(env),
      body: JSON.stringify({
        account_alias: boutique.payout_numero,
        amount: net,
        withdraw_mode: boutique.payout_operateur || 'orange-money-senegal',
      }),
    });
    const pd = await pdRes.json();
    const ok = pd && (pd.status === 'success' || pd.success === true || pd.response_code === '00');
    if (!ok) throw new Error((pd && (pd.message || pd.response_text)) || 'Refus PayDunya');

    // 4) Marquer verse + journaliser (la RPC recalcule et enregistre le mouvement)
    await sbRpcService(env, 'rpc_verser_commande', { p_order_id: order_id, p_note: note || null });

    return new Response(JSON.stringify({
      success: true, net, disburse_id: pd.disburse_id || pd.transaction_id || null,
    }), { status: 200, headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: CORS });
  }
}
