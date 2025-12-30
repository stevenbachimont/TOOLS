<script>
	import { onMount, onDestroy } from 'svelte';

	let timeLeft = 0;
	let totalTime = 0;
	let isRunning = false;
	let interval;
	let selectedFilm = null;
	let selectedStep = 'development'; // 'development', 'rinse', 'fixation'
	let currentStepIndex = 0;
	let temperature = 20; // Température en °C
	let temperatureCompensation = 0;
	let showRinseInstructions = false;

	// Base de données des pellicules avec temps de développement au caffenol (20°C)
	const films = [
		{ brand: 'Kentmere', name: 'Kentmere 100', iso: 100, developmentTime: 13 },
		{ brand: 'Kentmere', name: 'Kentmere 400', iso: 400, developmentTime: 15 },
		{ brand: 'Arista EDU Ultra', name: 'Arista EDU Ultra 100', iso: 100, developmentTime: 9 },
		{ brand: 'Arista EDU Ultra', name: 'Arista EDU Ultra 400', iso: 400, developmentTime: 12 },
		{ brand: 'Arista EDU Ultra', name: 'Arista EDU Ultra 400 (poussé 800)', iso: 800, developmentTime: 20.25, pushed: true },
		{ brand: 'Ilford', name: 'Ilford FP4', iso: 125, developmentTime: 12 },
		{ brand: 'Ilford', name: 'Ilford HP5+', iso: 400, developmentTime: 10 },
		{ brand: 'Ilford', name: 'Ilford HP5+ (poussé 1600)', iso: 1600, developmentTime: 22.3, pushed: true },
		{ brand: 'Ilford', name: 'Ilford Delta Pro', iso: 3200, developmentTime: 12 },
		{ brand: 'Agfa', name: 'Agfa APX 100', iso: 100, developmentTime: 15 },
		{ brand: 'Kodak', name: 'Kodak Tri-X 320', iso: 320, developmentTime: 13 },
		{ brand: 'Kodak', name: 'Kodak Tri-X 400', iso: 400, developmentTime: 14.5 },
		{ brand: 'Kodak', name: 'Kodak X-PLUS 125', iso: 125, developmentTime: 9 },
		{ brand: 'Kodak', name: 'Kodak TMAX 400', iso: 400, developmentTime: 11 },
		{ brand: 'Kodak', name: 'Kodak TMAX 400 (poussé 800)', iso: 800, developmentTime: 16.5, pushed: true },
		{ brand: 'Kodak', name: 'Kodak TX 400', iso: 400, developmentTime: 15 },
		{ brand: 'Ferrania', name: 'Ferrania P30 Alpha', iso: 80, developmentTime: 12 },
		{ brand: 'Rollei', name: 'Rollei RPX 400', iso: 400, developmentTime: 15 },
		{ brand: 'Cinestill', name: 'Cinestill Double XX', iso: 200, developmentTime: 25 }
	];

	// Temps standards pour rinçage et fixation (en secondes)
	const RINSE_TIME = 30; // 30 secondes
	const FIXATION_TIME = 5 * 60; // 5 minutes

	function formatTime(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	function calculateDevelopmentTime() {
		if (!selectedFilm) return 0;
		
		// Temps de base à 20°C
		let baseTime = selectedFilm.developmentTime * 60; // Convertir en secondes
		
		// Compensation de température : -1min/°C (ou +1min si température < 20°C)
		const tempDiff = temperature - 20;
		const compensation = tempDiff * 60; // -60 secondes par °C au-dessus de 20°C
		
		// Appliquer la compensation
		const adjustedTime = baseTime - compensation;
		
		// Temps minimum de 30 secondes
		return Math.max(adjustedTime, 30);
	}

	function getCurrentStepTime() {
		switch(selectedStep) {
			case 'development':
				return calculateDevelopmentTime();
			case 'rinse':
				return RINSE_TIME;
			case 'fixation':
				return FIXATION_TIME;
			default:
				return 0;
		}
	}

	function getStepName() {
		switch(selectedStep) {
			case 'development':
				return 'Révélation';
			case 'rinse':
				return 'Rinçage';
			case 'fixation':
				return 'Fixage';
			default:
				return '';
		}
	}

	function startTimer(duration) {
		if (isRunning) return;
		
		totalTime = duration;
		timeLeft = duration;
		isRunning = true;
		
		interval = setInterval(() => {
			timeLeft--;
			if (timeLeft <= 0) {
				stopTimer();
				playAlarm();
				showNotification(`${getStepName()} terminé !`);
				
				// Passer à l'étape suivante automatiquement
				nextStep();
			}
		}, 1000);
	}

	function stopTimer() {
		isRunning = false;
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
	}

	function resetTimer() {
		stopTimer();
		timeLeft = 0;
		totalTime = 0;
		currentStepIndex = 0;
		selectedStep = 'development';
		showRinseInstructions = false;
	}

	function getRinseSteps() {
		const steps = [];
		for (let i = 5; i <= 10; i++) {
			steps.push(
				{ action: 'Vider', type: 'empty' },
				{ action: 'Remplir d\'eau', type: 'fill' },
				{ action: `Agiter ${i} fois`, type: 'agitate', count: i }
			);
		}
		return steps;
	}

	function nextStep() {
		if (selectedStep === 'development') {
			selectedStep = 'rinse';
			showRinseInstructions = true;
			stopTimer();
		} else if (selectedStep === 'rinse') {
			selectedStep = 'fixation';
			showRinseInstructions = false;
			// Démarrer automatiquement l'étape de fixation après 2 secondes
			setTimeout(() => {
				const stepTime = getCurrentStepTime();
				if (stepTime > 0) {
					startTimer(stepTime);
				}
			}, 2000);
		} else {
			// Fin du processus
			resetTimer();
			return;
		}
	}

	function continueToFixation() {
		showRinseInstructions = false;
		nextStep();
	}

	function startDevelopment() {
		if (!selectedFilm) {
			alert('Veuillez sélectionner une pellicule');
			return;
		}
		
		resetTimer();
		selectedStep = 'development';
		const stepTime = getCurrentStepTime();
		startTimer(stepTime);
	}

	function handleStepKeydown(event) {
		if ((event.key === 'Enter' || event.key === ' ') && !isRunning && selectedFilm) {
			event.preventDefault();
			startDevelopment();
		}
	}

	function playAlarm() {
		// Générer un son "ding" avec Web Audio API
		try {
			const audioContext = new (window.AudioContext || window.webkitAudioContext)();
			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();
			
			// Configuration du son "ding" (note courte et claire)
			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Fréquence de 800 Hz
			
			// Enveloppe ADSR pour un son "ding" naturel
			gainNode.gain.setValueAtTime(0, audioContext.currentTime);
			gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01); // Attaque rapide
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3); // Décroissance
			
			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);
			
			oscillator.start(audioContext.currentTime);
			oscillator.stop(audioContext.currentTime + 0.3);
		} catch (error) {
			console.error('Erreur lors de la lecture du son:', error);
		}
		
		// Vibration si disponible
		if (navigator.vibrate) {
			navigator.vibrate([200, 100, 200, 100, 200]);
		}
	}

	function showNotification(message) {
		if ('Notification' in window && Notification.permission === 'granted') {
			new Notification(message);
		} else if ('Notification' in window && Notification.permission !== 'denied') {
			Notification.requestPermission().then(permission => {
				if (permission === 'granted') {
					new Notification(message);
				}
			});
		}
	}

	$: {
		if (selectedFilm) {
			// Compensation négative si température > 20°C (on soustrait du temps)
			// Compensation positive si température < 20°C (on ajoute du temps)
			temperatureCompensation = -(temperature - 20) * 60; // en secondes
		}
	}

	// Temps ajusté réactif qui se met à jour automatiquement
	$: adjustedTime = calculateDevelopmentTime();

	// Initialiser et mettre à jour le chrono avec le temps ajusté
	// (seulement si le chrono n'est pas en cours et qu'on est à l'étape développement)
	$: {
		if (selectedFilm && !isRunning && selectedStep === 'development') {
			const stepTime = getCurrentStepTime();
			if (stepTime > 0) {
				totalTime = stepTime;
				timeLeft = stepTime;
			}
		}
	}

	// Détecter si on est dans une période d'agitation :
	// - Première minute : bleu tout le temps
	// - Chaque minute suivante : bleu pendant 3 secondes au début (secondes 60, 59, 58, etc.)
	$: isAgitationPhase = isRunning && selectedStep === 'development' && totalTime > 0 && (
		timeLeft > (totalTime - 60) || // Première minute complète
		(timeLeft <= (totalTime - 60) && (timeLeft % 60 === 0 || timeLeft % 60 >= 58)) // 3 premières secondes de chaque minute suivante
	);

	onMount(() => {
		if ('Notification' in window) {
			Notification.requestPermission();
		}
	});

	onDestroy(() => {
		stopTimer();
	});
