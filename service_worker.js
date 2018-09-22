const staticCacheName = 'restaurant-static-v1';
const dynamicCacheName = 'restaurant-dynamic-v1';
const allCaches = [
    staticCacheName,
    dynamicCacheName
];

const cssFiles = [
    'https://unpkg.com/leaflet@1.3.1/dist/leaflet.css',
    '/css/styles.css'
];

const jsFiles = [
    'https://unpkg.com/leaflet@1.3.1/dist/leaflet.js',
    '/js/main.min.js',
    '/js/restaurant.min.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(staticCacheName).then((cache) => {
            cache.addAll([
                '/',
                ...cssFiles,
                ...jsFiles
            ]);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((cacheName) => {
                    return cacheName.startsWith('restaurant-') && !allCaches.includes(cacheName);
                }).map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request)
                .then((fetchResponse) => {
                    return caches.open(dynamicCacheName)
                        .then((cache) => {
                            cache.put(event.request.url, fetchResponse.clone());
                            return fetchResponse;
                        });
                });
        })
    );
});