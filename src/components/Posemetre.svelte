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
					width: { ideal: 640 },
					height: { ideal: 480 }
				}
			};

			stream = await navigator.mediaDevices.getUserMedia(constraints);
			if (videoElement) {
				videoElement.srcObject = stream;
				await videoElement.play();
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
	}

	function startMeasurement() {
		if (!canvas || !videoElement) return;
		
		measurementInterval = setInterval(() => {
			measureBrightness();
		}, 200); // Mesure toutes les 200ms
	}

	function stopMeasurement() {
		if (measurementInterval) {
			clearInterval(measurementInterval);
			measurementInterval = null;
		}
	}

	function measureBrightness() {
		if (!videoElement || !canvas || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
			return;
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		
		canvas.width = videoElement.videoWidth;
		canvas.height = videoElement.videoHeight;
		
		ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
		
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = imageData.data;
		
		// Calculer la luminance moyenne (pondérée selon la perception humaine)
		let totalLuminance = 0;
		let pixelCount = 0;
		
		// Échantillonner tous les 4 pixels pour une meilleure précision
		for (let i = 0; i < data.length; i += 4) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			
			// Formule de luminance relative (0-255)
			const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
			totalLuminance += luminance;
			pixelCount++;
		}
		
		const avgLuminance = totalLuminance / pixelCount;
		
		// Normaliser pour l'affichage (0-1)
		measuredBrightness = avgLuminance / 255;
		
		// Convertir la luminance en valeur EV
		// Formule ajustée pour correspondre aux conditions réelles
		// La constante 12.5 est ajustée pour calibrer avec les caméras mobiles
		// Ajout de 2 points pour corriger le décalage observé
		// EV = log2(luminance / constante) + offset
		// Pour une meilleure précision, on utilise une constante plus petite et on ajoute un offset
		const calculatedEv = Math.log2(avgLuminance / 3.125) + 4;
		
		// S'assurer que l'EV est valide (pas NaN ou Infinity)
		if (isFinite(calculatedEv)) {
			measuredEV = calculatedEv;
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
		{ value: 4, display: '4"' }
	];

	function calculateExposures(evValue) {
		const combinations = [];
		// Ajuster l'EV selon l'ISO : EV_iso = EV - log2(ISO/100)
		const targetEv = evValue - Math.log2(iso / 100);

		apertures.forEach(aperture => {
			// EV = log2(N²/t) où N = ouverture, t = temps
			// Donc t = N² / 2^EV
			const requiredTime = (aperture * aperture) / Math.pow(2, targetEv);
			
			// Trouve la vitesse la plus proche
			let closestSpeed = shutterSpeeds[0];
			let minDiff = Math.abs(closestSpeed.value - requiredTime);

			shutterSpeeds.forEach(speed => {
				const diff = Math.abs(speed.value - requiredTime);
				if (diff < minDiff) {
					minDiff = diff;
					closestSpeed = speed;
				}
			});

			combinations.push({
				aperture: `f/${aperture}`,
				shutter: closestSpeed.display
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

	// Recalculer les combinaisons quand l'ISO ou l'EV change
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

	{#if showSettings}
		<div class="settings-panel">
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
				<div class="measure-zone"></div>
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

	.settings-panel {
		margin-bottom: 1rem;
		padding: 1rem;
		border: 1px solid #333333;
	}

	.settings-panel label {
		display: block;
		font-size: 0.85rem;
		color: #888888;
		margin-bottom: 0.5rem;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.iso-select {
		width: 100%;
		padding: 0.75rem;
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
		width: 30%;
		height: 30%;
		border: 2px solid rgba(255, 255, 255, 0.5);
		pointer-events: none;
		z-index: 10;
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
	}
</style>
