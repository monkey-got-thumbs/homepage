
"use strict";
const $=s=>document.querySelector(s);
const T=v=>v>=1?"$"+v.toFixed(2)+"T":"$"+Math.round(v*1000)+"B";
const ST={rev:4.9, spend:6.8, debt:38.0, gdp:30.1, rate:2.4, years:0};
const PUBSHARE=28.86/36.22;
const deficit=()=>ST.spend-ST.rev;
const projDebt=()=>Math.max(0,ST.debt+deficit()*ST.years);
const publicDebt=()=>projDebt()*PUBSHARE;
const interest=()=>projDebt()*ST.rate/100;
const CEIL=41.1;

/* ===== HERO: budget bars + years ===== */
function drawHero(){const sv=$("#hero"),W=1040;let s="";
  const L=40,baseY=120,maxV=8,bw=70,h=v=>v/maxV*100,y=v=>baseY-h(v);
  // revenue & spending bars
  const bx=70;
  s+=`<text x="${bx+bw/2}" y="${baseY+16}" font-size="11" text-anchor="middle" fill="var(--rev)">revenue</text>`;
  s+=`<rect class="bRev" x="${bx}" y="${y(ST.rev).toFixed(1)}" width="${bw}" height="${h(ST.rev).toFixed(1)}" rx="4" fill="var(--rev)" style="cursor:ns-resize"/><text x="${bx+bw/2}" y="${(y(ST.rev)-5).toFixed(1)}" font-size="12" text-anchor="middle" font-weight="700" fill="var(--rev)" font-family="var(--mono)">${T(ST.rev)}</text>`;
  const sx=bx+bw+26;
  s+=`<text x="${sx+bw/2}" y="${baseY+16}" font-size="11" text-anchor="middle" fill="var(--spend)">spending</text>`;
  s+=`<rect class="bSpend" x="${sx}" y="${y(ST.spend).toFixed(1)}" width="${bw}" height="${h(ST.spend).toFixed(1)}" rx="4" fill="var(--spend)" style="cursor:ns-resize"/><text x="${sx+bw/2}" y="${(y(ST.spend)-5).toFixed(1)}" font-size="12" text-anchor="middle" font-weight="700" fill="var(--spend)" font-family="var(--mono)">${T(ST.spend)}</text>`;
  // deficit bracket
  const dfx=sx+bw+30,def=deficit();
  s+=`<line x1="${dfx}" y1="${y(ST.spend).toFixed(1)}" x2="${dfx}" y2="${y(ST.rev).toFixed(1)}" stroke="var(--spend)" stroke-width="2"/><text x="${dfx+6}" y="${((y(ST.spend)+y(ST.rev))/2+4).toFixed(1)}" font-size="12" fill="var(--spend)" font-weight="700">${def>=0?'deficit '+T(def):'surplus '+T(-def)}</text>`;
  // years slider + projected debt
  const slX=520,slW=300,slY=60;
  s+=`<text x="${slX}" y="${slY-12}" font-size="11" fill="var(--ink)">project forward</text>`;
  s+=`<line x1="${slX}" y1="${slY}" x2="${slX+slW}" y2="${slY}" stroke="var(--faint)" stroke-width="4" stroke-linecap="round"/>`;
  for(let yv=0;yv<=10;yv+=5)s+=`<text x="${slX+yv/10*slW}" y="${slY+16}" font-size="9" text-anchor="middle" fill="var(--mut)" font-family="var(--mono)">${yv}y</text>`;
  const hx=slX+ST.years/10*slW;
  s+=`<g class="yrKnob" style="cursor:ew-resize"><circle cx="${hx.toFixed(1)}" cy="${slY}" r="9" fill="var(--debt)"/></g>`;
  // projected debt big number
  s+=`<text x="${slX}" y="${slY+58}" font-size="11" fill="var(--mut)">projected national debt</text>`;
  s+=`<text x="${slX}" y="${slY+90}" font-size="30" font-weight="700" fill="var(--debt)" font-family="var(--mono)">${T(projDebt())}</text>`;
  sv.innerHTML=s;
  $("#capHero").innerHTML=`In <span class="scrub rev" data-s="rev">${T(ST.rev)}</span>, out <span class="scrub spend" data-s="spend">${T(ST.spend)}</span> → a <b class="${def>=0?'hot':'good'}">${def>=0?T(def)+' deficit':T(-def)+' surplus'}</b>. Hold that for <span class="scrub yrs" data-s="years">${ST.years} years</span> and the debt goes from ${T(ST.debt)} to <b>${T(projDebt())}</b>. (The US has run a deficit in 92 of the last 125 years.)`;
}

