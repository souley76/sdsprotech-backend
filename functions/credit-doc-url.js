import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  // Accepte soit un seul chemin { path }, soit une liste { paths: [...] }
  const paths = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : []);
  if (paths.length === 0)
    return new Response(JSON.stringify({ error: "Aucun chemin fourni" }), { status: 400, headers: CORS });

  const EXPIRES = 300; // 5 minutes

  // Génère une URL signée pour un chemin donné
  const signOne = async (chemin) => {
    // Sécurité : on n'autorise que les chemins du bucket credit-docs (dossier CRED-...)
    const clean = String(chemin).replace(/^\/+/, "");
    try {
      const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/credit-docs/${clean}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY
        },
        body: JSON.stringify({ expiresIn: EXPIRES })
      });
      if (!res.ok) return { path: chemin, url: null };
      const data = await res.json();
      // data.signedURL est relatif : /object/sign/credit-docs/...
      const signed = data.signedURL || data.signedUrl || null;
      if (!signed) return { path: chemin, url: null };
      const fullUrl = signed.startsWith("http") ? signed : `${SUPA_URL}/storage/v1${signed}`;
      return { path: chemin, url: fullUrl };
    } catch (e) {
      return { path: chemin, url: null };
    }
  };

  const results = await Promise.all(paths.map(signOne));

  return new Response(JSON.stringify({ success: true, urls: results }), { status: 200, headers: CORS });
}
