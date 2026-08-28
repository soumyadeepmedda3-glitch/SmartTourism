import { useState, useEffect, useRef } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

import "./App.css";

const API_URL = "http://localhost:5000";

/* =========================================================
   LEAFLET DEFAULT ICON
========================================================= */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/* =========================================================
   CURRENT LOCATION ICON
========================================================= */

const currentLocationIcon = L.divIcon({
  className: "current-location-icon",

  html: `
    <div style="
      width:18px;
      height:18px;
      background:#4285F4;
      border:4px solid white;
      border-radius:50%;
      box-shadow:
        0 0 0 7px rgba(66,133,244,0.18),
        0 2px 10px rgba(0,0,0,0.25);
    "></div>
  `,

  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/* =========================================================
   TOURIST PLACE ICON
========================================================= */

const touristPlaceIcon = L.divIcon({
  className: "tourist-place-icon",

  html: `
    <div style="
      width:38px;
      height:38px;
      background:#17221d;
      border:3px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 3px 12px rgba(0,0,0,0.30);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <span style="
        transform:rotate(45deg);
        font-size:19px;
      ">
        🗺️
      </span>
    </div>
  `,

  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
});

/* =========================================================
   SELECTED PLACE ICON
========================================================= */

const selectedPlaceIcon = L.divIcon({
  className: "selected-place-icon",

  html: `
    <div style="
      width:44px;
      height:44px;
      background:#d97706;
      border:4px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 4px 15px rgba(0,0,0,0.35);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <span style="
        transform:rotate(45deg);
        font-size:21px;
      ">
        📍
      </span>
    </div>
  `,

  iconSize: [44, 44],
  iconAnchor: [22, 44],
  popupAnchor: [0, -44],
});

/* =========================================================
   NORMALIZE PLACE COORDINATES
========================================================= */

function getPlaceCoordinates(place) {
  if (!place) {
    return null;
  }

  const lat = Number(
    place.latitude ??
      place.lat ??
      place.location?.latitude ??
      place.location?.lat
  );

  const lng = Number(
    place.longitude ??
      place.lng ??
      place.lon ??
      place.location?.longitude ??
      place.location?.lng ??
      place.location?.lon
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng,
  };
}

/* =========================================================
   NORMALIZE PLACE
========================================================= */

function normalizePlace(place, index = 0) {
  const coordinates =
    getPlaceCoordinates(place);

  if (!coordinates) {
    return null;
  }

  return {
    ...place,

    id:
      place.id ??
      `place-${index}-${coordinates.latitude}-${coordinates.longitude}`,

    name:
      place.name ||
      "Tourist Place",

    latitude:
      coordinates.latitude,

    longitude:
      coordinates.longitude,

    category:
      place.category ||
      place.type ||
      "Tourist Attraction",

    description:
      place.description ||
      "Explore this tourist attraction.",

    estimated_cost:
      Number(place.estimated_cost ?? 0),
  };
}

/* =========================================================
   MAP VIEW CONTROLLER
========================================================= */

function MapViewController({
  places,
  currentLocation,
  selectedPlace,
}) {
  const map = useMap();

  const initialFitDone =
    useRef(false);

  useEffect(() => {
    if (!map) return;

    /* =========================================
       SELECTED PLACE
    ========================================= */

    if (selectedPlace) {
      const coordinates =
        getPlaceCoordinates(
          selectedPlace
        );

      if (coordinates) {
        map.flyTo(
          [
            coordinates.latitude,
            coordinates.longitude,
          ],
          15,
          {
            duration: 1.2,
          }
        );

        return;
      }
    }

    /* =========================================
       INITIAL FIT
    ========================================= */

    if (
      places.length > 0 &&
      !initialFitDone.current
    ) {
      const points = [];

      places.forEach((place) => {
        const coordinates =
          getPlaceCoordinates(place);

        if (coordinates) {
          points.push([
            coordinates.latitude,
            coordinates.longitude,
          ]);
        }
      });

      if (currentLocation) {
        const lat =
          Number(currentLocation[0]);

        const lng =
          Number(currentLocation[1]);

        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng)
        ) {
          points.push([lat, lng]);
        }
      }

      if (points.length > 0) {
        const bounds =
          L.latLngBounds(points);

        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 14,
        });

        initialFitDone.current =
          true;
      }
    }
  }, [
    map,
    places,
    currentLocation,
    selectedPlace,
  ]);

  return null;
}

