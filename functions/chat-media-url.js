import { CORS_HEADERS, handleOptions } from "../_helpers";

// ============================================================================
//  CHAT-MEDIA-URL — genere des URL signees (courte duree) vers les medias du
//  chat (bucket prive chat-media).
//
//  Accessible a tout utilisateur CONNECTE (partenaire ou admin) : il suffit
//  d'un token de session valide. La RLS de la table messages garantit deja
//  qu'un partenaire ne recupere que les urls de SES messages cote interface.
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

  // ── Securite : un token de session valide suffit (partenaire OU admin) ──
  const access_token = body.access_token;
  if (!access_token)
    return new Response(JSON.stringify({ error: "Non autorisé (token manquant)" }), { status: 401, headers: CORS });

  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_ANON || SUPA_KEY, "Authorization": "Bearer " + access_token }
    });
    if (!userRes.ok)
      return new Response(JSON.stringify({ error: "Non autorisé (token invalide)" }), { status: 401, headers: CORS });
    const userData = await userRes.json();
    if (!userData || !userData.id)
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification token", details: e.message }), { status: 500, headers: CORS });
  }

  // ── Chemins demandes (URL publiques stockees, on en extrait le chemin) ──
  const bruts = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : []);
  if (bruts.length === 0)
    return new Response(JSON.stringify({ error: "Aucun chemin fourni" }), { status: 400, headers: CORS });
  if (bruts.length > 50)
    return new Response(JSON.stringify({ error: "Trop de chemins demandés" }), { status: 400, headers: CORS });

  const EXPIRES = 3600; // 1 heure (le temps d'une session de chat)

  // Extrait le chemin interne depuis une URL publique ou un chemin brut.
  // Ex. https://xxx/storage/v1/object/public/chat-media/BID/f.m4a -> BID/f.m4a
  const extraireChemin = (v) => {
    const s = String(v || "");
    const marqueur = "/chat-media/";
    const i = s.indexOf(marqueur);
    if (i !== -1) return s.slice(i + marqueur.length).split("?")[0];
    return s.replace(/^\/+/, ""); // deja un chemin
  };

  const signOne = async (brut) => {
    const clean = extraireChemin(brut);
    if (!clean || clean.includes("..")) return { path: brut, url: null };
    try {
      const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/chat-media/${clean}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY
        },
        body: JSON.stringify({ expiresIn: EXPIRES })
      });
      if (!res.ok) return { path: brut, url: null };
      const data = await res.json();
      const signed = data.signedURL || data.signedUrl || null;
      if (!signed) return { path: brut, url: null };
      const fullUrl = signed.startsWith("http") ? signed : `${SUPA_URL}/storage/v1${signed}`;
      return { path: brut, url: fullUrl };
    } catch (e) {
      return { path: brut, url: null };
    }
  };

  const results = await Promise.all(bruts.map(signOne));
  return new Response(JSON.stringify({ success: true, urls: results }), { status: 200, headers: CORS });
}
