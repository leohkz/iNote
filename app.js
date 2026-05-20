// ============================================================
// iNote v2 — Audio Recording + Subtitles + AI Summary
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

// ---------- Tabs ----------
const $tabRecord = document.getElementById('tabRecord');
const $tabNotes  = document.getElementById('tabNotes');
const $pageRecord = document.getElementById('pageRecord');
const $pageNotes  = document.getElementById('pageNotes');

$tabRecord.addEventListener('click', () => switchPage('record'));
$tabNotes.addEventListener('click',  () => { switchPage('notes'); renderNotes(); });

function switchPage(p) {
  const isRecord = p === 'record';
  $tabRecord.classList.toggle('active', isRecord);
  $tabNotes.classList.toggle('active', !isRecord);
  $pageRecord.classList.toggle('hidden', !isRecord);
  $pageNotes.classList.toggle('hidden',  isRecord);
}

// ---------- Language ----------
const $lang = document.getElementById('langSelect');
const savedLang = localStorage.getItem('inote-lang') || 'zh-HK';
$lang.value = savedLang;
$lang.addEventListener('change', () => localStorage.setItem('inote-lang', $lang.value));

// ---------- Timer ----------
let timerInterval = null;
let timerSecs = 0;
const $recTimer = document.getElementById('recTimer');
function startTimer() {
  timerSecs = 0;
  timerInterval = setInterval(() => {
    timerSecs++;
    const m = String(Math.floor(timerSecs/60)).padStart(2,'0');
    const s = String(timerSecs%60).padStart(2,'0');
    $recTimer.textContent = m+':'+s;
  }, 1000);
}
function stopTimer() { clearInterval(timerInterval); $recTimer.textContent = ''; }

// ---------- MediaRecorder (Audio Storage) ----------
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioURL  = null;

async function startAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
  mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
    audioURL  = URL.createObjectURL(audioBlob);
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  };
  mediaRecorder.start(500);
}
function stopAudio() { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); }

// ---------- Speech Recognition ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition  = null;
let isListening  = false;
let fullText     = '';
let subtitles    = []; // [{time, text}]
let recordStart  = 0;

const $dot     = document.getElementById('statusDot');
const $status  = document.getElementById('statusText');
const $box     = document.getElementById('transcript');
const $btnStart     = document.getElementById('btnStart');
const $btnStop      = document.getElementById('btnStop');
const $btnClear     = document.getElementById('btnClear');
const $btnSave      = document.getElementById('btnSave');
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
        const elapsed = Math.floor((Date.now() - recordStart) / 1000);
        subtitles.push({ time: elapsed, text: t.trim() });
        fullText += t + ' ';
      } else {
        interim += t;
      }
    }
    $box.textContent = fullText + interim;
  };
  recognition.onend = () => { if (isListening) recognition.start(); };
  recognition.onerror = e => {
    if (e.error !== 'no-speech') { $status.textContent = '錯誤: ' + e.error; stopAll(); }
  };
} else {
  $btnStart.disabled = true;
  $status.textContent = '請使用 Chrome 瀏覽器';
}

async function startAll() {
  try {
    fullText = ''; subtitles = [];
    $box.textContent = '';
    recognition.lang = $lang.value;
    await startAudio();
    recognition.start();
    isListening = true;
    recordStart = Date.now();
    startTimer();
    $dot.className = 'dot active';
    $status.textContent = '錄音中…';
    $btnStart.disabled = true;
    $btnStop.disabled = false;
    $btnSave.disabled = true;
    $btnSummarize.disabled = true;
    $lang.disabled = true;
  } catch(err) {
    $status.textContent = '麥克風授權失敗: ' + err.message;
  }
}

function stopAll() {
  isListening = false;
  recognition && recognition.stop();
  stopAudio();
  stopTimer();
  $dot.className = 'dot idle';
  $status.textContent = '錄音已完成';
  $btnStart.disabled = false;
  $btnStop.disabled = true;
  $btnSave.disabled = false;
  $btnSummarize.disabled = false;
  $lang.disabled = false;
}

$btnStart.addEventListener('click', startAll);
$btnStop.addEventListener('click', stopAll);
$btnClear.addEventListener('click', () => {
  fullText = ''; subtitles = []; $box.textContent = '';
  audioBlob = null; audioURL = null;
  hideSummary();
  $btnSave.disabled = false;
  $status.textContent = '已清除';
});

// ---------- AI Summary (HuggingFace free API) ----------
// Uses facebook/bart-large-cnn for English, Helsinki-NLP for translation fallback
// For Chinese: translate -> summarize -> display
const $summaryArea   = document.getElementById('summaryArea');
const $summaryOutput = document.getElementById('summaryOutput');

