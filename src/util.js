export const $=(s,r)=>(r||document).querySelector(s);
export const fmt=n=>Math.round(n).toLocaleString('en-US');
export const fk=n=>(n/1000).toFixed(1)+'k';
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/* '#abc', 'abc', '#aabbcc' or 'aabbcc' as '#aabbcc'; null for anything else */
export function hexColor(v){
  const m=/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(v).trim());
  if(!m) return null;
  const h=m[1].length===3?m[1].replace(/./g,c=>c+c):m[1];
  return '#'+h.toLowerCase();
}