/* ===== INTEREST ===== */
function drawInt(){const sv=$("#int"),W=480,L=92,R=70;const it=interest(),items=[['Interest',it,'var(--int)'],['Defense',0.85,'var(--mut)'],['Medicare',0.87,'var(--mut)']];
  const mx=Math.max(...items.map(i=>i[1]),1)*1.1,x=v=>L+v/mx*(W-L-R);let s="";
  items.forEach((it2,i)=>{const y=18+i*40;s+=`<text x="${L-8}" y="${y+14}" font-size="11.5" text-anchor="end" fill="var(--ink)">${it2[0]}</text>`+
    `<rect x="${L}" y="${y}" width="${Math.max(2,x(it2[1])-L).toFixed(1)}" height="20" rx="4" fill="${it2[2]}" ${i===0?'class="iBar" style="cursor:ew-resize"':''}/>`+
    `<text x="${(x(it2[1])+6).toFixed(1)}" y="${y+15}" font-size="11" font-family="var(--mono)" fill="var(--mut)">${T(it2[1])}</text>`;});
  s+=`<text x="${L}" y="150" font-size="10" fill="var(--mut)">avg rate <tspan font-family="var(--mono)" fill="var(--int)" font-weight="700">${ST.rate.toFixed(1)}%</tspan> × debt ${T(projDebt())} — drag the orange bar</text>`;
  sv.innerHTML=s;
  const rank=it>0.87?'the largest of these':'climbing';
  $("#capInt").innerHTML=`At <b>${ST.rate.toFixed(1)}%</b> on ${T(projDebt())}, interest is <b class="hot">${T(it)}</b> — ${it>=0.85?'<b>above</b> both defense and Medicare':'below defense/Medicare'}. In 2024, <b>$269B</b> of interest left the country.`;
}

/* ===== DEBT-to-GDP ===== */
function drawDgp(){const sv=$("#dgp"),W=480,L=20,R=20,y0=70,bw=W-L-R;const ratio=publicDebt()/ST.gdp*100;
  const mx=130,x=v=>L+Math.min(v,mx)/mx*bw;let s="";
  s+=`<text x="${L}" y="40" font-size="12" fill="var(--ink)">public debt as % of GDP</text>`;
  s+=`<rect x="${L}" y="${y0}" width="${bw}" height="22" rx="6" fill="var(--faint)"/>`;
  const col=ratio>100?'var(--hot)':ratio>80?'var(--int)':'var(--good)';
  s+=`<rect x="${L}" y="${y0}" width="${(x(ratio)-L).toFixed(1)}" height="22" rx="6" fill="${col}"/>`;
  s+=`<text x="${(x(ratio)+6).toFixed(1)}" y="${y0+17}" font-size="14" font-family="var(--mono)" font-weight="700" fill="${col}">${ratio.toFixed(1)}%</text>`;
  // markers 72.4 (10y ago) & 100
  [[72.4,'10y ago'],[100,'= GDP']].forEach(m=>{s+=`<line x1="${x(m[0]).toFixed(1)}" y1="${y0-5}" x2="${x(m[0]).toFixed(1)}" y2="${y0+27}" stroke="var(--ink)" stroke-dasharray="2 2" opacity=".5"/><text x="${x(m[0]).toFixed(1)}" y="${y0+42}" font-size="9" text-anchor="middle" fill="var(--mut)">${m[1]}</text>`;});
  s+=`<rect class="gdpGrab" x="${L}" y="60" width="${bw}" height="40" fill="transparent" style="cursor:ew-resize"/>`;
  s+=`<text x="${L}" y="138" font-size="10" fill="var(--mut)">GDP <tspan font-family="var(--mono)" fill="var(--dom)" font-weight="700">${T(ST.gdp)}</tspan> — drag along the bar to change it</text>`;
  sv.innerHTML=s;
  $("#capDgp").innerHTML=`Public debt ${T(publicDebt())} ÷ GDP ${T(ST.gdp)} = <b class="${ratio>100?'hot':''}">${ratio.toFixed(1)}%</b>. The video's 2024 figure was <b>95.9%</b>, up from <b>72.4%</b> ten years earlier — like a mortgage growing faster than your income.`;
}

