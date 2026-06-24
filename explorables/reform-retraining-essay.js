
"use strict";
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FLOOR=3.0, U0=4.5;

const state={autom:3.0, invest:0.6, effect:55, mobility:30, horizon:10, lens:'society'};
const LEVERS={
  autom:{min:0,max:8,step:0.1,sens:0.02,fmt:v=>v.toFixed(1)+'%'},
  invest:{min:0,max:2.5,step:0.05,sens:0.006,fmt:v=>v.toFixed(2)+'% of GDP'},
  effect:{min:10,max:90,step:1,sens:0.22,fmt:v=>v.toFixed(0)+'%'},
  mobility:{min:0,max:100,step:1,sens:0.28,fmt:v=>v.toFixed(0)+'/100'},
  horizon:{min:3,max:20,step:1,sens:0.05,fmt:v=>v.toFixed(0)+' years'},
};
function compute(s){
  const D=s.autom;
  const tread=clamp(1-s.autom/16,0.4,1);
  const R=s.invest*1.8*(s.effect/100)*(1+s.mobility/200)*tread;
  const N=1.6+s.mobility/100*1.4;                 // natural reabsorption (mobility helps)
  const O=R+N, gap=D-O;
  // structural unemployment converges to a STEADY level set by the gap (not unbounded)
  const steady=g=>clamp(FLOOR+Math.max(0,g)*2.6+Math.min(0,g)*0.8,FLOOR,15);
  const uS=steady(gap), uBaseS=steady(D-1.6), tau=3;          // baseline = no active policy
  const uAt=t=>uS+(U0-uS)*Math.exp(-t/tau);
  const uBaseAt=t=>uBaseS+(U0-uBaseS)*Math.exp(-t/tau);
  const years=[];for(let t=0;t<=s.horizon;t++)years.push(t);
  const uTraj=years.map(uAt), uBase=years.map(uBaseAt), uFinal=uAt(s.horizon);
  const gdpLoss=Math.max(0,(uFinal-FLOOR))*0.85;
  const scar=clamp(18*(1-0.45*clamp(R/Math.max(D,0.01),0,1)),5,22);
  const ineq=clamp(22+(uFinal-4.5)*3.2+(scar-12)*0.7,5,70);
  let cum=0;const fisc=years.map(t=>{cum+=(uBaseAt(t)-uAt(t))*0.35 - s.invest;return cum;});
  let payoffYear=null;for(let t=1;t<years.length;t++){if(fisc[t]>0){payoffYear=t;break;}}
  return {D,R,N,O,gap,tread,uTraj,uBase,years,uFinal,gdpLoss,scar,ineq,fisc,payoffYear};
}

