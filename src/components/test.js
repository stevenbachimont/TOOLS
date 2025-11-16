<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Posemètre Photo</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #fff;
      padding: 1rem;
      min-height: 100vh;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
    }
    
    .video-container {
      position: relative;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1rem;
      aspect-ratio: 4/3;
    }
    
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    canvas { display: none; }
    
    .measurement-zone {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 120px;
      height: 120px;
      border: 2px solid rgba(255,255,255,0.6);
      border-radius: 8px;
      pointer-events: none;
    }
    
    .histogram-overlay {
      position: absolute;
      bottom: 10px;
      left: 10px;
      right: 10px;
      height: 80px;
      background: rgba(0,0,0,0.7);
      border-radius: 8px;
      padding: 8px;
    }
    
    .ev-display {
      background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      margin-bottom: 1rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    
    .ev-value {
      font-size: 3rem;
      font-weight: 700;
      letter-spacing: -1px;
      margin: 0.5rem 0;
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .ev-label {
      font-size: 0.875rem;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-top: 1rem;
      font-size: 0.75rem;
      color: #6b7280;
    }
    
    .stat-item {
      text-align: center;
      padding: 0.5rem;
      background: rgba(255,255,255,0.05);
      border-radius: 6px;
    }
    
    .stat-value {
      font-weight: 600;
      color: #fff;
      display: block;
      margin-bottom: 2px;
    }
    
    button {
      width: 100%;
      padding: 1rem;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    
    .btn-start {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: #fff;
      margin-bottom: 1rem;
    }
    
    .btn-start:hover { transform: translateY(-1px); box-shadow: 0 8px 16px rgba(59,130,246,0.3); }
    .btn-stop { background: #dc2626; color: #fff; }
    .btn-stop:hover { background: #b91c1c; }
    
    .settings {
      background: #1a1a1a;
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    
    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid #2a2a2a;
    }
    
    .setting-row:last-child { border-bottom: none; }
    
    select, input[type="range"] {
      background: #2a2a2a;
      color: #fff;
      border: 1px solid #3a3a3a;
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 0.875rem;
    }
    
    input[type="range"] { width: 150px; }
    
    .exposures {
      background: #1a1a1a;
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    
    .exposures h3 {
      font-size: 1rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .exposure-list {
      display: grid;
      gap: 0.5rem;
    }
    
    .exposure-item {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem;
      background: #2a2a2a;
      border-radius: 8px;
      font-family: 'SF Mono', 'Monaco', monospace;
      font-size: 0.875rem;
    }
    
    .exposure-item:nth-child(1) { background: #374151; border: 2px solid #60a5fa; }
    
    .info-box {
      background: #1a1a1a;
      border-radius: 12px;
      padding: 1rem;
      font-size: 0.875rem;
      color: #9ca3af;
      line-height: 1.6;
    }
    
    .info-box strong { color: #fff; display: block; margin-bottom: 0.5rem; }
    .info-box ul { padding-left: 1.25rem; }
    .info-box li { margin: 0.25rem 0; }
    
    .mode-selector {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    
    .mode-btn {
      flex: 1;
      padding: 0.75rem;
      background: #2a2a2a;
      border: 2px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .mode-btn.active {
      background: #374151;
      border-color: #60a5fa;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚡ Posemètre Pro</h1>
    </header>

    <div class="mode-selector">
      <button class="mode-btn active" data-mode="spot">🎯 Spot</button>
      <button class="mode-btn" data-mode="matrix">⊞ Matriciel</button>
      <button class="mode-btn" data-mode="centerweight">◎ Pondéré centre</button>
    </div>

    <div class="video-container">
      <video id="video" autoplay playsinline></video>
      <canvas id="canvas"></canvas>
      <div class="measurement-zone"></div>
      <div class="histogram-overlay">
        <canvas id="histogram"></canvas>
      </div>
    </div>

    <div class="ev-display" id="evDisplay" style="display:none;">
      <div class="ev-label">Indice de Lumination</div>
      <div class="ev-value" id="evValue">--</div>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-value" id="avgLum">--</span>
          <span>Lum. moy.</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" id="contrast">--</span>
          <span>Contraste</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" id="quality">--</span>
          <span>Qualité</span>
        </div>
      </div>
    </div>

    <button class="btn-start" id="startBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>
      Démarrer la mesure
    </button>

    <div class="settings">
      <div class="setting-row">
        <span>ISO / Sensibilité</span>
        <select id="isoSelect">
          <option value="50">ISO 50</option>
          <option value="100">ISO 100</option>
          <option value="200">ISO 200</option>
          <option value="400" selected>ISO 400</option>
          <option value="800">ISO 800</option>
          <option value="1600">ISO 1600</option>
          <option value="3200">ISO 3200</option>
        </select>
      </div>
      <div class="setting-row">
        <span>Compensation EV</span>
        <input type="range" id="evComp" min="-3" max="3" step="0.3" value="0">
        <span id="evCompValue">0.0</span>
      </div>
    </div>

    <div class="exposures" id="exposures" style="display:none;">
      <h3>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Réglages équivalents
      </h3>
      <div class="exposure-list" id="exposureList"></div>
    </div>

    <div class="info-box">
      <strong>💡 Guide d'utilisation</strong>
      <ul>
        <li><strong>Spot:</strong> Mesure au centre (précis pour un sujet spécifique)</li>
        <li><strong>Matriciel:</strong> Analyse toute la scène (paysages)</li>
        <li><strong>Pondéré centre:</strong> Priorité centre + contexte</li>
        <li>Calibré selon la constante K=12.5 (norme ANSI/ISO)</li>
        <li>Formule: EV = log₂(L × S / K) où L=luminance cd/m²</li>
      </ul>
    </div>
  </div>

  <script>
    // État de l'application
    let state = {
      stream: null,
      measuring: false,
      mode: 'spot',
      iso: 400,
      evCompensation: 0,
      histogram: null
    };

    // Éléments DOM
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const startBtn = document.getElementById('startBtn');
    const evDisplay = document.getElementById('evDisplay');
    const evValue = document.getElementById('evValue');
    const avgLum = document.getElementById('avgLum');
    const contrast = document.getElementById('contrast');
    const quality = document.getElementById('quality');
    const exposures = document.getElementById('exposures');
    const exposureList = document.getElementById('exposureList');
    const isoSelect = document.getElementById('isoSelect');
    const evComp = document.getElementById('evComp');
    const evCompValue = document.getElementById('evCompValue');
    const histCanvas = document.getElementById('histogram');
    const histCtx = histCanvas.getContext('2d');

    // Configuration de l'histogramme
    histCanvas.width = histCanvas.parentElement.clientWidth;
    histCanvas.height = 64;

    // Sélection du mode de mesure
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
      });
    });

    // Gestion de l'ISO
    isoSelect.addEventListener('change', (e) => {
      state.iso = parseInt(e.target.value);
    });

    // Gestion de la compensation EV
    evComp.addEventListener('input', (e) => {
      state.evCompensation = parseFloat(e.target.value);
      evCompValue.textContent = state.evCompensation.toFixed(1);
    });

    // Démarrage de la caméra
    startBtn.addEventListener('click', async () => {
      if (!state.stream) {
        try {
          state.stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          });
          video.srcObject = state.stream;
          startBtn.innerHTML = '⏹ Arrêter';
          startBtn.classList.remove('btn-start');
          startBtn.classList.add('btn-stop');
          evDisplay.style.display = 'block';
          exposures.style.display = 'block';
          startMeasuring();
        } catch (err) {
          alert('Erreur caméra: ' + err.message);
        }
      } else {
        stopCamera();
      }
    });

    function stopCamera() {
      if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
        state.measuring = false;
        startBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg> Démarrer la mesure`;
        startBtn.classList.remove('btn-stop');
        startBtn.classList.add('btn-start');
      }
    }

    function startMeasuring() {
      state.measuring = true;
      measureLoop();
    }

    function measureLoop() {
      if (!state.measuring) return;
      
      measureLight();
      setTimeout(measureLoop, 200); // Mise à jour 5x/sec
    }

    function measureLight() {
      if (!video.videoWidth || !video.videoHeight) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = getRelevantImageData();
      if (!imageData) return;

      const data = imageData.data;
      
      // Calcul de la luminance avec pondération photométrique CIE
      const luminances = [];
      let totalLuminance = 0;
      const histogramData = new Array(256).fill(0);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Luminance relative selon CIE 1931
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        luminances.push(lum);
        totalLuminance += lum;
        
        // Histogramme
        const bin = Math.floor(lum);
        histogramData[bin]++;
      }

      const avgLuminance = totalLuminance / luminances.length;
      
      // Calcul de l'écart-type (contraste)
      const variance = luminances.reduce((sum, lum) => 
        sum + Math.pow(lum - avgLuminance, 2), 0) / luminances.length;
      const stdDev = Math.sqrt(variance);
      
      // Calcul EV avec constante de calibration K=12.5 (norme)
      // Formule: EV = log2((L * S) / K)
      // L en cd/m² (approximé depuis luminance relative)
      // Facteur de conversion empirique: 255 = ~2000 cd/m² en plein jour
      const luminanceInCdM2 = (avgLuminance / 255) * 2000;
      const calculatedEV = Math.log2((luminanceInCdM2 * state.iso) / 12.5);
      const finalEV = calculatedEV + state.evCompensation;

      // Mise à jour de l'affichage
      evValue.textContent = `EV ${finalEV.toFixed(1)}`;
      avgLum.textContent = avgLuminance.toFixed(0);
      contrast.textContent = (stdDev / avgLuminance * 100).toFixed(0) + '%';
      
      // Qualité de la mesure
      const qualityScore = calculateQuality(avgLuminance, stdDev);
      quality.textContent = qualityScore;

      // Calcul des expositions
      calculateExposures(finalEV);
      
      // Dessin de l'histogramme
      drawHistogram(histogramData, avgLuminance);
    }

    function getRelevantImageData() {
      const w = canvas.width;
      const h = canvas.height;

      if (state.mode === 'spot') {
        // Zone centrale 10%
        const size = Math.min(w, h) * 0.1;
        const x = (w - size) / 2;
        const y = (h - size) / 2;
        return ctx.getImageData(x, y, size, size);
      } else if (state.mode === 'matrix') {
        // Image complète
        return ctx.getImageData(0, 0, w, h);
      } else {
        // Pondéré centre: cercle central 60%
        const centerX = w / 2;
        const centerY = h / 2;
        const radius = Math.min(w, h) * 0.3;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = radius * 2;
        tempCanvas.height = radius * 2;
        tempCtx.drawImage(canvas, centerX - radius, centerY - radius, 
                         radius * 2, radius * 2, 0, 0, radius * 2, radius * 2);
        return tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      }
    }

    function calculateQuality(avgLum, stdDev) {
      // Qualité basée sur le niveau de lumière et le contraste
      if (avgLum < 20) return '❌ Trop sombre';
      if (avgLum > 240) return '❌ Surexposé';
      if (stdDev / avgLum < 0.1) return '⚠️ Faible contraste';
      if (avgLum > 60 && avgLum < 200 && stdDev / avgLum > 0.15) return '✅ Excellente';
      return '✓ Bonne';
    }

    function calculateExposures(ev) {
      const apertures = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
      const speeds = [
        { val: 1/8000, txt: '1/8000' },
        { val: 1/4000, txt: '1/4000' },
        { val: 1/2000, txt: '1/2000' },
        { val: 1/1000, txt: '1/1000' },
        { val: 1/500, txt: '1/500' },
        { val: 1/250, txt: '1/250' },
        { val: 1/125, txt: '1/125' },
        { val: 1/60, txt: '1/60' },
        { val: 1/30, txt: '1/30' },
        { val: 1/15, txt: '1/15' },
        { val: 1/8, txt: '1/8' },
        { val: 1/4, txt: '1/4' },
        { val: 1/2, txt: '1/2' },
        { val: 1, txt: '1"' },
        { val: 2, txt: '2"' },
        { val: 4, txt: '4"' },
        { val: 8, txt: '8"' }
      ];

      const combinations = [];

      apertures.forEach(N => {
        // EV = log2(N²/t) → t = N²/2^EV
        const t = (N * N) / Math.pow(2, ev);
        
        // Trouver la vitesse la plus proche
        let closest = speeds[0];
        let minDiff = Math.abs(Math.log2(closest.val) - Math.log2(t));

        speeds.forEach(speed => {
          const diff = Math.abs(Math.log2(speed.val) - Math.log2(t));
          if (diff < minDiff) {
            minDiff = diff;
            closest = speed;
          }
        });

        combinations.push({
          aperture: `f/${N}`,
          shutter: closest.txt
        });
      });

      // Affichage
      exposureList.innerHTML = combinations.map((exp, i) => `
        <div class="exposure-item">
          <span>${exp.aperture}</span>
          <span>${exp.shutter}</span>
        </div>
      `).join('');
    }

    function drawHistogram(data, avgLum) {
      const w = histCanvas.width;
      const h = histCanvas.height;
      
      histCtx.clearRect(0, 0, w, h);
      
      const max = Math.max(...data);
      const barWidth = w / 256;
      
      // Dessin de l'histogramme
      histCtx.fillStyle = '#60a5fa';
      for (let i = 0; i < 256; i++) {
        const barHeight = (data[i] / max) * h * 0.9;
        histCtx.fillRect(i * barWidth, h - barHeight, barWidth, barHeight);
      }
      
      // Ligne de moyenne
      histCtx.strokeStyle = '#f59e0b';
      histCtx.lineWidth = 2;
      histCtx.beginPath();
      histCtx.moveTo((avgLum / 255) * w, 0);
      histCtx.lineTo((avgLum / 255) * w, h);
      histCtx.stroke();
    }

    // Nettoyage à la fermeture
    window.addEventListener('beforeunload', stopCamera);
  </script>
</body>
</html>