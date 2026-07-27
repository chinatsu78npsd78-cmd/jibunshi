// わたしものがたり - ガイド型 自分史ヒアリング（AIなし・データはこの端末の中だけ）
"use strict";

const STORE_KEY = "watashi_monogatari_v1";

// 年代（min = この年齢以上なら聞く）。ラベルはやさしい言葉に。
const BANDS = [
  { id: "b1",  era: "0〜6さいのころ",   sub: "うまれて〜ようちえん・ほいくえん", min: 0,
    hint: "家の匂いや音、いちばん古い記憶、よく行った場所…どんな小さなことでも大丈夫。" },
  { id: "b2",  era: "7〜12さいのころ",  sub: "小学生", min: 7,
    hint: "学校、友だち、家、習いごと、好きだった遊びや食べもの…" },
  { id: "b3",  era: "12〜15さいのころ", sub: "中学生", min: 12, hint: "" },
  { id: "b4",  era: "16〜18さいのころ", sub: "高校生", min: 16, hint: "" },
  { id: "b5",  era: "18〜21さいのころ", sub: "", min: 18, hint: "" },
  { id: "b6",  era: "21〜29さいのころ", sub: "", min: 21, hint: "" },
  { id: "b7",  era: "30〜35さいのころ", sub: "", min: 30, hint: "" },
  { id: "b8",  era: "35〜40さいのころ", sub: "", min: 35, hint: "" },
  { id: "b9",  era: "40さい〜のころ",   sub: "", min: 40, hint: "" }
];

// 各年代で聞く4つの窓（やさしい言葉で・1つずつ）
const WINDOWS = [
  { key: "eizyou",  label: "印象に残っていること",
    q: "のあなたを思い出すと、印象に残っている出来事・人・場所はありますか？" },
  { key: "ureshii", label: "うれしかったこと",
    q: "、うれしかった・楽しかった・ホッとしたことは？（小さなことでも大丈夫）" },
  { key: "tsurai",  label: "つらかったこと",
    q: "。反対に、さみしかった・こわかった・もやもやしたことは？（なければ「パス」で大丈夫）" },
  { key: "kimochi", label: "そのころの気持ち",
    q: "のあなたの心は、どんな感じでしたか？（ひとことでも、色でもOK）" }
];

const ACKS = [
  "教えてくれてありがとう。",
  "そうだったんだね。",
  "うんうん、聞かせてくれてありがとう。",
  "ここまで、よくふりかえってくれたね。",
  "大切に受け取ったよ。"
];

// ------- 状態 -------
let state = {
  age: null,
  bandIds: [],          // 出題する年代のidリスト
  answers: {},          // { bandId: { eizyou, ureshii, tsurai, kimochi } }
  bi: 0,                // いまの年代インデックス（bandIds内）
  wi: 0                 // いまの窓インデックス（0〜3）
};

// ------- 保存 / 復元 -------
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function hasSaved() {
  const s = load();
  return !!(s && s.bandIds && s.bandIds.length);
}

// ------- 画面切り替え -------
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  window.scrollTo(0, 0);
}

// ------- 出題する年代を決める -------
function buildBands(age) {
  let ids = BANDS.filter(b => age == null || age >= b.min).map(b => b.id);
  if (ids.length === 0) ids = [BANDS[0].id]; // 念のため
  return ids;
}
function bandById(id) { return BANDS.find(b => b.id === id); }

// ------- 質問を描画 -------
let pendingAck = "";
function renderQuestion() {
  if (state.bi >= state.bandIds.length) { finish(); return; }
  const band = bandById(state.bandIds[state.bi]);
  const win = WINDOWS[state.wi];

  // 進み具合
  const total = state.bandIds.length * WINDOWS.length;
  const doneCount = state.bi * WINDOWS.length + state.wi;
  const pct = Math.round((doneCount / total) * 100);
  document.getElementById("progress-fill").style.width = pct + "%";

  // 「もどる」は最初の質問以外で表示（前に戻って書き足せる）
  const backEl = document.getElementById("btn-back");
  if (doneCount > 0) { backEl.classList.remove("hidden"); }
  else { backEl.classList.add("hidden"); }

  document.getElementById("progress-text").textContent =
    `${doneCount + 1} / ${total}`;

  // ねぎらい（直前に答えたとき）
  const ackEl = document.getElementById("ack");
  if (pendingAck) {
    ackEl.textContent = pendingAck;
    ackEl.classList.remove("hidden");
    pendingAck = "";
  } else {
    ackEl.classList.add("hidden");
  }

  // 年代ラベル
  document.getElementById("era-label").textContent =
    band.sub ? `${band.era}（${band.sub}）` : band.era;

  // 質問文
  document.getElementById("question-text").textContent = band.era + win.q;

  // ヒント（最初の窓かつヒントがあるとき）
  const hintEl = document.getElementById("question-hint");
  if (state.wi === 0 && band.hint) {
    hintEl.textContent = band.hint;
    hintEl.classList.remove("hidden");
  } else {
    hintEl.classList.add("hidden");
  }

  // すでに書いた答えがあれば戻す
  const saved = (state.answers[band.id] && state.answers[band.id][win.key]) || "";
  document.getElementById("answer").value = saved;

  show("screen-chapter");
  document.getElementById("answer").focus();
}

