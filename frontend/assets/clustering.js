setActive('nav-clustering');

const palette=['#2B8EFF','#00BFA5','#6366F1','#F59E0B','#EF4444','#10B981'];
let rows=[];
let assignments=[]; // cluster id per row index
let K=3;
let feat=['age','bmi','charges'];
let chart=null;
let clusterFilter='all';

(async function init(){
  rows = await api('/dataset/sample?limit=1338');
  wire();
  run();
})();

function wire(){
  document.getElementById('kSelect').addEventListener('change',e=>{K=+e.target.value});
  document.getElementById('featSel').querySelectorAll('input').forEach(cb=>cb.addEventListener('change',()=>{
    feat=[...document.querySelectorAll('#featSel input:checked')].map(x=>x.value);
    if(feat.length===0){ feat=['bmi','charges']; }
  }));
  document.getElementById('runBtn').addEventListener('click',run);
  document.getElementById('clusterFilter').addEventListener('change',(e)=>{clusterFilter=e.target.value; renderTable();});
  document.getElementById('exportCsv').addEventListener('click',exportCsv);
  document.getElementById('resetHighlight').addEventListener('click',()=>{ resetHighlight(); });
  document.getElementById('resetDefaults').addEventListener('click',()=>{
    K=3; feat=['age','bmi','charges'];
    document.querySelectorAll('#featSel input').forEach(cb=>{ cb.checked=['age','bmi','charges'].includes(cb.value); });
    document.getElementById('kSelect').value='3';
    document.getElementById('clusterFilter').value='all'; clusterFilter='all';
    run();
  });
  // expand/download
  const modal=document.getElementById('clusterModal');
  const modalClose=document.getElementById('clusterModalClose');
  const modalCanvas=document.getElementById('clusterModalCanvas');
  const modalDownload=document.getElementById('clusterModalDownload');
  let modalChart=null;
  function closeModal(){ modal.hidden=true; modalChart?.destroy(); modalChart=null }
  modalClose.addEventListener('click',closeModal);
  modal.addEventListener('click',(e)=>{ if(e.target===modal) closeModal(); });
  document.addEventListener('keydown',(e)=>{ if(!modal.hidden && e.key==='Escape') closeModal(); });
  document.getElementById('clusterExpand').addEventListener('click',()=>{
    modal.hidden=false; modalChart?.destroy();
    const cfg=JSON.parse(JSON.stringify(chart.config));
    modalChart=new Chart(modalCanvas.getContext('2d'), cfg);
    modalDownload.onclick=()=>{
      const a=document.createElement('a'); a.href=modalChart.toBase64Image(); a.download='cluster_scatter.png'; a.click();
    };
  });
  document.getElementById('clusterDownload').addEventListener('click',()=>{
    const a=document.createElement('a'); a.href=chart.toBase64Image(); a.download='cluster_scatter.png'; a.click();
  });
}

function normCols(data, cols){
  const mins={}, maxs={}; cols.forEach(c=>{mins[c]=Infinity; maxs[c]=-Infinity});
  data.forEach(r=>cols.forEach(c=>{const v=+r[c]; if(v<mins[c]) mins[c]=v; if(v>maxs[c]) maxs[c]=v;}));
  return data.map(r=>cols.map(c=>{const v=+r[c]; const d=maxs[c]-mins[c]||1; return (v-mins[c])/d;}));
}

function kmeans(data, k, iters=8){
  // init centers randomly
  const idx=Array.from({length:k},()=>Math.floor(Math.random()*data.length));
  let centers=idx.map(i=>data[i].slice());
  let assign=new Array(data.length).fill(0);
  for(let it=0; it<iters; it++){
    // assign
    for(let i=0;i<data.length;i++){
      let best=0,bd=Infinity; for(let c=0;c<k;c++){const d=dist2(data[i],centers[c]); if(d<bd){bd=d; best=c}} assign[i]=best;
    }
    // update
    const sums=Array.from({length:k},()=>Array(data[0].length).fill(0));
    const counts=Array(k).fill(0);
    for(let i=0;i<data.length;i++){const a=assign[i]; counts[a]++; for(let j=0;j<data[0].length;j++) sums[a][j]+=data[i][j];}
    for(let c=0;c<k;c++){ if(counts[c]>0){ for(let j=0;j<data[0].length;j++){ centers[c][j]=sums[c][j]/counts[c]; } } }
  }
  return {assign, centers};
}
function dist2(a,b){let s=0; for(let i=0;i<a.length;i++){const d=a[i]-b[i]; s+=d*d} return s}

