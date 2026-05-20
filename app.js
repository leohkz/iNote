// iNote v2.5 — saveNote race fix + Whisper ESM import fix

// ---------- Theme ----------
const $body = document.body;
const $themeBtn = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('inote-theme') || 'light';
$body.className = savedTheme;
$themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
$themeBtn.addEventListener('click', () => {
  const isDark = $body.classList.contains('dark');
  $body.className = isDark ? 'light' : 'dark';
  $themeBtn.textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('inote-theme', isDark ? 'light' : 'dark');
});

// ---------- Tabs ----------
document.getElementById('tabRecord').addEventListener('click', () => switchPage('record'));
document.getElementById('tabNotes').addEventListener('click', () => { switchPage('notes'); renderNotes(); });
function switchPage(p) {
  const isRec = p === 'record';
  document.getElementById('tabRecord').classList.toggle('active', isRec);
  document.getElementById('tabNotes').classList.toggle('active', !isRec);
  document.getElementById('pageRecord').classList.toggle('hidden', !isRec);
  document.getElementById('pageNotes').classList.toggle('hidden', isRec);
}

// ---------- Engine selection ----------
let useWhisper = false;
const $engineBrowser = document.getElementById('engineBrowser');
const $engineWhisper = document.getElementById('engineWhisper');
const $langRow       = document.getElementById('langRow');
const $whisperStatus = document.getElementById('whisperStatus');

$engineBrowser.addEventListener('click', () => {
  useWhisper = false;
  $engineBrowser.classList.add('active');
  $engineWhisper.classList.remove('active');
  $langRow.classList.remove('hidden');
  $whisperStatus.classList.add('hidden');
});
$engineWhisper.addEventListener('click', () => {
  useWhisper = true;
  $engineWhisper.classList.add('active');
  $engineBrowser.classList.remove('active');
  $langRow.classList.add('hidden');
  $whisperStatus.classList.remove('hidden');
  $whisperStatus.textContent = '✨ Whisper 自動識別語言，首次使用需下載模型（~40MB）';
});

// ---------- Language ----------
const $lang = document.getElementById('langSelect');
const savedLang = localStorage.getItem('inote-lang') || 'zh-HK';
$lang.value = savedLang;
$lang.addEventListener('change', () => localStorage.setItem('inote-lang', $lang.value));

// ---------- Timer ----------
let timerInterval = null, timerSecs = 0;
const $recTimer = document.getElementById('recTimer');
function startTimer()  { timerInterval = setInterval(() => { timerSecs++; $recTimer.textContent = pad(Math.floor(timerSecs/60))+':'+pad(timerSecs%60); }, 1000); }
function pauseTimer()  { clearInterval(timerInterval); }
function resetTimer()  { clearInterval(timerInterval); timerSecs = 0; $recTimer.textContent = ''; }
function pad(n) { return String(n).padStart(2,'0'); }

// ---------- MediaRecorder ----------
let mediaRecorder = null, audioChunks = [], audioBlob = null, micStream = null;

function startAudio(stream) {
  return new Promise(resolve => {
    audioChunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
    mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    // FIX: resolve only after onstop fires so audioBlob is ready before saveNote
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      resolve();
    };
    mediaRecorder.start(500);
    // Resolve immediately for recording start (onstop resolve is only used via stopAndWait)
    resolve();
  });
}

// Returns a Promise that resolves once mediaRecorder has fully stopped and audioBlob is set
function stopAndWait() {
  return new Promise(resolve => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') { resolve(); return; }
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      resolve();
    };
    mediaRecorder.stop();
  });
}

// ---------- UI State Machine ----------
const $dot          = document.getElementById('statusDot');
const $status       = document.getElementById('statusText');
const $box          = document.getElementById('transcript');
const $btnStart     = document.getElementById('btnStart');
const $btnPause     = document.getElementById('btnPause');
const $btnReset     = document.getElementById('btnReset');
const $btnFinish    = document.getElementById('btnFinish');
const $btnSummarize = document.getElementById('btnSummarize');

