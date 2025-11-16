<script>
	import { goto } from '$app/navigation';
	import Posemetre from '../components/Posemetre.svelte';
	import Minuteur from '../components/Minuteur.svelte';
	import Numerisation from '../components/Numerisation.svelte';

	let activeTab = 'posemetre';

	const tabs = [
		{ id: 'posemetre', label: 'Posemètre' },
		{ id: 'minuteur', label: 'Minuteur' },
		{ id: 'numerisation', label: 'Numérisation' }
	];
</script>

<div class="app-container">
	<header>
		<h1>TOOLS</h1>
	</header>

	<nav class="tabs">
		{#each tabs as tab}
			<button
				class="tab-button"
				class:active={activeTab === tab.id}
				on:click={() => activeTab = tab.id}
			>
				{tab.label}
			</button>
		{/each}
	</nav>

	<div class="content">
		{#if activeTab === 'posemetre'}
			<Posemetre />
		{:else if activeTab === 'minuteur'}
			<Minuteur />
		{:else if activeTab === 'numerisation'}
			<Numerisation />
		{/if}
	</div>
</div>

<style>
	.app-container {
		max-width: 100%;
		margin: 0 auto;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #000000;
		color: #ffffff;
	}

	header {
		background: #000000;
		padding: 1.5rem 1rem;
		text-align: center;
		border-bottom: 1px solid #333333;
	}

	header h1 {
		margin: 0;
		font-size: 1.2rem;
		color: #ffffff;
		font-weight: 300;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	.tabs {
		display: flex;
		background: #000000;
		border-bottom: 1px solid #333333;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.tab-button {
		flex: 1;
		padding: 1rem 0.5rem;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.9rem;
		color: #888888;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 2px solid transparent;
	}

	.tab-button.active {
		color: #ffffff;
		border-bottom-color: #ffffff;
	}

	.tab-button:active {
		opacity: 0.7;
	}

	.content {
		flex: 1;
		padding: 1rem;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		background: #000000;
	}

	@media (max-width: 480px) {
		header h1 {
			font-size: 1rem;
		}

		.tab-button {
			padding: 0.75rem 0.25rem;
			font-size: 0.8rem;
		}
	}
</style>

