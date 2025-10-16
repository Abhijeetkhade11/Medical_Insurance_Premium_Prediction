function setActive(navId){
  const links=document.querySelectorAll('.nav a');
  links.forEach(a=>a.classList.remove('active'));
  const el=document.getElementById(navId);
  if(el) el.classList.add('active');
}
async function api(path, opts={}){
  const base='http://127.0.0.1:8000';
  const res=await fetch(base+path,{headers:{'Content-Type':'application/json'},...opts});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
