import { writable, derived } from 'svelte/store';

function createPhotoLibrary() {
	const { subscribe, update, set } = writable([]);

	return {
		subscribe,
		add(blob, meta = {}) {
			const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const url = URL.createObjectURL(blob);
			const photo = {
				id,
				url,
				blob,
				format: meta.format || '6x6',
				invertColors: !!meta.invertColors,
				blackAndWhite: !!meta.blackAndWhite,
				createdAt: Date.now()
			};
			update((photos) => [photo, ...photos]);
			return id;
		},
		remove(ids) {
			const toRemove = new Set(ids);
			update((photos) => {
				for (const photo of photos) {
					if (toRemove.has(photo.id)) {
						URL.revokeObjectURL(photo.url);
					}
				}
				return photos.filter((photo) => !toRemove.has(photo.id));
			});
		},
		clear() {
			update((photos) => {
				for (const photo of photos) {
					URL.revokeObjectURL(photo.url);
				}
				return [];
			});
		},
		reset() {
			set([]);
		}
	};
}

export const photoLibrary = createPhotoLibrary();
export const photoCount = derived(photoLibrary, ($photos) => $photos.length);
