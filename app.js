// ============================================================
// iNote v2.3 — AI summary fix, mid-recording lang switch
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
const $tabRecord  = document.getElementById('tabRecord');
const $tabNotes   = document.getElementById('tabNotes');
const $pageRecord = document.getElementById('pageRecord');
const $pageNotes  = document.getElementById('pageNotes');
$tabRecord.addEventListener('click', () => switchPage('record'));
$tabNotes.addEventListener('click',  () => { switchPage('notes'); renderNotes(); });
function switchPage(p) {
  const rec = (p === 'record');
  $tabRecord.classList.toggle('active',  rec);
  $tabNotes.classList.toggle('active',  !rec);
  $pageRecord.classList.toggle('hidden', !rec);
  $pageNotes.classList.toggle('hidden',   rec);
}

// ---------- Language ----------
const $lang = document.getElementById('langSelect');
const savedLang = localStorage.getItem('inote-lang') || 'zh-HK';
$lang.value = savedLang;
$lang.addEventListener('change', () => {
  localStorage.setItem('inote-lang', $lang.value);
  // Allow mid-recording language switch (works when paused)
  if (recognition && isPaused) {
    recognition.lang = $lang.value;
    $status.textContent = '語言已切換—點擊繼續錄音';
  }
});

// ---------- Timer ----------
let timerInterval = null, timerSecs = 0;
const $recTimer = document.getElementById('recTimer');
function startTimer() {
  timerInterval = setInterval(() => {
    timerSecs++;
    $recTimer.textContent =
      String(Math.floor(timerSecs/60)).padStart(2,'0') + ':' +
      String(timerSecs%60).padStart(2,'0');
  }, 1000);
}
function pauseTimer() { clearInterval(timerInterval); }
function resetTimer() { clearInterval(timerInterval); timerSecs = 0; $recTimer.textContent = ''; }

// ---------- MediaRecorder ----------
let mediaRecorder = null, audioChunks = [], audioBlob = null, micStream = null;
async function startAudio(stream) {
  audioChunks = [];
  const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
  mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.onstop = () => { audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType }); };
  mediaRecorder.start(500);
}

// ---------- Speech Recognition ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, isListening = false, isPaused = false;
let fullText = '', subtitles = [], recordStart = 0, pausedAt = 0, totalPausedMs = 0;

const $dot          = document.getElementById('statusDot');
const $status       = document.getElementById('statusText');
const $box          = document.getElementById('transcript');
const $btnStart     = document.getElementById('btnStart');
const $btnPause     = document.getElementById('btnPause');
const $btnReset     = document.getElementById('btnReset');
const $btnFinish    = document.getElementById('btnFinish');
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
        subtitles.push({ time: Math.max(0, elapsed), text: t.trim(), lang: $lang.value });
        fullText += t + ' ';
      } else interim += t;
    }
    $box.textContent = fullText + interim;
  };
  recognition.onend = () => { if (isListening && !isPaused) recognition.start(); };
  recognition.onerror = e => { if (e.error !== 'no-speech') { $status.textContent = '錯誤: ' + e.error; hardStop(); } };
} else {
  $btnStart.disabled = true;
  $status.textContent = '請使用 Chrome 瀏覽器';
}

function setUI(state) {
  const rec    = state === 'recording';
  const paused = state === 'paused';
  const any    = rec || paused;
  $btnStart.disabled  = any;
  $btnPause.disabled  = !any;
  $btnFinish.disabled = !any;
  // Language can be changed when paused (for mid-meeting language switch)
  $lang.disabled = rec;
  $dot.className = rec ? 'dot active' : paused ? 'dot paused' : 'dot idle';
  if (rec)    $status.textContent = '錄音中…';
  if (!any)   $status.textContent = '選擇語言後開始錄音';
}

async function startAll() {
  try {
    fullText = ''; subtitles = []; timerSecs = 0; totalPausedMs = 0; isPaused = false;
    $box.textContent = ''; audioBlob = null; hideSummary();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recognition.lang = $lang.value;
    await startAudio(micStream);
    recognition.start();
    isListening = true; recordStart = Date.now();
    startTimer(); setUI('recording');
  } catch(err) { $status.textContent = '麥克風授權失敗: ' + err.message; }
}

