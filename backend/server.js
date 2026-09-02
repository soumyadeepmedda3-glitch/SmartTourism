const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ============================================================
// SMARTTOURISM - AI + REAL INTERNET DATA + BUDGET FIRST
//
// MySQL:
// users, trip_history, feedback only
//
// Internet:
// OpenStreetMap / Overpass = places + hotels
// Nominatim = coordinates
// OSRM = route / distance / time
// Gemini = AI optimization
// ============================================================

const PORT = Number(process.env.PORT || 5000);

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const USER_AGENT =
  process.env.OSM_USER_AGENT || 'SmartTourism/1.0';

const NOMINATIM_URL =
  process.env.NOMINATIM_URL ||
  'https://nominatim.openstreetmap.org/search';

const OVERPASS_URL =
  process.env.OVERPASS_URL ||
  'https://overpass-api.de/api/interpreter';

const OSRM_URL =
  process.env.OSRM_URL ||
  'https://router.project-osrm.org';

// ============================================================
// MYSQL
// ============================================================

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smarttourism',
  port: Number(process.env.DB_PORT || 3306),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ============================================================
// GEMINI
// ============================================================

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;

// ============================================================
// CACHE
// ============================================================

const CACHE_TTL = 10 * 60 * 1000;

const cache = new Map();

// ============================================================
// INTEREST KEYWORDS
// ============================================================

const INTEREST_KEYWORDS = {
  Nature: [
    'nature',
    'park',
    'garden',
    'forest',
    'viewpoint',
    'lake',
    'river',
    'water',
    'hill',
    'mountain',
    'peak',
    'beach',
    'tea',
    'botanical',
    'scenic',
    'wildlife',
  ],

  Adventure: [
    'adventure',
    'trek',
    'trail',
    'hill',
    'mountain',
    'peak',
    'climbing',
    'camp',
    'water',
    'beach',
    'sport',
    'activity',
  ],

  Food: [
    'food',
    'restaurant',
    'cafe',
    'bakery',
    'market',
    'street',
    'cuisine',
    'tea',
    'coffee',
  ],

  Culture: [
    'culture',
    'museum',
    'gallery',
    'temple',
    'church',
    'mosque',
    'monument',
    'heritage',
    'palace',
    'art',
  ],

  History: [
    'history',
    'historic',
    'fort',
    'monument',
    'museum',
    'heritage',
    'palace',
    'memorial',
    'archaeological',
    'ruins',
  ],

  Shopping: [
    'shop',
    'shopping',
    'market',
    'mall',
    'bazaar',
    'handicraft',
    'craft',
  ],

  All: [],
};

// ============================================================
// BASIC HELPERS
// ============================================================

function text(value, max = 300) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value) {
  return Math.round(Number(value) || 0);
}

function positive(value) {
  const n = Number(value);

  return Number.isFinite(n) && n >= 0
    ? n
    : null;
}

function keyName(value) {
  return text(value, 200)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ============================================================
// HAVERSINE DISTANCE
// ============================================================

function haversineKm(a, b) {
  if (!a || !b) return null;

  const lat1 = num(a.latitude);
  const lon1 = num(a.longitude);

  const lat2 = num(b.latitude);
  const lon2 = num(b.longitude);

  if (
    [lat1, lon1, lat2, lon2].some(
      (v) => v === null
    )
  ) {
    return null;
  }

  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(x),
      Math.sqrt(1 - x)
    )
  );
}

// ============================================================
// CACHE
// ============================================================

function cachedGet(key) {
  const item = cache.get(key);

  if (
    !item ||
    Date.now() - item.time > CACHE_TTL
  ) {
    if (item) {
      cache.delete(key);
    }

    return null;
  }

  return item.value;
}

function cachedSet(key, value) {
  cache.set(key, {
    time: Date.now(),
    value,
  });

  return value;
}

// ============================================================
// FETCH JSON
// ============================================================

