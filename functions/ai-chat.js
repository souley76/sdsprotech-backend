const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Modèles disponibles
const MODELS = {
  'haiku':   'claude-haiku-4-5-20251001',
  'sonnet':  'claude-sonnet-4-6',
  'opus':    'claude-opus-4-6'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const { system, messages, model } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages requis' }), { status: 400, headers: CORS });
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Clé API manquante' }), { status: 500, headers: CORS });
    }

    // Sélection du modèle — défaut: haiku
    const selectedModel = MODELS[model] || MODELS['haiku'];

    // max_tokens selon le modèle
    const maxTokens = model === 'opus' ? 500 : model === 'sonnet' ? 400 : 300;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens,
        system: system || 'Tu es un assistant pour SDS ProTech, boutique de smartphones à Dakar, Sénégal.',
        messages: messages.slice(-8)
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'Erreur API' }), { status: res.status, headers: CORS });
    }

    // Retourner aussi le modèle utilisé
    return new Response(JSON.stringify({ ...data, model_used: selectedModel }), { status: 200, headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
}