let uiState = 'idle';
function setState(s) {
  uiState = s;
  const idle   = s === 'idle';
  const rec    = s === 'recording';
  const paused = s === 'paused';
  const active = rec || paused;
  $btnStart.disabled      = active;
  $btnPause.disabled      = idle;
  $btnFinish.disabled     = idle;
  $btnReset.disabled      = false;
  $btnSummarize.disabled  = rec;
  $lang.disabled          = active;
  $engineBrowser.disabled = active;
  $engineWhisper.disabled = active;
  $dot.className = rec ? 'dot active' : paused ? 'dot paused' : 'dot idle';
  $status.textContent = rec ? '錄音中…' : paused ? '已暫停 — 點擊繼續' : '點擊『開始』錄音';
  $btnPause.textContent = paused ? '▶ 繼續' : '⏸ 暫停';
  $btnPause.className   = paused ? 'btn-primary' : 'btn-warn';
}
setState('idle');

// ---------- Browser Speech Recognition ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, isListening = false, isPaused = false;
let fullText = '', subtitles = [], recordStart = 0, pausedAt = 0, totalPausedMs = 0;

if (SR) {
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        const elapsed = Math.floor((Date.now() - recordStart - totalPausedMs) / 1000);
        subtitles.push({ time: Math.max(0, elapsed), text: t.trim() });
        fullText += t + ' ';
      } else { interim = t; }
    }
    $box.textContent = fullText + interim;
  };
  recognition.onend = () => { if (isListening && !isPaused) recognition.start(); };
  recognition.onerror = e => { if (e.error !== 'no-speech') { $status.textContent = '錯誤: ' + e.error; doHardStop(); setState('idle'); } };
} else {
  // No SR — disable start unless user picks Whisper
  $btnStart.disabled = true;
  $status.textContent = '請使用 Chrome，或選擇 Whisper AI 引擎';
}

// ---------- Whisper (loaded on demand, ESM) ----------
let whisperPipe = null, whisperLoading = false, whisperIntervalId = null;
const WHISPER_INTERVAL = 5000;

async function loadWhisper() {
  if (whisperPipe) return true;
  if (whisperLoading) return false;
  whisperLoading = true;
  $whisperStatus.textContent = '⬇️ 下載 Whisper 模型（~40MB），首次需 1-2 分鐘…';
  try {
    // FIX: Use esm.sh which correctly exposes ES module exports
    const mod = await import('https://esm.sh/@xenova/transformers@2.17.2');
    const pipeline = mod.pipeline || mod.default?.pipeline;
    if (!pipeline) throw new Error('pipeline not found in module');
    whisperPipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
    $whisperStatus.textContent = '✅ Whisper 已就緒，自動識別語言';
    whisperLoading = false;
    return true;
  } catch(e) {
    $whisperStatus.textContent = '⚠️ Whisper 載入失敗: ' + e.message;
    whisperLoading = false;
    useWhisper = false;
    $engineBrowser.click();
    return false;
  }
}

async function whisperTranscribeLoop() {
  if (!whisperPipe || !audioChunks.length) return;
  const blob = new Blob([...audioChunks], { type: mediaRecorder?.mimeType || 'audio/webm' });
  if (blob.size < 2000) return;
  try {
    const arrayBuf = await blob.arrayBuffer();
    const result = await whisperPipe(arrayBuf, { task: 'transcribe', return_timestamps: true, chunk_length_s: 30 });
    const chunks = result.chunks || [{ timestamp:[0,0], text: result.text }];
    fullText = chunks.map(c => c.text).join(' ').trim();
    subtitles = chunks.map(c => ({ time: Math.round(c.timestamp?.[0] || 0), text: c.text.trim() })).filter(s => s.text);
    $box.textContent = fullText;
    if (result.language) $whisperStatus.textContent = '✅ 識別語言: ' + result.language;
  } catch(e) { /* retry next interval */ }
}

// ---------- Recording control ----------
async function startAll() {
  try {
    fullText = ''; subtitles = []; timerSecs = 0; totalPausedMs = 0; isPaused = false;
    $box.textContent = ''; audioBlob = null; hideSummary();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await startAudio(micStream);
    if (useWhisper) {
      const ok = await loadWhisper();
      if (!ok) return;
      $whisperStatus.textContent = '🎙️ Whisper 錄音中，每 5 秒自動轉寫…';
      whisperIntervalId = setInterval(whisperTranscribeLoop, WHISPER_INTERVAL);
    } else {
      if (!recognition) { alert('請切換至 Whisper 引擎或使用 Chrome'); return; }
      recognition.lang = $lang.value;
      recognition.start();
      isListening = true;
    }
    recordStart = Date.now();
    startTimer();
    setState('recording');
  } catch(err) {
    $status.textContent = '麥克風授權失敗: ' + err.message;
  }
}