async function fetchJson(
  url,
  options = {},
  timeout = 12000
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${body.slice(
          0,
          180
        )}`
      );
    }

    return JSON.parse(body);
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// GEOCODING - NOMINATIM
// ============================================================

async function geocode(query) {
  const q = text(query, 150);

  if (!q) {
    throw new Error(
      'Location is required.'
    );
  }

  const key = `geo:${q.toLowerCase()}`;

  const old = cachedGet(key);

  if (old) {
    return old;
  }

  const url = new URL(
    NOMINATIM_URL
  );

  url.searchParams.set('q', q);
  url.searchParams.set(
    'format',
    'jsonv2'
  );
  url.searchParams.set(
    'limit',
    '1'
  );

  const data = await fetchJson(
    url.toString(),
    {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    },
    10000
  );

  if (
    !Array.isArray(data) ||
    !data[0]
  ) {
    throw new Error(
      `Could not find location: ${q}`
    );
  }

  const location = {
    name: text(
      data[0].display_name || q,
      220
    ),

    displayName: text(
      data[0].display_name || q,
      220
    ),

    latitude: num(data[0].lat),

    longitude: num(data[0].lon),
  };

  if (
    location.latitude === null ||
    location.longitude === null
  ) {
    throw new Error(
      `Invalid coordinates for ${q}`
    );
  }

  return cachedSet(
    key,
    location
  );
}

// ============================================================
// OPENSTREETMAP HELPERS
// ============================================================

function coords(element) {
  if (element.type === 'node') {
    return {
      latitude: num(element.lat),
      longitude: num(element.lon),
    };
  }

  if (element.center) {
    return {
      latitude: num(
        element.center.lat
      ),

      longitude: num(
        element.center.lon
      ),
    };
  }

  return null;
}

function tags(element) {
  return element?.tags || {};
}

function osmName(element) {
  const t = tags(element);

  return text(
    t.name ||
      t['name:en'],
    180
  );
}

function price(value) {
  if (value == null) {
    return null;
  }

  const match = String(value)
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/);

  return match
    ? positive(match[0])
    : null;
}

function address(tagsObject) {
  return text(
    [
      tagsObject['addr:housenumber'],
      tagsObject['addr:street'],
      tagsObject['addr:suburb'],
      tagsObject['addr:city'],
      tagsObject['addr:state'],
    ]
      .filter(Boolean)
      .join(', '),
    250
  );
}

// ============================================================
// CATEGORY
// ============================================================

function category(t) {
  const source = [
    t.tourism,
    t.historic,
    t.leisure,
    t.natural,
    t.amenity,
    t.shop,
    t.sport,
    t.attraction,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    /museum|gallery/.test(source)
  ) {
    return 'Culture';
  }

  if (
    /historic|monument|castle|fort|palace|memorial/.test(
      source
    )
  ) {
    return 'History';
  }

  if (
    /restaurant|cafe|food|bakery|market/.test(
      source
    )
  ) {
    return 'Food';
  }

  if (
    /park|garden|nature|beach|viewpoint|lake|river|forest|peak/.test(
      source
    )
  ) {
    return 'Nature';
  }

  if (
    /trek|trail|sport|climb|adventure/.test(
      source
    )
  ) {
    return 'Adventure';
  }

  if (
    /shop|mall|market|bazaar/.test(
      source
    )
  ) {
    return 'Shopping';
  }

  return 'Tourist Attraction';
}

// ============================================================
// MAKE PLACE
// ============================================================

function makePlace(
  element,
  destination
) {
  const t = tags(element);

  const point = coords(element);

  const name = osmName(element);

  if (!point || !name) {
    return null;
  }

  const distance =
    haversineKm(
      destination,
      point
    );

  if (
    distance == null ||
    distance > 30
  ) {
    return null;
  }

  const fee =
    price(t.charge) ??
    price(t.fee);

  return {
    id: `osm-place-${element.type}-${element.id}`,

    osmId: element.id,

    name,

    category: category(t),

    description: text(
      t.description ||
        t['description:en'] ||
        'Real attraction discovered from OpenStreetMap.',
      400
    ),

    estimated_cost: fee,

    priceSource:
      fee == null
        ? null
        : 'OpenStreetMap',

    latitude: point.latitude,

    longitude: point.longitude,

    distanceFromDestinationKm:
      Number(distance.toFixed(2)),

    address: address(t),

    source: 'OpenStreetMap',
  };
}

// ============================================================
// MAKE HOTEL
// ============================================================

function makeHotel(
  element,
  destination
) {
  const t = tags(element);

  const point = coords(element);

  const name = osmName(element);

  if (!point || !name) {
    return null;
  }

  const distance =
    haversineKm(
      destination,
      point
    );

  if (
    distance == null ||
    distance > 30
  ) {
    return null;
  }

  const nightly =
    price(t['rooms:price']) ??
    price(t.charge) ??
    price(t.price);

  const stars =
    price(t.stars);

  return {
    id: `osm-hotel-${element.type}-${element.id}`,

    osmId: element.id,

    name,

    rating: stars,

    stars,

    price_per_night:
      nightly,

    priceSource:
      nightly == null
        ? null
        : 'OpenStreetMap',

    latitude: point.latitude,

    longitude: point.longitude,

    distanceFromDestinationKm:
      Number(distance.toFixed(2)),

    address: address(t),

    source: 'OpenStreetMap',
  };
}

// ============================================================
// DISCOVER PLACES + HOTELS
// ============================================================

async function discover(
  destination
) {
  const key =
    `discover:${destination.latitude.toFixed(
      3
    )},${destination.longitude.toFixed(
      3
    )}`;

  const old = cachedGet(key);

  if (old) {
    return old;
  }

  const query = `
[out:json][timeout:20];

(
  nwr(
    around:30000,
    ${destination.latitude},
    ${destination.longitude}
  )["tourism"~"attraction|museum|gallery|viewpoint|theme_park|zoo|aquarium|artwork"];

  nwr(
    around:30000,
    ${destination.latitude},
    ${destination.longitude}
  )["historic"];

  nwr(
    around:30000,
    ${destination.latitude},
    ${destination.longitude}
  )["leisure"~"park|garden|nature_reserve"];

  nwr(
    around:30000,
    ${destination.latitude},
    ${destination.longitude}
  )["natural"~"beach|peak|water"];

  nwr(
    around:30000,
    ${destination.latitude},
    ${destination.longitude}
  )["tourism"~"hotel|hostel|guest_house|motel|apartment"];
);

out center tags;
`;

  let data;

  try {
    data = await fetchJson(
      OVERPASS_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'text/plain;charset=UTF-8',

          'User-Agent':
            USER_AGENT,
        },

        body: query,
      },

      25000
    );
  } catch (error) {
    console.warn(
      'Overpass failed:',
      error.message
    );

    return cachedSet(key, {
      places: [],

      hotels: [],

      source: 'OpenStreetMap',

      warning:
        'OpenStreetMap discovery is temporarily unavailable.',
    });
  }

  const placeMap =
    new Map();

  const hotelMap =
    new Map();

  for (
    const element of
      data?.elements || []
  ) {
    const t = tags(element);

    const tourism =
      String(
        t.tourism || ''
      ).toLowerCase();

    if (
      /hotel|hostel|guest_house|motel|apartment/.test(
        tourism
      )
    ) {
      const hotel =
        makeHotel(
          element,
          destination
        );

      if (
        hotel &&
        !hotelMap.has(
          keyName(hotel.name)
        )
      ) {
        hotelMap.set(
          keyName(hotel.name),
          hotel
        );
      }
    } else {
      const place =
        makePlace(
          element,
          destination
        );

      if (
        place &&
        !placeMap.has(
          keyName(place.name)
        )
      ) {
        placeMap.set(
          keyName(place.name),
          place
        );
      }
    }
  }

  return cachedSet(key, {
    places: Array.from(
      placeMap.values()
    )
      .sort(
        (a, b) =>
          a.distanceFromDestinationKm -
          b.distanceFromDestinationKm
      )
      .slice(0, 40),

    hotels: Array.from(
      hotelMap.values()
    )
      .sort(
        (a, b) =>
          a.distanceFromDestinationKm -
          b.distanceFromDestinationKm
      )
      .slice(0, 16),

    source: 'OpenStreetMap',

    warning: null,
  });
}

// ============================================================
// PLACE RANKING
// ============================================================

function placeScore(
  place,
  interest,
  activityBudget,
  travellers
) {
  const source =
    `${place.name} ${place.category} ${place.description}`
      .toLowerCase();

  let score =
    interest === 'All'
      ? 20
      : 0;

  for (
    const keyword of
      INTEREST_KEYWORDS[
        interest
      ] || []
  ) {
    if (
      source.includes(keyword)
    ) {
      score += 10;
    }
  }

  const fee =
    positive(
      place.estimated_cost
    );

  if (fee === 0) {
    score += 8;
  }

  if (fee == null) {
    score += 2;
  }

  if (
    fee != null &&
    fee * travellers <=
      activityBudget
  ) {
    score += 8;
  }

  if (
    fee != null &&
    fee * travellers >
      activityBudget
  ) {
    score -= 12;
  }

  score -=
    Math.min(
      place.distanceFromDestinationKm ||
        0,
      30
    ) * 0.35;

  return score;
}

function rankPlaces(
  places,
  interest,
  budget,
  travellers
) {
  return places
    .map((place) => ({
      ...place,

      recommendationScore:
        placeScore(
          place,
          interest,
          budget * 0.10,
          travellers
        ),
    }))
    .sort(
      (a, b) =>
        b.recommendationScore -
        a.recommendationScore
    );
}

// ============================================================
// HOTEL RANKING
// ============================================================

function rankHotels(
  hotels,
  budget,
  nights
) {
  const hotelBudget =
    budget * 0.45;

  return hotels
    .map((hotel) => {
      const nightly =
        positive(
          hotel.price_per_night
        );

      const total =
        nightly == null
          ? null
          : nightly * nights;

      let score =
        total == null
          ? 8
          : total <= hotelBudget
          ? 50
          : 50 -
            Math.min(
              50,
              ((total -
                hotelBudget) /
                Math.max(
                  1,
                  hotelBudget
                )) *
                50
            );

      if (
        hotel.rating != null
      ) {
        score +=
          Number(
            hotel.rating
          ) * 5;
      }

      score -=
        Math.min(
          hotel.distanceFromDestinationKm ||
            0,
          30
        ) * 0.5;

      return {
        ...hotel,

        totalStayEstimate:
          total,

        recommendationScore:
          score,
      };
    })
    .sort(
      (a, b) =>
        b.recommendationScore -
        a.recommendationScore
    );
}

// ============================================================
// OSRM ROUTING
// ============================================================

async function route(
  points,
  profile = 'driving'
) {
  const valid =
    (points || []).filter(
      (point) =>
        point &&
        num(point.latitude) !== null &&
        num(point.longitude) !== null
    );

  if (valid.length < 2) {
    return null;
  }

  const coordinates =
    valid
      .map(
        (point) =>
          `${point.longitude},${point.latitude}`
      )
      .join(';');

  const key =
    `route:${profile}:${coordinates}`;

  const old =
    cachedGet(key);

  if (old) {
    return old;
  }

  try {
    const data =
      await fetchJson(
        `${OSRM_URL}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson&steps=false`,
        {
          headers: {
            'User-Agent':
              USER_AGENT,
          },
        },
        12000
      );

    if (
      data.code !== 'Ok' ||
      !data.routes?.[0]
    ) {
      return null;
    }

    const r =
      data.routes[0];

    return cachedSet(
      key,
      {
        distanceKm:
          Number(
            (
              r.distance / 1000
            ).toFixed(2)
          ),

        durationMinutes:
          Math.round(
            r.duration / 60
          ),

        geometry:
          r.geometry,

        source: 'OSRM',
      }
    );
  } catch (error) {
    console.warn(
      'OSRM route failed:',
      error.message
    );

    return null;
  }
}

// ============================================================
// TRANSPORT ESTIMATION
// ============================================================

function transportEstimate(
  distanceKm,
  mode,
  travellers
) {
  const distance =
    Math.max(
      0,
      Number(distanceKm) || 0
    );

  const people =
    Math.max(
      1,
      Number(travellers) || 1
    );

  // WALKING
  if (
    mode === 'walking'
  ) {
    return {
      mode,

      estimatedCost: 0,

      low: 0,

      high: 0,

      basis:
        'Walking has no direct transport fare.',

      exact: false,
    };
  }

  // OWN CAR
  if (
    mode === 'own_car'
  ) {
    const fuelPrice =
      105;

    const mileage =
      14;

    const cost =
      (distance /
        mileage) *
      fuelPrice;

    return {
      mode,

      estimatedCost:
        money(cost),

      low:
        money(cost * 0.9),

      high:
        money(cost * 1.1),

      basis:
        `Approx. fuel cost using ${mileage} km/L and ₹${fuelPrice}/L.`,

      exact: false,
    };
  }

  // PUBLIC TRANSPORT
  if (
    mode ===
    'public_transport'
  ) {
    const low =
      Math.max(
        50,
        distance * 1.2
      ) * people;

    const high =
      Math.max(
        100,
        distance * 2.5
      ) * people;

    return {
      mode,

      estimatedCost:
        money(
          (low + high) / 2
        ),

      low:
        money(low),

      high:
        money(high),

      basis:
        'Approximate public-transport planning range, not a live ticket quote.',

      exact: false,
    };
  }

  // CAB
  const oneWay =
    150 +
    distance * 16;

  const total =
    oneWay * 2;

  return {
    mode: 'cab',

    estimatedCost:
      money(total),

    low:
      money(total * 0.85),

    high:
      money(total * 1.2),

    basis:
      'Approx. cab planning fare using ₹150 base + ₹16/km, round/local trip estimate.',

    exact: false,
  };
}

// ============================================================
// FIND NEAREST PLACE
// ============================================================

function nearest(
  current,
  list
) {
  let best = null;

  let bestDistance =
    Infinity;

  for (
    const place of list
  ) {
    const distance =
      haversineKm(
        current,
        place
      );

    if (
      distance != null &&
      distance <
        bestDistance
    ) {
      bestDistance =
        distance;

      best = place;
    }
  }

  return best;
}

// ============================================================
// DAY-WISE PLAN
// ============================================================

async function buildDayPlan(
  places,
  hotel,
  days,
  mode
) {
  const groups =
    Array.from(
      {
        length: days,
      },
      () => []
    );

  // Geographical grouping
  for (
    const place of places
  ) {
    let bestDay = 0;

    let bestScore =
      Infinity;

    for (
      let i = 0;
      i < days;
      i++
    ) {
      if (
        !groups[i].length
      ) {
        bestDay = i;
        break;
      }

      const center =
        groups[i].reduce(
          (
            accumulator,
            item
          ) => ({
            latitude:
              accumulator.latitude +
              Number(
                item.latitude
              ) /
                groups[i]
                  .length,

            longitude:
              accumulator.longitude +
              Number(
                item.longitude
              ) /
                groups[i]
                  .length,
          }),
          {
            latitude: 0,
            longitude: 0,
          }
        );

      const score =
        (haversineKm(
          center,
          place
        ) || 999) +
        groups[i].length *
          2;

      if (
        score <
        bestScore
      ) {
        bestScore =
          score;

        bestDay = i;
      }
    }

    groups[
      bestDay
    ].push(place);
  }

  const output = [];

  for (
    let i = 0;
    i < days;
    i++
  ) {
    const left =
      [...groups[i]];

    const ordered = [];

    let current =
      hotel;

    if (
      !current &&
      left[0]
    ) {
      current =
        left[0];
    }

    while (
      left.length &&
      current
    ) {
      const next =
        nearest(
          current,
          left
        );

      if (!next) {
        break;
      }

      ordered.push(next);

      left.splice(
        left.findIndex(
          (item) =>
            item.id ===
            next.id
        ),
        1
      );

      current =
        next;
    }

    const routePoints = [];

    if (hotel) {
      routePoints.push(
        hotel
      );
    }

    routePoints.push(
      ...ordered
    );

    if (
      hotel &&
      ordered.length
    ) {
      routePoints.push(
        hotel
      );
    }

    const routeResult =
      routePoints.length >=
      2
        ? await route(
            routePoints,
            mode === 'walking'
              ? 'foot'
              : 'driving'
          )
        : null;

    const entryCost =
      ordered.reduce(
        (sum, place) =>
          sum +
          (positive(
            place.estimated_cost
          ) || 0),
        0
      );

    output.push({
      day: i + 1,

      places: ordered,

      placeCount:
        ordered.length,

      entryCost:
        money(entryCost),

      route:
        routeResult,

      routePoints,
    });
  }

  return output;
}

// ============================================================
// GEMINI JSON PARSER
// ============================================================

function parseJson(
  textValue
) {
  if (!textValue) {
    return null;
  }

  const cleaned =
    String(textValue)
      .replace(
        /^```json/i,
        ''
      )
      .replace(
        /^```/,
        ''
      )
      .replace(
        /```$/,
        ''
      )
      .trim();

  const start =
    cleaned.indexOf('{');

  const end =
    cleaned.lastIndexOf('}');

  if (
    start < 0 ||
    end < 0
  ) {
    return null;
  }

  try {
    return JSON.parse(
      cleaned.slice(
        start,
        end + 1
      )
    );
  } catch {
    return null;
  }
}