// ------- 回答を保存して次へ -------
function recordAnswer(text) {
  const band = bandById(state.bandIds[state.bi]);
  const win = WINDOWS[state.wi];
  if (!state.answers[band.id]) state.answers[band.id] = {};
  state.answers[band.id][win.key] = text;
  save();
}

function advance(withAck) {
  if (withAck) {
    pendingAck = ACKS[Math.floor(Math.random() * ACKS.length)];
  }
  state.wi++;
  if (state.wi >= WINDOWS.length) {
    state.wi = 0;
    state.bi++;
  }
  save();
  if (state.bi >= state.bandIds.length) {
    finish();
  } else {
    renderQuestion();
  }
}

// ------- 前の質問へ戻る（書き足し・修正できる）-------
function goBack() {
  // いま入力中の内容を先に保存してから戻る
  recordAnswer(document.getElementById("answer").value.trim());
  if (state.bi === 0 && state.wi === 0) return; // 最初の質問なら何もしない
  state.wi--;
  if (state.wi < 0) { state.bi--; state.wi = WINDOWS.length - 1; }
  pendingAck = "";
  save();
  renderQuestion();
}

// ------- まとめ生成（本人にお返しする版）-------
function buildSummary() {
  const lines = [];
  lines.push("■ わたしものがたり（あなたがふりかえった記録）");
  lines.push("");
  state.bandIds.forEach(id => {
    const band = bandById(id);
    const a = state.answers[id] || {};
    const parts = [];
    if (a.eizyou && a.eizyou.trim()) parts.push("　印象に残っていること：" + a.eizyou.trim());
    if (a.ureshii && a.ureshii.trim()) parts.push("　うれしかったこと：" + a.ureshii.trim());
    if (a.tsurai && a.tsurai.trim())  parts.push("　こころがゆれたこと：" + a.tsurai.trim());
    if (a.kimochi && a.kimochi.trim()) parts.push("　そのころの気持ち：" + a.kimochi.trim());
    if (parts.length) {
      lines.push(`【${band.era}】`);
      lines.push(parts.join("\n"));
      lines.push("");
    }
  });
  if (lines.length <= 3) {
    lines.push("（まだ思い出せる範囲で大丈夫。また続きからでもOKです）");
    lines.push("");
  }
  lines.push("今日、ふりかえってくれてありがとう。");
  return lines.join("\n");
}

function finish() {
  document.getElementById("summary-text").textContent = buildSummary();
  document.getElementById("copy-done").classList.add("hidden");
  show("screen-done");
}

// ------- イベント -------
document.addEventListener("DOMContentLoaded", () => {
  if (hasSaved()) {
    document.getElementById("btn-resume").classList.remove("hidden");
  }

  document.getElementById("btn-start").addEventListener("click", () => {
    show("screen-age");
  });

  document.getElementById("btn-resume").addEventListener("click", () => {
    const s = load();
    if (!s) return;
    state = s;
    if (state.bi >= state.bandIds.length) {
      finish();               // すでに最後まで話し終えている → まとめを表示
    } else {
      renderQuestion();
    }
  });

  document.getElementById("btn-age-next").addEventListener("click", () => {
    const val = parseInt(document.getElementById("input-age").value, 10);
    startFresh(isNaN(val) ? null : val);
  });
  document.getElementById("btn-age-skip").addEventListener("click", () => startFresh(null));

  document.getElementById("btn-next").addEventListener("click", () => {
    recordAnswer(document.getElementById("answer").value.trim());
    advance(document.getElementById("answer").value.trim().length > 0);
  });

  document.getElementById("btn-pass").addEventListener("click", () => {
    recordAnswer("");
    advance(false);
  });

  document.getElementById("btn-back").addEventListener("click", goBack);

  document.getElementById("btn-pause").addEventListener("click", () => {
    save();
    show("screen-welcome");
    document.getElementById("btn-resume").classList.remove("hidden");
  });

  document.getElementById("btn-review").addEventListener("click", () => {
    state.bi = 0; state.wi = 0; save();
    renderQuestion();
  });

  document.getElementById("btn-copy").addEventListener("click", async () => {
    const text = document.getElementById("summary-text").textContent;
    try {
      await navigator.clipboard.writeText(text);
      document.getElementById("copy-done").classList.remove("hidden");
    } catch (e) {
      // クリップボードが使えない場合は選択状態にする
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("summary-text"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.getElementById("copy-done").textContent =
        "上の文をlong-tapで全選択してコピーしてください。";
      document.getElementById("copy-done").classList.remove("hidden");
    }
  });
});

function startFresh(age) {
  state = {
    age: age,
    bandIds: buildBands(age),
    answers: {},
    bi: 0,
    wi: 0
  };
  save();
  renderQuestion();
}
