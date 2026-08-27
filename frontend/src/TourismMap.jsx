import { useEffect, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* =========================================================
   LEAFLET MARKER FIX
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
  className: "current-location-marker",

  html: `
    <div style="
      width:18px;
      height:18px;
      background:#4285f4;
      border:4px solid white;
      border-radius:50%;
      box-shadow:
        0 0 0 8px rgba(66,133,244,0.20);
    "></div>
  `,

  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/* =========================================================
   CURRENT LOCATION CONTROLLER
========================================================= */

function LocationController({
  position,
}) {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }

    /*
      Current location detect হলে
      map automatically user location-এ যাবে।
    */

    map.flyTo(
      position,
      14,
      {
        duration: 1.2,
      }
    );
  }, [
    position,
    map,
  ]);

  return null;
}

/* =========================================================
   SELECTED PLACE MAP CONTROLLER
========================================================= */

function PlaceController({
  place,
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !place ||
      place.latitude == null ||
      place.longitude == null
    ) {
      return;
    }

    const latitude =
      Number(place.latitude);

    const longitude =
      Number(place.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    /*
      Recommended Place click করলে
      map ওই place-এর দিকে zoom করবে।
    */

    map.flyTo(
      [
        latitude,
        longitude,
      ],
      16,
      {
        duration: 1.2,
      }
    );

  }, [
    place,
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
  focusPlace,
}) {
  const [
    currentLocation,
    setCurrentLocation,
  ] = useState(null);

  const [
    locationError,
    setLocationError,
  ] = useState("");

  /* =======================================================
     GET CURRENT LOCATION
  ======================================================= */

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location services."
      );

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        console.log(
          "📍 Current location:",
          latitude,
          longitude
        );

        setCurrentLocation([
          latitude,
          longitude,
        ]);

        setLocationError("");
      },

      (error) => {
        console.error(
          "Location error:",
          error
        );

        setLocationError(
          "Location permission was denied. Please allow location access."
        );
      },

      {
        enableHighAccuracy: true,

        timeout: 10000,

        maximumAge: 60000,
      }
    );
  }, []);

  /* =======================================================
     DEFAULT CENTER
  ======================================================= */

  const defaultCenter = [
    22.5726,
    88.3639,
  ];

  /*
    IMPORTANT:

    Current location না থাকলে Kolkata দেখাবে।
    Current location পাওয়া গেলে LocationController
    map-কে current location-এ নিয়ে যাবে।
  */

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
    "TourismMap focusPlace:",
    focusPlace
  );

  console.log(
    "TourismMap currentLocation:",
    currentLocation
  );

  return (
    <div
      className="map-wrapper"
      id="smart-tourism-map"
    >

      {/* =================================================
          LOCATION ERROR
      ================================================= */}

      {locationError && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fff7e6",
            color: "#7a5a00",
            fontSize: "13px",
          }}
        >
          📍 {locationError}
        </div>
      )}

      {/* =================================================
          MAP
      ================================================= */}

      <MapContainer
        center={mapCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="tourism-map"
      >

        {/* =================================================
            TILE
        ================================================= */}

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* =================================================
            CURRENT LOCATION CONTROLLER
        ================================================= */}

        <LocationController
          position={currentLocation}
        />

        {/* =================================================
            SELECTED PLACE CONTROLLER
        ================================================= */}

        <PlaceController
          place={focusPlace}
        />

        {/* =================================================
            CURRENT LOCATION MARKER
        ================================================= */}

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

              You are here.

            </Popup>

          </Marker>
        )}

        {/* =================================================
            TOURIST PLACES
        ================================================= */}

        {places.map(
          (place) => {

            const latitude =
              Number(
                place.latitude
              );

            const longitude =
              Number(
                place.longitude
              );

            /*
              Invalid coordinate হলে
              marker দেখাবে না।
            */

            if (
              !Number.isFinite(
                latitude
              ) ||
              !Number.isFinite(
                longitude
              )
            ) {
              return null;
            }

            return (
              <Marker
                key={
                  place.id ||
                  `${place.name}-${latitude}-${longitude}`
                }
                position={[
                  latitude,
                  longitude,
                ]}
              >

                <Popup>

                  <div
                    style={{
                      minWidth:
                        "210px",
                    }}
                  >

                    {/* PLACE NAME */}

                    <strong
                      style={{
                        fontSize:
                          "16px",
                      }}
                    >
                      {place.name}
                    </strong>

                    {/* CATEGORY */}

                    {place.category && (
                      <>
                        <br />

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
                      </>
                    )}

                    {/* DESCRIPTION */}

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

                    {/* COST */}

                    {place.estimated_cost !==
                      undefined && (
                      <>
                        <br />

                        <small>
                          💰 Estimated:
                          ₹
                          {Number(
                            place.estimated_cost ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </small>
                      </>
                    )}

                  </div>

                </Popup>

              </Marker>
            );
          }
        )}

      </MapContainer>

    </div>
  );
}

export default TourismMap;