/* ---------- reactive prose ---------- */
const RX={
  shockSize:(s,d)=>d.gap>0.15?`the gap is <b class="bad">re-opening faster than it's being closed</b>.`:d.gap<-0.15?`the system is <b class="good">closing the gap and then some</b>.`:`the gap is roughly <b>holding steady</b>.`,
  keepup:(s,d)=>d.gap>0.15?`<b class="bad">can't keep up with</b>`:d.gap<-0.15?`<b class="good">now outpaces</b>`:`<b>roughly matches</b>`,
  gapVerdict:(s,d)=>d.gap>0.15?`<b class="bad">a widening mismatch of ${d.gap.toFixed(1)}%/yr</b>`:d.gap<-0.15?`<b class="good">a closing gap</b>`:`<b>a stable balance</b>`,
  tread:(s,d)=>s.autom>5?`<b class="bad">fast enough that skills go stale before workers can use them</b>`:s.autom>3?`<b class="warn">fast enough to bite</b>`:`<b class="good">slow enough that retraining can stick</b>`,
  trend:(s,d)=>d.gap>0.15?`<b class="bad">climbing away from</b>`:d.gap<-0.15?`<b class="good">falling back toward</b>`:`<b>holding near</b>`,
  payoff:(s,d)=>d.payoffYear?`<b class="good">pays for itself in year ${d.payoffYear}</b> — after that it's pure return`:`<b class="bad">never pays back inside your ${s.horizon}-year window</b>: the treadmill is winning, so retraining only slows the bleed`,
};
const OUT={
  autom2:(s,d)=>LEVERS.autom.fmt(s.autom), D:(s,d)=>d.D.toFixed(1)+'%/yr', R:(s,d)=>d.R.toFixed(2)+'%/yr',
  N:(s,d)=>d.N.toFixed(2)+'%/yr', O:(s,d)=>d.O.toFixed(2)+'%/yr',
  uFinal:(s,d)=>d.uFinal.toFixed(1)+'%', scar:(s,d)=>d.scar.toFixed(0)+'%',
  dkSpend:()=>'2% of GDP',
};
/* ---------- lens framing ---------- */
const LENS={
  intro:{
    worker:`<b>You've just been let go</b> — your plant is closing. The question that matters to you isn't GDP; it's how long you're out, how much pay you get back, and whether a course actually leads to a job.`,
    firm:`<b>You can't fill your vacancies.</b> The applicants don't have the skills, the skilled ones are in another city, and every month a role sits open it costs you output. Retraining is your hiring pipeline.`,
    government:`<b>You hold the budget.</b> Retraining is a bet: spend now, and <em>maybe</em> save later on benefits and gain on taxes — if the programs work and automation doesn't outrun them. Get it wrong and you've bought a treadmill.`,
    society:`<b>Zoom out.</b> Idle workers are lost output and rising inequality; a smooth transition is shared prosperity. The question is whether the whole system reabsorbs people faster than change displaces them.`,
  },
  fix:{
    worker:`For <b>you</b>, the dial that moves your life is <b>effectiveness</b> — a course that leads to a real job beats three that don't. Wage subsidies get you hired now; mobility support only helps if you're willing and able to move.`,
    firm:`For <b>employers</b>, <b>mobility</b> and <b>job-matching</b> matter most — the skills may exist, just not where you are. Apprenticeships build the pipeline you actually need rather than generic courses.`,
    government:`For <b>the Treasury</b>, watch the <b>J-curve</b> and the <b>payoff year</b>. Front-loaded spending only pays back if effectiveness clears a bar and automation stays below the treadmill threshold. Cheap job-search help is the safest first dollar.`,
    society:`For <b>society</b>, no single dial wins — it's the <b>mix</b>. Denmark's lesson is flexicurity: make change easy <em>and</em> catch people when it happens, so the floor falls instead of the people.`,
  },
  close:{
    worker:`Read as a worker, the essay is about <b>dignity and time</b>: getting back to good work before the scar sets.`,
    firm:`Read as an employer, it's about <b>filling roles</b>: the mismatch is your hiring problem, and training is the fix you under-invest in.`,
    government:`Read as the Treasury, it's a <b>portfolio bet</b>: spend smart and early, measure effectiveness ruthlessly, and beat the treadmill or don't bother.`,
    society:`Read as society, it's about <b>who absorbs the shock</b> — the worker through a wage scar, or all of us through a system that retrains faster than it displaces.`,
  },
};
const HEADMETRIC={worker:'scar',firm:'vac',government:'fiscal',society:'gdp'};

