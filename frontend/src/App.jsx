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

    /* -----------------------------------------
       ADD TOURIST PLACES
    ----------------------------------------- */

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

    /* -----------------------------------------
       ADD HOTELS
    ----------------------------------------- */

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

    /* -----------------------------------------
       ADD CURRENT LOCATION
    ----------------------------------------- */

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

    /* -----------------------------------------
       FIRST MAP FIT
    ----------------------------------------- */

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

    /* -----------------------------------------
       ROUTE PLACE SELECTED
    ----------------------------------------- */

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

  const routingControlRef =
    useRef(null);

  useEffect(() => {
    /* -----------------------------------------
       REMOVE OLD ROUTE
    ----------------------------------------- */

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

    /* -----------------------------------------
       CHECK LOCATION + DESTINATION
    ----------------------------------------- */

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

    /* -----------------------------------------
       CREATE ROUTING CONTROL
    ----------------------------------------- */

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

        createMarker: function () {
          return null;
        },

        show: false,

        collapsible: false,
      }).addTo(map);

    routingControlRef.current =
      routingControl;

    /* -----------------------------------------
       ROUTE FOUND
    ----------------------------------------- */

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

    /* -----------------------------------------
       ROUTE ERROR
    ----------------------------------------- */

    routingControl.on(
      "routingerror",
      (event) => {
        console.error(
          "Routing error:",
          event
        );
      }
    );

    /* -----------------------------------------
       CLEANUP
    ----------------------------------------- */

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

  /* =======================================================
     MAP REF
  ======================================================= */

  const mapRef = useRef(null);

  /* =======================================================
     MARKER REFS
  ======================================================= */

  const placeMarkerRefs = useRef({});

  const hotelMarkerRefs = useRef({});

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
        } else if (error.code === 2) {
          setLocationError(
            "Your location could not be detected. Make sure location services are enabled."
          );
        } else if (error.code === 3) {
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
     FOCUS PLACE ON MAP
  ======================================================= */

  const focusPlaceOnMap = (place) => {
    if (
      !place ||
      place.latitude == null ||
      place.longitude == null
    ) {
      setLocationError(
        "This place does not have valid map coordinates."
      );

      return;
    }

    const lat = Number(
      place.latitude
    );

    const lng = Number(
      place.longitude
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      setLocationError(
        "This place has invalid map coordinates."
      );

      return;
    }

    console.log(
      "Focusing place on map:",
      place.name,
      lat,
      lng
    );

    /* -----------------------------------------
       CLEAR ROUTE
    ----------------------------------------- */

    setSelectedPlace(null);

    /* -----------------------------------------
       SCROLL TO MAP
    ----------------------------------------- */

    setTimeout(() => {
      document
        .querySelector(
          ".tourism-map-section"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 100);

    /* -----------------------------------------
       MOVE MAP
    ----------------------------------------- */

    setTimeout(() => {
      const map = mapRef.current;

      if (!map) {
        console.warn(
          "Map reference not available"
        );

        return;
      }

      map.flyTo(
        [lat, lng],
        17,
        {
          duration: 1.5,
        }
      );

      /* -----------------------------------------
         OPEN PLACE POPUP
      ----------------------------------------- */

      setTimeout(() => {
        const markerKey =
          place.id ||
          `${place.name}-${place.latitude}-${place.longitude}`;

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
      hotel.latitude == null ||
      hotel.longitude == null
    ) {
      setLocationError(
        "This hotel does not have valid map coordinates."
      );

      return;
    }

    const lat = Number(
      hotel.latitude
    );

    const lng = Number(
      hotel.longitude
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      setLocationError(
        "This hotel has invalid map coordinates."
      );

      return;
    }

    console.log(
      "Focusing hotel on map:",
      hotel.name,
      lat,
      lng
    );

    /* -----------------------------------------
       CLEAR ROUTE
    ----------------------------------------- */

    setSelectedPlace(null);

    /* -----------------------------------------
       SCROLL TO MAP
    ----------------------------------------- */

    setTimeout(() => {
      document
        .querySelector(
          ".tourism-map-section"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 100);

    /* -----------------------------------------
       MOVE MAP
    ----------------------------------------- */

    setTimeout(() => {
      const map = mapRef.current;

      if (!map) {
        console.warn(
          "Map reference not available"
        );

        return;
      }

      map.flyTo(
        [lat, lng],
        17,
        {
          duration: 1.5,
        }
      );

      /* -----------------------------------------
         OPEN HOTEL POPUP
      ----------------------------------------- */

      setTimeout(() => {
        const markerKey =
          hotel.id ||
          `${hotel.name}-${hotel.latitude}-${hotel.longitude}`;

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
     SHOW ROUTE
  ======================================================= */

  const handleShowRoute = (place) => {
    console.log(
      "Show route clicked:",
      place
    );

    /* -----------------------------------------
       LOCATION NOT AVAILABLE
    ----------------------------------------- */

    if (!currentLocation) {
      setLocationError(
        "Please allow location access first."
      );

      getCurrentLocation();

      return;
    }

    /* -----------------------------------------
       VALIDATE DESTINATION
    ----------------------------------------- */

    if (
      place.latitude == null ||
      place.longitude == null
    ) {
      setLocationError(
        "Route is not available because this place has no map coordinates."
      );

      return;
    }

    /* -----------------------------------------
       SET ROUTE DESTINATION
    ----------------------------------------- */

    setSelectedPlace({
      ...place,

      latitude: Number(
        place.latitude
      ),

      longitude: Number(
        place.longitude
      ),
    });

    /* -----------------------------------------
       SCROLL ROUTE PANEL
    ----------------------------------------- */

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
          const lat = Number(
            place.latitude
          );

          const lng = Number(
            place.longitude
          );

          return (
            Number.isFinite(lat) &&
            Number.isFinite(lng)
          );
        })
      : [];

  /* =======================================================
     VALID HOTELS
  ======================================================= */

  const mappedHotels =
    Array.isArray(hotels)
      ? hotels.filter((hotel) => {
          const lat = Number(
            hotel.latitude
          );

          const lng = Number(
            hotel.longitude
          );

          return (
            Number.isFinite(lat) &&
            Number.isFinite(lng)
          );
        })
      : [];

  /* =======================================================
     MAP CENTER
  ======================================================= */

  const defaultCenter = [
    22.5726,
    88.3639,
  ];

  const mapCenter =
    defaultCenter;

  /* =======================================================
     DEBUG
  ======================================================= */

  console.log(
    "TourismMap places:",
    places
  );

  console.log(
    "Mapped places:",
    mappedPlaces
  );

  console.log(
    "TourismMap hotels:",
    hotels
  );

  console.log(
    "Mapped hotels:",
    mappedHotels
  );

  console.log(
    "Current location:",
    currentLocation
  );

  console.log(
    "Selected place:",
    selectedPlace
  );

  /* =======================================================
     RETURN
  ======================================================= */

  return (
    <div className="tourism-map-section">

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
          MAP LEGEND
      ================================================= */}

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

      {/* =================================================
          NO MAP PLACES
      ================================================= */}

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

      {/* =================================================
          MAP
      ================================================= */}

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

          {/* ============================================
              MAP VIEW
          ============================================ */}

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

          {/* ============================================
              TOURIST PLACES
          ============================================ */}

          {mappedPlaces.map(
            (place) => {

              const markerKey =
                place.id ||
                `${place.name}-${place.latitude}-${place.longitude}`;

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

                      {place.estimated_cost !==
                        undefined && (
                        <>
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
                        </>
                      )}

                      {/* ROUTE */}

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
              HOTEL MARKERS
          ============================================ */}

          {mappedHotels.map(
            (hotel) => {

              const markerKey =
                hotel.id ||
                `${hotel.name}-${hotel.latitude}-${hotel.longitude}`;

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
                  icon={
                    hotelIcon
                  }
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

                      <br />

                      {hotel.rating !=
                        null &&
                        hotel.rating !==
                          "" && (
                          <small>
                            ⭐{" "}
                            {
                              hotel.rating
                            }
                          </small>
                        )}

                      <br />

                      {hotel.price_per_night !=
                        null && (
                        <small>
                          💰 ₹
                          {Number(
                            hotel.price_per_night ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}{" "}
                          / night
                        </small>
                      )}

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
          MAP COUNT
      ================================================= */}

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

      const data =
        await response.json();

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

      console.log(
        "HOTELS:",
        data.trip
          ?.recommendedHotels
      );

      setTrip(data.trip);

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

  const affordableHotels =
    trip?.recommendedHotels?.filter(
      (hotel) =>
        Number(
          hotel.price_per_night
        ) <= budgetPerNight
    ) || [];

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
                trip
                  .recommendedPlaces
                  .map(
                    (place) => (
                      <div
                        className="result-card"
                        key={
                          place.id ||
                          `${place.name}-${place.latitude}-${place.longitude}`
                        }
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

                          {/* =================================
                              VIEW ON MAP
                          ================================= */}

                          <button
                            type="button"
                            onClick={() =>
                              document
                                .querySelector(
                                  ".tourism-map-section"
                                )
                                ?.scrollIntoView({
                                  behavior:
                                    "smooth",
                                  block:
                                    "center",
                                })
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
                            📍 Click to view on map →
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
                  (hotel) => (
                    <div
                      className="result-card"
                      key={
                        hotel.id ||
                        `${hotel.name}-${hotel.latitude}-${hotel.longitude}`
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

                        {/* =================================
                            HOTEL MAP BUTTON
                        ================================= */}

                        <button
                          type="button"
                          onClick={() => {
                            document
                              .querySelector(
                                ".tourism-map-section"
                              )
                              ?.scrollIntoView({
                                behavior:
                                  "smooth",
                                block:
                                  "center",
                              });
                          }}
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

          <span>
            ✦
          </span>

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