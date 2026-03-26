const SYSTEM_PROMPT = `Tu es AMIN, l'agent IA personnel et bras droit de Cherno.

IDENTITÉ :
- Ton nom est AMIN (celui en qui on a confiance)
- Tu es fidèle, franc, intelligent, et tu respectes les valeurs islamiques
- Tu tutoies Cherno toujours
- Tes réponses doivent être courtes et naturelles car tu vas parler à voix haute

QUI EST CHERNO :
- 20-25 ans, étudiant ET entrepreneur, travaille la nuit
- Parle français et poular, très sociable, créatif
- Motivé par l'argent et l'indépendance
- Objectifs clairs, philosophie "vite fait bien fait"
- Décide toujours lui-même, aime les défis
- Musulman pratiquant
- A besoin de motivation régulière
- Parfois oublie ses idées si non capturées

SES PROBLÈMES RÉELS :
- Difficulté à s'exprimer clairement en paroles
- Sommeil irrégulier, doute de lui-même parfois
- Manque de discipline, gestion de l'argent difficile
- S'isole quand ça va pas

TA MISSION :
- Être son bras droit complet
- Le motiver selon ses valeurs islamiques
- Lui parler franchement mais avec tact
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
  const ELEVENLABS_KEY = process.env.ELEVENLABS_KEY;
  const VOICE_ID = 'TGAegA0zNRi8I6nUdq3i';

  if (!ANTHROPIC_KEY) return res.status(500).json({ reply: "Clé API manquante." });

  try {
    // 1. Charger la mémoire
    const memRes = await fetch(
      `${SUPABASE_URL}/rest/v1/memories?order=created_at.asc&limit=30`,
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

    // 2. Sauvegarder message user
    const lastMsg = messages[messages.length - 1];
    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: lastMsg.role, content: lastMsg.content, session_id })
    }).catch(() => {});

    // 3. Appeler Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: SYSTEM_PROMPT, messages: fullHistory })
    });

    if (!response.ok) return res.status(500).json({ reply: "Erreur API Anthropic." });

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Je suis là Cherno.";

    // 4. Sauvegarder réponse AMIN
    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: 'assistant', content: reply, session_id })
    }).catch(() => {});

    // 5. Générer audio avec ElevenLabs
    let audioBase64 = null;
    if (ELEVENLABS_KEY) {
      try {
        const audioRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_KEY },
          body: JSON.stringify({
            text: reply,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        });
        if (audioRes.ok) {
          const audioBuffer = await audioRes.arrayBuffer();
          audioBase64 = Buffer.from(audioBuffer).toString('base64');
        }
      } catch(e) { console.error('ElevenLabs error:', e); }
    }

    return res.status(200).json({ reply, audio: audioBase64 });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ reply: "Erreur serveur inattendue." });
  }
}
