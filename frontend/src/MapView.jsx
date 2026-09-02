import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

/* =========================================================
   DEFAULT LEAFLET ICON
========================================================= */

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

/* =========================================================
   HELPERS
========================================================= */

const isValidNumber = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));

const getCoordinates = (item) => {
  if (!item) return null;

  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return [latitude, longitude];
};

/* =========================================================
   CUSTOM MARKERS
========================================================= */

const createPlaceIcon = () =>
  L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="
        width:34px;
        height:34px;
        border-radius:50% 50% 50% 0;
        background:#477152;
        border:3px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,.28);
        transform:rotate(-45deg);
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <span style="
          transform:rotate(45deg);
          font-size:15px;
        ">📍</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });

const createHotelIcon = () =>
  L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="
        width:34px;
        height:34px;
        border-radius:50% 50% 50% 0;
        background:#8b6a3e;
        border:3px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,.28);
        transform:rotate(-45deg);
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <span style="
          transform:rotate(45deg);
          font-size:15px;
        ">🏨</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });

const createUserIcon = () =>
  L.divIcon({
    className: "user-location-marker",
    html: `
      <div class="user-location-dot">
        <div class="user-location-pulse"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

/* =========================================================
   MAP VIEW CONTROLLER
========================================================= */

function MapController({
  destinationCoordinates,
  selectedItem,
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedItem) {
      const coords = getCoordinates(selectedItem);

      if (coords) {
        map.flyTo(coords, 16, {
          duration: 1.2,
        });
      }
    }
  }, [selectedItem, map]);

  useEffect(() => {
    if (!selectedItem && destinationCoordinates) {
      map.flyTo(destinationCoordinates, 13, {
        duration: 1,
      });
    }
  }, [destinationCoordinates, selectedItem, map]);

  return null;
}

/* =========================================================
   ROUTE FETCHER
========================================================= */

function RouteLine({
  currentLocation,
  selectedItem,
  onLoading,
  onError,
}) {
  const [route, setRoute] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      if (!currentLocation || !selectedItem) {
        setRoute([]);
        return;
      }

      const destination = getCoordinates(selectedItem);

      if (!destination) {
        setRoute([]);
        onError?.("Selected location has no valid coordinates.");
        return;
      }

      const startLat = Number(currentLocation.latitude);
      const startLng = Number(currentLocation.longitude);

      if (
        !Number.isFinite(startLat) ||
        !Number.isFinite(startLng)
      ) {
        setRoute([]);
        return;
      }

      try {
        onLoading?.(true);
        onError?.("");

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${startLng},${startLat};${destination[1]},${destination[0]}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Route service unavailable");
        }

        const data = await response.json();

        if (
          cancelled ||
          !data.routes ||
          data.routes.length === 0
        ) {
          setRoute([]);
          return;
        }

        const coordinates =
          data.routes[0].geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
          );

        setRoute(coordinates);
      } catch (error) {
        if (!cancelled) {
          setRoute([]);
          onError?.(
            "Unable to load route right now. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          onLoading?.(false);
        }
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [currentLocation, selectedItem, onLoading, onError]);

  if (route.length < 2) return null;

  return (
    <Polyline
      positions={route}
      pathOptions={{
        color: "#315c3b",
        weight: 5,
        opacity: 0.85,
      }}
    />
  );
}

/* =========================================================
   MAIN MAP COMPONENT
========================================================= */

function MapView({
  latitude,
  longitude,
  placeName,

  /* New props supported by SmartTourism */
  places = [],
  hotels = [],
  destination,
}) {
  const mapRef = useRef(null);

  const [currentLocation, setCurrentLocation] =
    useState(null);

  const [selectedItem, setSelectedItem] =
    useState(null);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [routeError, setRouteError] =
    useState("");

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [locationError, setLocationError] =
    useState("");

  /* =======================================================
     DESTINATION COORDINATES
  ======================================================= */

  const destinationCoordinates = useMemo(() => {
    if (
      isValidNumber(latitude) &&
      isValidNumber(longitude)
    ) {
      return [
        Number(latitude),
        Number(longitude),
      ];
    }

    return null;
  }, [latitude, longitude]);

  /* =======================================================
     CLEAN PLACE LIST
  ======================================================= */

  const validPlaces = useMemo(() => {
    if (!Array.isArray(places)) return [];

    return places.filter(
      (place) =>
        isValidNumber(place?.latitude) &&
        isValidNumber(place?.longitude)
    );
  }, [places]);

  /* =======================================================
     CLEAN HOTEL LIST
  ======================================================= */

  const validHotels = useMemo(() => {
    if (!Array.isArray(hotels)) return [];

    return hotels.filter(
      (hotel) =>
        isValidNumber(hotel?.latitude) &&
        isValidNumber(hotel?.longitude)
    );
  }, [hotels]);

  /* =======================================================
     CURRENT LOCATION
  ======================================================= */

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location access."
      );
      return;
    }

    setLocationLoading(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setCurrentLocation(location);
        setLocationLoading(false);

        if (mapRef.current) {
          mapRef.current.flyTo(
            [
              location.latitude,
              location.longitude,
            ],
            14,
            {
              duration: 1.2,
            }
          );
        }
      },
      (error) => {
        setLocationLoading(false);

        if (error.code === 1) {
          setLocationError(
            "Location permission was denied. Please allow location access."
          );
        } else {
          setLocationError(
            "Unable to detect your current location."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  /* =======================================================
     FOCUS PLACE
  ======================================================= */

  const focusPlace = (place) => {
    if (!place) return;

    const coords = getCoordinates(place);

    if (!coords || !mapRef.current) return;

    setSelectedItem(place);

    mapRef.current.flyTo(coords, 17, {
      duration: 1.2,
    });
  };

  /* =======================================================
     FOCUS HOTEL
  ======================================================= */

  const focusHotel = (hotel) => {
    if (!hotel) return;

    const coords = getCoordinates(hotel);

    if (!coords || !mapRef.current) return;

    setSelectedItem(hotel);

    mapRef.current.flyTo(coords, 17, {
      duration: 1.2,
    });
  };

  /* =======================================================
     GLOBAL EVENTS FROM APP.JSX
  ======================================================= */

  useEffect(() => {
    const handleFocusPlace = (event) => {
      focusPlace(event.detail);
    };

    const handleFocusHotel = (event) => {
      focusHotel(event.detail);
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
  });

  /* =======================================================
     INITIAL MAP CENTER
  ======================================================= */

  if (!destinationCoordinates) {
    return (
      <div className="map-wrapper">
        <div className="empty-message">
          Map location is not available for this destination.
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="map-wrapper">

      {/* LOCATION BUTTON */}

      <button
        type="button"
        className="location-button"
        onClick={getCurrentLocation}
        disabled={locationLoading}
        style={{
          position: "absolute",
          top: "15px",
          left: "15px",
          zIndex: 1000,
          marginBottom: 0,
        }}
      >
        {locationLoading
          ? "📍 Detecting..."
          : "📍 Use My Location"}
      </button>

      {/* LOCATION ERROR */}

      {locationError && (
        <div
          className="error-message"
          style={{
            position: "absolute",
            top: "65px",
            left: "15px",
            right: "15px",
            zIndex: 1000,
            maxWidth: "420px",
          }}
        >
          {locationError}
        </div>
      )}

      {/* ROUTE LOADING */}

      {routeLoading && (
        <div className="map-loading">
          <div className="map-spinner"></div>
          <span>Calculating route...</span>
        </div>
      )}

      {/* ROUTE ERROR */}

      {routeError && (
        <div
          className="error-message"
          style={{
            position: "absolute",
            bottom: "15px",
            left: "15px",
            zIndex: 1000,
            maxWidth: "350px",
          }}
        >
          {routeError}
        </div>
      )}

      <MapContainer
        center={destinationCoordinates}
        zoom={13}
        scrollWheelZoom={true}
        className="tourism-map"
        ref={mapRef}
      >

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          destinationCoordinates={
            destinationCoordinates
          }
          selectedItem={selectedItem}
        />

        {/* =================================================
            DESTINATION MARKER
        ================================================= */}

        <Marker
          position={destinationCoordinates}
        >
          <Popup>
            <strong>
              {placeName || destination || "Destination"}
            </strong>

            <br />

            SmartTourism destination
          </Popup>
        </Marker>

        {/* =================================================
            TOURIST PLACES
        ================================================= */}

        {validPlaces.map((place, index) => {
          const coords = getCoordinates(place);

          return (
            <Marker
              key={`place-${place.id || place.name || index}`}
              position={coords}
              icon={createPlaceIcon()}
              eventHandlers={{
                click: () => {
                  setSelectedItem(place);
                },
              }}
            >
              <Popup>

                <strong>
                  {place.name || "Tourist Place"}
                </strong>

                {place.category && (
                  <>
                    <br />
                    <span>
                      {place.category}
                    </span>
                  </>
                )}

                {place.description && (
                  <>
                    <br />
                    {place.description}
                  </>
                )}

                {isValidNumber(
                  place.estimated_cost
                ) && (
                  <>
                    <br />
                    <strong>
                      Estimated cost: ₹
                      {Number(
                        place.estimated_cost
                      ).toLocaleString("en-IN")}
                    </strong>
                  </>
                )}

                <br />

                <button
                  type="button"
                  className="direction-button"
                  onClick={() =>
                    setSelectedItem(place)
                  }
                >
                  🧭 Show Route
                </button>

              </Popup>
            </Marker>
          );
        })}

        {/* =================================================
            HOTELS
        ================================================= */}

        {validHotels.map((hotel, index) => {
          const coords = getCoordinates(hotel);

          return (
            <Marker
              key={`hotel-${hotel.id || hotel.name || index}`}
              position={coords}
              icon={createHotelIcon()}
              eventHandlers={{
                click: () => {
                  setSelectedItem(hotel);
                },
              }}
            >
              <Popup>

                <strong>
                  {hotel.name || "Hotel"}
                </strong>

                {hotel.rating && (
                  <>
                    <br />
                    ⭐ {hotel.rating}
                  </>
                )}

                {hotel.address && (
                  <>
                    <br />
                    📍 {hotel.address}
                  </>
                )}

                {isValidNumber(
                  hotel.price_per_night
                ) && (
                  <>
                    <br />
                    <strong>
                      ₹
                      {Number(
                        hotel.price_per_night
                      ).toLocaleString("en-IN")}
                      /night
                    </strong>
                  </>
                )}

                <br />

                <button
                  type="button"
                  className="direction-button"
                  onClick={() =>
                    setSelectedItem(hotel)
                  }
                >
                  🧭 Show Route
                </button>

              </Popup>
            </Marker>
          );
        })}

        {/* =================================================
            USER LOCATION
        ================================================= */}

        {currentLocation && (
          <>
            <Marker
              position={[
                currentLocation.latitude,
                currentLocation.longitude,
              ]}
              icon={createUserIcon()}
            >
              <Popup>
                <strong>
                  Your Current Location
                </strong>

                <br />

                SmartTourism detected your location.
              </Popup>
            </Marker>

            {currentLocation.accuracy && (
              <Circle
                center={[
                  currentLocation.latitude,
                  currentLocation.longitude,
                ]}
                radius={currentLocation.accuracy}
                pathOptions={{
                  color: "#4285f4",
                  fillColor: "#4285f4",
                  fillOpacity: 0.08,
                  weight: 1,
                }}
              />
            )}
          </>
        )}

        {/* =================================================
            ROUTE
        ================================================= */}

        <RouteLine
          currentLocation={currentLocation}
          selectedItem={selectedItem}
          onLoading={setRouteLoading}
          onError={setRouteError}
        />

      </MapContainer>

      {/* ===================================================
          MAP LEGEND
      =================================================== */}

      <div className="map-legend">

        <div className="map-legend-title">
          Map Legend
        </div>

        <div className="map-legend-item">
          <span className="map-legend-marker place"></span>
          Tourist places ({validPlaces.length})
        </div>

        <div className="map-legend-item">
          <span className="map-legend-marker hotel"></span>
          Hotels ({validHotels.length})
        </div>

        <div className="map-legend-item">
          <span className="map-legend-marker user"></span>
          Your location
        </div>

      </div>

    </div>
  );
}

export default MapView;