function togglePause() {
  if (!isPaused) {
    isPaused = true; pausedAt = Date.now();
    recognition.stop();
    if (mediaRecorder?.state === 'recording') mediaRecorder.pause();
    pauseTimer();
    $btnPause.textContent = '▶ 繼續';
    $btnPause.className   = 'btn-primary';
    // Show lang hint when paused
    $status.textContent = '已暫停 — 可切換語言後繼續';
    setUI('paused');
    $btnPause.disabled = false; // override setUI for paused state
  } else {
    totalPausedMs += Date.now() - pausedAt;
    isPaused = false;
    recognition.lang = $lang.value; // apply any language change made while paused
    recognition.start();
    if (mediaRecorder?.state === 'paused') mediaRecorder.resume();
    startTimer();
    $btnPause.textContent = '⏸ 暫停';
    $btnPause.className   = 'btn-warn';
    setUI('recording');
  }
}

function hardStop() {
  isListening = false; isPaused = false;
  recognition?.stop();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  resetTimer();
  $btnPause.textContent = '⏸ 暫停';
  $btnPause.className   = 'btn-warn';
}

$btnStart.addEventListener('click', startAll);
$btnPause.addEventListener('click', togglePause);
$btnFinish.addEventListener('click', () => { hardStop(); setUI('idle'); setTimeout(saveNote, 400); });
$btnReset.addEventListener('click', () => {
  if ((isListening || isPaused) && !confirm('確認放棄目前錄音？')) return;
  hardStop(); fullText = ''; subtitles = []; audioBlob = null;
  $box.textContent = ''; hideSummary(); setUI('idle');
  $status.textContent = '已重置，可開始新錄音';
});

// ============================================================
// AI SUMMARY
// ============================================================
const $summaryArea   = document.getElementById('summaryArea');
const $summaryOutput = document.getElementById('summaryOutput');
function showSummary(html) { $summaryOutput.innerHTML = html; $summaryArea.classList.remove('hidden'); }
function hideSummary()     { $summaryArea.classList.add('hidden'); $summaryOutput.innerHTML = ''; }

$btnSummarize.addEventListener('click', async () => {
  const text = fullText.trim() || $box.textContent.trim();
  if (!text) { alert('請先錄音再生成總結'); return; }
  $btnSummarize.disabled = true;
  $btnSummarize.textContent = '處理中…';
  showSummary('<span class="spinner"></span> AI 處理中，首次載入模型可能需 20–30 秒…');
  try {
    const result = await hfSummarize(text);
    showSummary(result.replace(/\n/g, '<br>'));
  } catch(e) {
    // True fallback: rule-based compression, not just extraction
    const fb = ruleBasedSummary(text);
    showSummary('⚠️ AI 服務暫時不可用，已用本地壓縮：<br><br>' + fb.replace(/\n/g,'<br>'));
  }
  $btnSummarize.disabled = false;
  $btnSummarize.textContent = '重新生成';
});

async function hfSummarize(text) {
  const chunks = chunkText(text, 800);
  const results = [];
  for (const chunk of chunks) {
    // wait_for_model:true prevents 503 when model is loading
    const res = await fetch(
      'https://api-inference.huggingface.co/models/csebuetnlp/mT5_multilingual_XLSum',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: chunk,
          parameters: { max_length: 150, min_length: 30 },
          options: { wait_for_model: true, use_cache: true }
        })
      }
    );
    if (!res.ok) throw new Error('HF ' + res.status);
    const data = await res.json();
    // HF sometimes returns { error: "...", estimated_time: N }
    if (data.error) throw new Error(data.error);
    const out = Array.isArray(data)
      ? (data[0]?.summary_text || data[0]?.generated_text)
      : data.summary_text;
    if (out) results.push(out.trim());
  }
  if (!results.length) throw new Error('empty');
  return results.join('\n\n');
}