function showSummary(text) {
  $summaryOutput.innerHTML = text;
  $summaryArea.classList.remove('hidden');
}
function hideSummary() { $summaryArea.classList.add('hidden'); }

$btnSummarize.addEventListener('click', async () => {
  const text = fullText.trim();
  if (!text) { alert('請先錄音再生成總結'); return; }
  $btnSummarize.disabled = true;
  showSummary('<span class="spinner"></span> AI 處理中，請稍候…');
  try {
    const summary = await hfSummarize(text);
    showSummary(summary);
  } catch(e) {
    // fallback to local extractive
    showSummary('⚠️ AI 當前負載過高，使用本地摘要：\n\n' + localSummarize(text));
  }
  $btnSummarize.disabled = false;
});

async function hfSummarize(text) {
  // HuggingFace free Inference API — no key needed for public models (rate limited)
  // Strategy: chunk text, summarize each chunk, merge
  const chunks = chunkText(text, 800);
  const summaries = [];
  for (const chunk of chunks) {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/csebuetnlp/mT5_multilingual_XLSum',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: chunk, parameters: { max_length: 150, min_length: 30 } })
      }
    );
    if (!res.ok) throw new Error('HF API error ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const out = Array.isArray(data) ? data[0]?.summary_text || data[0]?.generated_text : data.summary_text;
    if (out) summaries.push(out.trim());
  }
  return summaries.join('\n\n') || localSummarize(text);
}

function chunkText(text, maxLen) {
  const words = text.split(/\s+/);
  const chunks = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).length > maxLen && cur) { chunks.push(cur.trim()); cur = w; }
    else cur += ' ' + w;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}

function localSummarize(text) {
  const sents = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text];
  if (sents.length <= 3) return text.trim();
  const freq = {};
  text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean)
      .forEach(w => freq[w] = (freq[w]||0)+1);
  const scored = sents.map((s,i) => {
    const sw = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean);
    return { s, i, score: sw.reduce((a,w)=>a+(freq[w]||0),0)/(sw.length||1) };
  });
  const topN = Math.max(2, Math.ceil(sents.length*.3));
  return scored.sort((a,b)=>b.score-a.score).slice(0,topN)
               .sort((a,b)=>a.i-b.i).map(x=>x.s.trim()).join('\n');
}

// ---------- Storage ----------
function loadNotes() { return JSON.parse(localStorage.getItem('inote-notes') || '[]'); }
function saveNotes(arr) { localStorage.setItem('inote-notes', JSON.stringify(arr)); }

