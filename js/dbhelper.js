/**
 * Common database helper functions.
 */
import idb from 'idb';

export let offlineFavoriteRestaurants = [];
export let offlineReviews = [];

export class DBHelper {
    /**
     * Database URL.
     * Change this to restaurants.json file location on your server.
     */
    static get DATABASE_URL() {
        const port = 1337; // Change this to your server port
        return `http://localhost:${port}/restaurants`;
    }

    static openIdb() {
        // If the browser doesn't support service worker,
        // we don't care about having a database
        if (!navigator.serviceWorker) {
            return Promise.resolve();
        }

        return idb.open('restaurant', 2, function(upgradeDb) {
            switch (upgradeDb.oldVersion) {
            case 0:
                upgradeDb.createObjectStore('restaurants');
                // falls through
            case 1:
                upgradeDb.createObjectStore('reviews');
            }
        });
    }

    /**
     * Get all restaurants from restaurants-list.
     */
    static getRestaurantsFromDb(dbPromise) {
        return dbPromise.then(db => {
            if (!db) return;
            let tx = db.transaction('restaurants');
            return tx.objectStore('restaurants').get('restaurants-list');
        });
    }

    /**
     * Update restaurants in db.
     */
    static putRestaurantsInDb(dbPromise, restaurants) {
        return dbPromise.then(db => {
            if (!db) return;
            let tx = db.transaction('restaurants', 'readwrite');
            tx.objectStore('restaurants').put(restaurants, 'restaurants-list');
            tx.complete;
        });
    }

    /**
     * Get all reviews for given restuarant Id from db.
     */
    static getReviewsForRestaurantFromDb(dbPromise, restaurantId) {
        return dbPromise.then(db => {
            if (!db) return;
            let tx = db.transaction('reviews');
            return tx.objectStore('reviews').get(restaurantId);
        });
    }

    /**
     * Update reviews for given restaurant Id in db.
     */
    static putReviewsForRestaurantInDb(dbPromise, reviews, restaurantId) {
        return dbPromise.then(db => {
            if (!db) return;
            let tx = db.transaction('reviews', 'readwrite');
            tx.objectStore('reviews').put(reviews, restaurantId);
            tx.complete;
        });
    }

    /**
     * Fetch all restaurants from db or server.
     */
    static fetchRestaurants(callback) {
        const dbPromise = DBHelper.openIdb();

        DBHelper.getRestaurantsFromDb(dbPromise)
            .then(restaurants => {
                if (restaurants && restaurants.length > 0) {
                    // restaurants fetched from idb
                    callback(null, restaurants);
                }
                else {
                    return fetch(DBHelper.DATABASE_URL);
                }
            }).then(response => {
                // Got a success response from server!
                if (!response) return;
                return response.json();
            }).then(restaurants => {
                if (!restaurants) return;
                DBHelper.putRestaurantsInDb(dbPromise, restaurants);
                callback(null, restaurants);
            }).catch(error => {
                // Oops!. Got an error from server.
                const errorMessage = (`Request failed. Returned status of ${error}`);
                callback(errorMessage, null);
            });
    }

    /**
     * Fetch all reviews by restaurant from db or server.
     */
    static fetchReviewsByRestaurantId(restaurantId, callback) {
        const port = 1337; // Change this to your server port
        const url = `http://localhost:${port}/reviews/?restaurant_id=${restaurantId}`;
        const dbPromise = DBHelper.openIdb();

        DBHelper.getReviewsForRestaurantFromDb(dbPromise, restaurantId)
            .then(reviews => {
                if (reviews && reviews.length > 0) {
                    callback(null, reviews);
                }
                else {
                    return fetch(url);
                }
            }).then(response => {
                if (!response) return;
                return response.json();
            }).then(reviews => {
                if (!reviews || (reviews && reviews.length === 0)) return;
                DBHelper.putReviewsForRestaurantInDb(dbPromise, reviews, restaurantId);
                callback(null, reviews);
            }).catch(error => {
                const errorMessage = (`Request failed. Returned status of ${error}`);
                callback(errorMessage, null);
            });
    }

    /**
     * Post the new reviews to db.
     */
    static postNewReviewToDb(review) {
        const dbPromise = DBHelper.openIdb();
        const restaurant_id = review.restaurant_id;

        DBHelper.getReviewsForRestaurantFromDb(dbPromise, restaurant_id)
            .then(reviews => {
                if (!reviews || (reviews && reviews.length === 0)) return;
                reviews.push(review);
                DBHelper.putReviewsForRestaurantInDb(dbPromise, reviews, restaurant_id);
                // update to server as well if online, else defer
                if (navigator.onLine) {
                    DBHelper.postNewReviewToServer(review);
                } else {
                    offlineReviews.push(review);
                }
            });
    }

