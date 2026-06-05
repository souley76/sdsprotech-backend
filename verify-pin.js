import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(env);
  const CORS = CORS_HEADERS(env);

  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { pin } = body;
  const SITE_PIN = env.SITE_PIN;

  if (!SITE_PIN)
    return new Response(JSON.stringify({ error: "PIN non configuré" }), { status: 500, headers: CORS });

  if (!pin || String(pin) !== String(SITE_PIN)) {
    // Attendre 1 seconde pour éviter le brute force
    await new Promise(r => setTimeout(r, 1000));
    return new Response(JSON.stringify({ success: false, error: "Code incorrect" }), { status: 401, headers: CORS });
  }

  // Générer un token de session valide 8h
  const token = crypto.randomUUID() + '-' + Date.now();

  return new Response(JSON.stringify({ success: true, token }), { status: 200, headers: CORS });
}
