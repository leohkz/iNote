// ============================================================
// iNote v2.1 — Bug fixes + UI polish
// ============================================================

// ---------- Theme ----------
const $body = document.body;
const $themeBtn = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('inote-theme') || 'light';
$body.className = savedTheme;
$themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
$themeBtn.addEventListener('click', () => {
  const dark = $body.classList.contains('dark');
  $body.className = dark ? 'light' : 'dark';
  $themeBtn.textContent = dark ? '🌙' : '☀️';
  localStorage.setItem('inote-theme', dark ? 'light' : 'dark');
});

// ---------- Tabs — BUG FIX: correct hidden toggle logic ----------
const $tabRecord  = document.getElementById('tabRecord');
const $tabNotes   = document.getElementById('tabNotes');
const $pageRecord = document.getElementById('pageRecord');
const $pageNotes  = document.getElementById('pageNotes');

$tabRecord.addEventListener('click', () => switchPage('record'));
$tabNotes.addEventListener('click',  () => { switchPage('notes'); renderNotes(); });

function switchPage(p) {
  const isRecord = (p === 'record');
  $tabRecord.classList.toggle('active',  isRecord);
  $tabNotes.classList.toggle('active',  !isRecord);
  // FIX: page is hidden when it is NOT the active page
  if (isRecord) {
    $pageRecord.classList.remove('hidden');
    $pageNotes.classList.add('hidden');
  } else {
    $pageNotes.classList.remove('hidden');
    $pageRecord.classList.add('hidden');
  }
}

// ---------- Language ----------
const $lang = document.getElementById('langSelect');
const savedLang = localStorage.getItem('inote-lang') || 'zh-HK';
$lang.value = savedLang;
$lang.addEventListener('change', () => localStorage.setItem('inote-lang', $lang.value));

// ---------- Timer ----------
let timerInterval = null, timerSecs = 0;
const $recTimer = document.getElementById('recTimer');
function startTimer() {
  timerInterval = setInterval(() => {
    timerSecs++;
    const m = String(Math.floor(timerSecs/60)).padStart(2,'0');
    const s = String(timerSecs%60).padStart(2,'0');
    $recTimer.textContent = m+':'+s;
  }, 1000);
}
function pauseTimer() { clearInterval(timerInterval); }
function resetTimer() { clearInterval(timerInterval); timerSecs = 0; $recTimer.textContent = ''; }

// ---------- MediaRecorder ----------
let mediaRecorder = null, audioChunks = [], audioBlob = null;

async function startAudio(stream) {
  audioChunks = [];
  const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
  mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
  };
  mediaRecorder.start(500);
}

// ---------- Speech Recognition ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, isListening = false, isPaused = false;
let fullText = '', subtitles = [], recordStart = 0, pausedAt = 0, totalPausedMs = 0;
let micStream = null;

const $dot      = document.getElementById('statusDot');
const $status   = document.getElementById('statusText');
const $box      = document.getElementById('transcript');
const $btnStart  = document.getElementById('btnStart');
const $btnPause  = document.getElementById('btnPause');
const $btnClear  = document.getElementById('btnClear');
const $btnSave   = document.getElementById('btnSave');
const $btnSummarize = document.getElementById('btnSummarize');

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
      } else interim += t;
    }
    $box.textContent = fullText + interim;
  };
  recognition.onend = () => { if (isListening && !isPaused) recognition.start(); };
  recognition.onerror = e => {
    if (e.error !== 'no-speech') { $status.textContent = '錯誤: ' + e.error; finishAll(); }
  };
} else {
  $btnStart.disabled = true;
  $status.textContent = '請使用 Chrome 瀏覽器';
}

async function startAll() {
  try {
    fullText = ''; subtitles = []; timerSecs = 0; totalPausedMs = 0;
    $box.textContent = '';
    audioBlob = null;
    hideSummary();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recognition.lang = $lang.value;
    await startAudio(micStream);
    recognition.start();
    isListening = true; isPaused = false;
    recordStart = Date.now();
    startTimer();
    setRecordingUI(true);
  } catch(err) {
    $status.textContent = '麥克風授權失敗: ' + err.message;
  }
}

