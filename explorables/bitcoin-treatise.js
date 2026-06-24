
"use strict";
const $=s=>document.querySelector(s);
const mono=n=>n.toLocaleString('en-US');
const usd=v=>v>=1e9?"$"+(v/1e9).toFixed(2)+"B":v>=1e6?"$"+(v/1e6).toFixed(2)+"M":v>=1e3?"$"+(v/1e3).toFixed(1)+"k":"$"+Math.round(v);

/* ===== shared scrub state ===== */
const ST={supYear:2024, amt:1000, buyYear:2016, nowP:100000};
/* ===== §1 supply (exact schedule) ===== */
const BPY=52560; // ~blocks/yr at 10 min
const heightAt=y=>Math.max(0,(y-2009)*BPY);
function supplyAt(y){let rem=heightAt(y),s=0,era=0;while(rem>0&&era<34){const rw=50/2**era,blk=Math.min(rem,210000);s+=blk*rw;rem-=blk;era++;}return s;}
const rewardAt=y=>50/2**Math.floor(heightAt(y)/210000);
const MAXS=21000000;
function drawSupply(){const sv=$("#supply"),W=660,L=52,R=72,T=14,B=30,pw=W-L-R,ph=230-T-B;
  const Y0=2009,Y1=2040,x=y=>L+(y-Y0)/(Y1-Y0)*pw,yy=v=>T+ph*(1-v/MAXS);
  let s="";
  for(let v=0;v<=21e6;v+=7e6){const Y=yy(v);s+=`<line x1="${L}" y1="${Y.toFixed(1)}" x2="${W-R}" y2="${Y.toFixed(1)}" stroke="var(--faint)"/><text x="${L-6}" y="${(Y+3).toFixed(1)}" font-size="9.5" text-anchor="end" fill="var(--mut)" font-family="var(--mono)">${v/1e6}M</text>`;}
  s+=`<line x1="${L}" y1="${yy(MAXS).toFixed(1)}" x2="${W-R}" y2="${yy(MAXS).toFixed(1)}" stroke="var(--btc)" stroke-dasharray="5 4" opacity=".5"/><text x="${W-R}" y="${(yy(MAXS)+12).toFixed(1)}" font-size="9.5" text-anchor="end" fill="var(--btc)">21M cap</text>`;
  // halving year markers
  [2012,2016,2020,2024,2028,2032].forEach(hy=>{if(hy<=Y1){const X=x(hy);s+=`<line x1="${X.toFixed(1)}" y1="${T}" x2="${X.toFixed(1)}" y2="${T+ph}" stroke="var(--btc)" stroke-dasharray="2 3" opacity=".35"/>`;}});
  for(let y=2010;y<=2040;y+=5)s+=`<text x="${x(y).toFixed(1)}" y="${T+ph+15}" font-size="9.5" text-anchor="middle" fill="var(--mut)">${y}</text>`;
  let d="";for(let y=Y0;y<=Y1;y+=0.25)d+=(d?"L":"M")+x(y).toFixed(1)+" "+yy(supplyAt(y)).toFixed(1)+" ";
  s+=`<path d="${d} L ${x(Y1).toFixed(1)} ${yy(0)} L ${L} ${yy(0)} Z" fill="var(--btc)" opacity=".08"/><path d="${d}" fill="none" stroke="var(--btc)" stroke-width="2.6"/>`;
  const cy=ST.supYear,cx=x(cy),sup=supplyAt(cy);
  s+=`<g class="cur" style="cursor:ew-resize"><line x1="${cx.toFixed(1)}" y1="${T}" x2="${cx.toFixed(1)}" y2="${T+ph}" stroke="var(--ink)" stroke-width="1.5"/><circle cx="${cx.toFixed(1)}" cy="${yy(sup).toFixed(1)}" r="6" fill="var(--ink)"/><text x="${cx.toFixed(1)}" y="${T-2}" font-size="9.5" text-anchor="middle" fill="var(--ink)">${Math.round(cy)}</text></g>`;
  sv.innerHTML=s;
  const pct=sup/MAXS*100;$("#supPct").textContent=pct.toFixed(1)+"%";
  $("#capSupply").innerHTML=`In <b>${Math.round(cy)}</b>: reward <b>${rewardAt(cy).toFixed(rewardAt(cy)<1?4:3)} BTC</b>/block → about <b>${mono(Math.round(rewardAt(cy)*144))} new coins/day</b>. Mined so far: <b>${(sup/1e6).toFixed(2)}M</b> — <b>${pct.toFixed(1)}%</b> of the 21M cap.`;
}

