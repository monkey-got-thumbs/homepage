
"use strict";
const $=s=>document.querySelector(s);
const money=v=>(v<0?"-$":"$")+Math.abs(Math.round(v)).toLocaleString();
const CATS=["rent","food","fun","transport"];
const META={income:{s:18,st:10},rent:{s:14,st:10},food:{s:12,st:10},fun:{s:12,st:10},transport:{s:12,st:10},target:{s:14,st:10}};
const M={income:4200,rent:1650,food:620,fun:380,transport:260,target:1600,locked:false,move:false,proposeOn:null,alt:null};
window.__M=M;
const spend=s=>s.rent+s.food+s.fun+s.transport;
const income=s=>s.locked?s.target+spend(s):s.income;
const savings=s=>s.locked?s.target:s.income-spend(s);
const gap=s=>s.locked?0:s.target-(s.income-spend(s));
const verdict=s=>{const v=savings(s),p=v/income(s);return v<0?['v-bad','overdrawn']:p<0.10?['v-bad','very tight']:p<0.22?['v-warn','tight']:['v-good','comfortable'];};
const solve=s=>{const g=gap(s);if(g<=0)return null;const order=s.proposeOn?[s.proposeOn,...CATS.filter(c=>c!==s.proposeOn)]:["fun","transport","food","rent"];for(const c of order)if(s[c]>=g)return{cat:c,amt:g};return null;};
const N=(o,w,c="",tag="M")=>`<span class="scrub s-${w} ${c}" data-o="${tag}" data-w="${w}">${money(o[w])}</span>`;
const lock=()=>`<span class="lock" data-act="lock" title="${M.locked?'income is flexing to hold your goal':'let income flex to your goal'}">${M.locked?'🔒':'🔓'}</span>`;

function draw(){
  const [vc,vw]=verdict(M), sav=savings(M), g=gap(M);
  const inc=M.locked?`<span class="gnum">${money(income(M))}</span> ${lock()}`:`${N(M,'income')} ${lock()}`;
  // calm core sentence (neutral, succinct)
  $("#doc").innerHTML=`Take-home ${inc}. After rent ${N(M,'rent')}, food ${N(M,'food')}, `+
    `fun ${N(M,'fun')} and transport ${N(M,'transport')}, <span class="live ${vc}">${money(sav)}</span> remains — `+
    `<span class="verdict ${vc}">${vw}</span>.`;
  // one adaptive line; powers tucked behind links
  const fwd = sav>0?`On track for <span class="live">${money(sav*12)}</span> a year.`:`The gap widens <span class="verdict v-bad">${money(-sav*12)}</span> a year.`;
  let ex="";
  if(M.locked){
    ex=`<div class="line">Balanced to your ${N(M,'target','s-goal')} goal — income absorbs each change. ${fwd}</div>`;
  } else if(g>0){
    if(!M.move){
      ex=`<div class="line"><span class="verdict v-warn">${money(g)}</span> below your ${N(M,'target','s-goal')} goal. ${fwd}<br>`+
         `<a data-act="move">smallest move ▸</a><a class="alt" data-act="fork">compare a what-if ▸</a></div>`;
    } else {
      const s=solve(M);
      ex=`<div class="panel">Smallest move: cut <span style="color:var(--${s.cat})">${s.cat}</span> by <span class="gnum">${money(s.amt)}</span> → hits ${money(M.target)}. `+
         `<button class="btn" data-act="apply">apply</button><button class="btn ghost" data-act="dismiss">dismiss</button><br>`+
         `<span style="font-size:13px;color:var(--mut)">or steer onto </span>`+CATS.map(c=>`<span class="chip ${(M.proposeOn||'fun')===c?'on':''}" data-act="steer" data-cat="${c}">${c}</span>`).join("")+`</div>`;
    }
  } else {
    ex=`<div class="line"><span class="verdict v-good">${money(-g)}</span> past your ${N(M,'target','s-goal')} goal. ${fwd}<br><a class="alt" data-act="fork">compare a what-if ▸</a></div>`;
  }
  // hand-authored rival (only when forked)
  if(M.alt){
    const aSav=M.alt.income-spend(M.alt), d=aSav-savings(M), dg=M.alt.target-aSav;
    ex+=`<div class="whatif"><span class="h">your what-if — scrub it</span>`+
      `Income ${N(M.alt,'income','','ALT')} → rent ${N(M.alt,'rent','','ALT')}, food ${N(M.alt,'food','','ALT')}, fun ${N(M.alt,'fun','','ALT')}, transport ${N(M.alt,'transport','','ALT')}: `+
      `saves <span class="live">${money(aSav)}</span> (<span class="verdict ${d>=0?'v-good':'v-bad'}">${d>=0?'+':''}${money(d)}</span> vs now), `+
      `<span class="verdict ${dg<=0?'v-good':'v-warn'}">${dg<=0?money(-dg)+' past':money(dg)+' short of'}</span> the ${money(M.alt.target)} goal. `+
      `<button class="btn" data-act="adopt">adopt</button><button class="btn ghost" data-act="discard">discard</button></div>`;
  }
  $("#extra").innerHTML=ex;
  $("#note").textContent="One sentence by default. The 🔒 balances income to your goal; “smallest move” is the agent’s proposal; “what-if” forks a copy you steer by hand. Everything computes from the numbers above — nothing is fixed text.";
}

const stateOf=t=>t==="ALT"?M.alt:M;
let sc=null;
document.addEventListener("pointerdown",e=>{const sb=e.target.closest(".scrub");if(!sb)return;
  e.preventDefault();sb.classList.add("drag");const o=stateOf(sb.dataset.o);
  sc={o,w:sb.dataset.w,x:e.clientX,v:o[sb.dataset.w],el:sb,m:META[sb.dataset.w]};sb.setPointerCapture(e.pointerId);});
document.addEventListener("pointermove",e=>{if(!sc)return;let nv=sc.v+(e.clientX-sc.x)*sc.m.s;nv=Math.max(0,Math.round(nv/sc.m.st)*sc.m.st);sc.o[sc.w]=nv;draw();});
document.addEventListener("pointerup",()=>{if(sc){sc.el.classList.remove("drag");sc=null;}});
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act;
  if(a==="lock")M.locked=!M.locked;
  else if(a==="move")M.move=true;
  else if(a==="dismiss")M.move=false;
  else if(a==="steer")M.proposeOn=t.dataset.cat;
  else if(a==="apply"){const s=solve(M);if(s)M[s.cat]-=s.amt;M.move=false;M.proposeOn=null;}
  else if(a==="fork")M.alt={income:income(M),rent:M.rent,food:M.food,fun:M.fun,transport:M.transport,target:M.target};
  else if(a==="adopt"){Object.assign(M,{income:M.alt.income,rent:M.alt.rent,food:M.alt.food,fun:M.alt.fun,transport:M.alt.transport,target:M.alt.target,locked:false,alt:null});}
  else if(a==="discard")M.alt=null;
  else return;
  draw();
});
draw();