function togglePause() {
  if (!isPaused) {
    // Pause
    isPaused = true;
    pausedAt = Date.now();
    recognition.stop();
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.pause();
    pauseTimer();
    $dot.className = 'dot paused';
    $status.textContent = '已暫停 — 點擊繼續';
    $btnPause.textContent = '▶ 繼續';
    $btnPause.className = 'btn-primary';
  } else {
    // Resume
    totalPausedMs += Date.now() - pausedAt;
    isPaused = false;
    recognition.start();
    if (mediaRecorder && mediaRecorder.state === 'paused') mediaRecorder.resume();
    startTimer();
    $dot.className = 'dot active';
    $status.textContent = '錄音中…';
    $btnPause.textContent = '⏸ 暫停';
    $btnPause.className = 'btn-warn';
  }
}

function finishAll() {
  isListening = false; isPaused = false;
  recognition && recognition.stop();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  resetTimer();
  setRecordingUI(false);
  $status.textContent = '錄音已完成';
  $btnPause.textContent = '⏸ 暫停';
  $btnPause.className = 'btn-warn';
}

function setRecordingUI(recording) {
  $btnStart.disabled     = recording;
  $btnPause.disabled     = !recording;
  $btnSave.disabled      = recording;
  $btnSummarize.disabled = recording;
  $lang.disabled         = recording;
  if (recording) {
    $dot.className = 'dot active';
    $status.textContent = '錄音中…';
  } else {
    $dot.className = 'dot idle';
  }
}

$btnStart.addEventListener('click', startAll);
$btnPause.addEventListener('click', togglePause);
$btnClear.addEventListener('click', () => {
  if (isListening) finishAll();
  fullText = ''; subtitles = []; audioBlob = null;
  $box.textContent = '';
  hideSummary();
  $btnSave.disabled = true;
  $status.textContent = '已清除';
});
$btnSave.addEventListener('click', saveNote);

// ---------- AI Summary ----------
const $summaryArea   = document.getElementById('summaryArea');
const $summaryOutput = document.getElementById('summaryOutput');

function showSummary(html) {
  $summaryOutput.innerHTML = html;
  $summaryArea.classList.remove('hidden');
}
function hideSummary() { $summaryArea.classList.add('hidden'); $summaryOutput.innerHTML = ''; }

// FIX: btn starts enabled, only disabled DURING recording
$btnSummarize.addEventListener('click', async () => {
  const text = fullText.trim() || $box.textContent.trim();
  if (!text) { alert('請先錄音再生成總結'); return; }
  $btnSummarize.disabled = true;
  $btnSummarize.textContent = '處理中…';
  showSummary('<span class="spinner"></span> AI 處理中，請稍候…');
  try {
    const result = await hfSummarize(text);
    showSummary(result.replace(/\n/g, '<br>'));
  } catch(e) {
    showSummary('⚠️ AI 服務負載過高，使用本地摘要：<br><br>' + localSummarize(text).replace(/\n/g,'<br>'));
  }
  $btnSummarize.disabled = false;
  $btnSummarize.textContent = '重新生成';
});

async function hfSummarize(text) {
  const chunks = chunkText(text, 800);
  const summaries = [];
  for (const chunk of chunks) {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/csebuetnlp/mT5_multilingual_XLSum',
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ inputs: chunk, parameters: { max_length:150, min_length:30 } }) }
    );
    if (!res.ok) throw new Error('HF ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const out = Array.isArray(data)
      ? (data[0]?.summary_text || data[0]?.generated_text)
      : data.summary_text;
    if (out) summaries.push(out.trim());
  }
  return summaries.join('\n\n') || localSummarize(text);
}