function run(){
  const X = normCols(rows, feat);
  const {assign} = kmeans(X, K);
  assignments=assign;
  render();
}

function render(){
  // scatter colored by cluster; choose axes by feature selection
  const haveBMI=feat.includes('bmi');
  const haveCharges=feat.includes('charges');
  let xKey='bmi', yKey='charges', title='BMI vs Charges';
  if(!(haveBMI && haveCharges)) { xKey='age'; yKey='charges'; title='Age vs Charges'; document.getElementById('scatterNote').textContent='Scatter shows Age vs Charges because fewer than 2 features were selected.'; }
  else { document.getElementById('scatterNote').textContent='Click a cluster card to highlight points. Reset to show all.'; }
  const pts = rows.map((r,i)=>({x:+r[xKey], y:+r[yKey], c:assignments[i], tooltip:`age ${r.age}, sex ${r.sex}, bmi ${(+r.bmi).toFixed(1)}, smoker ${r.smoker}, kids ${r.children}, charges $${(+r.charges).toFixed(0)}`}));
  const ds = Array.from({length:K},(_,k)=>({label:'Cluster '+(k+1), data: pts.filter(p=>p.c===k), backgroundColor: palette[k%palette.length], pointRadius:3}));
  chart?.destroy();
  requestAnimationFrame(()=>{ chart=new Chart(document.getElementById('clusterScatter'),{type:'scatter', data:{datasets:ds}, options:{responsive:true, plugins:{tooltip:{callbacks:{label:(ctx)=>ctx.raw.tooltip}}, legend:{position:'bottom'}}, scales:{x:{title:{display:true,text:title.split(' vs ')[0].toUpperCase()}}, y:{title:{display:true,text:title.split(' vs ')[1]+' ($)'}}}}}); });

  // summaries
  const groups=Array.from({length:K},()=>[]);
  rows.forEach((r,i)=>groups[assignments[i]].push(r));
  const cards=document.getElementById('clusterCards');
  cards.innerHTML = groups.map((g,idx)=>{
    const avg=(arr, k)=>arr.reduce((s,r)=>s+ +r[k],0)/Math.max(arr.length,1);
    const smokers=Math.round(100*g.filter(r=>r.smoker==='yes').length/Math.max(g.length,1));
    const color=palette[idx%palette.length];
    return `<div class="kpi-card" data-idx="${idx}" style="cursor:pointer">
      <div class="kpi-title"><span class="badge" style="background:${color}"></span>Cluster ${idx+1}</div>
      <div class="kpi-value">${g.length} members</div>
      <div class="p" style="margin-top:6px">avg age ${avg(g,'age').toFixed(1)}, bmi ${avg(g,'bmi').toFixed(1)}, charges $${avg(g,'charges').toFixed(0)}, smokers ${smokers}%</div>
      <div class="p" style="font-size:12px;color:var(--muted)">Insight: older smokers cluster → higher charges</div>
    </div>`
  }).join('');
  cards.querySelectorAll('.kpi-card').forEach(card=>{
    card.addEventListener('click',()=>{
      const idx=+card.dataset.idx;
      chart.data.datasets.forEach((d,i)=>{d.backgroundColor = i===idx? d.backgroundColor: d.backgroundColor+'66'});
      chart.update();
    });
  });

  // insight
  const sizes=groups.map(g=>g.length);
  const maxI=sizes.indexOf(Math.max(...sizes));
  const minI=sizes.indexOf(Math.min(...sizes));
  document.getElementById('clusterInsight').textContent = `Largest segment: Cluster ${maxI+1} (${sizes[maxI]} members). Smallest: Cluster ${minI+1} (${sizes[minI]}).`;

  renderTable();

  // distribution charts
  renderDistributions(groups);
}

