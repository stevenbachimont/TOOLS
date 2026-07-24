<script>
	import { photoLibrary } from '../lib/photos.js';

	let selectionMode = false;
	let selectedIds = new Set();
	let isDownloading = false;
	let previewId = null;

	$: photos = $photoLibrary;
	$: previewPhoto = previewId ? photos.find((photo) => photo.id === previewId) : null;
	$: selectedCount = selectedIds.size;
	$: allSelected = photos.length > 0 && selectedCount === photos.length;

	function toggleSelectionMode() {
		selectionMode = !selectionMode;
		selectedIds = new Set();
		previewId = null;
	}

	function toggleSelect(id) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function selectAll() {
		selectedIds = new Set(photos.map((photo) => photo.id));
	}

	function clearSelection() {
		selectedIds = new Set();
	}

	function openPreview(id) {
		if (selectionMode) {
			toggleSelect(id);
			return;
		}
		previewId = id;
	}

	function closePreview() {
		previewId = null;
	}

	function downloadBlob(blob, filename) {
		const objectUrl = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = objectUrl;
		link.download = filename;
		link.rel = 'noopener';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
	}

	async function downloadPhotos(list) {
		if (!list.length || isDownloading) return;
		isDownloading = true;
		try {
			for (let i = 0; i < list.length; i++) {
				const photo = list[i];
				const filename = `photo-${photo.format}-${photo.createdAt}${list.length > 1 ? `-${i + 1}` : ''}.jpg`;
				downloadBlob(photo.blob, filename);
				if (list.length > 1 && i < list.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 350));
				}
			}
		} finally {
			setTimeout(() => {
				isDownloading = false;
			}, 600);
		}
	}

	async function downloadSelected() {
		const list = photos.filter((photo) => selectedIds.has(photo.id));
		await downloadPhotos(list);
	}

	function deleteSelected() {
		if (!selectedCount) return;
		photoLibrary.remove([...selectedIds]);
		selectedIds = new Set();
		if (previewId && !photos.some((photo) => photo.id === previewId)) {
			previewId = null;
		}
	}

	function deletePreview() {
		if (!previewId) return;
		photoLibrary.remove([previewId]);
		previewId = null;
	}

	async function downloadPreview() {
		if (!previewPhoto) return;
		await downloadPhotos([previewPhoto]);
	}
</script>

<div class="mediatheque">
	{#if previewPhoto}
		<div class="preview-view">
			<button type="button" class="back-btn" on:click={closePreview}>Retour</button>
			<div class="preview-frame">
				<img src={previewPhoto.url} alt="Photo {previewPhoto.format}" />
			</div>
			<div class="preview-meta">
				<span>{previewPhoto.format}</span>
				{#if previewPhoto.invertColors}<span>Inversé</span>{/if}
				{#if previewPhoto.blackAndWhite}<span>N&B</span>{/if}
			</div>
			<div class="toolbar">
				<button type="button" class="action-btn" on:click={downloadPreview} disabled={isDownloading}>
					Télécharger
				</button>
				<button type="button" class="action-btn danger" on:click={deletePreview}>Supprimer</button>
			</div>
		</div>
	{:else}
		<div class="library-view">
			<div class="toolbar">
				{#if selectionMode}
					<button type="button" class="action-btn" on:click={toggleSelectionMode}>Annuler</button>
					<button type="button" class="action-btn" on:click={allSelected ? clearSelection : selectAll}>
						{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
					</button>
				{:else}
					<button
						type="button"
						class="action-btn"
						on:click={toggleSelectionMode}
						disabled={!photos.length}
					>
						Sélectionner
					</button>
				{/if}
			</div>

			{#if selectionMode && selectedCount > 0}
				<div class="selection-bar">
					<span>{selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}</span>
					<div class="selection-actions">
						<button
							type="button"
							class="action-btn"
							on:click={downloadSelected}
							disabled={isDownloading}
						>
							Télécharger
						</button>
						<button type="button" class="action-btn danger" on:click={deleteSelected}>
							Supprimer
						</button>
					</div>
				</div>
			{/if}

			{#if photos.length === 0}
				<div class="empty">
					<p>Aucune photo pour le moment.</p>
					<p class="hint">Les captures apparaissent ici automatiquement.</p>
				</div>
			{:else}
				<div class="grid">
					{#each photos as photo (photo.id)}
						<button
							type="button"
							class="thumb"
							class:selected={selectedIds.has(photo.id)}
							class:selection-mode={selectionMode}
							on:click={() => openPreview(photo.id)}
						>
							<img src={photo.url} alt="Photo {photo.format}" />
							{#if selectionMode}
								<span class="check" class:on={selectedIds.has(photo.id)} aria-hidden="true"></span>
							{/if}
							<span class="format-tag">{photo.format}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.mediatheque {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #000;
		color: #fff;
		overflow: hidden;
	}

	.library-view,
	.preview-view {
		height: 100%;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.toolbar {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #333;
		flex-shrink: 0;
	}

	.action-btn {
		flex: 1;
		padding: 0.75rem 0.5rem;
		border: 1px solid #333;
		background: transparent;
		color: #888;
		font-size: 0.75rem;
		font-weight: 300;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
	}

	.action-btn:not(:disabled):hover,
	.action-btn:not(:disabled):active {
		border-color: #fff;
		color: #fff;
	}

	.action-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.action-btn.danger {
		border-color: #555;
		color: #aaa;
	}

	.selection-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #333;
		font-size: 0.8rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}

	.selection-actions {
		display: flex;
		gap: 0.5rem;
	}

	.selection-actions .action-btn {
		flex: 0 0 auto;
		padding: 0.6rem 0.75rem;
	}

	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
		color: #888;
		font-weight: 300;
	}

	.empty p {
		margin: 0.25rem 0;
	}

	.hint {
		font-size: 0.85rem;
		color: #555;
	}

	.grid {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 2px;
		padding: 2px;
		align-content: start;
	}

	.thumb {
		position: relative;
		aspect-ratio: 1;
		border: none;
		padding: 0;
		background: #111;
		cursor: pointer;
		overflow: hidden;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.thumb.selected {
		outline: 2px solid #fff;
		outline-offset: -2px;
	}

	.check {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 1.1rem;
		height: 1.1rem;
		border: 1px solid #fff;
		background: rgba(0, 0, 0, 0.35);
	}

	.check.on {
		background: #fff;
	}

	.format-tag {
		position: absolute;
		left: 0.4rem;
		bottom: 0.4rem;
		font-size: 0.65rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #fff;
		background: rgba(0, 0, 0, 0.55);
		padding: 0.15rem 0.35rem;
	}

	.back-btn {
		align-self: flex-start;
		margin: 0.75rem 1rem 0;
		padding: 0.5rem 0;
		border: none;
		background: transparent;
		color: #888;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
	}

	.back-btn:active {
		color: #fff;
	}

	.preview-frame {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.preview-frame img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		border: 1px solid #333;
	}

	.preview-meta {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		padding: 0 1rem 0.5rem;
		font-size: 0.75rem;
		color: #888;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	@media (min-width: 600px) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
