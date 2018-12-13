import {DBHelper, offlineFavoriteRestaurants} from './dbhelper';

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
    initMap(); // added
    fetchNeighborhoods();
    fetchCuisines();
    registerServiceWorker(); // register service worker

    document.getElementById('neighborhoods-select')
        .addEventListener('change', updateRestaurants);

    document.getElementById('cuisines-select')
        .addEventListener('change', updateRestaurants);

    // when online, sync the reconcile reviews with server
    window.addEventListener('online', syncFavoriteRestaurantsWithServer);
});

/**
 * Register a service worker.
 */
function registerServiceWorker() {
    if (!navigator.serviceWorker) return;

    navigator.serviceWorker.register('/service_worker.js').then(() => {
        console.log('Service worker registered successfully!');
    }).catch((error) => {
        console.log('Error occured while registering service worker: ', error);
    });
}

/**
 * Fetch all neighborhoods and set their HTML.
 */
const fetchNeighborhoods = () => {
    DBHelper.fetchNeighborhoods((error, neighborhoods) => {
        if (error) { // Got an error
            console.error(error);
        } else {
            self.neighborhoods = neighborhoods;
            fillNeighborhoodsHTML();
        }
    });
};

/**
 * Set neighborhoods HTML.
 */
const fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
    const select = document.getElementById('neighborhoods-select');
    neighborhoods.forEach(neighborhood => {
        const option = document.createElement('option');
        option.innerHTML = neighborhood;
        option.value = neighborhood;
        select.append(option);
    });
};

/**
 * Fetch all cuisines and set their HTML.
 */
const fetchCuisines = () => {
    DBHelper.fetchCuisines((error, cuisines) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            self.cuisines = cuisines;
            fillCuisinesHTML();
        }
    });
};

/**
 * Set cuisines HTML.
 */
const fillCuisinesHTML = (cuisines = self.cuisines) => {
    const select = document.getElementById('cuisines-select');

    cuisines.forEach(cuisine => {
        const option = document.createElement('option');
        option.innerHTML = cuisine;
        option.value = cuisine;
        select.append(option);
    });
};

/**
 * Initialize leaflet map, called from HTML.
 */
const initMap = () => {
    self.newMap = L.map('map', {
        center: [40.722216, -73.987501],
        zoom: 12,
        scrollWheelZoom: false
    });
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
        mapboxToken: 'pk.eyJ1IjoiYXNod2lud2FkdGUiLCJhIjoiY2pqc21pdHAwOHdqbjNrbGZ5b2RpNDNobyJ9.ZSdDtFXi3Oxa71lQ7hgZbA',
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
    '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox.streets'
    }).addTo(self.newMap);

    updateRestaurants();
};
/* window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  updateRestaurants();
} */

/**
 * Update page and map for current restaurants.
 */
const updateRestaurants = () => {
    const cSelect = document.getElementById('cuisines-select');
    const nSelect = document.getElementById('neighborhoods-select');

    const cIndex = cSelect.selectedIndex;
    const nIndex = nSelect.selectedIndex;

    const cuisine = cSelect[cIndex].value;
    const neighborhood = nSelect[nIndex].value;

    DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            resetRestaurants(restaurants);
            fillRestaurantsHTML();
        }
    });
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
const resetRestaurants = (restaurants) => {
    // Remove all restaurants
    self.restaurants = [];
    const ul = document.getElementById('restaurants-list');
    ul.innerHTML = '';

    // Remove all map markers
    if (self.markers) {
        self.markers.forEach(marker => marker.remove());
    }
    self.markers = [];
    self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
const fillRestaurantsHTML = (restaurants = self.restaurants) => {
    const ul = document.getElementById('restaurants-list');
    restaurants.forEach(restaurant => {
        ul.append(createRestaurantHTML(restaurant));
    });
    addMarkersToMap();
};

/**
 * Create restaurant HTML.
 */
const createRestaurantHTML = (restaurant) => {
    const li = document.createElement('li');

    const image = document.createElement('img');
    image.className = 'restaurant-img';
    image.src = DBHelper.imageUrlForRestaurant(restaurant);
    image.alt = 'Image of ' + restaurant.name + ' restaurant'; // add alt text as restaurant name
    li.append(image);

    const name = document.createElement('h2');
    name.innerHTML = restaurant.name;
    li.append(name);

    const neighborhood = document.createElement('p');
    neighborhood.innerHTML = restaurant.neighborhood;
    li.append(neighborhood);

    const address = document.createElement('p');
    address.innerHTML = restaurant.address;
    li.append(address);

    const more = document.createElement('a');
    more.innerHTML = 'View Details';
    more.href = DBHelper.urlForRestaurant(restaurant);
    // add aria role of button and label for accessibility
    more.setAttribute('role', 'button');
    more.setAttribute('aria-label', 'view more details of ' + restaurant.name + ' restaurant');

    const favorite = document.createElement('button');
    favorite.className = 'favorite-restaurant';
    favorite.dataset.id = restaurant.id;
    favorite.dataset.favorite = isFavorite(restaurant);
    favorite.setAttribute('aria-label', `mark ${restaurant.name} as favorite restaurant`);
    if (favorite.dataset.favorite === 'true') {
        favorite.innerHTML = '&#10084;';
    } else {
        favorite.innerHTML = '&#9825;';
    }
    favorite.addEventListener('click', toggleFavoriteRestaurant);

    const buttons = document.createElement('section');
    buttons.className = 'action-buttons';
    buttons.append(more);
    buttons.append(favorite);
    li.append(buttons);

    return li;
};

/**
 * Add markers for current restaurants to the map.
 */
const addMarkersToMap = (restaurants = self.restaurants) => {
    restaurants.forEach(restaurant => {
    // Add marker to the map
        const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.newMap);
        marker.on('click', onClick);
        function onClick() {
            window.location.href = marker.options.url;
        }
        self.markers.push(marker);
    });

};
/* addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url
    });
    self.markers.push(marker);
  });
} */

/**
 * Sync favorite restaurants with server
 */
const syncFavoriteRestaurantsWithServer = () => {
    Promise.all(offlineFavoriteRestaurants.map(restaurant => {
        DBHelper.postFavoriteRestaurantToServer(restaurant);
    })).then(_ => {
        offlineFavoriteRestaurants.length = 0;
    }).catch(_ => {
        offlineFavoriteRestaurants.length = 0;
    });
};

/**
 * Return true if this is favorite restaurant, else false
 */
const isFavorite = (restaurant) => {
    if (restaurant.is_favorite === undefined || restaurant.is_favorite === 'undefined' || restaurant.is_favorite === false || restaurant.is_favorite === 'false')
        return false;
    return true;
};

/**
 * Toggle favorite restaurant
 */
const toggleFavoriteRestaurant = (event) => {
    const restaurant_id = event.target.dataset.id;
    let isFavorite = event.target.dataset.favorite;

    if (isFavorite === 'true') {
        isFavorite = false;
        event.target.innerHTML = '&#9825;';
    } else {
        isFavorite = true;
        event.target.innerHTML = '&#10084;';
    }
    event.target.dataset.favorite = isFavorite;

    const restaurant = {
        'restaurant_id': restaurant_id,
        'isFavorite': isFavorite
    };
    DBHelper.postFavoriteRestaurantToDb(restaurant);
};
