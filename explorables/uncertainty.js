
"use strict";
const $=s=>document.querySelector(s),P={lo:4,mode:6,hi:11,dead:8};
const pctf=v=>Math.round(v*100)+"%";
const cdf=(x,p)=>{const{lo:a,mode:c,hi:b}=p;if(x<=a)return 0;if(x>=b)return 1;if(x<c)return (x-a)*(x-a)/((b-a)*(c-a));return 1-(b-x)*(b-x)/((b-a)*(b-c));};
const pdf=(x,p)=>{const{lo:a,mode:c,hi:b}=p;if(x<a||x>b)return 0;if(x<c)return 2*(x-a)/((b-a)*(c-a));if(x>c)return 2*(b-x)/((b-a)*(b-c));return 2/(b-a);};
const inv=(q,p)=>{const{lo:a,mode:c,hi:b}=p,F=(c-a)/(b-a);return q<F?a+Math.sqrt(q*(b-a)*(c-a)):b-Math.sqrt((1-q)*(b-a)*(b-c));};
const XMAX=16,W=900,L=46,R=20,plotW=W-L-R,xp=w=>L+w/XMAX*plotW,wAt=px=>(px-L)/plotW*XMAX;
function draw(){const p=P,yB=120;let mx=0;for(let i=0;i<=200;i++)mx=Math.max(mx,pdf(p.lo+(p.hi-p.lo)*i/200,p));
  const Y=v=>14+(yB-14)*(1-v/(mx||1));let s="";
  for(let w=0;w<=XMAX;w+=2){const x=xp(w);s+=`<line x1="${x}" y1="14" x2="${x}" y2="178" stroke="var(--faint)"/><text x="${x}" y="196" font-size="10" text-anchor="middle" fill="var(--mut)">w${w}</text>`;}
  let d="";for(let i=0;i<=200;i++){const x=p.lo+(p.hi-p.lo)*i/200;d+=(i?"L":"M")+xp(x).toFixed(1)+" "+Y(pdf(x,p)).toFixed(1)+" ";}
  if(p.dead<p.hi){let dl=`M ${xp(Math.max(p.dead,p.lo))} ${yB} `;const st=Math.max(p.dead,p.lo);for(let i=0;i<=80;i++){const x=st+(p.hi-st)*i/80;dl+="L "+xp(x).toFixed(1)+" "+Y(pdf(x,p)).toFixed(1)+" ";}dl+=`L ${xp(p.hi)} ${yB} Z`;s+=`<path d="${dl}" fill="var(--late)" opacity=".5"/>`;}
  s+=`<path d="${d} L ${xp(p.hi)} ${yB} L ${xp(p.lo)} ${yB} Z" fill="var(--ok)" opacity=".12"/><path d="${d}" fill="none" stroke="var(--ok)" stroke-width="2.4"/>`;
  const mk=(w,id,lab)=>`<g class="hd" data-h="${id}" style="cursor:ew-resize"><line x1="${xp(w)}" y1="14" x2="${xp(w)}" y2="${yB}" stroke="var(--handle)" stroke-dasharray="2 3" opacity=".7"/><circle cx="${xp(w)}" cy="${yB+8}" r="6" fill="var(--handle)"/><text x="${xp(w)}" y="${yB+26}" font-size="9.5" text-anchor="middle" fill="var(--handle)">${lab} ${p[id]}</text></g>`;
  s+=mk(p.lo,'lo','low')+mk(p.mode,'mode','likely')+mk(p.hi,'hi','high');
  s+=`<g class="hd" data-h="dead" style="cursor:ew-resize"><line x1="${xp(p.dead)}" y1="6" x2="${xp(p.dead)}" y2="178" stroke="var(--dead)" stroke-width="2"/><text x="${xp(p.dead)}" y="12" font-size="10" text-anchor="middle" fill="var(--dead)">deadline w${p.dead}</text></g>`;
  $("#sv").innerHTML=s;const on=cdf(p.dead,p);
  $("#doc").innerHTML=`Most likely <span class="num">${p.mode} wks</span> (could be ${p.lo}–${p.hi}). 80% of the time it lands <span class="num">${inv(.1,p).toFixed(1)}–${inv(.9,p).toFixed(1)} wks</span>. Chance of beating the <span class="num">week-${p.dead}</span> deadline: <span class="${on>=.5?'ok':'late'}">${pctf(on)}</span> — so <span class="late">${pctf(1-on)}</span> late.`;}
(function(){const sv=$("#sv");let d=null;const wx=cx=>{const p=sv.createSVGPoint();p.x=cx;p.y=0;return wAt(p.matrixTransform(sv.getScreenCTM().inverse()).x);};
  sv.addEventListener("pointerdown",e=>{const h=e.target.closest(".hd");if(!h)return;d=h.dataset.h;sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!d)return;let v=Math.max(0,Math.min(XMAX,Math.round(wx(e.clientX)*2)/2));
    if(d==='lo')P.lo=Math.min(v,P.mode-.5);else if(d==='mode')P.mode=Math.max(P.lo+.5,Math.min(v,P.hi-.5));else if(d==='hi')P.hi=Math.max(v,P.mode+.5);else P.dead=v;draw();});
  sv.addEventListener("pointerup",()=>d=null);sv.addEventListener("pointercancel",()=>d=null);})();
draw();
