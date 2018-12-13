import {DBHelper, offlineReviews} from './dbhelper';

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
    initMap();
    const reviewFormRating = document.querySelector('.review-form-rating');
    const reviewFormSubmitButton = document.querySelector('.review-form-submit-button');

    // validate rating on change or keyup
    reviewFormRating.addEventListener('change', validateRating);
    reviewFormRating.addEventListener('keyup', validateRating);
    // submit review if button is clicked
    reviewFormSubmitButton.addEventListener('click', addReview);
    // when online, sync the reconcile reviews with server
    window.addEventListener('online', syncReviewsWithServer);
});

/**
 * Initialize leaflet map
 */
const initMap = () => {
    fetchRestaurantFromURL((error, restaurant) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            self.newMap = L.map('map', {
                center: [restaurant.latlng.lat, restaurant.latlng.lng],
                zoom: 16,
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
            fillBreadcrumb();
            DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
        }
    });
};

/* window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
} */

/**
 * Get current restaurant from page URL.
 */
const fetchRestaurantFromURL = (callback) => {
    if (self.restaurant) { // restaurant already fetched!
        callback(null, self.restaurant);
        return;
    }
    const id = getParameterByName('id');
    if (!id) { // no id found in URL
        error = 'No restaurant id in URL';
        callback(error, null);
    } else {
        DBHelper.fetchRestaurantById(id, (error, restaurant) => {
            self.restaurant = restaurant;
            if (!restaurant) {
                console.error(error);
                return;
            }
            fillRestaurantHTML();
            callback(null, restaurant);
        });
    }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
const fillRestaurantHTML = (restaurant = self.restaurant) => {
    const name = document.getElementById('restaurant-name');
    name.innerHTML = restaurant.name;

    const address = document.getElementById('restaurant-address');
    address.innerHTML = restaurant.address;

    const image = document.getElementById('restaurant-img');
    image.className = 'restaurant-img';
    image.src = DBHelper.imageUrlForRestaurant(restaurant);
    image.alt = 'Image of ' + restaurant.name + ' restaurant'; // add alt text as restaurant name

    const cuisine = document.getElementById('restaurant-cuisine');
    cuisine.innerHTML = restaurant.cuisine_type;

    // fill operating hours
    if (restaurant.operating_hours) {
        fillRestaurantHoursHTML();
    }
    // fill reviews
    fillReviewsHTML();
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
const fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
    const hours = document.getElementById('restaurant-hours');
    for (let key in operatingHours) {
        const row = document.createElement('tr');

        const day = document.createElement('td');
        day.innerHTML = key;
        day.className = 'restaurant-hours-day';
        row.appendChild(day);

        const time = document.createElement('td');
        time.innerHTML = operatingHours[key];
        time.className = 'restaurant-hours-time';
        row.appendChild(time);

        hours.appendChild(row);
    }
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
const fillReviewsHTML = () => {
    const restaurantId = self.restaurant.id;
    const container = document.getElementById('reviews-container');
    const title = document.createElement('h2');
    const ul = document.getElementById('reviews-list');
    const reviewFormSection = document.querySelector('.review-form-section');
    title.innerHTML = 'Reviews';
    // use these methods instead of appendChild which appends at the end in parent node.
    container.insertAdjacentElement('afterbegin', title);

    DBHelper.fetchReviewsByRestaurantId(restaurantId, (error, reviews) => {
        if (error) { // Got an error!
            console.error(error);
        } else if (!reviews) {
            const noReviews = document.createElement('p');
            noReviews.innerHTML = 'No reviews yet!';
            container.insertBefore(noReviews, reviewFormSection);
            return;
        } else {
            // got the reviews
            reviews.forEach(review => {
                ul.appendChild(createReviewHTML(review));
            });
        }
    });
};

/**
 * Create review HTML and add it to the webpage.
 */
const createReviewHTML = (review) => {
    const li = document.createElement('li');
    const name = document.createElement('p');
    name.innerHTML = review.name;
    name.className = 'review-name';
    li.appendChild(name);

    const date = document.createElement('p');
    date.innerHTML = new Date(review.updatedAt).toLocaleString();
    date.className = 'review-date';
    li.appendChild(date);

    const rating = document.createElement('p');
    rating.innerHTML = `Rating: ${review.rating}`;
    rating.className = 'review-rating';
    li.appendChild(rating);

    const comments = document.createElement('p');
    comments.innerHTML = review.comments;
    comments.className = 'review-comments';
    li.appendChild(comments);

    return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
const fillBreadcrumb = (restaurant = self.restaurant) => {
    const breadcrumb = document.getElementById('breadcrumb');
    const li = document.createElement('li');
    li.innerHTML = restaurant.name;
    breadcrumb.appendChild(li);
};

/**
 * Get a parameter by name from page URL.
 */
const getParameterByName = (name, url) => {
    if (!url)
        url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
        results = regex.exec(url);
    if (!results)
        return null;
    if (!results[2])
        return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

/**
 * Validate rating.
 * It can be between 1 to 5, both inclusive.
 */
const validateRating = (event) => {
    const rating = event.target.value;
    if (rating < 1) {
        event.target.value = 1;
    } else if (rating > 5) {
        event.target.value = 5;
    }
};

/**
 * Add new review of user.
 */
const addReview = () => {
    const nameField = document.querySelector('.review-form-name');
    const ratingField = document.querySelector('.review-form-rating');
    const commentsField = document.querySelector('.review-form-comments');

    const name = nameField.value;
    const rating = ratingField.value;
    const comments = commentsField.textContent;

    // validate values
    if (isEmpty(name) || isEmpty(name) || isEmpty(comments)) {
        alert('Please fill all fields');
        return;
    }

    const review = {
        'restaurant_id': self.restaurant.id,
        'name': name,
        'rating': rating,
        'comments': comments,
        'createdAt': new Date().toISOString(),
        'updatedAt': new Date().toISOString()
    };

    // append this newly created comment to existing comments list
    const ul = document.getElementById('reviews-list');
    ul.appendChild(createReviewHTML(review));
    DBHelper.postNewReviewToDb(review);
    // reset form for reuse
    resetReviewForm(nameField, ratingField, commentsField);
};

/**
 * Check and return true, if the value is empty.
 */
const isEmpty = (value) => {
    if (value == null || value == '')
        return true;
    return false;
};

/**
 * Reset the fields of review form for reuse
 */
const resetReviewForm = (nameField, ratingField, commentsField) => {
    nameField.value = '';
    ratingField.value = '';
    commentsField.textContent = 'Enter comment';
};

/**
 * Sync reviews with server
 */
const syncReviewsWithServer = () => {
    Promise.all(offlineReviews.map(review => {
        DBHelper.postNewReviewToServer(review);
    })).then(_ => {
        offlineReviews.length = 0;
    }).catch(_ => {
        offlineReviews.length = 0;
    });
};