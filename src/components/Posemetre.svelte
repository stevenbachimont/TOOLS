<script>
	import { onMount, onDestroy } from 'svelte';

	let useCamera = false;
	let stream = null;
	let videoElement;
	let canvas;
	let cameraError = null;
	let measuredBrightness = 0;
	let measuredEV = 0;
	let measurementInterval = null;
	let iso = 400;
	let showSettings = false;
	let exposures = [];
	let showMeasureZone = true;
	let measureMode = 'spot'; // 'spot', 'matrix', 'centerweight'
	let evCompensation = 0;
	let avgLuminance = 0;
	let contrast = 0;
	let quality = '';
	let cameraExposure = 0; // Compensation d'exposition de la caméra (-2 à +2)
	let highlightSaturation = 0; // Pourcentage de pixels saturés
	let imageCapture = null;

	async function startCamera() {
		try {
			cameraError = null;
			
			// Vérifier que l'API est disponible
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				cameraError = 'L\'accès à la caméra nécessite HTTPS ou localhost.';
				console.error('navigator.mediaDevices non disponible');
				useCamera = false;
				return;
			}
			
			const constraints = {
				video: {
					facingMode: 'environment',
					width: { ideal: 1920 },
					height: { ideal: 1080 },
					// Contraintes pour améliorer la capture des hautes lumières
					exposureMode: 'manual', // Mode manuel si supporté
					exposureCompensation: cameraExposure,
					whiteBalanceMode: 'auto'
				}
			};

			stream = await navigator.mediaDevices.getUserMedia(constraints);
			if (videoElement) {
				videoElement.srcObject = stream;
				await videoElement.play();
				
				// Essayer d'utiliser ImageCapture API pour un meilleur contrôle
				if (window.ImageCapture && stream.getVideoTracks().length > 0) {
					try {
						imageCapture = new ImageCapture(stream.getVideoTracks()[0]);
						// L'exposition sera ajustée via applyCameraSettings
						await applyCameraSettings();
					} catch (e) {
						console.log('ImageCapture API non disponible:', e);
					}
				}
				
				startMeasurement();
			}
		} catch (error) {
			cameraError = 'Impossible d\'accéder à la caméra. Vérifiez les permissions.';
			console.error('Erreur caméra:', error);
			useCamera = false;
		}
	}

	function stopCamera() {
		stopMeasurement();
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
			stream = null;
		}
		if (videoElement) {
			videoElement.srcObject = null;
		}
		useCamera = false;
		measuredEV = 0;
		measuredBrightness = 0;
		avgLuminance = 0;
		contrast = 0;
		quality = '';
		exposures = [];
	}

	function startMeasurement() {
		if (!canvas || !videoElement) return;
		
		measurementInterval = setInterval(() => {
			measureLight();
		}, 200); // Mesure toutes les 200ms
	}

	function stopMeasurement() {
		if (measurementInterval) {
			clearInterval(measurementInterval);
			measurementInterval = null;
		}
	}

	function getRelevantImageData(ctx, w, h) {
		if (measureMode === 'spot') {
			// Zone centrale 10%
			const size = Math.min(w, h) * 0.1;
			const x = (w - size) / 2;
			const y = (h - size) / 2;
			return ctx.getImageData(x, y, size, size);
		} else if (measureMode === 'matrix') {
			// Image complète
			return ctx.getImageData(0, 0, w, h);
		} else {
			// Pondéré centre: zone centrale 30%
			const size = Math.min(w, h) * 0.3;
			const x = (w - size) / 2;
			const y = (h - size) / 2;
			return ctx.getImageData(x, y, size, size);
		}
	}

	function calculateQuality(avgLum, stdDev) {
		if (avgLum < 20) return 'Trop sombre';
		if (avgLum > 240) return 'Surexposé';
		if (stdDev / avgLum < 0.1) return 'Faible contraste';
		if (avgLum > 60 && avgLum < 200 && stdDev / avgLum > 0.15) return 'Excellente';
		return 'Bonne';
	}

	function measureLight() {
		if (!videoElement || !canvas || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
			return;
		}

		if (!videoElement.videoWidth || !videoElement.videoHeight) return;

		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;
		
		canvas.width = videoElement.videoWidth;
		canvas.height = videoElement.videoHeight;
		
		ctx.drawImage(videoElement, 0, 0);
		
		const imageData = getRelevantImageData(ctx, canvas.width, canvas.height);
		if (!imageData) return;

		const data = imageData.data;
		
		// Calcul de la luminance avec pondération photométrique CIE 1931
		const luminances = [];
		let totalLuminance = 0;
		let saturatedPixels = 0; // Compteur de pixels saturés (255)

		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			
			// Détecter les pixels saturés (au moins un canal à 255)
			if (r >= 254 || g >= 254 || b >= 254) {
				saturatedPixels++;
			}
			
			// Luminance relative selon CIE 1931
			const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			luminances.push(lum);
			totalLuminance += lum;
		}

		// Calculer le pourcentage de pixels saturés
		highlightSaturation = (saturatedPixels / (data.length / 4)) * 100;

		const avgLum = totalLuminance / luminances.length;
		avgLuminance = avgLum;
		
		// Calcul de l'écart-type (contraste)
		const variance = luminances.reduce((sum, lum) => 
			sum + Math.pow(lum - avgLum, 2), 0) / luminances.length;
		const stdDev = Math.sqrt(variance);
		contrast = (stdDev / avgLum * 100);
		
		// Qualité de la mesure
		quality = calculateQuality(avgLum, stdDev);
		
		// Normaliser pour l'affichage (0-1)
		measuredBrightness = avgLum / 255;
		
		// Calcul EV avec constante de calibration K=12.5 (norme ANSI/ISO)
		// Formule: EV = log2((L * S) / K)
		// L en cd/m² (approximé depuis luminance relative)
		// Facteur de conversion empirique: 255 = ~1000 cd/m² en plein jour
		// Ajusté pour corriger la surestimation
		// Compensation pour l'exposition de la caméra
		const exposureMultiplier = Math.pow(2, -cameraExposure); // Inverser la compensation
		const luminanceInCdM2 = ((avgLum / 255) * 2000) / 500 * exposureMultiplier;
		const calculatedEV = Math.log2((luminanceInCdM2 * iso) / 10);
		const finalEV = calculatedEV + evCompensation;
		
		// S'assurer que l'EV est valide (pas NaN ou Infinity)
		if (isFinite(finalEV)) {
			measuredEV = finalEV;
		} else {
			measuredEV = 0;
		}
		
		// Calculer les combinaisons d'exposition
		if (measuredEV !== 0) {
			calculateExposures(measuredEV);
		}
	}

	const apertures = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
	const shutterSpeeds = [
		{ value: 1/8000, display: '1/8000' },
		{ value: 1/4000, display: '1/4000' },
		{ value: 1/2000, display: '1/2000' },
		{ value: 1/1000, display: '1/1000' },
		{ value: 1/500, display: '1/500' },
		{ value: 1/250, display: '1/250' },
		{ value: 1/125, display: '1/125' },
		{ value: 1/60, display: '1/60' },
		{ value: 1/30, display: '1/30' },
		{ value: 1/15, display: '1/15' },
		{ value: 1/8, display: '1/8' },
		{ value: 1/4, display: '1/4' },
		{ value: 1/2, display: '1/2' },
		{ value: 1, display: '1"' },
		{ value: 2, display: '2"' },
		{ value: 4, display: '4"' },
		{ value: 8, display: '8"' }
	];

	function calculateExposures(ev) {
		const combinations = [];

		apertures.forEach(N => {
			// EV = log2(N²/t) → t = N²/2^EV
			const t = (N * N) / Math.pow(2, ev);
			
			// Trouver la vitesse la plus proche (comparaison en log2 pour plus de précision)
			let closest = shutterSpeeds[0];
			let minDiff = Math.abs(Math.log2(closest.value) - Math.log2(t));

			shutterSpeeds.forEach(speed => {
				const diff = Math.abs(Math.log2(speed.value) - Math.log2(t));
				if (diff < minDiff) {
					minDiff = diff;
					closest = speed;
				}
			});

			combinations.push({
				aperture: `f/${N}`,
				shutter: closest.display
			});
		});

		exposures = combinations;
	}

	function toggleSettings() {
		showSettings = !showSettings;
	}

	function toggleMeasureZone() {
		showMeasureZone = !showMeasureZone;
	}

	function setMeasureMode(mode) {
		measureMode = mode;
	}

	async function applyCameraSettings() {
		if (!stream || !imageCapture) return;
		
		try {
			const capabilities = await imageCapture.getPhotoCapabilities();
			if (capabilities && capabilities.exposureCompensation) {
				const min = capabilities.exposureCompensation.min || -2;
				const max = capabilities.exposureCompensation.max || 2;
				const step = capabilities.exposureCompensation.step || 0.1;
				
				// Limiter la valeur dans la plage supportée
				const exposureValue = Math.max(min, Math.min(max, cameraExposure));
				
				await imageCapture.setOptions({
					exposureCompensation: exposureValue
				});
			}
		} catch (e) {
			console.log('Impossible d\'ajuster l\'exposition de la caméra:', e);
		}
	}

	// Réappliquer les réglages quand l'exposition change
	$: if (cameraExposure !== undefined && stream) {
		applyCameraSettings();
	}

	// Recalculer les combinaisons quand l'ISO ou la compensation EV change
	$: if (measuredEV !== 0 && iso) {
		calculateExposures(measuredEV);
	}

	onMount(async () => {
		useCamera = true;
		await startCamera();
	});

	onDestroy(() => {
		stopCamera();
	});
