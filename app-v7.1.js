(() => {
"use strict";

const VERSION = "7.1";
const K = {
  rank: "hokuto_v71_rank",
  records: "hokuto_v71_records",
  draft: "hokuto_v71_draft",
  settings: "hokuto_v71_settings"
};
const machines = [11,12,13,14,15,16,17,18,19,20,26,27,28,29,30,31,32,33,34,35,36];
let cash = 0;
const $ = id => document.getElementById(id);

function n(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function today(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
function timeNow(){ return new Date().toTimeString().slice(0,5); }
function yen(v){ return `${Math.trunc(n(v)).toLocaleString("ja-JP")}円`; }
function uid(){ return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function get(k, fallback){ try { const v=JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } }
function set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

function nav(view){
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
  document.querySelectorAll(".bottom-nav button").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  if(view === "history") renderHistory();
  window.scrollTo({top:0, behavior:"instant"});
}
window.HokutoNav = nav;

function status(){
  const badge = $("onlineBadge");
  if(!badge) return;
  badge.textContent = navigator.onLine ? "オンライン" : "オフライン";
  badge.style.color = navigator.onLine ? "#86efac" : "#fca5a5";
}

function parseCSV(text){
  const rows=[]; let row=[], cell="", quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], next=text[i+1];
    if(c === '"' && quoted && next === '"'){ cell+='"'; i++; }
    else if(c === '"'){ quoted=!quoted; }
    else if(c === ',' && !quoted){ row.push(cell); cell=""; }
    else if((c === '\n' || c === '\r') && !quoted){
      if(c === '\r' && next === '\n') i++;
      row.push(cell);
      if(row.some(x=>x!=="")) rows.push(row);
      row=[]; cell="";
    } else cell+=c;
  }
  row.push(cell); if(row.some(x=>x!=="")) rows.push(row);
  if(!rows.length) return [];
  const headers=rows.shift().map(x=>x.trim());
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||"").trim()])));
}
function pick(o,names){ for(const x of names) if(o[x]!==undefined && o[x]!=="") return o[x]; return ""; }

function renderRank(){
  const root=$("rankingList"); if(!root) return;
  const d=get(K.rank,[]).sort((a,b)=>a.rank-b.rank);
  root.innerHTML="";
  if(!d.length){
    root.innerHTML='<div class="form-card"><p class="muted">ランキング未登録。「ランキング読込」からCSVを選択してください。</p></div>';
    $("predictionDate").textContent="未登録";
    $("finalDecision").textContent="ランキング未読込";
    $("decisionReason").textContent="V6.4のランキングCSVを読み込んでください";
    return;
  }
  $("predictionDate").textContent=d[0].date||"日付不明";
  const top=d[0], banner=$("decisionBanner");
  $("finalDecision").textContent=top.decision||"参考順位";
  $("decisionReason").textContent=top.reason||`Top1は${top.machine}番台`;
  banner.className="decision-banner "+((top.decision||"").includes("見送り")?"bad":(top.decision||"").includes("慎重")?"warn":"good");
  d.slice(0,10).forEach(x=>{
    const el=document.createElement("article");
    el.className="ranking-item";
    el.innerHTML=`<div class="rank-no">${x.rank}</div><div><div class="rank-machine">${x.machine}番台</div><div class="rank-meta">${x.decision||"参考"} ${x.confidence||""}</div></div><div class="rank-score"><strong>${x.score?Math.round(x.score*100)/100:"—"}</strong><span>参考点</span></div>`;
    el.addEventListener("click",()=>{
      nav("play");
      $("machineNo").value=String(x.machine);
      $("aiRank").value=String(x.rank);
      $("aiDecision").value=["条件付き実戦候補","慎重に実戦","見送り"].includes(x.decision)?x.decision:"";
      saveDraft();
    });
    root.appendChild(el);
  });
}

