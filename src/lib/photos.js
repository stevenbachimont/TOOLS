import { writable, derived, get } from 'svelte/store';

const DB_NAME = 'numerisation-mediatheque';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

function openDb() {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			reject(new Error('IndexedDB indisponible'));
			return;
		}

		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				store.createIndex('createdAt', 'createdAt', { unique: false });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error || new Error('Ouverture IndexedDB impossible'));
	});
}

function requestToPromise(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function dbGetAll() {
	const db = await openDb();
	try {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const records = await requestToPromise(store.getAll());
		return records || [];
	} finally {
		db.close();
	}
}

async function dbPut(record) {
	const db = await openDb();
	try {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.put(record);
		await new Promise((resolve, reject) => {
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}

async function dbDeleteMany(ids) {
	const db = await openDb();
	try {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		for (const id of ids) {
			store.delete(id);
		}
		await new Promise((resolve, reject) => {
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}

async function dbClear() {
	const db = await openDb();
	try {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).clear();
		await new Promise((resolve, reject) => {
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}

function toRuntimePhoto(record) {
	return {
		id: record.id,
		url: URL.createObjectURL(record.blob),
		blob: record.blob,
		format: record.format || '6x6',
		invertColors: !!record.invertColors,
		blackAndWhite: !!record.blackAndWhite,
		createdAt: record.createdAt || Date.now()
	};
}

function toStoredRecord(photo) {
	return {
		id: photo.id,
		blob: photo.blob,
		format: photo.format,
		invertColors: photo.invertColors,
		blackAndWhite: photo.blackAndWhite,
		createdAt: photo.createdAt
	};
}

function createPhotoLibrary() {
	const store = writable([]);
	const { subscribe, update, set } = store;
	let readyPromise = null;

	async function init() {
		if (typeof window === 'undefined') return [];

		try {
			const records = await dbGetAll();
			const photos = records
				.map(toRuntimePhoto)
				.sort((a, b) => b.createdAt - a.createdAt);
			set(photos);
			return photos;
		} catch (error) {
			console.error('Chargement médiathèque impossible:', error);
			set([]);
			return [];
		}
	}

	return {
		subscribe,
		ready() {
			if (!readyPromise) readyPromise = init();
			return readyPromise;
		},
		async add(blob, meta = {}) {
			const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const photo = {
				id,
				url: URL.createObjectURL(blob),
				blob,
				format: meta.format || '6x6',
				invertColors: !!meta.invertColors,
				blackAndWhite: !!meta.blackAndWhite,
				createdAt: Date.now()
			};

			update((photos) => [photo, ...photos]);

			try {
				await dbPut(toStoredRecord(photo));
			} catch (error) {
				console.error('Sauvegarde photo impossible:', error);
			}

			return id;
		},
		async remove(ids) {
			const toRemove = new Set(ids);

			update((photos) => {
				for (const photo of photos) {
					if (toRemove.has(photo.id)) {
						URL.revokeObjectURL(photo.url);
					}
				}
				return photos.filter((photo) => !toRemove.has(photo.id));
			});

			try {
				await dbDeleteMany([...toRemove]);
			} catch (error) {
				console.error('Suppression photo impossible:', error);
			}
		},
		async clear() {
			const photos = get(store);
			for (const photo of photos) {
				URL.revokeObjectURL(photo.url);
			}
			set([]);

			try {
				await dbClear();
			} catch (error) {
				console.error('Vidage médiathèque impossible:', error);
			}
		}
	};
}

export const photoLibrary = createPhotoLibrary();
export const photoCount = derived(photoLibrary, ($photos) => $photos.length);
