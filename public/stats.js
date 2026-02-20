// --- PASSWORD HANDLING ---
function getPassword() {
  const url = new URL(window.location.href);
  let key = url.searchParams.get('key');
  if (!key) {
    key = prompt('Mot de passe :');
    if (!key) return null;
    url.searchParams.set('key', key);
    window.history.replaceState({}, '', url.toString());
  }
  return key;
}

const PASSWORD = getPassword();
if (!PASSWORD) {
  alert('Mot de passe requis.');
}

// --- ELEMENTS ---
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const bitrateEl = document.getElementById('bitrate');
const uptimeEl = document.getElementById('uptime');
const restartsEl = document.getElementById('restarts');
const ramEl = document.getElementById('ram');
const cpuEl = document.getElementById('cpu');
const logsEl = document.getElementById('logs');
const ytStatusEl = document.getElementById('yt-status');

const trackEl = document.getElementById('track');
const audioPlayer = document.getElementById('player');

const btnRestart = document.getElementById('btn-restart');
const btnRestartCycle = document.getElementById('btn-restart-cycle');
const btnChangeVideo = document.getElementById('btn-change-video');
const videoUrlInput = document.getElementById('video-url');

// --- BITRATE GRAPH ---
const canvas = document.getElementById('bitrate-chart');
const ctx = canvas.getContext('2d');
let bitrateData = [];

function drawChart() {
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  if (bitrateData.length < 2) return;

  const max = Math.max(...bitrateData, 1);
  const min = 0;

  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.beginPath();

  bitrateData.forEach((v, i) => {
    const x = (i / (bitrateData.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

// --- WEBSOCKET LIVE UPDATES ---
if (PASSWORD) {
  const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${wsProto}://${window.location.host}/?key=${encodeURIComponent(PASSWORD)}`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'log') {
      logsEl.textContent += msg.line + '\n';
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    if (msg.type === 'bitrate') {
      const val = msg.value || 0;
      bitrateEl.textContent = val.toFixed(0);
      bitrateData.push(val);
      if (bitrateData.length > 60) bitrateData.shift();
      drawChart();
    }

    if (msg.type === 'status') {
      setLiveStatus(msg.live);
    }

    if (msg.type === 'track') {
      updateTrack(msg.file);
    }
  };
}

// --- STATUS HANDLER ---
function setLiveStatus(live) {
  if (live) {
    statusPill.classList.add('live');
    statusText.textContent = 'LIVE';
    statusPill.textContent = 'LIVE';
  } else {
    statusPill.classList.remove('live');
    statusText.textContent = 'OFFLINE';
    statusPill.textContent = 'OFFLINE';
  }
}

// --- TRACK HANDLER ---
function updateTrack(file) {
  if (!file) return;
  trackEl.textContent = `${file}`;
  audioPlayer.src = `/api/audio?file=${file}&key=${PASSWORD}`;
}

// --- POLL API STATUS ---
async function refreshStatus() {
  try {
    const url = new URL('/api/status', window.location.origin);
    url.searchParams.set('key', PASSWORD);
    const res = await fetch(url.toString());
    if (!res.ok) return;
    const data = await res.json();

    setLiveStatus(data.live);

    if (data.bitrate != null) bitrateEl.textContent = data.bitrate.toFixed(0);
    uptimeEl.textContent = data.uptime + ' s';
    restartsEl.textContent = data.restartCount;
    ramEl.textContent = data.ramMb;
    cpuEl.textContent = data.cpuLoad.toFixed(2);
    ytStatusEl.textContent = data.youtubeStatus;

    if (data.currentTrack) updateTrack(data.currentTrack);

    // Initial logs load
    if (logsEl.textContent.trim().length === 0 && data.logs && data.logs.length) {
      logsEl.textContent = data.logs.join('\n') + '\n';
      logsEl.scrollTop = logsEl.scrollHeight;
    }
  } catch (e) {
    console.error(e);
  }
}

setInterval(refreshStatus, 2000);
refreshStatus();

// --- ACTION BUTTONS ---
btnRestart.addEventListener('click', async () => {
  const url = new URL('/api/restart', window.location.origin);
  url.searchParams.set('key', PASSWORD);
  await fetch(url.toString(), { method: 'POST' });
});

btnRestartCycle.addEventListener('click', async () => {
  const url = new URL('/api/restart-cycle', window.location.origin);
  url.searchParams.set('key', PASSWORD);
  await fetch(url.toString(), { method: 'POST' });
});

btnChangeVideo.addEventListener('click', async () => {
  const urlValue = videoUrlInput.value.trim();
  if (!urlValue) return alert('Entre une URL vidéo.');

  const url = new URL('/api/change-video', window.location.origin);
  url.searchParams.set('key', PASSWORD);

  await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: urlValue })
  });

  alert('Vidéo changée (le live va redémarrer).');
});