function renum(){ document.querySelectorAll(".hit-card").forEach((x,i)=>x.querySelector(".hit-title").textContent=`当たり ${i+1}`); }
function addHit(v={}){
  const t=$("hitTemplate"); if(!t) return;
  const node=t.content.cloneNode(true), el=node.querySelector(".hit-card");
  el.querySelector(".hit-spin").value=v.spin||"";
  el.querySelector(".hit-investment").value=v.investment||"";
  el.querySelector(".hit-rush").value=v.rush||"";
  el.querySelector(".hit-chain").value=v.chain||1;
  el.querySelector(".hit-balls").value=v.balls||"";
  el.querySelector(".hit-after").value=v.after||"";
  el.querySelector(".remove-hit").addEventListener("click",()=>{ el.remove(); renum(); saveDraft(); });
  el.querySelectorAll("input,select").forEach(x=>x.addEventListener("input",saveDraft));
  $("hitList").appendChild(node); renum();
}
function hits(){
  return [...document.querySelectorAll(".hit-card")].map((x,i)=>({
    no:i+1,
    spin:n(x.querySelector(".hit-spin").value),
    investment:n(x.querySelector(".hit-investment").value),
    rush:x.querySelector(".hit-rush").value,
    chain:n(x.querySelector(".hit-chain").value),
    balls:n(x.querySelector(".hit-balls").value),
    after:n(x.querySelector(".hit-after").value)
  }));
}
function settings(){ return {budget:50000, exchangeRate:225, ...get(K.settings,{})}; }
function profit(){
  const s=settings();
  const returned=n($("cashReturn").value) || n($("recoveredBalls").value)/Math.max(s.exchangeRate,1)*1000;
  return Math.trunc(returned-cash);
}
function rotationRate(){
  const spins=Math.max(0,n($("currentSpin").value)-n($("startSpin").value));
  return cash>0 ? spins/(cash/1000) : 0;
}
function update(){
  $("cashInvestmentDisplay").textContent=yen(cash);
  const rr=rotationRate();
  $("rotationRate").textContent=rr?`${rr.toFixed(1)}回/千円`:"未計算";
  const s=settings(), j=$("judgementCard");
  let t="継続判断待ち", r="入力値を確認してください", c="";
  if(cash>=s.budget){ t="予算上限到達"; r="追加投資を止め、終了を検討してください"; c="bad"; }
  else if(rr && rr<14){ t="回転率注意"; r="回転率が低いため続行は慎重に判断してください"; c="warn"; }
  else if($("aiDecision").value==="見送り"){ t="AI見送り台"; r="実戦理由をメモし、投資上限を厳守してください"; c="bad"; }
  else if(cash>0){ t="管理範囲内"; r=`現在の参考収支 ${profit()>=0?"+":""}${yen(profit())}`; c="good"; }
  $("judgementText").textContent=t; $("judgementReason").textContent=r; j.className="judgement-card "+c;
}
function record(){
  const p=profit();
  return {
    id:$("playForm").dataset.id||uid(), version:VERSION, savedAt:new Date().toISOString(),
    date:$("playDate").value, machine:n($("machineNo").value), aiRank:n($("aiRank").value),
    aiDecision:$("aiDecision").value, startTime:$("startTime").value,
    startSpin:n($("startSpin").value), currentSpin:n($("currentSpin").value),
    cashInvestment:cash, ballInvestment:n($("ballInvestment").value), hits:hits(),
    endTime:$("endTime").value, endSpin:n($("endSpin").value),
    recoveredBalls:n($("recoveredBalls").value), cashReturn:n($("cashReturn").value),
    profit:p, stopReason:$("stopReason").value,
    result:p>0?"勝ち":p<0?"負け":"引き分け", memo:$("memo").value.trim()
  };
}
function saveDraft(){ set(K.draft,record()); }
function loadDraft(){
  const d=get(K.draft,null); if(!d) return;
  $("playForm").dataset.id=d.id||uid();
  $("playDate").value=d.date||today(); $("machineNo").value=d.machine||"";
  $("aiRank").value=d.aiRank||""; $("aiDecision").value=d.aiDecision||"";
  $("startTime").value=d.startTime||""; $("startSpin").value=d.startSpin||"";
  $("currentSpin").value=d.currentSpin||""; cash=n(d.cashInvestment);
  $("ballInvestment").value=d.ballInvestment||""; $("endTime").value=d.endTime||"";
  $("endSpin").value=d.endSpin||""; $("recoveredBalls").value=d.recoveredBalls||"";
  $("cashReturn").value=d.cashReturn||""; $("stopReason").value=d.stopReason||"";
  $("memo").value=d.memo||""; (d.hits||[]).forEach(addHit); update();
}
function renderHistory(){
  const root=$("historyList"); if(!root) return;
  const list=get(K.records,[]), wins=list.filter(x=>x.profit>0).length, total=list.reduce((a,x)=>a+n(x.profit),0);
  root.innerHTML="";
  $("historySummary").innerHTML=`<div><strong>${list.length}</strong><span>実戦回数</span></div><div><strong>${list.length?Math.round(wins/list.length*100):0}%</strong><span>勝率</span></div><div><strong>${total>=0?"+":""}${yen(total)}</strong><span>累計収支</span></div>`;
  if(!list.length){ root.innerHTML='<div class="form-card"><p class="muted">保存済み実戦記録はありません。</p></div>'; return; }
  list.forEach(x=>{
    const el=document.createElement("article"); el.className="history-item";
    el.innerHTML=`<div class="section-title"><strong>${x.date}　${x.machine}番台</strong><span class="profit ${x.profit>=0?"positive":"negative"}">${x.profit>0?"+":""}${yen(x.profit)}</span></div><div class="history-meta">${x.result}／AI順位 ${x.aiRank||"—"}／当たり${(x.hits||[]).length}回／投資${yen(x.cashInvestment)}</div>`;
    root.appendChild(el);
  });
}
const headers=["app_version","record_id","saved_at","play_date","machine_no","ai_rank","ai_decision","start_time","start_rotation","current_rotation","cash_investment_yen","ball_investment","hit_count","hit_details_json","end_time","end_rotation","recovered_balls","cash_recovery_yen","exchange_rate_balls_per_1000","calculated_profit_yen","stop_reason","result_judgement","notes"];
function esc(v){ const s=typeof v==="object"?JSON.stringify(v):String(v??""); return `"${s.replaceAll('"','""')}"`; }
function csv(list){
  const s=settings();
  return "\ufeff"+headers.join(",")+"\n"+list.map(x=>{
    const o={app_version:x.version,record_id:x.id,saved_at:x.savedAt,play_date:x.date,machine_no:x.machine,ai_rank:x.aiRank,ai_decision:x.aiDecision,start_time:x.startTime,start_rotation:x.startSpin,current_rotation:x.currentSpin,cash_investment_yen:x.cashInvestment,ball_investment:x.ballInvestment,hit_count:(x.hits||[]).length,hit_details_json:x.hits,end_time:x.endTime,end_rotation:x.endSpin,recovered_balls:x.recoveredBalls,cash_recovery_yen:x.cashReturn,exchange_rate_balls_per_1000:s.exchangeRate,calculated_profit_yen:x.profit,stop_reason:x.stopReason,result_judgement:x.result,notes:x.memo};
    return headers.map(h=>esc(o[h])).join(",");
  }).join("\n");
}
async function share(content,name,type){
  const f=new File([content],name,{type});
  if(navigator.canShare && navigator.canShare({files:[f]})) await navigator.share({files:[f],title:"北斗AI V7.1"});
  else { const a=document.createElement("a"); a.href=URL.createObjectURL(f); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); }
}

