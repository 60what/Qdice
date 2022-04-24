
const CACHE_NAME = 'QdiceOfflineCache';

self.addEventListener('fetch', (event) => {

	// Open the cache
    event.respondWith(caches.open(CACHE_NAME).then((cache) => {
		// Go to the network first
		return fetch(event.request.url).then((fetchedResponse) => {
			cache.put(event.request, fetchedResponse.clone());
			return fetchedResponse;
		}).catch(() => {
			// If the network is unavailable, get
			return cache.match(event.request.url);
		});
    }));
});