function togglePause() {
  if (uiState === 'recording') {
    isPaused = true; pausedAt = Date.now();
    if (recognition) try { recognition.stop(); } catch(e) {}
    if (whisperIntervalId) { clearInterval(whisperIntervalId); whisperIntervalId = null; }
    if (mediaRecorder?.state === 'recording') mediaRecorder.pause();
    pauseTimer(); setState('paused');
  } else if (uiState === 'paused') {
    totalPausedMs += Date.now() - pausedAt; isPaused = false;
    if (useWhisper) {
      if (mediaRecorder?.state === 'paused') mediaRecorder.resume();
      whisperIntervalId = setInterval(whisperTranscribeLoop, WHISPER_INTERVAL);
    } else {
      if (mediaRecorder?.state === 'paused') mediaRecorder.resume();
      recognition.lang = $lang.value;
      recognition.start();
    }
    startTimer(); setState('recording');
  }
}

function stopRecognition() {
  isListening = false; isPaused = false;
  if (recognition) try { recognition.stop(); } catch(e) {}
  if (whisperIntervalId) { clearInterval(whisperIntervalId); whisperIntervalId = null; }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  resetTimer();
}

$btnStart.addEventListener('click', startAll);
$btnPause.addEventListener('click', togglePause);

// FIX: await stopAndWait so audioBlob is ready before saveNote runs
$btnFinish.addEventListener('click', async () => {
  setState('idle');
  stopRecognition();
  await stopAndWait(); // wait for mediaRecorder.onstop → audioBlob set
  if (useWhisper) {
    await whisperTranscribeLoop(); // final pass
  }
  saveNote();
});

$btnReset.addEventListener('click', () => {
  if (uiState !== 'idle' && !confirm('確認放棄目前錄音？')) return;
  stopRecognition();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  fullText = ''; subtitles = []; audioBlob = null;
  $box.textContent = ''; hideSummary();
  setState('idle');
});

// ---------- AI Summary ----------
const $summaryArea   = document.getElementById('summaryArea');
const $summaryOutput = document.getElementById('summaryOutput');
function showSummary(html) { $summaryOutput.innerHTML = html; $summaryArea.classList.remove('hidden'); }
function hideSummary()     { $summaryArea.classList.add('hidden'); $summaryOutput.innerHTML = ''; }

$btnSummarize.addEventListener('click', async () => {
  const text = fullText.trim() || $box.textContent.trim();
  if (!text) { alert('請先錄音再生成總結'); return; }
  $btnSummarize.disabled = true;
  $btnSummarize.textContent = '處理中…';
  showSummary('<span class="spinner"></span> AI 處理中，首次可能需 20-30 秒…');
  try {
    showSummary((await hfSummarize(text)).replace(/\n/g,'<br>'));
  } catch(e) {
    showSummary('⚠️ AI 暫不可用，本地壓縮：<br><br>' + ruleBasedSummary(text).replace(/\n/g,'<br>'));
  }
  $btnSummarize.disabled = false;
  $btnSummarize.textContent = '重新生成';
});

async function hfSummarize(text) {
  const chunks = chunkText(text, 800), results = [];
  for (const chunk of chunks) {
    const res = await fetch('https://api-inference.huggingface.co/models/csebuetnlp/mT5_multilingual_XLSum',
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ inputs: chunk, parameters:{max_length:150,min_length:30}, options:{wait_for_model:true,use_cache:true} }) });
    if (!res.ok) throw new Error('HF ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const out = Array.isArray(data) ? (data[0]?.summary_text||data[0]?.generated_text) : data.summary_text;
    if (out) results.push(out.trim());
  }
  if (!results.length) throw new Error('empty');
  return results.join('\n\n');
}

