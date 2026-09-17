export function validate(data) {
  if (!Array.isArray(data) || data.length > 150) throw Error('Nieprawidłowa lista zajęć.');
  const ids = new Set();
  return data.map(e => {
    if (!e || typeof e.id !== 'string' || !/^[\w-]{1,64}$/.test(e.id) || ids.has(e.id)) throw Error('Nieprawidłowy identyfikator.');
    ids.add(e.id);
    if (!Number.isInteger(e.day) || e.day < 0 || e.day > 4 || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80) throw Error('Sprawdź dzień i nazwę.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.start) || (e.end && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.end) || e.end <= e.start))) throw Error('Sprawdź godziny.');
    if (!['edu','language','sport','extra','other'].includes(e.kind) || typeof e.note !== 'string' || e.note.length > 300 || typeof e.uncertain !== 'boolean') throw Error('Sprawdź opis zajęć.');
    return {id:e.id, day:e.day, name:e.name.trim(), start:e.start, end:e.end || '', kind:e.kind, note:e.note, uncertain:e.uncertain};
  });
}