function resetHighlight(){
  if(!chart) return;
  chart.data.datasets.forEach((d,i)=>{ d.backgroundColor = palette[i%palette.length]; });
  chart.update();
}

function renderTable(){
  const tbody=document.querySelector('#clusterTable tbody');
  let data = rows.map((r,i)=>({...r, cluster: assignments[i]}));
  if(clusterFilter!=='all'){ const k=+clusterFilter-1; data=data.filter(r=>r.cluster===k); }
  const sample = data.slice(0,20);
  tbody.innerHTML = sample.map(r=>`<tr>
    <td>${r.age}</td><td>${r.sex}</td><td>${(+r.bmi).toFixed(1)}</td><td>${r.children}</td><td>${r.smoker}</td><td>${(+r.charges).toFixed(0)}</td><td>${r.cluster+1}</td>
  </tr>`).join('');
}

let chartsCl={};
function renderDistributions(groups){
  // sizes
  const sizes=groups.map(g=>g.length);
  chartsCl.sizes?.destroy();
  chartsCl.sizes=new Chart(document.getElementById('chartClusterSizes'),{type:'bar', data:{labels:sizes.map((_,i)=>'C'+(i+1)), datasets:[{label:'Count', data:sizes, backgroundColor:palette}]}, options:{responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}});
  // charges spread (box-like)
  function five(vals){if(!vals.length) return [0,0,0,0,0]; vals=[...vals].sort((a,b)=>a-b); const q=(p)=>{const i=(vals.length-1)*p; const lo=Math.floor(i), hi=Math.ceil(i); return lo===hi?vals[lo]:vals[lo]+(vals[hi]-vals[lo])*(i-lo)}; return [vals[0],q(0.25),q(0.5),q(0.75),vals[vals.length-1]]}
  const stats=groups.map(g=>five(g.map(r=>+r.charges)));
  chartsCl.spread?.destroy();
  chartsCl.spread=new Chart(document.getElementById('chartClusterCharges'),{type:'bar', data:{labels:stats.map((_,i)=>'C'+(i+1)), datasets:[{label:'Range', data:stats.map(s=>s[4]-s[0]), backgroundColor:'rgba(99,102,241,.35)'}]}, options:{responsive:true, plugins:{legend:{display:false}, tooltip:{callbacks:{label:(ctx)=>{const s=stats[ctx.dataIndex]; return `min ${s[0].toFixed(0)} | q1 ${s[1].toFixed(0)} | med ${s[2].toFixed(0)} | q3 ${s[3].toFixed(0)} | max ${s[4].toFixed(0)}`;}}}}, scales:{y:{beginAtZero:true}}}});
  // radar
  const avg=(arr,k)=>arr.reduce((s,r)=>s+ +r[k],0)/Math.max(arr.length,1);
  const radarLabels=['age','bmi','children','charges'];
  const radarData=groups.map((g,i)=>({label:'C'+(i+1), data:[avg(g,'age'),avg(g,'bmi'),avg(g,'children'),avg(g,'charges')], borderColor:palette[i%palette.length], backgroundColor:palette[i%palette.length]+'33'}));
  chartsCl.radar?.destroy();
  chartsCl.radar=new Chart(document.getElementById('chartClusterRadar'),{type:'radar', data:{labels:radarLabels, datasets:radarData}, options:{responsive:true, plugins:{legend:{position:'bottom'}}}});
}

function exportCsv(){
  const header=['age','sex','bmi','children','smoker','charges','cluster'];
  let csv=header.join(',')+'\n';
  rows.forEach((r,i)=>{csv+=`${r.age},${r.sex},${r.bmi},${r.children},${r.smoker},${r.charges},${assignments[i]+1}\n`});
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='clusters.csv'; a.click();
}
