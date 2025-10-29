setActive('nav-apriori');

let rows=[];
let rules=[];
let sup=0.05, conf=0.5, minLift=1.2;
let target='charges';
let sortBy='lift', sortDir='desc', page=1, pageSize=20, searchTerm='';
let net={nodes:[], edges:[]};

(async function init(){
  rows = await api('/dataset/sample?limit=1338');
  wire();
  generate();
})();

function wire(){
  const supEl=document.getElementById('sup'); const supLbl=document.getElementById('supLbl');
  const confEl=document.getElementById('conf'); const confLbl=document.getElementById('confLbl');
  const liftEl=document.getElementById('lift');
  const tgtEl=document.getElementById('target');
  const searchEl=document.getElementById('ruleSearch');
  supEl.addEventListener('input',()=>{sup=+supEl.value; supLbl.textContent=sup.toFixed(2)});
  confEl.addEventListener('input',()=>{conf=+confEl.value; confLbl.textContent=conf.toFixed(2)});
  liftEl.addEventListener('change',()=>{minLift=+liftEl.value});
  tgtEl.addEventListener('change',()=>{target=tgtEl.value});
  document.getElementById('genBtn').addEventListener('click',()=>{page=1; generate();});
  document.getElementById('exportRules').addEventListener('click',exportCsv);
  document.getElementById('prevPage').addEventListener('click',()=>{if(page>1){page--; render();}});
  document.getElementById('nextPage').addEventListener('click',()=>{const total=Math.ceil(filteredRules().length/pageSize); if(page<total){page++; render();}});
  document.getElementById('pageSize').addEventListener('change',(e)=>{pageSize=+e.target.value; page=1; render();});
  searchEl.addEventListener('input',()=>{searchTerm=searchEl.value.toLowerCase(); page=1; render();});
  // sorting
  document.querySelectorAll('#rulesTable thead th[data-sort]').forEach(th=>{
    th.style.cursor='pointer';
    th.addEventListener('click',()=>{const k=th.dataset.sort; if(sortBy===k){sortDir=sortDir==='asc'?'desc':'asc'} else {sortBy=k; sortDir='asc'} render();});
  });
  // rule modal close hooks
  const modal=document.getElementById('ruleModal');
  const close=()=>{ modal.hidden=true; };
  document.getElementById('ruleClose').addEventListener('click',close);
  modal.addEventListener('click',(e)=>{ if(e.target===modal) close(); });
  document.addEventListener('keydown',(e)=>{ if(!modal.hidden && e.key==='Escape') close(); });
  // network expand modal
  const netModal=document.getElementById('netModal');
  const netClose=()=>{ netModal.hidden=true; };
  document.getElementById('netExpand').addEventListener('click',()=>{ netModal.hidden=false; drawNetwork('netCanvas', rules, true); });
  document.getElementById('netClose').addEventListener('click',netClose);
  netModal.addEventListener('click',(e)=>{ if(e.target===netModal) netClose(); });
}

function bin(value, edges){ for(let i=0;i<edges.length-1;i++){ if(value>=edges[i] && value<edges[i+1]) return `${edges[i]}-${edges[i+1]}` } return `${edges[edges.length-2]}+` }

function toTransactions(data){
  const bmiEdges=[0,18.5,25,30,100];
  const chargeEdges=[0,10000,20000,40000,1000000];
  return data.map(r=>[
    `sex=${r.sex}`,
    `smoker=${r.smoker}`,
    `region=${r.region}`,
    `children=${r.children}`,
    `bmi=${bin(+r.bmi,bmiEdges)}`,
    `charge=${bin(+r.charges,chargeEdges)}`
  ]);
}

function generate(){
  // Hook: POST /api/apriori with {support, confidence, lift, target}
  const candidates=[
    {a:['smoker=yes'], c:['charge=20000-40000'], support:0.18, confidence:0.72, lift:3.2},
    {a:['bmi=30-100'], c:['charge=20000-40000'], support:0.22, confidence:0.55, lift:1.9},
    {a:['children=0'], c:['charge=0-10000'], support:0.20, confidence:0.48, lift:1.3},
    {a:['region=southeast'], c:['smoker=yes'], support:0.15, confidence:0.28, lift:1.4},
    {a:['sex=male','smoker=yes'], c:['charge=20000-40000'], support:0.10, confidence:0.78, lift:3.5},
  ];
  rules = candidates.filter(r=>r.support>=sup && r.confidence>=conf && r.lift>=minLift)
                    .sort((a,b)=>b.lift-a.lift);
  render();
}