</script>

<div class="posemetre-container">
	<div class="controls-header">
		<button class="settings-btn" on:click={toggleSettings}>
			Réglages
		</button>
		<button class="zone-btn" on:click={toggleMeasureZone} class:active={showMeasureZone}>
			Zone de mesure
		</button>
	</div>

	<div class="mode-selector">
		<button 
			class="mode-btn" 
			class:active={measureMode === 'spot'}
			on:click={() => setMeasureMode('spot')}
		>
			Spot
		</button>
		<button 
			class="mode-btn" 
			class:active={measureMode === 'matrix'}
			on:click={() => setMeasureMode('matrix')}
		>
			Matriciel
		</button>
		<button 
			class="mode-btn" 
			class:active={measureMode === 'centerweight'}
			on:click={() => setMeasureMode('centerweight')}
		>
			Pondéré centre
		</button>
	</div>

	{#if showSettings}
		<div class="settings-panel">
			<div class="setting-row">
				<label for="iso-select">ISO / Sensibilité</label>
				<select id="iso-select" bind:value={iso} class="iso-select">
					<option value="50">ISO 50</option>
					<option value="100">ISO 100</option>
					<option value="200">ISO 200</option>
					<option value="400">ISO 400</option>
					<option value="800">ISO 800</option>
					<option value="1600">ISO 1600</option>
					<option value="3200">ISO 3200</option>
				</select>
			</div>
			<div class="setting-row">
				<label for="ev-comp">Compensation EV</label>
				<div class="ev-comp-control">
					<input 
						type="range" 
						id="ev-comp" 
						min="-3" 
						max="3" 
						step="0.3" 
						bind:value={evCompensation}
						class="ev-comp-slider"
					/>
					<span class="ev-comp-value">{evCompensation > 0 ? '+' : ''}{evCompensation.toFixed(1)}</span>
				</div>
			</div>
			<div class="setting-row">
				<label for="cam-exposure">Exposition caméra</label>
				<div class="ev-comp-control">
					<input 
						type="range" 
						id="cam-exposure" 
						min="-2" 
						max="2" 
						step="0.1" 
						bind:value={cameraExposure}
						class="ev-comp-slider"
					/>
					<span class="ev-comp-value">{cameraExposure > 0 ? '+' : ''}{cameraExposure.toFixed(1)}</span>
				</div>
				<div class="setting-hint">
					Réduire pour mieux mesurer les hautes lumières
				</div>
			</div>
		</div>
	{/if}

	{#if useCamera && measuredBrightness > 0}
		<div class="brightness-indicator">
			<div class="brightness-label">Luminosité: {(measuredBrightness * 100).toFixed(1)}%</div>
			<div class="brightness-bar">
				<div 
					class="brightness-fill" 
					style="width: {measuredBrightness * 100}%"
				></div>
			</div>
		</div>
	{/if}

	{#if useCamera}
		<div class="video-preview">
			<video
				bind:this={videoElement}
				autoplay
				playsinline
				muted
				class="camera-video"
			></video>
			<canvas bind:this={canvas} style="display: none;"></canvas>
			{#if showMeasureZone}
				<div class="measure-zone" class:spot={measureMode === 'spot'} class:centerweight={measureMode === 'centerweight'}></div>
			{/if}
		</div>
		{#if cameraError}
			<div class="error-message">
				{cameraError}
			</div>
		{/if}
	{/if}

	<div class="ev-display">
		<div class="ev-value">
			{#if useCamera && measuredEV !== 0}
				EV {measuredEV.toFixed(1)}
			{:else}
				--
			{/if}
		</div>
		<div class="ev-label">
			{#if useCamera && measuredEV !== 0}
				ISO {iso}
			{:else if cameraError}
				{cameraError}
			{:else}
				Initialisation...
			{/if}
		</div>
		{#if useCamera && measuredEV !== 0 && (avgLuminance > 0 || contrast > 0 || quality)}
			<div class="stats">
				<div class="stat-item">
					<span class="stat-value">{avgLuminance.toFixed(0)}</span>
					<span class="stat-label">Lum. moy.</span>
				</div>
				<div class="stat-item">
					<span class="stat-value">{contrast.toFixed(0)}%</span>
					<span class="stat-label">Contraste</span>
				</div>
				<div class="stat-item">
					<span class="stat-value">{quality}</span>
					<span class="stat-label">Qualité</span>
				</div>
			</div>
			{#if highlightSaturation > 5}
				<div class="saturation-warning">
					⚠️ {highlightSaturation.toFixed(1)}% de pixels saturés - Réduire l'exposition caméra
				</div>
			{/if}
		{/if}
	</div>

	{#if exposures.length > 0}
		<div class="exposures-panel">
			<div class="exposures-title">Réglages recommandés</div>
			<div class="exposures-list">
				{#each exposures.slice(0, 9) as exp}
					<div class="exposure-item">
						<span class="exposure-aperture">{exp.aperture}</span>
						<span class="exposure-shutter">{exp.shutter}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.posemetre-container {
		background: transparent;
		padding: 0;
		max-width: 100%;
	}

	.controls-header {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.settings-btn,
	.zone-btn {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid #333333;
		background: transparent;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 300;
		color: #888888;
		transition: all 0.2s ease;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.settings-btn:active,
	.zone-btn:active {
		opacity: 0.7;
	}

	.zone-btn.active {
		border-color: #ffffff;
		color: #ffffff;
	}

	.mode-selector {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.mode-btn {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #333333;
		background: transparent;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 300;
		color: #888888;
		transition: all 0.2s ease;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mode-btn.active {
		border-color: #ffffff;
		color: #ffffff;
	}

	.mode-btn:active {
		opacity: 0.7;
	}

	.settings-panel {
		margin-bottom: 1rem;
		padding: 1rem;
		border: 1px solid #333333;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0;
		border-bottom: 1px solid #333333;
	}

	.setting-row:last-child {
		border-bottom: none;
	}

	.setting-row label {
		font-size: 0.85rem;
		color: #888888;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.setting-hint {
		font-size: 0.75rem;
		color: #666666;
		font-weight: 300;
		margin-top: 0.25rem;
		font-style: italic;
	}

	.iso-select {
		padding: 0.5rem;
		border: 1px solid #333333;
		border-radius: 0;
		font-size: 0.9rem;
		background: #000000;
		color: #ffffff;
		cursor: pointer;
	}

	.iso-select:focus {
		outline: none;
		border-color: #ffffff;
	}

	.ev-comp-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ev-comp-slider {
		width: 150px;
		height: 4px;
		background: #333333;
		border-radius: 0;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}

	.ev-comp-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		background: #ffffff;
		cursor: pointer;
		border-radius: 0;
	}

	.ev-comp-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #ffffff;
		cursor: pointer;
		border-radius: 0;
		border: none;
	}

	.ev-comp-value {
		font-size: 0.9rem;
		color: #ffffff;
		min-width: 40px;
		text-align: right;
	}

	.brightness-indicator {
		margin-bottom: 1rem;
	}

	.brightness-label {
		font-size: 0.85rem;
		color: #888888;
		margin-bottom: 0.5rem;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.brightness-bar {
		width: 100%;
		height: 2px;
		background: #333333;
		overflow: hidden;
	}

	.brightness-fill {
		height: 100%;
		background: #ffffff;
		transition: width 0.3s ease;
	}

	.video-preview {
		width: 100%;
		aspect-ratio: 4/3;
		background: #000;
		border: 1px solid #333333;
		overflow: hidden;
		margin-bottom: 1.5rem;
		position: relative;
	}

	.camera-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.measure-zone {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border: 2px solid rgba(255, 255, 255, 0.5);
		pointer-events: none;
		z-index: 10;
	}

	.measure-zone.spot {
		width: 10%;
		height: 10%;
	}

	.measure-zone.centerweight {
		width: 30%;
		height: 30%;
	}

	.error-message {
		background: transparent;
		color: #ffffff;
		padding: 1rem;
		border: 1px solid #333333;
		margin-bottom: 1.5rem;
		text-align: center;
		font-weight: 300;
	}

	.ev-display {
		text-align: center;
		padding: 2rem 1.5rem;
		background: transparent;
		border: 1px solid #333333;
		color: #ffffff;
		min-height: 150px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.ev-value {
		font-size: 4rem;
		font-weight: 300;
		line-height: 1;
		margin-bottom: 0.5rem;
		letter-spacing: 0.05em;
	}

	.ev-label {
		font-size: 0.85rem;
		color: #888888;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 1rem;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-top: 1rem;
		width: 100%;
	}

	.stat-item {
		text-align: center;
		padding: 0.5rem;
		border: 1px solid #333333;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-weight: 300;
		color: #ffffff;
		font-size: 0.9rem;
	}

	.stat-label {
		font-size: 0.7rem;
		color: #888888;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.saturation-warning {
		margin-top: 1rem;
		padding: 0.75rem;
		border: 1px solid #ffaa00;
		color: #ffaa00;
		font-size: 0.85rem;
		text-align: center;
		font-weight: 300;
	}

	.exposures-panel {
		margin-top: 1.5rem;
		border: 1px solid #333333;
		padding: 1rem;
	}

	.exposures-title {
		font-size: 0.85rem;
		color: #888888;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 1rem;
	}

	.exposures-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.exposure-item {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem;
		border: 1px solid #333333;
		font-size: 0.9rem;
	}

	.exposure-item:first-child {
		border-color: #ffffff;
	}

	.exposure-aperture {
		font-weight: 300;
		color: #ffffff;
	}

	.exposure-shutter {
		font-weight: 300;
		color: #ffffff;
	}

	@media (max-width: 480px) {
		.posemetre-container {
			padding: 0;
		}

		.ev-value {
			font-size: 3rem;
		}

		.ev-display {
			padding: 1.5rem 1rem;
			min-height: 120px;
		}

		.mode-selector {
			flex-direction: column;
		}

		.setting-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.ev-comp-control {
			width: 100%;
		}

		.ev-comp-slider {
			flex: 1;
		}
	}
</style>