/* ===== CEILING ===== */
function drawCeil(){const sv=$("#ceil"),W=480,L=20,R=20,y0=54,bw=W-L-R,pd=projDebt();
  const mx=Math.max(CEIL,pd)*1.05,x=v=>L+v/mx*bw,head=CEIL-pd;let s="";
  s+=`<text x="${L}" y="32" font-size="12" fill="var(--ink)">debt vs the $41.1T ceiling</text>`;
  s+=`<rect x="${L}" y="${y0}" width="${bw}" height="26" rx="6" fill="var(--faint)"/>`;
  s+=`<rect x="${L}" y="${y0}" width="${(x(pd)-L).toFixed(1)}" height="26" rx="6" fill="${pd>CEIL?'var(--hot)':'var(--debt)'}"/>`;
  s+=`<line x1="${x(CEIL).toFixed(1)}" y1="${y0-8}" x2="${x(CEIL).toFixed(1)}" y2="${y0+34}" stroke="var(--hot)" stroke-width="2.5"/><text x="${x(CEIL).toFixed(1)}" y="${y0-12}" font-size="10" text-anchor="middle" fill="var(--hot)">ceiling $41.1T</text>`;
  s+=`<text x="${L}" y="${y0+50}" font-size="12" font-family="var(--mono)" fill="var(--ink)">debt ${T(pd)}</text>`;
  s+=`<rect class="ceilGrab" x="${L}" y="${y0}" width="${bw}" height="26" fill="transparent" style="cursor:ew-resize"/>`;
  sv.innerHTML=s;
  $("#capCeil").innerHTML= pd>CEIL? `At ${T(pd)} the debt is <b class="hot">over the ceiling</b> — without a vote to raise it, the government could <b class="hot">default</b>.` : `Headroom: <b>${T(head)}</b> before the ${T(CEIL)} cap. Congress has raised or revised it <b>78 times</b> since 1960.`;
}

/* ===== WHO OWNS (drill) ===== */
let ownLevel=0;
const OWN={0:[['Held by public',28.86,'var(--dom)'],['Intragovernmental',7.36,'var(--for)']],
  1:[['American (~70%)',20.20,'var(--dom)'],['Foreign (~30%)',8.66,'var(--for)']],
  2:[['Japan',1.15,'var(--for)'],['China',0.77,'var(--for)'],['UK',0.58,'var(--for)'],['Other foreign',6.16,'var(--mut)']]};
function drawOwn(){const sv=$("#own"),W=480,L=8,R=8,y=20,h=34,rows=OWN[ownLevel];const tot=rows.reduce((a,r)=>a+r[1],0);
  let x=L,s="";rows.forEach((r,i)=>{const w=r[1]/tot*(W-L-R);
    s+=`<g class="oseg" data-i="${i}" style="cursor:${ownLevel<2&&i<=1?'pointer':'default'}"><rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(1,w).toFixed(1)}" height="${h}" fill="${r[2]}" stroke="#fff" opacity="0.9"/>`;
    if(w>56)s+=`<text x="${(x+6).toFixed(1)}" y="${y+15}" font-size="9.5" fill="#fff">${r[0]}</text><text x="${(x+6).toFixed(1)}" y="${y+28}" font-size="9.5" font-family="var(--mono)" fill="#fff">${T(r[1])}</text>`;
    s+=`</g>`;x+=w;});
  s+=`<text x="${L}" y="${y+h+18}" font-size="10" fill="var(--mut)">${ownLevel===0?'tap “held by public” to drill →':ownLevel===1?'tap “foreign” for the top holders →':''}${ownLevel>0?'  ':''}</text>`;
  if(ownLevel>0)s+=`<text class="oback" x="${W-R}" y="${y+h+18}" font-size="10" text-anchor="end" fill="var(--dom)" style="cursor:pointer">‹ back</text>`;
  sv.innerHTML=s;
  const caps=['Total debt ≈ $36.2T (2024): mostly held by the public; the rest the government owes itself (e.g. Social Security trust funds).',
    'Of the $28.86T public debt, about <b>70% is American</b> and <b>30% foreign</b>.',
    'Top foreign holders: <b>Japan &gt; China &gt; UK</b> — together ≈8.8% of public debt (<b>$2.5T</b>).'];
  $("#capOwn").innerHTML=caps[ownLevel];
}

