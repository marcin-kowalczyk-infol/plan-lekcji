const $=id=>document.getElementById(id);
const days=['Poniedziałek','Wtorek','Środa','Czwartek','Piątek'];
const short=['Pon','Wt','Śr','Czw','Pt'];
const token=location.hash.slice(1),api=(window.PLAN_API||'').replace(/\/$/,'');
let plan=null,session='',selected=0,single=false,busy=false,editing=null,editingDay=0,dayVersion=0,editVersion=0,noticeTimer;
function clock(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return {day:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(p.weekday),time:p.hour+':'+p.minute};}
selected=Math.min(clock().day,4);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(text){clearTimeout(noticeTimer);$('notice').textContent=text;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,6500);}
async function request(path,method='GET',body){
  const response=await fetch(api+path,{method,cache:'no-store',credentials:'omit',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}),...(session?{'X-Edit-Session':session}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  let data;try{data=await response.json();}catch{throw Error('Usługa zapisu jest niedostępna. Spróbuj ponownie.');}
  if(!response.ok){const e=Error(data.error||'Nie udało się połączyć.');e.status=response.status;throw e;}return data;
}
function errorText(e){return e.name==='TimeoutError'||e.name==='TypeError'?'Brak połączenia. Sprawdź internet i spróbuj ponownie.':e.message;}
async function load(){
  if(!token){$('gate-message').textContent='Otwórz pełny link otrzymany od osoby udostępniającej plan.';return;}
  try{plan=await request('/api/plan');$('gate').hidden=true;$('content').hidden=false;$('share').hidden=false;$('unlock').hidden=false;render();}
  catch(e){if(plan)$('sync').textContent='⚠ '+errorText(e)+' Wyświetlam ostatnio pobrany plan.';else{$('gate-message').textContent=errorText(e);$('retry').hidden=false;}}
}
function render(){
  const now=clock(),today=plan.events.filter(e=>e.day===now.day).sort((a,b)=>a.start.localeCompare(b.start));
  $('date').textContent=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',weekday:'long',day:'numeric',month:'long'}).format(new Date());
  $('today-title').textContent=now.day>4?'Czas na weekend':`Dzisiaj: ${today.length} ${today.length===1?'zajęcie':today.length<5?'zajęcia':'zajęć'}`;
  $('today-summary').textContent=today.length?`Początek ${today[0].start} · Ostatnie zajęcia ${today.at(-1).start}${today.at(-1).end?'–'+today.at(-1).end:''}`:'Dzisiaj nie ma wpisanych zajęć.';
  const next=today.find(e=>(e.end||e.start)>now.time);
  $('next-name').textContent=next?next.name:'Na dziś to wszystko';$('next-time').textContent=next?`${next.start}${next.end?'–'+next.end:''}${next.uncertain?' · do potwierdzenia':''}`:'Dobrego odpoczynku!';
  $('unlock').textContent=session?'Zakończ edycję':'Edytuj plan';['add','import','edit-hint'].forEach(id=>$(id).hidden=!session);
  $('week-view').classList.toggle('selected',!single);$('today-view').classList.toggle('selected',single);
  document.querySelector('.day-tabs').innerHTML=short.map((d,i)=>`<button class="${selected===i?'selected':''}" aria-pressed="${selected===i}" data-day="${i}">${d}</button>`).join('');
  document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.day);render();if(!single)document.querySelector(`[data-drop="${selected}"]`)?.scrollIntoView({block:"start"});});
  $('board').classList.toggle('single',single);
  const escortMarkup=(value,label='Kto zawozi / odprowadza')=>`<span class="escort-label">${esc(label)}</span><span class="escort-name">${esc(value||'Nie wpisano')}</span>`;
  $('board').innerHTML=days.map((day,i)=>{
    if(single && selected!==i)return '';
    const events=plan.events.filter(e=>e.day===i).sort((a,b)=>a.start.localeCompare(b.start));let afternoon=false;
    return `<section class="day ${now.day===i?'current':''} ${selected===i?'active':''}" data-drop="${i}"><div class="day-head"><h3>${day}</h3>${now.day===i?'<span class="today-tag">DZIŚ</span>':`<span class="day-count">${events.length} zajęć</span>`}</div><${session?'button':'div'} class="day-escort" data-escort-day="${i}">${escortMarkup(plan.dayEscorts?.[i],'Kto odprowadza')}<span class="day-pickup">${escortMarkup(plan.dayPickups?.[i],'Kto odbiera')}</span>${session?'<span class="escort-edit">Zmień</span>':''}</${session?'button':'div'}>${events.map(e=>{let label='';if(e.start>='16:30'&&!afternoon){afternoon=true;label='<p class="section-label">Po lekcjach</p>';}
      const tag=session?'button':'article';return label+`<${tag} class="event ${e.kind} ${session?'editable':''} ${e.day===now.day&&e.start<=now.time&&e.end>now.time?'live':''}" data-id="${esc(e.id)}" ${session?'draggable="true"':''}>${e.uncertain?'<span class="uncertain" title="Do potwierdzenia">?</span>':''}<span class="time">${e.start}${e.end?' — '+e.end:''}</span><span class="name">${esc(e.name)}</span>${e.note?`<span class="note">${esc(e.note)}</span>`:''}${e.start>='16:30'?`<span class="event-escort">${escortMarkup(e.escort)}</span>`:''}</${tag}>`;
    }).join('')||'<p class="empty">Brak zajęć</p>'}</section>`;
  }).join('');
  if(session){
    document.querySelectorAll('[data-escort-day]').forEach(b=>b.onclick=()=>openDay(Number(b.dataset.escortDay)));
    document.querySelectorAll('.event').forEach(card=>{card.onclick=()=>openEvent(card.dataset.id);card.ondragstart=e=>{e.dataTransfer.setData('text/plain',card.dataset.id);e.dataTransfer.effectAllowed='move';};});
    document.querySelectorAll('[data-drop]').forEach(col=>{col.ondragover=e=>{e.preventDefault();col.classList.add('drop-active');};col.ondragleave=()=>col.classList.remove('drop-active');col.ondrop=async e=>{e.preventDefault();col.classList.remove('drop-active');const id=e.dataTransfer.getData('text/plain'),day=Number(col.dataset.drop);if(!plan.events.some(x=>x.id===id&&x.day!==day))return;try{await save(plan.events.map(x=>x.id===id?{...x,day}:x),plan.version);}catch(err){notice(errorText(err));}};});
  }
  $('sync').textContent='✓ Zapis wspólny · '+new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(plan.updated));
}
async function save(events,version,dayEscorts=plan.dayEscorts,dayPickups=plan.dayPickups){
  if(busy)throw Error('Poczekaj na zakończenie zapisu.');busy=true;
  try{plan=await request('/api/plan','PUT',{events,version,dayEscorts,dayPickups});render();notice('Zapisano. Zmiana będzie widoczna u wszystkich.');}
  catch(e){if(e.status===409){await load();editVersion=plan.version;dayVersion=plan.version;}if(e.status===403){session='';render();}throw e;}
  finally{busy=false;}
}
function confirmAction(title,message){return new Promise(resolve=>{$('confirm-title').textContent=title;$('confirm-message').textContent=message;const d=$('confirm-dialog');d.showModal();let settled=false;const finish=v=>{if(settled)return;settled=true;d.close();resolve(v);};$('confirm-yes').onclick=()=>finish(true);$('confirm-no').onclick=()=>finish(false);d.oncancel=e=>{e.preventDefault();finish(false);};});}
function openEvent(id){
  if(busy)return;editing=id||null;editVersion=plan.version;
  const e=plan.events.find(x=>x.id===id)||{name:'',day:selected,start:'08:00',end:'08:45',kind:'edu',note:'',uncertain:false,escort:''},f=$('event-form');
  for(const key of ['name','day','start','end','kind','note'])f.elements[key].value=e[key];f.elements.uncertain.checked=e.uncertain;f.elements.escort.value=e.escort||'';updateEscortField();
  $('event-title').textContent=id?'Edytuj zajęcia':'Nowe zajęcia';$('delete').hidden=!id;$('event-error').textContent='';$('event-dialog').showModal();
}
$('event-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const x={id:editing||crypto.randomUUID(),day:Number(f.elements.day.value),name:f.elements.name.value.trim(),start:f.elements.start.value,end:f.elements.end.value,kind:f.elements.kind.value,note:f.elements.note.value,uncertain:f.elements.uncertain.checked,escort:f.elements.escort.value.trim()};
  if(x.end&&x.end<=x.start){$('event-error').textContent='Koniec musi być później niż początek.';return;}
  const list=plan.events.filter(e=>e.id!==editing).concat(x);const b=f.querySelector('[type=submit]');b.disabled=true;try{await save(list,editVersion);$('event-dialog').close();}catch(err){$('event-error').textContent=errorText(err);}finally{b.disabled=false;}
};
$('delete').onclick=async()=>{if(!await confirmAction('Usunąć te zajęcia?','Zmiana będzie widoczna u wszystkich osób korzystających z planu.'))return;try{await save(plan.events.filter(e=>e.id!==editing),editVersion);$('event-dialog').close();}catch(e){$('event-error').textContent=errorText(e);}};
$('unlock').onclick=async()=>{if(session){try{await request('/api/lock','POST',{});}catch(e){notice(errorText(e));}session='';render();}else{$('pin-form').reset();$('pin-error').textContent='';$('pin-dialog').showModal();}};
$('pin-form').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('[type=submit]');b.disabled=true;try{const d=await request('/api/unlock','POST',{pin:e.currentTarget.elements.pin.value});session=d.session;$('pin-dialog').close();e.target.reset();render();notice('Edycja odblokowana na godzinę.');}catch(err){$('pin-error').textContent=errorText(err);}finally{b.disabled=false;}};
function updateEscortField(){$('event-escort-label').hidden=$('event-form').elements.start.value<'16:30';}
$('event-form').elements.start.addEventListener('input',updateEscortField);
function openDay(day){editingDay=day;dayVersion=plan.version;$('day-title').textContent=days[day];$('day-form').elements.escort.value=plan.dayEscorts?.[day]||'';$('day-form').elements.pickup.value=plan.dayPickups?.[day]||'';$('day-error').textContent='';$('day-dialog').showModal();}
$('day-form').onsubmit=async e=>{e.preventDefault();const escorts=[...(plan.dayEscorts||['','','','',''])];escorts[editingDay]=e.currentTarget.elements.escort.value.trim();const pickups=[...(plan.dayPickups||['','','','',''])];pickups[editingDay]=e.currentTarget.elements.pickup.value.trim();const b=e.currentTarget.querySelector('[type=submit]');b.disabled=true;try{await save(plan.events,dayVersion,escorts,pickups);$('day-dialog').close();}catch(err){$('day-error').textContent=errorText(err);}finally{b.disabled=false;}};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('add').onclick=()=>openEvent();$('retry').onclick=load;
$('week-view').onclick=()=>{single=false;render();};$('today-view').onclick=()=>{const d=clock().day;if(d>4){notice('Dzisiaj weekend — pokazuję poniedziałek.');selected=0;}else selected=d;single=true;render();};
$('share').onclick=async()=>{const url=location.origin+location.pathname+'#'+token;try{if(navigator.share)await navigator.share({title:'Plan lekcji',url});else{await navigator.clipboard.writeText(url);notice('Skopiowano prywatny link. Możesz wkleić go na WhatsAppie.');}}catch(e){if(e.name!=='AbortError')notice('Nie udało się skopiować. Skopiuj pełny adres z paska przeglądarki.');}};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({events:plan.events,dayEscorts:plan.dayEscorts,dayPickups:plan.dayPickups},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='plan-lekcji.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>100000)throw Error('Plik jest za duży.');const data=JSON.parse(await f.text());if(!Array.isArray(data.events))throw Error('Plik nie zawiera kopii planu.');if(await confirmAction('Zastąpić cały plan?',`Wczytasz ${data.events.length} wpisów. Obecny plan zostanie zastąpiony dla wszystkich.`))await save(data.events,plan.version,data.dayEscorts,data.dayPickups);}catch(err){notice(errorText(err));}finally{e.target.value='';}};
window.addEventListener('hashchange',()=>location.reload());
setInterval(()=>{if(token&&!busy&&!document.querySelector('dialog[open]')&&!document.hidden)load();},15000);
load();