/* ---------- charts ---------- */
function elc(){return null}
function drawFlow(d){const sv=$("#flow"),W=600,L=120,R=20,maxV=8;const x=v=>L+v/maxV*(W-L-R);let s="";
  // inflow (displacement)
  s+=`<text x="${L-10}" y="46" font-size="12.5" text-anchor="end" fill="var(--disp)">displaced →</text>`;
  s+=`<rect class="inflow" x="${L}" y="32" width="${(x(d.D)-L).toFixed(1)}" height="24" rx="4" fill="var(--disp)" style="cursor:ew-resize"/><text x="${(x(d.D)+8).toFixed(1)}" y="49" font-size="12" font-family="var(--mono)" fill="var(--mut)">${d.D.toFixed(1)}%/yr</text>`;
  // outflow stacked: retrained + natural
  s+=`<text x="${L-10}" y="100" font-size="12.5" text-anchor="end" fill="var(--retr)">← reabsorbed</text>`;
  s+=`<rect x="${L}" y="86" width="${(x(d.R)-L).toFixed(1)}" height="24" rx="4" fill="var(--retr)"/>`;
  s+=`<rect x="${(x(d.R)).toFixed(1)}" y="86" width="${(x(d.O)-x(d.R)).toFixed(1)}" height="24" fill="var(--nat)"/>`;
  s+=`<text x="${(x(d.O)+8).toFixed(1)}" y="103" font-size="12" font-family="var(--mono)" fill="var(--mut)">${d.O.toFixed(2)}%/yr</text>`;
  s+=`<text x="${(L+ (x(d.R)-L)/2).toFixed(1)}" y="102" font-size="9.5" text-anchor="middle" fill="#fff">retrain</text>`;
  if(x(d.O)-x(d.R)>44)s+=`<text x="${((x(d.R)+x(d.O))/2).toFixed(1)}" y="102" font-size="9.5" text-anchor="middle" fill="#fff">natural</text>`;
  // gap bracket
  const gapPos=d.gap>0;
  s+=`<text x="${L}" y="148" font-size="12" fill="${gapPos?'var(--bad)':'var(--good)'}">net mismatch building up: <tspan font-family="var(--mono)" font-weight="700">${(d.gap>0?'+':'')+d.gap.toFixed(2)}%/yr</tspan> ${gapPos?'(getting worse)':'(getting better)'}</text>`;
  sv.innerHTML=s;
  $("#capFlow").innerHTML=gapPos?`More people are being displaced than reabsorbed — the pool of mismatched workers <b class="bad">grows</b> every year.`:`Reabsorption has caught up with displacement — the mismatch pool <b class="good">shrinks</b>.`;}

function drawTraj(d,s){const sv=$("#traj"),W=600,L=44,R=18,T=14,B=30,pw=W-L-R,ph=200-T-B;
  const X=t=>L+t/s.horizon*pw, mx=Math.max(8,Math.ceil(Math.max(...d.uBase,...d.uTraj))+1), Y=v=>T+ph*(1-v/mx);let g="";
  for(let v=0;v<=mx;v+=2)g+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" stroke="var(--faint)"/><text x="${L-5}" y="${(Y(v)+3).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--mut)" font-family="var(--mono)">${v}%</text>`;
  g+=`<line x1="${L}" y1="${Y(FLOOR).toFixed(1)}" x2="${W-R}" y2="${Y(FLOOR).toFixed(1)}" stroke="var(--good)" stroke-dasharray="4 3"/><text x="${W-R}" y="${(Y(FLOOR)-4).toFixed(1)}" font-size="8.5" text-anchor="end" fill="var(--good)">floor ${FLOOR}%</text>`;
  const path=arr=>{let p="";arr.forEach((v,t)=>p+=(t?"L":"M")+X(t).toFixed(1)+" "+Y(v).toFixed(1)+" ");return p;};
  g+=`<path d="${path(d.uBase)}" fill="none" stroke="var(--mut)" stroke-width="1.8" stroke-dasharray="5 4"/>`;
  g+=`<text x="${X(s.horizon).toFixed(1)}" y="${(Y(d.uBase[s.horizon])-6).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--mut)">do nothing</text>`;
  const col=d.gap>0.15?'var(--bad)':'var(--good)';
  g+=`<path d="${path(d.uTraj)}" fill="none" stroke="${col}" stroke-width="2.6"/>`;
  g+=`<circle class="hzn" cx="${X(s.horizon).toFixed(1)}" cy="${Y(d.uFinal).toFixed(1)}" r="6" fill="${col}" style="cursor:ew-resize"/>`;
  for(let t=0;t<=s.horizon;t+=Math.max(1,Math.round(s.horizon/6)))g+=`<text x="${X(t).toFixed(1)}" y="${T+ph+15}" font-size="9" text-anchor="middle" fill="var(--mut)">y${t}</text>`;
  sv.innerHTML=g;
  $("#capTraj").innerHTML=`Your policy ends at <b style="color:${col}">${d.uFinal.toFixed(1)}%</b> vs <b>${d.uBase[s.horizon].toFixed(1)}%</b> doing nothing — a gap of <b>${(d.uBase[s.horizon]-d.uFinal).toFixed(1)} points</b> of the workforce.`;}

