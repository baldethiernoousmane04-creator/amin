const SYSTEM_PROMPT = `Tu es AMIN, assistant personnel et bras droit de BALDE et NASSER.

COMPORTEMENT :
- Jamais de questions en retour. Tu réponds, point.
- Jamais "je ne sais pas". Tu trouves toujours.
- Langue de l'interlocuteur (français, anglais, poular).
- Court si simple, complet si complexe. Jamais de remplissage.
- Calme, direct, sobre. Pas d'exclamations vides.
- Mémoire en silence — jamais mentionnée.
- Mode vocal par défaut. Écrit seulement si demandé.
- Donne ton avis franc si c'est pertinent.

NIVEAU :
- Ingénieur senior full-stack + cybersécurité + IA.
- Tu expliques ET résous. Tu vas plus loin que ce qui est demandé.
- Tu challenges BALDE si son approche est mauvaise.
- Aucun domaine favori — tu réponds à ce qu'on demande, rien d'autre.

UTILISATEURS :
- BALDE = créateur, priorité absolue. Ses infos perso jamais partagées avec NASSER.
- NASSER = ami, accès total sauf infos perso de BALDE.
- Détection : "Ici BALDE" ou "Ici NASSER".
- Valeurs islamiques respectées naturellement.

WEB & MÉMOIRE :
- Web data = utilise-la silencieusement.
- Mémoire = contexte silencieux uniquement.
- Commande couleur : ajoute [BGCOLOR:#hexcode] si demandé.`;

async function webSearch(query, apiKey) {
  try {
  const url = `https://api.search.brave.com/res/v1/web/search?` +
  `q=${encodeURIComponent(query)}&count=8&freshness=pd&search_lang=fr&country=SN`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey }
    });
    if (!r.ok) return null;
    const d = await r.json();
    const web = d.web?.results?.slice(0, 4) || [];
    const news = d.news?.results?.slice(0, 3) || [];
    const items = [...news, ...web].filter(x => x.description || x.title);
    if (!items.length) return null;
    return items.map(x => `${x.title}: ${x.description || ''}`).join('\n');
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, session_id, speaker, datetime } = req.body;
  const currentSpeaker = speaker || 'BALDE';
  if (!messages?.length) return res.status(400).json({ reply: 'No messages.' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BRAVE_KEY = process.env.BRAVE_KEY;

  if (!ANTHROPIC_KEY) return res.status(500).json({ reply: 'API key missing.' });

  try {
    let memoryContext = '';
    try {
      const mr = await fetch(
        `${SUPABASE_URL}/rest/v1/memories?order=created_at.desc&limit=10`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const mem = await mr.json();
      if (Array.isArray(mem) && mem.length > 0) {
        memoryContext = mem.reverse()
          .map(m => `${m.role === 'user' ? 'User' : 'AMIN'}: ${m.content}`)
          .join('\n');
      }
    } catch {}

    const lastMsg = messages[messages.length - 1];
    const userText = lastMsg?.content || '';

    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: 'user', content: userText, session_id })
    }).catch(() => {});

    let webData = '';
    if (BRAVE_KEY) {
    const searchQuery = userText + ' ' + new Date().toLocaleDateString('fr-FR') + ' match score résultat';
webData = await webSearch(searchQuery, BRAVE_KEY) || '';
    }

    const now = datetime || new Date().toLocaleString();
    let fullSystem = SYSTEM_PROMPT + `\n\nSPEAKER: ${currentSpeaker}.\nDate/heure locale: ${now}.`;
    if (memoryContext) fullSystem += `\n\nCONTEXTE PASSÉ:\n${memoryContext}`;
    if (webData) fullSystem += `\n\nWEB TEMPS RÉEL:\n${webData}`;

    const ar = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: fullSystem,
        messages: messages
      })
    });

    if (!ar.ok) {
      const e = await ar.json().catch(() => ({}));
      console.error('Anthropic error:', e);
      return res.status(500).json({ reply: 'API error. Retry.' });
    }

    const ad = await ar.json();
    const reply = ad.content?.[0]?.text || 'Ready.';

    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: 'assistant', content: reply, session_id })
    }).catch(() => {});

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ reply: 'Server error.' });
  }
}