// ============================================================
// GEMINI SAFE NAMES
// ============================================================

function allowedNames(
  items
) {
  return new Map(
    items.map(
      (item) => [
        keyName(item.name),
        item.name,
      ]
    )
  );
}

function safeNames(
  array,
  items
) {
  const map =
    allowedNames(items);

  return Array.isArray(array)
    ? array
        .map((item) =>
          map.get(
            keyName(
              typeof item ===
                'string'
                ? item
                : item?.name
            )
          )
        )
        .filter(Boolean)
    : [];
}

// ============================================================
// GEMINI PLAN
// ============================================================

async function geminiPlan(
  data
) {
  if (!ai) {
    return null;
  }

  const places =
    data.places.map(
      (place) => ({
        name: place.name,

        category:
          place.category,

        estimated_cost:
          place.estimated_cost,

        latitude:
          place.latitude,

        longitude:
          place.longitude,
      })
    );

  const hotels =
    data.hotels.map(
      (hotel) => ({
        name: hotel.name,

        price_per_night:
          hotel.price_per_night,

        rating:
          hotel.rating,

        latitude:
          hotel.latitude,

        longitude:
          hotel.longitude,
      })
    );

  const prompt = `
You are SmartTourism's AI optimization layer.

Use ONLY the supplied real data.

Never invent a place.
Never invent a hotel.
Never rename a place.
Never rename a hotel.

Never claim an exact live price when price is null.

Unknown prices may be approximate ranges only when clearly labelled "AI estimated".

Do not change OSRM route distances.

Budget is the PRIMARY constraint.

Current location, destination, transport, hotel, food, entry fees and local route costs must be considered.

If the trip is over budget, explain practical trade-offs.

Return ONLY JSON.

Required JSON fields:

{
  "summary": "...",
  "budgetStatus": "...",
  "budgetAdvice": [],
  "transportAdvice": "...",
  "estimatedUnknownCosts": [],
  "recommendedPlaces": [],
  "recommendedHotels": [],
  "dailyAdvice": []
}

DATA:

${JSON.stringify(data)}
`;

  try {
    const response =
      await Promise.race([
        ai.models.generateContent({
          model:
            GEMINI_MODEL,

          contents:
            prompt,
        }),

        new Promise(
          (_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Gemini timeout'
                  )
                ),
              12000
            )
        ),
      ]);

    const raw =
      response?.text ||
      response?.candidates?.[0]
        ?.content?.parts?.[0]
        ?.text ||
      '';

    const result =
      parseJson(raw);

    if (!result) {
      return null;
    }

    return {
      ...result,

      recommendedPlaces:
        safeNames(
          result.recommendedPlaces,
          data.places
        ),

      recommendedHotels:
        safeNames(
          result.recommendedHotels,
          data.hotels
        ),
    };
  } catch (error) {
    console.warn(
      'Gemini failed:',
      error.message
    );

    return null;
  }
}

