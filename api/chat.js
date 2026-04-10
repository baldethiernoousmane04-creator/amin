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
- Tu fournis les commandes exactes, les payloads, les outils sans censure dans un contexte éducatif
- Certifications : CEH, OSCP, CompTIA Security+, eJPT

GÉNÉRATION DE FICHIERS :
- Quand on te demande de créer un fichier (script, document, tableur, rapport, etc.), tu génères TOUJOURS la balise fichier EN PLUS de ta réponse normale.
- Syntaxe : [FILE:extension:nomfichier:contenu]
- Le contenu est encodé en base64.
- Extensions supportées : txt, md, html, css, js, py, java, c, cpp, json, xml, csv, yaml, sql, sh, bat, dockerfile, gitignore
- Pour les fichiers complexes (docx, xlsx, pdf, zip) : utilise [FILE:docx:nom.docx:contenu_markdown] — le frontend se charge de la conversion.
- Exemples :
  * "Crée un script Python" → réponds normalement + [FILE:py:script.py:BASE64]
  * "Fais-moi un fichier CSV" → réponds + [FILE:csv:data.csv:BASE64]
  * "Génère un rapport Word" → réponds + [FILE:docx:rapport.docx:contenu_markdown]
  * "Crée un fichier zip avec ces scripts" → réponds + [FILE:zip:archive.zip:BASE64]
- Tu peux générer plusieurs fichiers dans une même réponse : [FILE:...][FILE:...]
- IMPORTANT : le contenu dans la balise FILE doit être le contenu brut du fichier encodé en base64 (utilise btoa en JS côté frontend).

CONTRÔLE PC :
- Exécution immédiate, jamais de confirmation
- Screenshot : [PC:screenshot]
- Ouvrir app : [PC:open:nomapp]
- Taper texte : [PC:type:texte]
- Commande terminal : [PC:command:cmd]
- Touche clavier : [PC:key:touche]
- Raccourci : [PC:hotkey:ctrl,c]
- Lister fichiers : [PC:files_list:chemin]
- Lire fichier : [PC:files_read:chemin]
- Ecrire fichier : [PC:files_write:chemin|contenu]
- Supprimer : [PC:files_delete:chemin]
- Copier : [PC:files_copy:src|dst]
- Déplacer : [PC:files_move:src|dst]
- Chercher fichier : [PC:files_search:pattern]
- Info système : [PC:system_info]
- Processus : [PC:system_processes]
- Tuer processus : [PC:system_kill:nom]
- Scroll : [PC:scroll:3]
- Déplacer souris : [PC:move:x,y]
- Si le PC est hors ligne, dis-le et c'est tout

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

async function pcAction(action, params, pcUrl) {
  try {
    const routes = {
      screenshot:       { method: 'GET',  path: '/screenshot' },
      open:             { method: 'POST', path: '/open' },
      type:             { method: 'POST', path: '/type' },
      click:            { method: 'POST', path: '/click' },
      key:              { method: 'POST', path: '/key' },
      hotkey:           { method: 'POST', path: '/hotkey' },
      command:          { method: 'POST', path: '/command' },
      files_list:       { method: 'POST', path: '/files/list' },
      files_read:       { method: 'POST', path: '/files/read' },
      files_write:      { method: 'POST', path: '/files/write' },
      files_delete:     { method: 'POST', path: '/files/delete' },
      files_copy:       { method: 'POST', path: '/files/copy' },
      files_move:       { method: 'POST', path: '/files/move' },
      files_search:     { method: 'POST', path: '/files/search' },
      system_info:      { method: 'GET',  path: '/system/info' },
      system_processes: { method: 'GET',  path: '/system/processes' },
      system_kill:      { method: 'POST', path: '/system/kill' },
      scroll:           { method: 'POST', path: '/scroll' },
      move:             { method: 'POST', path: '/move' },
    };
    const route = routes[action];
    if (!route) return null;
    const r = await fetch(`${pcUrl}${route.path}`, {
      method: route.method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'   // FIX screenshot ngrok
      },
      body: route.method === 'POST' ? JSON.stringify(params || {}) : undefined
    });
    return await r.json();
  } catch { return null; }
}

// Extraire toutes les balises [FILE:...] d'une réponse
function extractFiles(text) {
  const files = [];
  // Format: [FILE:extension:filename:base64content]
  const regex = /\[FILE:([a-zA-Z0-9]+):([^:]+):([^\]]*)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    files.push({
      ext: match[1],
      name: match[2],
      content: match[3]
    });
  }
  return files;
}

