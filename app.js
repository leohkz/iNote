// iNote v2.9

// ---------- Theme ----------
const $body = document.body;
const $themeBtn = document.getElementById('themeToggle');
$body.className = localStorage.getItem('inote-theme') || 'light';
$themeBtn.textContent = $body.classList.contains('dark') ? '☀️' : '🌙';
$themeBtn.addEventListener('click', () => {
  const dark = $body.classList.contains('dark');
  $body.className = dark ? 'light' : 'dark';
  $themeBtn.textContent = dark ? '🌙' : '☀️';
  localStorage.setItem('inote-theme', dark ? 'light' : 'dark');
});

// ---------- Tabs ----------
document.getElementById('tabRecord').addEventListener('click', () => switchPage('record'));
document.getElementById('tabNotes').addEventListener('click', () => { switchPage('notes'); renderNotes(); });
document.getElementById('tabSettings').addEventListener('click', () => { switchPage('settings'); initSettings(); });
function switchPage(p) {
  ['record','notes','settings'].forEach(id => {
    const cap = id.charAt(0).toUpperCase()+id.slice(1);
    document.getElementById('tab'+cap).classList.toggle('active', id===p);
    document.getElementById('page'+cap).classList.toggle('hidden', id!==p);
  });
}

// ---------- Settings ----------
const $aiEngine          = document.getElementById('aiEngine');
const $nvidiaSettings    = document.getElementById('nvidiaSettings');
const $openaiSettings    = document.getElementById('openaiSettings');
const $nvidiaKey         = document.getElementById('nvidiaKey');
const $nvidiaModel       = document.getElementById('nvidiaModel');
const $nvidiaModelPreset = document.getElementById('nvidiaModelPreset');
const $openaiKey         = document.getElementById('openaiKey');
const $openaiModel       = document.getElementById('openaiModel');

function initSettings() {
  $aiEngine.value    = localStorage.getItem('inote-ai-engine') || 'local';
  $nvidiaKey.value   = localStorage.getItem('inote-nvidia-key') || '';
  $nvidiaModel.value = localStorage.getItem('inote-nvidia-model') || 'meta/llama-3.1-8b-instruct';
  $openaiKey.value   = localStorage.getItem('inote-openai-key') || '';
  $openaiModel.value = localStorage.getItem('inote-openai-model') || 'gpt-4o-mini';
  toggleEngineRows();
}
function toggleEngineRows() {
  $nvidiaSettings.classList.toggle('hidden', $aiEngine.value !== 'nvidia');
  $openaiSettings.classList.toggle('hidden', $aiEngine.value !== 'openai');
}
$aiEngine.addEventListener('change', () => {
  localStorage.setItem('inote-ai-engine', $aiEngine.value);
  toggleEngineRows();
});
// Preset fills the text input
$nvidiaModelPreset.addEventListener('change', () => {
  if ($nvidiaModelPreset.value) $nvidiaModel.value = $nvidiaModelPreset.value;
});
document.getElementById('nvidiaModelSave').addEventListener('click', () => {
  const v = $nvidiaModel.value.trim();
  if (!v) { showToast('請輸入模型名稱'); return; }
  localStorage.setItem('inote-nvidia-model', v);
  showToast('✅ 模型已儲存: '+v);
});
$openaiModel.addEventListener('change', () => localStorage.setItem('inote-openai-model', $openaiModel.value));
document.getElementById('nvidiaKeySave').addEventListener('click', () => {
  localStorage.setItem('inote-nvidia-key', $nvidiaKey.value.trim());
  showToast('✅ NVIDIA Key 已儲存');
});
document.getElementById('openaiKeySave').addEventListener('click', () => {
  localStorage.setItem('inote-openai-key', $openaiKey.value.trim());
  showToast('✅ OpenAI Key 已儲存');
});
document.getElementById('btnClearAll').addEventListener('click', () => {
  if (!confirm('確認刪除全部筆記？此操作不可還原')) return;
  localStorage.removeItem('inote-notes'); showToast('✅ 已清除全部筆記');
});
initSettings();

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._to); t._to=setTimeout(()=>t.classList.remove('show'),2500);
}

// ---------- Language ----------
const $lang = document.getElementById('langSelect');
$lang.value = localStorage.getItem('inote-lang') || 'zh-HK';
$lang.addEventListener('change', () => localStorage.setItem('inote-lang', $lang.value));

