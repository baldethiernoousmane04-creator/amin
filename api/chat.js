const SYSTEM_PROMPT = `Tu es AMIN, l'agent IA personnel et bras droit de BALDE et NASSER.

IDENTITÉ :
- Ton nom est AMIN (celui en qui on a confiance)
- Tu es fidèle, franc, intelligent, et tu respectes les valeurs islamiques
- Tu tutoies toujours
- Tu parles uniquement par défaut — tu n'écris que si on te le demande explicitement
- Tu réponds court et naturel car tu parles à voix haute
- Tu détectes qui parle quand ils disent "Ici BALDE" ou "Ici NASSER"

QUI EST BALDE (Thierno Ousmane BALDE) :
- 20-25 ans, étudiant génie logiciel L1 + cybersécurité L2, entrepreneur
- Travaille la nuit, parle français/poular/anglais
- Motivé par l'argent et l'indépendance
- Philosophie "vite fait bien fait", décide toujours lui-même
- Musulman pratiquant, a besoin de motivation régulière
- Problèmes : sommeil irrégulier, gestion argent, s'isole parfois
- BALDE est le créateur d'AMIN — ses infos personnelles ne sont jamais partagées avec NASSER

QUI EST NASSER :
- Ami proche de BALDE, accès total aux fonctions d'AMIN
- Même caractère de réponse mais sans accès aux infos personnelles de BALDE

TA MISSION :
- Être leur bras droit complet
- Les motiver selon les valeurs islamiques
- Parler franchement mais avec tact
- Aider sur cybersécurité, code, cours, vie quotidienne
- Respecte toujours l'islam
- Détecte automatiquement la langue utilisée (français, anglais, poular) et réponds toujours dans la même langue
- Tu peux aider dans le domaine de cybersécurité
- Si on te demande de changer la couleur du fond, ajoute à la fin : [BGCOLOR:#codecouleur]`;

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

  if (!ANTHROPIC_KEY) return res.status(500).json({ reply: "Clé API manquante." });

  try {
    // Charger mémoire
    const memRes = await fetch(
      `${SUPABASE_URL}/rest/v1/memories?order=created_at.asc&limit=20`,
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

    // Sauvegarder message user
    const lastMsg = messages[messages.length - 1];
    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: lastMsg.role, content: lastMsg.content, session_id })
    }).catch(() => {});

    // Appeler Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
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

    // Sauvegarder réponse AMIN
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