// ---------- Save Note ----------
$btnSave.addEventListener('click', () => {
  const text = fullText.trim();
  if (!text) { alert('沒有内容可儲存'); return; }
  const now = new Date();
  const ts = now.toLocaleString('zh-HK', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  const summary = $summaryOutput.textContent.startsWith('AI') ? '' : $summaryOutput.textContent;
  const note = {
    id: Date.now(),
    title: ts,
    lang: $lang.value,
    timestamp: ts,
    fullText: text,
    subtitles: [...subtitles],
    summary: summary,
    hasAudio: !!audioURL,
    audioData: null // populated below if audio available
  };

  // Convert audio blob to base64 for localStorage (only if < 3MB)
  if (audioBlob && audioBlob.size < 3 * 1024 * 1024) {
    const reader = new FileReader();
    reader.onload = () => {
      note.audioData = reader.result;
      const notes = loadNotes();
      notes.unshift(note);
      saveNotes(notes);
      alert('✅ 筆記已儲存！(包含錄音)');
    };
    reader.readAsDataURL(audioBlob);
  } else {
    const notes = loadNotes();
    notes.unshift(note);
    saveNotes(notes);
    alert('✅ 筆記已儲存！' + (audioBlob ? '（錄音檔案過大，未儲存）' : ''));
  }
});

// ---------- Notes List ----------
const $notesList = document.getElementById('notesList');
const $searchInput = document.getElementById('searchInput');
const langLabel = { 'zh-HK':'粵', 'zh-TW':'繁', 'zh-CN':'簡', 'en-US':'EN' };

$searchInput.addEventListener('input', renderNotes);

function renderNotes() {
  const q = $searchInput.value.toLowerCase();
  let notes = loadNotes();
  if (q) notes = notes.filter(n => n.fullText.toLowerCase().includes(q) || n.title.includes(q));
  if (!notes.length) {
    $notesList.innerHTML = '<p class="empty-hint">' + (q ? '沒有符合的筆記' : '還沒有筆記。去錄音到筆記。') + '</p>';
    return;
  }
  $notesList.innerHTML = notes.map(n => `
    <div class="note-card" data-id="${n.id}">
      <div class="note-card-header">
        <div class="note-card-title">${n.title}</div>
        <div class="note-card-actions">
          <button class="note-delete-btn" data-id="${n.id}" title="刪除">🗑</button>
        </div>
      </div>
      <div class="note-card-meta">
        <span class="note-lang-badge">${langLabel[n.lang]||n.lang}</span>
        <span class="note-time">${n.timestamp}</span>
        ${n.audioData ? '<span class="note-audio-badge">🎙 錄音</span>' : ''}
        ${n.subtitles && n.subtitles.length ? '<span class="note-audio-badge" style="color:var(--purple)">🎥 字幕</span>' : ''}
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
      const notes = loadNotes().filter(n => n.id !== parseInt(btn.dataset.id));
      saveNotes(notes);
      renderNotes();
    });
  });
}

// ---------- Note Modal ----------
const $noteModal   = document.getElementById('noteModal');
const $noteModalTitle = document.getElementById('noteModalTitle');
const $noteModalClose = document.getElementById('noteModalClose');
const $audioWrap   = document.getElementById('audioPlayerWrap');
const $audio       = document.getElementById('audioPlayer');
const $subtitleList = document.getElementById('subtitleList');
const $modalSummary = document.getElementById('modalSummary');
const $modalFull    = document.getElementById('modalFull');

// Modal tabs
document.querySelectorAll('.modal-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    document.getElementById('tabSubtitles').classList.toggle('hidden', tab !== 'subtitles');
    document.getElementById('tabSummary').classList.toggle('hidden',   tab !== 'summary');
    document.getElementById('tabFull').classList.toggle('hidden',      tab !== 'full');
  });
});

let currentNote = null;

function openNote(note) {
  currentNote = note;
  $noteModalTitle.textContent = note.title;

  // Audio
  if (note.audioData) {
    $audio.src = note.audioData;
    $audioWrap.classList.remove('hidden');
    setupSubtitleSync(note.subtitles);
  } else {
    $audioWrap.classList.add('hidden');
  }

  // Subtitles
  if (note.subtitles && note.subtitles.length) {
    $subtitleList.innerHTML = note.subtitles.map((s, i) => `
      <div class="subtitle-item" data-index="${i}" data-time="${s.time}">
        <span class="sub-time">${fmtTime(s.time)}</span>
        <span class="sub-text">${s.text}</span>
      </div>
    `).join('');
    $subtitleList.querySelectorAll('.subtitle-item').forEach(item => {
      item.addEventListener('click', () => {
        if (note.audioData) {
          $audio.currentTime = parseInt(item.dataset.time);
          $audio.play();
        }
      });
    });
  } else {
    $subtitleList.innerHTML = '<p class="empty-hint">此筆記沒有字幕資料</p>';
  }

  // Summary
  if (note.summary) {
    $modalSummary.textContent = note.summary;
  } else {
    $modalSummary.innerHTML = '<span style="color:var(--text-muted)">( 未生成總結 — 可在錄音頁面點 AI 總結後再儲存 )</span>';
  }

  // Full text
  $modalFull.textContent = note.fullText;

  // Reset to subtitles tab
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="subtitles"]').classList.add('active');
  document.getElementById('tabSubtitles').classList.remove('hidden');
  document.getElementById('tabSummary').classList.add('hidden');
  document.getElementById('tabFull').classList.add('hidden');

  $noteModal.classList.remove('hidden');
}

function setupSubtitleSync(subs) {
  $audio.addEventListener('timeupdate', () => {
    const t = Math.floor($audio.currentTime);
    const items = $subtitleList.querySelectorAll('.subtitle-item');
    let active = null;
    items.forEach(item => {
      const st = parseInt(item.dataset.time);
      item.classList.remove('active');
      if (st <= t) active = item;
    });
    if (active) {
      active.classList.add('active');
      // Auto-scroll subtitle into view
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

$noteModalClose.addEventListener('click', () => {
  $noteModal.classList.add('hidden');
  $audio.pause();
  $audio.src = '';
});
$noteModal.addEventListener('click', e => {
  if (e.target === $noteModal) {
    $noteModal.classList.add('hidden');
    $audio.pause();
    $audio.src = '';
  }
});

// ---------- Helpers ----------
function fmtTime(sec) {
  const m = Math.floor(sec/60), s = sec%60;
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}