// ---------- Timer ----------
let timerInterval=null, timerSecs=0;
const $recTimer = document.getElementById('recTimer');
function startTimer(){timerInterval=setInterval(()=>{timerSecs++;$recTimer.textContent=pad(Math.floor(timerSecs/60))+':'+pad(timerSecs%60);},1000);}
function pauseTimer(){clearInterval(timerInterval);}
function resetTimer(){clearInterval(timerInterval);timerSecs=0;$recTimer.textContent='';}
function pad(n){return String(n).padStart(2,'0');}

// ---------- MediaRecorder ----------
let mediaRecorder=null, audioChunks=[], audioBlob=null, micStream=null, recordMime='audio/webm';
function getBestMime(){
  // Prefer m4a (mp4), fallback to webm, then ogg
  if(MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if(MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return 'audio/ogg';
}
function startAudio(stream){
  audioChunks=[];
  recordMime=getBestMime();
  mediaRecorder=new MediaRecorder(stream,{mimeType:recordMime});
  mediaRecorder.ondataavailable=e=>{if(e.data.size>0)audioChunks.push(e.data);};
  mediaRecorder.start(500);
}
function stopAndWait(){
  return new Promise(resolve=>{
    if(!mediaRecorder||mediaRecorder.state==='inactive'){resolve();return;}
    mediaRecorder.onstop=()=>{audioBlob=new Blob(audioChunks,{type:recordMime});resolve();};
    if(mediaRecorder.state!=='inactive')mediaRecorder.stop();
  });
}

// ---------- UI State ----------
const $dot       = document.getElementById('statusDot');
const $status    = document.getElementById('statusText');
const $box       = document.getElementById('transcript');
const $btnStart  = document.getElementById('btnStart');
const $btnPause  = document.getElementById('btnPause');
const $btnReset  = document.getElementById('btnReset');
const $btnFinish = document.getElementById('btnFinish');
let uiState='idle';
function setState(s){
  uiState=s;
  const idle=s==='idle',rec=s==='recording',paused=s==='paused',active=rec||paused;
  $btnStart.disabled=active;$btnPause.disabled=idle;$btnFinish.disabled=idle;$btnReset.disabled=false;
  $lang.disabled=active;
  $dot.className=rec?'dot active':paused?'dot paused':'dot idle';
  $status.textContent=rec?'錄音中…':paused?'已暫停 — 點擊繼續':'點擊『開始』錄音';
  $btnPause.textContent=paused?'▶ 繼續':'⏸ 暫停';
  $btnPause.className=paused?'btn-primary':'btn-warn';
}
setState('idle');

// ---------- Speech Recognition ----------
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null,isListening=false,isPaused=false;
let fullText='',interimText='',subtitles=[],recordStart=0,pausedAt=0,totalPausedMs=0;
if(SR){
  recognition=new SR();
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.onresult=e=>{
    interimText='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      if(e.results[i].isFinal){
        const elapsed=Math.floor((Date.now()-recordStart-totalPausedMs)/1000);
        subtitles.push({time:Math.max(0,elapsed-Math.ceil(t.length/8)),text:t.trim()});
        fullText+=t+' ';interimText='';
      }else{interimText=t;}
    }
    $box.textContent=fullText+interimText;
  };
  recognition.onend=()=>{if(isListening&&!isPaused)recognition.start();};
  recognition.onerror=e=>{if(e.error!=='no-speech'){$status.textContent='錯誤:'+e.error;stopRecognition();setState('idle');}}
}else{
  $btnStart.disabled=true;
  $status.textContent='請使用 Safari 16.4+ 或 Chrome';
}