/* =========================================================
   ROUTING CONTROL
========================================================= */

function RoutingControl({
  currentLocation,
  selectedPlace,
}) {
  const map = useMap();

  const routingControlRef =
    useRef(null);

  useEffect(() => {
    /* =========================================
       REMOVE OLD ROUTE
    ========================================= */

    if (routingControlRef.current) {
      try {
        map.removeControl(
          routingControlRef.current
        );
      } catch (error) {
        console.log(
          "Old route cleanup:",
          error
        );
      }

      routingControlRef.current =
        null;
    }

    /* =========================================
       VALIDATION
    ========================================= */

    if (
      !currentLocation ||
      !selectedPlace
    ) {
      return undefined;
    }

    const coordinates =
      getPlaceCoordinates(
        selectedPlace
      );

    if (!coordinates) {
      return undefined;
    }

    const startLat =
      Number(currentLocation[0]);

    const startLng =
      Number(currentLocation[1]);

    const endLat =
      coordinates.latitude;

    const endLng =
      coordinates.longitude;

    if (
      !Number.isFinite(startLat) ||
      !Number.isFinite(startLng) ||
      !Number.isFinite(endLat) ||
      !Number.isFinite(endLng)
    ) {
      console.error(
        "Invalid routing coordinates"
      );

      return undefined;
    }

    /* =========================================
       CREATE ROUTE
    ========================================= */

    const startPoint =
      L.latLng(
        startLat,
        startLng
      );

    const endPoint =
      L.latLng(
        endLat,
        endLng
      );

    const routingControl =
      L.Routing.control({
        waypoints: [
          startPoint,
          endPoint,
        ],

        router:
          L.Routing.osrmv1({
            serviceUrl:
              "https://router.project-osrm.org/route/v1",
          }),

        lineOptions: {
          styles: [
            {
              color: "#17221d",
              opacity: 0.9,
              weight: 6,
            },
          ],

          extendToWaypoints: true,

          missingRouteTolerance: 100,
        },

        addWaypoints: false,

        draggableWaypoints: false,

        routeWhileDragging: false,

        showAlternatives: false,

        fitSelectedRoutes: false,

        createMarker: function () {
          return null;
        },

        show: false,

        collapsible: false,
      }).addTo(map);

    routingControlRef.current =
      routingControl;

    /* =========================================
       ROUTE FOUND
    ========================================= */

    routingControl.on(
      "routesfound",
      (event) => {
        console.log(
          "Route successfully found:",
          event.routes
        );

        const route =
          event.routes?.[0];

        if (!route) return;

        const coordinates =
          route.coordinates;

        if (
          coordinates &&
          coordinates.length > 0
        ) {
          const bounds =
            L.latLngBounds(
              coordinates
            );

          map.fitBounds(bounds, {
            padding: [70, 70],
            maxZoom: 16,
          });
        }
      }
    );

    /* =========================================
       ROUTE ERROR
    ========================================= */

    routingControl.on(
      "routingerror",
      (event) => {
        console.error(
          "Routing error:",
          event
        );
      }
    );

    /* =========================================
       CLEANUP
    ========================================= */

    return () => {
      if (routingControlRef.current) {
        try {
          map.removeControl(
            routingControlRef.current
          );
        } catch (error) {
          console.log(
            "Route cleanup error:",
            error
          );
        }

        routingControlRef.current =
          null;
      }
    };
  }, [
    currentLocation,
    selectedPlace,
    map,
  ]);

  return null;
}

/* =========================================================
   TOURISM MAP
========================================================= */