function bind(){
  document.querySelectorAll(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>nav(b.dataset.view)));
  window.addEventListener("online",status); window.addEventListener("offline",status);

  machines.forEach(m=>{ const o=document.createElement("option"); o.value=m; o.textContent=`${m}番台`; $("machineNo").appendChild(o); });
  $("playDate").value=today();

  $("rankingFile").addEventListener("change",async e=>{
    const f=e.target.files[0]; if(!f) return;
    const rows=parseCSV(await f.text());
    const data=rows.map((r,i)=>({
      date:pick(r,["予測対象日","対象日","日付"]),
      rank:n(pick(r,["V5参考順位","順位","AI順位"]))||i+1,
      machine:n(pick(r,["現在台番号","台番号","分析用台番号"])),
      score:n(pick(r,["V5参考スコア","V5総合スコア","予測点","期待値点"])),
      decision:pick(r,["打つ日判定","最終判定","推奨区分","AI判定"]),
      confidence:pick(r,["信頼度","信頼度星"]),
      reason:pick(r,["見送り理由","判定理由","理由"])
    })).filter(x=>x.machine);
    set(K.rank,data); renderRank(); alert(`${data.length}台のランキングを保存しました`);
  });

  $("addHit").addEventListener("click",()=>{ addHit(); saveDraft(); });
  document.querySelectorAll("[data-add-cash]").forEach(b=>b.addEventListener("click",()=>{ cash=Math.max(0,cash+n(b.dataset.addCash)); update(); saveDraft(); }));
  ["currentSpin","startSpin","recoveredBalls","cashReturn","aiDecision","machineNo","aiRank","startTime","endTime","endSpin","stopReason","memo","ballInvestment"].forEach(id=>$(id).addEventListener("input",()=>{ update(); saveDraft(); }));
  $("startPlay").addEventListener("click",()=>{ if(!$("machineNo").value) return alert("台番号を選択してください"); if(!$("startTime").value)$("startTime").value=timeNow(); saveDraft(); alert("実戦開始を記録しました"); });
  $("playForm").addEventListener("submit",e=>{ e.preventDefault(); if(!$("machineNo").value)return alert("台番号を選択してください"); if(!$("endTime").value)$("endTime").value=timeNow(); const r=record(); let list=get(K.records,[]).filter(x=>x.id!==r.id); list.unshift(r); set(K.records,list); set(K.draft,r); renderHistory(); alert("実戦記録を保存しました。履歴タブからCSVを書き出せます。"); nav("history"); });
  $("resetForm").addEventListener("click",()=>{ if(confirm("入力中の内容を消しますか？")){ localStorage.removeItem(K.draft); location.reload(); }});
  $("exportCsv").addEventListener("click",()=>{ const l=get(K.records,[]); if(!l.length)return alert("記録がありません"); share(csv(l),`hokuto_practice_all_${today()}.csv`,"text/csv"); });
  $("budgetLimit").value=settings().budget; $("exchangeRate").value=settings().exchangeRate;
  $("saveSettings").addEventListener("click",()=>{ set(K.settings,{budget:n($("budgetLimit").value),exchangeRate:n($("exchangeRate").value)}); update(); alert("設定を保存しました"); });
  $("exportBackup").addEventListener("click",()=>share(JSON.stringify({version:VERSION,rank:get(K.rank,[]),records:get(K.records,[]),draft:get(K.draft,null),settings:settings()},null,2),`hokuto_v71_backup_${today()}.json`,"application/json"));
  $("importBackup").addEventListener("change",async e=>{ const f=e.target.files[0]; if(!f)return; try{const d=JSON.parse(await f.text()); if(d.rank)set(K.rank,d.rank); if(d.records)set(K.records,d.records); if(d.draft)set(K.draft,d.draft); if(d.settings)set(K.settings,d.settings); alert("復元しました"); location.reload();}catch{alert("復元に失敗しました");} });
}

document.addEventListener("DOMContentLoaded",()=>{
  try{
    bind(); status(); renderRank(); loadDraft(); renderHistory();
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("service-worker-v7.1.js?v=7101").catch(console.warn);
    }
  }catch(err){
    console.error("V7.1 initialization error",err);
    alert("V7.1の初期化でエラーが発生しました。画面を再読み込みしてください。");
  }
});
})();