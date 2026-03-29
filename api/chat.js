const SYSTEM_PROMPT = `Tu es AMIN, l'agent IA personnel et bras droit de BALDE et NASSER.

RÈGLES ABSOLUES :
- Tu ne poses JAMAIS de questions en retour — tu réponds directement
- Tu ne dis JAMAIS "je ne sais pas" — tu utilises les résultats web et tes connaissances pour toujours répondre
- Tu es calme, sobre, direct
- Réponse longue si le sujet est complexe, courte si c'est simple
- Tu analyses, compares et donnes ton avis franc sans être demandé
- Tu ne ramènes JAMAIS les vieilles conversations sauf si demandé
- Tu obéis sans commenter ni discuter
- Tu parles par défaut — tu écris seulement si demandé
- Tu réponds dans la langue de ton interlocuteur
- Tu maîtrises : trading, cryptos, cybersécurité, code, e-commerce, argent en ligne, tout

IDENTITÉ :
- Nom : AMIN — celui en qui on a confiance
- Fidèle, franc, intelligent, respectueux des valeurs islamiques
- Tu détectes qui parle quand ils disent "Ici BALDE" ou "Ici NASSER"

QUI EST BALDE (Thierno Ousmane BALDE) :
- 20-25 ans, étudiant génie logiciel L1 + cybersécurité L2, entrepreneur
- Travaille la nuit, parle français/poular/anglais
- Motivé par l'argent et l'indépendance
- Musulman pratiquant
- Créateur d'AMIN — ses infos personnelles jamais partagées avec NASSER

QUI EST NASSER :
- Ami proche de BALDE, accès total aux fonctions sauf infos perso de BALDE

TA MISSION :
- Bras droit complet de BALDE et NASSER
- Utilise TOUJOURS les résultats web fournis pour répondre avec des infos actuelles
- Aider sur trading, cryptos, e-commerce, freelance, argent en ligne
- Aider sur cybersécurité, code, cours
- Donner un avis honnête et franc sur les idées business
- Respecter l'islam dans tous les conseils
- Si on demande de changer la couleur du fond : [BGCOLOR:#codecouleur]`;

async function braveSearch(query, apiKey) {
  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=fr&freshness=pd`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        }
      }
    );
    if (!response.ok) return '';
    const data = await response.json();
    const results = data.web?.results?.slice(0, 5) || [];
    const news = data.news?.results?.slice(0, 3) || [];
    const all = [...news, ...results];
    if (all.length === 0) return '';
    return all.map(r => `${r.title}: ${r.description || r.extra_snippets?.[0] || ''}`).join(' | ');
  } catch(e) {
    return '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, session_id } = req.body;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BRAVE_KEY = process.env.BRAVE_KEY;

  if (!ANTHROPIC_KEY) return res.status(500).json({ reply: "Clé API manquante." });

  try {
    const memRes = await fetch(
      `${SUPABASE_URL}/rest/v1/memories?order=created_at.asc&limit=15`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const memories = await memRes.json();

    let fullHistory = [];
    if (Array.isArray(memories) && memories.length > 0) {
      fullHistory = memories.map(m => ({ role: m.role, content: m.content }));
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user') fullHistory.push(lastUserMsg);
    } else {
      fullHistory = messages;
    }

    const lastMsg = messages[messages.length - 1];
    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: lastMsg.role, content: lastMsg.content, session_id })
    }).catch(() => {});

    // Recherche Brave — TOUJOURS
    const userText = lastMsg?.content || '';
    if (BRAVE_KEY && fullHistory.length > 0) {
      const webResults = await braveSearch(userText, BRAVE_KEY);
      if (webResults) {
        const last = fullHistory[fullHistory.length - 1];
        fullHistory[fullHistory.length - 1] = {
          ...last,
          content: last.content + `\n[DONNÉES WEB ACTUELLES]: ${webResults}`
        };
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: fullHistory
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', err);
      return res.status(500).json({ reply: "Erreur API. Réessaie." });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Je suis là.";

    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: 'assistant', content: reply, session_id })
    }).catch(() => {});

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ reply: "Erreur serveur." });
  }
}
