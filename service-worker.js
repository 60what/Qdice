
const CACHE_NAME = 'QdiceOfflineCache';

var cacheWhenInstalled = [
	'./',
	'./icon192.png',
	'./icon512.png',
	'./icon230.png',
	'./qstyle.css',
	'./qscript.js',
	'./Roboto-Black.ttf',
	'./Verdana-Bold.ttf',
];

self.addEventListener('install', (event) => {
	
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => {
		return cache.addAll(cacheWhenInstalled);
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
