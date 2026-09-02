import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

/* =========================================================
   API
========================================================= */

const OSRM_URL =
  "https://router.project-osrm.org/route/v1/driving";

/* =========================================================
   DEFAULT CENTER
========================================================= */

const DEFAULT_CENTER = [
  22.5726,
  88.3639,
];

/* =========================================================
   MARKER ICONS
========================================================= */

const placeIcon =
  new L.DivIcon({
    className:
      "smart-place-marker",

    html: `
      <div style="
        width:34px;
        height:34px;
        border-radius:50%;
        background:#17221d;
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:17px;
        border:3px solid white;
        box-shadow:0 4px 14px rgba(0,0,0,.25);
      ">
        📍
      </div>
    `,

    iconSize: [34, 34],

    iconAnchor: [17, 17],

    popupAnchor: [0, -18],
  });

const hotelIcon =
  new L.DivIcon({
    className:
      "smart-hotel-marker",

    html: `
      <div style="
        width:36px;
        height:36px;
        border-radius:50%;
        background:#8b4513;
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
        border:3px solid white;
        box-shadow:0 4px 14px rgba(0,0,0,.25);
      ">
        🏨
      </div>
    `,

    iconSize: [36, 36],

    iconAnchor: [18, 18],

    popupAnchor: [0, -19],
  });

const currentIcon =
  new L.DivIcon({
    className:
      "smart-current-marker",

    html: `
      <div style="
        width:42px;
        height:42px;
        border-radius:50%;
        background:#2563eb;
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:19px;
        border:4px solid white;
        box-shadow:0 4px 18px rgba(37,99,235,.45);
      ">
        🧭
      </div>
    `,

    iconSize: [42, 42],

    iconAnchor: [21, 21],

    popupAnchor: [0, -22],
  });

/* =========================================================
   HELPERS
========================================================= */

function getCoordinates(item) {
  if (!item) {
    return null;
  }

  const latitude = Number(
    item.latitude ??
      item.lat
  );

  const longitude = Number(
    item.longitude ??
      item.lng ??
      item.lon
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return [
    latitude,
    longitude,
  ];
}

function getKey(item, prefix) {
  return (
    item?.id ||
    `${prefix}-${item?.name}-${item?.latitude}-${item?.longitude}`
  );
}

/* =========================================================
   MAP VIEW CONTROLLER
========================================================= */

function MapViewController({
  currentLocation,
  places,
  hotels,
}) {
  const map = useMap();

  useEffect(() => {
    const points = [];

    if (currentLocation) {
      points.push(currentLocation);
    }

    places.forEach((place) => {
      const coords =
        getCoordinates(place);

      if (coords) {
        points.push(coords);
      }
    });

    hotels.forEach((hotel) => {
      const coords =
        getCoordinates(hotel);

      if (coords) {
        points.push(coords);
      }
    });

    if (points.length === 0) {
      map.setView(
        DEFAULT_CENTER,
        13
      );

      return;
    }

    if (points.length === 1) {
      map.setView(
        points[0],
        14,
        {
          animate: true,
          duration: 0.8,
        }
      );

      return;
    }

    const bounds =
      L.latLngBounds(points);

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 14,
      animate: true,
    });
  }, [
    map,
    currentLocation,
    places,
    hotels,
  ]);

  return null;
}

/* =========================================================
   TOURISM MAP
========================================================= */

