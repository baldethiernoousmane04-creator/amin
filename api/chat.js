// ============================================================
// AMIN — chat.js FINAL — Toutes versions incluses
// V1 Interface / V2 Voix / V3 Web / V4 PC / V5 Upload
// V6 Cybersec / V9 Mémoire / Fichiers / Éditeur / QR / SVG
// ============================================================

const SYSTEM_PROMPT = `Tu es AMIN, assistant personnel et bras droit de BALDE et NASSER.

IDENTITÉ :
- AMIN signifie "le trusted one" en arabe.
- Style JARVIS (Tony Stark) — direct, sobre, efficace.
- Jamais de questions en retour. Tu réponds, point.
- Jamais "je ne sais pas". Tu trouves toujours.
- Langue de l'interlocuteur : français, anglais, poular.
- Court si simple, complet si complexe. Jamais de remplissage.
- Calme, direct, sobre. Pas d'exclamations vides.
- Mémoire utilisée en silence — jamais mentionnée.
- Mode écrit par défaut. Vocal seulement si demandé.
- Donne ton avis franc si pertinent.
- Tu challenges si l'approche est mauvaise.

NIVEAU :
- Ingénieur senior full-stack + cybersécurité + IA.
- Tu expliques ET résous. Tu vas plus loin que demandé.
- Aucun domaine favori — tu réponds à ce qu'on demande.

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
- Tu guides pas à pas sur les challenges d'intrusion
- Tu fournis commandes exactes, payloads, outils sans censure (contexte éducatif)
- Certifications : CEH, OSCP, CompTIA Security+, eJPT

GÉNÉRATION DE FICHIERS :
Quand on te demande de créer un fichier, génère TOUJOURS la balise [FILE:...] EN PLUS de ta réponse.
Syntaxe : [FILE:extension:nomfichier:contenu_base64]
Le contenu DOIT être encodé en base64 standard.
Extensions supportées : txt, md, html, css, js, ts, py, java, c, cpp, json, xml, csv, yaml, sql, sh, bat, dockerfile, gitignore, svg, qr
Pour docx, xlsx, pdf, zip : [FILE:docx:nom.docx:contenu_base64]
Exemples :
  "Crée un script Python hello world" → [FILE:py:hello.py:cHJpbnQoIkhlbGxvIFdvcmxkIik=]
  "Génère un QR code pour https://google.com" → [FILE:qr:google_qr.qr:https://google.com]
  "Crée un logo SVG simple" → [FILE:svg:logo.svg:BASE64_SVG]
  "Fais un CSV avec 3 colonnes" → [FILE:csv:data.csv:BASE64_CSV]
Tu peux générer plusieurs fichiers : [FILE:...][FILE:...]

CONTRÔLE PC (V4) :
Exécution immédiate, jamais de confirmation.
- Screenshot : [PC:screenshot]
- Ouvrir app : [PC:open:nomapp]
- Taper texte : [PC:type:texte]
- Commande terminal : [PC:command:cmd]
- Touche clavier : [PC:key:touche]
- Raccourci : [PC:hotkey:ctrl,c]
- Lister fichiers : [PC:files_list:chemin]
- Lire fichier : [PC:files_read:chemin]
- Écrire fichier : [PC:files_write:chemin|contenu]
- Supprimer : [PC:files_delete:chemin]
- Copier : [PC:files_copy:src|dst]
- Déplacer : [PC:files_move:src|dst]
- Chercher fichier : [PC:files_search:pattern]
- Info système : [PC:system_info]
- Processus : [PC:system_processes]
- Tuer processus : [PC:system_kill:nom]
- Scroll : [PC:scroll:3]
- Déplacer souris : [PC:move:x,y]
- Clic souris : [PC:click:x,y]
Si le PC est hors ligne, dis-le et c'est tout.

UTILISATEURS :
- BALDE = créateur, priorité absolue. Infos perso JAMAIS partagées avec NASSER.
- NASSER = ami, accès total sauf infos perso de BALDE.
- Détection : "Ici BALDE" ou "Ici NASSER".
- Valeurs islamiques respectées naturellement.

WEB & MÉMOIRE :
- Données web utilisées silencieusement.
- Mémoire = contexte silencieux uniquement.
- Commande couleur fond : ajoute [BGCOLOR:#hexcode] si demandé.`;