function chunkText(text, maxLen) {
  const words = text.split(/\s+/);
  const chunks = []; let cur = '';
  for (const w of words) {
    if ((cur+' '+w).length > maxLen && cur) { chunks.push(cur.trim()); cur = w; }
    else cur += ' '+w;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}

function localSummarize(text) {
  const sents = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text];
  if (sents.length <= 3) return text.trim();
  const freq = {};
  text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean)
      .forEach(w => freq[w]=(freq[w]||0)+1);
  const scored = sents.map((s,i) => {
    const sw = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean);
    return { s, i, score: sw.reduce((a,w)=>a+(freq[w]||0),0)/(sw.length||1) };
  });
  const topN = Math.max(2, Math.ceil(sents.length*.3));
  return scored.sort((a,b)=>b.score-a.score).slice(0,topN)
               .sort((a,b)=>a.i-b.i).map(x=>x.s.trim()).join('\n');
}

// ---------- Storage ----------
function loadNotes() { return JSON.parse(localStorage.getItem('inote-notes')||'[]'); }
function saveNotes(arr) { localStorage.setItem('inote-notes', JSON.stringify(arr)); }

// ---------- Save Note ----------
function saveNote() {
  const text = fullText.trim();
  if (!text) { alert('沒有內容可儲存'); return; }
  const now = new Date();
  const ts = now.toLocaleString('zh-HK', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  const aiText = $summaryOutput.textContent.trim();
  const summary = (aiText && !aiText.startsWith('⚠️') && !aiText.startsWith('AI')) ? aiText : '';
  const note = {
    id: Date.now(), title: ts, lang: $lang.value, timestamp: ts,
    fullText: text, subtitles: [...subtitles],
    summary, hasAudio: !!audioBlob, audioData: null
  };
  if (audioBlob && audioBlob.size < 3*1024*1024) {
    const reader = new FileReader();
    reader.onload = () => {
      note.audioData = reader.result;
      const notes = loadNotes(); notes.unshift(note); saveNotes(notes);
      afterSave(true);
    };
    reader.readAsDataURL(audioBlob);
  } else {
    const notes = loadNotes(); notes.unshift(note); saveNotes(notes);
    afterSave(false, !!audioBlob);
  }
}

function afterSave(withAudio, tooBig) {
  const msg = withAudio ? '✅ 筆記已儲存！（包含錄音）'
             : tooBig   ? '✅ 筆記已儲存！（錄音檔案過大未儲存）'
                        : '✅ 筆記已儲存！';
  alert(msg);
  // Reset session
  fullText = ''; subtitles = []; audioBlob = null;
  $box.textContent = '';
  hideSummary();
  $btnSave.disabled = true;
  $status.textContent = '點擊開始錄音新筆記';
}

// ---------- Notes List ----------
const $notesList   = document.getElementById('notesList');
const $searchInput = document.getElementById('searchInput');
const langLabel = { 'zh-HK':'粵', 'zh-TW':'繁', 'zh-CN':'簡', 'en-US':'EN' };
$searchInput.addEventListener('input', renderNotes);

function renderNotes() {
  const q = $searchInput.value.toLowerCase();
  let notes = loadNotes();
  if (q) notes = notes.filter(n => n.fullText.toLowerCase().includes(q) || n.title.includes(q));
  if (!notes.length) {
    $notesList.innerHTML = '<p class="empty-hint">' + (q?'沒有符合的筆記':'還沒有筆記。錄音後點「結束錄製」儲存。') + '</p>';
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
        ${n.audioData ? '<span class="note-badge badge-audio">🎙 錄音</span>' : ''}
        ${n.subtitles?.length ? '<span class="note-badge badge-sub">🎥 字幕</span>' : ''}
        ${n.summary    ? '<span class="note-badge badge-ai">✨ AI總結</span>' : ''}
      </div>
      <div class="note-card-preview">${n.fullText.slice(0,80)}…</div>
    </div>
  `).join('');

  $notesList.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.note-delete-btn')) return;
      const id = parseInt(card.dataset.id);
      openNote(loadNotes().find(n => n.id === id));
    });
  });
  $notesList.querySelectorAll('.note-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('確認刪除此筆記？')) return;
      saveNotes(loadNotes().filter(n => n.id !== parseInt(btn.dataset.id)));
      renderNotes();
    });
  });
}

// ---------- Note Modal ----------
const $noteModal      = document.getElementById('noteModal');
const $noteModalTitle = document.getElementById('noteModalTitle');
const $noteModalClose = document.getElementById('noteModalClose');
const $audioWrap      = document.getElementById('audioPlayerWrap');
const $audio          = document.getElementById('audioPlayer');
const $subtitleList   = document.getElementById('subtitleList');
const $modalSummary   = document.getElementById('modalSummary');
const $modalFull      = document.getElementById('modalFull');

document.querySelectorAll('.modal-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    document.getElementById('tabSubtitles').classList.toggle('hidden', tab!=='subtitles');
    document.getElementById('tabSummary').classList.toggle('hidden',   tab!=='summary');
    document.getElementById('tabFull').classList.toggle('hidden',      tab!=='full');
  });
});

function openNote(note) {
  $noteModalTitle.textContent = note.title;
  if (note.audioData) {
    $audio.src = note.audioData;
    $audioWrap.classList.remove('hidden');
    // Remove old listener to avoid stacking
    const newAudio = $audio.cloneNode(true);
    $audioWrap.replaceChild(newAudio, $audio);
    setupSubtitleSync(newAudio, note.subtitles);
    $audioWrap.querySelector('audio').src = note.audioData;
  } else {
    $audioWrap.classList.add('hidden');
  }

  if (note.subtitles?.length) {
    $subtitleList.innerHTML = note.subtitles.map((s,i) => `
      <div class="subtitle-item" data-index="${i}" data-time="${s.time}">
        <span class="sub-time">${fmtTime(s.time)}</span>
        <span class="sub-text">${s.text}</span>
      </div>
    `).join('');
    if (note.audioData) {
      const player = $audioWrap.querySelector('audio');
      $subtitleList.querySelectorAll('.subtitle-item').forEach(item => {
        item.addEventListener('click', () => {
          player.currentTime = parseInt(item.dataset.time);
          player.play();
        });
      });
    }
  } else {
    $subtitleList.innerHTML = '<p class="empty-hint">此筆記沒有字幕資料</p>';
  }

  $modalSummary.innerHTML = note.summary
    ? note.summary.replace(/\n/g,'<br>')
    : '<span style="color:var(--text-muted)">( 未生成 AI 總結 )</span>';
  $modalFull.textContent = note.fullText;

  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="subtitles"]').classList.add('active');
  document.getElementById('tabSubtitles').classList.remove('hidden');
  document.getElementById('tabSummary').classList.add('hidden');
  document.getElementById('tabFull').classList.add('hidden');
  $noteModal.classList.remove('hidden');
}

function setupSubtitleSync(audioEl, subs) {
  if (!subs?.length) return;
  audioEl.addEventListener('timeupdate', () => {
    const t = Math.floor(audioEl.currentTime);
    const items = $subtitleList.querySelectorAll('.subtitle-item');
    let active = null;
    items.forEach(item => {
      item.classList.remove('active');
      if (parseInt(item.dataset.time) <= t) active = item;
    });
    if (active) { active.classList.add('active'); active.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
  });
}

function closeModal() {
  $noteModal.classList.add('hidden');
  const player = $audioWrap.querySelector('audio');
  if (player) { player.pause(); player.src = ''; }
}
$noteModalClose.addEventListener('click', closeModal);
$noteModal.addEventListener('click', e => { if (e.target === $noteModal) closeModal(); });

function fmtTime(sec) {
  return String(Math.floor(sec/60)).padStart(2,'0') + ':' + String(sec%60).padStart(2,'0');
}
