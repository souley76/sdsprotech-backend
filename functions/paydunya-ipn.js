import { CORS_HEADERS, handleOptions } from "./_helpers";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(env);
  const CORS = CORS_HEADERS(env);

  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers: CORS });

  // ── Lecture body ────────────────────────────────────────────
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  // ── Vérification hash PayDunya ──────────────────────────────
  // PayDunya envoie un hash MD5 de (MASTER_KEY + token)
  const token       = body.data?.invoice?.token || body.token;
  const receivedHash = body.data?.hash || body.hash;
  const MASTER_KEY  = env.PAYDUNYA_MASTER_KEY;

  if (!token || !receivedHash || !MASTER_KEY)
    return new Response(JSON.stringify({ error: "Données IPN invalides" }), { status: 400, headers: CORS });

  // Calcul hash MD5 côté Worker
  const enc = new TextEncoder();
  const keyData = enc.encode(MASTER_KEY + token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  // PayDunya utilise MD5 mais Cloudflare Workers ne supporte pas MD5 nativement
  // On vérifie via l'API PayDunya confirm à la place (plus sûr)

  // ── Vérification paiement via API PayDunya ──────────────────
  const MODE = env.PAYDUNYA_MODE || "live";
  const BASE_URL = MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  let confirmRes, confirmData;
  try {
    confirmRes = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, {
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

  // ── Statut paiement ─────────────────────────────────────────
  const statut       = confirmData?.status;          // "completed" | "pending" | "cancelled"
  const commande_id  = confirmData?.custom_data?.commande_id;
  const client_nom   = confirmData?.custom_data?.client_nom;
  const client_tel   = confirmData?.custom_data?.client_tel;
  const montant      = confirmData?.invoice?.total_amount;
  const articles     = confirmData?.invoice?.items?.item_0?.name || "";

  const statusMap = {
    completed: "PAID",
    pending:   "PENDING",
    cancelled: "FAILED",
    failed:    "FAILED"
  };
  const internalStatus = statusMap[statut] || "PENDING";

  // ── Mise à jour Supabase ────────────────────────────────────
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && commande_id) {
    try {
      await fetch(
        env.SUPABASE_URL + "/rest/v1/orders?commande_id=eq." + commande_id,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey":        env.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
            "Prefer":        "return=minimal"
          },
          body: JSON.stringify({
            status:          internalStatus,
            paydunya_status: statut,
            updated_at:      new Date().toISOString()
          })
        }
      );
    } catch (dbErr) { console.error("Supabase error:", dbErr.message); }
  }

  // ── Notification email si paiement confirmé ─────────────────
  if (internalStatus === "PAID" && env.RESEND_API_KEY) {
    try {
      await fetch("https://sdsprotech-backend.pages.dev/functions/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_nom,
          client_tel,
          client_adr:  "",
          articles,
          total:       montant ? montant + " XOF" : "—",
          operateur:   "PayDunya",
          date:        new Date().toLocaleString("fr-FR")
        })
      });
    } catch (notifErr) { console.error("Notify error:", notifErr.message); }
  }

  return new Response(JSON.stringify({ ok: true, status: internalStatus }), {
    status: 200, headers: CORS
  });
}
