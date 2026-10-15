'use strict';
// Node server: serves the app + stores entries in Postgres (Neon). Only dependency: "pg".
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;        // Neon connection string
const TOKEN = process.env.CWC_TOKEN || '';            // access code the phones must send
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';    // only if the frontend is hosted on another domain
const MAX_BODY = 1024 * 1024;                         // 1 MB per entry
const STATIC = {'/':'index.html', '/index.html':'index.html', '/cwc.html':'index.html', '/script.js':'script.js', '/styles.css':'styles.css', '/config.js':'config.js'};
const MIME = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8'};

if(!DATABASE_URL){ console.error('DATABASE_URL is not set — paste your Neon connection string.'); process.exit(1); }
if(!TOKEN) console.warn('WARNING: CWC_TOKEN is not set — anyone with the URL can read, write and delete entries.');

const pool = new Pool({connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000});
pool.on('error', e => console.error('Idle DB connection dropped:', e.message));   // Neon closes idle connections; don't crash

// One retry covers Neon waking up from scale-to-zero
async function q(text, params){
  try{ return await pool.query(text, params); }
  catch(e){
    if(/terminat|timeout|ECONNRESET|ETIMEDOUT/i.test(e.message + (e.code || ''))) return pool.query(text, params);
    throw e;
  }
}
const ready = q(`CREATE TABLE IF NOT EXISTS entries (
  key        text PRIMARY KEY,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)`).catch(e => { console.error('Database setup failed:', e.message); process.exit(1); });

const validKey = k => typeof k === 'string' && k.length > 0 && k.length <= 200 && !/[\u0000-\u001f]/.test(k);

function send(res, code, obj){
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
  res.end(JSON.stringify(obj));
}
function readBody(req){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if(size > MAX_BODY) reject(Object.assign(new Error('Payload too large'), {status:413}));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function authorized(req){
  if(!TOKEN) return true;
  const got = Buffer.from(req.headers.authorization || ''), want = Buffer.from('Bearer ' + TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// API (same shape the frontend already uses)
//   GET    /api/health                  (no auth, no DB — safe for wake-up checks)
//   GET    /api/entries?prefix=entry:   -> {keys:[...]}
//   GET    /api/entries/:key            -> {key, value}   (value = entry as JSON string)
//   PUT    /api/entries/:key            body {value}      -> create / overwrite
//   DELETE /api/entries/:key
async function handleApi(req, res, url){
  const parts = url.pathname.split('/').filter(Boolean);
  if(parts[1] === 'health') return send(res, 200, {ok:true});
  if(!authorized(req)) return send(res, 401, {error:'Unauthorized'});
  if(parts[1] !== 'entries') return send(res, 404, {error:'Not found'});
  await ready;

  if(parts.length === 2){
    if(req.method !== 'GET') return send(res, 405, {error:'Method not allowed'});
    const r = await q('SELECT key FROM entries WHERE starts_with(key, $1) ORDER BY key', [url.searchParams.get('prefix') || '']);
    return send(res, 200, {keys: r.rows.map(x => x.key)});
  }

  let key;
  try{ key = decodeURIComponent(parts[2]); }catch{ return send(res, 400, {error:'Bad key'}); }
  if(parts.length > 3 || !validKey(key)) return send(res, 400, {error:'Invalid key'});

  if(req.method === 'GET'){
    const r = await q('SELECT data FROM entries WHERE key = $1', [key]);
    if(!r.rows.length) return send(res, 404, {error:'Not found'});
    return send(res, 200, {key, value: JSON.stringify(r.rows[0].data)});
  }
  if(req.method === 'PUT'){
    let data;
    try{ data = JSON.parse(JSON.parse(await readBody(req)).value); }
    catch(e){ if(e.status) throw e; return send(res, 400, {error:'Body must be {"value": "<entry as JSON string>"}'}); }
    if(!data || typeof data !== 'object' || Array.isArray(data)) return send(res, 400, {error:'Entry must be a JSON object'});
    await q(`INSERT INTO entries (key, data) VALUES ($1, $2::jsonb)
             ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [key, JSON.stringify(data)]);
    return send(res, 200, {key, value: JSON.stringify(data)});
  }
  if(req.method === 'DELETE'){
    await q('DELETE FROM entries WHERE key = $1', [key]);
    return send(res, 200, {key, deleted:true});
  }
  return send(res, 405, {error:'Method not allowed'});
}

function serveStatic(req, res, pathname){
  const name = STATIC[pathname];
  if(!name || req.method !== 'GET'){ res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, name), (err, buf) => {
    if(err){ res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type':MIME[path.extname(name)], 'X-Content-Type-Options':'nosniff'});
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  try{
    if(CORS_ORIGIN){
      res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
      res.setHeader('Vary', 'Origin');
    }
    if(req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://localhost');
    if(url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    serveStatic(req, res, url.pathname);
  }catch(e){
    console.error(e);
    if(!res.headersSent) send(res, e.status || 500, {error: e.status ? e.message : 'Server error'});
  }
}).listen(PORT, () => console.log(`CWC server listening on :${PORT}`));
