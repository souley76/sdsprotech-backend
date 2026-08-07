// ============================================================================
//  SDS PRO - PAYOUT AUTOMATIQUE VERS LE PARTENAIRE (PayDunya Disbursement)
//
//  A greffer dans paydunya-ipn.js : au moment ou une commande passe a "PAID"
//  parce que PayDunya a CONFIRME le paiement (cas normal, ni FORM- ni CRED-),
//  appeler declencherPayout(commande_id, env).
//
//  Modele : le client paie -> l'argent arrive sur le compte SDS PRO ;
//  on preleve la commission ; le net part vers le numero mobile money du
//  partenaire. Declenche sur la confirmation REELLE PayDunya (ce webhook),
//  jamais sur le clic "confirmer paye" du partenaire.
//
//  PREREQUIS dashboard PayDunya :
//    1. Activer l'API Disbursement.
//    2. Variables d'env du Worker : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY,
//       PAYDUNYA_TOKEN, PAYDUNYA_MODE ("live" ou "test").
//    3. Solde SDS PRO suffisant (l'argent part de ton compte).
// ============================================================================

function baseDisburse(env) {
  const mode = (env.PAYDUNYA_MODE || 'live').toLowerCase();
  return mode === 'test'
    ? 'https://app.sandbox.paydunya.com/api/v2/disburse'
    : 'https://app.paydunya.com/api/v2/disburse';
}

function entetesPayDunya(env) {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': env.PAYDUNYA_MASTER_KEY,
    'PAYDUNYA-PRIVATE-KEY': env.PAYDUNYA_PRIVATE_KEY,
    'PAYDUNYA-TOKEN': env.PAYDUNYA_TOKEN,
  };
}

async function sbSelect(env, chemin) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const txt = await res.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (_) {}
  if (!res.ok) throw new Error(`SELECT ${chemin}: ${res.status} ${txt}`);
  return data;
}

async function sbRpc(env, nom, params) {
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
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (_) {}
  if (!res.ok) throw new Error(`RPC ${nom}: ${res.status} ${txt}`);
  return data;
}

// ----------------------------------------------------------------------------
//  POINT D'ENTREE : commande_id (texte) de la commande qui vient d'etre payee
// ----------------------------------------------------------------------------
export async function declencherPayout(commande_id, env) {
  if (!commande_id) return { skip: true, raison: 'commande_id absent' };

  // 1) Retrouver la commande : boutique_id + montant.
  const cible = encodeURIComponent(commande_id);
  const rows = await sbSelect(
    env,
    `orders?commande_id=eq.${cible}&select=id,commande_id,amount,prix,boutique_id,status`
  );
  const order = Array.isArray(rows) ? rows[0] : rows;
  if (!order) return { skip: true, raison: 'commande introuvable' };

  // Pas de boutique -> commande SDS PRO en propre : aucun payout.
  if (!order.boutique_id) return { skip: true, raison: 'commande SDS PRO en propre' };

  // 2) Preparer la ligne de payout (commission + net).
  const prep = await sbRpc(env, 'rpc_preparer_payout', { p_order_id: order.id });
  const p = Array.isArray(prep) ? prep[0] : prep;
  if (!p) throw new Error('Payout non prepare');
  if (p.statut === 'envoye') return { deja: true };

  // 3) Verifications avant de sortir de l'argent.
  if (!p.payout_numero) {
    await sbRpc(env, 'rpc_resultat_payout', {
      p_payout_id: p.id, p_statut: 'echoue',
      p_erreur: 'Aucun numero de versement configure pour cette boutique',
    });
    return { echec: true, raison: 'numero manquant' };
  }
  if (Number(p.montant_net) <= 0) {
    await sbRpc(env, 'rpc_resultat_payout', {
      p_payout_id: p.id, p_statut: 'echoue',
      p_erreur: 'Montant net nul ou negatif',
    });
    return { echec: true, raison: 'montant net invalide' };
  }

  // 4) Verser via PayDunya Disbursement.
  try {
    const corps = {
      account_alias: p.payout_numero,
      amount: Math.round(Number(p.montant_net)),
      withdraw_mode: p.payout_operateur || 'orange-money-senegal',
      callback_url: env.PAYOUT_CALLBACK_URL || '',
    };

    const res = await fetch(`${baseDisburse(env)}/get-invoice`, {
      method: 'POST',
      headers: entetesPayDunya(env),
      body: JSON.stringify(corps),
    });
    const data = await res.json();

    const ok = data && (data.status === 'success' || data.success === true
                        || data.response_code === '00');
    if (ok) {
      await sbRpc(env, 'rpc_resultat_payout', {
        p_payout_id: p.id, p_statut: 'envoye',
        p_disburse_id: String(data.disburse_id || data.transaction_id || ''),
        p_disburse_token: String(data.token || ''),
      });
      return { envoye: true, montant: p.montant_net };
    } else {
      await sbRpc(env, 'rpc_resultat_payout', {
        p_payout_id: p.id, p_statut: 'echoue',
        p_erreur: (data && (data.message || data.response_text)) || 'Refus PayDunya',
      });
      return { echec: true, raison: data && data.message };
    }
  } catch (e) {
    await sbRpc(env, 'rpc_resultat_payout', {
      p_payout_id: p.id, p_statut: 'echoue', p_erreur: String(e.message),
    });
    return { echec: true, raison: e.message };
  }
}

// ----------------------------------------------------------------------------
//  INTEGRATION dans paydunya-ipn.js (cas normal, apres passage a "PAID") :
//
//    if (internalStatus === "PAID" && commande_id) {
//      try {
//        const { declencherPayout } = await import('./payout-partenaire.js');
//        await declencherPayout(commande_id, env);
//      } catch (e) { console.error('Payout:', e.message); }
//    }
// ----------------------------------------------------------------------------