function flushInterim(){
  if(!interimText.trim())return;
  const elapsed=Math.floor((Date.now()-recordStart-totalPausedMs)/1000);
  subtitles.push({time:Math.max(0,elapsed),text:interimText.trim()});
  fullText+=interimText+' ';interimText='';
  $box.textContent=fullText;
}
async function startAll(){
  try{
    fullText='';interimText='';subtitles=[];timerSecs=0;totalPausedMs=0;isPaused=false;
    $box.textContent='';audioBlob=null;
    micStream=await navigator.mediaDevices.getUserMedia({audio:true});
    startAudio(micStream);
    if(!recognition){alert('此瀏覽器不支援語音識別');return;}
    recognition.lang=$lang.value;recognition.start();
    isListening=true;recordStart=Date.now();
    startTimer();setState('recording');
  }catch(err){$status.textContent='麥克風授權失敗: '+err.message;}
}
function togglePause(){
  if(uiState==='recording'){
    flushInterim();isPaused=true;pausedAt=Date.now();
    if(recognition)try{recognition.stop();}catch(e){}
    if(mediaRecorder?.state==='recording')mediaRecorder.pause();
    pauseTimer();setState('paused');
  }else if(uiState==='paused'){
    totalPausedMs+=Date.now()-pausedAt;isPaused=false;
    if(mediaRecorder?.state==='paused')mediaRecorder.resume();
    recognition.lang=$lang.value;recognition.start();
    startTimer();setState('recording');
  }
}
function stopRecognition(){
  isListening=false;isPaused=false;
  if(recognition)try{recognition.stop();}catch(e){}
  if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null;}
  resetTimer();
}
$btnStart.addEventListener('click',startAll);
$btnPause.addEventListener('click',togglePause);
$btnFinish.addEventListener('click',async()=>{
  flushInterim();
  if(!fullText.trim())fullText=$box.textContent.trim();
  setState('idle');stopRecognition();
  await stopAndWait();
  saveNote();
});
$btnReset.addEventListener('click',()=>{
  if(uiState!=='idle'&&!confirm('確認放棄目前錄音？'))return;
  stopRecognition();
  if(mediaRecorder&&mediaRecorder.state!=='inactive')mediaRecorder.stop();
  fullText='';interimText='';subtitles=[];audioBlob=null;
  $box.textContent='';setState('idle');
});

// ---------- AI Summary ----------
async function summarizeText(text){
  const engine=localStorage.getItem('inote-ai-engine')||'local';
  if(engine==='nvidia')return nvidiaSummarize(text);
  if(engine==='openai')return openaiSummarize(text);
  return ruleBasedSummary(text);
}
async function nvidiaSummarize(text){
  const key=localStorage.getItem('inote-nvidia-key');
  if(!key)throw new Error('請先在 ⚙️ 設置輸入 NVIDIA NIM API Key');
  const model=localStorage.getItem('inote-nvidia-model')||'meta/llama-3.1-8b-instruct';
  const res=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({
      model,
      messages:[
        {role:'system',content:'你是會議助理。請對以下會議記錄做簡明總結，列出重點和行動項目，用繁體中文回答。'},
        {role:'user',content:'會議內容：\n'+text.slice(0,3000)}
      ],
      max_tokens:600,temperature:0.3
    })
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||e.message||'狀態碼 '+res.status);}
  const data=await res.json();
  return data.choices?.[0]?.message?.content||'無輸出';
}
async function openaiSummarize(text){
  const key=localStorage.getItem('inote-openai-key');
  if(!key)throw new Error('請先在 ⚙️ 設置輸入 OpenAI API Key');
  const model=localStorage.getItem('inote-openai-model')||'gpt-4o-mini';
  const res=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({
      model,
      messages:[
        {role:'system',content:'你是會議助理。請對以下會議記錄做簡明總結，列出重點和行動項目，用繁體中文回答。'},
        {role:'user',content:'會議內容：\n'+text.slice(0,6000)}
      ],
      max_tokens:600,temperature:0.3
    })
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||'狀態碼 '+res.status);}
  const data=await res.json();
  return data.choices?.[0]?.message?.content||'無輸出';
}
function ruleBasedSummary(text){
  const sents=(text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g)||[]).map(s=>s.trim()).filter(s=>s.length>4);
  if(!sents.length)return text.trim();
  if(sents.length<=2)return sents.join('\n');
  const stops=new Set(['就','是','的','了','和','在','要','我','你','她','他','我們','你們','這個','那個','所以','the','a','an','is','are','it','and','or']);
  const freq={};
  text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean).forEach(w=>{if(!stops.has(w))freq[w]=(freq[w]||0)+1;});
  const scored=sents.map((s,i)=>{const ws=s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,' ').split(/\s+/).filter(Boolean);return{s,i,score:ws.reduce((a,w)=>a+(freq[w]||0),0)/Math.max(ws.length,1)+(i===0?1:0)};});
  const top=scored.sort((a,b)=>b.score-a.score).slice(0,Math.min(5,Math.max(2,Math.ceil(sents.length*.3)))).sort((a,b)=>a.i-b.i);
  const kws=Object.entries(freq).filter(([w])=>w.length>=2).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([w])=>w);
  return(kws.length?'🔑 關鍵詞：'+kws.join('、')+'\n\n':'')+top.map(x=>'• '+x.s.trim()).join('\n');
}

