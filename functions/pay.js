import {
  CORS_HEADERS, handleOptions, validateAmount,
  cleanSenegalPhone, normalizeCorrespondent, pawapayBaseUrl
} from "../_helpers";

// ── PAY (PawaPay) — VERSION CORRIGÉE ─────────────────────────────
// ✅ statementDescription nettoyé et limité (PawaPay refuse les
//    caractères spéciaux et les libellés trop longs → paiements qui
//    échouaient selon le nom du produit).
// Le reste du fichier est inchangé.

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(env);
  const CORS = CORS_HEADERS(env);
  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { phone, amount, correspondent, productName, clientName, address } = body;
  if (!phone || !amount || !correspondent)
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: CORS });

  // ✅ Validation montant (patch corrigé)
  const amountCheck = validateAmount(amount);
  if (!amountCheck.valid)
    return new Response(JSON.stringify({ error: amountCheck.error }), { status: 400, headers: CORS });

  // ✅ Validation numéro
  const phoneCheck = cleanSenegalPhone(phone);
  if (!phoneCheck.valid)
    return new Response(JSON.stringify({ error: phoneCheck.error, details: phoneCheck.details }), { status: 400, headers: CORS });

  const normalizedCorrespondent = normalizeCorrespondent(correspondent);
  const depositId = crypto.randomUUID();

  // ✅ Libellé sûr pour PawaPay : lettres/chiffres/espaces, 22 caractères max
  const descSure = ("SDS PRO " + (productName || "Commande"))
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 22) || "SDS PRO";

  const pawapayPayload = {
    depositId, amount: amountCheck.value, currency: "XOF", country: "SEN",
    correspondent: normalizedCorrespondent,
    payer: { type: "MSISDN", address: { value: phoneCheck.e164 } },
    customerTimestamp: new Date().toISOString(),
    statementDescription: descSure
  };

  let pawapayResponse;
  try {
    pawapayResponse = await fetch(`${pawapayBaseUrl(env)}/deposits`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.PAWAPAY_API_KEY },
      body: JSON.stringify(pawapayPayload)
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Connexion PawaPay échouée", details: err.message }), { status: 500, headers: CORS });
  }

  const result = await pawapayResponse.json();
  if (!pawapayResponse.ok)
    return new Response(JSON.stringify({ error: "Erreur PawaPay", details: result }), { status: 400, headers: CORS });

  const deposit = Array.isArray(result) ? result[0] : result;
  const pawapayStatus = deposit?.status || deposit?.depositStatus || "UNKNOWN";

  // ✅ Clé SUPABASE_SERVICE_ROLE_KEY (patch corrigé)
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await fetch(env.SUPABASE_URL + "/rest/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          deposit_id: depositId, client_name: clientName || "",
          phone: "221" + phoneCheck.local, address: address || "",
          product: productName || "", amount: amountCheck.value,
          currency: "XOF", operator: normalizedCorrespondent,
          pawapay_status: pawapayStatus, status: "PENDING",
          created_at: new Date().toISOString()
        })
      });
    } catch (dbErr) { console.error("Supabase error:", dbErr.message); }
  }

  return new Response(JSON.stringify({
    success: true, depositId, pawapayStatus,
    phone: phoneCheck.e164, amount: amountCheck.value,
    currency: "XOF", operator: normalizedCorrespondent, raw: deposit
  }), { status: 200, headers: CORS });
}
