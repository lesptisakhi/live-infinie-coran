const express = require('express');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000;
const PASSWORD = 'fURIOUS35.2008@#';

let ffmpegProcess = null;
let lastBitrate = null;
let isLive = false;
let liveStartTime = null;
let restartCount = 0;
let lastLogs = [];

// ---------- Middleware protection ----------
function authMiddleware(req, res, next) {
  const key = req.query.key;
  if (key !== PASSWORD) {
    return res.status(401).send('Unauthorized');
  }
  next();
}

// ---------- Static files ----------
app.use('/public', express.static(path.join(__dirname, 'public')));

// ---------- Page stats protégée ----------
app.get('/stats', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

// ---------- API status ----------
app.get('/api/status', authMiddleware, (req, res) => {
  const uptime = liveStartTime ? Math.floor((Date.now() - liveStartTime) / 1000) : 0;

  const mem = process.memoryUsage();
  const ramMb = Math.round(mem.rss / 1024 / 1024);

  const load = os.loadavg()[0];

  res.json({
    live: isLive,
    bitrate: lastBitrate,
    uptime,
    restartCount,
    ramMb,
    cpuLoad: load,
    logs: lastLogs.slice(-50)
  });
});

// ---------- API restart live ----------
app.post('/api/restart', authMiddleware, (req, res) => {
  restartLive();
  res.json({ ok: true });
});

// ---------- API change video ----------
app.use(express.json());
app.post('/api/change-video', authMiddleware, (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  fs.writeFileSync('video_url.txt', url);
  restartLive();
  res.json({ ok: true });
});

// ---------- WebSocket (logs + stats en temps réel) ----------
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const key = url.searchParams.get('key');
  if (key !== PASSWORD) {
    ws.close();
    return;
  }

  ws.send(JSON.stringify({ type: 'hello', message: 'connected' }));
});

// Broadcast helper
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ---------- Gestion FFmpeg (logs + bitrate) ----------
function attachFfmpegLogging(child) {
  liveStartTime = Date.now();
  isLive = true;

  child.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (!line) return;

    lastLogs.push(line);
    if (lastLogs.length > 200) lastLogs.shift();

    broadcast({ type: 'log', line });

    const match = line.match(/bitrate=\s*([0-9.]+)kbits\/s/);
    if (match) {
      lastBitrate = parseFloat(match[1]);
      broadcast({ type: 'bitrate', value: lastBitrate });
    }
  });

  child.on('exit', () => {
    isLive = false;
    broadcast({ type: 'status', live: false });
  });
}

// ---------- Restart live ----------
function restartLive() {
  restartCount++;
  broadcast({ type: 'restart', count: restartCount });
}

// ---------- IMPORTANT : Mini serveur HTTP pour Render Free ----------
app.get('/', (req, res) => {
  res.send('Service en ligne ✔️');
});
// ---------- Lancer FFmpeg ----------
function startFFmpeg() {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGKILL');
  }

  const playlistPath = path.join(__dirname, 'playlist.txt');

  ffmpegProcess = spawn('ffmpeg', [
    '-re',
    '-loop', '1', '-i', 'img.png',
    '-f', 'concat', '-safe', '0', '-i', playlistPath,
    '-vf', 'scale=854:480,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage', '-b:v', '2000k',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-g', '60', '-keyint_min', '60',
    '-shortest',
    '-f', 'flv', 'rtmp://a.rtmp.youtube.com/live2/rp4f-a4rp-adz9-hk5d-5fd4'
  ]);

  attachFfmpegLogging(ffmpegProcess);
}

startFFmpeg();

// ---------- Démarrage serveur ----------
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
