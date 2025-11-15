<script>
	import { onMount, onDestroy } from 'svelte';

	let stream = null;
	let videoElement;
	let canvas;
	let previewCanvas;
	let previewCtx;
	let capturedImage = null;
	let isCapturing = false;
	let cameraError = null;
	let selectedCamera = null;
	let availableCameras = [];
	let showGrid = true;
	let showGuidelines = true;
	let invertColors = true; // Par défaut activé pour les négatifs
	let blackAndWhite = false;
	let animationFrame = null;
	let selectedFormat = '6x6';

	const formats = [
		{ id: '6x6', label: '6x6', aspectRatio: 1 },
		{ id: '6x7', label: '6x7', aspectRatio: 7/6 },
		{ id: '6x9', label: '6x9', aspectRatio: 9/6 },
		{ id: '135', label: '135', aspectRatio: 3/2 }
	];

	function getAspectRatio() {
		const format = formats.find(f => f.id === selectedFormat);
		return format ? format.aspectRatio : 1;
	}

	onMount(async () => {
		await loadCameras();
	});

	onDestroy(() => {
		stopCamera();
	});

	async function loadCameras() {
		try {
			// Vérifier que l'API est disponible
			if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
				console.warn('navigator.mediaDevices non disponible - nécessite HTTPS ou localhost');
				return;
			}
			
			const devices = await navigator.mediaDevices.enumerateDevices();
			availableCameras = devices
				.filter(device => device.kind === 'videoinput')
				.map(device => ({
					id: device.deviceId,
					label: device.label || `Caméra ${availableCameras.length + 1}`
				}));
			
			if (availableCameras.length > 0 && !selectedCamera) {
				selectedCamera = availableCameras[0].id;
			}
		} catch (error) {
			console.error('Erreur lors du chargement des caméras:', error);
		}
	}

	async function startCamera() {
		try {
			cameraError = null;
			
			// Vérifier que l'API est disponible
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				cameraError = 'L\'accès à la caméra nécessite HTTPS ou localhost.';
				console.error('navigator.mediaDevices non disponible');
				return;
			}
			
			const constraints = {
				video: {
					deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
					facingMode: 'environment',
					width: { ideal: 1920 },
					height: { ideal: 1080 }
				}
			};

			stream = await navigator.mediaDevices.getUserMedia(constraints);
			if (videoElement) {
				videoElement.srcObject = stream;
				await videoElement.play();
				startPreview();
			}
		} catch (error) {
			cameraError = 'Impossible d\'accéder à la caméra. Vérifiez les permissions.';
			console.error('Erreur caméra:', error);
		}
	}

	function startPreview() {
		if (!videoElement || !previewCanvas) return;
		
		previewCtx = previewCanvas.getContext('2d');
		
		function updatePreview() {
			if (!videoElement || !previewCanvas || !previewCtx) return;
			
			if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
				const aspectRatio = getAspectRatio();
				const videoWidth = videoElement.videoWidth;
				const videoHeight = videoElement.videoHeight;
				const videoAspect = videoWidth / videoHeight;
				
				// Calculer les dimensions du recadrage selon le format
				let cropWidth, cropHeight, cropX, cropY;
				
				if (videoAspect > aspectRatio) {
					// La vidéo est plus large que le format, recadrer la largeur
					cropHeight = videoHeight;
					cropWidth = cropHeight * aspectRatio;
					cropX = (videoWidth - cropWidth) / 2;
					cropY = 0;
				} else {
					// La vidéo est plus haute que le format, recadrer la hauteur
					cropWidth = videoWidth;
					cropHeight = cropWidth / aspectRatio;
					cropX = 0;
					cropY = (videoHeight - cropHeight) / 2;
				}
				
				// Ajuster la taille du canvas au format recadré
				previewCanvas.width = cropWidth;
				previewCanvas.height = cropHeight;
				
				// Dessiner la partie recadrée de la vidéo
				previewCtx.drawImage(
					videoElement,
					cropX, cropY, cropWidth, cropHeight,  // Source (vidéo)
					0, 0, cropWidth, cropHeight           // Destination (canvas)
				);
				
				// Récupérer les données de l'image
				const imageData = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
				const data = imageData.data;
				
				// Appliquer les transformations en temps réel
				for (let i = 0; i < data.length; i += 4) {
					let r = data[i];
					let g = data[i + 1];
					let b = data[i + 2];
					
					// Inverser les couleurs pour les négatifs
					if (invertColors) {
						r = 255 - r;
						g = 255 - g;
						b = 255 - b;
					}
					
					// Convertir en noir et blanc si activé
					if (blackAndWhite) {
						// Utiliser la formule de luminance pour convertir en niveaux de gris
						const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
						r = gray;
						g = gray;
						b = gray;
					}
					
					data[i] = r;
					data[i + 1] = g;
					data[i + 2] = b;
				}
				
				// Réappliquer les données transformées
				previewCtx.putImageData(imageData, 0, 0);
			}
			
			animationFrame = requestAnimationFrame(updatePreview);
		}
		
		updatePreview();
	}

	function stopPreview() {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
	}

	function stopCamera() {
		stopPreview();
		if (stream) {
			stream.getTracks().forEach(track => track.stop());
			stream = null;
		}
		if (videoElement) {
			videoElement.srcObject = null;
		}
		if (previewCanvas && previewCtx) {
			previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
		}
	}

	function capturePhoto() {
		if (!previewCanvas || !canvas) return;

		isCapturing = true;
		
		const ctx = canvas.getContext('2d');
		
		// Le canvas de prévisualisation est déjà recadré au bon format
		canvas.width = previewCanvas.width;
		canvas.height = previewCanvas.height;
		
		// Copier l'image déjà transformée et recadrée du canvas de prévisualisation
		ctx.drawImage(previewCanvas, 0, 0);
		
		canvas.toBlob((blob) => {
			capturedImage = URL.createObjectURL(blob);
			isCapturing = false;
		}, 'image/jpeg', 0.95);
	}

	async function downloadImage() {
		if (!capturedImage) return;
		
		// Essayer d'utiliser Web Share API sur mobile (iOS/Android)
		if (navigator.share && navigator.canShare) {
			try {
				// Convertir l'image en blob pour le partage
				const response = await fetch(capturedImage);
				const blob = await response.blob();
				const file = new File([blob], `photo-argentique-${Date.now()}.jpg`, { type: 'image/jpeg' });
				
				if (navigator.canShare({ files: [file] })) {
					await navigator.share({
						files: [file],
						title: 'Photo argentique',
						text: 'Photo numérisée'
					});
					return;
				}
			} catch (error) {
				// Si le partage échoue, continuer avec la méthode de téléchargement classique
				console.log('Web Share API non disponible, utilisation du téléchargement classique');
			}
		}
		
		// Méthode de téléchargement classique (fonctionne aussi sur mobile)
		const link = document.createElement('a');
		link.href = capturedImage;
		link.download = `photo-argentique-${Date.now()}.jpg`;
		
		// Pour iOS Safari, il faut ajouter le lien au DOM temporairement
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		
		// Sur Android, essayer d'ouvrir dans un nouvel onglet pour permettre l'enregistrement
		if (/Android/i.test(navigator.userAgent)) {
			window.open(capturedImage, '_blank');
		}
	}

	function resetCapture() {
		capturedImage = null;
	}

	function toggleGrid() {
		showGrid = !showGrid;
	}

	function toggleGuidelines() {
		showGuidelines = !showGuidelines;
	}
