const STORAGE = {
  records: "hokuto_records_v1",
  settings: "hokuto_settings_v1",
  ranking: "hokuto_ranking_v1"
};

const targetMachines = [6,7,8,9,10,11,12,13,14,15,26,27,28,29,30,31,32,33,34,35,36];
let cashInvestment = 0;

const $ = id => document.getElementById(id);
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const today = () => new Date().toLocaleDateString("sv-SE", {timeZone:"Asia/Tokyo"});
const yen = value => `${Number(value || 0).toLocaleString("ja-JP")}円`;

function init() {
  $("playDate").value = today();
  $("machineNo").innerHTML = '<option value="">選択</option>' +
    targetMachines.map(n => `<option value="${n}">${n}番台</option>`).join("");
  const settings = load(STORAGE.settings, {budgetLimit:40000, yenPerBall:4});
  $("budgetLimit").value = settings.budgetLimit;
  $("yenPerBall").value = settings.yenPerBall;
  bindEvents();
  renderRanking();
  renderHistory();
  updateOnline();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js");
}

function bindEvents() {
  document.querySelectorAll(".bottom-nav button").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  document.querySelectorAll("[data-add-cash]").forEach(btn => btn.addEventListener("click", () => {
    cashInvestment = Math.max(0, cashInvestment + Number(btn.dataset.addCash));
    $("cashInvestmentDisplay").textContent = yen(cashInvestment);
    updateMetrics();
  }));
  ["startSpin","currentSpin"].forEach(id => $(id).addEventListener("input", updateMetrics));
  $("playForm").addEventListener("submit", saveRecord);
  $("resetForm").addEventListener("click", resetForm);
  $("exportCsv").addEventListener("click", exportCsv);
  $("saveSettings").addEventListener("click", saveSettings);
  $("openRankingImport").addEventListener("click", () => $("rankingDialog").showModal());
  $("rankingFile").addEventListener("change", importRanking);
  $("exportBackup").addEventListener("click", exportBackup);
  $("importBackup").addEventListener("change", importBackup);
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
}

function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".bottom-nav button").forEach(v => v.classList.remove("active"));
  $(`view-${name}`).classList.add("active");
  document.querySelector(`[data-view="${name}"]`).classList.add("active");
  if (name === "history") renderHistory();
}

function updateOnline() {
  $("onlineBadge").textContent = navigator.onLine ? "オンライン" : "オフライン";
}

function updateMetrics() {
  const start = Number($("startSpin").value || 0);
  const current = Number($("currentSpin").value || 0);
  const spins = Math.max(0, current - start);
  const rate = cashInvestment > 0 ? spins / (cashInvestment / 1000) : 0;
  $("rotationRate").textContent = rate > 0 ? `${rate.toFixed(1)}回 / 1,000円` : "未計算";

  const settings = load(STORAGE.settings, {budgetLimit:40000, yenPerBall:4});
  let text = "入力待ち", reason = "投資額と実測回転率から、予算管理上の注意を表示します。";
  if (cashInvestment >= settings.budgetLimit && settings.budgetLimit > 0) {
    text = "予算上限"; reason = "設定した現金予算に到達しています。追加投資を止めて状況を確認してください。";
  } else if (cashInvestment >= settings.budgetLimit * 0.8 && settings.budgetLimit > 0) {
    text = "予算注意"; reason = "予算の80％以上を使用しています。残り予算と終了時刻を確認してください。";
  } else if (rate > 0 && rate < 13) {
    text = "回転率注意"; reason = "実測回転率が低めです。短い試行では振れがあるため、記録値として扱ってください。";
  } else if (rate >= 13) {
    text = "記録継続"; reason = "予算内です。判定は当たり予測ではなく、実戦記録と予算管理の補助です。";
  }
  $("judgementText").textContent = text;
  $("judgementReason").textContent = reason;
}

function saveRecord(event) {
  event.preventDefault();
  const settings = load(STORAGE.settings, {budgetLimit:40000, yenPerBall:4});
  const recoveredBalls = Number($("recoveredBalls").value || 0);
  const cashReturnInput = Number($("cashReturn").value || 0);
  const estimatedReturn = cashReturnInput || Math.floor(recoveredBalls * Number(settings.yenPerBall || 0));
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    savedAt: new Date().toISOString(),
    playDate: $("playDate").value,
    machineNo: Number($("machineNo").value),
    aiRank: $("aiRank").value,
    startSpin: Number($("startSpin").value || 0),
    currentSpin: Number($("currentSpin").value || 0),
    cashInvestment,
    ballInvestment: Number($("ballInvestment").value || 0),
    firstHitSpin: Number($("firstHitSpin").value || 0),
    maxChain: Number($("maxChain").value || 0),
    rushResult: $("rushResult").value,
    recoveredBalls,
    endSpin: Number($("endSpin").value || 0),
    cashReturn: estimatedReturn,
    profit: estimatedReturn - cashInvestment,
    stopReason: $("stopReason").value,
    memo: $("memo").value.trim()
  };
  if (!record.playDate || !record.machineNo) {
    alert("実戦日と台番号を入力してください。");
    return;
  }
  const records = load(STORAGE.records, []);
  records.unshift(record);
  save(STORAGE.records, records);
  alert("実戦記録をiPhone内に保存しました。");
  resetForm();
  switchView("history");
}

function resetForm() {
  $("playForm").reset();
  $("playDate").value = today();
  cashInvestment = 0;
  $("cashInvestmentDisplay").textContent = "0円";
  updateMetrics();
}

