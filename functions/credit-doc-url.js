import { CORS_HEADERS, handleOptions } from "../_helpers";

// ╔══════════════════════════════════════════════════════════════════╗
// ║ CREDIT-DOC-URL — VERSION CORRIGÉE                                ║
// ║ 🚨 FAILLE CRITIQUE CORRIGÉE : cet endpoint était PUBLIC.         ║
// ║    N'importe qui pouvait obtenir des URL signées vers les        ║
// ║    documents KYC de tes clients (CNI, selfies, justificatifs)    ║
// ║    en devinant un dossier_id. Désormais :                        ║
// ║    ✅ réservé aux admins (token de session Supabase + rôle       ║
// ║       'admin' vérifié côté serveur, comme credit-admin-action)   ║
// ║    ✅ chemins validés (uniquement CRED-.../fichier, pas de "..") ║
// ║                                                                  ║
// ║ ⚠️ La page admin doit maintenant envoyer access_token dans le    ║
// ║    body — admin-sds9k2x.html corrigé fourni avec.                ║
// ╚══════════════════════════════════════════════════════════════════╝

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

  // ── ✅ SÉCURITÉ : réservé aux admins ─────────────────────────
  const access_token = body.access_token;
  if (!access_token)
    return new Response(JSON.stringify({ error: "Non autorisé (token manquant)" }), { status: 401, headers: CORS });

  let adminUserId = null;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_ANON || SUPA_KEY, "Authorization": "Bearer " + access_token }
    });
    if (!userRes.ok)
      return new Response(JSON.stringify({ error: "Non autorisé (token invalide)" }), { status: 401, headers: CORS });
    const userData = await userRes.json();
    adminUserId = userData && userData.id;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification token", details: e.message }), { status: 500, headers: CORS });
  }
  if (!adminUserId)
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: CORS });

  try {
    const profRes = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=eq.${adminUserId}&select=role`,
      { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    );
    const profRows = await profRes.json();
    const role = profRows && profRows[0] && profRows[0].role;
    if (role !== "admin")
      return new Response(JSON.stringify({ error: "Accès refusé (rôle non admin)" }), { status: 403, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification rôle", details: e.message }), { status: 500, headers: CORS });
  }

  // ── Chemins demandés ────────────────────────────────────────
  // Accepte soit un seul chemin { path }, soit une liste { paths: [...] }
  const paths = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : []);
  if (paths.length === 0)
    return new Response(JSON.stringify({ error: "Aucun chemin fourni" }), { status: 400, headers: CORS });
  if (paths.length > 20)
    return new Response(JSON.stringify({ error: "Trop de chemins demandés" }), { status: 400, headers: CORS });

  const EXPIRES = 300; // 5 minutes

  // Génère une URL signée pour un chemin donné
  const signOne = async (chemin) => {
    // ✅ Sécurité : uniquement des chemins du type CRED-.../fichier.ext
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