function ruleBasedSummary(text) {
  const sents = (text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g)||[]).map(s=>s.trim()).filter(s=>s.length>4);
  if (!sents.length) return text.trim();
  if (sents.length <= 2) return sents.join('\n');
  const stops = new Set(['就','是','的','了','和','在','要','我','你','她','他','我們','你們','這個','那個','所以','the','a','an','is','are','it','and','or']);
  const freq = {};
  text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean).forEach(w=>{ if(!stops.has(w)) freq[w]=(freq[w]||0)+1; });
  const scored = sents.map((s,i)=>{ const ws=s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean); return {s,i,score:ws.reduce((a,w)=>a+(freq[w]||0),0)/Math.max(ws.length,1)+(i===0?1:0)}; });
  const topN = Math.min(5,Math.max(2,Math.ceil(sents.length*.3)));
  const top  = scored.sort((a,b)=>b.score-a.score).slice(0,topN).sort((a,b)=>a.i-b.i);
  const kws  = Object.entries(freq).filter(([w])=>w.length>=2).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([w])=>w);
  return (kws.length?'🔑 關鍵詞：'+kws.join('、')+'\n\n':'')+top.map(x=>'• '+x.s.trim()).join('\n');
}

function chunkText(text, maxLen) {
  const words=text.split(/\s+/),chunks=[];let cur='';
  for(const w of words){if((cur+' '+w).length>maxLen&&cur){chunks.push(cur.trim());cur=w;}else cur+=' '+w;}
  if(cur.trim())chunks.push(cur.trim());
  return chunks.length?chunks:[text];
}

// ---------- Storage ----------
function loadNotes() { try { return JSON.parse(localStorage.getItem('inote-notes')||'[]'); } catch(e) { return []; } }
function saveNotes(arr) { localStorage.setItem('inote-notes', JSON.stringify(arr)); }

function saveNote() {
  const text = fullText.trim();
  if (!text) { alert('沒有內容可儲存，請先錄音'); return; }
  const ts = new Date().toLocaleString('zh-HK',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const aiText = $summaryOutput.textContent.trim();
  const summary = (aiText && !aiText.startsWith('⚠️') && !aiText.includes('處理中')) ? aiText : '';
  const note = { id:Date.now(), title:ts, lang:useWhisper?'auto':$lang.value, timestamp:ts, fullText:text, subtitles:[...subtitles], summary, audioData:null };

  function persist(hasAudio) {
    const ns = loadNotes(); ns.unshift(note); saveNotes(ns);
    alert(hasAudio ? '✅ 筆記已儲存！（含錄音）' : '✅ 筆記已儲存！');
    fullText=''; subtitles=[]; audioBlob=null; $box.textContent=''; hideSummary();
  }

  if (audioBlob && audioBlob.size > 0 && audioBlob.size < 3*1024*1024) {
    const r = new FileReader();
    r.onload = () => { note.audioData = r.result; persist(true); };
    r.onerror = () => persist(false); // fallback if read fails
    r.readAsDataURL(audioBlob);
  } else {
    persist(false);
  }
}

// ---------- Notes list ----------
const $notesList   = document.getElementById('notesList');
const $searchInput = document.getElementById('searchInput');
const langLabel = {'zh-HK':'粵','zh-TW':'繁','zh-CN':'簡','en-US':'EN','auto':'AI'};
$searchInput.addEventListener('input', renderNotes);

function renderNotes() {
  const q = $searchInput.value.toLowerCase();
  let notes = loadNotes();
  if (q) notes = notes.filter(n => n.fullText.toLowerCase().includes(q) || n.title.includes(q));
  if (!notes.length) {
    $notesList.innerHTML = '<p class="empty-hint">'+(q?'沒有符合的筆記':'還沒有筆記，錄音後點「結束錄製」儲存')+'</p>';
    return;
  }
  $notesList.innerHTML = notes.map(n => `
    <div class="note-card" data-id="${n.id}">
      <div class="note-card-header">
        <div class="note-card-title">${n.title}</div>
        <button class="note-delete-btn" data-id="${n.id}">🗑</button>
      </div>
      <div class="note-card-meta">
        <span class="note-lang-badge">${langLabel[n.lang]||n.lang}</span>
        <span class="note-time">${n.timestamp}</span>
        ${n.audioData?'<span class="note-badge badge-audio">🎙 錄音</span>':''}
        ${n.subtitles?.length?'<span class="note-badge badge-sub">🎥 字幕</span>':''}
        ${n.summary?'<span class="note-badge badge-ai">✨ AI</span>':''}
      </div>
      <div class="note-card-preview">${n.fullText.slice(0,80)}…</div>
    </div>`).join('');
  $notesList.querySelectorAll('.note-card').forEach(c => {
    c.addEventListener('click', e => { if (e.target.closest('.note-delete-btn')) return; openNote(loadNotes().find(n=>n.id===parseInt(c.dataset.id))); });
  });
  $notesList.querySelectorAll('.note-delete-btn').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); if (!confirm('確認刪除？')) return; saveNotes(loadNotes().filter(n=>n.id!==parseInt(b.dataset.id))); renderNotes(); });
  });
}

