const express = require('express');
const os = require('os');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000;
const PASSWORD = 'fURIOUS35.2008@#';

// État du live
let lastBitrate = null;
let isLive = false;
let liveStartTime = null;
let restartCount = 0;
let lastLogs = [];

// Playlist / piste en cours
let currentTrack = null;
const totalTracks = 114;

// Statut YouTube (simple ping)
let youtubeStatus = 'unknown';

// Pour lire ffmpeg.log en continu
let lastLogSize = 0;

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

// ---------- JSON body ----------
app.use(express.json());

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
    logs: lastLogs.slice(-50),
    currentTrack,
    totalTracks,
    youtubeStatus
  });
});

// ---------- API logs filtrés ----------
app.get('/api/logs', authMiddleware, (req, res) => {
  const type = req.query.type || 'all';
  let filtered = lastLogs;

  if (type === 'error') {
    filtered = lastLogs.filter(l => l.toLowerCase().includes('error'));
  } else if (type === 'warn') {
    filtered = lastLogs.filter(l => l.toLowerCase().includes('warning'));
  } else if (type === 'ffmpeg') {
    filtered = lastLogs.filter(l => l.includes('frame=') || l.includes('bitrate='));
  }

  res.json(filtered.slice(-100));
});

// ---------- API restart live ----------
app.post('/api/restart', authMiddleware, (req, res) => {
  restartCount++;
  broadcast({ type: 'restart', count: restartCount });
  res.json({ ok: true });
});

// ---------- API restart cycle (revient au début logique) ----------
app.post('/api/restart-cycle', authMiddleware, (req, res) => {
  restartCount++;
  currentTrack = null;
  broadcast({ type: 'restartCycle', count: restartCount });
  res.json({ ok: true });
});

// ---------- API change video ----------
app.post('/api/change-video', authMiddleware, (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  fs.writeFileSync('video_url.txt', url);
  restartCount++;
  broadcast({ type: 'restart', count: restartCount });

  res.json({ ok: true });
});

// ---------- API mini-player audio (fichier en cours) ----------
app.get('/api/audio', authMiddleware, (req, res) => {
  const file = req.query.file || currentTrack;
  if (!file) return res.status(400).send('No track');

  const audioPath = path.join('/tmp/audio', file);
  fs.access(audioPath, fs.constants.R_OK, (err) => {
    if (err) return res.status(404).send('File not found');
    res.sendFile(audioPath);
  });
});

// ---------- WebSocket ----------
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

// ---------- Lecture en temps réel de ffmpeg.log ----------
setInterval(() => {
  fs.stat('ffmpeg.log', (err, stats) => {
    if (err || !stats) return;

    if (stats.size > lastLogSize) {
      const stream = fs.createReadStream('ffmpeg.log', {
        start: lastLogSize,
        end: stats.size
      });

      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');

        lines.forEach(line => {
          if (!line.trim()) return;

          // Ajouter aux logs
          lastLogs.push(line);
          if (lastLogs.length > 200) lastLogs.shift();

          // Envoyer au dashboard
          broadcast({ type: 'log', line });

          // Détection LIVE
          if (line.includes('frame=') || line.includes('bitrate=')) {
            if (!isLive) {
              liveStartTime = Date.now();
            }
            isLive = true;
            broadcast({ type: 'status', live: true });
          }

          // Extraction du bitrate
          const matchBitrate = line.match(/bitrate=\s*([0-9.]+)kbits\/s/);
          if (matchBitrate) {
            lastBitrate = parseFloat(matchBitrate[1]);
            broadcast({ type: 'bitrate', value: lastBitrate });
          }

          // Détection du fichier audio en cours (si ffmpeg logue "Opening '.../NNN.mp3'")
          const matchFile = line.match(/Opening '.*\/([0-9]{3}\.mp3)'/);
          if (matchFile) {
            currentTrack = matchFile[1]; // ex: "045.mp3"
            broadcast({ type: 'track', file: currentTrack });
          }
        });
      });

      lastLogSize = stats.size;
    }
  });
}, 500);

// ---------- Ping simple YouTube pour statut ----------
setInterval(() => {
  const req = http.get('http://a.rtmp.youtube.com', (res) => {
    youtubeStatus = (res.statusCode >= 200 && res.statusCode < 500) ? 'online' : 'unknown';
    res.resume();
  });

  req.on('error', () => {
    youtubeStatus = 'offline';
  });
}, 10000);

// ---------- Démarrage serveur ----------
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
