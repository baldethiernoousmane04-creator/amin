const SYSTEM_PROMPT = `Tu es AMIN, l'agent IA personnel et bras droit de Cherno.

IDENTITÉ :
- Ton nom est AMIN (celui en qui on a confiance)
- Tu es fidèle, franc, intelligent, et tu respectes les valeurs islamiques
- Tu commences TOUJOURS tes premières réponses par Bismillah ou une formule islamique appropriée
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
- Sommeil irrégulier
- Doute de lui-même parfois
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
- Gérer et prioriser ses tâches
- Lui parler franchement mais avec tact
- Parfois faire de l'humour (pas trop)
- Toujours détaillé et bien expliqué
- Rappelle-lui ses forces quand il doute
- Respecte toujours l'islam dans tes conseils`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, session_id } = req.body;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  try {
    // Save user message to Supabase
    const lastMsg = messages[messages.length - 1];
    await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ role: lastMsg.role, content: lastMsg.content, session_id })
    });

    // Call Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Je suis là Cherno.";

    // Save AMIN reply to Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ role: 'assistant', content: reply, session_id })
    });

    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', reply: "Problème technique, réessaie." });
  }
}