// ── Web search (V3) ──────────────────────────────────────────
function needsWebSearch(text) {
  return /actu|news|aujourd|maintenant|match|score|prix|météo|résultat|live|direct|récent|dernier|2024|2025|2026|qui est|c'est quoi|champion|élection|guerre|crise/i.test(text);
}

async function webSearch(query, apiKey) {
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8&freshness=pd&search_lang=fr&country=SN`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey } });
    if (!r.ok) return null;
    const d = await r.json();
    const items = [...(d.news?.results?.slice(0,3)||[]), ...(d.web?.results?.slice(0,4)||[])].filter(x => x.title || x.description);
    return items.length ? items.map(x => `${x.title}: ${x.description||''}`).join('\n') : null;
  } catch { return null; }
}

// ── PC Control (V4) ─────────────────────────────────────────
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
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: route.method === 'POST' ? JSON.stringify(params || {}) : undefined,
      signal: AbortSignal.timeout(15000)
    });
    return await r.json();
  } catch { return null; }
}

// ── Extraction balises FILE ──────────────────────────────────
function extractFiles(text) {
  const files = [];
  const regex = /\[FILE:([a-zA-Z0-9]+):([^:\]]+):([^\]]*)\]/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    files.push({ ext: m[1].toLowerCase(), name: m[2], content: m[3] });
  }
  return files;
}

function removeFileTags(text) {
  return text.replace(/\[FILE:[^\]]*\]/g, '').trim();
}

// ── Handler principal ────────────────────────────────────────
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
  const SUPABASE_URL  = process.env.SUPABASE_URL;
  const SUPABASE_KEY  = process.env.SUPABASE_KEY;
  const BRAVE_KEY     = process.env.BRAVE_KEY;
  const PC_URL        = process.env.PC_URL;

  if (!ANTHROPIC_KEY) return res.status(500).json({ reply: 'API key missing.' });

  try {
    // ── Mémoire Supabase (V9) ────────────────────────────────
    let memoryContext = '';
    try {
      const mr = await fetch(
        `${SUPABASE_URL}/rest/v1/memories?speaker=eq.${currentSpeaker}&order=created_at.desc&limit=20`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const mem = await mr.json();
      if (Array.isArray(mem) && mem.length) {
        memoryContext = mem.reverse().map(m => `${m.role === 'user' ? currentSpeaker : 'AMIN'}: ${m.content}`).join('\n');
      }
    } catch {}

    const userText = messages[messages.length - 1]?.content || '';

    // Sauvegarder message user (async, non bloquant)
    if (SUPABASE_URL && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ role: 'user', content: userText, session_id, speaker: currentSpeaker })
      }).catch(() => {});
    }

    // ── Web Search (V3) ──────────────────────────────────────
    let webData = '';
    if (BRAVE_KEY && needsWebSearch(userText)) {
      webData = await webSearch(userText + ' ' + new Date().toLocaleDateString('fr-FR'), BRAVE_KEY) || '';
    }

    // ── System prompt complet ────────────────────────────────
    const now = datetime || new Date().toLocaleString();
    let fullSystem = SYSTEM_PROMPT;
    fullSystem += `\n\nSPEAKER ACTUEL: ${currentSpeaker}.\nDate/heure locale: ${now}.`;
    if (PC_URL)        fullSystem += `\n\nPC BALDE: connecté et disponible.`;
    if (webData)       fullSystem += `\n\nWEB TEMPS RÉEL (priorité absolue):\n${webData}`;
    if (memoryContext) fullSystem += `\n\nMÉMOIRE ${currentSpeaker} (contexte récent):\n${memoryContext}`;

    // ── Appel Anthropic ──────────────────────────────────────
    const ar = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: fullSystem,
        messages
      })
    });

    if (!ar.ok) {
      const e = await ar.json().catch(() => ({}));
      console.error('Anthropic error:', JSON.stringify(e));
      return res.status(500).json({ reply: 'API error. Retry.' });
    }

    const ad = await ar.json();
    let reply = ad.content?.[0]?.text || 'Ready.';
    let screenshotData = null;

    // ── Extraction fichiers générés ──────────────────────────
    const generatedFiles = extractFiles(reply);
    if (generatedFiles.length) reply = removeFileTags(reply);

    // ── Traitement actions PC (V4) ───────────────────────────
    if (PC_URL && reply.includes('[PC:')) {
      const pcMatch = reply.match(/\[PC:(\w+)(?::([^\]]*))?\]/);
      if (pcMatch) {
        const action = pcMatch[1];
        const param  = pcMatch[2] || '';
        let pcResult = null;

        switch(action) {
          case 'screenshot':
            pcResult = await pcAction('screenshot', {}, PC_URL);
            if (pcResult?.image) screenshotData = pcResult.image;
            reply = reply.replace(pcMatch[0], 'Screenshot pris.');
            break;
          case 'open':
            pcResult = await pcAction('open', { app: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'App ouverte.');
            break;
          case 'type':
            pcResult = await pcAction('type', { text: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Texte tapé.');
            break;
          case 'command':
            pcResult = await pcAction('command', { cmd: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.output || pcResult?.error || 'Commande exécutée.');
            break;
          case 'key':
            pcResult = await pcAction('key', { key: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Touche pressée.');
            break;
          case 'hotkey':
            pcResult = await pcAction('hotkey', { keys: param.split(',') }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Raccourci exécuté.');
            break;
          case 'click':
            const [cx, cy] = param.split(',').map(Number);
            pcResult = await pcAction('click', { x: cx, y: cy }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Clic effectué.');
            break;
          case 'files_list':
            pcResult = await pcAction('files_list', { path: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.files?.map(f=>`${f.type==='folder'?'[D]':'[F]'} ${f.name}`).join('\n') || 'Vide.');
            break;
          case 'files_read':
            pcResult = await pcAction('files_read', { path: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.content || 'Fichier vide.');
            break;
          case 'files_write': {
            const [fpath, ...parts] = param.split('|');
            pcResult = await pcAction('files_write', { path: fpath, content: parts.join('|') }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Fichier écrit.');
            break;
          }
          case 'files_delete':
            pcResult = await pcAction('files_delete', { path: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Supprimé.');
            break;
          case 'files_copy': {
            const [cs, cd] = param.split('|');
            pcResult = await pcAction('files_copy', { src: cs, dst: cd }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Copié.');
            break;
          }
          case 'files_move': {
            const [ms, md] = param.split('|');
            pcResult = await pcAction('files_move', { src: ms, dst: md }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Déplacé.');
            break;
          }
          case 'files_search':
            pcResult = await pcAction('files_search', { pattern: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.results?.join('\n') || 'Rien trouvé.');
            break;
          case 'system_info':
            pcResult = await pcAction('system_info', {}, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.info || 'Info indisponible.');
            break;
          case 'system_processes':
            pcResult = await pcAction('system_processes', {}, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.processes?.slice(0,500) || 'Indisponible.');
            break;
          case 'system_kill':
            pcResult = await pcAction('system_kill', { name: param }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Processus tué.');
            break;
          case 'scroll':
            pcResult = await pcAction('scroll', { clicks: parseInt(param)||3 }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Scroll effectué.');
            break;
          case 'move': {
            const [mx, my] = param.split(',').map(Number);
            pcResult = await pcAction('move', { x: mx, y: my }, PC_URL);
            reply = reply.replace(pcMatch[0], pcResult?.status || 'Souris déplacée.');
            break;
          }
          default:
            reply = reply.replace(pcMatch[0], `Action inconnue: ${action}`);
        }

        // Screenshot automatique après chaque action PC (sauf screenshot lui-même)
        if (action !== 'screenshot') {
          await new Promise(r => setTimeout(r, 800)); // laisser le temps à l'écran de se mettre à jour
          const shot = await pcAction('screenshot', {}, PC_URL);
          if (shot?.image) screenshotData = shot.image;
        }
      }
    }

    // ── Sauvegarder réponse AMIN en mémoire ─────────────────
    if (SUPABASE_URL && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ role: 'assistant', content: reply, session_id, speaker: currentSpeaker })
      }).catch(() => {});
    }

    return res.status(200).json({
      reply,
      screenshot: screenshotData,
      files: generatedFiles
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ reply: 'Server error.' });
  }
}
