import { CORS_HEADERS, handleOptions } from "../_helpers";

// ╔══════════════════════════════════════════════════════════════════╗
// ║ CREDIT-CLIENT-ACTION — VERSION CORRIGÉE (4 versements)           ║
// ║ ✅ Reprise de crédit : acompte 50% + 3 mensualités,              ║
// ║    échéances provisoires J/J+30/J+60/J+90, token_4 réinitialisé  ║
// ║ ✅ Archivage credit_historique étendu (montant_4/paye_4/         ║
// ║    echeance_4 — colonnes ajoutées par la migration SQL)          ║
// ║ ✅ dossier_id moins devinable (suffixe aléatoire)                ║
// ║ ✅ Clé interne sur les appels credit-notify                      ║
// ║ L'authentification (token session + propriété du dossier)        ║
// ║ était déjà bien conçue : inchangée.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { action, dossier_id, access_token, produit_id } = body;

  if (!action || !dossier_id)
    return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: CORS });

  const SUPA_URL  = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY  = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const SUPA_ANON = (env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  const H_READ  = { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };
  const H_WRITE = { ...H_READ, "Content-Type": "application/json", "Prefer": "return=minimal" };
  // ✅ Clé interne pour credit-notify (anti-spam email)
  const H_NOTIFY = { "Content-Type": "application/json", "X-Internal-Key": (env.INTERNAL_KEY || "").trim() };

  // ── SÉCURITÉ : identifier le client via son token de session ──
  if (!access_token)
    return new Response(JSON.stringify({ error: "Non autorisé (token manquant)" }), { status: 401, headers: CORS });

  let clientUserId = null;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_ANON || SUPA_KEY, "Authorization": "Bearer " + access_token }
    });
    if (!userRes.ok)
      return new Response(JSON.stringify({ error: "Non autorisé (token invalide)" }), { status: 401, headers: CORS });
    const userData = await userRes.json();
    clientUserId = userData && userData.id;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification token", details: e.message }), { status: 500, headers: CORS });
  }
  if (!clientUserId)
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: CORS });

  // ── Charger le dossier et vérifier qu'il appartient à ce client ──
  const dossierUrl = `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`;
  let dossier = null;
  try {
    const res = await fetch(`${dossierUrl}&select=*`, { headers: H_READ });
    const rows = await res.json();
    if (rows && rows[0]) dossier = rows[0];
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur Supabase", details: e.message }), { status: 500, headers: CORS });
  }
  if (!dossier)
    return new Response(JSON.stringify({ error: "Dossier introuvable" }), { status: 404, headers: CORS });

  // Le dossier doit appartenir au client connecté
  if (dossier.user_id !== clientUserId)
    return new Response(JSON.stringify({ error: "Accès refusé (ce dossier ne vous appartient pas)" }), { status: 403, headers: CORS });

  // ════════════════════════════════════════════════════════════
  // ── ACTION : DEMANDER LA SUPPRESSION DES DOCUMENTS ──────────
  // ════════════════════════════════════════════════════════════
  if (action === "demander_suppression") {
    // Uniquement possible si le crédit est soldé
    if (dossier.statut_compte !== "solde")
      return new Response(JSON.stringify({ error: "Suppression possible uniquement quand le crédit est soldé" }), { status: 403, headers: CORS });

    // Date de suppression effective : aujourd'hui + 90 jours
    const prevue = new Date();
    prevue.setDate(prevue.getDate() + 90);
    const suppression_prevue = prevue.toISOString().slice(0, 10);

    const upd = await fetch(dossierUrl, {
      method: "PATCH", headers: H_WRITE,
      body: JSON.stringify({
        statut_compte: "suppression_demandee",
        suppression_demandee_at: new Date().toISOString(),
        suppression_prevue
      })
    });
    if (!upd.ok) {
      const t = await upd.text();
      return new Response(JSON.stringify({ error: "Échec mise à jour", details: t }), { status: 500, headers: CORS });
    }

    // Notification admin (pour information)
    await fetch(`${SUPA_URL}/rest/v1/notifications`, {
      method: "POST", headers: H_WRITE,
      body: JSON.stringify({
        dossier_id, pour_admin: true,
        titre: "Demande de suppression de documents",
        message: `Le client du dossier ${dossier_id} a demande la suppression de ses documents. Suppression prevue le ${suppression_prevue} (sauf litige).`,
        type: "info"
      })
    }).catch(()=>{});

    // Email au client : confirmation de la demande de suppression
    await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
      method: "POST", headers: H_NOTIFY,
      body: JSON.stringify({ dossier_id, evenement: "suppression" })
    }).catch(()=>{});

    return new Response(JSON.stringify({ success: true, action: "demander_suppression", suppression_prevue }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── ACTION : REPRISE DE CRÉDIT (client soldé, nouveau tél) ──
  // ════════════════════════════════════════════════════════════
  if (action === "reprise_credit") {
    // Possible uniquement si le crédit est soldé (et pas en suppression)
    if (dossier.statut_compte !== "solde")
      return new Response(JSON.stringify({ error: "Reprise possible uniquement quand le crédit précédent est soldé" }), { status: 403, headers: CORS });

    if (!produit_id)
      return new Response(JSON.stringify({ error: "Aucun produit choisi" }), { status: 400, headers: CORS });

    // 1. Récupérer le produit choisi (prix, nom, modèle)
    let prod = null;
    try {
      const res = await fetch(
        `${SUPA_URL}/rest/v1/products?id=eq.${encodeURIComponent(produit_id)}&select=id,nom,prix,modele,visible`,
        { headers: H_READ }
      );
      const rows = await res.json();
      if (rows && rows[0]) prod = rows[0];
    } catch (e) {
      return new Response(JSON.stringify({ error: "Erreur lecture produit", details: e.message }), { status: 500, headers: CORS });
    }
    if (!prod || prod.visible === false)
      return new Response(JSON.stringify({ error: "Produit introuvable ou indisponible" }), { status: 404, headers: CORS });

    const prix = Number(prod.prix || 0);
    if (!(prix > 0))
      return new Response(JSON.stringify({ error: "Prix du produit invalide" }), { status: 400, headers: CORS });

    // 2. ✅ Calcul des montants — acompte 50% + 3 mensualités (prix exact)
    const montant_1  = Math.ceil(prix * 0.5);       // acompte 50%
    const reste      = prix - montant_1;
    const mensualite = Math.ceil(reste / 3);
    const montant_2  = mensualite;
    const montant_3  = mensualite;
    const montant_4  = reste - 2 * mensualite;      // ajuste pour total exact

    // 3. Archiver l'ancien crédit soldé dans credit_historique
    try {
      await fetch(`${SUPA_URL}/rest/v1/credit_historique`, {
        method: "POST", headers: H_WRITE,
        body: JSON.stringify({
          user_id:         dossier.user_id,
          dossier_id:      dossier.dossier_id,
          client_nom:      dossier.client_nom,
          client_tel:      dossier.client_tel,
          client_email:    dossier.client_email,
          appareil:        dossier.appareil,
          prix_total:      dossier.prix_total,
          montant_1:       dossier.montant_1,
          montant_2:       dossier.montant_2,
          montant_3:       dossier.montant_3,
          montant_4:       dossier.montant_4 ?? null,
          paye_1:          dossier.paye_1,
          paye_2:          dossier.paye_2,
          paye_3:          dossier.paye_3,
          paye_4:          dossier.paye_4 ?? null,
          echeance_1:      dossier.echeance_1,
          echeance_2:      dossier.echeance_2,
          echeance_3:      dossier.echeance_3,
          echeance_4:      dossier.echeance_4 ?? null,
          device_id:       dossier.device_id,
          statut_final:    "solde",
          credit_ouvert_at: dossier.created_at || null,
          credit_solde_at:  dossier.solde_at || null
        })
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Échec archivage", details: e.message }), { status: 500, headers: CORS });
    }

    // 4. Réinitialiser la ligne pour le NOUVEAU crédit (garde les documents)
    const suffixe = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
    const nouveau_dossier = "CRED-" + Date.now().toString().slice(-8) + "-" + suffixe;
    // ✅ Échéances provisoires J/J+30/J+60/J+90 (recalculées à la validation admin)
    const today = new Date();
    const addDays = (n) => { const x = new Date(today); x.setDate(x.getDate() + n); return x.toISOString().slice(0,10); };
    const patch = {
      dossier_id:      nouveau_dossier,
      appareil:        prod.nom + (prod.modele ? " " + prod.modele : ""),
      prix_total:      prix,
      montant_1, montant_2, montant_3, montant_4,
      paye_1: false, paye_2: false, paye_3: false, paye_4: false,
      paye_1_at: null, paye_2_at: null, paye_3_at: null, paye_4_at: null,
      echeance_1: addDays(0), echeance_2: addDays(30), echeance_3: addDays(60), echeance_4: addDays(90),
      token_1: null, token_2: null, token_3: null, token_4: null,
      device_id: "",
      lost_mode_actif: false, lock_at: null, unlock_at: null,
      statut_compte: "en_verification",
      statut: "actif",
      motif_refus: null,
      solde_at: null,
      suppression_demandee_at: null, suppression_prevue: null, supprime_at: null,
      litige_en_cours: false,
      docs_envoyes_at: new Date().toISOString()
      // created_at : on ne le modifie pas (souvent en lecture seule / défaut DB)
      // NB : les colonnes documents (doc_cni, etc.) NE sont PAS touchées → conservées
    };

    const upd = await fetch(dossierUrl, {
      method: "PATCH", headers: H_WRITE,
      body: JSON.stringify(patch)
    });
    if (!upd.ok) {
      const t = await upd.text();
      return new Response(JSON.stringify({ error: "Échec création du nouveau crédit", details: t }), { status: 500, headers: CORS });
    }

    // 5. Notifier l'admin
    await fetch(`${SUPA_URL}/rest/v1/notifications`, {
      method: "POST", headers: H_WRITE,
      body: JSON.stringify({
        dossier_id: nouveau_dossier, user_id: dossier.user_id, pour_admin: true,
        titre: "Nouvelle demande (client fidèle) 🔁",
        message: `${dossier.client_nom} (déjà soldé) demande un nouveau crédit pour ${patch.appareil}. Documents déjà fournis. À valider.`,
        type: "info"
      })
    }).catch(()=>{});

    // 6. Notifier le client
    await fetch(`${SUPA_URL}/rest/v1/notifications`, {
      method: "POST", headers: H_WRITE,
      body: JSON.stringify({
        dossier_id: nouveau_dossier, user_id: dossier.user_id, pour_admin: false,
        titre: "Nouvelle demande envoyée ✅",
        message: "Votre nouvelle demande de crédit a bien été enregistrée. Vos documents existants sont réutilisés. Vous serez notifié dès validation.",
        type: "succes"
      })
    }).catch(()=>{});

    // Email au client : nouvelle demande (reprise) reçue
    await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
      method: "POST", headers: H_NOTIFY,
      body: JSON.stringify({ dossier_id: nouveau_dossier, evenement: "reprise" })
    }).catch(()=>{});

    return new Response(JSON.stringify({
      success: true, action: "reprise_credit",
      nouveau_dossier, appareil: patch.appareil,
      montant_1, montant_2, montant_3, montant_4
    }), { status: 200, headers: CORS });
  }

  return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers: CORS });
}
