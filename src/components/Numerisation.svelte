<script>
	import { onMount, onDestroy } from 'svelte';
	import { photoLibrary } from '../lib/photos.js';

	export let showSettings = false;

	let stream = null;
	let videoElement;
	let canvas;
	let previewCanvas;
	let previewCtx;
	let videoContainer;
	let isCapturing = false;
	let captureFlash = false;
	let cameraError = null;
	let selectedCamera = null;
	let availableCameras = [];
	let showGrid = true;
	let showGuidelines = true;
	let invertColors = true;
	let blackAndWhite = true;
	let animationFrame = null;
	let selectedFormat = '6x6';
	let frameStyle = { left: '0%', top: '0%', width: '100%', height: '100%' };
	let cropRegion = null;
	let resizeObserver = null;

	/**
	 * Formats argentiques nominaux (orientation native = paysage / sens de la longueur).
	 * Sur smartphone, le viseur est tourné de 90° pour maximiser les pixels ;
	 * la capture est ensuite rétablie dans les proportions natives.
	 *
	 * 135  : 24 × 36 mm → 2:3
	 * 6×6  : carré → 1:1
	 * 6×7  : 6 × 7 → 6:7
	 * 6×9  : 6 × 9 → 2:3
	 */
	const formats = [
		{ id: '6x6', label: '6×6', filmWidth: 6, filmHeight: 6 },
		{ id: '6x7', label: '6×7', filmWidth: 7, filmHeight: 6 },
		{ id: '6x9', label: '6×9', filmWidth: 9, filmHeight: 6 },
		{ id: '135', label: '135', filmWidth: 36, filmHeight: 24 }
	];

	function getFormat() {
		return formats.find((f) => f.id === selectedFormat) || formats[0];
	}

	/**
	 * Ratio du viseur smartphone : formats rectangulaires tournés de 90°
	 * (côté court = largeur écran, côté long = hauteur) pour maximiser les pixels.
	 */
	function getViewfinderAspectRatio() {
		const format = getFormat();
		if (format.filmWidth === format.filmHeight) return 1;
		return format.filmHeight / format.filmWidth;
	}

	function isSquareFormat() {
		const format = getFormat();
		return format.filmWidth === format.filmHeight;
	}

	function getColorFilter() {
		const filters = [];
		if (invertColors) filters.push('invert(1)');
		if (blackAndWhite) filters.push('grayscale(1)');
		return filters.join(' ') || 'none';
	}

	function isRearCamera(label = '') {
		const name = label.toLowerCase();
		return (
			/back|rear|environment|arrière|arriere|posterior|world/i.test(name) &&
			!/front|user|face|avant|selfie/i.test(name)
		);
	}

	onMount(async () => {
		if (videoContainer && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				if (previewCanvas && videoContainer) {
					syncCanvasSize();
				}
			});
			resizeObserver.observe(videoContainer);
		}

		await startCamera();
		const previousCamera = selectedCamera;
		await loadCameras();

		if (selectedCamera && selectedCamera !== previousCamera) {
			stopCamera();
			await startCamera();
		}
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
		stopCamera();
	});

	async function loadCameras() {
		try {
			if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
				console.warn('navigator.mediaDevices non disponible - nécessite HTTPS ou localhost');
				return;
			}

			const devices = await navigator.mediaDevices.enumerateDevices();
			availableCameras = devices
				.filter((device) => device.kind === 'videoinput')
				.map((device, index) => ({
					id: device.deviceId,
					label: device.label || `Caméra ${index + 1}`
				}));

			const rearCamera = availableCameras.find((camera) => isRearCamera(camera.label));
			if (rearCamera && selectedCamera !== rearCamera.id) {
				selectedCamera = rearCamera.id;
			} else if (availableCameras.length > 0 && !selectedCamera) {
				selectedCamera = availableCameras[0].id;
			}
		} catch (error) {
			console.error('Erreur lors du chargement des caméras:', error);
		}
	}

	async function startCamera() {
		try {
			cameraError = null;

			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				cameraError = "L'accès à la caméra nécessite HTTPS ou localhost.";
				console.error('navigator.mediaDevices non disponible');
				return;
			}

			const baseVideo = selectedCamera
				? { deviceId: { exact: selectedCamera } }
				: { facingMode: { ideal: 'environment' } };

			const constraints = {
				video: {
					...baseVideo,
					width: { ideal: 4096 },
					height: { ideal: 2160 },
					frameRate: { ideal: 30 }
				}
			};

			stream = await navigator.mediaDevices.getUserMedia(constraints);

			const track = stream.getVideoTracks()[0];
			if (track) {
				selectedCamera = track.getSettings().deviceId || selectedCamera;
				await applyMaxSensorSettings(track);
			}

			if (videoElement) {
				videoElement.srcObject = stream;
				await videoElement.play();
				startPreview();
			}
		} catch (error) {
			cameraError = "Impossible d'accéder à la caméra. Vérifiez les permissions.";
			console.error('Erreur caméra:', error);
		}
	}

	async function applyMaxSensorSettings(track) {
		const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
		const advanced = [];

		// Dézoom maximal si le périphérique le permet
		if (capabilities.zoom && typeof capabilities.zoom.min === 'number') {
			advanced.push({ zoom: capabilities.zoom.min });
		}

		const nextConstraints = {
			width: { ideal: capabilities.width?.max || 4096 },
			height: { ideal: capabilities.height?.max || 2160 }
		};

		// Évite le recadrage navigateur quand c'est supporté
		if (Array.isArray(capabilities.resizeMode) && capabilities.resizeMode.includes('none')) {
			nextConstraints.resizeMode = { ideal: 'none' };
		}

		try {
			await track.applyConstraints({
				...nextConstraints,
				...(advanced.length ? { advanced } : {})
			});
		} catch (error) {
			if (advanced.length) {
				try {
					await track.applyConstraints({ advanced });
				} catch (zoomError) {
					console.warn('Impossible d\'appliquer le dézoom minimal:', zoomError);
				}
			} else {
				console.warn('Impossible d\'appliquer les réglages capteur max:', error);
			}
		}
	}

	function syncCanvasSize() {
		if (!previewCanvas || !videoContainer) return;
		const rect = videoContainer.getBoundingClientRect();
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const width = Math.max(1, Math.round(rect.width * dpr));
		const height = Math.max(1, Math.round(rect.height * dpr));
		if (previewCanvas.width !== width || previewCanvas.height !== height) {
			previewCanvas.width = width;
			previewCanvas.height = height;
		}
	}

	/** Affiche tout le flux caméra sans recadrage (contain) pour exploiter tout le capteur. */
	function getContainDraw(videoWidth, videoHeight, canvasWidth, canvasHeight) {
		const scale = Math.min(canvasWidth / videoWidth, canvasHeight / videoHeight);
		const drawWidth = videoWidth * scale;
		const drawHeight = videoHeight * scale;
		return {
			scale,
			drawWidth,
			drawHeight,
			drawX: (canvasWidth - drawWidth) / 2,
			drawY: (canvasHeight - drawHeight) / 2
		};
	}

	/** Plus grand cadre du format à l'intérieur de la zone image (pixels capteur visibles). */
	function getFrameRect(areaX, areaY, areaWidth, areaHeight, aspectRatio) {
		let frameWidth;
		let frameHeight;

		if (areaWidth / areaHeight > aspectRatio) {
			frameHeight = areaHeight;
			frameWidth = frameHeight * aspectRatio;
		} else {
			frameWidth = areaWidth;
			frameHeight = frameWidth / aspectRatio;
		}

		return {
			x: areaX + (areaWidth - frameWidth) / 2,
			y: areaY + (areaHeight - frameHeight) / 2,
			width: frameWidth,
			height: frameHeight
		};
	}

	function startPreview() {
		if (!videoElement || !previewCanvas) return;

		previewCtx = previewCanvas.getContext('2d');
		syncCanvasSize();

		function updatePreview() {
			if (!videoElement || !previewCanvas || !previewCtx) return;

			if (
				videoElement.readyState === videoElement.HAVE_ENOUGH_DATA &&
				videoElement.videoWidth > 0 &&
				videoElement.videoHeight > 0
			) {
				syncCanvasSize();

				const canvasWidth = previewCanvas.width;
				const canvasHeight = previewCanvas.height;
				const videoWidth = videoElement.videoWidth;
				const videoHeight = videoElement.videoHeight;
				const aspectRatio = getViewfinderAspectRatio();
				const contain = getContainDraw(videoWidth, videoHeight, canvasWidth, canvasHeight);
				const frame = getFrameRect(
					contain.drawX,
					contain.drawY,
					contain.drawWidth,
					contain.drawHeight,
					aspectRatio
				);
				const colorFilter = getColorFilter();

				frameStyle = {
					left: `${(frame.x / canvasWidth) * 100}%`,
					top: `${(frame.y / canvasHeight) * 100}%`,
					width: `${(frame.width / canvasWidth) * 100}%`,
					height: `${(frame.height / canvasHeight) * 100}%`
				};

				cropRegion = {
					sx: (frame.x - contain.drawX) / contain.scale,
					sy: (frame.y - contain.drawY) / contain.scale,
					sw: frame.width / contain.scale,
					sh: frame.height / contain.scale
				};

				previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);

				previewCtx.filter = `${colorFilter} blur(18px)`.replace(/^none /, '');
				previewCtx.drawImage(
					videoElement,
					0,
					0,
					videoWidth,
					videoHeight,
					contain.drawX,
					contain.drawY,
					contain.drawWidth,
					contain.drawHeight
				);

				previewCtx.filter = colorFilter;
				previewCtx.save();
				previewCtx.beginPath();
				previewCtx.rect(frame.x, frame.y, frame.width, frame.height);
				previewCtx.clip();
				previewCtx.drawImage(
					videoElement,
					0,
					0,
					videoWidth,
					videoHeight,
					contain.drawX,
					contain.drawY,
					contain.drawWidth,
					contain.drawHeight
				);
				previewCtx.restore();
				previewCtx.filter = 'none';
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
			stream.getTracks().forEach((track) => track.stop());
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
		if (!videoElement || !canvas || !cropRegion) return;
		if (videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) return;

		isCapturing = true;

		const ctx = canvas.getContext('2d');
		const format = getFormat();
		const { sx, sy, sw, sh } = cropRegion;
		const cropWidth = Math.round(sw);
		const cropHeight = Math.round(sh);
		const colorFilter = getColorFilter();

		if (isSquareFormat()) {
			const side = Math.min(cropWidth, cropHeight);
			canvas.width = side;
			canvas.height = side;
			ctx.filter = colorFilter;
			ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, side, side);
		} else {
			// Viseur portrait (90°) → export paysage aux proportions exactes du négatif
			const longSide = Math.max(cropWidth, cropHeight);
			const outWidth = longSide;
			const outHeight = Math.round((longSide * format.filmHeight) / format.filmWidth);

			canvas.width = outWidth;
			canvas.height = outHeight;
			ctx.filter = colorFilter;
			ctx.translate(outWidth, 0);
			ctx.rotate(Math.PI / 2);
			ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, outHeight, outWidth);
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.filter = 'none';

		canvas.toBlob(
			(blob) => {
				if (blob) {
					photoLibrary.add(blob, {
						format: selectedFormat,
						invertColors,
						blackAndWhite
					});
					captureFlash = true;
					setTimeout(() => {
						captureFlash = false;
					}, 120);
				}
				isCapturing = false;
			},
			'image/jpeg',
			0.95
		);
	}

	function handleCaptureKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (!isCapturing && stream) capturePhoto();
		}
	}

	function toggleGrid() {
		showGrid = !showGrid;
	}

	function toggleGuidelines() {
		showGuidelines = !showGuidelines;
	}
