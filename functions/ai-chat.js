const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

const MODELS = {
  'haiku':  'claude-haiku-4-5-20251001',
  'sonnet': 'claude-sonnet-4-6',
  'opus':   'claude-opus-4-6'
};

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

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { system, messages, model } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages requis' }), { status: 400, headers: CORS });
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Clé API manquante — vérifier variable ANTHROPIC_API_KEY sur Cloudflare' }), { status: 500, headers: CORS });
    }

    const selectedModel = MODELS[model] || MODELS['haiku'];
    const maxTokens = model === 'opus' ? 500 : model === 'sonnet' ? 400 : 300;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens,
        system: system || DEFAULT_SYSTEM,
        messages: messages.slice(-8)
      })
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      // Retourne l'erreur exacte d'Anthropic pour debug
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

    return new Response(
      JSON.stringify({ ...data, model_used: selectedModel }),
      { status: 200, headers: CORS }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e.message,
        type: 'exception',
        stack: e.stack
      }),
      { status: 500, headers: CORS }
    );
  }
}
