<script>
	import Numerisation from '../components/Numerisation.svelte';
	import Mediatheque from '../components/Mediatheque.svelte';
	import { photoCount } from '../lib/photos.js';

	let showSettings = false;
	let view = 'camera';

	function toggleSettings() {
		if (view !== 'camera') return;
		showSettings = !showSettings;
	}

	function handleHeaderKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleSettings();
		}
	}

	function openLibrary(event) {
		event.stopPropagation();
		view = 'library';
	}

	function openCamera(event) {
		event?.stopPropagation?.();
		view = 'camera';
	}
</script>

<div class="app-container">
	<header class:open={showSettings && view === 'camera'}>
		<div
			class="header-main"
			on:click={view === 'camera' ? toggleSettings : openCamera}
			on:keydown={handleHeaderKeydown}
			role="button"
			tabindex="0"
			aria-expanded={showSettings && view === 'camera'}
			aria-label={view === 'camera'
				? 'Afficher ou masquer les réglages'
				: 'Retour à la numérisation'}
		>
			<img src="/logo%20light.png" alt="Logo" class="logo" />
			<h1 class="title">{view === 'library' ? 'Médiathèque' : 'Numérisation'}</h1>
		</div>

		{#if view === 'camera'}
			<button
				type="button"
				class="library-btn"
				on:click={openLibrary}
				aria-label="Ouvrir la médiathèque"
			>
				Albums
				{#if $photoCount > 0}
					<span class="count">{$photoCount}</span>
				{/if}
			</button>
		{:else}
			<button type="button" class="library-btn" on:click={openCamera}>
				Caméra
			</button>
		{/if}
	</header>

	<div class="content">
		<div class="view" class:active={view === 'camera'} aria-hidden={view !== 'camera'}>
			<Numerisation {showSettings} />
		</div>
		<div class="view" class:active={view === 'library'} aria-hidden={view !== 'library'}>
			{#if view === 'library'}
				<Mediatheque />
			{/if}
		</div>
	</div>
</div>

<style>
	.app-container {
		max-width: 100%;
		margin: 0 auto;
		height: 100vh;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		background: #000000;
		color: #ffffff;
		overflow: hidden;
	}

	header {
		position: relative;
		z-index: 40;
		flex-shrink: 0;
		background: rgba(0, 0, 0, 0.72);
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #333333;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.header-main {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		user-select: none;
		min-width: 0;
		flex: 1;
	}

	header.open .header-main,
	.header-main:active {
		opacity: 0.7;
	}

	.logo {
		height: 2rem;
		width: auto;
		object-fit: contain;
		pointer-events: none;
		flex-shrink: 0;
	}

	.title {
		margin: 0;
		font-size: 1.1rem;
		color: #ffffff;
		font-weight: 300;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		pointer-events: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.library-btn {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid #333;
		background: transparent;
		color: #888;
		font-size: 0.7rem;
		font-weight: 300;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.library-btn:active {
		border-color: #fff;
		color: #fff;
	}

	.count {
		min-width: 1.2rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid #fff;
		color: #fff;
		text-align: center;
	}

	.content {
		flex: 1;
		min-height: 0;
		padding: 0;
		overflow: hidden;
		background: #000000;
		position: relative;
	}

	.view {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		visibility: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.view.active {
		visibility: visible;
		pointer-events: auto;
		z-index: 1;
	}

	@media (max-width: 480px) {
		.logo {
			height: 1.5rem;
		}

		.title {
			font-size: 0.95rem;
			letter-spacing: 0.12em;
		}
	}
</style>
