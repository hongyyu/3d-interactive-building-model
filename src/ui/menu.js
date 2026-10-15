/* arrow-key, Home and End movement between the items of an open menu; true when the key was used */
export function menuKeys(menu,e){
  const items=[...menu.querySelectorAll('[role=menuitem]')], i=items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); items[(i+(e.key==='ArrowDown'?1:items.length-1))%items.length].focus(); return true; }
  if(e.key==='Home'||e.key==='End'){ e.preventDefault(); items[e.key==='Home'?0:items.length-1].focus(); return true; }
  return false;
}