    /**
     * Post the new reviews to server.
     */
    static postNewReviewToServer(review) {
        const port = 1337;
        const postNewReviewsUrl = `http://localhost:${port}/reviews`;
        const newReview = {
            'restaurant_id': review.restaurant_id,
            'name': review.name,
            'rating': review.rating,
            'comments': review.comments,
            'createdAt': review.createdAt,
            'updatedAt': review.updatedAt
        };
        return fetch(postNewReviewsUrl, {
            method: 'POST',
            body: JSON.stringify(newReview),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Post the favorite restaurant to db.
     */
    static postFavoriteRestaurantToDb(restaurant) {
        const dbPromise = DBHelper.openIdb();
        DBHelper.getRestaurantsFromDb(dbPromise)
            .then(restaurants => {
                if (!restaurants || (restaurants && restaurants.length === 0)) return;
                const updatedRestaurants = restaurants.map(restaurantOfDB => {
                    if (restaurantOfDB.id == restaurant.restaurant_id) {
                        restaurantOfDB.is_favorite = restaurant.isFavorite;
                    }
                    return restaurantOfDB;
                });
                DBHelper.putRestaurantsInDb(dbPromise, updatedRestaurants);
                if (navigator.onLine) {
                    DBHelper.postFavoriteRestaurantToServer(restaurant);
                } else {
                    offlineFavoriteRestaurants.push(restaurant);
                }
            });
    }

    /**
     * Post the favorite restaurant to server.
     */
    static postFavoriteRestaurantToServer(restaurant) {
        const updateFavoriteRestaurantUrl = `http://localhost:1337/restaurants/${restaurant.restaurant_id}/?is_favorite=${restaurant.isFavorite}`;
        return fetch(updateFavoriteRestaurantUrl, {method: 'PUT'});
    }

    /**
     * Fetch a restaurant by its ID.
     */
    static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                const restaurant = restaurants.find(r => r.id == id);
                if (restaurant) { // Got the restaurant
                    callback(null, restaurant);
                } else { // Restaurant does not exist in the database
                    callback('Restaurant does not exist', null);
                }
            }
        });
    }

    /**
     * Fetch restaurants by a cuisine type with proper error handling.
     */
    static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Filter restaurants to have only given cuisine type
                const results = restaurants.filter(r => r.cuisine_type == cuisine);
                callback(null, results);
            }
        });
    }

    /**
     * Fetch restaurants by a neighborhood with proper error handling.
     */
    static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Filter restaurants to have only given neighborhood
                const results = restaurants.filter(r => r.neighborhood == neighborhood);
                callback(null, results);
            }
        });
    }

    /**
     * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
     */
    static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                let results = restaurants;
                if (cuisine != 'all') { // filter by cuisine
                    results = results.filter(r => r.cuisine_type == cuisine);
                }
                if (neighborhood != 'all') { // filter by neighborhood
                    results = results.filter(r => r.neighborhood == neighborhood);
                }
                callback(null, results);
            }
        });
    }

    /**
     * Fetch all neighborhoods with proper error handling.
     */
    static fetchNeighborhoods(callback) {
    // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all neighborhoods from all restaurants
                const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
                // Remove duplicates from neighborhoods
                const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
                callback(null, uniqueNeighborhoods);
            }
        });
    }

    /**
     * Fetch all cuisines with proper error handling.
     */
    static fetchCuisines(callback) {
    // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all cuisines from all restaurants
                const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
                // Remove duplicates from cuisines
                const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
                callback(null, uniqueCuisines);
            }
        });
    }

    /**
     * Restaurant page URL.
     */
    static urlForRestaurant(restaurant) {
        return (`./restaurant.html?id=${restaurant.id}`);
    }

    /**
     * Restaurant image URL.
     */
    static imageUrlForRestaurant(restaurant, webp) {
        if (webp)
            return (`/img/webp/${restaurant.photograph}.webp`);
        return (`/img/${restaurant.photograph}.jpg`);
    }

    /**
     * Map marker for a restaurant.
     */
    static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker
        const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
            {
                title: restaurant.name,
                alt: restaurant.name,
                url: DBHelper.urlForRestaurant(restaurant)
            });
        marker.addTo(newMap);
        return marker;
    }
    /* static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  } */

}

// export default DBHelper;