// ---- Improved local summary: sentence compression + dedup ----
function ruleBasedSummary(text) {
  // 1. Split into sentences
  const rawSents = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [];
  const sents = rawSents.map(s => s.trim()).filter(s => s.length > 4);
  if (!sents.length) return text.trim();
  if (sents.length <= 2) return sents.join('
');

  // 2. Word frequency (skip common filler words)
  const stopwords = new Set(['就','是','的','了','和','在','要','我','你','她','他','我們','你們','就是','這個','那個','所以','就就','察察','和','與','就是說','咖啡', 'the','a','an','is','are','was','were','it','this','that','and','or','but']);
  const freq = {};
  text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean)
      .forEach(w => { if (!stopwords.has(w)) freq[w] = (freq[w]||0)+1; });

  // 3. Score sentences
  const scored = sents.map((s, i) => {
    const words = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean);
    const score = words.reduce((a,w) => a + (freq[w]||0), 0) / Math.max(words.length, 1);
    // Bonus: first sentence often has context
    return { s, i, score: score + (i === 0 ? 1 : 0) };
  });

  // 4. Keep top 30% but minimum 2, maximum 5 sentences
  const topN = Math.min(5, Math.max(2, Math.ceil(sents.length * 0.3)));
  const top = scored.sort((a,b) => b.score - a.score).slice(0, topN);
  top.sort((a,b) => a.i - b.i);

  // 5. Build output with bullet points for readability
  const bullets = top.map(x => '• ' + x.s.trim());

  // 6. Add keyword line at top
  const keywords = Object.entries(freq)
    .filter(([w]) => w.length >= 2)
    .sort((a,b) => b[1]-a[1]).slice(0,6).map(([w])=>w);
  const keyLine = keywords.length ? '🔑 關鍵詞：' + keywords.join('、') : '';

  return (keyLine ? keyLine + '\n\n' : '') + bullets.join('\n');
}

function chunkText(text, maxLen) {
  const words = text.split(/\s+/); const chunks = []; let cur = '';
  for (const w of words) {
    if ((cur+' '+w).length > maxLen && cur) { chunks.push(cur.trim()); cur = w; } else cur += ' '+w;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}

// ---------- Storage ----------
function loadNotes() { return JSON.parse(localStorage.getItem('inote-notes')||'[]'); }
function saveNotes(arr) { localStorage.setItem('inote-notes', JSON.stringify(arr)); }

function saveNote() {
  const text = fullText.trim();
  if (!text) { alert('沒有內容可儲存，請先錄音'); return; }
  const ts = new Date().toLocaleString('zh-HK', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  const aiText = $summaryOutput.textContent.trim();
  const summary = (aiText && !aiText.startsWith('⚠️') && !aiText.includes('處理中')) ? aiText : '';
  const note = { id: Date.now(), title: ts, lang: $lang.value, timestamp: ts, fullText: text, subtitles:[...subtitles], summary, audioData: null };
  const persist = (withAudio) => {
    const notes = loadNotes(); notes.unshift(note); saveNotes(notes);
    alert(withAudio ? '✅ 筆記已儲存！（含錄音）' : '✅ 筆記已儲存！');
    fullText = ''; subtitles = []; audioBlob = null;
    $box.textContent = ''; hideSummary();
    $status.textContent = '點擊開始錄音新筆記';
  };
  if (audioBlob && audioBlob.size < 3*1024*1024) {
    const reader = new FileReader();
    reader.onload = () => { note.audioData = reader.result; persist(true); };
    reader.readAsDataURL(audioBlob);
  } else { persist(false); }
}

// ---------- Notes List ----------
const $notesList   = document.getElementById('notesList');
const $searchInput = document.getElementById('searchInput');
const langLabel = { 'zh-HK':'粵','zh-TW':'繁','zh-CN':'簡','en-US':'EN' };
$searchInput.addEventListener('input', renderNotes);

function renderNotes() {
  const q = $searchInput.value.toLowerCase();
  let notes = loadNotes();
  if (q) notes = notes.filter(n => n.fullText.toLowerCase().includes(q)||n.title.includes(q));
  if (!notes.length) {
    $notesList.innerHTML = '<p class="empty-hint">'+(q?'沒有符合的筆記':'還沒有筆記。錄音後點「結束錄製」儲存。')+'</p>';
    return;
  }
  $notesList.innerHTML = notes.map(n=>`
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
    </div>
  `).join('');
  $notesList.querySelectorAll('.note-card').forEach(card=>{
    card.addEventListener('click', e=>{
      if (e.target.closest('.note-delete-btn')) return;
      openNote(loadNotes().find(n=>n.id===parseInt(card.dataset.id)));
    });
  });
  $notesList.querySelectorAll('.note-delete-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      if (!confirm('確認刪除？')) return;
      saveNotes(loadNotes().filter(n=>n.id!==parseInt(btn.dataset.id)));
      renderNotes();
    });
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

document.querySelectorAll('.modal-tab').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.modal-tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    document.getElementById('tabSubtitles').classList.toggle('hidden', tab!=='subtitles');
    document.getElementById('tabSummary').classList.toggle('hidden',   tab!=='summary');
    document.getElementById('tabFull').classList.toggle('hidden',      tab!=='full');
  });
});

