import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestGet(context) {
  const CORS = CORS_HEADERS(context.env);
  return new Response(JSON.stringify({
    ok: true,
    service: "paydunya-ipn",
    message: "Endpoint IPN actif. Utilisez POST pour les notifications de paiement."
  }), { status: 200, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  // ── Lecture body — PayDunya envoie form-urlencoded OU JSON ───
  let token = null;
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      token = body.data?.invoice?.token || body.token || null;
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      token = params.get("data[invoice][token]") || params.get("token") || null;
      if (!token) {
        try {
          const parsed = JSON.parse(decodeURIComponent(text));
          token = parsed.data?.invoice?.token || parsed.token || null;
        } catch(_) {}
      }
    }
  } catch(e) {
    return new Response(JSON.stringify({ error: "Lecture body échouée" }), { status: 400, headers: CORS });
  }

  const MASTER_KEY = env.PAYDUNYA_MASTER_KEY;
  if (!token || !MASTER_KEY)
    return new Response(JSON.stringify({ error: "Token manquant", contentType }), { status: 400, headers: CORS });

  // ── Vérification paiement via API PayDunya ──────────────────
  const MODE = env.PAYDUNYA_MODE || "live";
  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  let confirmData;
  try {
    const confirmRes = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, {
      method: "GET",
      headers: {
        "Content-Type":         "application/json",
        "PAYDUNYA-MASTER-KEY":  env.PAYDUNYA_MASTER_KEY,
        "PAYDUNYA-PRIVATE-KEY": env.PAYDUNYA_PRIVATE_KEY,
        "PAYDUNYA-TOKEN":       env.PAYDUNYA_TOKEN
      }
    });
    confirmData = await confirmRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Vérification PayDunya échouée" }), { status: 500, headers: CORS });
  }

  const statut      = confirmData?.status;
  const commande_id = confirmData?.custom_data?.commande_id;
  const client_nom  = confirmData?.custom_data?.client_nom  || "";
  const client_tel  = confirmData?.custom_data?.client_tel  || "";
  const client_adr  = confirmData?.custom_data?.client_address || "";
  const montant     = confirmData?.invoice?.total_amount;
  const articles    = confirmData?.invoice?.items?.item_0?.name || "";

  const statusMap = { completed: "PAID", pending: "PENDING", cancelled: "FAILED", failed: "FAILED" };
  const internalStatus = statusMap[statut] || "PENDING";

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  // ════════════════════════════════════════════════════════════
  // ── CAS FORMATION : commande_id commence par "FORM-" ────────
  // ════════════════════════════════════════════════════════════
  if (commande_id && commande_id.startsWith("FORM-") && internalStatus === "PAID" && SUPA_URL && SUPA_KEY) {
    const course_id = confirmData?.custom_data?.course_id || null;
    const user_id   = confirmData?.custom_data?.user_id || null;

    // Passer l'achat en "paid" (par commande_id, sinon par user+course)
    try {
      const filtre = `commande_id=eq.${encodeURIComponent(commande_id)}`;
      const upd = await fetch(`${SUPA_URL}/rest/v1/purchases?${filtre}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString(), paydunya_token: token })
      });
      const rows = await upd.json();
      // Si aucune ligne mise à jour (achat pending non trouvé), créer la ligne payée
      if ((!Array.isArray(rows) || rows.length === 0) && user_id && course_id) {
        await fetch(`${SUPA_URL}/rest/v1/purchases`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            user_id, course_id, status: "paid",
            amount: montant || 15000,
            email: confirmData?.custom_data?.client_email || null,
            paydunya_token: token, commande_id,
            paid_at: new Date().toISOString(), created_at: new Date().toISOString()
          })
        });
      }
    } catch (e) {}

    return new Response(JSON.stringify({ ok: true, type: "formation", commande_id }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── CAS CRÉDIT PHONE : commande_id commence par "CRED-" ──────
  // ════════════════════════════════════════════════════════════
  if (commande_id && commande_id.startsWith("CRED-") && internalStatus === "PAID") {
    // Format attendu : CRED-XXXXXXXX-N  →  dossier = CRED-XXXXXXXX, versement = N
    const lastDash = commande_id.lastIndexOf("-");
    const dossier_id = commande_id.substring(0, lastDash);
    const numVersement = parseInt(commande_id.substring(lastDash + 1), 10);

    if (dossier_id && [1,2,3,4].includes(numVersement) && SUPA_URL && SUPA_KEY) {
      // 1. Marquer le versement payé
      const patch = {};
      patch[`paye_${numVersement}`] = true;
      patch[`paye_${numVersement}_at`] = new Date().toISOString();

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
      } catch(e) {}

      // 2. Récupérer le dossier (device_id, verrou, paiements, user)
      let dossier = null;
      try {
        const res = await fetch(
          `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}&select=device_id,lost_mode_actif,client_nom,user_id,paye_1,paye_2,paye_3,paye_4,statut_compte,boutique_id,montant_1,montant_2,montant_3,montant_4`,
          { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
        );
        const rows = await res.json();
        if (rows && rows[0]) dossier = rows[0];
      } catch(e) {}

      // 2bis. VERSEMENT AUTOMATIQUE A LA BOUTIQUE (tranches 2, 3, 4 seulement)
      // L'acompte (N=1) est verse MANUELLEMENT par l'admin (il conditionne la
      // livraison). Des que le client paie une tranche mensuelle, le montant
      // part automatiquement vers le numero mobile money de la boutique.
      if (numVersement >= 2 && dossier && dossier.boutique_id) {
        try {
          // Recuperer le numero de versement de la boutique
          const rb = await fetch(
            `${SUPA_URL}/rest/v1/boutiques?id=eq.${dossier.boutique_id}&select=payout_numero,payout_operateur,nom`,
            { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
          );
          const bl = await rb.json();
          const boutique = bl && bl[0];
          const montantTranche = Number(dossier[`montant_${numVersement}`] || 0);

          if (boutique && boutique.payout_numero && montantTranche > 0) {
            const PD_MASTER  = (env.PAYDUNYA_MASTER_KEY  || "").trim();
            const PD_PRIVATE = (env.PAYDUNYA_PRIVATE_KEY || "").trim();
            const PD_TOKEN   = (env.PAYDUNYA_TOKEN       || "").trim();
            const PD_MODE    = (env.PAYDUNYA_MODE || "live").toLowerCase();
            const baseDisb   = PD_MODE === "test"
              ? "https://app.sandbox.paydunya.com/api/v2/disburse"
              : "https://app.paydunya.com/api/v2/disburse";

            if (PD_MASTER && PD_PRIVATE && PD_TOKEN) {
              const disbRes = await fetch(`${baseDisb}/get-invoice`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "PAYDUNYA-MASTER-KEY": PD_MASTER,
                  "PAYDUNYA-PRIVATE-KEY": PD_PRIVATE,
                  "PAYDUNYA-TOKEN": PD_TOKEN,
                },
                body: JSON.stringify({
                  account_alias: boutique.payout_numero,
                  amount: montantTranche,
                  withdraw_mode: boutique.payout_operateur || "orange-money-senegal",
                }),
              });
              const disb = await disbRes.json();
              const ok = disb && (disb.status === "success" || disb.success === true || disb.response_code === "00");
              // Journaliser le versement (reussi ou non) pour tracabilite
              await fetch(`${SUPA_URL}/rest/v1/credit_versements_boutique`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": SUPA_KEY,
                  "Authorization": "Bearer " + SUPA_KEY,
                  "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                  dossier_id, boutique_id: dossier.boutique_id,
                  numero_versement: numVersement, montant: montantTranche,
                  statut: ok ? "verse" : "echec",
                  reference: (disb && (disb.disburse_id || disb.transaction_id)) || null,
                  cree_le: new Date().toISOString()
                })
              }).catch(()=>{});
            }
          }
        } catch(e) {}
      }

      // 3. Si le téléphone était verrouillé → DELETE SimpleMDM (déverrouiller)
      if (dossier && dossier.lost_mode_actif && dossier.device_id) {
        const MDM_KEY = (env.SIMPLEMDM_API_KEY || "").trim();
        if (MDM_KEY) {
          try {
            const mdmRes = await fetch(`https://a.simplemdm.com/api/v1/devices/${dossier.device_id}/lost_mode`, {
              method: "DELETE",
              headers: { "Authorization": "Basic " + btoa(MDM_KEY + ":") }
            });
            if (mdmRes.ok || mdmRes.status === 202) {
              await fetch(`${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": SUPA_KEY,
                  "Authorization": "Bearer " + SUPA_KEY,
                  "Prefer": "return=minimal"
                },
                body: JSON.stringify({ lost_mode_actif: false, unlock_at: new Date().toISOString() })
              });
              // Email au client : téléphone débloqué
              await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dossier_id, evenement: "deverrouille" })
              }).catch(()=>{});
            }
          } catch(e) {}
        }
      }

      // 3bis. Si les 3 versements sont payés → passer le dossier en "solde"
      const tousPayes =
        (numVersement === 1 || dossier?.paye_1) &&
        (numVersement === 2 || dossier?.paye_2) &&
        (numVersement === 3 || dossier?.paye_3) &&
        (numVersement === 4 || dossier?.paye_4);
      if (dossier && tousPayes && dossier.statut_compte === "valide") {
        try {
          await fetch(`${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPA_KEY,
              "Authorization": "Bearer " + SUPA_KEY,
              "Prefer": "return=minimal"
            },
            body: JSON.stringify({ statut_compte: "solde", solde_at: new Date().toISOString() })
          });
          await fetch(`${SUPA_URL}/rest/v1/notifications`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPA_KEY,
              "Authorization": "Bearer " + SUPA_KEY,
              "Prefer": "return=minimal"
            },
            body: JSON.stringify({
              dossier_id, user_id: dossier.user_id || null, pour_admin: false,
              titre: "Credit solde",
              message: "Felicitations, vous avez regle l'integralite de votre credit. Le telephone vous appartient pleinement.",
              type: "succes"
            })
          });
        } catch(e) {}
      }

      // 4. Notification admin
      try {
        await fetch(`${SUPA_URL}/rest/v1/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            dossier_id, pour_admin: true,
            titre: "Versement crédit payé 💰",
            message: `${dossier?.client_nom || client_nom} a payé le versement ${numVersement}. Téléphone déverrouillé si nécessaire.`,
            type: "succes"
          })
        });
      } catch(e) {}

      // 5. Email échéancier au client (récap + liens versements restants)
      try {
        await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dossier_id, evenement: "versement" })
        });
      } catch(e) {}
    }

    return new Response(JSON.stringify({ ok: true, type: "credit", dossier: dossier_id, versement: numVersement }), { status: 200, headers: CORS });
  }

  // ════════════════════════════════════════════════════════════
  // ── CAS NORMAL : commande classique (comportement existant) ──
  // ════════════════════════════════════════════════════════════
  if (SUPA_URL && SUPA_KEY && commande_id) {
    try {
      await fetch(
        `${SUPA_URL}/rest/v1/orders?commande_id=eq.${encodeURIComponent(commande_id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey":        SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer":        "return=minimal"
          },
          body: JSON.stringify({
            status:          internalStatus,
            paydunya_status: statut?.toUpperCase() || "PENDING",
            paydunya_token:  token,
            paid_at:         internalStatus === "PAID" ? new Date().toISOString() : null
          })
        }
      );
    } catch (dbErr) { console.error("Supabase error:", dbErr.message); }
  }

  if (internalStatus === "PAID" && env.RESEND_API_KEY) {
    try {
      await fetch("https://sdsprotech-backend.pages.dev/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_nom, client_tel,
          client_email: confirmData?.custom_data?.client_email || "",
          client_adr, articles,
          total:          montant ? montant + " XOF" : "—",
          operateur:      "PayDunya",
          date:           new Date().toLocaleString("fr-FR"),
          commande_id,
          paydunya_token: token
        })
      });
    } catch (notifErr) { console.error("Notify error:", notifErr.message); }
  }

  return new Response(JSON.stringify({ ok: true, status: internalStatus }), {
    status: 200, headers: CORS
  });
}
