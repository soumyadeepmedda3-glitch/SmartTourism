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
   LEAFLET DEFAULT MARKER
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
   HELPER FUNCTIONS
========================================================= */

const isValidNumber = (value) => {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
};

const hasPrice = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return false;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0;
};

const formatPrice = (value) => {
  if (!hasPrice(value)) {
    return "Price not found";
  }

  return `₹${Number(value).toLocaleString("en-IN")}`;
};

const formatCost = (value) => {
  if (!hasPrice(value)) {
    return "Cost not found";
  }

  return `₹${Number(value).toLocaleString("en-IN")}`;
};

const getPlaceKey = (place) => {
  return (
    place.id ||
    `${place.name}-${place.latitude}-${place.longitude}`
  );
};

const getHotelKey = (hotel) => {
  return (
    hotel.id ||
    `${hotel.name}-${hotel.latitude}-${hotel.longitude}`
  );
};

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
      width:34px;
      height:34px;
      background:#17221d;
      border:3px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 3px 10px rgba(0,0,0,0.3);
    ">
      <span style="
        transform:rotate(45deg);
        font-size:16px;
      ">🗺️</span>
    </div>
  `,

  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -32],
});

/* =========================================================
   HOTEL ICON
========================================================= */

const hotelIcon = L.divIcon({
  className: "hotel-map-icon",

  html: `
    <div style="
      width:34px;
      height:34px;
      background:#8b4513;
      border:3px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 3px 10px rgba(0,0,0,0.3);
    ">
      <span style="
        transform:rotate(45deg);
        font-size:16px;
      ">🏨</span>
    </div>
  `,

  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -32],
});

/* =========================================================
   MAP VIEW CONTROLLER
========================================================= */

function MapViewController({
  places,
  hotels,
  currentLocation,
  selectedPlace,
}) {
  const map = useMap();

  const initialFitDone = useRef(false);

  useEffect(() => {
    if (!map) return;

    const points = [];

    places.forEach((place) => {
      const lat = Number(place.latitude);
      const lng = Number(place.longitude);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        points.push([lat, lng]);
      }
    });

    hotels.forEach((hotel) => {
      const lat = Number(hotel.latitude);
      const lng = Number(hotel.longitude);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        points.push([lat, lng]);
      }
    });

    if (currentLocation) {
      const lat = Number(currentLocation[0]);
      const lng = Number(currentLocation[1]);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        points.push([lat, lng]);
      }
    }

    if (
      points.length > 0 &&
      !initialFitDone.current
    ) {
      const bounds = L.latLngBounds(points);

      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 14,
      });

      initialFitDone.current = true;

      return;
    }

    if (
      selectedPlace &&
      currentLocation &&
      selectedPlace.latitude != null &&
      selectedPlace.longitude != null
    ) {
      const start = [
        Number(currentLocation[0]),
        Number(currentLocation[1]),
      ];

      const end = [
        Number(selectedPlace.latitude),
        Number(selectedPlace.longitude),
      ];

      if (
        start.every(Number.isFinite) &&
        end.every(Number.isFinite)
      ) {
        const bounds = L.latLngBounds([
          start,
          end,
        ]);

        map.fitBounds(bounds, {
          padding: [80, 80],
          maxZoom: 15,
        });
      }
    }
  }, [
    map,
    places,
    hotels,
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

  const routingControlRef = useRef(null);

  useEffect(() => {
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

      routingControlRef.current = null;
    }

    if (
      !currentLocation ||
      !selectedPlace ||
      selectedPlace.latitude == null ||
      selectedPlace.longitude == null
    ) {
      return undefined;
    }

    const startLat = Number(
      currentLocation[0]
    );

    const startLng = Number(
      currentLocation[1]
    );

    const endLat = Number(
      selectedPlace.latitude
    );

    const endLng = Number(
      selectedPlace.longitude
    );

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

    const startPoint = L.latLng(
      startLat,
      startLng
    );

    const endPoint = L.latLng(
      endLat,
      endLng
    );

    const routingControl =
      L.Routing.control({
        waypoints: [
          startPoint,
          endPoint,
        ],

        router: L.Routing.osrmv1({
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

        createMarker: () => null,

        show: false,

        collapsible: false,
      }).addTo(map);

    routingControlRef.current =
      routingControl;

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

    routingControl.on(
      "routingerror",
      (event) => {
        console.error(
          "Routing error:",
          event
        );
      }
    );

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

        routingControlRef.current = null;
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
  hotels = [],
  destination,
  onLocationError,
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

  const mapRef = useRef(null);

  const placeMarkerRefs = useRef({});

  const hotelMarkerRefs = useRef({});

  /* =======================================================
     ERROR HANDLER
  ======================================================= */

  const showLocationError = (message) => {
    setLocationError(message);

    if (onLocationError) {
      onLocationError(message);
    }
  };

  /* =======================================================
     GET CURRENT LOCATION
  ======================================================= */

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      showLocationError(
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
        setLocationError("");
      },

      (error) => {
        console.error(
          "Geolocation error:",
          error
        );

        setLocating(false);

        let message =
          "Unable to detect your current location.";

        if (error.code === 1) {
          message =
            "Location permission denied. Click the 🔒 icon near localhost:5173 and allow Location.";
        } else if (error.code === 2) {
          message =
            "Your location could not be detected. Make sure location services are enabled.";
        } else if (error.code === 3) {
          message =
            "Location request timed out. Click My Location again.";
        }

        showLocationError(message);
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
     FOCUS PLACE ON MAP
  ======================================================= */

  const focusPlaceOnMap = (place) => {
    if (
      !place ||
      !isValidNumber(place.latitude) ||
      !isValidNumber(place.longitude)
    ) {
      showLocationError(
        "This place does not have valid map coordinates."
      );

      return;
    }

    const lat = Number(place.latitude);
    const lng = Number(place.longitude);

    setSelectedPlace(null);

    document
      .querySelector(".tourism-map-section")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

    setTimeout(() => {
      const map = mapRef.current;

      if (!map) return;

      map.flyTo(
        [lat, lng],
        17,
        {
          duration: 1.5,
        }
      );

      setTimeout(() => {
        const markerKey =
          getPlaceKey(place);

        const marker =
          placeMarkerRefs.current[
            markerKey
          ];

        if (marker) {
          marker.openPopup();
        }
      }, 1600);
    }, 350);
  };

  /* =======================================================
     FOCUS HOTEL ON MAP
  ======================================================= */

  const focusHotelOnMap = (hotel) => {
    if (
      !hotel ||
      !isValidNumber(hotel.latitude) ||
      !isValidNumber(hotel.longitude)
    ) {
      showLocationError(
        "This hotel does not have valid map coordinates."
      );

      return;
    }

    const lat = Number(hotel.latitude);
    const lng = Number(hotel.longitude);

    setSelectedPlace(null);

    document
      .querySelector(".tourism-map-section")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

    setTimeout(() => {
      const map = mapRef.current;

      if (!map) return;

      map.flyTo(
        [lat, lng],
        17,
        {
          duration: 1.5,
        }
      );

      setTimeout(() => {
        const markerKey =
          getHotelKey(hotel);

        const marker =
          hotelMarkerRefs.current[
            markerKey
          ];

        if (marker) {
          marker.openPopup();
        }
      }, 1600);
    }, 350);
  };

  /* =======================================================
     GLOBAL HOTEL EVENT
  ======================================================= */

  useEffect(() => {
    const handleFocusHotel = (event) => {
      const hotel = event.detail;

      if (!hotel) return;

      focusHotelOnMap(hotel);
    };

    window.addEventListener(
      "focusHotel",
      handleFocusHotel
    );

    return () => {
      window.removeEventListener(
        "focusHotel",
        handleFocusHotel
      );
    };
  }, []);

  /* =======================================================
     GLOBAL PLACE EVENT
  ======================================================= */

  useEffect(() => {
    const handleFocusPlace = (event) => {
      const place = event.detail;

      if (!place) return;

      focusPlaceOnMap(place);
    };

    window.addEventListener(
      "focusPlace",
      handleFocusPlace
    );

    return () => {
      window.removeEventListener(
        "focusPlace",
        handleFocusPlace
      );
    };
  }, []);

  /* =======================================================
     SHOW ROUTE
  ======================================================= */

  const handleShowRoute = (place) => {
    if (!currentLocation) {
      showLocationError(
        "Please allow location access first."
      );

      getCurrentLocation();

      return;
    }

    if (
      !isValidNumber(place.latitude) ||
      !isValidNumber(place.longitude)
    ) {
      showLocationError(
        "Route is not available because this place has no valid map coordinates."
      );

      return;
    }

    setSelectedPlace({
      ...place,

      latitude: Number(
        place.latitude
      ),

      longitude: Number(
        place.longitude
      ),
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
     CLEAR ROUTE
  ======================================================= */

  const clearRoute = () => {
    setSelectedPlace(null);
  };

  /* =======================================================
     VALID PLACES
  ======================================================= */

  const mappedPlaces =
    Array.isArray(places)
      ? places.filter((place) => {
          return (
            isValidNumber(
              place.latitude
            ) &&
            isValidNumber(
              place.longitude
            )
          );
        })
      : [];

  /* =======================================================
     VALID HOTELS
  ======================================================= */

  const mappedHotels =
    Array.isArray(hotels)
      ? hotels.filter((hotel) => {
          return (
            isValidNumber(
              hotel.latitude
            ) &&
            isValidNumber(
              hotel.longitude
            )
          );
        })
      : [];

  /* =======================================================
     MAP CENTER
  ======================================================= */

  const mapCenter = [
    22.5726,
    88.3639,
  ];

  /* =======================================================
     RETURN
  ======================================================= */

  return (
    <div className="tourism-map-section">

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
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

      <div
        style={{
          display: "flex",
          gap: "15px",
          flexWrap: "wrap",
          marginBottom: "12px",
          fontSize: "12px",
          color: "#68756d",
        }}
      >
        <span>
          🗺️ Tourist Place
        </span>

        <span>
          🏨 Hotel
        </span>

        <span>
          🔵 Your Location
        </span>
      </div>

      {mappedPlaces.length === 0 &&
        mappedHotels.length === 0 && (
          <div
            style={{
              marginBottom: "15px",
              padding: "12px",
              background: "#fff7e6",
              borderRadius: "10px",
              color: "#805b19",
              fontSize: "13px",
            }}
          >
            ⚠️ No mapped tourist places
            or hotels were received from
            the backend.

            <br />

            Make sure your places and
            hotels have valid latitude
            and longitude.
          </div>
        )}

      <div className="map-wrapper">

        <MapContainer
          center={mapCenter}
          zoom={13}
          scrollWheelZoom={true}
          className="tourism-map"
          ref={mapRef}
        >

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapViewController
            places={mappedPlaces}
            hotels={mappedHotels}
            currentLocation={
              currentLocation
            }
            selectedPlace={
              selectedPlace
            }
          />

          {/* CURRENT LOCATION */}

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
                  📍 Your Current Location
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

          {/* TOURIST PLACES */}

          {mappedPlaces.map(
            (place) => {
              const markerKey =
                getPlaceKey(place);

              return (
                <Marker
                  key={markerKey}
                  position={[
                    Number(
                      place.latitude
                    ),
                    Number(
                      place.longitude
                    ),
                  ]}
                  icon={
                    touristPlaceIcon
                  }
                  ref={(marker) => {
                    if (marker) {
                      placeMarkerRefs.current[
                        markerKey
                      ] = marker;
                    }
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

                      {place.category && (
                        <span
                          style={{
                            color:
                              "#4f6b56",
                            fontSize:
                              "12px",
                          }}
                        >
                          {
                            place.category
                          }
                        </span>
                      )}

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
                        💰{" "}
                        {formatCost(
                          place.estimated_cost
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
                          width: "100%",
                          border:
                            "none",
                          borderRadius:
                            "8px",
                          padding:
                            "9px",
                          background:
                            "#17221d",
                          color: "white",
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

          {/* HOTEL MARKERS */}

          {mappedHotels.map(
            (hotel) => {
              const markerKey =
                getHotelKey(hotel);

              return (
                <Marker
                  key={`hotel-${markerKey}`}
                  position={[
                    Number(
                      hotel.latitude
                    ),
                    Number(
                      hotel.longitude
                    ),
                  ]}
                  icon={hotelIcon}
                  ref={(marker) => {
                    if (marker) {
                      hotelMarkerRefs.current[
                        markerKey
                      ] = marker;
                    }
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
                        🏨{" "}
                        {hotel.name}
                      </strong>

                      <br />

                      <span
                        style={{
                          color:
                            "#8b4513",
                          fontSize:
                            "12px",
                        }}
                      >
                        Hotel
                      </span>

                      {hotel.rating !=
                        null &&
                        hotel.rating !==
                          "" && (
                          <>
                            <br />

                            <small>
                              ⭐{" "}
                              {
                                hotel.rating
                              }
                            </small>
                          </>
                        )}

                      <br />

                      <small>
                        💰{" "}
                        {formatPrice(
                          hotel.price_per_night
                        )}{" "}
                        {hasPrice(
                          hotel.price_per_night
                        ) &&
                          "/ night"}
                      </small>

                      {hotel.address && (
                        <>
                          <br />

                          <small>
                            📍{" "}
                            {
                              hotel.address
                            }
                          </small>
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            }
          )}

          {/* ROUTE */}

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

      <p
        style={{
          marginTop: "12px",
          color: "#77827a",
          fontSize: "12px",
        }}
      >
        🗺️{" "}
        {mappedPlaces.length} tourist
        places and{" "}
        {mappedHotels.length} hotels
        available on the map.
      </p>

      {/* ROUTE PANEL */}

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
                DIRECTIONS
              </p>

              <h3
                style={{
                  fontFamily:
                    "Syne, sans-serif",
                  fontSize: "22px",
                  marginBottom:
                    "8px",
                }}
              >
                📍 Current Location
              </h3>

              <p
                style={{
                  margin:
                    "5px 0",
                  color:
                    "#68756d",
                  fontSize:
                    "20px",
                }}
              >
                ↓
              </p>

              <h3
                style={{
                  fontFamily:
                    "Syne, sans-serif",
                  fontSize: "22px",
                }}
              >
                📍{" "}
                {selectedPlace.name}
              </h3>
            </div>

            <button
              type="button"
              onClick={
                clearRoute
              }
              style={{
                border: "none",
                borderRadius:
                  "9px",
                padding:
                  "9px 13px",
                background:
                  "#fff0f0",
                color:
                  "#a33a3a",
                cursor:
                  "pointer",
                fontWeight:
                  "600",
              }}
            >
              ✕ Clear Route
            </button>
          </div>

          <p
            style={{
              marginTop: "15px",
              color: "#68756d",
              fontSize: "13px",
            }}
          >
            🚗 Route calculated from
            your current location to{" "}
            <strong>
              {selectedPlace.name}
            </strong>
            .
          </p>
        </div>
      )}
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

  /* =======================================================
     ANIMATED PREMIUM CURSOR
  ======================================================= */

  useEffect(() => {
    const cursorDot = document.querySelector(".cursor-dot");
    const cursorRing = document.querySelector(".cursor-ring");

    if (!cursorDot || !cursorRing) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let animationFrame;

    const moveCursor = (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;

      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;
    };

    const handlePointerOver = (event) => {
      const target = event.target.closest(
        "a, button, input, select, textarea, .result-card, .feature-card"
      );

      if (target) {
        cursorRing.classList.add("cursor-hover");
        cursorDot.classList.add("cursor-dot-hover");
      }
    };

    const handlePointerOut = (event) => {
      const from = event.target.closest(
        "a, button, input, select, textarea, .result-card, .feature-card"
      );
      const to = event.relatedTarget?.closest?.(
        "a, button, input, select, textarea, .result-card, .feature-card"
      );

      if (from && !to) {
        cursorRing.classList.remove("cursor-hover");
        cursorDot.classList.remove("cursor-dot-hover");
      }
    };

    const animateCursor = () => {
      ringX += (mouseX - ringX) * 0.14;
      ringY += (mouseY - ringY) * 0.14;

      cursorRing.style.left = `${ringX}px`;
      cursorRing.style.top = `${ringY}px`;

      animationFrame = requestAnimationFrame(animateCursor);
    };

    document.addEventListener("mousemove", moveCursor);
    document.addEventListener("mouseover", handlePointerOver);
    document.addEventListener("mouseout", handlePointerOut);

    animateCursor();

    return () => {
      document.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseover", handlePointerOver);
      document.removeEventListener("mouseout", handlePointerOut);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

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
     GENERATE TRIP
  ======================================================= */

  const handleGenerate = async (e) => {
    e.preventDefault();

    setError("");
    setTrip(null);

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

      let data;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          "Backend returned an invalid response. Make sure server.js is running on port 5000."
        );
      }

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

      setTrip(data.trip);

      setTimeout(() => {
        document
          .getElementById(
            "trip-result"
          )
          ?.scrollIntoView({
            behavior: "smooth",
          });
      }, 150);
    } catch (err) {
      console.error(err);

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

  /*
     IMPORTANT:
     Hotels without price are NOT considered affordable.
  */

  const affordableHotels =
    trip?.recommendedHotels?.filter(
      (hotel) => {
        if (
          !hasPrice(
            hotel.price_per_night
          )
        ) {
          return false;
        }

        return (
          Number(
            hotel.price_per_night
          ) <= budgetPerNight
        );
      }
    ) || [];

  /* =======================================================
     FOCUS PLACE FROM CARD
  ======================================================= */

  const handlePlaceCardMapClick = (
    place
  ) => {
    document
      .querySelector(
        ".tourism-map-section"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(
          "focusPlace",
          {
            detail: place,
          }
        )
      );
    }, 500);
  };

  /* =======================================================
     FOCUS HOTEL FROM CARD
  ======================================================= */

  const handleHotelCardMapClick = (
    hotel
  ) => {
    document
      .querySelector(
        ".tourism-map-section"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(
          "focusHotel",
          {
            detail: hotel,
          }
        )
      );
    }, 500);
  };

  /* =======================================================
     RETURN
  ======================================================= */

  return (
    <>
      <style>{`
        html,
        body,
        #root {
          cursor: none;
        }

        .cursor-dot {
          position: fixed;
          width: 8px;
          height: 8px;
          left: 0;
          top: 0;
          background: #17221d;
          border-radius: 50%;
          pointer-events: none;
          z-index: 99999;
          transform: translate(-50%, -50%);
          transition:
            width 0.2s ease,
            height 0.2s ease,
            background 0.2s ease,
            box-shadow 0.2s ease;
        }

        .cursor-ring {
          position: fixed;
          width: 38px;
          height: 38px;
          left: 0;
          top: 0;
          border: 1.5px solid #17221d;
          border-radius: 50%;
          pointer-events: none;
          z-index: 99998;
          transform: translate(-50%, -50%);
          transition:
            width 0.25s ease,
            height 0.25s ease,
            border-color 0.25s ease,
            background 0.25s ease,
            box-shadow 0.25s ease;
        }

        .cursor-ring::after {
          content: "";
          position: absolute;
          inset: -8px;
          border: 1px solid rgba(23, 34, 29, 0.12);
          border-radius: 50%;
          animation: smartCursorPulse 2s infinite;
        }

        .cursor-ring.cursor-hover {
          width: 58px;
          height: 58px;
          border-color: #8b4513;
          background: rgba(139, 69, 19, 0.08);
          box-shadow:
            0 0 22px rgba(139, 69, 19, 0.18),
            inset 0 0 10px rgba(139, 69, 19, 0.08);
        }

        .cursor-dot.cursor-dot-hover {
          width: 12px;
          height: 12px;
          background: #8b4513;
          box-shadow: 0 0 12px rgba(139, 69, 19, 0.35);
        }

        @keyframes smartCursorPulse {
          0% {
            transform: scale(0.8);
            opacity: 0.75;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.15;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.75;
          }
        }

        @media (hover: none), (pointer: coarse) {
          html,
          body,
          #root {
            cursor: auto;
          }

          .cursor-dot,
          .cursor-ring {
            display: none;
          }
        }
      `}</style>

      <div className="app">
        <div className="cursor-dot" aria-hidden="true"></div>
        <div className="cursor-ring" aria-hidden="true"></div>

        {/* NAVBAR */}

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

      {/* HERO */}

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

        {/* PLANNER */}

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
                placeholder="e.g. Kolkata"
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
              disabled={loading}
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

      {/* TRIP RESULT */}

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

          {/* PLACES */}

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
                trip
                  .recommendedPlaces
                  .map(
                    (place) => (
                      <div
                        className="result-card"
                        key={getPlaceKey(
                          place
                        )}
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

                          {place.category && (
                            <span className="category">
                              {
                                place.category
                              }
                            </span>
                          )}

                          {place.description && (
                            <p>
                              {
                                place.description
                              }
                            </p>
                          )}

                          <strong>
                            Estimated
                            cost:{" "}
                            {formatCost(
                              place.estimated_cost
                            )}
                          </strong>

                          <button
                            type="button"
                            onClick={() =>
                              handlePlaceCardMapClick(
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
                                "9px 12px",
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
                            📍 View this place on map →
                          </button>
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

          {/* HOTELS */}

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
              {trip
                .recommendedHotels
                ?.length > 0 ? (
                trip.recommendedHotels.map(
                  (hotel) => {
                    const priceAvailable =
                      hasPrice(
                        hotel.price_per_night
                      );

                    const affordable =
                      priceAvailable &&
                      Number(
                        hotel.price_per_night
                      ) <=
                        budgetPerNight;

                    return (
                      <div
                        className="result-card"
                        key={getHotelKey(
                          hotel
                        )}
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

                          {hotel.rating !=
                            null &&
                            hotel.rating !==
                              "" && (
                              <div className="hotel-rating">
                                ⭐{" "}
                                {
                                  hotel.rating
                                }
                              </div>
                            )}

                          {hotel.address && (
                            <p>
                              📍{" "}
                              {
                                hotel.address
                              }
                            </p>
                          )}

                          <p>
                            Comfortable
                            stay for
                            your{" "}
                            {
                              trip.destination
                            }{" "}
                            trip.
                          </p>

                          {/* PRICE */}

                          <strong
                            style={{
                              display:
                                "block",
                              marginTop:
                                "5px",
                              color:
                                priceAvailable
                                  ? undefined
                                  : "#a33a3a",
                            }}
                          >
                            {priceAvailable
                              ? `${formatPrice(
                                  hotel.price_per_night
                                )} / night`
                              : "Price not found"}
                          </strong>

                          {/* AFFORDABILITY */}

                          {priceAvailable &&
                            affordable && (
                              <span
                                style={{
                                  display:
                                    "inline-block",
                                  marginTop:
                                    "7px",
                                  fontSize:
                                    "12px",
                                  color:
                                    "#315c3b",
                                }}
                              >
                                ✓ Within
                                your
                                budget
                              </span>
                            )}

                          {!priceAvailable && (
                            <span
                              style={{
                                display:
                                  "block",
                                marginTop:
                                  "7px",
                                fontSize:
                                  "12px",
                                color:
                                  "#805b19",
                              }}
                            >
                              ⚠️ Price
                              information
                              unavailable
                            </span>
                          )}

                          {/* HOTEL MAP BUTTON */}

                          <button
                            type="button"
                            onClick={() =>
                              handleHotelCardMapClick(
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
                              borderRadius:
                                "8px",
                              padding:
                                "9px 12px",
                              background:
                                "#8b4513",
                              color:
                                "white",
                              cursor:
                                "pointer",
                              fontWeight:
                                "600",
                            }}
                          >
                            🏨 View hotel on map →
                          </button>
                        </div>
                      </div>
                    );
                  }
                )
              ) : (
                <div
                  className="empty-message"
                  style={{
                    gridColumn:
                      "1 / -1",
                  }}
                >
                  ⚠️ No hotels found.

                  <br />

                  <small>
                    Your approximate
                    hotel budget is
                    ₹
                    {Number(
                      budgetPerNight
                    ).toLocaleString(
                      "en-IN"
                    )}{" "}
                    per night.
                  </small>
                </div>
              )}
            </div>
          </div>

          {/* DESTINATION INFO */}

          <div className="destination-info">
            <div>
              <p className="small-label">
                BEST TIME TO
                VISIT
              </p>

              <h3>
                {trip.bestTime ||
                  "Information not available"}
              </h3>
            </div>

            <div>
              <p className="small-label">
                LOCATION
              </p>

              <h3>
                {trip.state ||
                  "Information not available"}
              </h3>
            </div>
          </div>

          {/* MAP */}

          <TourismMap
            places={
              Array.isArray(
                trip.allPlaces
              ) &&
              trip.allPlaces.length >
                0
                ? trip.allPlaces
                : Array.isArray(
                    trip.recommendedPlaces
                  )
                ? trip.recommendedPlaces
                : []
            }
            hotels={
              Array.isArray(
                trip.recommendedHotels
              )
                ? trip.recommendedHotels
                : []
            }
            destination={
              trip.destination
            }
          />
        </section>
      )}

      {/* FEATURES */}

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

      {/* ABOUT */}

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

      {/* FOOTER */}

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
    </>
  );
}

export default App;