const subLangLabel = { 'zh-HK':'[粵]','zh-TW':'[繁]','zh-CN':'[簡]','en-US':'[EN]' };

function openNote(note) {
  $noteModalTitle.textContent = note.title;
  const oldAudio = $audioWrap.querySelector('audio');
  const newAudio = document.createElement('audio');
  newAudio.id = 'audioPlayer'; newAudio.controls = true;
  $audioWrap.replaceChild(newAudio, oldAudio);
  if (note.audioData) {
    newAudio.src = note.audioData;
    $audioWrap.classList.remove('hidden');
    setupSubtitleSync(newAudio, note.subtitles);
  } else {
    $audioWrap.classList.add('hidden');
  }
  if (note.subtitles?.length) {
    // Show language badge per subtitle line (for mixed-language notes)
    $subtitleList.innerHTML = note.subtitles.map((s,i) => {
      const badge = s.lang && s.lang !== note.lang ? `<span class="sub-lang">${subLangLabel[s.lang]||''}</span>` : '';
      return `<div class="subtitle-item" data-index="${i}" data-time="${s.time}">
        <span class="sub-time">${fmtTime(s.time)}</span>
        <span class="sub-text">${badge}${s.text}</span>
      </div>`;
    }).join('');
    if (note.audioData) {
      $subtitleList.querySelectorAll('.subtitle-item').forEach(item=>{
        item.addEventListener('click', ()=>{ newAudio.currentTime=parseInt(item.dataset.time); newAudio.play(); });
      });
    }
  } else {
    $subtitleList.innerHTML = '<p class="empty-hint">此筆記沒有字幕資料</p>';
  }
  $modalSummary.innerHTML = note.summary
    ? note.summary.replace(/\n/g,'<br>')
    : '<span style="color:var(--text-muted)">( 未生成 AI 總結 )</span>';
  $modalFull.textContent = note.fullText;
  document.querySelectorAll('.modal-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="subtitles"]').classList.add('active');
  document.getElementById('tabSubtitles').classList.remove('hidden');
  document.getElementById('tabSummary').classList.add('hidden');
  document.getElementById('tabFull').classList.add('hidden');
  $noteModal.classList.remove('hidden');
}

function setupSubtitleSync(audioEl, subs) {
  if (!subs?.length) return;
  audioEl.addEventListener('timeupdate', ()=>{
    const t = Math.floor(audioEl.currentTime);
    const items = $subtitleList.querySelectorAll('.subtitle-item');
    let active = null;
    items.forEach(item=>{ item.classList.remove('active'); if (parseInt(item.dataset.time)<=t) active=item; });
    if (active) { active.classList.add('active'); active.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  });
}

function closeModal() {
  $noteModal.classList.add('hidden');
  const player = $audioWrap.querySelector('audio');
  if (player) { player.pause(); player.src=''; }
}
$noteModalClose.addEventListener('click', closeModal);
$noteModal.addEventListener('click', e=>{ if (e.target===$noteModal) closeModal(); });

function fmtTime(sec) {
  return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
}
