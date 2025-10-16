setActive('nav-predict');

const form=document.getElementById('predict-form');
const out=document.getElementById('prediction-output');
const rateINR=83; // approx conversion USD->INR
const inrFmt=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});

form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const payload={
    age:+form.age.value,
    sex:form.sex.value,
    bmi:+form.bmi.value,
    children:+form.children.value,
    smoker:form.smoker.value,
    region:form.region.value
  };
  try{
    const data=await api('/predict',{method:'POST',body:JSON.stringify(payload)});
    console.log('Prediction response:',data);
    // Model predicts in USD (~$5000), convert to INR but scale down
    const inrTarget = Math.round((data.prediction * rateINR) / 10);
    const start = performance.now();
    const duration = 900;
    const animate= (t)=>{
      const p = Math.min(1,(t-start)/duration);
      const val = Math.floor(inrTarget * (0.2 + 0.8*p));
      out.innerHTML = `Estimated Annual Premium: ${inrFmt.format(val)} <span class=\"p\" style=\"display:block;font-size:14px;color:var(--muted)\">(scaled approx, 1 USD ≈ ₹${rateINR})</span>`;
      if(p<1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }catch(err){
    console.error('Prediction error:',err);
    out.textContent='Error: '+err.message;
  }
});
