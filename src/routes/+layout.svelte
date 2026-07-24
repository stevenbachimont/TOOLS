<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { registerSW } from 'virtual:pwa-register';

	let updateServiceWorker;

	onMount(() => {
		if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
			updateServiceWorker = registerSW({
				immediate: true,
				onRegistered(r) {
					if (r) {
						console.log('SW Registered: ', r);
					}
				},
				onRegisterError(error) {
					console.log('SW registration error', error);
				}
			});
		}
	});
</script>

<main>
	<slot />
</main>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: #000000;
		color: #ffffff;
	}

	main {
		max-width: 100%;
		margin: 0 auto;
		padding: 0;
		width: 100%;
		height: 100%;
		background: #000000;
	}
</style>

