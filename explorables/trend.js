
"use strict";
const $=s=>document.querySelector(s),cash=k=>k>=1000?"$"+(k/1000).toFixed(2)+"M":"$"+Math.round(k)+"k";
const A=[120,180,260,340,420,500,560,520,440,360,260,160];let budget=4000;
const cum=a=>{const c=[0];for(let i=0;i<a.length;i++)c.push(c[i]+a[i]);return c;};const sum=a=>a.reduce((x,y)=>x+y,0);
const niceStep=r=>{const raw=r/4||1,p=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/p,m=n<1.5?1:n<3?2:n<7?5:10;return m*p;};
const W=760,L=58,R=20,T=16,Bm=28,H=280,plotW=W-L-R,plotH=H-T-Bm,mx=m=>L+m/12*plotW;let Cmax=5000;
const cy=v=>T+plotH*(1-v/Cmax),cInv=py=>(1-(py-T)/plotH)*Cmax;
const SB=(f,cls,t)=>`<span class="scrub ${cls}" data-f="${f}">${t}</span>`;
function draw(){const c=cum(A),tot=c[12];let cross=0;for(let m=1;m<=12;m++)if(c[m]>budget){cross=m;break;}Cmax=Math.max(tot,budget)*1.12;
  let s="",st=niceStep(Cmax);for(let v=0;v<=Cmax+1;v+=st){const y=cy(v);s+=`<line x1="${L}" y1="${y.toFixed(1)}" x2="${W-R}" y2="${y.toFixed(1)}" stroke="var(--faint)"/><text x="${L-7}" y="${(y+3).toFixed(1)}" font-size="10" text-anchor="end" fill="var(--mut)">${cash(v)}</text>`;}
  for(let m=0;m<=12;m+=2)s+=`<text x="${mx(m).toFixed(1)}" y="${H-Bm+15}" font-size="10" text-anchor="middle" fill="var(--mut)">m${m}</text>`;
  s+=`<line x1="${L}" y1="${cy(budget).toFixed(1)}" x2="${W-R}" y2="${cy(budget).toFixed(1)}" stroke="var(--budget)" stroke-width="2" stroke-dasharray="6 4"/><text x="${W-R}" y="${(cy(budget)-6).toFixed(1)}" font-size="10" text-anchor="end" fill="var(--budget)">budget ${cash(budget)}</text>`;
  let d="";for(let m=0;m<=12;m++)d+=(m?"L":"M")+mx(m).toFixed(1)+" "+cy(c[m]).toFixed(1)+" ";s+=`<path d="${d}" fill="none" stroke="var(--line)" stroke-width="2.6"/>`;
  if(cross){const x=mx(cross),y=cy(c[cross]);s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="var(--over)"/><text x="${x.toFixed(1)}" y="${(y-10).toFixed(1)}" font-size="10" text-anchor="middle" fill="var(--over)">over in m${cross}</text>`;}
  for(let m=1;m<=12;m++)s+=`<circle class="pt" data-m="${m}" cx="${mx(m).toFixed(1)}" cy="${cy(c[m]).toFixed(1)}" r="7" fill="var(--line)" style="cursor:ns-resize"/>`;
  $("#sv").innerHTML=s;
  $("#doc").innerHTML=`Total by month 12: ${SB('total','s-tot',cash(tot))} vs ${SB('budget','s-bud',cash(budget))} budget — `+(tot>budget?`<span class="over">${cash(tot-budget)} over</span>, crossing in <span class="num">month ${cross}</span>.`:`<span class="ok">${cash(budget-tot)} under</span> — within budget.`);}
(function(){const sv=$("#sv");let d=null;const py=e=>{const p=sv.createSVGPoint();p.y=e.clientY;p.x=0;return p.matrixTransform(sv.getScreenCTM().inverse()).y;};
  sv.addEventListener("pointerdown",e=>{const c=e.target.closest(".pt");if(!c)return;d={m:+c.dataset.m};sv.setPointerCapture(e.pointerId);});
  sv.addEventListener("pointermove",e=>{if(!d)return;const tgt=Math.max(0,cInv(py(e))),c=cum(A),dl=tgt-c[d.m];A[d.m-1]=Math.max(0,Math.round((A[d.m-1]+dl)/10)*10);draw();});
  sv.addEventListener("pointerup",()=>d=null);sv.addEventListener("pointercancel",()=>d=null);})();
let ps=null;
document.addEventListener("pointerdown",e=>{const s=e.target.closest(".scrub");if(!s)return;e.preventDefault();s.classList.add("drag");ps={f:s.dataset.f,x:e.clientX,el:s,bud:budget,base:[...A]};s.setPointerCapture(e.pointerId);});
document.addEventListener("pointermove",e=>{if(!ps)return;const dx=e.clientX-ps.x;
  if(ps.f==='budget')budget=Math.max(100,Math.round((ps.bud+dx*10)/10)*10);
  else{const bt=sum(ps.base),tg=Math.max(0,bt+dx*18);if(bt>0){const f=tg/bt;for(let i=0;i<12;i++)A[i]=Math.max(0,Math.round(ps.base[i]*f/10)*10);}else for(let i=0;i<12;i++)A[i]=Math.round(tg/12/10)*10;}draw();});
document.addEventListener("pointerup",()=>{if(ps){ps.el.classList.remove("drag");ps=null;}});
draw();
