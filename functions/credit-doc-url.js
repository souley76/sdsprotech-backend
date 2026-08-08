import { CORS_HEADERS, handleOptions } from "../_helpers";

// ============================================================================
//  CREDIT-DOC-URL — genere des URL signees (5 min) vers les documents KYC
//
//  SECURITE : reserve aux admins. On verifie le token de session Supabase,
//  puis on confirme que l'utilisateur est admin_sds via la table
//  boutique_membres (le meme mecanisme que est_admin_sds() cote base et que
//  credit-admin-action). Les chemins sont valides : uniquement CRED-.../fichier.
// ============================================================================

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  const SUPA_URL  = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY  = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const SUPA_ANON = (env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  // ── Securite : token de session obligatoire ─────────────────
  const access_token = body.access_token;
  if (!access_token)
    return new Response(JSON.stringify({ error: "Non autorisé (token manquant)" }), { status: 401, headers: CORS });

  // 1) Identifier l'utilisateur a partir de son token
  let userId = null;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_ANON || SUPA_KEY, "Authorization": "Bearer " + access_token }
    });
    if (!userRes.ok)
      return new Response(JSON.stringify({ error: "Non autorisé (token invalide)" }), { status: 401, headers: CORS });
    const userData = await userRes.json();
    userId = userData && userData.id;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification token", details: e.message }), { status: 500, headers: CORS });
  }
  if (!userId)
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: CORS });

  // 2) Verifier que l'utilisateur est admin_sds (via boutique_membres,
  //    exactement comme est_admin_sds() cote base)
  try {
    const memRes = await fetch(
      `${SUPA_URL}/rest/v1/boutique_membres?user_id=eq.${userId}&role=eq.admin_sds&select=user_id`,
      { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    );
    const memRows = await memRes.json();
    const estAdmin = Array.isArray(memRows) && memRows.length > 0;
    if (!estAdmin)
      return new Response(JSON.stringify({ error: "Accès refusé (rôle non admin)" }), { status: 403, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification rôle", details: e.message }), { status: 500, headers: CORS });
  }

  // ── Chemins demandes ────────────────────────────────────────
  const paths = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : []);
  if (paths.length === 0)
    return new Response(JSON.stringify({ error: "Aucun chemin fourni" }), { status: 400, headers: CORS });
  if (paths.length > 20)
    return new Response(JSON.stringify({ error: "Trop de chemins demandés" }), { status: 400, headers: CORS });

  const EXPIRES = 300; // 5 minutes

  // Genere une URL signee pour un chemin donne (uniquement CRED-.../fichier.ext)
  const signOne = async (chemin) => {
    const clean = String(chemin).replace(/^\/+/, "");
    if (clean.includes("..") || !/^CRED-[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(clean))
      return { path: chemin, url: null };
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