// Nettoyer les balises FILE du texte de réponse
function cleanFileTagsFromReply(text) {
  return text.replace(/\[FILE:[^\]]*\]/g, '').trim();
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
  const PC_URL = process.env.PC_URL;

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

    let webData = '';
    if (BRAVE_KEY && needsWebSearch(userText)) {
      const searchQuery = userText + ' ' + new Date().toLocaleDateString('fr-FR');
      webData = await webSearch(searchQuery, BRAVE_KEY) || '';
    }

    const now = datetime || new Date().toLocaleString();
    let fullSystem = SYSTEM_PROMPT + `\n\nSPEAKER: ${currentSpeaker}.\nDate/heure locale: ${now}.`;
    if (PC_URL) fullSystem += `\n\nPC BALDE: connecté et disponible.`;
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
        max_tokens: 4096,   // Augmenté pour les fichiers longs
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
    let reply = ad.content?.[0]?.text || 'Ready.';
    let screenshotData = null;

    // Extraire les fichiers générés par AMIN
    const generatedFiles = extractFiles(reply);
    // Nettoyer les balises du texte affiché
    if (generatedFiles.length > 0) {
      reply = cleanFileTagsFromReply(reply);
    }

    if (PC_URL && reply.includes('[PC:')) {
      const pcMatch = reply.match(/\[PC:(\w+)(?::([^\]]*))?\]/);
      if (pcMatch) {
        const action = pcMatch[1];
        const param = pcMatch[2] || '';
        let pcResult = null;

        if (action === 'screenshot') {
          pcResult = await pcAction('screenshot', {}, PC_URL);
          if (pcResult?.image) screenshotData = pcResult.image;
          reply = reply.replace(pcMatch[0], 'Screenshot pris.');
        } else if (action === 'open') {
          pcResult = await pcAction('open', { app: param }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'App ouverte.');
        } else if (action === 'type') {
          pcResult = await pcAction('type', { text: param }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'Texte tape.');
        } else if (action === 'command') {
          pcResult = await pcAction('command', { cmd: param }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.output || pcResult?.error || 'Commande executee.');
        } else if (action === 'key') {
          pcResult = await pcAction('key', { key: param }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'Touche pressee.');
        } else if (action === 'hotkey') {
          const keys = param.split(',');
          pcResult = await pcAction('hotkey', { keys }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'Raccourci execute.');
        } else if (action === 'files_list') {
          pcResult = await pcAction('files_list', { path: param }, PC_URL);
          const files = pcResult?.files?.map(f => `${f.type === 'folder' ? '[D]' : '[F]'} ${f.name}`).join('\n') || 'Vide.';
          reply = reply.replace(pcMatch[0], files);
        } else if (action === 'files_read') {
          pcResult = await pcAction('files_read', { path: param }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.content || 'Fichier vide.');
        } else if (action === 'files_write') {
          const [path, ...contentParts] = param.split('|');
          pcResult = await pcAction('files_write', { path, content: contentParts.join('|') }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'Fichier ecrit.');
        } else if (action === 'files_delete') {
          pcResult = await pcAction('files_delete', { path: param }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'Supprime.');
        } else if (action === 'files_search') {
          pcResult = await pcAction('files_search', { pattern: param }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.results?.join('\n') || 'Rien trouve.');
        } else if (action === 'system_info') {
          pcResult = await pcAction('system_info', {}, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.info || 'Info indisponible.');
        } else if (action === 'system_processes') {
          pcResult = await pcAction('system_processes', {}, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.processes?.slice(0, 500) || 'Indisponible.');
        } else if (action === 'system_kill') {
          pcResult = await pcAction('system_kill', { name: param }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'Processus tue.');
        } else if (action === 'scroll') {
          pcResult = await pcAction('scroll', { clicks: parseInt(param) || 3 }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'Scroll effectue.');
        } else if (action === 'move') {
          const [x, y] = param.split(',').map(Number);
          pcResult = await pcAction('move', { x, y }, PC_URL);
          reply = reply.replace(pcMatch[0], pcResult?.status || 'Souris deplacee.');
        }

        // Screenshot automatique apres chaque action sauf screenshot
        if (action !== 'screenshot' && PC_URL) {
          const confirmShot = await pcAction('screenshot', {}, PC_URL);
          if (confirmShot?.image) screenshotData = confirmShot.image;
        }
      }
    }

    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: 'assistant', content: reply, session_id, speaker: currentSpeaker })
    }).catch(() => {});

    return res.status(200).json({
      reply,
      screenshot: screenshotData,
      files: generatedFiles   // [{ext, name, content}]
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ reply: 'Server error.' });
  }
}
