import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env);
}

export async function onRequestPost(context) {
  return runCron(context);
}
export async function onRequestGet(context) {
  return runCron(context);
}

async function runCron(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env);

  // ── Sécurité : vérifier le secret ───────────────────────────
  const url = new URL(request.url);
  const provided = request.headers.get("x-cron-secret") || url.searchParams.get("secret");
  if (!env.CRON_SECRET || provided !== env.CRON_SECRET)
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: CORS });

  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const MDM_KEY  = (env.SIMPLEMDM_API_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY || !MDM_KEY)
    return new Response(JSON.stringify({ error: "Config manquante" }), { status: 500, headers: CORS });

  // Date du jour (on verrouille si échéance < aujourd'hui, soit grâce d'1 jour)
  const today = new Date().toISOString().slice(0, 10);

  // ── Récupérer les dossiers validés, non verrouillés, avec device_id ──
  let dossiers = [];
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/credit_phones?statut_compte=eq.valide&lost_mode_actif=eq.false` +
      `&device_id=neq.&select=dossier_id,client_nom,device_id,montant_1,montant_2,montant_3,` +
      `paye_1,paye_2,paye_3,echeance_1,echeance_2,echeance_3`,
      { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    );
    dossiers = await res.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur lecture Supabase", details: e.message }), { status: 500, headers: CORS });
  }

  const MDM_AUTH = "Basic " + btoa(MDM_KEY + ":");
  const MESSAGE = "SECK DIGITAL SERVICES PRO. Cher client, votre versement est en attente. Pour debloquer votre telephone, connectez-vous a votre compte sur sdsprotech.com et reglez votre echeance. Pour toute question contactez-nous. Merci de votre confiance.";
  const PHONE   = env.COMPANY_PHONE || "+221770699739";

  const verrouilles = [];

  for (const d of (Array.isArray(dossiers) ? dossiers : [])) {
    // Une échéance est-elle dépassée ET impayée ?
    const enRetard =
      (!d.paye_1 && d.echeance_1 && d.echeance_1 < today) ||
      (!d.paye_2 && d.echeance_2 && d.echeance_2 < today) ||
      (!d.paye_3 && d.echeance_3 && d.echeance_3 < today);

    if (!enRetard) continue;

    // ── Verrouiller via SimpleMDM ─────────────────────────────
    try {
      const form = new URLSearchParams();
      form.set("message", MESSAGE);
      form.set("phone_number", PHONE);
      const mdmRes = await fetch(`https://a.simplemdm.com/api/v1/devices/${d.device_id}/lost_mode`, {
        method: "POST",
        headers: {
          "Authorization": MDM_AUTH,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      });

      if (mdmRes.ok || mdmRes.status === 202) {
        // Marquer verrouillé dans Supabase
        await fetch(`${SUPA_URL}/rest/v1/credit_phones?dossier_id=eq.${encodeURIComponent(d.dossier_id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({ lost_mode_actif: true, lock_at: new Date().toISOString() })
        });
        // Notification admin
        await fetch(`${SUPA_URL}/rest/v1/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            dossier_id: d.dossier_id, pour_admin: true,
            titre: "Téléphone verrouillé 🔒",
            message: `${d.client_nom} : versement en retard, appareil ${d.device_id} verrouillé automatiquement.`,
            type: "alerte"
          })
        }).catch(()=>{});
        verrouilles.push({ dossier: d.dossier_id, device: d.device_id, status: mdmRes.status });
      } else {
        const t = await mdmRes.text();
        verrouilles.push({ dossier: d.dossier_id, device: d.device_id, status: mdmRes.status, error: t });
      }
    } catch (e) {
      verrouilles.push({ dossier: d.dossier_id, device: d.device_id, error: e.message });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    date: today,
    dossiers_examines: Array.isArray(dossiers) ? dossiers.length : 0,
    verrouilles
  }), { status: 200, headers: CORS });
}