function renderRanking() {
  const ranking = load(STORAGE.ranking, []);
  const list = $("rankingList");
  if (!ranking.length) {
    list.innerHTML = `<div class="form-card"><strong>ランキング未登録</strong><p class="muted">「ランキング読込」からCSVを読み込んでください。</p></div>`;
    $("predictionDate").textContent = "未登録";
    return;
  }
  ranking.sort((a,b) => Number(a.rank)-Number(b.rank));
  $("predictionDate").textContent = ranking[0].predictionDate || "未登録";
  $("modelVersion").textContent = ranking[0].model || "V3.0";
  list.innerHTML = ranking.slice(0,5).map(r => `
    <div class="ranking-card">
      <div class="rank-no">${r.rank}</div>
      <div><div class="machine">${r.machineNo}番台</div><div class="muted">${r.recommendation || ""}</div></div>
      <div class="score"><span class="muted">予測点</span><strong>${r.score || "-"}</strong>
      <button class="text-button" onclick="startFromRanking(${r.machineNo},${r.rank})">この台を入力</button></div>
    </div>`).join("");
}

window.startFromRanking = function(machineNo, rank) {
  switchView("play");
  $("machineNo").value = String(machineNo);
  $("aiRank").value = `Top${rank}`;
};

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  return lines.map(line => {
    const out=[]; let value="", quoted=false;
    for (let i=0;i<line.length;i++) {
      const c=line[i];
      if(c === '"') {
        if(quoted && line[i+1] === '"'){ value+='"'; i++; } else quoted=!quoted;
      } else if(c === ',' && !quoted){ out.push(value); value=""; }
      else value+=c;
    }
    out.push(value); return out;
  });
}

function importRanking(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(reader.result);
    const header = rows.shift().map(v => v.trim());
    const idx = name => header.indexOf(name);
    const ranking = rows.map(row => ({
      predictionDate: row[idx("予測対象日")] || "",
      rank: Number(row[idx("順位")]),
      machineNo: Number(row[idx("台番号")]),
      score: row[idx("予測点")] || "",
      recommendation: row[idx("推奨区分")] || "",
      model: row[idx("モデル")] || "V3.0"
    })).filter(r => r.rank && r.machineNo);
    save(STORAGE.ranking, ranking);
    renderRanking();
    $("rankingDialog").close();
    event.target.value = "";
    alert(`${ranking.length}件のランキングを読み込みました。`);
  };
  reader.readAsText(file, "UTF-8");
}

function renderHistory() {
  const records = load(STORAGE.records, []);
  const totalProfit = records.reduce((s,r)=>s+Number(r.profit||0),0);
  const wins = records.filter(r=>Number(r.profit)>0).length;
  $("historySummary").innerHTML = `
    <div class="summary-box"><span class="muted">実戦</span><strong>${records.length}件</strong></div>
    <div class="summary-box"><span class="muted">勝ち</span><strong>${wins}件</strong></div>
    <div class="summary-box"><span class="muted">収支</span><strong>${yen(totalProfit)}</strong></div>`;
  $("historyList").innerHTML = records.length ? records.map(r => `
    <div class="history-card">
      <div class="history-head"><strong>${r.playDate}・${r.machineNo}番台</strong><span>${r.aiRank || "順位なし"}</span></div>
      <p>投資 ${yen(r.cashInvestment)} ／ 回収 ${yen(r.cashReturn)} ／ <strong>${r.profit >= 0 ? "+" : ""}${yen(r.profit)}</strong></p>
      <p class="muted">最大${r.maxChain || 0}連・${r.rushResult || "RUSH未入力"}・${r.stopReason || "終了理由なし"}</p>
    </div>`).join("") : `<div class="form-card"><p class="muted">実戦記録はまだありません。</p></div>`;
}

function exportCsv() {
  const records = load(STORAGE.records, []);
  if (!records.length) return alert("書き出す実戦履歴がありません。");
  const headers = ["実戦日","台番号","AI順位","着席回転数","現在回転数","現金投資","持ち玉投資","初当たり回転数","最大連チャン","RUSH結果","回収玉","離席回転数","換金額","実収支","終了理由","メモ","保存日時"];
  const keys = ["playDate","machineNo","aiRank","startSpin","currentSpin","cashInvestment","ballInvestment","firstHitSpin","maxChain","rushResult","recoveredBalls","endSpin","cashReturn","profit","stopReason","memo","savedAt"];
  const esc = v => `"${String(v ?? "").replaceAll('"','""')}"`;
  const csv = "\uFEFF" + [headers.map(esc).join(","), ...records.map(r => keys.map(k=>esc(r[k])).join(","))].join("\n");
  downloadBlob(csv, `hokuto_mobile_records_${today()}.csv`, "text/csv;charset=utf-8");
}

function saveSettings() {
  save(STORAGE.settings, {
    budgetLimit: Number($("budgetLimit").value || 0),
    yenPerBall: Number($("yenPerBall").value || 0)
  });
  updateMetrics(); alert("設定を保存しました。");
}

function exportBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    records: load(STORAGE.records, []),
    settings: load(STORAGE.settings, {}),
    ranking: load(STORAGE.ranking, [])
  };
  downloadBlob(JSON.stringify(data,null,2), `hokuto_ai_backup_${today()}.json`, "application/json");
}

function importBackup(event) {
  const file = event.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.records)) save(STORAGE.records, data.records);
      if (data.settings) save(STORAGE.settings, data.settings);
      if (Array.isArray(data.ranking)) save(STORAGE.ranking, data.ranking);
      location.reload();
    } catch { alert("バックアップJSONを読み込めませんでした。"); }
  };
  reader.readAsText(file);
}

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

init();
