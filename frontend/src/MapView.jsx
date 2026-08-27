import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

function ChangeMapView({ latitude, longitude }) {
  const map = useMap();

  map.setView([latitude, longitude], 13);

  return null;
}

function MapView({ latitude, longitude, placeName }) {
  if (!latitude || !longitude) {
    return (
      <div className="map-error">
        Location not available
      </div>
    );
  }

  return (
    <div className="map-wrapper">

      <MapContainer
        center={[latitude, longitude]}
        zoom={13}
        scrollWheelZoom={true}
        className="tourism-map"
      >

        <ChangeMapView
          latitude={latitude}
          longitude={longitude}
        />

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker
          position={[latitude, longitude]}
        >

          <Popup>
            <strong>{placeName}</strong>
            <br />
            SmartTourism location
          </Popup>

        </Marker>

      </MapContainer>

    </div>
  );
}

export default MapView;