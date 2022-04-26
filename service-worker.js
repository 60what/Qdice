
const CACHE_NAME = 'QdiceOfflineCache';

var cacheWhenRegistered = [
	'./index.html?user_mode=app',
	'./qstyle.css',
	'./qscript.js',
	'./Roboto-Black.ttf',
	'./Verdana-Bold.ttf',
	'./icon512.png',
	'./qdice.webmanifest',
];

self.addEventListener('install', (event) => {
	
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => {
		return cache.addAll(cacheWhenRegistered);
	}));
});

self.addEventListener('fetch', (event) => {

    event.respondWith(caches.open(CACHE_NAME).then((cache) => {
		// check online first
		return fetch(event.request.url).then((fetchedResponse) => {
			cache.put(event.request, fetchedResponse.clone());
			return fetchedResponse;
		}).catch(() => {
			// but if offline, use cache
			return cache.match(event.request.url);
		});
    }));
});