/* ===== HISTORY (log) ===== */
const HIST=[[1790,0.000071,'Hamilton'],[1865,2.7e-3,'Civil War'],[1919,0.0274,'WWI'],[1945,0.259,'WWII'],[1989,3.2,'1980s'],[2008,13.6,'Gt Recession'],[2020,33,'COVID'],[2025,38,'today']];
let hi=7;
function drawHist(){const sv=$("#hist"),W=1040,L=54,R=20,T2=14,B=30,pw=W-L-R,ph=220-T2-B;
  const x=y=>L+(y-1790)/(2025-1790)*pw,lo=Math.log10(5e-5),hiV=Math.log10(60),yv=v=>T2+ph*(1-(Math.log10(v)-lo)/(hiV-lo));
  let s="";[1e-4,1e-2,1,10].forEach(v=>{const Y=yv(v);s+=`<line x1="${L}" y1="${Y.toFixed(1)}" x2="${W-R}" y2="${Y.toFixed(1)}" stroke="var(--faint)"/><text x="${L-6}" y="${(Y+3).toFixed(1)}" font-size="9" text-anchor="end" fill="var(--mut)" font-family="var(--mono)">${v>=1?'$'+v+'T':v>=1e-3?'$'+(v*1000)+'B':'$'+(v*1e6)+'M'}</text>`;});
  let d="";HIST.forEach((p,i)=>d+=(i?"L":"M")+x(p[0]).toFixed(1)+" "+yv(p[1]).toFixed(1)+" ");
  s+=`<path d="${d}" fill="none" stroke="var(--debt)" stroke-width="2.4"/>`;
  HIST.forEach((p,i)=>{s+=`<circle cx="${x(p[0]).toFixed(1)}" cy="${yv(p[1]).toFixed(1)}" r="${i===hi?5:3}" fill="${i===hi?'var(--spend)':'var(--debt)'}"/>`;});
  HIST.forEach(p=>s+=`<text x="${x(p[0]).toFixed(1)}" y="${T2+ph+15}" font-size="8.5" text-anchor="middle" fill="var(--mut)">${p[0]}</text>`);
  sv.innerHTML=s;const p=HIST[hi];
  $("#capHist").innerHTML=`<b>${p[2]} (${p[0]})</b>: about <b>${p[1]>=1?'$'+p[1]+'T':p[1]>=1e-3?'$'+(p[1]*1000).toFixed(1)+'B':'$'+Math.round(p[1]*1e6)+'M'}</b>. From Hamilton's $71M to $38T is a ~535,000× rise (nominal).`;
}

/* ===== wiring ===== */
function shared(){drawHero();drawInt();drawDgp();drawCeil();}
function clampS(){ST.rev=Math.max(0,Math.min(8,ST.rev));ST.spend=Math.max(0,Math.min(8,ST.spend));ST.years=Math.max(0,Math.min(10,ST.years));ST.rate=Math.max(0,Math.min(10,ST.rate));ST.gdp=Math.max(5,Math.min(60,ST.gdp));}
function refreshScrub(){document.querySelectorAll('.scrub').forEach(el=>{el.textContent=el.dataset.s==='rev'?T(ST.rev):el.dataset.s==='spend'?T(ST.spend):ST.years+' years';});}
// hero drags
(function(){const sv=$("#hero");let d=null;const pt=e=>{const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(sv.getScreenCTM().inverse());};
  const vAtY=py=>Math.max(0,Math.min(8,(120-py)/100*8));
  sv.addEventListener("pointerdown",e=>{if(e.target.closest('.bRev'))d='rev';else if(e.target.closest('.bSpend'))d='spend';else if(e.target.closest('.yrKnob'))d='yr';else return;sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!d)return;const l=pt(e);if(d==='rev')ST.rev=Math.round(vAtY(l.y)*10)/10;else if(d==='spend')ST.spend=Math.round(vAtY(l.y)*10)/10;else{ST.years=Math.round((l.x-520)/300*10);}clampS();refreshScrub();shared();});
  sv.addEventListener("pointerup",()=>d=null);sv.addEventListener("pointercancel",()=>d=null);})();
