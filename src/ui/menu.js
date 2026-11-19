/* arrow-key, Home and End movement between the items of an open menu; true when the key was used */
export function menuKeys(menu,e){
  const items=[...menu.querySelectorAll('[role=menuitem]')], i=items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); items[(i+(e.key==='ArrowDown'?1:items.length-1))%items.length].focus(); return true; }
  if(e.key==='Home'||e.key==='End'){ e.preventDefault(); items[e.key==='Home'?0:items.length-1].focus(); return true; }
  return false;
}
/* places a popup menu below btn, right-aligned to it, or above it when there is no room below;
   false when btn has scrolled out of the panel that holds it, so the caller can close the menu */
export function placeMenu(menu,btn,panel){
  const r=btn.getBoundingClientRect(), p=panel.getBoundingClientRect(), m=menu.getBoundingClientRect();
  if(r.bottom<p.top||r.top>p.bottom) return false;
  let top=r.bottom+6; if(top+m.height>innerHeight-8) top=r.top-6-m.height;
  menu.style.top=Math.max(8,top)+'px'; menu.style.left=Math.max(8,r.right-m.width)+'px';
  return true;
}
