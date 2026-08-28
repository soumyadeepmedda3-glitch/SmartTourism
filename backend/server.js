const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================================================
   LIMITS
========================================================= */

const MAX_RECOMMENDED_PLACES = 12;
const MAX_MAP_PLACES = 40;
const MAX_RECOMMENDED_HOTELS = 8;

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

/* =========================================================
   MYSQL
========================================================= */

let db = null;

async function connectDatabase() {
  try {
    db = await mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "smarttourism",
      port: Number(process.env.DB_PORT) || 3306,

      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    await db.query("SELECT 1");

    console.log("======================================");
    console.log("✅ MySQL connected successfully");
    console.log("======================================");
  } catch (error) {
    console.error("⚠️ MySQL connection failed:");
    console.error(error.message);

    db = null;
  }
}

/* =========================================================
   FETCH WITH TIMEOUT
========================================================= */

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 12000
) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   SLEEP
========================================================= */

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* =========================================================
   CLEAN TEXT
========================================================= */

function cleanText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

/* =========================================================
   NORMALIZE NAME
========================================================= */

function normalizeName(name) {
  return cleanText(name)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

/* =========================================================
   SAFE NUMBER
========================================================= */

function safeNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

/* =========================================================
   GEOCODE DESTINATION
========================================================= */

async function geocodeDestination(destination) {
  try {
    console.log(
      `🔎 Geocoding destination: ${destination}`
    );

    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: destination,
        format: "jsonv2",
        limit: "1",
        addressdetails: "1",
      });

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent":
            "SmartTourism/1.0 tourism-hackathon-app",
          Accept: "application/json",
        },
      },
      8000
    );

    if (!response.ok) {
      throw new Error(
        `Nominatim HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {
      return null;
    }

    const result = data[0];

    const latitude = Number(result.lat);
    const longitude = Number(result.lon);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    console.log(
      `✅ Destination found: ${result.display_name}`
    );

    return {
      latitude,
      longitude,
      displayName: result.display_name,
      address: result.address || {},
    };
  } catch (error) {
    console.error(
      "❌ Geocoding failed:",
      error.message
    );

    return null;
  }
}

/* =========================================================
   OVERPASS SERVERS
========================================================= */

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/* =========================================================
   TOURISM QUERY
========================================================= */

function buildTourismQuery(
  latitude,
  longitude
) {
  const radius = 15000;

  return `
[out:json][timeout:12];

(
  nwr["tourism"="attraction"](around:${radius},${latitude},${longitude});
  nwr["tourism"="museum"](around:${radius},${latitude},${longitude});
  nwr["tourism"="viewpoint"](around:${radius},${latitude},${longitude});
  nwr["tourism"="gallery"](around:${radius},${latitude},${longitude});
  nwr["tourism"="zoo"](around:${radius},${latitude},${longitude});
  nwr["tourism"="theme_park"](around:${radius},${latitude},${longitude});
  nwr["tourism"="aquarium"](around:${radius},${latitude},${longitude});
  nwr["tourism"="artwork"](around:${radius},${latitude},${longitude});

  nwr["leisure"="park"](around:${radius},${latitude},${longitude});

  nwr["historic"](around:${radius},${latitude},${longitude});

  nwr["amenity"="place_of_worship"](around:${radius},${latitude},${longitude});

  nwr["natural"="beach"](around:${radius},${latitude},${longitude});
  nwr["natural"="water"](around:${radius},${latitude},${longitude});
);

out center tags;
`;
}

/* =========================================================
   HOTEL QUERY
========================================================= */

function buildHotelQuery(
  latitude,
  longitude
) {
  const radius = 20000;

  return `
[out:json][timeout:15];

(
  nwr["tourism"="hotel"](around:${radius},${latitude},${longitude});
  nwr["tourism"="guest_house"](around:${radius},${latitude},${longitude});
  nwr["tourism"="hostel"](around:${radius},${latitude},${longitude});
  nwr["tourism"="motel"](around:${radius},${latitude},${longitude});
  nwr["tourism"="apartment"](around:${radius},${latitude},${longitude});
);

out center tags;
`;
}

/* =========================================================
   GET OSM COORDINATES
========================================================= */

function getOSMCoordinates(element) {
  let latitude = null;
  let longitude = null;

  if (
    element.lat !== undefined &&
    element.lon !== undefined
  ) {
    latitude = Number(element.lat);
    longitude = Number(element.lon);
  } else if (
    element.center &&
    element.center.lat !== undefined &&
    element.center.lon !== undefined
  ) {
    latitude = Number(element.center.lat);
    longitude = Number(element.center.lon);
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

/* =========================================================
   PLACE CATEGORY
========================================================= */

function getPlaceCategory(tags) {
  if (tags.tourism === "museum") {
    return "Museum";
  }

  if (tags.tourism === "viewpoint") {
    return "Viewpoint";
  }

  if (tags.tourism === "gallery") {
    return "Gallery";
  }

  if (tags.tourism === "zoo") {
    return "Zoo";
  }

  if (tags.tourism === "theme_park") {
    return "Theme Park";
  }

  if (tags.tourism === "aquarium") {
    return "Aquarium";
  }

  if (tags.tourism === "artwork") {
    return "Artwork";
  }

  if (tags.leisure === "park") {
    return "Park";
  }

  if (tags.historic) {
    return "Historical Place";
  }

  if (
    tags.amenity ===
    "place_of_worship"
  ) {
    return "Religious Place";
  }

  if (tags.natural === "beach") {
    return "Beach";
  }

  if (tags.natural === "water") {
    return "Water Attraction";
  }

  return "Tourist Attraction";
}

/* =========================================================
   GET PLACE COST FROM OSM
========================================================= */

function getOSMPlaceCost(tags) {
  /*
    We only use a price if OSM explicitly
    provides one.

    We NEVER use 0 as a fake price.
  */

  const possiblePrices = [
    tags.fee,
    tags.price,
    tags["charge:amount"],
  ];

  for (const value of possiblePrices) {
    if (!value) {
      continue;
    }

    const match =
      String(value).match(
        /[\d,]+(?:\.\d+)?/
      );

    if (match) {
      const price = Number(
        match[0].replace(/,/g, "")
      );

      if (Number.isFinite(price)) {
        return price;
      }
    }
  }

  return null;
}

/* =========================================================
   CONVERT OSM PLACES
========================================================= */

function convertOSMPlaces(elements) {
  const places = [];

  for (const element of elements || []) {
    const tags = element.tags || {};

    const coordinates =
      getOSMCoordinates(element);

    if (!coordinates) {
      continue;
    }

    const name =
      tags.name ||
      tags["name:en"] ||
      tags.alt_name ||
      tags.official_name ||
      "";

    if (!cleanText(name)) {
      continue;
    }

    const category =
      getPlaceCategory(tags);

    const description =
      tags.description ||
      `${category} near the selected destination.`;

    const estimatedCost =
      getOSMPlaceCost(tags);

    places.push({
      id:
        `osm-${element.type}-${element.id}`,

      name:
        cleanText(name),

      category,

      description:
        cleanText(description),

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

      /*
        null means price is not known.
        NEVER show fake ₹0.
      */
      estimated_cost:
        estimatedCost,

      state:
        cleanText(
          tags["addr:state"]
        ),

      source:
        "OpenStreetMap",
    });
  }

  return removeDuplicatePlaces(
    places
  );
}

/* =========================================================
   GET HOTEL PRICE
========================================================= */

function getOSMHotelPrice(tags) {
  const possiblePrices = [
    tags.price,
    tags["price:night"],
    tags["charge:night"],
    tags["charge"],
  ];

  for (const value of possiblePrices) {
    if (!value) {
      continue;
    }

    const match =
      String(value).match(
        /[\d,]+(?:\.\d+)?/
      );

    if (match) {
      const price = Number(
        match[0].replace(/,/g, "")
      );

      if (Number.isFinite(price)) {
        return price;
      }
    }
  }

  return null;
}

/* =========================================================
   CONVERT OSM HOTELS
========================================================= */

function convertOSMHotels(elements) {
  const hotels = [];

  for (const element of elements || []) {
    const tags = element.tags || {};

    const coordinates =
      getOSMCoordinates(element);

    if (!coordinates) {
      continue;
    }

    const name =
      tags.name ||
      tags["name:en"] ||
      tags.alt_name ||
      "";

    if (!cleanText(name)) {
      continue;
    }

    let category = "Hotel";

    if (
      tags.tourism ===
      "guest_house"
    ) {
      category = "Guest House";
    } else if (
      tags.tourism ===
      "hostel"
    ) {
      category = "Hostel";
    } else if (
      tags.tourism ===
      "motel"
    ) {
      category = "Motel";
    } else if (
      tags.tourism ===
      "apartment"
    ) {
      category = "Apartment";
    }

    const price =
      getOSMHotelPrice(tags);

    const rating =
      tags.stars
        ? Number(tags.stars)
        : null;

    hotels.push({
      id:
        `osm-hotel-${element.type}-${element.id}`,

      name:
        cleanText(name),

      category,

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,

      /*
        null = current price unavailable
      */
      price_per_night:
        Number.isFinite(price)
          ? price
          : null,

      rating:
        Number.isFinite(rating)
          ? rating
          : null,

      address:
        cleanText(
          tags["addr:street"] ||
          tags["addr:city"] ||
          ""
        ),

      source:
        "OpenStreetMap",
    });
  }

  return removeDuplicateHotels(
    hotels
  );
}

/* =========================================================
   REMOVE DUPLICATE PLACES
========================================================= */

function removeDuplicatePlaces(
  places
) {
  const unique = [];
  const seen = new Set();

  for (const place of places) {
    const key =
      normalizeName(place.name);

    if (!key) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    unique.push(place);
  }

  return unique;
}

/* =========================================================
   REMOVE DUPLICATE HOTELS
========================================================= */

function removeDuplicateHotels(
  hotels
) {
  const unique = [];
  const seen = new Set();

  for (const hotel of hotels) {
    const key =
      normalizeName(hotel.name);

    if (!key) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    unique.push(hotel);
  }

  return unique;
}

/* =========================================================
   OVERPASS REQUEST
========================================================= */

async function queryOverpass(query) {
  for (const server of OVERPASS_SERVERS) {
    try {
      console.log(
        `🌐 Trying Overpass: ${server}`
      );

      const response =
        await fetchWithTimeout(
          server,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",

              "User-Agent":
                "SmartTourism/1.0 tourism-hackathon-app",

              Accept:
                "application/json",
            },

            body:
              "data=" +
              encodeURIComponent(query),
          },
          14000
        );

      if (!response.ok) {
        console.log(
          `⚠️ Overpass HTTP ${response.status}`
        );

        continue;
      }

      const data =
        await response.json();

      if (
        data &&
        Array.isArray(
          data.elements
        )
      ) {
        return data.elements;
      }
    } catch (error) {
      console.log(
        `⚠️ Overpass failed: ${error.message}`
      );
    }
  }

  return [];
}

/* =========================================================
   FIND TOURIST PLACES
========================================================= */

async function findTouristPlaces(
  latitude,
  longitude
) {
  const query =
    buildTourismQuery(
      latitude,
      longitude
    );

  const elements =
    await queryOverpass(query);

  const places =
    convertOSMPlaces(elements);

  console.log(
    `🗺️ OSM tourist places: ${places.length}`
  );

  return places;
}

/* =========================================================
   FIND HOTELS
========================================================= */

async function findHotels(
  latitude,
  longitude
) {
  const query =
    buildHotelQuery(
      latitude,
      longitude
    );

  const elements =
    await queryOverpass(query);

  const hotels =
    convertOSMHotels(elements);

  console.log(
    `🏨 OSM hotels: ${hotels.length}`
  );

  return hotels;
}

/* =========================================================
   DISTANCE
========================================================= */

function calculateDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const earthRadius = 6371;

  const dLat =
    ((lat2 - lat1) *
      Math.PI) /
    180;

  const dLon =
    ((lon2 - lon1) *
      Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(
      (lat1 * Math.PI) /
        180
    ) *
      Math.cos(
        (lat2 * Math.PI) /
          180
      ) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

/* =========================================================
   INTEREST KEYWORDS
========================================================= */

const INTEREST_KEYWORDS = {
  Nature: [
    "nature",
    "park",
    "beach",
    "lake",
    "water",
    "garden",
    "forest",
    "viewpoint",
    "river",
    "natural",
  ],

  Adventure: [
    "adventure",
    "beach",
    "water",
    "park",
    "theme",
    "viewpoint",
    "activity",
    "zoo",
  ],

  Food: [
    "food",
    "restaurant",
    "cafe",
    "market",
    "street",
  ],

  Culture: [
    "culture",
    "museum",
    "gallery",
    "temple",
    "church",
    "mosque",
    "heritage",
    "art",
    "religious",
  ],

  History: [
    "historic",
    "historical",
    "heritage",
    "museum",
    "fort",
    "palace",
    "monument",
    "temple",
  ],

  Shopping: [
    "market",
    "shopping",
    "mall",
    "bazaar",
    "shop",
  ],

  All: [],
};

/* =========================================================
   PLACE SCORE
========================================================= */

function scorePlace(
  place,
  interest,
  destinationLocation
) {
  const name =
    cleanText(
      place.name
    ).toLowerCase();

  const category =
    cleanText(
      place.category
    ).toLowerCase();

  const description =
    cleanText(
      place.description
    ).toLowerCase();

  const combined =
    `${name} ${category} ${description}`;

  const distance =
    calculateDistanceKm(
      destinationLocation.latitude,
      destinationLocation.longitude,
      Number(place.latitude),
      Number(place.longitude)
    );

  let score = 0;

  /* =======================================================
     DISTANCE
  ======================================================= */

  if (distance <= 2) {
    score += 40;
  } else if (distance <= 5) {
    score += 32;
  } else if (distance <= 10) {
    score += 22;
  } else if (distance <= 15) {
    score += 12;
  } else {
    score += 5;
  }

  /* =======================================================
     INTEREST MATCHING
  ======================================================= */

  const keywords =
    INTEREST_KEYWORDS[
      interest
    ] || [];

  for (const keyword of keywords) {
    if (
      combined.includes(
        keyword.toLowerCase()
      )
    ) {
      score += 20;
    }
  }

  /* =======================================================
     CATEGORY BONUS
  ======================================================= */

  if (
    interest === "Nature" &&
    [
      "park",
      "beach",
      "viewpoint",
      "water attraction",
    ].includes(category)
  ) {
    score += 30;
  }

  if (
    interest === "History" &&
    category.includes("histor")
  ) {
    score += 35;
  }

  if (
    interest === "Culture" &&
    [
      "museum",
      "gallery",
      "religious place",
      "artwork",
    ].includes(category)
  ) {
    score += 30;
  }

  if (
    interest === "Adventure" &&
    [
      "theme park",
      "beach",
      "water attraction",
      "viewpoint",
      "zoo",
    ].includes(category)
  ) {
    score += 30;
  }

  return {
    score,
    distance,
  };
}

/* =========================================================
   RANK PLACES
========================================================= */

function rankPlaces(
  places,
  interest,
  destinationLocation
) {
  return places
    .map((place) => {
      const result =
        scorePlace(
          place,
          interest,
          destinationLocation
        );

      return {
        ...place,

        recommendationScore:
          result.score,

        distanceKm:
          Number(
            result.distance.toFixed(2)
          ),
      };
    })
    .sort(
      (a, b) =>
        b.recommendationScore -
        a.recommendationScore
    );
}

/* =========================================================
   FALLBACK NOMINATIM PLACE SEARCH
========================================================= */

async function fallbackTouristSearch(
  destination
) {
  const queries = [
    `tourist attractions in ${destination}`,
    `tourist places in ${destination}`,
    `places to visit in ${destination}`,
  ];

  const results = [];

  for (const search of queries) {
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
          q: search,
          format: "jsonv2",
          limit: "8",
          addressdetails: "1",
        });

      const response =
        await fetchWithTimeout(
          url,
          {
            headers: {
              "User-Agent":
                "SmartTourism/1.0 tourism-hackathon-app",
              Accept:
                "application/json",
            },
          },
          7000
        );

      if (!response.ok) {
        continue;
      }

      const data =
        await response.json();

      if (Array.isArray(data)) {
        results.push(...data);
      }
    } catch (error) {
      console.log(
        "Nominatim fallback failed:",
        error.message
      );
    }

    await sleep(1100);
  }

  const places = [];

  for (const item of results) {
    const latitude =
      Number(item.lat);

    const longitude =
      Number(item.lon);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const name =
      item.name ||
      item.display_name
        ?.split(",")[0] ||
      "";

    if (!cleanText(name)) {
      continue;
    }

    places.push({
      id:
        `nominatim-${Date.now()}-${places.length}`,

      name:
        cleanText(name),

      category:
        "Tourist Attraction",

      description:
        cleanText(
          item.display_name ||
            "Tourist place"
        ),

      latitude,

      longitude,

      /*
        Unknown price.
        Do NOT use 0.
      */
      estimated_cost:
        null,

      state:
        item.address?.state ||
        "",

      source:
        "OpenStreetMap",
    });
  }

  return removeDuplicatePlaces(
    places
  );
}

/* =========================================================
   DATABASE PLACES
========================================================= */

async function getDatabasePlaces() {
  if (!db) {
    return [];
  }

  try {
    const [rows] =
      await db.query(
        "SELECT * FROM places ORDER BY id ASC"
      );

    return (rows || []).map(
      (place) => ({
        ...place,

        latitude:
          safeNumber(
            place.latitude
          ),

        longitude:
          safeNumber(
            place.longitude
          ),

        /*
          Convert database 0 to null
          because 0 was previously being
          used as an unknown price.
        */

        estimated_cost:
          Number(place.estimated_cost) > 0
            ? Number(
                place.estimated_cost
              )
            : null,
      })
    );
  } catch (error) {
    console.log(
      "⚠️ Database places unavailable:",
      error.message
    );

    return [];
  }
}

/* =========================================================
   DATABASE HOTELS
========================================================= */

async function getDatabaseHotels() {
  if (!db) {
    return [];
  }

  try {
    const [rows] =
      await db.query(
        "SELECT * FROM hotels ORDER BY id ASC"
      );

    return (rows || []).map(
      (hotel) => {
        const price =
          Number(
            hotel.price_per_night
          );

        const rating =
          Number(
            hotel.rating
          );

        return {
          ...hotel,

          latitude:
            safeNumber(
              hotel.latitude
            ),

          longitude:
            safeNumber(
              hotel.longitude
            ),

          /*
            0 means unknown in the old
            database structure.
            Convert it to null.
          */

          price_per_night:
            Number.isFinite(price) &&
            price > 0
              ? price
              : null,

          rating:
            Number.isFinite(rating) &&
            rating > 0
              ? rating
              : null,

          source:
            hotel.source ||
            "MySQL",
        };
      }
    );
  } catch (error) {
    console.log(
      "⚠️ Database hotels unavailable:",
      error.message
    );

    return [];
  }
}

/* =========================================================
   HOTEL SCORE
========================================================= */

function scoreHotel(
  hotel,
  destinationLocation,
  budgetPerNight
) {
  const price =
    safeNumber(
      hotel.price_per_night
    );

  const rating =
    safeNumber(
      hotel.rating
    );

  const latitude =
    safeNumber(
      hotel.latitude
    );

  const longitude =
    safeNumber(
      hotel.longitude
    );

  let distance = null;

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    distance =
      calculateDistanceKm(
        destinationLocation.latitude,
        destinationLocation.longitude,
        latitude,
        longitude
      );
  }

  let score = 0;

  /* =======================================================
     PRICE
  ======================================================= */

  if (
    Number.isFinite(price) &&
    price <= budgetPerNight
  ) {
    score += 50;

    const remaining =
      budgetPerNight - price;

    if (
      budgetPerNight > 0
    ) {
      score += Math.min(
        20,
        (remaining /
          budgetPerNight) *
          20
      );
    }
  }

  /* =======================================================
     RATING
  ======================================================= */

  if (
    Number.isFinite(rating)
  ) {
    score += Math.min(
      25,
      rating * 5
    );
  }

  /* =======================================================
     DISTANCE
  ======================================================= */

  if (
    Number.isFinite(distance)
  ) {
    if (distance <= 2) {
      score += 20;
    } else if (distance <= 5) {
      score += 15;
    } else if (distance <= 10) {
      score += 8;
    }
  }

  /*
    Unknown price gets a penalty,
    but it is NOT converted to ₹0.
  */

  if (!Number.isFinite(price)) {
    score -= 100;
  }

  return {
    score,
    distance,
  };
}

/* =========================================================
   RECOMMEND HOTELS
========================================================= */

function recommendHotels(
  hotels,
  destinationLocation,
  budgetPerNight
) {
  const scored =
    hotels
      .map((hotel) => {
        const result =
          scoreHotel(
            hotel,
            destinationLocation,
            budgetPerNight
          );

        return {
          ...hotel,

          recommendationScore:
            result.score,

          distanceKm:
            Number.isFinite(
              result.distance
            )
              ? Number(
                  result.distance.toFixed(2)
                )
              : null,
        };
      })
      .filter((hotel) => {
        const price =
          safeNumber(
            hotel.price_per_night
          );

        return (
          Number.isFinite(price) &&
          price > 0 &&
          price <=
            budgetPerNight
        );
      })
      .sort(
        (a, b) =>
          b.recommendationScore -
          a.recommendationScore
      );

  return scored.slice(
    0,
    MAX_RECOMMENDED_HOTELS
  );
}

/* =========================================================
   UNKNOWN PRICE HOTELS
========================================================= */

function getNearbyUnknownPriceHotels(
  hotels,
  destinationLocation
) {
  return hotels
    .map((hotel) => {
      const price =
        safeNumber(
          hotel.price_per_night
        );

      const latitude =
        safeNumber(
          hotel.latitude
        );

      const longitude =
        safeNumber(
          hotel.longitude
        );

      if (
        Number.isFinite(price)
      ) {
        return null;
      }

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return null;
      }

      const distance =
        calculateDistanceKm(
          destinationLocation.latitude,
          destinationLocation.longitude,
          latitude,
          longitude
        );

      return {
        ...hotel,

        distanceKm:
          Number(
            distance.toFixed(2)
          ),

        recommendationScore:
          0,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.distanceKm -
        b.distanceKm
    )
    .slice(
      0,
      MAX_RECOMMENDED_HOTELS
    );
}

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "SmartTourism backend is running",
  });
});

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  async (req, res) => {
    let mysqlConnected = false;

    if (db) {
      try {
        await db.query(
          "SELECT 1"
        );

        mysqlConnected = true;
      } catch {
        mysqlConnected = false;
      }
    }

    res.json({
      success: true,

      backend: true,

      mysql:
        mysqlConnected,

      internetPlaces:
        true,

      automaticRecommendations:
        true,

      smartRanking:
        true,

      message:
        "SmartTourism backend is working",
    });
  }
);

/* =========================================================
   DATABASE PLACES
========================================================= */

app.get(
  "/api/places",
  async (req, res) => {
    const places =
      await getDatabasePlaces();

    res.json({
      success: true,
      places,
    });
  }
);

/* =========================================================
   DATABASE HOTELS
========================================================= */

app.get(
  "/api/hotels",
  async (req, res) => {
    const hotels =
      await getDatabaseHotels();

    res.json({
      success: true,
      hotels,
    });
  }
);

/* =========================================================
   GENERATE TRIP
========================================================= */

app.post(
  "/api/trip",
  async (req, res) => {
    try {
      const {
        destination,
        days,
        budget,
        travellers,
        interest,
      } = req.body;

      /* ===================================================
         VALIDATION
      =================================================== */

      if (
        !destination ||
        !cleanText(destination)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Destination is required.",
        });
      }

      const numberOfDays =
        Number(days);

      const totalBudget =
        Number(budget);

      const numberOfTravellers =
        Number(travellers);

      if (
        !Number.isFinite(
          numberOfDays
        ) ||
        numberOfDays <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid number of days is required.",
        });
      }

      if (
        !Number.isFinite(
          totalBudget
        ) ||
        totalBudget <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid budget is required.",
        });
      }

      if (
        !Number.isFinite(
          numberOfTravellers
        ) ||
        numberOfTravellers <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid traveller count is required.",
        });
      }

      const cleanDestination =
        cleanText(
          destination
        );

      const selectedInterest =
        INTEREST_KEYWORDS[
          interest
        ]
          ? interest
          : "All";

      console.log("");

      console.log(
        "======================================"
      );

      console.log(
        "🌍 NEW SMART TOURISM REQUEST"
      );

      console.log(
        "Destination:",
        cleanDestination
      );

      console.log(
        "Days:",
        numberOfDays
      );

      console.log(
        "Budget:",
        totalBudget
      );

      console.log(
        "Travellers:",
        numberOfTravellers
      );

      console.log(
        "Interest:",
        selectedInterest
      );

      console.log(
        "======================================"
      );

      /* ===================================================
         1. GEOCODE DESTINATION
      =================================================== */

      const destinationLocation =
        await geocodeDestination(
          cleanDestination
        );

      if (!destinationLocation) {
        return res.status(404).json({
          success: false,

          message:
            `Could not find destination "${cleanDestination}". Try a valid city or tourist destination name.`,
        });
      }

      /* ===================================================
         2. DATABASE PLACES
      =================================================== */

      const databasePlaces =
        await getDatabasePlaces();

      console.log(
        `📦 Database places: ${databasePlaces.length}`
      );

      /* ===================================================
         3. INTERNET PLACES
      =================================================== */

      console.log(
        "🌐 Searching Internet-based tourist places..."
      );

      let automaticPlaces =
        await findTouristPlaces(
          destinationLocation.latitude,
          destinationLocation.longitude
        );

      /* ===================================================
         4. FALLBACK
      =================================================== */

      if (
        automaticPlaces.length === 0
      ) {
        console.log(
          "🔄 Using Nominatim fallback..."
        );

        automaticPlaces =
          await fallbackTouristSearch(
            cleanDestination
          );
      }

      /* ===================================================
         5. MERGE PLACES
      =================================================== */

      const combinedPlaces = [
        ...databasePlaces,
        ...automaticPlaces,
      ];

      /* ===================================================
         6. VALID PLACES
      =================================================== */

      const validPlaces =
        combinedPlaces.filter(
          (place) => {
            const latitude =
              Number(
                place.latitude
              );

            const longitude =
              Number(
                place.longitude
              );

            return (
              Number.isFinite(
                latitude
              ) &&
              Number.isFinite(
                longitude
              ) &&
              latitude >= -90 &&
              latitude <= 90 &&
              longitude >= -180 &&
              longitude <= 180 &&
              cleanText(
                place.name
              )
            );
          }
        );

      /* ===================================================
         7. REMOVE DUPLICATES
      =================================================== */

      const allUnique =
        removeDuplicatePlaces(
          validPlaces
        );

      /* ===================================================
         8. RANK PLACES
      =================================================== */

      const rankedPlaces =
        rankPlaces(
          allUnique,
          selectedInterest,
          destinationLocation
        );

      const allPlaces =
        rankedPlaces.slice(
          0,
          MAX_MAP_PLACES
        );

      const recommendedPlaces =
        rankedPlaces.slice(
          0,
          MAX_RECOMMENDED_PLACES
        );

      console.log(
        `📌 Map places: ${allPlaces.length}`
      );

      console.log(
        `⭐ Recommended places: ${recommendedPlaces.length}`
      );

      /* ===================================================
         9. DATABASE HOTELS
      =================================================== */

      const databaseHotels =
        await getDatabaseHotels();

      console.log(
        `🏨 Database hotels: ${databaseHotels.length}`
      );

      /* ===================================================
         10. INTERNET HOTELS
      =================================================== */

      console.log(
        "🌐 Searching Internet-based hotels..."
      );

      const automaticHotels =
        await findHotels(
          destinationLocation.latitude,
          destinationLocation.longitude
        );

      /* ===================================================
         11. MERGE HOTELS
      =================================================== */

      const combinedHotels = [
        ...databaseHotels,
        ...automaticHotels,
      ];

      const uniqueHotels =
        removeDuplicateHotels(
          combinedHotels
        );

      console.log(
        `🏨 Total unique hotels: ${uniqueHotels.length}`
      );

      /* ===================================================
         12. HOTEL BUDGET
      =================================================== */

      const hotelTotalBudget =
        totalBudget * 0.4;

      const hotelBudgetPerNight =
        hotelTotalBudget /
        numberOfDays;

      const fallbackHotelBudget =
        (totalBudget * 0.6) /
        numberOfDays;

      /* ===================================================
         13. RECOMMEND HOTELS
      =================================================== */

      let recommendedHotels =
        recommendHotels(
          uniqueHotels,
          destinationLocation,
          hotelBudgetPerNight
        );

      /* ===================================================
         14. FALLBACK HOTEL BUDGET
      =================================================== */

      if (
        recommendedHotels.length === 0
      ) {
        recommendedHotels =
          recommendHotels(
            uniqueHotels,
            destinationLocation,
            fallbackHotelBudget
          );
      }

      /*
        If no hotel has confirmed price,
        show nearby hotels as "Price on request"
        instead of showing ₹0.
      */

      if (
        recommendedHotels.length === 0
      ) {
        recommendedHotels =
          getNearbyUnknownPriceHotels(
            uniqueHotels,
            destinationLocation
          );
      }

      console.log(
        `⭐ Recommended hotels: ${recommendedHotels.length}`
      );

      /* ===================================================
         15. STATE
      =================================================== */

      const state =
        destinationLocation
          .address?.state ||
        "India";

      /* ===================================================
         16. DESCRIPTION
      =================================================== */

      const description =
        `A ${numberOfDays}-day trip to ${cleanDestination} for ${numberOfTravellers} traveller${
          numberOfTravellers > 1
            ? "s"
            : ""
        }, with recommendations selected for your ${selectedInterest.toLowerCase()} interest and ₹${totalBudget.toLocaleString(
          "en-IN"
        )} budget.`;

      /* ===================================================
         17. FINAL TRIP
      =================================================== */

      const trip = {
        destination:
          cleanDestination,

        days:
          numberOfDays,

        budget:
          totalBudget,

        travellers:
          numberOfTravellers,

        interest:
          selectedInterest,

        description,

        bestTime:
          "October to March",

        state,

        recommendedPlaces,

        recommendedHotels,

        allPlaces,

        destinationCoordinates: {
          latitude:
            destinationLocation.latitude,

          longitude:
            destinationLocation.longitude,
        },

        hotelBudgetPerNight:
          Math.round(
            hotelBudgetPerNight
          ),

        fallbackHotelBudgetPerNight:
          Math.round(
            fallbackHotelBudget
          ),

        dataSource:
          "OpenStreetMap + MySQL",

        /*
          This version uses smart
          rule-based recommendation,
          not an external AI model.
        */
        aiUsed:
          false,

        recommendationEngine:
          "Smart rule-based ranking",
      };

      /* ===================================================
         18. LOG
      =================================================== */

      console.log(
        "======================================"
      );

      console.log(
        "✅ SMART TOURISM TRIP GENERATED"
      );

      console.log(
        `📍 Destination: ${cleanDestination}`
      );

      console.log(
        `🗺️ Map places: ${allPlaces.length}`
      );

      console.log(
        `⭐ Recommendations: ${recommendedPlaces.length}`
      );

      console.log(
        `🏨 Hotels: ${recommendedHotels.length}`
      );

      console.log(
        "======================================"
      );

      /* ===================================================
         19. RESPONSE
      =================================================== */

      return res.json({
        success: true,

        message:
          "Trip generated successfully.",

        trip,
      });
    } catch (error) {
      console.error(
        "❌ TRIP GENERATION ERROR:"
      );

      console.error(
        error.stack ||
          error.message
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to generate trip.",

        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      message:
        `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  await connectDatabase();

  app.listen(
    PORT,
    () => {
      console.log("");

      console.log(
        "======================================"
      );

      console.log(
        "🚀 SmartTourism Backend Started"
      );

      console.log(
        `🌐 http://localhost:${PORT}`
      );

      console.log(
        "🌐 Internet-based place search: ENABLED"
      );

      console.log(
        "⭐ Smart recommendation ranking: ENABLED"
      );

      console.log(
        "🏨 Budget hotel recommendation: ENABLED"
      );

      console.log(
        "💰 Fake ₹0 prices: DISABLED"
      );

      console.log(
        "🗺️ Maximum map places: 40"
      );

      console.log(
        "⭐ Maximum recommended places: 12"
      );

      console.log(
        "🏨 Maximum recommended hotels: 8"
      );

      console.log(
        "======================================"
      );

      console.log("");
    }
  );
}

startServer();