function drawJ(d,s){const sv=$("#jcurve"),W=600,L=46,R=18,T=14,B=28,pw=W-L-R,ph=190-T-B;
  const X=t=>L+t/s.horizon*pw;const vals=d.fisc, lo=Math.min(0,...vals), hi=Math.max(0.5,...vals), Y=v=>T+ph*(1-(v-lo)/((hi-lo)||1));let g="";
  g+=`<line x1="${L}" y1="${Y(0).toFixed(1)}" x2="${W-R}" y2="${Y(0).toFixed(1)}" stroke="var(--ink)" stroke-width="1.2"/><text x="${L-5}" y="${(Y(0)+3).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--mut)">$0</text>`;
  let p="";vals.forEach((v,t)=>p+=(t?"L":"M")+X(t).toFixed(1)+" "+Y(v).toFixed(1)+" ");
  // area
  g+=`<path d="${p} L ${X(s.horizon).toFixed(1)} ${Y(0).toFixed(1)} L ${L} ${Y(0).toFixed(1)} Z" fill="${d.payoffYear?'var(--good)':'var(--bad)'}" opacity=".08"/>`;
  g+=`<path d="${p}" fill="none" stroke="${d.payoffYear?'var(--good)':'var(--bad)'}" stroke-width="2.6"/>`;
  if(d.payoffYear){const px=X(d.payoffYear);g+=`<line x1="${px.toFixed(1)}" y1="${T}" x2="${px.toFixed(1)}" y2="${T+ph}" stroke="var(--good)" stroke-dasharray="3 3"/><text x="${px.toFixed(1)}" y="${T+9}" font-size="9" text-anchor="middle" fill="var(--good)">pays back · y${d.payoffYear}</text>`;}
  for(let t=0;t<=s.horizon;t+=Math.max(1,Math.round(s.horizon/6)))g+=`<text x="${X(t).toFixed(1)}" y="${T+ph+14}" font-size="9" text-anchor="middle" fill="var(--mut)">y${t}</text>`;
  g+=`<text x="${L}" y="${T+ph+26}" font-size="9.5" fill="var(--mut)">cumulative net to the public purse (benefits saved + tax − program cost)</text>`;
  sv.innerHTML=g;
  $("#capJ").innerHTML=d.payoffYear?`Below zero for the first <b>${d.payoffYear} years</b> (you're paying), then <b class="good">positive</b> — the bet lands.`:`It never climbs back above zero in this window — <b class="bad">the spending doesn't recoup</b> here. Raise effectiveness, or slow the shock.`;}

function drawGauges(d,s){const head=HEADMETRIC[s.lens];
  const items=[
    {k:'gdp',lab:'Output lost',val:d.gdpLoss.toFixed(1)+'%',sub:'of GDP, from idle workers',bad:d.gdpLoss>2},
    {k:'scar',lab:'Wage scar',val:d.scar.toFixed(0)+'%',sub:'displaced workers’ lasting loss',bad:d.scar>14},
    {k:'fiscal',lab:'Pays back?',val:d.payoffYear?('yr '+d.payoffYear):'never',sub:'public investment payoff',bad:!d.payoffYear},
    {k:'vac',lab:'Unfilled need',val:Math.max(0,d.gap).toFixed(1)+'%',sub:'mismatch employers feel',bad:d.gap>0.15},
  ];
  // put headline metric first
  items.sort((a,b)=>(a.k===head?-1:b.k===head?1:0));
  $("#gauges").innerHTML=items.map(it=>`<div class="g ${it.k===head?'head':''}"><div class="lab">${it.lab}${it.k===head?' ◂ your lens':''}</div><div class="val ${it.bad?'bad':'good'}">${it.val}</div><div class="sub">${it.sub}</div></div>`).join('');
  $("#gaugeHint").innerHTML=`four outcomes, all live — your lens (<b>${s.lens}</b>) puts <b>${items[0].lab.toLowerCase()}</b> first`;}

