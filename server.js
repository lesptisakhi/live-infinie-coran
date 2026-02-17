const express = require("express");
const fs = require("fs");
const os = require("os");
const app = express();

let restartCount = 0;
let lastLogTime = Date.now();

// compteur de redémarrages mis à jour par start.sh via un fichier
const RESTART_FILE = "restarts.txt";

// lire le nombre de redémarrages
function getRestartCount() {
  try {
    const data = fs.readFileSync(RESTART_FILE, "utf8");
    return parseInt(data.trim()) || 0;
  } catch {
    return 0;
  }
}

// récupérer les dernières lignes du log
function getLastLogLines(n = 50) {
  try {
    const data = fs.readFileSync("logs.txt", "utf8");
    const lines = data.split("\n");
    const lastLines = lines.slice(-n);
    return lastLines;
  } catch {
    return ["Aucun log disponible."];
  }
}

// est-ce que le live est actif ?
function getLiveStatus() {
  try {
    const stats = fs.statSync("logs.txt");
    const mtime = new Date(stats.mtime).getTime();
    lastLogTime = mtime;
  } catch {
    return "OFFLINE";
  }
  const diff = Date.now() - lastLogTime;
  return diff < 15000 ? "LIVE" : "OFFLINE"; // 15 secondes
}

// extraire un bitrate approximatif depuis les logs
function getCurrentBitrate() {
  const lines = getLastLogLines(30);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(/bitrate=\s*([\d\.]+)kbits\/s/);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

// API JSON
app.get("/api/stats", (req, res) => {
  const lines = getLastLogLines(20);
  const bitrate = getCurrentBitrate();
  const status = getLiveStatus();
  const restarts = getRestartCount();
  const uptime = process.uptime();

  const mem = process.memoryUsage();
  const cpuLoad = os.loadavg();

  res.json({
    status,
    bitrate_kbps: bitrate,
    restarts,
    uptime_seconds: Math.round(uptime),
    memory_mb: Math.round(mem.rss / 1024 / 1024),
    cpu_load_1m: cpuLoad[0],
    last_logs: lines,
  });
});

// page HTML simple avec dashboard + graphique
app.get("/stats", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Live Stats</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { font-family: sans-serif; background:#111; color:#eee; padding:20px; }
        .card { background:#222; padding:15px; margin-bottom:15px; border-radius:8px; }
        pre { background:#000; padding:10px; border-radius:5px; max-height:300px; overflow:auto; }
      </style>
    </head>
    <body>
      <h1>Live Stats (Render)</h1>
      <div class="card">
        <p>Status: <span id="status">...</span></p>
        <p>Bitrate: <span id="bitrate">...</span> kbps</p>
        <p>Redémarrages: <span id="restarts">...</span></p>
        <p>Uptime: <span id="uptime">...</span> s</p>
        <p>RAM: <span id="ram">...</span> MB</p>
        <p>CPU (1m load): <span id="cpu">...</span></p>
        <button onclick="restartLive()">Restart Live</button>
      </div>

      <div class="card">
        <canvas id="bitrateChart" height="100"></canvas>
      </div>

      <div class="card">
        <h3>Derniers logs</h3>
        <pre id="logs"></pre>
      </div>

      <script>
        let bitrateData = [];
        let labels = [];
        const ctx = document.getElementById('bitrateChart').getContext('2d');
        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Bitrate (kbps)',
              data: bitrateData,
              borderColor: 'rgba(0, 200, 255, 1)',
              backgroundColor: 'rgba(0, 200, 255, 0.2)',
              tension: 0.2,
            }]
          },
          options: {
            scales: {
              x: { display: false },
              y: { beginAtZero: true }
            }
          }
        });

        async function fetchStats() {
          const res = await fetch('/api/stats');
          const data = await res.json();

          document.getElementById('status').innerText = data.status;
          document.getElementById('bitrate').innerText = data.bitrate_kbps ?? 'N/A';
          document.getElementById('restarts').innerText = data.restarts;
          document.getElementById('uptime').innerText = data.uptime_seconds;
          document.getElementById('ram').innerText = data.memory_mb;
          document.getElementById('cpu').innerText = data.cpu_load_1m.toFixed(2);
          document.getElementById('logs').innerText = data.last_logs.join('\\n');

          if (data.bitrate_kbps) {
            labels.push('');
            bitrateData.push(data.bitrate_kbps);
            if (labels.length > 50) {
              labels.shift();
              bitrateData.shift();
            }
            chart.update();
          }
        }

        async function restartLive() {
          await fetch('/api/restart', { method: 'POST' });
          alert('Restart demandé.');
        }

        setInterval(fetchStats, 3000);
        fetchStats();
      </script>
    </body>
    </html>
  `);
});

// endpoint pour restart (simple flag)
let restartRequested = false;
app.post("/api/restart", (req, res) => {
  restartRequested = true;
  fs.writeFileSync("restart.flag", "1");
  res.json({ ok: true });
});

app.listen(10000, () => console.log("Stats server running on port 10000"));
