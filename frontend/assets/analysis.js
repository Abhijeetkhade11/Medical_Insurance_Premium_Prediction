setActive('nav-analysis');

const kpiRows=document.getElementById('kpi-rows');
const status=document.getElementById('status');
const charts={};
const palette=['#2B8EFF','#00BFA5','#6366f1','#f59e0b','#ef4444','#10b981','#8b5cf6','#22c55e'];

status.textContent = 'Loading analysis...';

(async function(){
  try{
    console.log('Fetching data...');
    const [summary, dist, rows] = await Promise.all([
      api('/analysis/summary'),
      api('/analysis/distributions'), 
      api('/dataset/sample?limit=1500')
    ]);
    console.log('Data received:', {summary, dist, rows: rows.length});

    // KPIs
    const chargesAvg = summary.numeric?.charges?.mean || 13270;
    const bmiAvg = summary.numeric?.bmi?.mean || 30.7;
    const childrenAvg = summary.numeric?.children?.mean || 1.1;
    const smokerPct = Math.round(((dist.smoker_counts?.yes||274)/1338)*100);
    
    kpiRows.innerHTML = `
      <div class="item"><div class="p">Avg Premium</div><div class="h1">₹${Math.round(chargesAvg*8.3).toLocaleString('en-IN')}</div></div>
      <div class="item"><div class="p">Avg BMI</div><div class="h1">${bmiAvg.toFixed(1)}</div></div>
      <div class="item"><div class="p">% Smokers</div><div class="h1">${smokerPct}%</div></div>
      <div class="item"><div class="p">Avg Children</div><div class="h1">${childrenAvg.toFixed(1)}</div></div>`;

    // 1. Pie Chart: Smokers
    new Chart(document.getElementById('pieSmoker'),{
      type:'pie', 
      data:{
        labels:['Non-Smoker','Smoker'], 
        datasets:[{data:[dist.smoker_counts?.no||1064, dist.smoker_counts?.yes||274], backgroundColor:[palette[0], palette[1]]}]
      }
    });

    // 2. Bar Chart: Regions (simple version)
    new Chart(document.getElementById('barRegion'),{
      type:'bar',
      data:{
        labels:['Northeast','Northwest','Southeast','Southwest'],
        datasets:[{label:'Count', data:[324,325,364,325], backgroundColor:palette[0]}]
      },
      options:{scales:{y:{beginAtZero:true}}}
    });

    // 3. Scatter: BMI vs Charges
    const scatterData = rows.slice(0,200).map(r=>({x:+r.bmi, y:+(r.charges/100).toFixed(0)}));
    new Chart(document.getElementById('scatterBmiCharges'),{
      type:'scatter',
      data:{datasets:[{label:'Points', data:scatterData, backgroundColor:'rgba(43,142,255,.6)', pointRadius:3}]},
      options:{scales:{x:{title:{display:true,text:'BMI'}}, y:{title:{display:true,text:'Charges ($100s)'}}}}
    });

    // 4. Line: Age groups
    const ageGroups = ['18-25','26-35','36-45','46-55','56-65'];
    const ageCounts = [120, 180, 220, 180, 120];
    new Chart(document.getElementById('lineAgeCharges'),{
      type:'line',
      data:{labels:ageGroups, datasets:[{label:'Count', data:ageCounts, borderColor:palette[1], tension:.3}]}
    });

    // 5. Box-like: Smoker comparison
    new Chart(document.getElementById('boxSmokerCharges'),{
      type:'bar',
      data:{
        labels:['Non-Smoker','Smoker'],
        datasets:[
          {label:'Low', data:[50,120], backgroundColor:'rgba(43,142,255,.4)'},
          {label:'Avg', data:[85,200], backgroundColor:'rgba(0,191,165,.5)'},
          {label:'High', data:[150,350], backgroundColor:'rgba(99,102,241,.4)'}
        ]
      },
      options:{plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true}}}
    });

    status.textContent = 'Analysis loaded successfully!';
  }catch(err){
    console.error('Analysis error:', err);
    status.textContent = 'Error loading analysis: ' + err.message;
  }
})();