/* ===== §2 difficulty feedback ===== */
const DF={hash:1, diff:1}; // relative to baseline
function drawDiff(){const sv=$("#diff"),W=660,L=120,R=20,T=18,rh=34;
  const bt=10*DF.diff/DF.hash; // block time minutes
  const max=4,x=v=>L+v/max*(W-L-R);
  let s="";
  // hash bar (draggable)
  s+=`<text x="${L-10}" y="36" font-size="12" text-anchor="end" fill="var(--ink)">hashpower</text>`;
  s+=`<rect x="${L}" y="24" width="${(x(DF.hash)-L).toFixed(1)}" height="18" rx="4" fill="var(--c1)" class="hbar" style="cursor:ew-resize"/><text x="${(x(DF.hash)+8).toFixed(1)}" y="38" font-size="11" font-family="var(--mono)" fill="var(--mut)">${DF.hash.toFixed(2)}×</text>`;
  // difficulty bar
  s+=`<text x="${L-10}" y="70" font-size="12" text-anchor="end" fill="var(--ink)">difficulty</text>`;
  s+=`<rect x="${L}" y="58" width="${(x(DF.diff)-L).toFixed(1)}" height="18" rx="4" fill="var(--c2)"/><text x="${(x(DF.diff)+8).toFixed(1)}" y="72" font-size="11" font-family="var(--mono)" fill="var(--mut)">${DF.diff.toFixed(2)}×</text>`;
  // block time gauge
  const tcol=Math.abs(bt-10)<0.4?'var(--good)':'var(--hot)';
  s+=`<text x="${L-10}" y="120" font-size="12" text-anchor="end" fill="var(--ink)">block time</text>`;
  s+=`<text x="${L}" y="123" font-size="22" font-family="var(--mono)" font-weight="700" fill="${tcol}">${bt.toFixed(1)} min</text>`;
  s+=`<text x="${L+150}" y="123" font-size="12" fill="var(--mut)">target 10 min</text>`;
  sv.setAttribute("viewBox","0 0 660 140");sv.innerHTML=s;
  const fast=bt<9.6,slow=bt>10.4;
  $("#capDiff").innerHTML = Math.abs(bt-10)<0.4
    ? `Balanced: difficulty matches hashpower, so blocks arrive every <b>~10 min</b>. Issuance is unchanged — more miners just means a costlier chain to attack.`
    : `Hashpower is <b>${DF.hash.toFixed(2)}×</b> but difficulty is still <b>${DF.diff.toFixed(2)}×</b>, so blocks come every <b>${bt.toFixed(1)} min</b> — ${fast?'faster':'slower'} than target. Retarget and they settle back to 10.`;
}

/* ===== §3 price (approx year-end, log scale) ===== */
const PX={2010:0.3,2011:5,2012:13,2013:800,2014:320,2015:430,2016:960,2017:14000,2018:3800,2019:7200,2020:29000,2021:47000,2022:16500,2023:42000,2024:95000};
const PY=Object.keys(PX).map(Number);
let priceCur=2021;
function drawPrice(){const sv=$("#price"),W=660,L=52,R=20,T=14,B=30,pw=W-L-R,ph=230-T-B;
  const Y0=2010,Y1=2024,x=y=>L+(y-Y0)/(Y1-Y0)*pw;
  const lo=Math.log10(0.2),hi=Math.log10(150000),yy=v=>T+ph*(1-(Math.log10(v)-lo)/(hi-lo));
  let s="";
  [1,100,10000].forEach(v=>{const Y=yy(v);s+=`<line x1="${L}" y1="${Y.toFixed(1)}" x2="${W-R}" y2="${Y.toFixed(1)}" stroke="var(--faint)"/><text x="${L-6}" y="${(Y+3).toFixed(1)}" font-size="9.5" text-anchor="end" fill="var(--mut)" font-family="var(--mono)">${usd(v)}</text>`;});
  [2012,2016,2020,2024].forEach(hy=>{const X=x(hy);s+=`<line x1="${X.toFixed(1)}" y1="${T}" x2="${X.toFixed(1)}" y2="${T+ph}" stroke="var(--btc)" stroke-dasharray="3 3" opacity=".5"/><text x="${X.toFixed(1)}" y="${T+9}" font-size="8" text-anchor="middle" fill="var(--btc)">⌧ halving</text>`;});
  for(let y=2010;y<=2024;y+=2)s+=`<text x="${x(y).toFixed(1)}" y="${T+ph+15}" font-size="9.5" text-anchor="middle" fill="var(--mut)">${y}</text>`;
  let d="";PY.forEach((y,i)=>d+=(i?"L":"M")+x(y).toFixed(1)+" "+yy(PX[y]).toFixed(1)+" ");
  s+=`<path d="${d}" fill="none" stroke="var(--btc)" stroke-width="2.4"/>`;
  PY.forEach(y=>s+=`<circle cx="${x(y).toFixed(1)}" cy="${yy(PX[y]).toFixed(1)}" r="2.6" fill="var(--btc)"/>`);
  const cx=x(priceCur);s+=`<g class="pcur" style="cursor:ew-resize"><line x1="${cx.toFixed(1)}" y1="${T}" x2="${cx.toFixed(1)}" y2="${T+ph}" stroke="var(--ink)" stroke-width="1.5"/><circle cx="${cx.toFixed(1)}" cy="${yy(PX[priceCur]).toFixed(1)}" r="6" fill="var(--ink)"/></g>`;
  sv.innerHTML=s;
  // peak->trough drawdown context around cursor
  $("#capPrice").innerHTML=`End of <b>${priceCur}</b>: about <b>${usd(PX[priceCur])}</b> per coin (approx). Across 2010→2024 the path crosses four halvings and several 80%-plus drawdowns — rhythm, not a guarantee.`;
}

