setActive('nav-analysis');

const status=document.getElementById('status');
const INR=83;
const palette=['#2B8EFF','#00BFA5','#6366F1','#F59E0B','#EF4444','#10B981','#8B5CF6','#22C55E'];
const charts={};
let allRows=[];
let summary={}, dist={};
let filters={regions:new Set(), smoker:'all', age:[18,64], children:'all'};

status.textContent='Loading dashboard...';

function animateNumber(el, target, fmt=(v)=>v.toLocaleString('en-IN')){
  const start=performance.now();
  const dur=900; const base=0;
  const step=(t)=>{const p=Math.min(1,(t-start)/dur); const val=Math.floor(base+(target-base)*(0.2+0.8*p)); el.textContent=fmt(val); if(p<1) requestAnimationFrame(step)};
  requestAnimationFrame(step);
}
function downloadPNG(chart, name){
  const url=chart.toBase64Image();
  const a=document.createElement('a'); a.href=url; a.download=(name||'chart')+'.png'; a.click();
}
function buildSQL(){
  const where=[];
  if(filters.regions.size) where.push(`region IN (${[...filters.regions].map(r=>`'${r}'`).join(', ')})`);
  if(filters.smoker!=='all') where.push(`smoker='${filters.smoker}'`);
  if(filters.age) where.push(`age BETWEEN ${filters.age[0]} AND ${filters.age[1]}`);
  if(filters.children!=='all') where.push(`children=${filters.children}`);
  const sql = `SELECT *\nFROM insurance\n${where.length?('WHERE '+where.join(' AND ')):''}\nLIMIT 1000;`;
  document.getElementById('sqlText').textContent=sql;
  // Hook: replace with backend query
  // fetch('/api/chart-data', {method:'POST', body: JSON.stringify({filters})})
}
function applyFilters(rows){
  return rows.filter(r=>{
    if(filters.regions.size && !filters.regions.has(r.region)) return false;
    if(filters.smoker!=='all' && r.smoker!==filters.smoker) return false;
    const a=+r.age; if(a<filters.age[0]||a>filters.age[1]) return false;
    if(filters.children!=='all' && +r.children!==+filters.children) return false;
    return true;
  });
}
function setSeg(container,val){
  container.querySelectorAll('.seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.val===val));
}
function fmtINR(v){return '₹'+Math.round(v).toLocaleString('en-IN')}

function updateKPIs(rows){
  const kPrem=document.getElementById('kpi-premium');
  const kSmk=document.getElementById('kpi-smokers');
  const kBmi=document.getElementById('kpi-bmi');
  const kHigh=document.getElementById('kpi-highest');
  const avgCharges = rows.reduce((s,r)=>s+ +r.charges,0)/Math.max(rows.length,1);
  const bmiAvg = rows.reduce((s,r)=>s+ +r.bmi,0)/Math.max(rows.length,1);
  const pctSmoker = Math.round(100*rows.filter(r=>r.smoker==='yes').length/Math.max(rows.length,1));
  const highest = rows.reduce((m,r)=>Math.max(m, +r.charges),0);
  animateNumber(kPrem, Math.round(avgCharges*INR/10), fmtINR);
  animateNumber(kSmk, pctSmoker, v=>v+'%');
  animateNumber(kBmi, bmiAvg, v=>v.toFixed? v.toFixed(1):v);
  animateNumber(kHigh, Math.round(highest*INR/10), fmtINR);
}

function makeCtx(id){return document.getElementById(id).getContext('2d')}

function renderCharts(rows){
  const bySmoker={yes:[], no:[]}; rows.forEach(r=>bySmoker[r.smoker].push(r));
  // Scatter BMI vs Charges
  const scatterData = rows.map(r=>({x:+r.bmi, y:+r.charges, smoker:r.smoker, tooltip:`Age ${r.age}, ${r.sex}, kids ${r.children}\nCharges: $${(+r.charges).toFixed(0)}`}));
  charts.scatter?.destroy();
  charts.scatter = new Chart(makeCtx('chart-scatter'),{
    type:'scatter',
    data:{datasets:[
      {label:'Non-smoker', data:scatterData.filter(p=>p.smoker==='no'), backgroundColor:palette[0], pointRadius:3},
      {label:'Smoker', data:scatterData.filter(p=>p.smoker==='yes'), backgroundColor:palette[4], pointRadius:3}
    ]},
options:{responsive:true, animation:{duration:600}, plugins:{tooltip:{callbacks:{label:(ctx)=>`${ctx.raw.tooltip}`}}, legend:{position:'bottom'}}, scales:{x:{title:{display:true,text:'BMI'}}, y:{title:{display:true,text:'Charges ($)'}}}}
  });

  // Bar: Avg Charges by Region (sorted)
  const regions=['northeast','northwest','southeast','southwest'];
  const regAgg = regions.map(r=>{const t=rows.filter(x=>x.region===r);const avg=t.reduce((s,a)=>s+ +a.charges,0)/Math.max(t.length,1);return {r,avg}}).sort((a,b)=>b.avg-a.avg);
  charts.barRegion?.destroy();
  charts.barRegion=new Chart(makeCtx('chart-bar-region'),{type:'bar', data:{labels:regAgg.map(x=>x.r), datasets:[{label:'Avg Charges ($)', data:regAgg.map(x=>x.avg), backgroundColor:palette[2]}]}, options:{responsive:true, animation:{duration:600}, scales:{y:{beginAtZero:true}}}});

  // Box-like: by smoker (approx using min/q1/med/q3/max)
function fiveNum(vals){if(!vals.length) return [0,0,0,0,0]; vals=[...vals].sort((a,b)=>a-b); const q=(p)=>{const i=(vals.length-1)*p; const lo=Math.floor(i), hi=Math.ceil(i); return lo===hi?vals[lo]:vals[lo]+(vals[hi]-vals[lo])*(i-lo)}; return [vals[0], q(0.25), q(0.5), q(0.75), vals[vals.length-1]];}
  const sNo=fiveNum(bySmoker.no.map(r=>+r.charges));
  const sYes=fiveNum(bySmoker.yes.map(r=>+r.charges));
  const boxData={labels:['Non-Smoker','Smoker'], datasets:[
    {label:'min', data:[sNo[0], sYes[0]], backgroundColor:'rgba(0,0,0,0)'},
    {label:'q1', data:[sNo[1], sYes[1]], backgroundColor:'rgba(0,0,0,0)'},
    {label:'median', data:[sNo[2], sYes[2]], backgroundColor:'rgba(0,0,0,0)'},
    {label:'q3', data:[sNo[3], sYes[3]], backgroundColor:'rgba(0,0,0,0)'},
    {label:'max', data:[sNo[4], sYes[4]], backgroundColor:'rgba(0,0,0,0)'}
  ]};
  charts.boxSmoker?.destroy();
  charts.boxSmoker=new Chart(makeCtx('chart-box-smoker'),{
    type:'bar', data:{labels:boxData.labels, datasets:[{label:'Spread', data:boxData.labels.map((_,i)=>boxData.datasets[4].data[i]-boxData.datasets[0].data[i]), backgroundColor:'rgba(99,102,241,.35)'}]},
    options:{responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:(ctx)=>{const i=ctx.dataIndex;const lab=boxData.labels[i];const parts=[`min ${Math.round(boxData.datasets[0].data[i])}` ,`q1 ${Math.round(boxData.datasets[1].data[i])}`,`med ${Math.round(boxData.datasets[2].data[i])}`,`q3 ${Math.round(boxData.datasets[3].data[i])}`,`max ${Math.round(boxData.datasets[4].data[i])}`]; return `${lab}: ${parts.join(' | ')}`}}}}, scales:{y:{beginAtZero:true}}}
  });

  // Pie: smokers
  const countYes=bySmoker.yes.length, countNo=bySmoker.no.length;
  charts.pieSmoker?.destroy();
  charts.pieSmoker=new Chart(makeCtx('chart-pie-smoker'),{type:'pie', data:{labels:['Non-Smoker','Smoker'], datasets:[{data:[countNo,countYes], backgroundColor:[palette[0], palette[4]]}]}, options:{responsive:true, aspectRatio:1.4, animation:{duration:600}}});

  // Grouped bar: Avg charges by number of children
  const childVals=[0,1,2,3,4,5];
  const childAgg=childVals.map(c=>{const t=rows.filter(r=>+r.children===c); return Math.round(t.reduce((s,a)=>s+ +a.charges,0)/Math.max(t.length,1))});
  charts.groupChildren?.destroy();
  charts.groupChildren=new Chart(makeCtx('chart-group-children'),{type:'bar', data:{labels:childVals.map(String), datasets:[{label:'Avg Charges ($)', data:childAgg, backgroundColor:palette[5]}]}, options:{responsive:true, animation:{duration:600}, scales:{y:{beginAtZero:true}}}});

  // Optional line: charges vs age (avg by age)
  const agesAgg={}; rows.forEach(r=>{const a=+r.age; (agesAgg[a]=agesAgg[a]||[]).push(+r.charges)});
  const ageLabels=Object.keys(agesAgg).map(x=>+x).sort((a,b)=>a-b);
  const ageAvg=ageLabels.map(a=>{const t=agesAgg[a];return Math.round(t.reduce((s,v)=>s+v,0)/t.length)});
  charts.lineAge?.destroy();
  charts.lineAge=new Chart(makeCtx('chart-line-age'),{type:'line', data:{labels:ageLabels, datasets:[{label:'Avg Charges ($)', data:ageAvg, borderColor:palette[1], fill:false, tension:.25}]}, options:{responsive:true, animation:{duration:600}, plugins:{legend:{display:false}}}});
}

