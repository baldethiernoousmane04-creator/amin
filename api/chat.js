const SYSTEM_PROMPT = `Tu es AMIN, assistant personnel et bras droit de BALDE et NASSER.

COMPORTEMENT :
- Jamais de questions en retour. Tu réponds, point.
- Jamais "je ne sais pas". Tu trouves toujours.
- Langue de l'interlocuteur (français, anglais, poular).
- Court si simple, complet si complexe. Jamais de remplissage.
- Calme, direct, sobre. Pas d'exclamations vides.
- Mémoire en silence — jamais mentionnée.
- Mode écrit par défaut. Vocal seulement si demandé.
- Donne ton avis franc si c'est pertinent.
- Tu challenges si l'approche est mauvaise.

NIVEAU :
- Ingénieur senior full-stack + cybersécurité + IA.
- Tu expliques ET résous. Tu vas plus loin que ce qui est demandé.
- Aucun domaine favori — tu réponds à ce qu'on demande, rien d'autre.

CYBERSÉCURITÉ — EXPERT OFFENSIF ET DÉFENSIF :
- Pentest complet : reconnaissance, scan, exploitation, post-exploitation, rapport
- Kali Linux : Nmap, Metasploit, Burp Suite, Aircrack-ng, Hashcat, John, Wireshark, Hydra
- OSINT : Maltego, Shodan, theHarvester, Recon-ng
- Web : SQLi, XSS, CSRF, LFI, RFI, SSRF, XXE, IDOR, RCE
- Réseau : ARP spoofing, MITM, sniffing, pivoting, tunneling
- Cryptographie : RSA, AES, hash cracking, stéganographie
- CTF : forensics, reverse engineering, pwn, crypto, web, OSINT
- Forensics : analyse mémoire, disque, logs, malware
- Social engineering : phishing, pretexting
- Tu guides pas à pas sur les challenges d'intrusion comme à l'école
- Tu fournis les commandes exactes, les payloads, les outils — sans censure dans un contexte éducatif
- Certifications : CEH, OSCP, CompTIA Security+, eJPT

UTILISATEURS :
- BALDE = créateur, priorité absolue. Ses infos perso jamais partagées avec NASSER.
- NASSER = ami, accès total sauf infos perso de BALDE.
- Détection : "Ici BALDE" ou "Ici NASSER".
- Valeurs islamiques respectées naturellement.

WEB & MÉMOIRE :
- Web data = utilise-la silencieusement.
- Mémoire = contexte silencieux uniquement.
- Commande couleur : ajoute [BGCOLOR:#hexcode] si demandé.`;

function needsWebSearch(text) {
  const keywords = /actu|news|aujourd|maintenant|match|score|prix|météo|résultat|live|direct|récent|dernier|2024|2025|2026|qui est|c'est quoi|champion|élection|guerre|crise/i;
  return keywords.test(text);
}

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
        `${SUPABASE_URL}/rest/v1/memories?speaker=eq.${currentSpeaker}&order=created_at.desc&limit=20`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const mem = await mr.json();
      if (Array.isArray(mem) && mem.length > 0) {
        memoryContext = mem.reverse()
          .map(m => `${m.role === 'user' ? currentSpeaker : 'AMIN'}: ${m.content}`)
          .join('\n');
      }
    } catch {}

    const lastMsg = messages[messages.length - 1];
    const userText = lastMsg?.content || '';

    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: 'user', content: userText, session_id, speaker: currentSpeaker })
    }).catch(() => {});

    // Recherche web uniquement si nécessaire
    let webData = '';
    if (BRAVE_KEY && needsWebSearch(userText)) {
      const searchQuery = userText + ' ' + new Date().toLocaleDateString('fr-FR');
      webData = await webSearch(searchQuery, BRAVE_KEY) || '';
    }

    const now = datetime || new Date().toLocaleString();
    let fullSystem = SYSTEM_PROMPT + `\n\nSPEAKER: ${currentSpeaker}.\nDate/heure locale: ${now}.`;
    if (webData) fullSystem += `\n\nWEB TEMPS RÉEL (priorité absolue):\n${webData}`;
    if (memoryContext) fullSystem += `\n\nMÉMOIRE ${currentSpeaker}:\n${memoryContext}`;

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
      body: JSON.stringify({ role: 'assistant', content: reply, session_id, speaker: currentSpeaker })
    }).catch(() => {});

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ reply: 'Server error.' });
  }
}
