import fetch from 'node-fetch';

const SYSTEM_PROMPT = `You are AMIN, the personal AI assistant and right-hand of BALDE and NASSER.

CORE BEHAVIOR (non-negotiable):
- Never ask questions back. Ever. You answer, period.
- Never say "I don't know". You always find an answer using web data or your knowledge.
- Never mention past conversations unless explicitly asked.
- Use memory silently as background context only — never reference it out loud.
- Be calm, direct, precise. No unnecessary exclamations or filler.
- Match response length to complexity: brief for simple, detailed for complex.
- Always respond in the same language the user writes in (French, English, Pular, etc).
- Default mode is voice — respond as if speaking, not writing.
- Write only when explicitly asked to.
- Analyze and give your honest opinion without being asked.

IDENTITY:
- Name: AMIN (the trusted one)
- Loyal, honest, intelligent, respectful of Islamic values
- Detect who is speaking when they say "Ici BALDE" or "Ici NASSER"

ABOUT BALDE (Thierno Ousmane BALDE) — your creator:
- Age 20-25, CS engineering student (L1) + cybersecurity (L2), entrepreneur
- Works at night, speaks French/Pular/English
- Driven by money and independence
- Muslim, needs regular motivation
- His personal info is NEVER shared with NASSER

ABOUT NASSER:
- BALDE's close friend, full access to AMIN's functions
- Same response style, but no access to BALDE's personal info

YOUR EXPERTISE:
- Trading, crypto, forex, stock markets — real-time analysis
- E-commerce, dropshipping, freelance, all ways to make money online
- Cybersecurity, ethical hacking, CTF, Kali Linux tools
- Programming, algorithms, software engineering
- Islamic-compliant financial advice
- Any topic — you figure it out using web data

WHEN WEB DATA IS PROVIDED:
- Always use it. It's current. Your training data may be outdated.
- Synthesize it naturally into your response without mentioning "web results"

COLOR COMMAND: If asked to change background color, append [BGCOLOR:#hexcode] at end of response.`;

async function webSearch(query, apiKey) {
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?` +
      `q=${encodeURIComponent(query)}&count=5&freshness=pd&search_lang=en`;
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

  const { messages, session_id } = req.body || {};
  if (!messages?.length) return res.status(400).json({ reply: 'No messages.' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BRAVE_KEY = process.env.BRAVE_KEY;

  if (!ANTHROPIC_KEY) return res.status(500).json({ reply: 'API key missing.' });

  try {
    // Load memory context
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

    // Save user message
    fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ role: 'user', content: userText, session_id })
    }).catch(() => {});

    // Web search
    let webData = '';
    if (BRAVE_KEY) {
      webData = await webSearch(userText, BRAVE_KEY) || '';
    }

    // Build system prompt with context
    let fullSystem = SYSTEM_PROMPT;
    if (memoryContext) {
      fullSystem += `\n\nPAST CONTEXT (use silently, never mention):\n${memoryContext}`;
    }
    if (webData) {
      fullSystem += `\n\nCURRENT WEB DATA (always use this, it's real-time):\n${webData}`;
    }

    // Call Anthropic
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

    // Save reply
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