function wireCardActions(){
  document.querySelectorAll('[data-download]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const card=btn.closest('.card');
      const key=card.dataset.card;
      const cmap={scatter:charts.scatter, 'bar-region':charts.barRegion, 'box-smoker':charts.boxSmoker, 'pie-smoker':charts.pieSmoker, 'group-children':charts.groupChildren, 'line-age':charts.lineAge};
      const ch=cmap[key]; if(ch) downloadPNG(ch, key);
    });
  });
  const modal=document.getElementById('modal');
  const modalClose=document.getElementById('modalClose');
  const modalCanvas=document.getElementById('modalCanvas');
  const modalTitle=document.getElementById('modalTitle');
  const modalDownload=document.getElementById('modalDownload');
  let modalChart=null;
  function closeModal(){ modal.hidden=true; modalChart?.destroy(); modalChart=null }
  modalClose.addEventListener('click',closeModal);
  modal.addEventListener('click',(e)=>{ if(e.target===modal) closeModal(); });
  document.addEventListener('keydown',(e)=>{ if(!modal.hidden && e.key==='Escape') closeModal(); });
  document.querySelectorAll('[data-expand]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const card=btn.closest('.card'); const key=card.dataset.card; modal.hidden=false; modalTitle.textContent=card.querySelector('.title').textContent+ ' — Expanded';
      modalChart?.destroy();
      // Simple clone: rebuild using same data factory
      const map={scatter:()=>charts.scatter.config, 'bar-region':()=>charts.barRegion.config, 'box-smoker':()=>charts.boxSmoker.config, 'pie-smoker':()=>charts.pieSmoker.config, 'group-children':()=>charts.groupChildren.config, 'line-age':()=>charts.lineAge.config};
      const cfg=map[key]? JSON.parse(JSON.stringify(map[key]())):null;
      if(cfg){ modalChart=new Chart(modalCanvas.getContext('2d'), cfg); modalDownload.onclick=()=>downloadPNG(modalChart, key+'-expanded'); }
    });
  });
}

