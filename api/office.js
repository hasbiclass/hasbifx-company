const crypto = require('crypto');

const find = (re) => {
  const k = Object.keys(process.env).find((n) => re.test(n));
  return k && process.env[k];
};
const REDIS_URL = find(/(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/);
const REDIS_TOKEN = find(/(KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN)$/);
const SLOTS = 5;

const redis = async (cmd) => {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN },
    body: JSON.stringify(cmd),
  });
  return (await r.json()).result;
};
const load = async () => {
  const s = await redis(['GET', 'office']);
  return s ? JSON.parse(s) : { rooms: Array(SLOTS).fill(null) };
};
const save = (st) => redis(['SET', 'office', JSON.stringify(st)]);

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const clean = (v, n) => String(v || '').trim().slice(0, n);

async function askAI(room, task) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.MODEL || 'claude-sonnet-4-6',
      max_tokens: 900,
      system: `Kamu ${room.name}, karyawan AI dengan peran ${room.role} di kantor milik bosmu. ${room.prompt} Jawab dalam bahasa Indonesia, ringkas dan langsung ke hasil.`,
      messages: [{ role: 'user', content: task }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'Gagal memanggil AI');
  return j.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Database belum terhubung (variabel KV_REST_API_URL / KV_REST_API_TOKEN tidak ditemukan). Hubungkan Upstash Redis di tab Storage, lalu Redeploy.' });
  }
  const owner = !!process.env.OWNER_KEY && same(req.headers['x-owner-key'] || '', process.env.OWNER_KEY);
  try {
    const st = await load();

    if (req.method === 'GET') {
      // Pengunjung hanya melihat; instruksi rahasia karyawan hanya untuk bos.
      const rooms = st.rooms.map((r) => r && { ...r, prompt: owner ? r.prompt : undefined });
      return res.json({ owner, rooms });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak didukung' });
    if (!owner) return res.status(401).json({ error: 'Hanya bos yang bisa melakukan ini' });

    const { action, slot } = req.body || {};
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return res.status(400).json({ error: 'Ruangan tidak valid' });

    if (action === 'hire') {
      const name = clean(req.body.name, 24), role = clean(req.body.role, 40);
      if (!name || !role) return res.status(400).json({ error: 'Nama dan peran wajib diisi' });
      st.rooms[slot] = { name, role, prompt: clean(req.body.prompt, 600), status: 'idle', task: '', log: [] };
      await save(st);
      return res.json({ ok: true });
    }
    if (action === 'fire') {
      st.rooms[slot] = null;
      await save(st);
      return res.json({ ok: true });
    }
    if (action === 'task') {
      const room = st.rooms[slot];
      const task = clean(req.body.task, 800);
      if (!room) return res.status(400).json({ error: 'Ruangan masih kosong' });
      if (!task) return res.status(400).json({ error: 'Tugas kosong' });
      if (room.status === 'working' && Date.now() - room.since < 90000) return res.status(409).json({ error: 'Karyawan sedang bekerja' });

      room.status = 'working'; room.task = task; room.since = Date.now();
      await save(st);

      let result;
      try { result = await askAI(room, task); } catch (e) { result = 'Gagal: ' + e.message; }

      const fresh = await load();
      const r2 = fresh.rooms[slot];
      if (r2 && r2.name === room.name) {
        r2.status = 'idle'; r2.task = '';
        r2.log = [{ t: Date.now(), task, result }, ...(r2.log || [])].slice(0, 5);
        await save(fresh);
      }
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'Aksi tidak dikenal' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