// ---------- Storage ----------
function loadNotes(){try{return JSON.parse(localStorage.getItem('inote-notes')||'[]');}catch(e){return[];}}
function saveNotes(arr){localStorage.setItem('inote-notes',JSON.stringify(arr));}
function saveNote(){
  const text=fullText.trim();
  if(!text){showToast('沒有內容可儲存，請先錄音');return;}
  const ts=new Date().toLocaleString('zh-HK',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const note={id:Date.now(),title:ts,lang:$lang.value,timestamp:ts,fullText:text,subtitles:[...subtitles],summary:'',audioData:null,audioMime:recordMime};
  function persist(hasAudio){
    const ns=loadNotes();ns.unshift(note);saveNotes(ns);
    showToast(hasAudio?'✅ 筆記已儲存！（含錄音）':'✅ 筆記已儲存！');
    fullText='';interimText='';subtitles=[];audioBlob=null;$box.textContent='';
  }
  if(audioBlob&&audioBlob.size>0&&audioBlob.size<3*1024*1024){
    const r=new FileReader();r.onload=()=>{note.audioData=r.result;persist(true);};r.onerror=()=>persist(false);r.readAsDataURL(audioBlob);
  }else persist(false);
}

// ---------- Notes list ----------
const $notesList=document.getElementById('notesList');
const $searchInput=document.getElementById('searchInput');
const langLabel={'zh-HK':'粵','zh-TW':'繁','zh-CN':'簡','en-US':'EN'};
$searchInput.addEventListener('input',renderNotes);
function renderNotes(){
  const q=$searchInput.value.toLowerCase();
  let notes=loadNotes();
  if(q)notes=notes.filter(n=>n.fullText.toLowerCase().includes(q)||n.title.includes(q));
  if(!notes.length){$notesList.innerHTML='<p class="empty-hint">'+(q?'沒有符合的筆記':'還沒有筆記，錄音後點「結束錄製」儲存')+'</p>';return;}
  $notesList.innerHTML=notes.map(n=>`
    <div class="note-card" data-id="${n.id}">
      <div class="note-card-header"><div class="note-card-title">${n.title}</div><button class="note-delete-btn" data-id="${n.id}">🗑</button></div>
      <div class="note-card-meta">
        <span class="note-lang-badge">${langLabel[n.lang]||n.lang}</span>
        <span class="note-time">${n.timestamp}</span>
        ${n.audioData?'<span class="note-badge badge-audio">🎙 錄音</span>':''}
        ${n.subtitles?.length?'<span class="note-badge badge-sub">🎥 字幕</span>':''}
        ${n.summary?'<span class="note-badge badge-ai">✨ AI</span>':''}
      </div>
      <div class="note-card-preview">${n.fullText.slice(0,80)}…</div>
    </div>`).join('');
  $notesList.querySelectorAll('.note-card').forEach(c=>{
    c.addEventListener('click',e=>{if(e.target.closest('.note-delete-btn'))return;openNote(loadNotes().find(n=>n.id===parseInt(c.dataset.id)));});
  });
  $notesList.querySelectorAll('.note-delete-btn').forEach(b=>{
    b.addEventListener('click',e=>{e.stopPropagation();if(!confirm('確認刪除？'))return;saveNotes(loadNotes().filter(n=>n.id!==parseInt(b.dataset.id)));renderNotes();});
  });
}

// ---------- Note Modal ----------
const $noteModal         = document.getElementById('noteModal');
const $noteModalTitle    = document.getElementById('noteModalTitle');
const $noteModalClose    = document.getElementById('noteModalClose');
const $audioWrap         = document.getElementById('audioPlayerWrap');
const $subtitleList      = document.getElementById('subtitleList');
const $modalSummary      = document.getElementById('modalSummary');
const $modalFull         = document.getElementById('modalFull');
const $btnModalSummarize = document.getElementById('btnModalSummarize');
const $summaryEngineLabel= document.getElementById('summaryEngineLabel');
const $btnDownloadAudio  = document.getElementById('btnDownloadAudio');
let currentNote=null;

document.querySelectorAll('.modal-tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.modal-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
    const tab=t.dataset.tab;
    document.getElementById('tabSubtitles').classList.toggle('hidden',tab!=='subtitles');
    document.getElementById('tabSummary').classList.toggle('hidden',tab!=='summary');
    document.getElementById('tabFull').classList.toggle('hidden',tab!=='full');
  });
});

function getEngineName(){
  const e=localStorage.getItem('inote-ai-engine')||'local';
  const m=localStorage.getItem('inote-nvidia-model')||'meta/llama-3.1-8b-instruct';
  const om=localStorage.getItem('inote-openai-model')||'gpt-4o-mini';
  if(e==='nvidia')return '⚡️ NIM · '+m.split('/').pop();
  if(e==='openai')return '🟢 '+om;
  return '📱 本地引擎';
}