function wireFilters(){
  // Region checkboxes
  document.querySelectorAll('#filter-region input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('change',()=>{ cb.checked?filters.regions.add(cb.value):filters.regions.delete(cb.value); update(); });
  });
  // Smoker seg
  const seg=document.getElementById('filter-smoker');
  seg.querySelectorAll('.seg-btn').forEach(b=> b.addEventListener('click',()=>{filters.smoker=b.dataset.val; setSeg(seg,filters.smoker); update();}));
  // Age sliders
  const aMin=document.getElementById('ageMin');
  const aMax=document.getElementById('ageMax');
  const lMin=document.getElementById('ageMinLbl');
  const lMax=document.getElementById('ageMaxLbl');
  function sync(){ let lo=+aMin.value, hi=+aMax.value; if(lo>hi){ if(this===aMin) hi=lo; else lo=hi; aMin.value=lo; aMax.value=hi; } lMin.textContent=lo; lMax.textContent=hi; filters.age=[lo,hi]; update(); }
  aMin.addEventListener('input',sync); aMax.addEventListener('input',sync);
  // Children
  document.getElementById('filter-children').addEventListener('change',(e)=>{filters.children=e.target.value; update();});
  document.getElementById('resetFilters').addEventListener('click',()=>{
    filters={regions:new Set(), smoker:'all', age:[18,64], children:'all'};
    document.querySelectorAll('#filter-region input').forEach(cb=>cb.checked=false);
    setSeg(seg,'all');
    document.getElementById('ageMin').value=18; document.getElementById('ageMax').value=64; lMin.textContent=18; lMax.textContent=64;
    document.getElementById('filter-children').value='all';
    update();
  });
  // Collapse sidebar
  const toggle=document.getElementById('toggleSidebar');
  const panel=document.getElementById('filtersPanel');
  toggle.addEventListener('click',()=>{panel.classList.toggle('collapsed'); toggle.textContent=panel.classList.contains('collapsed')?'⟩':'⟨'});
}

function update(){
  const rows=applyFilters(allRows);
  updateKPIs(rows);
  renderCharts(rows);
  buildSQL();
}

(async function(){
  try{
    const [_summary,_dist,rows]=await Promise.all([
      api('/analysis/summary'),
      api('/analysis/distributions'),
      api('/dataset/sample?limit=1338')
    ]);
    summary=_summary; dist=_dist; allRows=rows;
    // Hook: /api/aggregates could serve KPI values directly
    // const kpi = await fetch('/api/aggregates', {method:'POST', body: JSON.stringify({filters})})
    status.textContent='';
    wireFilters();
    wireCardActions();
    update();
  }catch(err){
    console.error(err); status.textContent='Error: '+err.message;
  }
})();
