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

	async function startCamera() {
		try {
			cameraError = null;
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
		
		// Calculer la luminosité moyenne (méthode de luminance relative)
		let sum = 0;
		let count = 0;
		
		// Échantillonner tous les 4 pixels pour améliorer les performances
		for (let i = 0; i < data.length; i += 16) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			
			// Formule de luminance relative (0-1)
			const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
			sum += luminance;
			count++;
		}
		
		measuredBrightness = sum / count;
		
		// Convertir la luminosité en valeur EV
		// La formule approximative : EV = log2(luminance * constante)
		// Pour une exposition correcte à ISO 100, f/1.0, 1s : EV = log2(luminance * 250)
		const baseEV = Math.log2(measuredBrightness * 250);
		measuredEV = baseEV;
	}

	async function toggleCamera() {
		if (useCamera) {
			stopCamera();
		} else {
			useCamera = true;
			await startCamera();
		}
	}

	onDestroy(() => {
		stopCamera();
	});
</script>

<div class="posemetre-container">
	<div class="camera-control">
		<button 
			class="camera-toggle-btn" 
			class:active={useCamera}
			on:click={toggleCamera}
		>
			{#if useCamera}
				Mesure en cours
			{:else}
				Activer la mesure caméra
			{/if}
		</button>
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
	</div>

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
				Mesure en temps réel
			{:else}
				Activez la caméra pour mesurer
			{/if}
		</div>
	</div>
</div>

<style>
	.posemetre-container {
		background: transparent;
		padding: 0;
		max-width: 100%;
	}

	.camera-control {
		margin-bottom: 1.5rem;
	}

	.camera-toggle-btn {
		width: 100%;
		padding: 1rem;
		border: 1px solid #ffffff;
		background: transparent;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 300;
		color: #ffffff;
		transition: all 0.2s ease;
		margin-bottom: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.camera-toggle-btn.active {
		background: #ffffff;
		color: #000000;
	}

	.camera-toggle-btn:active {
		opacity: 0.7;
	}

	.brightness-indicator {
		margin-top: 0.75rem;
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