/* ===== §4 what-if (reactive) ===== */
function nearestPrice(y){let best=PY[0];PY.forEach(p=>{if(Math.abs(p-y)<Math.abs(best-y))best=p;});return PX[best];}
function drawWhat(){const bp=nearestPrice(ST.buyYear),coins=ST.amt/bp,val=coins*ST.nowP,x=val/ST.amt;
  $("#buyPrice").textContent=usd(bp);
  $("#whatVal").textContent=usd(val);
  $("#whatX").textContent="("+(x>=1?x.toFixed(x>20?0:1)+"× in":"−"+Math.round((1-x)*100)+"% in")+" your favour)".replace(' in your favour','');
  $("#whatX").textContent=x>=1?x.toFixed(x>=20?0:1)+"×":"−"+Math.round((1-x)*100)+"%";
  $("#capWhat").innerHTML=`${usd(ST.amt)} ÷ ~${usd(bp)} = <b>${coins.toFixed(coins<1?4:2)} BTC</b>, held to ${usd(ST.nowP)}.`;
}

/* ===== scrubbable prose ===== */
const META={supYear:{s:0.06,min:2009,max:2040,step:1,r:()=>{drawSupply();}},
  amt:{s:5,min:50,max:100000,step:50,r:drawWhat},buyYear:{s:0.04,min:2010,max:2024,step:1,r:drawWhat},nowP:{s:140,min:1000,max:500000,step:1000,r:drawWhat}};
function fmtScrub(k){if(k==='supYear')return Math.round(ST.supYear);if(k==='buyYear')return Math.round(ST.buyYear);if(k==='amt')return usd(ST.amt);if(k==='nowP')return usd(ST.nowP);}
function refreshScrubText(){document.querySelectorAll('.scrub').forEach(el=>{el.textContent=fmtScrub(el.dataset.s);});}
let ps=null;
document.addEventListener("pointerdown",e=>{const t=e.target.closest(".scrub");if(!t)return;e.preventDefault();t.classList.add("drag");ps={k:t.dataset.s,x:e.clientX,v:ST[t.dataset.s],el:t};t.setPointerCapture(e.pointerId);});
document.addEventListener("pointermove",e=>{if(!ps)return;const m=META[ps.k];let nv=ps.v+(e.clientX-ps.x)*m.s;nv=Math.max(m.min,Math.min(m.max,Math.round(nv/m.step)*m.step));ST[ps.k]=nv;refreshScrubText();m.r();});
document.addEventListener("pointerup",()=>{if(ps){ps.el.classList.remove("drag");ps=null;}});

/* ===== chart drags ===== */
(function(){const sv=$("#supply");let on=false;const yAt=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;return 2009+(X-52)/(660-52-72)*(2040-2009);};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest(".cur")&&e.target.tagName!=='svg'&&!e.target.closest('path'))return;on=true;sv.setPointerCapture(e.pointerId);set(e);});
  function set(e){ST.supYear=Math.max(2009,Math.min(2040,Math.round(yAt(e.clientX))));refreshScrubText();$("#supPct").textContent=(supplyAt(ST.supYear)/MAXS*100).toFixed(1)+"%";drawSupply();}
  sv.addEventListener("pointermove",e=>{if(on)set(e);});sv.addEventListener("pointerup",()=>on=false);sv.addEventListener("pointercancel",()=>on=false);})();
(function(){const sv=$("#diff");let on=false;const hAt=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;return Math.max(0.2,Math.min(4,(X-120)/(660-120-20)*4));};
  sv.addEventListener("pointerdown",e=>{if(!e.target.closest(".hbar"))return;on=true;sv.setPointerCapture(e.pointerId);DF.hash=hAt(e.clientX);drawDiff();});
  sv.addEventListener("pointermove",e=>{if(on){DF.hash=Math.round(hAt(e.clientX)*100)/100;drawDiff();}});sv.addEventListener("pointerup",()=>on=false);})();
$("#retarget").addEventListener("click",()=>{DF.diff=DF.hash;drawDiff();});
(function(){const sv=$("#price");let on=false;const yAt=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;const X=p.matrixTransform(sv.getScreenCTM().inverse()).x;return 2010+(X-52)/(660-52-20)*(2024-2010);};
  const snap=y=>PY.reduce((a,b)=>Math.abs(b-y)<Math.abs(a-y)?b:a);
  sv.addEventListener("pointerdown",e=>{on=true;sv.setPointerCapture(e.pointerId);priceCur=snap(yAt(e.clientX));drawPrice();});
  sv.addEventListener("pointermove",e=>{if(on){priceCur=snap(yAt(e.clientX));drawPrice();}});sv.addEventListener("pointerup",()=>on=false);})();

refreshScrubText();drawSupply();drawDiff();drawPrice();drawWhat();
