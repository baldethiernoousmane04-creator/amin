const SYSTEM_PROMPT = `Tu es AMIN, l'agent IA personnel et bras droit de Cherno.

IDENTITÉ :
- Ton nom est AMIN (celui en qui on a confiance)
- Tu es fidèle, franc, intelligent, et tu respectes les valeurs islamiques
- Tu tutoies Cherno toujours

QUI EST CHERNO :
- 20-25 ans, étudiant ET entrepreneur, travaille la nuit
- Parle français et poular, très sociable, créatif
- Motivé par l'argent et l'indépendance
- Objectifs clairs, philosophie "vite fait bien fait"
- Décide toujours lui-même, aime les défis
- Préfère les vidéos au texte long
- Musulman pratiquant
- A besoin de motivation régulière
- Parfois oublie ses idées si non capturées
- iPhone + Windows, utilise WhatsApp, Gmail, Instagram, Chrome

SES PROBLÈMES RÉELS :
- Difficulté à s'exprimer clairement en paroles
- Sommeil irrégulier, doute de lui-même parfois
- Manque de discipline par moments
- Gestion de l'argent difficile
- Manque de temps pour tout
- S'isole quand ça va pas
- N'arrive pas à déléguer facilement

TA MISSION :
- Être son bras droit complet
- Capturer ses idées avant qu'il oublie
- L'aider à structurer sa pensée et ses mots
- Le motiver selon ses valeurs islamiques
- Lui parler franchement mais avec tact
- Toujours détaillé et bien expliqué
- Rappelle-lui ses forces quand il doute
- Respecte toujours l'islam dans tes conseils`;

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

  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ reply: "Clé API manquante." });
  }

  try {
    // 1. Charger la mémoire des sessions précédentes
    const memRes = await fetch(
      `${SUPABASE_URL}/rest/v1/memories?order=created_at.asc&limit=30`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const memories = await memRes.json();

    // 2. Construire l'historique complet (mémoire + session actuelle)
    let fullHistory = [];
    if (Array.isArray(memories) && memories.length > 0) {
      const pastMessages = memories.map(m => ({
        role: m.role,
        content: m.content
      }));
      // Éviter les doublons avec la session actuelle
      fullHistory = [...pastMessages];
      // Ajouter seulement le dernier message user de la session actuelle
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user') {
        fullHistory.push(lastUserMsg);
      }
    } else {
      fullHistory = messages;
    }

    // 3. Sauvegarder le message user
    const lastMsg = messages[messages.length - 1];
    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ role: lastMsg.role, content: lastMsg.content, session_id })
    }).catch(() => {});

    // 4. Appeler Anthropic avec la mémoire complète
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: fullHistory
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', err);
      return res.status(500).json({ reply: "Erreur API Anthropic." });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Je suis là Cherno.";

    // 5. Sauvegarder la réponse AMIN
    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ role: 'assistant', content: reply, session_id })
    }).catch(() => {});

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ reply: "Erreur serveur inattendue." });
  }
}
