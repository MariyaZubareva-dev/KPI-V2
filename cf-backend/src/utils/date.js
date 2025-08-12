export function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
export function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }

export function getWeekBounds(date){
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: startOfDay(monday), end: endOfDay(sunday) };
}

export function getLastFullWeekBounds(ref){
  const now = ref ? new Date(ref) : new Date();
  const thisWeek = getWeekBounds(now);
  const start = new Date(thisWeek.start); start.setDate(start.getDate()-7); startOfDay(start);
  const end   = new Date(thisWeek.end);   end.setDate(end.getDate()-7);     endOfDay(end);
  return { start, end };
}

export function inRange(date, start, end){
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function ymd(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

export function parseYMD(val){
  // 'YYYY-MM-DD' -> Date
  if (val instanceof Date) return val;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y,m,d] = val.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  return new Date(val);
}

export function weeksInMonthOf(date){
  const month = date.getMonth(), year = date.getFullYear();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month+1, 0);
  const s = new Set();
  for (let d=new Date(first); d<=last; d.setDate(d.getDate()+1)) {
    // простая неделя ISO-грубо: YYYY-WW
    const y = d.getFullYear();
    const oneJan = new Date(y,0,1);
    const day = Math.floor((d - oneJan)/86400000);
    const week = Math.ceil((day + oneJan.getDay()+1)/7);
    s.add(`${y}-${week}`);
  }
  return s.size;
}