</script>

<div class="numerisation-container">
	{#if !capturedImage}
		<div class="camera-section">
			<div class="format-selector">
				<label for="format-select">Format</label>
				<select id="format-select" bind:value={selectedFormat} class="format-select">
					{#each formats as format}
						<option value={format.id}>{format.label}</option>
					{/each}
				</select>
			</div>

			<div class="camera-controls">
				<button class="control-btn" on:click={toggleGrid} class:active={showGrid}>
					Grille
				</button>
				<button class="control-btn" on:click={toggleGuidelines} class:active={showGuidelines}>
					Guides
				</button>
				{#if availableCameras.length > 1}
					<select bind:value={selectedCamera} class="camera-select" on:change={async () => {
						stopCamera();
						await startCamera();
					}}>
						{#each availableCameras as camera}
							<option value={camera.id}>{camera.label}</option>
						{/each}
					</select>
				{/if}
			</div>
			
			<div class="negative-controls">
				<button 
					class="control-btn negative-btn" 
					on:click={() => invertColors = !invertColors} 
					class:active={invertColors}
				>
					Inverser
				</button>
				<button 
					class="control-btn bw-btn" 
					on:click={() => blackAndWhite = !blackAndWhite} 
					class:active={blackAndWhite}
				>
					Noir & Blanc
				</button>
			</div>

			<div class="video-container" style="aspect-ratio: {getAspectRatio()};">
				<video
					bind:this={videoElement}
					autoplay
					playsinline
					muted
					style="display: none;"
				></video>
				<canvas
					bind:this={previewCanvas}
					class="preview-canvas"
				></canvas>
				{#if showGrid || showGuidelines}
					<div class="overlay" class:show-grid={showGrid} class:show-guidelines={showGuidelines}></div>
				{/if}
				<canvas bind:this={canvas} style="display: none;"></canvas>
			</div>

			{#if cameraError}
				<div class="error-message">
					{cameraError}
				</div>
			{/if}

			<div class="capture-controls">
				{#if !stream}
					<button class="start-btn" on:click={startCamera}>
						Démarrer la caméra
					</button>
				{:else}
					<button class="capture-btn" on:click={capturePhoto} disabled={isCapturing}>
						{#if isCapturing}
							Capture...
						{:else}
							Capturer
						{/if}
					</button>
					<button class="stop-btn" on:click={stopCamera}>
						Arrêter
					</button>
				{/if}
			</div>
		</div>
	{:else}
		<div class="preview-section">
			<div class="preview-image" style="aspect-ratio: {getAspectRatio()};">
				<img src={capturedImage} alt="Photo capturée" />
			</div>
			<div class="preview-info">
				{#if invertColors}
					<div class="info-badge active">
						Négatif inversé
					</div>
				{/if}
				{#if blackAndWhite}
					<div class="info-badge active">
						Noir & Blanc
					</div>
				{/if}
			</div>
			<div class="preview-controls">
				<button class="download-btn" on:click={downloadImage}>
					Télécharger
				</button>
				<button class="retry-btn" on:click={resetCapture}>
					Nouvelle capture
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.numerisation-container {
		background: transparent;
		padding: 0;
		max-width: 100%;
	}

	.format-selector {
		margin-bottom: 1rem;
	}

	.format-selector label {
		display: block;
		font-size: 0.85rem;
		color: #888888;
		font-weight: 300;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.format-select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #333333;
		border-radius: 0;
		font-size: 0.9rem;
		background: #000000;
		color: #ffffff;
		cursor: pointer;
	}

	.format-select:focus {
		outline: none;
		border-color: #ffffff;
	}

	.camera-controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.negative-controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.control-btn {
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

	.control-btn.active {
		border-color: #ffffff;
		color: #ffffff;
	}

	.control-btn:active {
		opacity: 0.7;
	}

	.camera-select {
		padding: 0.75rem;
		border: 1px solid #333333;
		border-radius: 0;
		font-size: 0.85rem;
		background: #000000;
		color: #ffffff;
		cursor: pointer;
	}

	.camera-select:focus {
		outline: none;
		border-color: #ffffff;
	}

	.video-container {
		position: relative;
		width: 100%;
		background: #000;
		border: 1px solid #333333;
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.preview-canvas {
		width: 100%;
		height: 100%;
		object-fit: contain;
		position: relative;
		display: block;
	}

	.overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 10;
	}

	.overlay.show-grid {
		background-image: 
			linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px);
		background-size: 33.33% 33.33%;
	}

	.overlay.show-guidelines::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
		background: rgba(255, 255, 255, 0.5);
		transform: translateY(-50%);
	}

	.overlay.show-guidelines::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		background: rgba(255, 255, 255, 0.5);
		transform: translateX(-50%);
	}

	.error-message {
		background: transparent;
		color: #ffffff;
		padding: 1rem;
		border: 1px solid #333333;
		margin-bottom: 1rem;
		text-align: center;
		font-weight: 300;
	}

	.capture-controls {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}

	.start-btn,
	.capture-btn,
	.stop-btn {
		padding: 1rem 2rem;
		border: 1px solid #ffffff;
		border-radius: 0;
		font-size: 0.9rem;
		font-weight: 300;
		cursor: pointer;
		transition: all 0.2s ease;
		background: transparent;
		color: #ffffff;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.start-btn {
		width: 100%;
	}

	.capture-btn {
		flex: 1;
		max-width: 200px;
	}

	.start-btn:active,
	.capture-btn:active,
	.stop-btn:active {
		background: #ffffff;
		color: #000000;
	}

	.capture-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
		border-color: #333333;
	}

	.preview-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.preview-info {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.info-badge {
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid #333333;
		font-size: 0.75rem;
		color: #888888;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.info-badge.active {
		border-color: #ffffff;
		color: #ffffff;
	}

	.preview-image {
		width: 100%;
		background: #000;
		border: 1px solid #333333;
		overflow: hidden;
	}

	.preview-image img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.preview-controls {
		display: flex;
		gap: 1rem;
	}

	.download-btn,
	.retry-btn {
		flex: 1;
		padding: 1rem 2rem;
		border: 1px solid #ffffff;
		border-radius: 0;
		font-size: 0.9rem;
		font-weight: 300;
		cursor: pointer;
		transition: all 0.2s ease;
		background: transparent;
		color: #ffffff;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.download-btn:active,
	.retry-btn:active {
		background: #ffffff;
		color: #000000;
	}

	@media (max-width: 480px) {
		.numerisation-container {
			padding: 0;
		}

		.camera-controls {
			flex-direction: column;
		}

		.camera-select {
			width: 100%;
		}
	}
</style>

