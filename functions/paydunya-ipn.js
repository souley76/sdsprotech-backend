import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  // ── Lecture body ────────────────────────────────────────────
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  // ── Extraction du token ─────────────────────────────────────
  const token      = body.data?.invoice?.token || body.token;
  const MASTER_KEY = env.PAYDUNYA_MASTER_KEY;

  if (!token || !MASTER_KEY)
    return new Response(JSON.stringify({ error: "Données IPN invalides" }), { status: 400, headers: CORS });

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

  // ── Statut paiement ─────────────────────────────────────────
  const statut      = confirmData?.status;          // "completed" | "pending" | "cancelled"
  const commande_id = confirmData?.custom_data?.commande_id;
  const client_nom  = confirmData?.custom_data?.client_nom  || "";
  const client_tel  = confirmData?.custom_data?.client_tel  || "";
  const client_adr  = confirmData?.custom_data?.client_address || "";
  const montant     = confirmData?.invoice?.total_amount;
  const articles    = confirmData?.invoice?.items?.item_0?.name || "";

  const statusMap = {
    completed: "PAID",
    pending:   "PENDING",
    cancelled: "FAILED",
    failed:    "FAILED"
  };
  const internalStatus = statusMap[statut] || "PENDING";

  // ── Mise à jour Supabase ────────────────────────────────────
  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

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

  // ── Notification email si paiement confirmé ─────────────────
  if (internalStatus === "PAID" && env.RESEND_API_KEY) {
    try {
      await fetch("https://sdsprotech-backend.pages.dev/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_nom,
          client_tel,
          client_adr,
          articles,
          total:     montant ? montant + " XOF" : "—",
          operateur: "PayDunya",
          date:      new Date().toLocaleString("fr-FR")
        })
      });
    } catch (notifErr) { console.error("Notify error:", notifErr.message); }
  }

  return new Response(JSON.stringify({ ok: true, status: internalStatus }), {
    status: 200, headers: CORS
  });
}
