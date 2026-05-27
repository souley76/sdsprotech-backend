// CORS — restrictif en production, ouvert en dev
export function CORS_HEADERS(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Signature, Authorization",
    "Content-Type": "application/json"
  };
}

// Réponse preflight OPTIONS
export function handleOptions(env) {
  return new Response(null, { status: 204, headers: CORS_HEADERS(env) });
}

// Map statuts PawaPay → internes
export const STATUS_MAP = {
  COMPLETED: "PAID", FAILED: "FAILED",
  PENDING: "PENDING", ENQUEUED: "PENDING", ACCEPTED: "PENDING"
};
export function mapPawapayStatus(s) { return STATUS_MAP[s] || "PENDING"; }

// Validation montant
export function validateAmount(amount) {
  const num = Number(amount);
  if (isNaN(num) || num <= 0) return { valid: false, error: "Montant invalide" };
  return { valid: true, value: num };
}

// Nettoyage numéro sénégalais
export function cleanSenegalPhone(phone) {
  let clean = phone.toString().replace(/\D/g, "");
  if (clean.startsWith("00")) clean = clean.substring(2);
  if (clean.startsWith("221")) clean = clean.substring(3);
  if (clean.length !== 9)
    return { valid: false, error: "Numéro invalide", details: "Reçu : " + clean };
  return { valid: true, e164: "+221" + clean, local: clean };
}

// Map opérateurs
export const CORRESPONDENT_MAP = {
  "orange": "ORANGE_MONEY_SN", "orange money": "ORANGE_MONEY_SN",
  "orange_money": "ORANGE_MONEY_SN", "om": "ORANGE_MONEY_SN",
  "free": "FREE_MONEY_SN", "free money": "FREE_MONEY_SN",
  "free_money": "FREE_MONEY_SN", "free_money_sn": "FREE_MONEY_SN",
};
export function normalizeCorrespondent(c) {
  return CORRESPONDENT_MAP[c.toLowerCase()] || c.toUpperCase();
}

// URL PawaPay selon environnement
export function pawapayBaseUrl(env) {
  return env.PAWAPAY_ENVIRONMENT === "production"
    ? "https://api.pawapay.io"
    : "https://api.sandbox.pawapay.cloud";
}

// Vérification HMAC + anti-replay 5 min
export async function verifyPawapaySignature(request, env, rawBody) {
  const secret = env.PAWAPAY_WEBHOOK_SECRET;
  const sig = request.headers.get("Signature");
  if (!secret || !sig) return false;
  let providedSig = sig, payload = rawBody;
  if (sig.includes("t=") && sig.includes("v1=")) {
    const t  = sig.match(/t=(\d+)/)?.[1];
    const v1 = sig.match(/v1=([a-f0-9]+)/i)?.[1];
    if (!t || !v1) return false;
    if (Date.now() - Number(t) > 5 * 60 * 1000) return false;
    providedSig = v1; payload = `${t}.${rawBody}`;
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expected = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
  if (expected.length !== providedSig.length) return false;
  let res = 0;
  for (let i = 0; i < expected.length; i++) res |= expected.charCodeAt(i) ^ providedSig.charCodeAt(i);
  return res === 0;
                                       }