function filteredRules(){
  if(!searchTerm) return rules;
  return rules.filter(r=> (r.a.join(' ').toLowerCase().includes(searchTerm) || r.c.join(' ').toLowerCase().includes(searchTerm)) );
}

function sortedPagedRules(){
  const arr=[...filteredRules()].sort((a,b)=>{
    const dir=sortDir==='asc'?1:-1;
    if(sortBy==='a'||sortBy==='c'){ const sa=a[sortBy].join(' '), sb=b[sortBy].join(' '); return dir*sa.localeCompare(sb); }
    return dir*(a[sortBy]-b[sortBy]);
  });
  const total=Math.ceil(arr.length/pageSize)||1; if(page>total) page=total;
  const start=(page-1)*pageSize; return {rows:arr.slice(start,start+pageSize), total};
}

function setKPIs(){
  const el=document.getElementById('aprioriKPI');
  const total=rules.length;
  const strongest=rules[0]? rules[0].lift:0;
  const avgConf=rules.length? (rules.reduce((s,r)=>s+r.confidence,0)/rules.length):0;
  const highestSup=rules.reduce((m,r)=>Math.max(m,r.support),0);
  el.innerHTML = `
    <div class="kpi-card"><div class="kpi-title">Total Rules</div><div class="kpi-value">${total}</div><div class="p">After thresholds</div></div>
    <div class="kpi-card"><div class="kpi-title">Strongest (Lift)</div><div class="kpi-value">${strongest.toFixed(2)}</div><div class="p">Highest lift</div></div>
    <div class="kpi-card"><div class="kpi-title">Avg Confidence</div><div class="kpi-value">${(avgConf*100).toFixed(0)}%</div><div class="p">Across rules</div></div>
    <div class="kpi-card"><div class="kpi-title">Highest Support</div><div class="kpi-value">${(highestSup*100).toFixed(0)}%</div><div class="p">Most common</div></div>`;
}

function render(){
  setKPIs();
  const tbody=document.querySelector('#rulesTable tbody');
  const {rows:rowsToShow, total}=sortedPagedRules();
  tbody.innerHTML = rowsToShow.map((r,i)=>`<tr>
    <td>${r.a.join(' ∧ ')}</td>
    <td>${r.c.join(' ∧ ')}</td>
    <td>${r.support.toFixed(2)}</td>
    <td>${r.confidence.toFixed(2)}</td>
    <td>${r.lift.toFixed(2)}</td>
    <td><button class=\"icon-btn\" data-detail=\"${i}\">View</button></td>
  </tr>`).join('');
  document.getElementById('pageInfo').textContent = `Page ${page} / ${total}`;
  tbody.querySelectorAll('button[data-detail]').forEach((btn,idx)=>btn.addEventListener('click',()=>showRule(((page-1)*pageSize)+idx)));

  // Static insight cards (requested)
  const ic=document.getElementById('insightCards');
  ic.innerHTML = [
    'Smokers with BMI>30 → High Charges',
    'Families with 2+ children → Medium Charges',
    'Southwest region → more low-premium members'
  ].map(txt=>`<div class=\"kpi-card\"><div class=\"kpi-title\">Insight</div><div class=\"p\">${txt}</div></div>`).join('');

  drawNetwork('rulesNet', rules, false);
}

function plainRule(r){
  return `${r.a.join(' ∧ ').replaceAll('=',' is ')} → ${r.c.join(' ∧ ').replaceAll('=',' is ')} (lift ${r.lift.toFixed(2)})`;
}

function showRule(i){
  const r=rules[i];
  const modal=document.getElementById('ruleModal');
  document.getElementById('ruleText').textContent = `${r.a.join(' ∧ ')} → ${r.c.join(' ∧ ')}`;
  document.getElementById('ruleMetrics').textContent = `support ${r.support.toFixed(2)}, confidence ${r.confidence.toFixed(2)}, lift ${r.lift.toFixed(2)}`;
  document.getElementById('ruleInterpretation').textContent = `Members where ${r.a.join(' and ')} often also have ${r.c.join(' and ')}.`;
  const ex=document.getElementById('ruleExamples');
  ex.innerHTML = Array.from({length:3},(_,k)=>`<li>Example ${k+1}: ${r.a.concat(r.c).join(', ')}</li>`).join('');
  modal.hidden=false;
}

