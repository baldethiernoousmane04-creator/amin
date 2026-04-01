export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { file, filename, question, datetime, speaker } = req.body;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

  if (!file || !ANTHROPIC_KEY) return res.status(400).json({ reply: 'Fichier ou clé manquante.' });

  const ext = filename?.split('.').pop().toLowerCase();
  let mediaType = 'application/pdf';
  if (['jpg','jpeg'].includes(ext)) mediaType = 'image/jpeg';
  else if (ext === 'png') mediaType = 'image/png';
  else if (ext === 'webp') mediaType = 'image/webp';
  else if (ext === 'gif') mediaType = 'image/gif';

  const isPdf = mediaType === 'application/pdf';
  const userQuestion = question || 'Analyse ce document et résume-le.';
  const now = datetime || new Date().toLocaleString();

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: file } };

  try {
    const ar = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: `Tu es AMIN, assistant de ${speaker || 'BALDE'}. Date: ${now}. Analyse le document fourni. Sois direct, précis, sans remplissage.`,
        messages: [{
          role: 'user',
          content: [contentBlock, { type: 'text', text: userQuestion }]
        }]
      })
    });

    const data = await ar.json();
    const reply = data.content?.[0]?.text || 'Impossible de lire ce fichier.';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ reply: 'Erreur serveur.' });
  }
}
