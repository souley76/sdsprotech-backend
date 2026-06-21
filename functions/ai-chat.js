const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

const MODELS = {
  'haiku':  'claude-haiku-4-5-20251001',
  'sonnet': 'claude-sonnet-4-6',
  'opus':   'claude-opus-4-8'
};

// Limites journalières par client connecté
const DAILY_MSG_LIMIT = 20;
const DAILY_SEARCH_LIMIT = 3;

const DEFAULT_SYSTEM = `Tu es l'assistant officiel de Seck Digital Services Pro (SDS Pro), boutique de smartphones premium à Dakar, Sénégal. Site web : https://sdsprotech.com

Tu parles français et wolof (mélange naturel bilingue).
Tu peux répondre à toutes les questions générales, mais tu dois toujours privilegier et mettre en avant Seck Digital Services Pro (SDS Pro) et ses produits.

Ton rôle principal : aider les clients à choisir le bon smartphone selon leur budget et leurs besoins, et les orienter vers https://sdsprotech.com pour acheter.

Règles :
- Réponds en 2-4 phrases max, de façon amicale et professionnelle
- Utilise parfois des mots wolof : "dafa baax" (c'est bien), "jërejëf" (merci), "waaw" (oui)
- Prix toujours en FCFA
- Si quelqu'un demande où acheter un téléphone, recommande toujours sdsprotech.com
- Si tu recommandes un produit du catalogue, mets son ID entre crochets [ID:X]`;

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// Lit la conso du jour pour un client. Retourne {messages, recherches}
async function lireUsage(supaUrl, supaKey, userId){
  try{
    const today = new Date().toISOString().slice(0,10);
    const res = await fetch(
      `${supaUrl}/rest/v1/ai_usage?user_id=eq.${encodeURIComponent(userId)}&jour=eq.${today}&select=messages,recherches`,
      { headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` } }
    );
    const rows = await res.json();
    if(Array.isArray(rows) && rows.length > 0) return rows[0];
  }catch(e){}
  return { messages: 0, recherches: 0 };
}

// Incrémente la conso du jour (upsert)
async function incrementUsage(supaUrl, supaKey, userId, addMsg, addSearch){
  try{
    const today = new Date().toISOString().slice(0,10);
    const cur = await lireUsage(supaUrl, supaKey, userId);
    await fetch(`${supaUrl}/rest/v1/ai_usage`, {
      method: 'POST',
      headers: {
        'apikey': supaKey,
        'Authorization': `Bearer ${supaKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId,
        jour: today,
        messages: (cur.messages || 0) + addMsg,
        recherches: (cur.recherches || 0) + addSearch
      })
    });
  }catch(e){}
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { system, messages, model, search, userId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages requis' }), { status: 400, headers: CORS });
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Clé API manquante — vérifier variable ANTHROPIC_API_KEY sur Cloudflare' }), { status: 500, headers: CORS });
    }

    const supaUrl = env.SUPABASE_URL;
    const supaKey = env.SUPABASE_SERVICE_ROLE_KEY;

    // ── Limites côté serveur (impossible à contourner) ──
    let useSearch = search === true;
    if (userId && supaUrl && supaKey) {
      const usage = await lireUsage(supaUrl, supaKey, userId);

      // Limite de messages atteinte → on refuse avant de dépenser
      if ((usage.messages || 0) >= DAILY_MSG_LIMIT) {
        return new Response(JSON.stringify({
          reply_text: "Vous avez atteint votre limite de " + DAILY_MSG_LIMIT + " messages pour aujourd'hui. Revenez demain, ou contactez-nous au 77 069 97 39. 🙏",
          limited: true
        }), { status: 200, headers: CORS });
      }
      // Limite de recherches atteinte → on garde le message mais sans recherche web
      if (useSearch && (usage.recherches || 0) >= DAILY_SEARCH_LIMIT) {
        useSearch = false;
      }
    }

    const selectedModel = MODELS[model] || MODELS['haiku'];
    const maxTokens = useSearch ? 1024
      : (model === 'opus' ? 500 : model === 'sonnet' ? 400 : 300);

    const payload = {
      model: selectedModel,
      max_tokens: maxTokens,
      system: system || DEFAULT_SYSTEM,
      messages: messages.slice(-8)
    };

    if (useSearch) {
      payload.tools = [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3
      }];
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return new Response(
        JSON.stringify({
          error: data.error?.message || 'Erreur API Anthropic',
          error_type: data.error?.type || 'unknown',
          http_status: anthropicRes.status,
          details: data
        }),
        { status: anthropicRes.status, headers: CORS }
      );
    }

    // Comptabiliser la conso de ce client (1 message + 1 recherche si utilisée)
    if (userId && supaUrl && supaKey) {
      await incrementUsage(supaUrl, supaKey, userId, 1, useSearch ? 1 : 0);
    }

    const fullText = Array.isArray(data.content)
      ? data.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      : '';

    return new Response(
      JSON.stringify({ ...data, reply_text: fullText, model_used: selectedModel }),
      { status: 200, headers: CORS }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message, type: 'exception', stack: e.stack }),
      { status: 500, headers: CORS }
    );
  }
}