export default function TourismMap({
  places = [],
  hotels = [],
  destination,
}) {
  const [
    currentLocation,
    setCurrentLocation,
  ] = useState(null);

  const [
    locationError,
    setLocationError,
  ] = useState("");

  const [
    locating,
    setLocating,
  ] = useState(false);

  const [
    selectedPlace,
    setSelectedPlace,
  ] = useState(null);

  const [
    selectedHotel,
    setSelectedHotel,
  ] = useState(null);

  const [
    routeCoordinates,
    setRouteCoordinates,
  ] = useState([]);

  const [
    routeDistance,
    setRouteDistance,
  ] = useState(0);

  const [
    routeDuration,
    setRouteDuration,
  ] = useState(0);

  const [
    routeLoading,
    setRouteLoading,
  ] = useState(false);

  const [
    routeError,
    setRouteError,
  ] = useState("");

  /* =======================================================
     VALID PLACES
  ======================================================= */

  const validPlaces = useMemo(
    () =>
      places.filter(
        (place) =>
          getCoordinates(place)
      ),
    [places]
  );

  /* =======================================================
     VALID HOTELS
  ======================================================= */

  const validHotels = useMemo(
    () =>
      hotels.filter(
        (hotel) =>
          getCoordinates(hotel)
      ),
    [hotels]
  );

  /* =======================================================
     CURRENT LOCATION
  ======================================================= */

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location services."
      );

      return;
    }

    setLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const coords = [
          latitude,
          longitude,
        ];

        console.log(
          "📍 Current location:",
          coords
        );

        setCurrentLocation(
          coords
        );

        setLocating(false);
      },

      (error) => {
        console.error(
          "Location error:",
          error
        );

        setLocating(false);

        if (error.code === 1) {
          setLocationError(
            "Location permission denied. Allow location access from your browser."
          );
        } else if (
          error.code === 2
        ) {
          setLocationError(
            "Current location could not be detected."
          );
        } else {
          setLocationError(
            "Location request timed out."
          );
        }
      },

      {
        enableHighAccuracy: true,

        timeout: 15000,

        maximumAge: 60000,
      }
    );
  };

  /* =======================================================
     AUTO DETECT LOCATION
  ======================================================= */

  useEffect(() => {
    detectLocation();
  }, []);

  /* =======================================================
     CLEAR ROUTE
  ======================================================= */

  const clearRoute = () => {
    setRouteCoordinates([]);

    setRouteDistance(0);

    setRouteDuration(0);

    setRouteError("");
  };

  /* =======================================================
     GET ROUTE USING OSRM
  ======================================================= */

  const calculateRoute = async (
    destinationItem
  ) => {
    const destinationCoords =
      getCoordinates(
        destinationItem
      );

    if (!destinationCoords) {
      return;
    }

    if (!currentLocation) {
      setRouteError(
        "Current location is not available."
      );

      return;
    }

    setRouteLoading(true);

    setRouteError("");

    setSelectedPlace(
      destinationItem?.type ===
        "hotel"
        ? null
        : destinationItem
    );

    setSelectedHotel(
      destinationItem?.type ===
        "hotel"
        ? destinationItem
        : null
    );

    try {
      const startLat =
        currentLocation[0];

      const startLon =
        currentLocation[1];

      const endLat =
        destinationCoords[0];

      const endLon =
        destinationCoords[1];

      const url =
        `${OSRM_URL}/` +
        `${startLon},${startLat};` +
        `${endLon},${endLat}` +
        `?overview=full&geometries=geojson`;

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Route service unavailable."
        );
      }

      const data =
        await response.json();

      const route =
        data?.routes?.[0];

      if (!route) {
        throw new Error(
          "No route found."
        );
      }

      const coordinates =
        route.geometry?.coordinates ||
        [];

      const leafletCoordinates =
        coordinates.map(
          ([longitude, latitude]) =>
            [
              latitude,
              longitude,
            ]
        );

      setRouteCoordinates(
        leafletCoordinates
      );

      setRouteDistance(
        Number(
          route.distance || 0
        ) / 1000
      );

      setRouteDuration(
        Number(
          route.duration || 0
        ) / 60
      );

    } catch (error) {
      console.error(
        "Routing error:",
        error
      );

      setRouteCoordinates([]);

      setRouteError(
        "Unable to calculate road route right now."
      );
    } finally {
      setRouteLoading(false);
    }
  };

  /* =======================================================
     FOCUS PLACE FROM APP
  ======================================================= */

  useEffect(() => {
    const handleFocusPlace = (
      event
    ) => {
      const place =
        event.detail;

      if (!place) {
        return;
      }

      setSelectedPlace(place);

      setSelectedHotel(null);

      calculateRoute(place);
    };

    const handleFocusHotel = (
      event
    ) => {
      const hotel =
        event.detail;

      if (!hotel) {
        return;
      }

      setSelectedHotel(hotel);

      setSelectedPlace(null);

      calculateRoute({
        ...hotel,
        type: "hotel",
      });
    };

    window.addEventListener(
      "focusPlace",
      handleFocusPlace
    );

    window.addEventListener(
      "focusHotel",
      handleFocusHotel
    );

    return () => {
      window.removeEventListener(
        "focusPlace",
        handleFocusPlace
      );

      window.removeEventListener(
        "focusHotel",
        handleFocusHotel
      );
    };
  }, [
    currentLocation,
  ]);

  /* =======================================================
     ROUTE TO PLACE
  ======================================================= */

  const handlePlaceClick = (
    place
  ) => {
    setSelectedPlace(place);

    setSelectedHotel(null);

    calculateRoute(place);
  };

  /* =======================================================
     ROUTE TO HOTEL
  ======================================================= */

  const handleHotelClick = (
    hotel
  ) => {
    setSelectedHotel(hotel);

    setSelectedPlace(null);

    calculateRoute({
      ...hotel,
      type: "hotel",
    });
  };

  /* =======================================================
     OPEN EXTERNAL DIRECTIONS
  ======================================================= */

  const openDirections = (
    item
  ) => {
    const coords =
      getCoordinates(item);

    if (!coords) {
      return;
    }

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${coords[0]},${coords[1]}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section
      className="tourism-map-section"
      style={{
        marginTop: "30px",
      }}
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap",
          marginBottom: "15px",
        }}
      >

        <div>

          <p className="small-label">
            SMART MAP
          </p>

          <h3
            style={{
              margin: 0,
            }}
          >
            Explore {destination}
          </h3>

          <p
            style={{
              margin:
                "5px 0 0",
              color:
                "#68756d",
              fontSize:
                "14px",
            }}
          >
            Real places, hotels
            and road routes
          </p>

        </div>

        <button
          type="button"
          onClick={
            detectLocation
          }
          disabled={
            locating
          }
          style={{
            border: "none",
            background:
              "#17221d",
            color: "white",
            borderRadius:
              "10px",
            padding:
              "10px 15px",
            cursor:
              "pointer",
            fontWeight:
              "600",
          }}
        >
          {locating
            ? "Locating..."
            : "📍 My Location"}
        </button>

      </div>

      {/* =================================================
          LOCATION ERROR
      ================================================= */}

      {locationError && (
        <div
          style={{
            marginBottom:
              "10px",
            padding:
              "11px 14px",
            borderRadius:
              "10px",
            background:
              "#fff7e6",
            color:
              "#7a5a00",
            fontSize:
              "13px",
          }}
        >
          ⚠️{" "}
          {locationError}
        </div>
      )}

      {/* =================================================
          ROUTE INFO
      ================================================= */}

      {routeCoordinates.length >
        0 && (
        <div
          style={{
            marginBottom:
              "12px",
            padding:
              "15px 18px",
            borderRadius:
              "13px",
            background:
              "#eef4ef",
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap:
              "15px",
            flexWrap:
              "wrap",
          }}
        >

          <div>

            <strong>
              🧭 Route calculated
            </strong>

            <div
              style={{
                marginTop:
                  "5px",
                color:
                  "#526058",
                fontSize:
                  "13px",
              }}
            >
              Your location →{" "}
              {selectedPlace?.name ||
                selectedHotel?.name}
            </div>

          </div>

          <div
            style={{
              display:
                "flex",
              gap:
                "18px",
              alignItems:
                "center",
            }}
          >

            <div>
              <strong>
                {routeDistance.toFixed(
                  1
                )} km
              </strong>

              <small
                style={{
                  display:
                    "block",
                  color:
                    "#68756d",
                }}
              >
                Distance
              </small>
            </div>

            <div>
              <strong>
                {Math.round(
                  routeDuration
                )} min
              </strong>

              <small
                style={{
                  display:
                    "block",
                  color:
                    "#68756d",
                }}
              >
                Driving time
              </small>
            </div>

            <button
              type="button"
              onClick={() =>
                openDirections(
                  selectedPlace ||
                    selectedHotel
                )
              }
              style={{
                border:
                  "none",
                background:
                  "#8b4513",
                color:
                  "white",
                borderRadius:
                  "9px",
                padding:
                  "9px 12px",
                cursor:
                  "pointer",
                fontWeight:
                  "600",
              }}
            >
              Directions
            </button>

          </div>

        </div>
      )}

      {/* =================================================
          ROUTE LOADING
      ================================================= */}

      {routeLoading && (
        <div
          style={{
            marginBottom:
              "10px",
            padding:
              "10px 14px",
            borderRadius:
              "10px",
            background:
              "#f5f8f5",
            color:
              "#526058",
            fontSize:
              "13px",
          }}
        >
          🧭 Calculating real
          road route...
        </div>
      )}

      {/* =================================================
          ROUTE ERROR
      ================================================= */}

      {routeError && (
        <div
          style={{
            marginBottom:
              "10px",
            padding:
              "10px 14px",
            borderRadius:
              "10px",
            background:
              "#fff5f5",
            color:
              "#9b3d3d",
            fontSize:
              "13px",
          }}
        >
          ⚠️ {routeError}
        </div>
      )}

      {/* =================================================
          MAP
      ================================================= */}

      <div
        style={{
          position:
            "relative",
          width:
            "100%",
          height:
            "540px",
          borderRadius:
            "18px",
          overflow:
            "hidden",
          boxShadow:
            "0 10px 30px rgba(0,0,0,.12)",
        }}
      >

        {/* =================================================
            LEGEND
        ================================================= */}

        <div
          style={{
            position:
              "absolute",
            zIndex: 1000,
            top: "15px",
            right: "15px",
            background:
              "rgba(255,255,255,.96)",
            padding:
              "12px 14px",
            borderRadius:
              "12px",
            boxShadow:
              "0 4px 15px rgba(0,0,0,.15)",
            fontSize:
              "12px",
            lineHeight:
              "1.8",
          }}
        >

          <div>
            📍 Tourist Place
          </div>

          <div>
            🏨 Hotel
          </div>

          <div>
            🧭 Your Location
          </div>

          {routeCoordinates.length >
            0 && (
            <div>
              ━ Route
            </div>
          )}

        </div>

        <MapContainer
          center={
            currentLocation ||
            DEFAULT_CENTER
          }
          zoom={13}
          scrollWheelZoom={true}
          className="tourism-map"
          style={{
            width: "100%",
            height: "100%",
          }}
        >

          {/* =================================================
              OPEN STREET MAP
          ================================================= */}

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* =================================================
              MAP VIEW CONTROLLER
          ================================================= */}

          <MapViewController
            currentLocation={
              currentLocation
            }
            places={
              validPlaces
            }
            hotels={
              validHotels
            }
          />

          {/* =================================================
              CURRENT LOCATION
          ================================================= */}

          {currentLocation && (
            <Marker
              position={
                currentLocation
              }
              icon={
                currentIcon
              }
            >
              <Popup>

                <strong>
                  📍 Your Current
                  Location
                </strong>

                <br />

                <small>
                  Starting point
                  for your trip
                </small>

              </Popup>
            </Marker>
          )}

          {/* =================================================
              TOURIST PLACES
          ================================================= */}

          {validPlaces.map(
            (place) => {

              const coords =
                getCoordinates(
                  place
                );

              const selected =
                selectedPlace &&
                getKey(
                  selectedPlace,
                  "place"
                ) ===
                  getKey(
                    place,
                    "place"
                  );

              return (
                <Marker
                  key={getKey(
                    place,
                    "place"
                  )}
                  position={
                    coords
                  }
                  icon={
                    placeIcon
                  }
                  opacity={
                    selected
                      ? 1
                      : 0.9
                  }
                  eventHandlers={{
                    click: () =>
                      handlePlaceClick(
                        place
                      ),
                  }}
                >

                  <Popup>

                    <div
                      style={{
                        minWidth:
                          "190px",
                      }}
                    >

                      <strong>
                        📍{" "}
                        {place.name}
                      </strong>

                      {place.category && (
                        <div
                          style={{
                            marginTop:
                              "5px",
                            color:
                              "#68756d",
                            fontSize:
                              "12px",
                          }}
                        >
                          {
                            place.category
                          }
                        </div>
                      )}

                      {place.description && (
                        <p
                          style={{
                            fontSize:
                              "12px",
                            lineHeight:
                              "1.5",
                          }}
                        >
                          {
                            place.description
                          }
                        </p>
                      )}

                      {place.estimated_cost !=
                        null && (
                        <div
                          style={{
                            marginTop:
                              "7px",
                            fontWeight:
                              "700",
                          }}
                        >
                          🎟️ Approx. entry:{" "}
                          ₹
                          {Number(
                            place.estimated_cost
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openDirections(
                            place
                          )
                        }
                        style={{
                          marginTop:
                            "10px",
                          width:
                            "100%",
                          border:
                            "none",
                          background:
                            "#17221d",
                          color:
                            "white",
                          padding:
                            "8px",
                          borderRadius:
                            "8px",
                          cursor:
                            "pointer",
                        }}
                      >
                        🧭 Directions
                      </button>

                    </div>

                  </Popup>

                </Marker>
              );
            }
          )}

          {/* =================================================
              HOTELS
          ================================================= */}

          {validHotels.map(
            (hotel) => {

              const coords =
                getCoordinates(
                  hotel
                );

              const selected =
                selectedHotel &&
                getKey(
                  selectedHotel,
                  "hotel"
                ) ===
                  getKey(
                    hotel,
                    "hotel"
                  );

              return (
                <Marker
                  key={getKey(
                    hotel,
                    "hotel"
                  )}
                  position={
                    coords
                  }
                  icon={
                    hotelIcon
                  }
                  opacity={
                    selected
                      ? 1
                      : 0.9
                  }
                  eventHandlers={{
                    click: () =>
                      handleHotelClick(
                        hotel
                      ),
                  }}
                >

                  <Popup>

                    <div
                      style={{
                        minWidth:
                          "190px",
                      }}
                    >

                      <strong>
                        🏨{" "}
                        {hotel.name}
                      </strong>

                      {hotel.rating !=
                        null && (
                        <div
                          style={{
                            marginTop:
                              "5px",
                          }}
                        >
                          ⭐{" "}
                          {hotel.rating}
                        </div>
                      )}

                      {hotel.address && (
                        <div
                          style={{
                            marginTop:
                              "5px",
                            color:
                              "#68756d",
                            fontSize:
                              "12px",
                          }}
                        >
                          📍{" "}
                          {
                            hotel.address
                          }
                        </div>
                      )}

                      {hotel.price_per_night !=
                        null ? (
                        <div
                          style={{
                            marginTop:
                              "8px",
                            fontWeight:
                              "700",
                          }}
                        >
                          💰 ₹
                          {Number(
                            hotel.price_per_night
                          ).toLocaleString(
                            "en-IN"
                          )}
                          /night
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop:
                              "8px",
                            color:
                              "#68756d",
                            fontSize:
                              "12px",
                          }}
                        >
                          Price not
                          available
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openDirections(
                            hotel
                          )
                        }
                        style={{
                          marginTop:
                            "10px",
                          width:
                            "100%",
                          border:
                            "none",
                          background:
                            "#8b4513",
                          color:
                            "white",
                          padding:
                            "8px",
                          borderRadius:
                            "8px",
                          cursor:
                            "pointer",
                        }}
                      >
                        🧭 Directions
                      </button>

                    </div>

                  </Popup>

                </Marker>
              );
            }
          )}

          {/* =================================================
              ROUTE
          ================================================= */}

          {routeCoordinates.length >
            1 && (
            <Polyline
              positions={
                routeCoordinates
              }
              pathOptions={{
                color:
                  "#17221d",
                weight: 6,
                opacity: 0.8,
              }}
            />
          )}

          {/* =================================================
              CURRENT LOCATION ACCURACY AREA
          ================================================= */}

          {currentLocation && (
            <CircleMarker
              center={
                currentLocation
              }
              radius={18}
              pathOptions={{
                fillColor:
                  "#2563eb",
                fillOpacity:
                  0.08,
                color:
                  "#2563eb",
                opacity:
                  0.25,
                weight: 1,
              }}
            />
          )}

        </MapContainer>

      </div>

      {/* =================================================
          MAP BOTTOM INFO
      ================================================= */}

      <div
        style={{
          marginTop:
            "12px",
          display:
            "flex",
          gap:
            "10px",
          flexWrap:
            "wrap",
        }}
      >

        <div
          style={{
            padding:
              "10px 13px",
            background:
              "#f5f8f5",
            borderRadius:
              "10px",
            fontSize:
              "13px",
          }}
        >
          📍{" "}
          {validPlaces.length} tourist
          places
        </div>

        <div
          style={{
            padding:
              "10px 13px",
            background:
              "#fff7ef",
            borderRadius:
              "10px",
            fontSize:
              "13px",
          }}
        >
          🏨{" "}
          {validHotels.length} hotels
        </div>

        {currentLocation && (
          <div
            style={{
              padding:
                "10px 13px",
              background:
                "#eef4ff",
              borderRadius:
                "10px",
              fontSize:
                "13px",
            }}
          >
            🧭 Current location
            detected
          </div>
        )}

      </div>

    </section>
  );
}