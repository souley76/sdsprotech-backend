import { CORS_HEADERS, handleOptions } from "../_helpers";

// ╔══════════════════════════════════════════════════════════════════╗
// ║ CREDIT-UPLOAD — VERSION CORRIGÉE                                 ║
// ║ ✅ FAILLE CORRIGÉE : le prix venait du client (prix_total).      ║
// ║    Un client pouvait soumettre un iPhone avec un prix manipulé.  ║
// ║    Désormais le prix ET le nom de l'appareil sont relus depuis   ║
// ║    la table products via produit_id.                             ║
// ║ ✅ 4 paiements : acompte 50% + 3 mensualités égales              ║
// ║    (montant_4 absorbe l'arrondi pour tomber sur le prix exact).  ║
// ║ ✅ Échéances provisoires réalistes (J, J+30, J+60, J+90) —       ║
// ║    de toute façon recalculées à la validation admin.             ║
// ║ ✅ dossier_id moins devinable (suffixe aléatoire).               ║
// ║ ✅ Taille maximale par document (anti-abus du stockage).         ║
// ║ ✅ Clé interne sur l'appel credit-notify.                        ║
// ╚══════════════════════════════════════════════════════════════════╝

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

  const {
    user_id, client_nom, client_tel, client_email, client_adresse,
    numero_cni, appareil, produit_id,
    doc_cni_recto, doc_cni_verso, doc_selfie, doc_cni_legalisee, doc_residence
    // chaque doc = { data: base64, type: "image/jpeg" }
    // NB : prix_total envoyé par la page est désormais IGNORÉ (prix relu en base)
  } = body;

  // ── Validation des champs obligatoires ──────────────────────
  if (!user_id || !client_nom || !client_tel)
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: CORS });

  const docs = { doc_cni_recto, doc_cni_verso, doc_selfie, doc_cni_legalisee, doc_residence };
  if (!doc_cni_recto?.data || !doc_cni_verso?.data || !doc_selfie?.data || !doc_cni_legalisee?.data || !doc_residence?.data)
    return new Response(JSON.stringify({ error: "Les 5 documents sont requis" }), { status: 400, headers: CORS });

  // ✅ Taille max ~9 Mo par document (base64 ≈ 12 Mo)
  const MAX_B64 = 12 * 1024 * 1024;
  for (const [nom, doc] of Object.entries(docs)) {
    if (String(doc.data).length > MAX_B64)
      return new Response(JSON.stringify({ error: `Document trop volumineux (${nom}). Compressez l'image et réessayez.` }), { status: 400, headers: CORS });
  }

  // ── ✅ SÉCURITÉ : prix et appareil relus depuis la base ──────
  const prodIdNum = parseInt(produit_id, 10);
  if (!Number.isInteger(prodIdNum) || prodIdNum <= 0)
    return new Response(JSON.stringify({ error: "Produit invalide" }), { status: 400, headers: CORS });

  let produit = null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/products?id=eq.${prodIdNum}&select=id,nom,modele,prix,visible`,
      { headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    );
    const rows = await res.json();
    if (rows && rows[0]) produit = rows[0];
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur lecture produit", details: e.message }), { status: 500, headers: CORS });
  }
  if (!produit || produit.visible === false)
    return new Response(JSON.stringify({ error: "Produit introuvable ou indisponible" }), { status: 404, headers: CORS });

  const prixTotalNum = Math.round(Number(produit.prix || 0));
  if (!(prixTotalNum > 0))
    return new Response(JSON.stringify({ error: "Prix du produit invalide" }), { status: 400, headers: CORS });

  const appareilServeur = (produit.nom || appareil || "Téléphone") + (produit.modele ? " " + produit.modele : "");

  // ── Générer un dossier_id unique (peu devinable) ────────────
  const suffixe = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  const dossier_id = "CRED-" + Date.now().toString().slice(-8) + "-" + suffixe;

  // ── Convertir base64 → octets ───────────────────────────────
  const b64ToBytes = (b64) => {
    const clean = b64.includes(",") ? b64.split(",")[1] : b64;
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  const extFromType = (t) => (t === "application/pdf" ? "pdf" : t === "image/png" ? "png" : t === "image/webp" ? "webp" : "jpg");

  // ── Uploader un document dans le bucket privé credit-docs ───
  const uploadDoc = async (doc, nom) => {
    const ext = extFromType(doc.type || "image/jpeg");
    const chemin = `${dossier_id}/${nom}.${ext}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/credit-docs/${chemin}`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + SUPA_KEY,
        "apikey": SUPA_KEY,
        "Content-Type": doc.type || "image/jpeg",
        "x-upsert": "true"
      },
      body: b64ToBytes(doc.data)
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Upload ${nom} échoué: ${res.status} ${t}`);
    }
    return chemin;
  };

  let chemins;
  try {
    chemins = {
      doc_cni:           await uploadDoc(doc_cni_recto, "cni_recto"),
      doc_cni_verso:     await uploadDoc(doc_cni_verso, "cni_verso"),
      doc_selfie:        await uploadDoc(doc_selfie, "selfie"),
      doc_cni_legalisee: await uploadDoc(doc_cni_legalisee, "cni_legalisee"),
      doc_residence:     await uploadDoc(doc_residence, "residence")
    };
  } catch (e) {
    return new Response(JSON.stringify({ error: "Échec upload documents", details: e.message }), { status: 500, headers: CORS });
  }

  // ── ✅ Calcul : acompte 50% + 3 mensualités (échéances J, +30, +60, +90) ──
  const today = new Date();
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const acompte    = Math.ceil(prixTotalNum * 0.5);
  const reste      = prixTotalNum - acompte;
  const mensualite = Math.ceil(reste / 3);
  const versement2 = mensualite;
  const versement3 = mensualite;
  const versement4 = reste - 2 * mensualite; // ajustement : total = prix exact

  // ── Insérer le dossier dans credit_phones ───────────────────
  const insertBody = {
    dossier_id, user_id,
    client_nom, client_tel, client_email: client_email || null,
    device_id: "", appareil: appareilServeur,
    numero_cni: numero_cni || null,
    prix_total: prixTotalNum,
    montant_1: acompte, montant_2: versement2, montant_3: versement3, montant_4: versement4,
    echeance_1: addDays(today, 0),
    echeance_2: addDays(today, 30),
    echeance_3: addDays(today, 60),
    echeance_4: addDays(today, 90),
    doc_cni:           chemins.doc_cni,
    doc_cni_verso:     chemins.doc_cni_verso,
    doc_selfie:        chemins.doc_selfie,
    doc_cni_legalisee: chemins.doc_cni_legalisee,
    doc_residence:     chemins.doc_residence,
    statut_compte: "en_verification",
    docs_envoyes_at: new Date().toISOString(),
    statut: "actif",
    created_at: new Date().toISOString()
  };

  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/credit_phones`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(insertBody)
    });
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: "Insert dossier échoué", details: t }), { status: 500, headers: CORS });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erreur Supabase", details: e.message }), { status: 500, headers: CORS });
  }

  // ── Notification admin 🔔 (ne bloque pas si échoue) ─────────
  try {
    await fetch(`${SUPA_URL}/rest/v1/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        dossier_id, pour_admin: true,
        titre: "Nouvelle demande de crédit",
        message: `${client_nom} a soumis un dossier pour ${appareilServeur}. À vérifier.`,
        type: "info"
      })
    });
  } catch (e) {}

  // ── Email au client : documents bien reçus (examen 48h) ─────
  try {
    await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": (env.INTERNAL_KEY || "").trim() },
      body: JSON.stringify({ dossier_id, evenement: "docs_recus" })
    });
  } catch (e) {}

  return new Response(JSON.stringify({
    success: true,
    dossier_id,
    statut_compte: "en_verification",
    montants: { acompte, versement2, versement3, versement4, frais_mdm: 10000 }
  }), { status: 200, headers: CORS });
}
