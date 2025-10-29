import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import * as zarr from "zarrita";
import { FetchStore } from "@zarrita/storage";

interface RoutePoint {
  lat: number;
  lon: number;
  time_unix: number;
}

export default function MapView() {
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        // Fetch proxy base URL from FastAPI
        const res = await fetch("http://localhost:8000/proxy/route");
        const {base_url} = await res.json();
        
        console.log("Using proxy base URL:", base_url);

        // Use FetchStore with the proxy URL
        const store = new FetchStore(base_url);
        const arr = await zarr.open(store, { kind: "array" });

        const { data, shape, stride } = await arr.get();
        // Then process data, e.g., data is a TypedArray

        // Convert Float64/Int64 array into JS objects
        const routePoints: RoutePoint[] = [];
        for (let i = 0; i < data.length; i++) {
          const lon = data[i][0];
          const lat = data[i][1];
          const time_unix = data[i][2];
          routePoints.push({ lat, lon, time_unix });
        }

        setRoute(routePoints);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load route:", err);
      }
    };

    fetchRoute();
  }, []);

  if (loading) return <p className="text-center mt-4">Loading route...</p>;
  if (route.length === 0) return <p>No route data found</p>;

  // Use first point as map center
  const center: [number, number] = [route[0].lat, route[0].lon];

  // Convert to leaflet polyline latlngs
  const polyline = route.map((p) => [p.lat, p.lon]) as [number, number][];

  return (
    <div className="w-full h-[90vh]">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        className="w-full h-full rounded-2xl shadow-lg"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={polyline} color="blue" weight={3} />
        <Marker
          position={center}
          icon={L.icon({
            iconUrl:
              "https://unpkg.com/leaflet@1.7/dist/images/marker-icon.png",
          })}
        >
          <Popup>Route start</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