$btnModalSummarize.addEventListener('click',async()=>{
  if(!currentNote)return;
  $btnModalSummarize.disabled=true;$btnModalSummarize.textContent='處理中…';
  $modalSummary.innerHTML='<span class="spinner"></span> AI 處理中…';
  try{
    const result=await summarizeText(currentNote.fullText);
    currentNote.summary=result;
    const notes=loadNotes();const idx=notes.findIndex(n=>n.id===currentNote.id);
    if(idx>=0){notes[idx].summary=result;saveNotes(notes);}
    $modalSummary.innerHTML=result.replace(/\n/g,'<br>');
    $btnModalSummarize.textContent='重新生成';
  }catch(e){
    $modalSummary.innerHTML='⚠️ 失敗: '+e.message;
    $btnModalSummarize.textContent='重試';
  }
  $btnModalSummarize.disabled=false;
});

$btnDownloadAudio.addEventListener('click',()=>{
  if(!currentNote?.audioData)return;
  const mime=currentNote.audioMime||currentNote.audioData.split(';')[0].split(':')[1]||'audio/webm';
  // extension mapping
  const extMap={'audio/mp4':'m4a','audio/webm':'webm','audio/ogg':'ogg'};
  const ext=extMap[mime]||'webm';
  const a=document.createElement('a');
  a.href=currentNote.audioData;
  a.download='inote-'+currentNote.id+'.'+ext;
  a.click();
});

function openNote(note){
  currentNote=note;
  $noteModalTitle.textContent=note.title;
  $summaryEngineLabel.textContent=getEngineName();

  // Audio player — show/hide by toggling visibility, not display
  const audioEl=$audioWrap.querySelector('audio');
  const nw=document.createElement('audio');nw.controls=true;
  $audioWrap.replaceChild(nw,audioEl);
  if(note.audioData){
    nw.src=note.audioData;
    $audioWrap.style.display='';
    setupSubSync(nw,note.subtitles);
  }else{
    $audioWrap.style.display='none';
  }

  // Subtitles
  if(note.subtitles?.length){
    $subtitleList.innerHTML=note.subtitles.map((s,i)=>`
      <div class="subtitle-item" data-index="${i}" data-time="${s.time}">
        <span class="sub-time">${fmtTime(s.time)}</span>
        <span class="sub-text">${s.text}</span>
      </div>`).join('');
    if(note.audioData)$subtitleList.querySelectorAll('.subtitle-item').forEach(item=>{
      item.addEventListener('click',()=>{nw.currentTime=parseInt(item.dataset.time);nw.play();});
    });
  }else $subtitleList.innerHTML='<p class="empty-hint">此筆記沒有字幕資料</p>';

  $modalSummary.innerHTML=note.summary
    ?note.summary.replace(/\n/g,'<br>')
    :'<span style="color:var(--text-muted)">尚未生成，點擊『生成總結』</span>';
  $btnModalSummarize.textContent=note.summary?'重新生成':'生成總結';
  $btnModalSummarize.disabled=false;
  $modalFull.textContent=note.fullText;

  document.querySelectorAll('.modal-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector('.modal-tab[data-tab="subtitles"]').classList.add('active');
  document.getElementById('tabSubtitles').classList.remove('hidden');
  document.getElementById('tabSummary').classList.add('hidden');
  document.getElementById('tabFull').classList.add('hidden');
  $noteModal.classList.remove('hidden');
}
function setupSubSync(audioEl,subs){
  if(!subs?.length)return;
  audioEl.addEventListener('timeupdate',()=>{
    const t=audioEl.currentTime;
    const items=$subtitleList.querySelectorAll('.subtitle-item');
    let active=null;
    items.forEach(item=>{item.classList.remove('active');if(parseInt(item.dataset.time)<=t)active=item;});
    if(active){active.classList.add('active');active.scrollIntoView({behavior:'smooth',block:'nearest'});}
  });
}
function closeModal(){
  $noteModal.classList.add('hidden');
  const p=$audioWrap.querySelector('audio');if(p){p.pause();p.src='';}
  currentNote=null;
}
$noteModalClose.addEventListener('click',closeModal);
$noteModal.addEventListener('click',e=>{if(e.target===$noteModal)closeModal();});
function fmtTime(sec){return pad(Math.floor(sec/60))+':'+pad(sec%60);}
