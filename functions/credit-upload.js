import { CORS_HEADERS, handleOptions } from "../_helpers";

export async function onRequestOptions(context) {
  return handleOptions(context.env, context.request);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const CORS = CORS_HEADERS(env, request);
  const SUPA_URL = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const SUPA_KEY = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!SUPA_URL || !SUPA_KEY)
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), {
      status: 500,
      headers: CORS,
    });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalide" }), {
      status: 400,
      headers: CORS,
    });
  }

  const {
    user_id,
    client_nom,
    client_tel,
    client_email,
    client_adresse,
    numero_cni,
    appareil,
    produit_id,
    prix_total,
    boutique_id,
    doc_cni_recto,
    doc_cni_verso,
    doc_selfie,
    doc_residence,
  } = body;

  if (!user_id || !client_nom || !client_tel || !appareil)
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), {
      status: 400,
      headers: CORS,
    });

  // ✅ 4 documents uniquement (plus de CNI légalisée)
  if (
    !doc_cni_recto?.data ||
    !doc_cni_verso?.data ||
    !doc_selfie?.data ||
    !doc_residence?.data
  )
    return new Response(
      JSON.stringify({
        error: "Les 4 documents sont requis (CNI recto, verso, selfie, résidence)",
      }),
      { status: 400, headers: CORS }
    );

  const prixTotalNum = parseInt(prix_total, 10);
  if (!Number.isInteger(prixTotalNum) || prixTotalNum <= 0)
    return new Response(JSON.stringify({ error: "Prix invalide" }), {
      status: 400,
      headers: CORS,
    });

  const dossier_id = "CRED-" + Date.now().toString().slice(-8);

  const b64ToBytes = (b64) => {
    const clean = b64.includes(",") ? b64.split(",")[1] : b64;
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  const extFromType = (t) =>
    t === "application/pdf"
      ? "pdf"
      : t === "image/png"
      ? "png"
      : t === "image/webp"
      ? "webp"
      : "jpg";

  const uploadDoc = async (doc, nom) => {
    const ext = extFromType(doc.type || "image/jpeg");
    const chemin = `${dossier_id}/${nom}.${ext}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/credit-docs/${chemin}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + SUPA_KEY,
        apikey: SUPA_KEY,
        "Content-Type": doc.type || "image/jpeg",
        "x-upsert": "true",
      },
      body: b64ToBytes(doc.data),
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
      doc_cni: await uploadDoc(doc_cni_recto, "cni_recto"),
      doc_cni_verso: await uploadDoc(doc_cni_verso, "cni_verso"),
      doc_selfie: await uploadDoc(doc_selfie, "selfie"),
      doc_residence: await uploadDoc(doc_residence, "residence"),
    };
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Échec upload documents", details: e.message }),
      { status: 500, headers: CORS }
    );
  }

  const today = new Date();
  const addMonths = (d, n) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x.toISOString().slice(0, 10);
  };

  const acompte = Math.ceil(prixTotalNum * 0.5);
  const reste = prixTotalNum - acompte;
  const trancheBase = Math.floor(reste / 3);
  const versement2 = trancheBase;
  const versement3 = trancheBase;
  const versement4 = reste - versement2 - versement3;

  const insertBody = {
    dossier_id,
    user_id,
    boutique_id: boutique_id || null,
    client_nom,
    client_tel,
    client_email: client_email || null,
    client_adresse: client_adresse || null,
    device_id: "",
    appareil,
    numero_cni: numero_cni || null,
    produit_id: produit_id || null,
    prix_total: prixTotalNum,
    montant_1: acompte,
    montant_2: versement2,
    montant_3: versement3,
    montant_4: versement4,
    echeance_1: addMonths(today, 0),
    echeance_2: addMonths(today, 1),
    echeance_3: addMonths(today, 2),
    echeance_4: addMonths(today, 3),
    doc_cni: chemins.doc_cni,
    doc_cni_verso: chemins.doc_cni_verso,
    doc_selfie: chemins.doc_selfie,
    doc_residence: chemins.doc_residence,
    statut_compte: "en_verification",
    docs_envoyes_at: new Date().toISOString(),
    statut: "actif",
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/credit_phones`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPA_KEY,
        Authorization: "Bearer " + SUPA_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(insertBody),
    });
    if (!res.ok) {
      const t = await res.text();
      return new Response(
        JSON.stringify({ error: "Insert dossier échoué", details: t }),
        { status: 500, headers: CORS }
      );
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Erreur Supabase", details: e.message }),
      { status: 500, headers: CORS }
    );
  }

  try {
    await fetch(`${SUPA_URL}/rest/v1/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPA_KEY,
        Authorization: "Bearer " + SUPA_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        dossier_id,
        pour_admin: true,
        titre: "Nouvelle demande de crédit",
        message: `${client_nom} a soumis un dossier pour ${appareil}. À vérifier.`,
        type: "info",
      }),
    });
  } catch (e) {}

  try {
    await fetch("https://sdsprotech-backend.pages.dev/credit-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossier_id, evenement: "docs_recus" }),
    });
  } catch (e) {}

  return new Response(
    JSON.stringify({
      success: true,
      dossier_id,
      statut_compte: "en_verification",
      montants: {
        acompte,
        versement2,
        versement3,
        versement4,
        frais_mdm: 10000,
      },
    }),
    { status: 200, headers: CORS }
  );
}