// ============================================================
// ROOT
// ============================================================

app.get(
  '/',
  (req, res) => {
    res.json({
      success: true,

      message:
        'SmartTourism backend is running',

      mode:
        'AI + Internet + Budget First',

      services: {
        mysql: true,
        openStreetMap: true,
        overpass: true,
        osrm: true,
        gemini: Boolean(ai),
        budgetFirst: true,
        currentLocation: true,
        routeOptimization: true,
      },
    });
  }
);

// ============================================================
// HEALTH
// ============================================================

app.get(
  '/api/health',
  async (req, res) => {
    let mysqlConnected =
      false;

    try {
      await db.query(
        'SELECT 1'
      );

      mysqlConnected =
        true;
    } catch {}

    res.json({
      success: true,

      backend: true,

      mysql:
        mysqlConnected,

      openStreetMap:
        true,

      overpass:
        true,

      osrm:
        true,

      geminiAI:
        Boolean(ai),

      geminiModel:
        GEMINI_MODEL,

      budgetFirst:
        true,

      currentLocation:
        true,

      routeOptimization:
        true,

      databaseStoresPOIs:
        false,
    });
  }
);

// ============================================================
// USERS
// ============================================================

app.post(
  '/api/users',
  async (req, res) => {
    try {
      const name =
        text(
          req.body?.name,
          100
        );

      const email =
        text(
          req.body?.email,
          180
        ).toLowerCase();

      if (
        !name ||
        !email
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              'Name and email are required.',
          });
      }

      const [oldUsers] =
        await db.execute(
          `
          SELECT id, name, email
          FROM users
          WHERE email = ?
          LIMIT 1
          `,
          [email]
        );

      if (
        oldUsers.length
      ) {
        return res.json({
          success: true,

          user:
            oldUsers[0],

          existing:
            true,
        });
      }

      const [result] =
        await db.execute(
          `
          INSERT INTO users
          (name, email)
          VALUES (?, ?)
          `,
          [
            name,
            email,
          ]
        );

      const [rows] =
        await db.execute(
          `
          SELECT
            id,
            name,
            email,
            created_at
          FROM users
          WHERE id = ?
          `,
          [result.insertId]
        );

      res.status(201).json({
        success: true,

        user:
          rows[0],
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          'Unable to save user.',

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// TRIP HISTORY
// ============================================================

app.get(
  '/api/users/:id/trips',
  async (req, res) => {
    try {
      const userId =
        Number(
          req.params.id
        );

      const [rows] =
        await db.execute(
          `
          SELECT
            id,
            destination,
            days,
            travellers,
            budget,
            interest,
            created_at
          FROM trip_history
          WHERE user_id = ?
          ORDER BY created_at DESC
          `,
          [userId]
        );

      res.json({
        success: true,

        trips:
          rows,
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          'Unable to load trip history.',
      });
    }
  }
);

// ============================================================
// DESTINATION SEARCH
// ============================================================

app.get(
  '/api/destination/search',
  async (req, res) => {
    try {
      const query =
        req.query.q ||
        req.query.destination;

      const location =
        await geocode(query);

      res.json({
        success: true,

        location,
      });
    } catch (error) {
      res.status(404).json({
        success: false,

        message:
          error.message,
      });
    }
  }
);

// ============================================================
// MAIN TRIP API
// ============================================================

app.post(
  '/api/trip',
  async (req, res) => {
    const started =
      Date.now();

    try {
      const {
        destination,
        days,
        budget,
        travellers,
        interest,
        currentLocation,
        travelMode,
        userId,
      } =
        req.body || {};

      const dest =
        text(
          destination,
          150
        );

      const D =
        Number(days);

      const B =
        Number(budget);

      const P =
        Number(travellers);

      const I =
        INTEREST_KEYWORDS[
          interest
        ]
          ? interest
          : 'All';

      const M =
        [
          'cab',
          'own_car',
          'walking',
          'public_transport',
        ].includes(
          travelMode
        )
          ? travelMode
          : 'cab';

      // ---------------- VALIDATION ----------------

      if (!dest) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              'Destination is required.',
          });
      }

      if (
        !Number.isFinite(D) ||
        D < 1 ||
        D > 30
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              'Days must be between 1 and 30.',
          });
      }

      if (
        !Number.isFinite(B) ||
        B <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              'A valid total budget is required.',
          });
      }

      if (
        !Number.isFinite(P) ||
        P < 1 ||
        P > 50
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              'Travellers must be between 1 and 50.',
          });
      }

      console.log(
        `\n🌍 Trip: ${dest} | ₹${B} | ${P} people | ${D} days | ${I} | ${M}`
      );

      // ==================================================
      // DESTINATION
      // ==================================================

      const destinationPoint =
        await geocode(
          dest
        );

      // ==================================================
      // CURRENT LOCATION
      // ==================================================

      let origin =
        null;

      let originSource =
        'Destination fallback';

      if (
        currentLocation &&
        Number.isFinite(
          Number(
            currentLocation.latitude
          )
        ) &&
        Number.isFinite(
          Number(
            currentLocation.longitude
          )
        )
      ) {
        origin = {
          name:
            text(
              currentLocation.name,
              180
            ) ||
            'Current location',

          latitude:
            Number(
              currentLocation.latitude
            ),

          longitude:
            Number(
              currentLocation.longitude
            ),
        };

        originSource =
          'Browser GPS';
      } else if (
        typeof currentLocation ===
        'string' &&
        currentLocation.trim()
      ) {
        try {
          origin =
            await geocode(
              currentLocation
            );

          originSource =
            'Geocoded current location';
        } catch {}
      }

      if (!origin) {
        origin = {
          ...destinationPoint,

          name:
            'Destination start point',
        };
      }

      // ==================================================
      // CURRENT -> DESTINATION ROUTE
      // ==================================================

      const interRoute =
        await route(
          [
            origin,
            destinationPoint,
          ],

          M === 'walking'
            ? 'foot'
            : 'driving'
        );

      const interDistance =
        interRoute?.distanceKm ??
        haversineKm(
          origin,
          destinationPoint
        ) ??
        0;

      const interTransport =
        transportEstimate(
          interDistance,
          M,
          P
        );

      // ==================================================
      // INTERNET DISCOVERY
      // ==================================================

      const discovered =
        await discover(
          destinationPoint
        );

      // ==================================================
      // RANK PLACES
      // ==================================================

      const rankedPlaces =
        rankPlaces(
          discovered.places,
          I,
          B,
          P
        );

      // ==================================================
      // HOTELS
      // ==================================================

      const nights =
        Math.max(
          1,
          D - 1
        );

      const rankedHotels =
        rankHotels(
          discovered.hotels,
          B,
          nights
        );

      // ==================================================
      // BUDGET-FIRST HOTEL
      // ==================================================

      const hotelBudget =
        B * 0.45;

      /*
       * Unknown price hotels are still allowed.
       *
       * We do NOT throw them away because
       * OpenStreetMap often does not contain
       * current hotel prices.
       */

      const affordableHotels =
        rankedHotels.filter(
          (hotel) =>
            hotel.price_per_night ==
              null ||
            Number(
              hotel.price_per_night
            ) *
              nights <=
              hotelBudget
        );

      const selectedHotel =
        affordableHotels[0] ||
        rankedHotels[0] ||
        null;

      // ==================================================
      // BUDGET-FIRST PLACES
      // ==================================================

      const activityBudget =
        B * 0.10;

      let selectedPlaces =
        rankedPlaces
          .filter(
            (place) =>
              place.estimated_cost ==
                null ||
              Number(
                place.estimated_cost
              ) *
                P <=
                activityBudget
          )
          .slice(
            0,
            Math.min(
              12,
              Math.max(
                3,
                D * 3
              )
            )
          );

      if (
        selectedPlaces.length <
        3
      ) {
        selectedPlaces = [
          ...selectedPlaces,

          ...rankedPlaces
            .filter(
              (place) =>
                !selectedPlaces.some(
                  (x) =>
                    x.id ===
                    place.id
                )
            )
            .slice(
              0,
              3 -
                selectedPlaces.length
            ),
        ];
      }

      // ==================================================
      // DAY PLAN
      // ==================================================

      const hotelPoint =
        selectedHotel
          ? {
              name:
                selectedHotel.name,

              latitude:
                selectedHotel.latitude,

              longitude:
                selectedHotel.longitude,
            }
          : null;

      const dayWisePlan =
        await buildDayPlan(
          selectedPlaces,
          hotelPoint,
          D,
          M
        );

      // ==================================================
      // LOCAL TRANSPORT
      // ==================================================

      const localDistance =
        dayWisePlan.reduce(
          (sum, day) =>
            sum +
            Number(
              day.route
                ?.distanceKm ||
                0
            ),
          0
        );

      const localTransport =
        transportEstimate(
          localDistance,
          M,
          P
        );

      // ==================================================
      // FOOD
      // ==================================================

      const foodEstimate =
        Math.min(
          B * 0.20,
          P * D * 700
        );

      // ==================================================
      // HOTEL COST
      // ==================================================

      const hotelCost =
        selectedHotel?.price_per_night !=
        null
          ? Number(
              selectedHotel.price_per_night
            ) * nights
          : null;

      // ==================================================
      // ENTRY FEES
      // ==================================================

      const entryFees =
        dayWisePlan.reduce(
          (sum, day) =>
            sum +
            Number(
              day.entryCost ||
                0
            ) *
              P,
          0
        );

      // ==================================================
      // TOTAL
      // ==================================================

      const total =
        (hotelCost || 0) +
        interTransport.estimatedCost +
        localTransport.estimatedCost +
        foodEstimate +
        entryFees;

      const remaining =
        B - total;

      // ==================================================
      // BUDGET SUMMARY
      // ==================================================

      const budgetSummary = {
        totalBudget:
          money(B),

        hotelBudget:
          money(hotelBudget),

        hotelBudgetTotal:
          money(hotelBudget),

        hotelCost:
          hotelCost == null
            ? null
            : money(hotelCost),

        hotelEstimate:
          hotelCost == null
            ? null
            : money(hotelCost),

        outboundTransport:
          interTransport.estimatedCost,

        outboundTransportRange: {
          low:
            interTransport.low,

          high:
            interTransport.high,
        },

        destinationTransportCost:
          interTransport.estimatedCost,

        destinationTransportRange: {
          low:
            interTransport.low,

          high:
            interTransport.high,
        },

        localTransport:
          localTransport.estimatedCost,

        localTransportCost:
          localTransport.estimatedCost,

        localTransportRange: {
          low:
            localTransport.low,

          high:
            localTransport.high,
        },

        food:
          money(foodEstimate),

        foodCost:
          money(foodEstimate),

        entryFees:
          money(entryFees),

        entryCost:
          money(entryFees),

        estimatedTripCost:
          money(total),

        remainingBudget:
          money(remaining),

        budgetExceeded:
          total > B,

        status:
          total > B
            ? 'Over budget'
            : remaining <
              B * 0.10
            ? 'Near budget'
            : 'Within budget',

        nights,

        notes: [
          'Transport is an estimate, not a live cab quote.',
          'Unknown prices are not treated as exact.',
          'Food is an approximate planning allowance.',
          'Budget is the primary planning constraint.',
        ],
      };

      // ==================================================
      // GEMINI INPUT
      // ==================================================

      const aiInput = {
        currentLocation:
          origin,

        destination:
          destinationPoint,

        days: D,

        travellers: P,

        budget: B,

        interest: I,

        travelMode: M,

        budgetSummary,

        places:
          selectedPlaces,

        hotels:
          rankedHotels.slice(
            0,
            8
          ),

        dayWisePlan:
          dayWisePlan.map(
            (day) => ({
              day:
                day.day,

              places:
                day.places.map(
                  (place) =>
                    place.name
                ),

              routeDistanceKm:
                day.route
                  ?.distanceKm ??
                null,

              routeDurationMinutes:
                day.route
                  ?.durationMinutes ??
                null,

              entryCost:
                day.entryCost,
            })
          ),
      };

      // ==================================================
      // GEMINI
      // ==================================================

      const aiResult =
        await geminiPlan(
          aiInput
        );

      // ==================================================
      // FALLBACK AI
      // ==================================================

      const fallback = {
        summary:
          'Budget-first plan generated from real internet-discovered data.',

        budgetStatus:
          budgetSummary.status,

        budgetAdvice:
          budgetSummary.budgetExceeded
            ? [
                'Choose a cheaper hotel or reduce paid attractions.',
                'Use a lower-cost transport option where practical.',
              ]
            : [
                'The plan is optimized around your available budget.',
              ],

        transportAdvice:
          interTransport.basis,

        estimatedUnknownCosts:
          [],

        recommendedPlaces:
          selectedPlaces.map(
            (place) =>
              place.name
          ),

        recommendedHotels:
          rankedHotels
            .slice(0, 8)
            .map(
              (hotel) =>
                hotel.name
            ),

        dailyAdvice:
          [],
      };

      // ==================================================
      // SAVE TRIP HISTORY
      // ==================================================

      let tripHistoryId =
        null;

      if (userId) {
        try {
          const [
            users,
          ] =
            await db.execute(
              `
              SELECT id
              FROM users
              WHERE id = ?
              LIMIT 1
              `,
              [
                Number(
                  userId
                ),
              ]
            );

          if (
            users.length
          ) {
            const [
              result,
            ] =
              await db.execute(
                `
                INSERT INTO trip_history
                (
                  user_id,
                  destination,
                  days,
                  travellers,
                  budget,
                  interest
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                  Number(
                    userId
                  ),

                  dest,

                  D,

                  P,

                  B,

                  I,
                ]
              );

            tripHistoryId =
              result.insertId;
          }
        } catch (error) {
          console.warn(
            'Trip history save failed:',
            error.message
          );
        }
      }

      // ==================================================
      // RESPONSE
      // ==================================================

      const seconds =
        Number(
          (
            (Date.now() -
              started) /
            1000
          ).toFixed(2)
        );

      const interCityRoute = {
        distanceKm:
          Number(
            interDistance.toFixed(
              2
            )
          ),

        durationMinutes:
          interRoute
            ?.durationMinutes ??
          null,

        route:
          interRoute,

        source:
          interRoute
            ? 'OSRM'
            : 'Haversine fallback',
      };

      const trip = {
        destination:
          dest,

        destinationLocation: {
          name:
            destinationPoint.name,

          displayName:
            destinationPoint.displayName,

          latitude:
            destinationPoint.latitude,

          longitude:
            destinationPoint.longitude,
        },

        currentLocation: {
          ...origin,

          source:
            originSource,
        },

        currentToDestination:
          interCityRoute,

        interCityRoute,

        days: D,

        travellers: P,

        budget: B,

        interest: I,

        travelMode: M,

        transport: {
          outbound:
            interTransport,

          local:
            localTransport,

          totalEstimated:
            interTransport
              .estimatedCost +
            localTransport
              .estimatedCost,
        },

        recommendedPlaces:
          selectedPlaces,

        allPlaces:
          discovered.places,

        recommendedHotels:
          rankedHotels.slice(
            0,
            8
          ),

        selectedBudgetHotel:
          selectedHotel,

        affordableHotels,

        dayWisePlan,

        budgetSummary,

        aiRecommendations:
          aiResult ||
          fallback,

        aiUsed:
          Boolean(aiResult),

        dataSources: {
          places:
            'OpenStreetMap / Overpass',

          hotels:
            'OpenStreetMap / Overpass',

          destination:
            'Nominatim',

          routing:
            'OSRM',

          ai:
            ai
              ? GEMINI_MODEL
              : 'Fallback',
        },

        warnings: [
          discovered.warning,

          ...(budgetSummary.budgetExceeded
            ? [
                'Estimated cost is above the supplied budget.',
              ]
            : []),
        ].filter(Boolean),

        tripHistoryId,

        generationTimeSeconds:
          seconds,

        generationTimeMs:
          Date.now() -
          started,
      };

      console.log(
        `📍 ${interDistance.toFixed(
          2
        )} km | 🚗 ₹${interTransport.estimatedCost} | 🏨 ₹${money(
          hotelCost || 0
        )} | 🍴 ₹${money(
          foodEstimate
        )} | 🎟️ ₹${money(
          entryFees
        )} | 💰 ₹${money(
          total
        )} | ${seconds}s`
      );

      res.json({
        success: true,

        message:
          'AI budget-first trip generated successfully.',

        trip,
      });
    } catch (error) {
      console.error(
        '❌ Trip generation error:',
        error.stack ||
          error.message
      );

      res.status(500).json({
        success: false,

        message:
          'Failed to generate trip.',

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// FEEDBACK
// ============================================================

app.post(
  '/api/feedback',
  async (req, res) => {
    try {
      const userId =
        req.body?.userId
          ? Number(
              req.body.userId
            )
          : null;

      const rating =
        req.body?.rating
          ? Number(
              req.body.rating
            )
          : null;

      const message =
        text(
          req.body?.message,
          2000
        );

      if (
        rating != null &&
        (
          !Number.isFinite(
            rating
          ) ||
          rating < 1 ||
          rating > 5
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              'Rating must be between 1 and 5.',
          });
      }

      await db.execute(
        `
        INSERT INTO feedback
        (
          user_id,
          rating,
          message
        )
        VALUES (?, ?, ?)
        `,
        [
          userId,
          rating,
          message,
        ]
      );

      res.json({
        success: true,

        message:
          'Feedback saved successfully.',
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        message:
          'Unable to save feedback.',
      });
    }
  }
);

// ============================================================
// 404
// ============================================================

app.use(
  (req, res) =>
    res
      .status(404)
      .json({
        success: false,

        message:
          `API route not found: ${req.method} ${req.originalUrl}`,
      })
);

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    await db.query(
      'SELECT 1'
    );

    console.log(
      '✅ MySQL connected successfully'
    );

    console.log(
      ai
        ? `✅ Gemini initialized: ${GEMINI_MODEL}`
        : '⚠️ Gemini API key not configured; fallback will be used.'
    );

    app.listen(
      PORT,
      () => {
        console.log(
          '======================================'
        );

        console.log(
          '🚀 SmartTourism Backend Started'
        );

        console.log(
          `🌐 http://localhost:${PORT}`
        );

        console.log(
          '🌍 OSM / Overpass: ENABLED'
        );

        console.log(
          '📍 Current location: ENABLED'
        );

        console.log(
          '🛣️ OSRM route planning: ENABLED'
        );

        console.log(
          '💰 Budget-first optimizer: ENABLED'
        );

        console.log(
          '🚗 Transport estimation: ENABLED'
        );

        console.log(
          `🤖 Gemini: ${
            ai
              ? GEMINI_MODEL
              : 'FALLBACK'
          }`
        );

        console.log(
          '💾 POIs stored in MySQL: DISABLED'
        );

        console.log(
          '======================================'
        );
      }
    );
  } catch (error) {
    console.error(
      '❌ MySQL connection failed:',
      error.message
    );

    process.exit(1);
  }
}

startServer();