function TourismMap({
  places = [],
  destination,
  selectedPlace,
  onPlaceSelect,
  currentLocation,
  setCurrentLocation,
}) {
  const [
    locationError,
    setLocationError,
  ] = useState("");

  const [
    locating,
    setLocating,
  ] = useState(false);

  /* =======================================================
     GET CURRENT LOCATION
  ======================================================= */

  const getCurrentLocation = () => {
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

        console.log(
          "CURRENT LOCATION:",
          latitude,
          longitude
        );

        setCurrentLocation([
          latitude,
          longitude,
        ]);

        setLocating(false);
      },

      (error) => {
        console.error(
          "Geolocation error:",
          error
        );

        setLocating(false);

        if (error.code === 1) {
          setLocationError(
            "Location permission denied. Click the 🔒 icon near localhost:5173 and allow Location."
          );
        } else if (
          error.code === 2
        ) {
          setLocationError(
            "Your location could not be detected. Make sure location services are enabled."
          );
        } else if (
          error.code === 3
        ) {
          setLocationError(
            "Location request timed out. Click My Location again."
          );
        } else {
          setLocationError(
            "Unable to detect your current location."
          );
        }
      },

      {
        enableHighAccuracy: true,

        timeout: 30000,

        maximumAge: 60000,
      }
    );
  };

  /* =======================================================
     AUTOMATIC LOCATION
  ======================================================= */

  useEffect(() => {
    getCurrentLocation();
  }, []);

  /* =======================================================
     SHOW ROUTE
  ======================================================= */

  const handleShowRoute = (place) => {
    console.log(
      "Show route clicked:",
      place
    );

    if (!currentLocation) {
      setLocationError(
        "Please allow location access first."
      );

      getCurrentLocation();

      return;
    }

    const coordinates =
      getPlaceCoordinates(place);

    if (!coordinates) {
      setLocationError(
        "Route is not available because this place has no map coordinates."
      );

      return;
    }

    onPlaceSelect({
      ...place,

      latitude:
        coordinates.latitude,

      longitude:
        coordinates.longitude,
    });

    setTimeout(() => {
      document
        .getElementById(
          "route-panel"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 200);
  };

  /* =======================================================
     VALID PLACES
  ======================================================= */

  const mappedPlaces =
    Array.isArray(places)
      ? places
          .map(
            (place, index) =>
              normalizePlace(
                place,
                index
              )
          )
          .filter(Boolean)
      : [];

  /* =======================================================
     DEBUG
  ======================================================= */

  console.log(
    "TourismMap received places:",
    places
  );

  console.log(
    "TourismMap mapped places:",
    mappedPlaces
  );

  console.log(
    "TourismMap selected place:",
    selectedPlace
  );

  /* =======================================================
     MAP CENTER
  ======================================================= */

  const defaultCenter = [
    27.041,
    88.2663,
  ];

  const mapCenter =
    mappedPlaces.length > 0
      ? [
          mappedPlaces[0]
            .latitude,
          mappedPlaces[0]
            .longitude,
        ]
      : defaultCenter;

  return (
    <div
      className="tourism-map-section"
      id="smart-map"
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
          marginBottom: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="small-label">
            EXPLORE{" "}
            {destination?.toUpperCase()}
          </p>

          <h3
            style={{
              fontFamily:
                "Syne, sans-serif",
              fontSize: "27px",
              margin: 0,
            }}
          >
            Explore Nearby Places
          </h3>
        </div>

        <button
          type="button"
          onClick={
            getCurrentLocation
          }
          disabled={locating}
          style={{
            border: "none",
            borderRadius: "10px",
            padding: "10px 15px",
            background: "#17221d",
            color: "white",
            cursor: locating
              ? "wait"
              : "pointer",
            fontWeight: "600",
          }}
        >
          {locating
            ? "Detecting..."
            : "📍 My Location"}
        </button>
      </div>

      {/* =================================================
          LOCATION ERROR
      ================================================= */}

      {locationError && (
        <div
          className="error-message"
          style={{
            marginBottom: "15px",
          }}
        >
          ⚠️ {locationError}
        </div>
      )}

      {/* =================================================
          LOCATION SUCCESS
      ================================================= */}

      {currentLocation && (
        <div
          style={{
            marginBottom: "12px",
            padding: "10px 14px",
            background: "#eef7f0",
            borderRadius: "10px",
            color: "#315c3b",
            fontSize: "13px",
          }}
        >
          📍 Current location detected

          <br />

          <small>
            {currentLocation[0].toFixed(
              6
            )}
            ,{" "}
            {currentLocation[1].toFixed(
              6
            )}
          </small>
        </div>
      )}

      {/* =================================================
          MAP PLACE COUNT
      ================================================= */}

      <div
        style={{
          marginBottom: "12px",
          padding: "10px 14px",
          background: "#f4f7f4",
          borderRadius: "10px",
          fontSize: "13px",
          color: "#4f5d53",
        }}
      >
        🗺️{" "}
        <strong>
          {mappedPlaces.length}
        </strong>{" "}
        tourist places available on
        the map.
      </div>

      {/* =================================================
          MAP
      ================================================= */}

      <div
        className="map-wrapper"
        style={{
          position: "relative",
          zIndex: 1,
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={12}
          scrollWheelZoom={true}
          className="tourism-map"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* ============================================
              MAP VIEW CONTROLLER
          ============================================ */}

          <MapViewController
            places={mappedPlaces}
            currentLocation={
              currentLocation
            }
            selectedPlace={
              selectedPlace
            }
          />

          {/* ============================================
              CURRENT LOCATION
          ============================================ */}

          {currentLocation && (
            <Marker
              position={
                currentLocation
              }
              icon={
                currentLocationIcon
              }
            >
              <Popup>
                <strong>
                  📍 Your Current
                  Location
                </strong>

                <br />

                <small>
                  Latitude:{" "}
                  {currentLocation[0].toFixed(
                    6
                  )}
                </small>

                <br />

                <small>
                  Longitude:{" "}
                  {currentLocation[1].toFixed(
                    6
                  )}
                </small>
              </Popup>
            </Marker>
          )}

          {/* ============================================
              TOURIST PLACES
          ============================================ */}

          {mappedPlaces.map(
            (place) => {
              const isSelected =
                selectedPlace &&
                String(
                  selectedPlace.id
                ) ===
                  String(place.id);

              return (
                <Marker
                  key={place.id}
                  position={[
                    place.latitude,
                    place.longitude,
                  ]}
                  icon={
                    isSelected
                      ? selectedPlaceIcon
                      : touristPlaceIcon
                  }
                  eventHandlers={{
                    click: () => {
                      console.log(
                        "Map place clicked:",
                        place
                      );

                      onPlaceSelect(
                        place
                      );
                    },
                  }}
                >
                  <Popup>
                    <div
                      style={{
                        minWidth:
                          "220px",
                      }}
                    >
                      <strong
                        style={{
                          fontSize:
                            "16px",
                        }}
                      >
                        {place.name}
                      </strong>

                      <br />

                      <span
                        style={{
                          color:
                            "#4f6b56",
                          fontSize:
                            "12px",
                        }}
                      >
                        {place.category}
                      </span>

                      {place.description && (
                        <>
                          <br />

                          <small
                            style={{
                              display:
                                "block",
                              marginTop:
                                "6px",
                              lineHeight:
                                "1.5",
                            }}
                          >
                            {
                              place.description
                            }
                          </small>
                        </>
                      )}

                      <br />

                      <small>
                        💰 Estimated: ₹
                        {Number(
                          place.estimated_cost ||
                            0
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </small>

                      <button
                        type="button"
                        onClick={() =>
                          handleShowRoute(
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
                          borderRadius:
                            "8px",
                          padding:
                            "9px",
                          background:
                            "#17221d",
                          color:
                            "white",
                          cursor:
                            "pointer",
                          fontWeight:
                            "600",
                        }}
                      >
                        🧭 Show Route
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            }
          )}

          {/* ============================================
              ROUTE
          ============================================ */}

          {currentLocation &&
            selectedPlace && (
              <RoutingControl
                currentLocation={
                  currentLocation
                }
                selectedPlace={
                  selectedPlace
                }
              />
            )}
        </MapContainer>
      </div>

      {/* =================================================
          ROUTE PANEL
      ================================================= */}

      {selectedPlace && (
        <div
          id="route-panel"
          style={{
            marginTop: "20px",
            padding: "22px",
            background: "white",
            border:
              "1px solid #e1e7e1",
            borderRadius: "16px",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p className="small-label">
                SELECTED PLACE
              </p>

              <h3
                style={{
                  fontFamily:
                    "Syne, sans-serif",
                  fontSize: "22px",
                  margin: 0,
                }}
              >
                📍{" "}
                {selectedPlace.name}
              </h3>

              {selectedPlace.category && (
                <p
                  style={{
                    color:
                      "#68756d",
                    margin:
                      "6px 0 0",
                  }}
                >
                  {
                    selectedPlace.category
                  }
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                onPlaceSelect(null)
              }
              style={{
                border: "none",
                borderRadius: "9px",
                padding:
                  "9px 13px",
                background:
                  "#fff0f0",
                color: "#a33a3a",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              ✕ Clear Selection
            </button>
          </div>

          {currentLocation ? (
            <p
              style={{
                marginTop: "15px",
                color: "#68756d",
                fontSize: "13px",
              }}
            >
              🚗 You can now use
              <strong>
                {" "}
                Show Route
              </strong>{" "}
              from this place's
              map popup to calculate
              directions from your
              current location.
            </p>
          ) : (
            <p
              style={{
                marginTop: "15px",
                color: "#a33a3a",
                fontSize: "13px",
              }}
            >
              ⚠️ Allow location access
              to calculate the route
              from your current
              location.
            </p>
          )}
        </div>
      )}

      {/* =================================================
          MAP COUNT
      ================================================= */}

      <p
        style={{
          marginTop: "12px",
          color: "#77827a",
          fontSize: "12px",
        }}
      >
        📌 Showing{" "}
        {mappedPlaces.length}{" "}
        mapped places.
      </p>
    </div>
  );
}

/* =========================================================
   MAIN APP
========================================================= */

function App() {
  const [destination, setDestination] =
    useState("");

  const [days, setDays] =
    useState(3);

  const [budget, setBudget] =
    useState("");

  const [travellers, setTravellers] =
    useState(1);

  const [interest, setInterest] =
    useState("Nature");

  const [trip, setTrip] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    selectedPlace,
    setSelectedPlace,
  ] = useState(null);

  const [
    currentLocation,
    setCurrentLocation,
  ] = useState(null);

  const interests = [
    "Nature",
    "Adventure",
    "Food",
    "Culture",
    "History",
    "Shopping",
    "All",
  ];

  /* =======================================================
     SELECT PLACE FROM CARD
  ======================================================= */

  const handlePlaceCardClick = (
    place
  ) => {
    console.log(
      "PLACE CARD CLICKED:",
      place
    );

    const normalized =
      normalizePlace(place);

    if (!normalized) {
      console.error(
        "This place has no valid coordinates:",
        place
      );

      return;
    }

    setSelectedPlace(
      normalized
    );

    /* =========================================
       SCROLL TO MAP
    ========================================= */

    setTimeout(() => {
      const mapSection =
        document.getElementById(
          "smart-map"
        );

      if (mapSection) {
        mapSection.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 100);
  };

  /* =======================================================
     GENERATE TRIP
  ======================================================= */

  const handleGenerate = async (
    e
  ) => {
    e.preventDefault();

    setError("");
    setTrip(null);
    setSelectedPlace(null);

    if (!destination.trim()) {
      setError(
        "Please enter a destination."
      );

      return;
    }

    if (
      !budget ||
      Number(budget) <= 0
    ) {
      setError(
        "Please enter a valid budget."
      );

      return;
    }

    try {
      setLoading(true);

      console.log(
        "Sending trip request:",
        {
          destination:
            destination.trim(),

          days: Number(days),

          budget: Number(budget),

          travellers:
            Number(travellers),

          interest,
        }
      );

      const response =
        await fetch(
          `${API_URL}/api/trip`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              destination:
                destination.trim(),

              days:
                Number(days),

              budget:
                Number(budget),

              travellers:
                Number(travellers),

              interest,
            }),
          }
        );

      console.log(
        "Backend response status:",
        response.status
      );

      const data =
        await response.json();

      console.log(
        "FULL BACKEND RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to generate trip."
        );
      }

      console.log(
        "Generated trip:",
        data.trip
      );

      console.log(
        "ALL PLACES:",
        data.trip?.allPlaces
      );

      console.log(
        "RECOMMENDED:",
        data.trip
          ?.recommendedPlaces
      );

      /* =========================================
         DEBUG COUNTS
      ========================================= */

      console.log(
        "ALL PLACES COUNT:",
        Array.isArray(
          data.trip?.allPlaces
        )
          ? data.trip.allPlaces
              .length
          : 0
      );

      console.log(
        "RECOMMENDED COUNT:",
        Array.isArray(
          data.trip
            ?.recommendedPlaces
        )
          ? data.trip
              .recommendedPlaces
              .length
          : 0
      );

      setTrip(data.trip);

      /* =========================================
         SCROLL RESULT
      ========================================= */

      setTimeout(() => {
        document
          .getElementById(
            "trip-result"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",
          });
      }, 150);
    } catch (err) {
      console.error(
        "Generate trip error:",
        err
      );

      setError(
        err.message ||
          "Unable to connect to SmartTourism backend."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     HOTEL BUDGET
  ======================================================= */

  const budgetPerNight =
    Number(budget) > 0 &&
    Number(days) > 0
      ? Number(budget) /
        Number(days)
      : 0;

  const affordableHotels =
    trip?.recommendedHotels?.filter(
      (hotel) =>
        Number(
          hotel.price_per_night
        ) <= budgetPerNight
    ) || [];

  /* =======================================================
     ALL MAP PLACES
  ======================================================= */

  const mapPlaces =
    Array.isArray(
      trip?.allPlaces
    ) &&
    trip.allPlaces.length > 0
      ? trip.allPlaces
      : Array.isArray(
          trip?.recommendedPlaces
        )
      ? trip.recommendedPlaces
      : [];

  /* =======================================================
     RETURN
  ======================================================= */

  return (
    <div className="app">

      {/* =================================================
          NAVBAR
      ================================================= */}

      <nav className="navbar">
        <div className="logo">
          <span>✦</span>
          SmartTourism
        </div>

        <div className="nav-links">
          <a href="#home">
            Home
          </a>

          <a href="#features">
            Features
          </a>

          <a href="#about">
            About
          </a>
        </div>

        <button
          className="nav-button"
          onClick={() =>
            document
              .getElementById(
                "planner"
              )
              ?.scrollIntoView({
                behavior:
                  "smooth",
              })
          }
        >
          Plan a Trip
        </button>
      </nav>

      {/* =================================================
          HERO
      ================================================= */}

      <main
        id="home"
        className="hero"
      >
        <div className="hero-content">
          <div className="badge">
            ✨ AI-Powered Travel
            Planning
          </div>

          <h1>
            Your journey.
            <br />

            <span>
              Planned smarter.
            </span>
          </h1>

          <p>
            Create personalized
            travel experiences
            based on your
            destination, budget,
            interests and
            available time.
          </p>

          <div className="hero-stats">
            <div>
              <strong>
                AI
              </strong>

              <span>
                Smart Planning
              </span>
            </div>

            <div>
              <strong>
                ₹
              </strong>

              <span>
                Budget Friendly
              </span>
            </div>

            <div>
              <strong>
                24/7
              </strong>

              <span>
                Travel Assistant
              </span>
            </div>
          </div>
        </div>

        {/* =================================================
            PLANNER
        ================================================= */}

        <div
          className="planner-card"
          id="planner"
        >
          <div className="planner-header">
            <div>
              <p className="small-label">
                PLAN YOUR JOURNEY
              </p>

              <h2>
                Tell us about
                your trip
              </h2>
            </div>

            <div className="ai-icon">
              ✦
            </div>
          </div>

          <form
            onSubmit={
              handleGenerate
            }
          >
            {/* DESTINATION */}

            <div className="form-group">
              <label>
                📍 Destination
              </label>

              <input
                type="text"
                placeholder="e.g. Darjeeling"
                value={
                  destination
                }
                onChange={(e) =>
                  setDestination(
                    e.target.value
                  )
                }
              />
            </div>

            {/* DAYS + TRAVELLERS */}

            <div className="form-row">
              <div className="form-group">
                <label>
                  📅 Days
                </label>

                <select
                  value={days}
                  onChange={(e) =>
                    setDays(
                      e.target.value
                    )
                  }
                >
                  <option value="1">
                    1 Day
                  </option>

                  <option value="2">
                    2 Days
                  </option>

                  <option value="3">
                    3 Days
                  </option>

                  <option value="4">
                    4 Days
                  </option>

                  <option value="5">
                    5 Days
                  </option>

                  <option value="7">
                    7 Days
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  👥 Travellers
                </label>

                <select
                  value={
                    travellers
                  }
                  onChange={(e) =>
                    setTravellers(
                      e.target.value
                    )
                  }
                >
                  <option value="1">
                    1 Traveller
                  </option>

                  <option value="2">
                    2 Travellers
                  </option>

                  <option value="3">
                    3 Travellers
                  </option>

                  <option value="4">
                    4 Travellers
                  </option>

                  <option value="5">
                    5 Travellers
                  </option>
                </select>
              </div>
            </div>

            {/* BUDGET */}

            <div className="form-group">
              <label>
                💰 Total Budget
              </label>

              <input
                type="number"
                min="1"
                placeholder="e.g. 10000"
                value={budget}
                onChange={(e) =>
                  setBudget(
                    e.target.value
                  )
                }
              />
            </div>

            {/* INTEREST */}

            <div className="form-group">
              <label>
                ❤️ What do you enjoy?
              </label>

              <div className="interest-grid">
                {interests.map(
                  (item) => (
                    <button
                      type="button"
                      key={item}
                      className={
                        interest ===
                        item
                          ? "interest active"
                          : "interest"
                      }
                      onClick={() =>
                        setInterest(
                          item
                        )
                      }
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* ERROR */}

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            {/* GENERATE */}

            <button
              type="submit"
              className="generate-button"
              disabled={
                loading
              }
            >
              {loading
                ? "Creating your trip..."
                : "Generate My Trip"}

              {!loading && (
                <span>
                  →
                </span>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* =================================================
          TRIP RESULT
      ================================================= */}

      {trip && (
        <section
          id="trip-result"
          className="trip-result"
        >
          {/* RESULT HEADER */}

          <div className="result-heading">
            <p className="small-label">
              YOUR PERSONALIZED
              TRIP
            </p>

            <h2>
              {trip.destination}
            </h2>

            <p>
              {trip.description}
            </p>
          </div>

          {/* SUMMARY */}

          <div className="trip-summary">
            <div>
              <strong>
                {trip.days}
              </strong>

              <span>
                Days
              </span>
            </div>

            <div>
              <strong>
                ₹
                {Number(
                  trip.budget
                ).toLocaleString(
                  "en-IN"
                )}
              </strong>

              <span>
                Budget
              </span>
            </div>

            <div>
              <strong>
                {trip.travellers}
              </strong>

              <span>
                Travellers
              </span>
            </div>

            <div>
              <strong>
                {trip.interest}
              </strong>

              <span>
                Interest
              </span>
            </div>
          </div>

          {/* =================================================
              PLACES
          ================================================= */}

          <div className="result-section">
            <div className="result-section-header">
              <div>
                <p className="small-label">
                  DISCOVER
                </p>

                <h3>
                  Recommended
                  Places
                </h3>
              </div>

              <span className="result-count">
                {
                  trip
                    .recommendedPlaces
                    ?.length || 0
                }{" "}
                places
              </span>
            </div>

            <div className="result-grid">
              {trip
                .recommendedPlaces
                ?.length > 0 ? (
                trip.recommendedPlaces.map(
                  (
                    place,
                    index
                  ) => (
                    <div
                      className="result-card"
                      key={
                        place.id ||
                        `${place.name}-${index}`
                      }

                      /* ==================================
                         CLICK CARD → MAP
                      ================================== */

                      onClick={() =>
                        handlePlaceCardClick(
                          place
                        )
                      }

                      style={{
                        cursor:
                          "pointer",
                      }}

                      title="Click to view this place on the map"
                    >
                      <div className="result-card-icon">
                        🗺️
                      </div>

                      <div>
                        <h4>
                          {
                            place.name
                          }
                        </h4>

                        <span className="category">
                          {
                            place.category
                          }
                        </span>

                        <p>
                          {
                            place.description
                          }
                        </p>

                        <strong>
                          Estimated
                          cost: ₹
                          {Number(
                            place.estimated_cost ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </strong>

                        <div
                          style={{
                            marginTop:
                              "10px",
                            fontSize:
                              "12px",
                            color:
                              "#4f6b56",
                            fontWeight:
                              "600",
                          }}
                        >
                          📍 Click to
                          view on map →
                        </div>
                      </div>
                    </div>
                  )
                )
              ) : (
                <p className="empty-message">
                  No places found
                  for this
                  interest.
                  Try selecting
                  "All".
                </p>
              )}
            </div>
          </div>

          {/* =================================================
              HOTELS
          ================================================= */}

          <div className="result-section">
            <div className="result-section-header">
              <div>
                <p className="small-label">
                  STAY
                </p>

                <h3>
                  Recommended
                  Hotels
                </h3>
              </div>

              <span className="result-count">
                {
                  affordableHotels.length
                }{" "}
                affordable
              </span>
            </div>

            <div className="result-grid">
              {affordableHotels.length >
              0 ? (
                affordableHotels.map(
                  (
                    hotel,
                    index
                  ) => (
                    <div
                      className="result-card"
                      key={
                        hotel.id ||
                        `${hotel.name}-${index}`
                      }
                    >
                      <div className="result-card-icon">
                        🏨
                      </div>

                      <div>
                        <h4>
                          {
                            hotel.name
                          }
                        </h4>

                        <div className="hotel-rating">
                          ⭐{" "}
                          {
                            hotel.rating
                          }
                        </div>

                        <p>
                          Comfortable
                          stay for
                          your{" "}
                          {
                            trip.destination
                          }{" "}
                          trip.
                        </p>

                        <strong>
                          ₹
                          {Number(
                            hotel.price_per_night ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}{" "}
                          / night
                        </strong>
                      </div>
                    </div>
                  )
                )
              ) : (
                <div
                  className="empty-message"
                  style={{
                    gridColumn:
                      "1 / -1",
                  }}
                >
                  ⚠️ No hotels found
                  within your current
                  budget.

                  <br />

                  <small>
                    Your approximate
                    hotel budget is
                    ₹
                    {Number(
                      budgetPerNight
                    ).toLocaleString(
                      "en-IN"
                    )}
                    {" "}
                    per night.
                  </small>
                </div>
              )}
            </div>
          </div>

          {/* =================================================
              DESTINATION INFO
          ================================================= */}

          <div className="destination-info">
            <div>
              <p className="small-label">
                BEST TIME TO
                VISIT
              </p>

              <h3>
                {trip.bestTime}
              </h3>
            </div>

            <div>
              <p className="small-label">
                LOCATION
              </p>

              <h3>
                {trip.state}
              </h3>
            </div>
          </div>

          {/* =================================================
              SMART MAP
          ================================================= */}

          <TourismMap
            places={mapPlaces}
            destination={
              trip.destination
            }
            selectedPlace={
              selectedPlace
            }
            onPlaceSelect={
              setSelectedPlace
            }
            currentLocation={
              currentLocation
            }
            setCurrentLocation={
              setCurrentLocation
            }
          />
        </section>
      )}

      {/* =================================================
          FEATURES
      ================================================= */}

      <section
        id="features"
        className="features-section"
      >
        <div className="section-heading">
          <p className="small-label">
            WHY SMARTTOURISM?
          </p>

          <h2>
            Travel planning,
            simplified.
          </h2>

          <p>
            One platform to
            discover, plan and
            experience your
            journey.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">
              🤖
            </div>

            <h3>
              AI Recommendations
            </h3>

            <p>
              Get personalized
              destinations and
              activities based
              on your
              interests.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              💰
            </div>

            <h3>
              Budget Smart
            </h3>

            <p>
              Plan your trip
              while keeping
              your spending
              under control.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              🗺️
            </div>

            <h3>
              Smart Itinerary
            </h3>

            <p>
              Organize your
              trip into a
              simple
              day-by-day plan.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              🏨
            </div>

            <h3>
              Local Experiences
            </h3>

            <p>
              Discover hotels,
              food, attractions
              and local
              experiences.
            </p>
          </div>
        </div>
      </section>

      {/* =================================================
          ABOUT
      ================================================= */}

      <section
        id="about"
        className="about-section"
      >
        <div>
          <p className="small-label">
            BUILT FOR MODERN
            TOURISM
          </p>

          <h2>
            One smart platform
            for every journey.
          </h2>
        </div>

        <p>
          SmartTourism connects
          tourists with
          destinations, local
          businesses and
          personalized travel
          experiences through
          intelligent technology.
        </p>
      </section>

      {/* =================================================
          FOOTER
      ================================================= */}

      <footer>
        <div className="logo">
          <span>✦</span>
          SmartTourism
        </div>

        <p>
          AI-powered travel
          planning for smarter
          journeys.
        </p>
      </footer>
    </div>
  );
}

export default App;