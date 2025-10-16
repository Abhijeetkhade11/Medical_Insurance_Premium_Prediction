const tipsData=[
  {title:'Maintain Healthy BMI', tag:'bmi', text:'Balanced diet and regular activity help keep BMI in range, often linked with lower costs.'},
  {title:'Quit Smoking', tag:'smoking', text:'Smoking is a strong driver of higher charges. Seek support programs and counseling.'},
  {title:'Preventive Care', tag:'prevention', text:'Annual checkups and screenings can reduce unexpected expenses over time.'},
  {title:'Hydration & Sleep', tag:'lifestyle', text:'Adequate water intake and 7–9 hours of sleep support overall wellness.'},
  {title:'Routine Activity', tag:'lifestyle', text:'Aim for 150 minutes/week of moderate exercise or as advised by your clinician.'},
  {title:'Nutrition Basics', tag:'bmi', text:'Prioritize whole grains, lean proteins, fruits, and vegetables; limit ultra-processed foods.'},
];

function renderTips(filter='all'){
  const grid=document.getElementById('tips');
  const items = tipsData.filter(t=> filter==='all' ? true : t.tag===filter);
  grid.innerHTML = items.map(t=>`<div class="tip-card"><h4>${t.title}</h4><p class="p">${t.text}</p><span class="p" style="font-size:12px;color:var(--muted)">#${t.tag}</span></div>`).join('');
}

document.getElementById('focus').addEventListener('change',e=>renderTips(e.target.value));

document.getElementById('shuffle').addEventListener('click',()=>{
  // simple shuffle
  for(let i=tipsData.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [tipsData[i],tipsData[j]]=[tipsData[j],tipsData[i]]}
  renderTips(document.getElementById('focus').value);
});

renderTips('all');
