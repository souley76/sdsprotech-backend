import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400, headers: CORS }); }

  const { action, dossier_id, access_token } = body;

  if (!action || !dossier_id)
    return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: CORS });

  const SUPA_URL  = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY  = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const SUPA_ANON = (env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), { status: 500, headers: CORS });

  const H_READ  = { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };
  const H_WRITE = { ...H_READ, "Content-Type": "application/json", "Prefer": "return=minimal" };

  // ── SÉCURITÉ : identifier le client via son token de session ──
  if (!access_token)
    return new Response(JSON.stringify({ error: "Non autorisé (token manquant)" }), { status: 401, headers: CORS });

  let clientUserId = null;
  try {
    const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { "apikey": SUPA_ANON || SUPA_KEY, "Authorization": "Bearer " + access_token }
    });
    if (!userRes.ok)
      return new Response(JSON.stringify({ error: "Non autorisé (token invalide)" }), { status: 401, headers: CORS });
    const userData = await userRes.json();
    clientUserId = userData && userData.id;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur vérification token", details: e.message }), { status: 500, headers: CORS });
  }
  if (!clientUserId)
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: CORS });

  // ── Charger le dossier et vérifier qu'il appartient à ce client ──
  const dossierUrl = `${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(dossier_id)}`;
  let dossier = null;
  try {
    const res = await fetch(`${dossierUrl}&select=dossier_id,user_id,statut_compte`, { headers: H_READ });
    const rows = await res.json();
    if (rows && rows[0]) dossier = rows[0];
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur Supabase", details: e.message }), { status: 500, headers: CORS });
  }
  if (!dossier)
    return new Response(JSON.stringify({ error: "Dossier introuvable" }), { status: 404, headers: CORS });

  // Le dossier doit appartenir au client connecté
  if (dossier.user_id !== clientUserId)
    return new Response(JSON.stringify({ error: "Accès refusé (ce dossier ne vous appartient pas)" }), { status: 403, headers: CORS });

  // ════════════════════════════════════════════════════════════
  // ── ACTION : DEMANDER LA SUPPRESSION DES DOCUMENTS ──────────
  // ════════════════════════════════════════════════════════════
  if (action === "demander_suppression") {
    // Uniquement possible si le crédit est soldé
    if (dossier.statut_compte !== "solde")
      return new Response(JSON.stringify({ error: "Suppression possible uniquement quand le crédit est soldé" }), { status: 403, headers: CORS });

    // Date de suppression effective : aujourd'hui + 90 jours
    const prevue = new Date();
    prevue.setDate(prevue.getDate() + 90);
    const suppression_prevue = prevue.toISOString().slice(0, 10);

    const upd = await fetch(dossierUrl, {
      method: "PATCH", headers: H_WRITE,
      body: JSON.stringify({
        statut_compte: "suppression_demandee",
        suppression_demandee_at: new Date().toISOString(),
        suppression_prevue
      })
    });
    if (!upd.ok) {
      const t = await upd.text();
      return new Response(JSON.stringify({ error: "Échec mise à jour", details: t }), { status: 500, headers: CORS });
    }

    // Notification admin (pour information)
    await fetch(`${SUPA_URL}/rest/v1/notifications`, {
      method: "POST", headers: H_WRITE,
      body: JSON.stringify({
        dossier_id, pour_admin: true,
        titre: "Demande de suppression de documents",
        message: `Le client du dossier ${dossier_id} a demande la suppression de ses documents. Suppression prevue le ${suppression_prevue} (sauf litige).`,
        type: "info"
      })
    }).catch(()=>{});

    return new Response(JSON.stringify({ success: true, action: "demander_suppression", suppression_prevue }), { status: 200, headers: CORS });
  }

  return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers: CORS });
}
