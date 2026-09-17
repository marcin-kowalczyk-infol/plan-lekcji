export function validate(data, previous = []) {
  if (!Array.isArray(data) || data.length > 150) throw Error('Nieprawidłowa lista zajęć.');
  const ids = new Set();
  return data.map(e => {
    if (!e || typeof e.id !== 'string' || !/^[\w-]{1,64}$/.test(e.id) || ids.has(e.id)) throw Error('Nieprawidłowy identyfikator.');
    ids.add(e.id);
    if (!Number.isInteger(e.day) || e.day < 0 || e.day > 4 || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80) throw Error('Sprawdź dzień i nazwę.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.start) || (e.end && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.end) || e.end <= e.start))) throw Error('Sprawdź godziny.');
    if (!['edu','language','sport','extra','other'].includes(e.kind) || typeof e.note !== 'string' || e.note.length > 300 || typeof e.uncertain !== 'boolean') throw Error('Sprawdź opis zajęć.');
    const escort=e.escort === undefined ? (previous.find(p=>p.id===e.id)?.escort || '') : e.escort;
    if(typeof escort!=='string'||escort.length>100)throw Error('Wpisz osobę odprowadzającą (do 100 znaków).');
    return {id:e.id, day:e.day, name:e.name.trim(), start:e.start, end:e.end || '', kind:e.kind, note:e.note, uncertain:e.uncertain, escort:escort.trim()};
  });
}
export function decodePlan(raw) {
  const data=JSON.parse(raw);
  return Array.isArray(data)?{events:data,dayEscorts:['','','','','']}:{events:data.events,dayEscorts:data.dayEscorts};
}
export function validatePlan(body, previous={events:[],dayEscorts:['','','','','']}) {
  const dayEscorts=body?.dayEscorts===undefined?previous.dayEscorts:body.dayEscorts;
  if(!Array.isArray(dayEscorts)||dayEscorts.length!==5||dayEscorts.some(s=>typeof s!=='string'||s.length>100))throw Error('Wpisz osobę odprowadzającą dla każdego dnia (do 100 znaków).');
  return {events:validate(body?.events,previous.events),dayEscorts:dayEscorts.map(s=>s.trim())};
}
