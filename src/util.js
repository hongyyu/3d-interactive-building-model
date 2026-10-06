export const $=(s,r)=>(r||document).querySelector(s);
export const fmt=n=>Math.round(n).toLocaleString('en-US');
export const fk=n=>(n/1000).toFixed(1)+'k';
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