</script>

<div class="minuteur-container">
	<div class="film-selector">
		<label for="film-select">Pellicule</label>
		<select id="film-select" bind:value={selectedFilm} class="film-select">
			<option value={null}>Sélectionner une pellicule</option>
			{#each films as film}
				<option value={film}>{film.name} (ISO {film.iso})</option>
			{/each}
		</select>
	</div>

	{#if selectedFilm}
		<div class="film-info">
			<div class="info-row">
				<span class="info-label">Pellicule sélectionnée :</span>
				<span class="info-value">{selectedFilm.name}</span>
			</div>
			<div class="info-row">
				<span class="info-label">Temps de révélation (20°C) :</span>
				<span class="info-value">{formatTime(selectedFilm.developmentTime * 60)}</span>
			</div>
			<div class="temperature-control">
				<label for="temperature">Température (°C)</label>
				<input
					id="temperature"
					type="number"
					min="15"
					max="25"
					step="0.5"
					bind:value={temperature}
					class="temperature-input"
					disabled={isRunning}
				/>
				{#if temperatureCompensation !== 0}
					<div class="compensation">
						Compensation : {temperatureCompensation > 0 ? '+' : ''}{Math.round(temperatureCompensation / 60 * 10) / 10} min
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if showRinseInstructions}
		<div class="rinse-instructions">
			<h2 class="rinse-title">Méthode de rinçage</h2>
			<div class="rinse-steps">
				{#each getRinseSteps() as step, index}
					<div class="rinse-step" class:empty={step.type === 'empty'} class:fill={step.type === 'fill'} class:agitate={step.type === 'agitate'}>
						<div class="step-number">{index + 1}</div>
						<div class="step-action">{step.action}</div>
					</div>
				{/each}
			</div>
			<button class="continue-btn" on:click={continueToFixation}>
				Continuer vers le fixage
			</button>
		</div>
	{:else}
		<div class="timer-display">
			<div class="time-circle">
				<svg class="progress-ring" width="280" height="280" viewBox="0 0 280 280">
					<circle
						class="progress-ring-circle"
						stroke="#333333"
						stroke-width="2"
						fill="transparent"
						r="130"
						cx="140"
						cy="140"
					/>
					{#if totalTime > 0}
						<circle
							class="progress-ring-circle progress"
							class:agitation={isAgitationPhase}
							stroke={isAgitationPhase ? "#4A90E2" : "#ffffff"}
							stroke-width="2"
							fill="transparent"
							r="130"
							cx="140"
							cy="140"
							stroke-dasharray="{2 * Math.PI * 130}"
							stroke-dashoffset="{2 * Math.PI * 130 * (1 - timeLeft / totalTime)}"
							transform="rotate(-90 140 140)"
						/>
					{/if}
				</svg>
				<div class="time-text">
					<div class="time-value">{formatTime(timeLeft)}</div>
					{#if selectedStep}
						<div class="preset-name">{getStepName()}</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<div class="steps-indicator">
		<div 
			class="step" 
			class:active={selectedStep === 'development'} 
			class:completed={selectedStep !== 'development' && !isRunning && timeLeft === 0}
			class:clickable={!isRunning && selectedFilm}
			on:click={() => {
				if (!isRunning && selectedFilm) {
					startDevelopment();
				}
			}}
			on:keydown={handleStepKeydown}
			role="button"
			tabindex={!isRunning && selectedFilm ? 0 : -1}
		>
			<div class="step-number">1</div>
			<div class="step-label">Révélation</div>
		</div>
		<div class="step" class:active={selectedStep === 'rinse'} class:completed={selectedStep === 'fixation'}>
			<div class="step-number">2</div>
			<div class="step-label">Rinçage</div>
		</div>
		<div class="step" class:active={selectedStep === 'fixation'}>
			<div class="step-number">3</div>
			<div class="step-label">Fixage</div>
		</div>
	</div>
</div>

<style>
	.minuteur-container {
		background: transparent;
		padding: 0;
		max-width: 100%;
	}

	.film-selector {
		margin-bottom: 1.5rem;
	}

	.film-selector label {
		display: block;
		font-size: 0.9rem;
		color: #888888;
		font-weight: 300;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.film-select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #333333;
		border-radius: 0;
		font-size: 1rem;
		background: #000000;
		color: #ffffff;
		cursor: pointer;
	}

	.film-select:focus {
		outline: none;
		border-color: #ffffff;
	}

	.film-info {
		background: transparent;
		border: 1px solid #333333;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.info-label {
		font-size: 0.85rem;
		color: #888888;
		font-weight: 300;
	}

	.info-value {
		font-size: 0.85rem;
		font-weight: 300;
		color: #ffffff;
	}

	.temperature-control {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #333333;
	}

	.temperature-control label {
		display: block;
		font-size: 0.85rem;
		color: #888888;
		margin-bottom: 0.5rem;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.temperature-input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #333333;
		border-radius: 0;
		font-size: 1.25rem;
		text-align: center;
		font-weight: 300;
		background: #000000;
		color: #ffffff;
	}

	.temperature-input:focus {
		outline: none;
		border-color: #ffffff;
	}

	.temperature-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.compensation {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: #ffffff;
		font-weight: 300;
		text-align: center;
	}

	.timer-display {
		display: flex;
		justify-content: center;
		margin-bottom: 2rem;
	}

	.time-circle {
		position: relative;
		width: 280px;
		height: 280px;
		margin: 0 auto;
	}

	.progress-ring {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.progress-ring-circle {
		transition: stroke-dashoffset 0.5s linear;
	}

	.time-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		width: 100%;
		z-index: 1;
		pointer-events: none;
	}

	.time-value {
		font-size: 3.5rem;
		font-weight: 300;
		color: #ffffff;
		line-height: 1;
		margin-bottom: 0.5rem;
		letter-spacing: 0.05em;
	}

	.preset-name {
		font-size: 0.9rem;
		color: #888888;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.steps-indicator {
		display: flex;
		justify-content: space-between;
		margin-bottom: 2rem;
		gap: 0.5rem;
	}

	.step {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid #333333;
		background: transparent;
		transition: all 0.2s ease;
	}

	.step.active {
		border-color: #ffffff;
		color: #ffffff;
	}

	.step.completed {
		border-color: #888888;
		color: #888888;
	}

	.step.clickable {
		cursor: pointer;
	}

	.step.clickable:hover {
		border-color: #ffffff;
		color: #ffffff;
	}

	.step.clickable:active {
		opacity: 0.7;
	}

	.step-number {
		width: 32px;
		height: 32px;
		border: 1px solid currentColor;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 300;
		font-size: 1rem;
	}

	.step-label {
		font-size: 0.75rem;
		font-weight: 300;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.rinse-instructions {
		margin-bottom: 2rem;
	}

	.rinse-title {
		font-size: 1.2rem;
		font-weight: 300;
		color: #ffffff;
		text-align: center;
		margin-bottom: 2rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.rinse-steps {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}

	.rinse-step {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid #333333;
		background: transparent;
		transition: all 0.2s ease;
	}

	.rinse-step .step-number {
		width: 32px;
		height: 32px;
		border: 1px solid #333333;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 300;
		font-size: 0.9rem;
		color: #888888;
		flex-shrink: 0;
	}

	.rinse-step .step-action {
		font-size: 0.9rem;
		font-weight: 300;
		color: #ffffff;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.rinse-step.empty {
		border-color: #666666;
	}

	.rinse-step.fill {
		border-color: #4A90E2;
	}

	.rinse-step.agitate {
		border-color: #4A90E2;
		background: rgba(74, 144, 226, 0.1);
	}

	.rinse-step.agitate .step-number {
		border-color: #4A90E2;
		color: #4A90E2;
	}

	.continue-btn {
		width: 100%;
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

	.continue-btn:active {
		background: #ffffff;
		color: #000000;
	}

	@media (max-width: 480px) {
		.minuteur-container {
			padding: 0;
		}

		.time-circle {
			width: 240px;
			height: 240px;
		}

		.time-value {
			font-size: 2.5rem;
		}

		.steps-indicator {
			flex-direction: column;
		}
	}
</style>