function drawNetwork(canvasId, rules, expanded){
  const canvas=document.getElementById(canvasId);
  const ctx=canvas.getContext('2d');
  const tip=document.getElementById('netTip');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Build nodes map & circular layout
  const nodesMap=new Map();
  rules.forEach(r=>{ r.a.forEach(n=>{if(!nodesMap.has(n)) nodesMap.set(n,{name:n});}); r.c.forEach(n=>{if(!nodesMap.has(n)) nodesMap.set(n,{name:n});}); });
  const nodes=[...nodesMap.values()];
  const cx=canvas.width/2, cy=canvas.height/2; const R=Math.min(cx,cy)-40; const N=nodes.length||1;
  nodes.forEach((n,i)=>{ const t=(i/N)*Math.PI*2; n.x=cx+R*Math.cos(t); n.y=cy+R*Math.sin(t); n.r=12; });
  const edges=[];
  rules.forEach(r=>{ r.a.forEach(a=>{ r.c.forEach(c=>{ edges.push({a:nodesMap.get(a), c:nodesMap.get(c), r}); }); }); });

  function draw(highlight){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // edges
    edges.forEach(e=>{
      const alpha = highlight && (highlight.node && (e.a===highlight.node||e.c===highlight.node) || highlight.edge===e) ? 1 : 0.35;
      const w = 1 + 4*e.r.confidence; // thicker for higher confidence
      const hue = Math.min(120, Math.max(0, (e.r.lift-1)*60)); // color by lift
      ctx.globalAlpha=alpha; ctx.strokeStyle=`hsl(${hue},70%,45%)`; ctx.lineWidth=w;
      ctx.beginPath(); ctx.moveTo(e.a.x,e.a.y); ctx.lineTo(e.c.x,e.c.y); ctx.stroke(); ctx.globalAlpha=1; ctx.lineWidth=1;
    });
    // nodes
    nodes.forEach(n=>{
      const strong=highlight && highlight.node===n;
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2); ctx.fillStyle=strong?'#ffffff':'#ffffff'; ctx.fill(); ctx.strokeStyle=strong?'#2B8EFF':'#e5e7eb'; ctx.lineWidth=strong?2:1; ctx.stroke();
      ctx.fillStyle='#0f172a'; ctx.textAlign='center'; ctx.fillText(n.name, n.x, n.y-16);
    });
  }
  draw();

  function dist2(x1,y1,x2,y2){const dx=x1-x2, dy=y1-y2; return dx*dx+dy*dy}
  function onMove(ev){
    const rect=canvas.getBoundingClientRect(); const x=ev.clientX-rect.left, y=ev.clientY-rect.top;
    // node hover
    let hoverNode=null; for(const n of nodes){ if(dist2(x,y,n.x,n.y) < n.r*n.r) { hoverNode=n; break; } }
    // edge hover
    let hoverEdge=null; if(!hoverNode){ for(const e of edges){ // point-line distance approx
      const ax=e.a.x, ay=e.a.y, bx=e.c.x, by=e.c.y; const t=((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)*(bx-ax)+(by-ay)*(by-ay)); const tt=Math.max(0,Math.min(1,t)); const px=ax+tt*(bx-ax), py=ay+tt*(by-ay); if(Math.sqrt(dist2(x,y,px,py))<6){ hoverEdge=e; break; } } }
    draw({node:hoverNode, edge:hoverEdge});
    if(hoverEdge){ tip.style.display='block'; tip.style.left=(x+12)+'px'; tip.style.top=(y+12)+'px'; tip.innerHTML=`support ${hoverEdge.r.support.toFixed(2)}<br>confidence ${hoverEdge.r.confidence.toFixed(2)}<br>lift ${hoverEdge.r.lift.toFixed(2)}`; }
    else if(hoverNode){ tip.style.display='block'; tip.style.left=(x+12)+'px'; tip.style.top=(y+12)+'px'; tip.textContent=hoverNode.name; }
    else { if(tip) tip.style.display='none'; }
  }
  if(!expanded){ canvas.onmousemove=onMove; canvas.onmouseleave=()=>{ if(tip) tip.style.display='none'; draw(); } }
}

function exportCsv(){
  const header=['antecedent','consequent','support','confidence','lift'];
  let csv=header.join(',')+'\n';
  rules.forEach(r=>{csv+=`"${r.a.join(' & ')}","${r.c.join(' & ')}",${r.support},${r.confidence},${r.lift}\n`});
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='apriori_rules.csv'; a.click();
}
