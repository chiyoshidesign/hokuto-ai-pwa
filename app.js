
const APP_VERSION = "7.0";
const DRAFT_KEY = "hokuto_ai_v7_draft";
const RECORDS_KEY = "hokuto_ai_v7_records";
const $ = (id) => document.getElementById(id);
let startedAt = null;
let timer = null;

const fieldIds = [
  "playDate","storeName","machineName","machineNo","aiRank","aiDecision",
  "startTime","startRotation","startTotalHits","startFirstHits",
  "cashInvestment","ballInvestment","recoveredBalls","cashRecovery","exchangeRate",
  "endTime","endRotation","stopReason","resultJudgement","notes"
];

function todayLocal(){
  const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function nowTime(){return new Date().toTimeString().slice(0,5)}
function num(v){const n=Number(v); return Number.isFinite(n)?n:0}
function yen(v){return `${Math.trunc(v).toLocaleString("ja-JP")}円`}
function uid(){return `${Date.now()}-${Math.random().toString(16).slice(2)}`}

function collectHits(){
  return [...document.querySelectorAll(".hit-item")].map((el,i)=>({
    hit_no:i+1,
    hit_rotation:num(el.querySelector(".hit-rotation").value),
    investment_total_yen:num(el.querySelector(".hit-investment").value),
    rush:el.querySelector(".hit-rush").value,
    chain_count:num(el.querySelector(".hit-chain").value),
    acquired_balls:num(el.querySelector(".hit-balls").value),
    after_hit_rotation:num(el.querySelector(".hit-after-rotation").value)
  }));
}
function calcProfit(){
  const cashInv=num($("cashInvestment").value);
  const recovered=num($("recoveredBalls").value);
  const cashRec=num($("cashRecovery").value);
  const rate=Math.max(num($("exchangeRate").value),1);
  const converted = cashRec>0 ? cashRec : recovered/rate*1000;
  return Math.trunc(converted-cashInv);
}
function collectRecord(){
  const profit=calcProfit();
  const autoJudgement=profit>0?"勝ち":profit<0?"負け":"引き分け";
  return {
    app_version:APP_VERSION,
    record_id:$("recordForm").dataset.recordId||uid(),
    saved_at:new Date().toISOString(),
    play_date:$("playDate").value,
    store_name:$("storeName").value.trim(),
    machine_name:$("machineName").value.trim(),
    machine_no:num($("machineNo").value),
    ai_rank:num($("aiRank").value),
    ai_decision:$("aiDecision").value,
    start_time:$("startTime").value,
    start_rotation:num($("startRotation").value),
    start_total_hits:num($("startTotalHits").value),
    start_first_hits:num($("startFirstHits").value),
    hits:collectHits(),
    cash_investment_yen:num($("cashInvestment").value),
    ball_investment:num($("ballInvestment").value),
    recovered_balls:num($("recoveredBalls").value),
    cash_recovery_yen:num($("cashRecovery").value),
    exchange_rate_balls_per_1000:num($("exchangeRate").value),
    calculated_profit_yen:profit,
    end_time:$("endTime").value,
    end_rotation:num($("endRotation").value),
    stop_reason:$("stopReason").value,
    result_judgement:$("resultJudgement").value||autoJudgement,
    notes:$("notes").value.trim()
  };
}
function addHit(hit={}){
  const node=$("hitTemplate").content.cloneNode(true);
  const item=node.querySelector(".hit-item");
  item.querySelector(".hit-rotation").value=hit.hit_rotation||"";
  item.querySelector(".hit-investment").value=hit.investment_total_yen||"";
  item.querySelector(".hit-rush").value=hit.rush??"";
  item.querySelector(".hit-chain").value=hit.chain_count||1;
  item.querySelector(".hit-balls").value=hit.acquired_balls||"";
  item.querySelector(".hit-after-rotation").value=hit.after_hit_rotation||"";
  item.querySelector(".remove-hit").addEventListener("click",()=>{item.remove(); renumberHits(); saveDraft();});
  item.querySelectorAll("input,select").forEach(x=>x.addEventListener("input",saveDraft));
  $("hitList").appendChild(node); renumberHits(); saveDraft();
}
function renumberHits(){
  [...document.querySelectorAll(".hit-item")].forEach((el,i)=>el.querySelector(".hit-title").textContent=`当たり ${i+1}`);
}
function saveDraft(){
  const record=collectRecord();
  localStorage.setItem(DRAFT_KEY,JSON.stringify(record));
  $("saveState").textContent="保存済み";
  updateSummary();
  setTimeout(()=>$("saveState").textContent="自動保存",900);
}
function loadDraft(){
  const raw=localStorage.getItem(DRAFT_KEY);
  if(!raw){$("playDate").value=todayLocal(); return;}
  try{
    const r=JSON.parse(raw);
    $("recordForm").dataset.recordId=r.record_id||uid();
    fieldIds.forEach(id=>{
      const map={
        playDate:"play_date",storeName:"store_name",machineName:"machine_name",machineNo:"machine_no",
        aiRank:"ai_rank",aiDecision:"ai_decision",startTime:"start_time",startRotation:"start_rotation",
        startTotalHits:"start_total_hits",startFirstHits:"start_first_hits",cashInvestment:"cash_investment_yen",
        ballInvestment:"ball_investment",recoveredBalls:"recovered_balls",cashRecovery:"cash_recovery_yen",
        exchangeRate:"exchange_rate_balls_per_1000",endTime:"end_time",endRotation:"end_rotation",
        stopReason:"stop_reason",resultJudgement:"result_judgement",notes:"notes"
      };
      if(r[map[id]]!==undefined && r[map[id]]!==null) $(id).value=r[map[id]];
    });
    (r.hits||[]).forEach(addHit);
  }catch(e){console.warn(e); $("playDate").value=todayLocal();}
}
function updateSummary(){
  const machine=$("machineNo").value;
  $("heroMachine").textContent=machine?`${machine}番台`:"未入力";
  const profit=calcProfit();
  $("heroProfit").textContent=(profit>0?"+":"")+yen(profit);
  $("calculatedProfit").value=(profit>0?"+":"")+yen(profit);
  $("heroProfit").style.color=profit>0?"#86efac":profit<0?"#fca5a5":"#fff";
}
function startPlay(){
  if(!$("machineNo").value){alert("台番号を入力してください"); return;}
  if(!$("startTime").value)$("startTime").value=nowTime();
  startedAt=new Date();
  $("heroStatus").textContent="実戦中";
  clearInterval(timer); timer=setInterval(updateElapsed,1000); saveDraft();
}
function updateElapsed(){
  if(!startedAt)return;
  const sec=Math.floor((Date.now()-startedAt.getTime())/1000);
  $("heroElapsed").textContent=`${String(Math.floor(sec/3600)).padStart(2,"0")}:${String(Math.floor(sec%3600/60)).padStart(2,"0")}`;
}
function records(){try{return JSON.parse(localStorage.getItem(RECORDS_KEY)||"[]")}catch{return []}}
function saveFinished(){
  if(!$("playDate").value||!$("machineNo").value){alert("実戦日と台番号は必須です");return}
  if(!$("endTime").value)$("endTime").value=nowTime();
  const r=collectRecord();
  let list=records().filter(x=>x.record_id!==r.record_id);
  list.unshift(r); localStorage.setItem(RECORDS_KEY,JSON.stringify(list));
  localStorage.setItem(DRAFT_KEY,JSON.stringify(r));
  $("heroStatus").textContent="実戦終了・保存済み";
  renderSaved(); saveDraft();
  alert("実戦記録をiPhone内に保存しました。続けて「CSVを共有／保存」を押してください。");
}
const csvHeaders=[
"app_version","record_id","saved_at","play_date","store_name","machine_name","machine_no","ai_rank","ai_decision",
"start_time","start_rotation","start_total_hits","start_first_hits","hit_count","hit_details_json",
"cash_investment_yen","ball_investment","recovered_balls","cash_recovery_yen","exchange_rate_balls_per_1000",
"calculated_profit_yen","end_time","end_rotation","stop_reason","result_judgement","notes"
];
function csvEscape(v){
  const s=typeof v==="object"?JSON.stringify(v):String(v??"");
  return `"${s.replaceAll('"','""')}"`;
}
function toCSV(list){
  return "\ufeff"+csvHeaders.join(",")+"\n"+list.map(r=>{
    const row={...r,hit_count:(r.hits||[]).length,hit_details_json:r.hits||[]};
    return csvHeaders.map(h=>csvEscape(row[h])).join(",");
  }).join("\n");
}
async function shareFile(content,name,type){
  const file=new File([content],name,{type});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    await navigator.share({files:[file],title:"北斗AI 実戦記録"});
  }else{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(file);a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }
}
async function exportCurrent(){
  const r=collectRecord();
  await shareFile(toCSV([r]),`hokuto_practice_${r.play_date||todayLocal()}_dai${r.machine_no||0}.csv`,"text/csv");
}
async function exportJSON(){
  const r=collectRecord();
  await shareFile(JSON.stringify(r,null,2),`hokuto_practice_${r.play_date||todayLocal()}_dai${r.machine_no||0}.json`,"application/json");
}
async function exportAll(){
  const list=records(); if(!list.length){alert("保存済み記録がありません");return}
  await shareFile(toCSV(list),`hokuto_practice_all_${todayLocal()}.csv`,"text/csv");
}
function newRecord(){
  if(!confirm("入力中の内容を消して新しい記録を開始しますか？"))return;
  localStorage.removeItem(DRAFT_KEY); location.reload();
}
function renderSaved(){
  const root=$("savedRecords"); root.innerHTML="";
  const list=records();
  if(!list.length){root.innerHTML='<p class="hint">まだ保存済み記録はありません。</p>';return}
  list.slice(0,10).forEach(r=>{
    const d=document.createElement("div");d.className="saved-item";
    d.innerHTML=`<strong>${r.play_date}　${r.machine_no}番台　${r.calculated_profit_yen>0?"+":""}${yen(r.calculated_profit_yen)}</strong>
    <div class="saved-meta">${r.result_judgement}／当たり${(r.hits||[]).length}回／${r.ai_decision||"AI判定なし"}</div>`;
    root.appendChild(d);
  });
}
fieldIds.forEach(id=>$(id).addEventListener("input",saveDraft));
$("addHitButton").addEventListener("click",()=>addHit());
$("startButton").addEventListener("click",startPlay);
$("finishButton").addEventListener("click",saveFinished);
$("shareButton").addEventListener("click",exportCurrent);
$("jsonButton").addEventListener("click",exportJSON);
$("exportAllButton").addEventListener("click",exportAll);
$("newButton").addEventListener("click",newRecord);
loadDraft(); updateSummary(); renderSaved();
if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
