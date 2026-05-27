import { verifyPawapaySignature, mapPawapayStatus } from "../../_helpers";

export async function onRequestPost(context) {
  const { request, env } = context;
  const rawBody = await request.text();

  // ✅ Vérification signature HMAC
  const sigOk = await verifyPawapaySignature(request, env, rawBody);
  if (!sigOk) return new Response("unauthorized", { status: 401 });

  let body;
  try { body = JSON.parse(rawBody); }
  catch { return new Response("invalid json", { status: 400 }); }

  const pawapayId = body.depositId || body.refundId;
  if (!pawapayId) return new Response("missing id", { status: 400 });

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await fetch(env.SUPABASE_URL + "/rest/v1/pawapay_payments", {
        method: "POST",
        headers: {
          "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
          /* ✅ merge-duplicates évite les doublons webhook */
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          pawapay_id: pawapayId, type: body.refundId ? "refund" : "deposit",
          status: body.status || "UNKNOWN", amount: body.amount ? Number(body.amount) : null,
          currency: body.currency || "XOF",
          phone: body?.payer?.address?.value || body?.payee?.address?.value || null,
          operator: body.correspondent || null, raw: rawBody,
          updated_at: new Date().toISOString()
        })
      });
    } catch (err) { return new Response("internal database error", { status: 500 }); }

    // ✅ Mise à jour orders avec STATUS_MAP complet
    if (body.depositId && body.status) {
      await fetch(env.SUPABASE_URL + "/rest/v1/orders?deposit_id=eq." + body.depositId, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          pawapay_status: body.status,
          status: mapPawapayStatus(body.status), // ✅ tous les statuts couverts
          updated_at: new Date().toISOString()
        })
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
          }
