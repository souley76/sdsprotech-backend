// ============================================================================
//  SDS PRO - PAYOUT AUTOMATIQUE VERS LE PARTENAIRE (PayDunya Disbursement)
//
//  A GREFFER sur ton webhook de paiement : au moment OU une commande passe
//  a "paye" parce que PayDunya a CONFIRME le paiement (pas le clic du
//  partenaire), appelle declencherPayout(orderId, env).
//
//  Pourquoi lie a la confirmation PayDunya et pas au clic du partenaire :
//  sinon un partenaire pourrait cliquer "paye" sur une commande jamais
//  reglee et declencher un virement depuis TON solde. La confirmation
//  PayDunya prouve que l'argent est bien arrive chez toi.
//
//  PREREQUIS (a faire dans ton dashboard PayDunya) :
//    1. Activer l'API Disbursement (Integration API > ton application).
//    2. Recuperer les 3 cles et les mettre en variables d'environnement
//       du Worker : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN.
//    3. Garder un solde suffisant : l'argent part de ton compte SDS PRO.
// ============================================================================

const PAYDUNYA_BASE = 'https://app.paydunya.com/api/v2/disburse';

function entetesPayDunya(env) {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': env.PAYDUNYA_MASTER_KEY,
    'PAYDUNYA-PRIVATE-KEY': env.PAYDUNYA_PRIVATE_KEY,
    'PAYDUNYA-TOKEN': env.PAYDUNYA_TOKEN,
  };
}

// Appel Supabase RPC en service_role
async function rpc(env, nom, params) {
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
//  POINT D'ENTREE : a appeler quand une commande est confirmee payee
// ----------------------------------------------------------------------------
export async function declencherPayout(orderId, env) {
  // 1) Preparer le payout (calcule commission + net, cree la ligne en_attente).
  //    Si la commande n'a pas de boutique, rpc_preparer_payout leve une erreur
  //    -> on l'ignore silencieusement (commande SDS PRO en propre).
  let payout;
  try {
    payout = await rpc(env, 'rpc_preparer_payout', { p_order_id: orderId });
  } catch (e) {
    if (String(e.message).includes('sans boutique')) {
      return { skip: true, raison: 'commande SDS PRO en propre' };
    }
    throw e;
  }
  // rpc_preparer_payout renvoie l'objet (ou un tableau selon PostgREST)
  const p = Array.isArray(payout) ? payout[0] : payout;
  if (!p) throw new Error('Payout non prepare');

  // Deja verse ? on ne rejoue pas.
  if (p.statut === 'envoye') return { deja: true, payout: p };

  // 2) Verifications avant de sortir de l'argent
  if (!p.payout_numero) {
    await rpc(env, 'rpc_resultat_payout', {
      p_payout_id: p.id, p_statut: 'echoue',
      p_erreur: 'Aucun numero de versement configure pour cette boutique',
    });
    return { echec: true, raison: 'numero manquant' };
  }
  if (Number(p.montant_net) <= 0) {
    await rpc(env, 'rpc_resultat_payout', {
      p_payout_id: p.id, p_statut: 'echoue',
      p_erreur: 'Montant net nul ou negatif',
    });
    return { echec: true, raison: 'montant net invalide' };
  }

  // 3) Appel PayDunya Disbursement
  try {
    // 3a. (optionnel mais prudent) verifier le solde avant d'envoyer
    //     -> on tente l'envoi directement ; PayDunya refuse si solde insuffisant.

    const corps = {
      account_alias: p.payout_numero,          // numero mobile money du partenaire
      amount: Math.round(Number(p.montant_net)),
      withdraw_mode: p.payout_operateur || 'orange-money-senegal',
      callback_url: env.PAYOUT_CALLBACK_URL || '',
    };

    const res = await fetch(`${PAYDUNYA_BASE}/get-invoice`, {
      method: 'POST',
      headers: entetesPayDunya(env),
      body: JSON.stringify(corps),
    });
    const data = await res.json();

    // La reponse PayDunya Disbursement contient status/disburse_id/token
    const ok = data && (data.status === 'success' || data.success === true);
    if (ok) {
      await rpc(env, 'rpc_resultat_payout', {
        p_payout_id: p.id, p_statut: 'envoye',
        p_disburse_id: String(data.disburse_id || data.transaction_id || ''),
        p_disburse_token: String(data.token || ''),
      });
      return { envoye: true, montant: p.montant_net, disburse_id: data.disburse_id };
    } else {
      await rpc(env, 'rpc_resultat_payout', {
        p_payout_id: p.id, p_statut: 'echoue',
        p_erreur: (data && (data.message || data.response_text)) || 'Refus PayDunya',
      });
      return { echec: true, raison: data && data.message };
    }
  } catch (e) {
    // Panne reseau / exception : on marque echoue, tu pourras rejouer.
    await rpc(env, 'rpc_resultat_payout', {
      p_payout_id: p.id, p_statut: 'echoue', p_erreur: String(e.message),
    });
    return { echec: true, raison: e.message };
  }
}

// ----------------------------------------------------------------------------
//  EXEMPLE D'INTEGRATION dans ton webhook de paiement existant :
//
//    import { declencherPayout } from './payout-partenaire.js';
//
//    // ... dans le handler, APRES avoir confirme le paiement PayDunya et
//    //     passe la commande a "paye" :
//    if (paiementConfirmeParPayDunya) {
//      await updateOrderStatus(orderId, 'paye');
//      // Payout automatique (ne bloque pas la reponse au webhook)
//      ctx.waitUntil(declencherPayout(orderId, env));
//    }
// ----------------------------------------------------------------------------
