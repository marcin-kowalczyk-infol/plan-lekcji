import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createHash, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {readFileSync, existsSync, chmodSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const hash = value => createHash('sha256').update(value).digest('hex');
import {validate,decodePlan,validatePlan} from './validate.mjs';
export {validate} from './validate.mjs';
export function app({dbPath, config, publicDir = fileURLToPath(new URL('./public/', import.meta.url))}) {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS plan (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, data TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY CHECK(id=1), count INTEGER NOT NULL, until_ms INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
  chmodSync(dbPath, 0o600);
  const assets = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/config.js':'config.js','/favicon.svg':'favicon.svg','/robots.txt':'robots.txt'};
  const mime = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',txt:'text/plain'};
  const server = createServer(async(req,res) => {
    const send = (status,body) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet, noimageindex');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' https:; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const origin = req.headers.origin;
    if (origin && !config.origins.includes(origin)) return send(403,{error:'Niedozwolone źródło.'});
    if (origin) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Edit-Session');
      res.writeHead(204); return res.end();
    }
    const path = new URL(req.url,'http://localhost').pathname;
    if (!path.startsWith('/api/')) {
      if(req.method !== 'GET' || !assets[path]) return send(404,{error:'Nie znaleziono.'});
      const file=resolve(publicDir,assets[path]);
      if(!existsSync(file)) return send(404,{error:'Nie znaleziono.'});
      res.writeHead(200,{'Content-Type':mime[file.split('.').pop()]});return res.end(readFileSync(file));
    }
    const token = (req.headers.authorization || '').replace(/^Bearer /,'');
    if (!token || !timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(config.viewHash,'hex'))) return send(401,{error:'Potrzebujesz pełnego prywatnego linku do planu.'});
    let body;
    if(['POST','PUT'].includes(req.method)) {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'Wymagany JSON.'});
      try {let raw='';for await(const chunk of req) {raw+=chunk; if(Buffer.byteLength(raw)>100000) {send(413,{error:'Plik jest za duży.'});return;}} body=JSON.parse(raw);} catch {return send(400,{error:'Nieprawidłowe dane.'});}
    }
    if (path === '/api/unlock' && req.method === 'POST') {
      const now=Date.now(); const a=db.prepare('SELECT * FROM attempts WHERE id=1').get();
      if(a && a.until_ms>now && a.count>=5) {res.setHeader('Retry-After',String(Math.ceil((a.until_ms-now)/1000)));return send(429,{error:'Za dużo prób. Spróbuj ponownie za 15 minut.'});}
      const count=a && a.until_ms>now ? a.count+1:1;
      db.prepare('INSERT OR REPLACE INTO attempts VALUES (1,?,?)').run(count,a && a.until_ms>now?a.until_ms:now+900000);
      const pin=typeof body?.pin==='string'?body.pin:'';
      if(!/^\d{6,8}$/.test(pin) || !timingSafeEqual(scryptSync(pin,config.pinSalt,32),Buffer.from(config.pinHash,'hex'))) return send(401,{error:'Nieprawidłowy PIN.'});
      db.prepare('DELETE FROM attempts').run(); db.prepare('DELETE FROM sessions WHERE expires < ?').run(now);
      const session=randomBytes(32).toString('base64url'); db.prepare('INSERT INTO sessions VALUES (?,?)').run(hash(session),now+3600000);
      return send(200,{session});
    }
    if(path === '/api/plan' && req.method === 'GET') {
      const p=db.prepare('SELECT * FROM plan WHERE id=1').get();
      return p?send(200,{version:p.version,...decodePlan(p.data),updated:p.updated}):send(503,{error:'Plan nie został jeszcze wczytany.'});
    }
    if(req.method === 'PUT' && path === '/api/plan' || req.method === 'POST' && path === '/api/lock') {
      const session=hash(req.headers['x-edit-session']||'');
      if(!db.prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?').get(session,Date.now())) return send(403,{error:'Odblokuj edycję PIN-em ponownie.'});
      if(path === '/api/lock') {db.prepare('DELETE FROM sessions WHERE token=?').run(session);return send(200,{ok:true});}
      const previous=db.prepare('SELECT data FROM plan WHERE id=1').get();
      let data; try {data=validatePlan(body,previous?decodePlan(previous.data):undefined);if(!Number.isInteger(body.version)) throw Error('Nieprawidłowa wersja.');} catch(e) {return send(400,{error:e.message});}
      const updated=new Date().toISOString();
      const result=db.prepare('UPDATE plan SET data=?,version=version+1,updated=? WHERE id=1 AND version=?').run(JSON.stringify(data),updated,body.version);
      if(!result.changes) return send(409,{error:'Ktoś zmienił plan. Odświeżono dane — sprawdź je i ponów swoją zmianę.'});
      return send(200,{version:body.version+1,...data,updated});
    }
    send(404,{error:'Nie znaleziono.'});
  });
  server.requestTimeout=15000; server.headersTimeout=10000;
  server.on('close',()=>db.close());
  return server;
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir=process.env.DATA_DIR || fileURLToPath(new URL('./private/',import.meta.url));
  const config=JSON.parse(readFileSync(resolve(dir,'config.json')));
  const server=app({dbPath:resolve(dir,'plan.sqlite'),config});
  server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Plan lekcji jest gotowy.'));
}
