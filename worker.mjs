import {validate,decodePlan,validatePlan} from './validate.mjs';
const encoder=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
export const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function derive(pin,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(pin),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
export default {async fetch(req,env){
  const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet, noimageindex','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Type':'application/json; charset=utf-8'};
  const send=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
  try {
    const config=JSON.parse(env.PLAN_CONFIG),db=env.DB,origin=req.headers.get('Origin');
    if(origin&&!config.origins.includes(origin))return send(403,{error:'Niedozwolone źródło.'});
    if(origin){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';}
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Edit-Session'}});
    const path=new URL(req.url).pathname;
    if(path==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n',{headers:{...headers,'Content-Type':'text/plain'}});
    if(!path.startsWith('/api/'))return send(404,{error:'Użyj prywatnego linku do planu.'});
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
    if(!token||!equal(await digest(token),config.viewHash))return send(401,{error:'Potrzebujesz pełnego prywatnego linku do planu.'});
    let body;
    if(['POST','PUT'].includes(req.method)){
      if(!req.headers.get('Content-Type')?.startsWith('application/json'))return send(415,{error:'Wymagany JSON.'});
      if(Number(req.headers.get('Content-Length'))>100000)return send(413,{error:'Plik jest za duży.'});
      const reader=req.body?.getReader();if(!reader)return send(400,{error:'Brak danych.'});
      let size=0,chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000){await reader.cancel();return send(413,{error:'Plik jest za duży.'});}chunks.push(value);}
      try {body=JSON.parse(await new Blob(chunks).text());}catch{return send(400,{error:'Nieprawidłowe dane.'});}
    }
    if(path==='/api/unlock'&&req.method==='POST'){
      const now=Date.now();
      const attempt=await db.prepare(`INSERT INTO attempts (id,count,until_ms) VALUES (1,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN until_ms<=? THEN 1 ELSE count+1 END, until_ms=CASE WHEN until_ms<=? THEN ? ELSE until_ms END RETURNING count,until_ms`).bind(now+900000,now,now,now+900000).first();
      if(attempt.count>5)return send(429,{error:'Za dużo prób. Spróbuj ponownie za 15 minut.'},{'Retry-After':String(Math.ceil((attempt.until_ms-now)/1000))});
      const pin=typeof body?.pin==='string'?body.pin:'';
      if(!/^\d{6,8}$/.test(pin)||!equal(await derive(pin,config.pinSalt),config.pinHash))return send(401,{error:'Nieprawidłowy PIN.'});
      const session=hex(crypto.getRandomValues(new Uint8Array(32)));
      await db.batch([db.prepare('DELETE FROM attempts WHERE id=1'),db.prepare('DELETE FROM sessions WHERE expires<?').bind(now),db.prepare('INSERT INTO sessions (token,expires) VALUES (?,?)').bind(await digest(session),now+3600000)]);
      return send(200,{session});
    }
    if(path==='/api/plan'&&req.method==='GET'){
      const p=await db.prepare('SELECT * FROM plan WHERE id=1').first();
      return p?send(200,{version:p.version,...decodePlan(p.data),updated:p.updated}):send(503,{error:'Plan nie został jeszcze wczytany.'});
    }
    if(path==='/api/plan'&&req.method==='PUT'||path==='/api/lock'&&req.method==='POST'){
      const session=await digest(req.headers.get('X-Edit-Session')||'');
      if(!await db.prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?').bind(session,Date.now()).first())return send(403,{error:'Odblokuj edycję PIN-em ponownie.'});
      if(path==='/api/lock'){await db.prepare('DELETE FROM sessions WHERE token=?').bind(session).run();return send(200,{ok:true});}
      const previous=await db.prepare('SELECT data FROM plan WHERE id=1').first();
      let data;try{data=validatePlan(body,previous?decodePlan(previous.data):undefined);if(!Number.isInteger(body.version)||body.version<0)throw Error('Nieprawidłowa wersja.');}catch(e){return send(400,{error:e.message});}
      const updated=new Date().toISOString();
      const r=body.version===0?await db.prepare('INSERT OR IGNORE INTO plan (id,version,data,updated) VALUES (1,1,?,?)').bind(JSON.stringify(data),updated).run():await db.prepare('UPDATE plan SET data=?,version=version+1,updated=? WHERE id=1 AND version=?').bind(JSON.stringify(data),updated,body.version).run();
      if(!r.meta.changes)return send(409,{error:'Ktoś zmienił plan. Odświeżono dane — sprawdź je i ponów swoją zmianę.'});
      return send(200,{version:body.version+1,...data,updated});
    }
    return send(404,{error:'Nie znaleziono.'});
  }catch{console.error('Plan API request failed');return send(503,{error:'Zapis jest chwilowo niedostępny. Spróbuj ponownie.'});}
}};