/* ---------- render ---------- */
function render(){const d=compute(state),s=state;
  $$('.scrub').forEach(el=>el.textContent=LEVERS[el.dataset.k].fmt(s[el.dataset.k]));
  $$('[data-o]').forEach(el=>{const f=OUT[el.dataset.o];if(f)el.innerHTML=f(s,d);});
  $$('.rx').forEach(el=>{const f=RX[el.dataset.rx];if(f)el.innerHTML=f(s,d);});
  $$('[data-lens]').forEach(el=>{const k=el.dataset.lens;if(LENS[k])el.innerHTML=LENS[k][s.lens];});
  $("#standfirst").innerHTML=`A job market is an ecosystem: change displaces people, retraining and mobility pull them back. When the second outruns the first, the structural floor <b class="good">falls</b>. When it doesn't, the floor <b class="bad">rises</b> and the cost lands on someone. Right now it's <b class="${d.gap>0.15?'bad':'good'}">${d.gap>0.15?'rising':'falling'}</b>.`;
  $("#takeaway").innerHTML=`<b>The whole essay in one line:</b> reform and retraining work only when they reabsorb people <em>faster than change displaces them</em> — and that's a race between <b>effectiveness × investment</b> and the <b>automation treadmill</b>. ${d.gap>0.15?`Right now change is winning, so the floor sits at <b class="bad">${d.uFinal.toFixed(1)}%</b> and ${d.payoffYear?'the spend still pays back':'the spend doesn’t even pay back'}.`:`Right now the system is winning the race — the floor falls toward <b class="good">${d.uFinal.toFixed(1)}%</b>.`} Change the dials, or your lens, and see whose problem it becomes.`;
  drawFlow(d);drawTraj(d,s);drawJ(d,s);drawGauges(d,s);}

/* ---------- interactions ---------- */
let ps=null;
document.addEventListener("pointerdown",e=>{const t=e.target.closest(".scrub");if(!t)return;e.preventDefault();t.classList.add("drag");ps={k:t.dataset.k,x:e.clientX,v:state[t.dataset.k],el:t};t.setPointerCapture(e.pointerId);});
document.addEventListener("pointermove",e=>{if(!ps)return;const m=LEVERS[ps.k];let nv=ps.v+(e.clientX-ps.x)*m.sens;nv=clamp(Math.round(nv/m.step)*m.step,m.min,m.max);state[ps.k]=nv;render();});
document.addEventListener("pointerup",()=>{if(ps){ps.el.classList.remove("drag");ps=null;}});
// flow inflow drag -> autom
(function(){const sv=$("#flow");let on=false;const at=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;return clamp((p.matrixTransform(sv.getScreenCTM().inverse()).x-120)/(600-140)*8,0,8);};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.inflow'))return;on=true;sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(on){state.autom=Math.round(at(e.clientX)*10)/10;render();}});
  sv.addEventListener("pointerup",()=>on=false);})();
// trajectory horizon drag
(function(){const sv=$("#traj");let on=false;const at=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;return clamp(Math.round((p.matrixTransform(sv.getScreenCTM().inverse()).x-44)/(600-62)*state.horizon),3,20);};
  // map x to year across full 0..20 range regardless of current horizon:
  const yr=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;return clamp(Math.round((X-44)/(600-44-18)*state.horizon/ (state.horizon/20) ),3,20);};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.hzn'))return;on=true;sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!on)return;const p=sv.createSVGPoint();p.x=e.clientX;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;const frac=clamp((X-44)/(600-44-18),0.05,1);state.horizon=clamp(Math.round(frac*20),3,20);render();});
  sv.addEventListener("pointerup",()=>on=false);})();
// lens buttons
$(".lensbar").addEventListener("click",e=>{const b=e.target.closest('button');if(!b)return;state.lens=b.dataset.lens;$$('.lensbar button').forEach(x=>x.classList.toggle('on',x===b));render();});
window.__E={state,compute,render,set:(k,v)=>{state[k]=v;render();}};
render();
