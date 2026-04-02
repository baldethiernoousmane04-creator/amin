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
    screenshot:        { method: 'GET',  path: '/screenshot' },
    open:              { method: 'POST', path: '/open' },
    type:              { method: 'POST', path: '/type' },
    click:             { method: 'POST', path: '/click' },
    key:               { method: 'POST', path: '/key' },
    hotkey:            { method: 'POST', path: '/hotkey' },
    command:           { method: 'POST', path: '/command' },
    files_list:        { method: 'POST', path: '/files/list' },
    files_read:        { method: 'POST', path: '/files/read' },
    files_write:       { method: 'POST', path: '/files/write' },
    files_delete:      { method: 'POST', path: '/files/delete' },
    files_copy:        { method: 'POST', path: '/files/copy' },
    files_move:        { method: 'POST', path: '/files/move' },
    files_search:      { method: 'POST', path: '/files/search' },
    system_info:       { method: 'GET',  path: '/system/info' },
    system_processes:  { method: 'GET',  path: '/system/processes' },
    system_kill:       { method: 'POST', path: '/system/kill' },
    scroll:            { method: 'POST', path: '/scroll' },
    move:              { method: 'POST', path: '/move' },
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
