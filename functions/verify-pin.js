import { CORS_HEADERS, handleOptions } from "../_helpers";

// ╔══════════════════════════════════════════════════════════════════╗
// ║ VERIFY-PIN — VERSION CORRIGÉE                                    ║
// ║ ✅ FAILLE CORRIGÉE : avant, le "token" était un simple UUID non  ║
// ║    signé et non stocké → impossible à vérifier côté serveur, et  ║
// ║    forgeable par n'importe qui. Maintenant : token signé HMAC    ║
// ║    SHA-256 avec expiration 8h, vérifiable par tout endpoint.     ║
// ║ ✅ Comparaison du PIN à temps constant (anti-timing attack).     ║
// ║ ✅ Délai d'1s conservé en cas d'échec (anti brute force).        ║
// ║                                                                  ║
// ║ Réponse inchangée : { success: true, token } → rien à changer    ║
// ║ dans tes pages qui appellent /verify-pin.                        ║
// ║                                                                  ║
// ║ (Optionnel) Variable d'env SESSION_SECRET : une longue chaîne    ║
// ║ aléatoire dédiée à la signature. À défaut, SITE_PIN est utilisé. ║
// ╚══════════════════════════════════════════════════════════════════╝

const DUREE_SESSION_MS = 8 * 60 * 60 * 1000; // 8 heures

// ── Signature HMAC SHA-256 → hex ─────────────────────────────────
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Comparaison à temps constant ─────────────────────────────────
function egalTempsConstant(a, b) {
  const sa = String(a), sb = String(b);
  const n = Math.max(sa.length, sb.length);
  let diff = sa.length === sb.length ? 0 : 1;
  for (let i = 0; i < n; i++) {
    diff |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// ── Vérifier un token émis par cet endpoint ──────────────────────
// Utilisable par d'autres endpoints :
//   import { verifierTokenAdmin } from "./verify-pin";
//   if (!(await verifierTokenAdmin(env, token))) → 401
export async function verifierTokenAdmin(env, token) {
  const SECRET = env.SESSION_SECRET || env.SITE_PIN;
  if (!SECRET || !token) return false;
  const [expStr, signature] = String(token).split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || !signature) return false;
  if (Date.now() > exp) return false; // expiré
  const attendu = await hmacHex(SECRET, "admin." + exp);
  return egalTempsConstant(signature, attendu);
}

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

  if (!pin || !egalTempsConstant(pin, SITE_PIN)) {
    // Attendre 1 seconde pour ralentir le brute force
    await new Promise(r => setTimeout(r, 1000));
    return new Response(JSON.stringify({ success: false, error: "Code incorrect" }), { status: 401, headers: CORS });
  }

  // ✅ Token signé : "<expiration>.<signature HMAC>" — valide 8h, vérifiable partout
  const SECRET = env.SESSION_SECRET || SITE_PIN;
  const exp = Date.now() + DUREE_SESSION_MS;
  const token = exp + "." + (await hmacHex(SECRET, "admin." + exp));

  return new Response(JSON.stringify({ success: true, token }), { status: 200, headers: CORS });
}