</script>

<div class="numerisation-container">
	<div class="camera-section">
		{#if showSettings}
			<div class="settings-panel">
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
						<select
							bind:value={selectedCamera}
							class="camera-select"
							on:change={async () => {
								stopCamera();
								await startCamera();
							}}
						>
							{#each availableCameras as camera}
								<option value={camera.id}>{camera.label}</option>
							{/each}
						</select>
					{/if}
				</div>

				<div class="negative-controls">
					<button
						class="control-btn negative-btn"
						on:click={() => (invertColors = !invertColors)}
						class:active={invertColors}
					>
						Inverser
					</button>
					<button
						class="control-btn bw-btn"
						on:click={() => (blackAndWhite = !blackAndWhite)}
						class:active={blackAndWhite}
					>
						Noir & Blanc
					</button>
				</div>
			</div>
		{/if}

		<div
			class="video-container"
			class:capturing={isCapturing}
			class:flash={captureFlash}
			bind:this={videoContainer}
			on:click={() => {
				if (!isCapturing && stream) capturePhoto();
			}}
			on:keydown={handleCaptureKeydown}
			role="button"
			tabindex="0"
			aria-label="Capturer la photo"
		>
			<video bind:this={videoElement} autoplay playsinline muted style="display: none;"></video>
			<canvas bind:this={previewCanvas} class="preview-canvas"></canvas>
			<div
				class="frame-mask"
				style="left: {frameStyle.left}; top: {frameStyle.top}; width: {frameStyle.width}; height: {frameStyle.height};"
			>
				{#if showGrid || showGuidelines}
					<div class="overlay" class:show-grid={showGrid} class:show-guidelines={showGuidelines}></div>
				{/if}
			</div>
			<canvas bind:this={canvas} style="display: none;"></canvas>
		</div>

		{#if cameraError}
			<div class="error-message">
				{cameraError}
			</div>
		{/if}
	</div>
</div>

<style>
	.numerisation-container {
		background: transparent;
		padding: 0;
		width: 100%;
		height: 100%;
		min-height: 100%;
	}

	.camera-section {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 100%;
		overflow: hidden;
	}

	.settings-panel {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 30;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.85);
		border-bottom: 1px solid #333333;
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
		margin-bottom: 0;
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
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: #000;
		overflow: hidden;
		cursor: pointer;
	}

	.video-container:active,
	.video-container.capturing {
		opacity: 0.92;
	}

	.video-container.flash::after {
		content: '';
		position: absolute;
		inset: 0;
		background: #fff;
		opacity: 0.85;
		pointer-events: none;
		z-index: 20;
	}

	.preview-canvas {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}

	.frame-mask {
		position: absolute;
		pointer-events: none;
		z-index: 10;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35);
	}

	.overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
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
		position: absolute;
		left: 1rem;
		right: 1rem;
		bottom: 1rem;
		z-index: 20;
		background: rgba(0, 0, 0, 0.8);
		color: #ffffff;
		padding: 1rem;
		border: 1px solid #333333;
		text-align: center;
		font-weight: 300;
	}

	@media (max-width: 480px) {
		.camera-controls {
			flex-direction: column;
		}

		.camera-select {
			width: 100%;
		}
	}
</style>