// ---------- Note Modal ----------
const $noteModal      = document.getElementById('noteModal');
const $noteModalTitle = document.getElementById('noteModalTitle');
const $noteModalClose = document.getElementById('noteModalClose');
const $audioWrap      = document.getElementById('audioPlayerWrap');
const $subtitleList   = document.getElementById('subtitleList');
const $modalSummary   = document.getElementById('modalSummary');
const $modalFull      = document.getElementById('modalFull');

document.querySelectorAll('.modal-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(x => x.classList.remove('active')); t.classList.add('active');
    const tab = t.dataset.tab;
    document.getElementById('tabSubtitles').classList.toggle('hidden', tab!=='subtitles');
    document.getElementById('tabSummary').classList.toggle('hidden', tab!=='summary');
    document.getElementById('tabFull').classList.toggle('hidden', tab!=='full');
  });
});

function openNote(note) {
  $noteModalTitle.textContent = note.title;
  const oldAudio = $audioWrap.querySelector('audio');
  const nw = document.createElement('audio'); nw.controls = true;
  $audioWrap.replaceChild(nw, oldAudio);
  if (note.audioData) { nw.src = note.audioData; $audioWrap.classList.remove('hidden'); setupSubSync(nw, note.subtitles); }
  else $audioWrap.classList.add('hidden');
  if (note.subtitles?.length) {
    $subtitleList.innerHTML = note.subtitles.map((s,i) => `
      <div class="subtitle-item" data-index="${i}" data-time="${s.time}">
        <span class="sub-time">${fmtTime(s.time)}</span>
        <span class="sub-text">${s.text}</span>
      </div>`).join('');
    if (note.audioData) $subtitleList.querySelectorAll('.subtitle-item').forEach(item => {
      item.addEventListener('click', () => { nw.currentTime = parseInt(item.dataset.time); nw.play(); });
    });
  } else $subtitleList.innerHTML = '<p class="empty-hint">此筆記沒有字幕資料</p>';
  $modalSummary.innerHTML = note.summary ? note.summary.replace(/\n/g,'<br>') : '<span style="color:var(--text-muted)">( 未生成 AI 總結 )</span>';
  $modalFull.textContent = note.fullText;
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="subtitles"]').classList.add('active');
  document.getElementById('tabSubtitles').classList.remove('hidden');
  document.getElementById('tabSummary').classList.add('hidden');
  document.getElementById('tabFull').classList.add('hidden');
  $noteModal.classList.remove('hidden');
}

function setupSubSync(audioEl, subs) {
  if (!subs?.length) return;
  audioEl.addEventListener('timeupdate', () => {
    const t = Math.floor(audioEl.currentTime);
    const items = $subtitleList.querySelectorAll('.subtitle-item');
    let active = null;
    items.forEach(item => { item.classList.remove('active'); if (parseInt(item.dataset.time) <= t) active = item; });
    if (active) { active.classList.add('active'); active.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  });
}

function closeModal() {
  $noteModal.classList.add('hidden');
  const p = $audioWrap.querySelector('audio'); if (p) { p.pause(); p.src=''; }
}
$noteModalClose.addEventListener('click', closeModal);
$noteModal.addEventListener('click', e => { if (e.target === $noteModal) closeModal(); });

function fmtTime(sec) { return pad(Math.floor(sec/60))+':'+pad(sec%60); }