// interest rate drag
(function(){const sv=$("#int");let on=false;const rAt=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;const mx=Math.max(interest(),0.87)*1.1;return Math.max(0,Math.min(10,(X-92)/(480-92-70)*mx/projDebt()*100));};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.iBar'))return;on=true;sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!on)return;const p=sv.createSVGPoint();p.x=e.clientX;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;const targetInt=Math.max(0,(X-92)/(480-92-70)*Math.max(interest(),0.87)*1.1);ST.rate=Math.max(0,Math.min(10,targetInt/projDebt()*100));ST.rate=Math.round(ST.rate*10)/10;drawInt();});
  sv.addEventListener("pointerup",()=>on=false);})();
// gdp drag
(function(){const sv=$("#dgp");let on=false;const at=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;const mx=130,ratio=Math.max(1,(X-20)/(480-40)*mx);return publicDebt()/ratio*100;};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.gdpGrab'))return;on=true;sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!on)return;ST.gdp=Math.max(5,Math.min(60,Math.round(at(e.clientX)*10)/10));drawDgp();});
  sv.addEventListener("pointerup",()=>on=false);})();
// ceiling drag (debt)
(function(){const sv=$("#ceil");let on=false;const at=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;const mx=Math.max(CEIL,projDebt())*1.05;return Math.max(0,(X-20)/(480-40)*mx);};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest('.ceilGrab'))return;on=true;sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!on)return;ST.debt=Math.max(0,Math.min(60,Math.round(at(e.clientX)*10)/10));ST.years=0;refreshScrub();shared();});
  sv.addEventListener("pointerup",()=>on=false);})();
// own drill
$("#own").addEventListener("click",e=>{if(e.target.closest('.oback')){ownLevel=Math.max(0,ownLevel-1);drawOwn();return;}const g=e.target.closest('.oseg');if(g&&ownLevel<2){const i=+g.dataset.i;if((ownLevel===0&&i===0)||(ownLevel===1&&i===1)){ownLevel++;drawOwn();}}});
// history scrub
(function(){const sv=$("#hist");let on=false;const at=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;const yr=1790+(X-54)/(1040-74)*(2025-1790);let best=0;HIST.forEach((p2,i)=>{if(Math.abs(p2[0]-yr)<Math.abs(HIST[best][0]-yr))best=i;});return best;};
  const set=e=>{hi=at(e.clientX);drawHist();};
  sv.addEventListener("pointerdown",e=>{on=true;sv.setPointerCapture(e.pointerId);set(e);});sv.addEventListener("pointermove",e=>{if(on)set(e);});sv.addEventListener("pointerup",()=>on=false);})();
// text scrubs
let ps=null;
document.addEventListener("pointerdown",e=>{const t=e.target.closest(".scrub");if(!t)return;e.preventDefault();t.classList.add("drag");ps={s:t.dataset.s,x:e.clientX,v:ST[t.dataset.s],el:t};t.setPointerCapture(e.pointerId);});
document.addEventListener("pointermove",e=>{if(!ps)return;const dx=e.clientX-ps.x;const sens=ps.s==='years'?0.04:0.01;ST[ps.s]=ps.v+dx*sens;clampS();if(ps.s==='years')ST.years=Math.round(ST.years);refreshScrub();shared();});
document.addEventListener("pointerup",()=>{if(ps){ps.el.classList.remove("drag");ps=null;}});
window.__DEBT={ST,deficit,projDebt,publicDebt,interest,get ownLevel(){return ownLevel},get hi(){return hi}};
shared();drawOwn();drawHist();
