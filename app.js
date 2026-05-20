// ===== Theme Toggle =====
const body = document.body;
const themeBtn = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('inote-theme') || 'light';
body.className = savedTheme;
themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeBtn.addEventListener('click', () => {
  const isDark = body.classList.contains('dark');
  body.className = isDark ? 'light' : 'dark';
  themeBtn.textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('inote-theme', isDark ? 'light' : 'dark');
});

// ===== Tab Navigation =====
const tabRecord  = document.getElementById('tabRecord');
const tabSummary = document.getElementById('tabSummary');
const pageRecord  = document.getElementById('pageRecord');
const pageSummary = document.getElementById('pageSummary');

tabRecord.addEventListener('click', () => {
  tabRecord.classList.add('active');
  tabSummary.classList.remove('active');
  pageRecord.classList.remove('hidden');
  pageSummary.classList.add('hidden');
});
tabSummary.addEventListener('click', () => {
  tabSummary.classList.add('active');
  tabRecord.classList.remove('active');
  pageSummary.classList.remove('hidden');
  pageRecord.classList.add('hidden');
  renderSummaries();
});

// ===== Speech Recognition =====
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let fullTranscript = '';

const statusDot  = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const transcriptBox = document.getElementById('transcript');
const btnStart = document.getElementById('btnStart');
const btnStop  = document.getElementById('btnStop');
const btnClear = document.getElementById('btnClear');
const btnSummarize = document.getElementById('btnSummarize');

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'zh-TW';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t + ' ';
      else interim += t;
    }
    if (final) fullTranscript += final;
    transcriptBox.textContent = fullTranscript + interim;
  };

  recognition.onend = () => {
    if (isListening) recognition.start(); // keep alive
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech') {
      statusText.textContent = '錯誤：' + e.error;
      stopRecognition();
    }
  };
} else {
  btnStart.disabled = true;
  statusText.textContent = '此瀏覽器不支援語音識別（請使用 Chrome）';
}

function startRecognition() {
  if (!recognition) return;
  isListening = true;
  recognition.start();
  statusDot.className = 'dot active';
  statusText.textContent = '錄音中…';
  btnStart.disabled = true;
  btnStop.disabled = false;
}

function stopRecognition() {
  isListening = false;
  if (recognition) recognition.stop();
  statusDot.className = 'dot idle';
  statusText.textContent = '已停止';
  btnStart.disabled = false;
  btnStop.disabled = true;
}

btnStart.addEventListener('click', startRecognition);
btnStop.addEventListener('click', stopRecognition);
btnClear.addEventListener('click', () => {
  fullTranscript = '';
  transcriptBox.textContent = '';
});

// ===== Auto Summarize (free, on-device) =====
// Uses extractive summarization — no API needed.
function summarize(text) {
  if (!text.trim()) return '（沒有內容可總結）';

  // Split into sentences (Chinese & general)
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text];
  if (sentences.length <= 3) return text.trim();

  // Score each sentence by word frequency
  const words = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  const scored = sentences.map((s, i) => {
    const sw = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    const score = sw.reduce((sum, w) => sum + (freq[w] || 0), 0) / (sw.length || 1);
    return { s, score, i };
  });

  // Pick top ~30% sentences, restore original order
  const topN = Math.max(2, Math.ceil(sentences.length * 0.3));
  const top = scored.sort((a, b) => b.score - a.score).slice(0, topN);
  top.sort((a, b) => a.i - b.i);

  return top.map(t => t.s.trim()).join('\n');
}

// ===== Storage =====
function loadSummaries() {
  return JSON.parse(localStorage.getItem('inote-summaries') || '[]');
}
function saveSummaries(arr) {
  localStorage.setItem('inote-summaries', JSON.stringify(arr));
}

btnSummarize.addEventListener('click', () => {
  const text = transcriptBox.textContent.trim();
  if (!text) { alert('請先錄音或輸入文字。'); return; }

  const now = new Date();
  const timestamp = now.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const summary = summarize(text);
  const record = { timestamp, summary, full: text };

  const summaries = loadSummaries();
  summaries.unshift(record);
  saveSummaries(summaries);

  alert('✅ 總結已儲存！');
});

// ===== Render Summary List =====
function renderSummaries() {
  const list = document.getElementById('summaryList');
  const summaries = loadSummaries();
  if (!summaries.length) {
    list.innerHTML = '<p class="empty-hint">還沒有總結。回到錄音頁面生成。</p>';
    return;
  }
  list.innerHTML = summaries.map((r, i) => `
    <div class="summary-item">
      <button class="timestamp-btn" data-index="${i}">
        <span class="ts-icon">🕐</span>
        <div class="ts-info">
          <div class="ts-time">${r.timestamp}</div>
          <div class="ts-preview">${r.summary.slice(0, 60)}…</div>
        </div>
        <span class="ts-arrow">›</span>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('.timestamp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      openModal(summaries[idx]);
    });
  });
}

// ===== Modal =====
const modal      = document.getElementById('modal');
const modalTime  = document.getElementById('modalTime');
const modalBody  = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

function openModal(record) {
  modalTime.textContent = '🕐 ' + record.timestamp;
  modalBody.textContent = record.summary;
  modal.classList.remove('hidden');
}

modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});
