export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const PC_URL = process.env.PC_URL;
  if (!PC_URL) return res.status(500).json({ error: 'PC_URL manquant.' });

  const { action, params } = req.body;

  const routes = {
    screenshot: { method: 'GET', path: '/screenshot' },
    open: { method: 'POST', path: '/open' },
    type: { method: 'POST', path: '/type' },
    click: { method: 'POST', path: '/click' },
    key: { method: 'POST', path: '/key' },
    command: { method: 'POST', path: '/command' },
  };

  const route = routes[action];
  if (!route) return res.status(400).json({ error: 'Action inconnue.' });

  try {
    const r = await fetch(`${PC_URL}${route.path}`, {
      method: route.method,
      headers: { 'Content-Type': 'application/json' },
      body: route.method === 'POST' ? JSON.stringify(params || {}) : undefined
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'PC hors ligne ou ngrok arrêté.' });
  }
}
