import { useEffect, useState, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import * as zarr from "zarrita";
import { FetchStore } from "@zarrita/storage";
// @ts-ignore - no types available
import parseGeoraster from "georaster";
// @ts-ignore - no types available
import GeoRasterLayer from "georaster-layer-for-leaflet";

interface RoutePoint {
  lat: number;
  lon: number;
  time_unix: number;
}

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// Utility: Format timestamp
function formatTimestamp(unixTime: number): string {
  const date = new Date(unixTime * 1000);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Utility: Calculate distance between two points (Haversine formula)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Generate traffic heatmap from route points
function generateTrafficHeatmap(
  route: RoutePoint[],
  bounds: Bounds,
  gridSize: number = 100
): { imageUrl: string; bounds: L.LatLngBounds } {
  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = gridSize;
  canvas.height = gridSize;
  const ctx = canvas.getContext("2d");
  
  if (!ctx) throw new Error("Cannot get canvas context");

  // Create density grid
  const grid = new Float32Array(gridSize * gridSize);
  const { minLat, maxLat, minLon, maxLon } = bounds;
  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;

  // Populate grid with Gaussian kernel
  const sigma = 3; // Gaussian spread
  const kernelSize = 9; // Kernel radius

  route.forEach((point) => {
    // Convert lat/lon to grid coordinates
    const gridX = Math.floor(((point.lon - minLon) / lonRange) * gridSize);
    const gridY = Math.floor(((maxLat - point.lat) / latRange) * gridSize); // Flip Y

    // Apply Gaussian kernel
    for (let dy = -kernelSize; dy <= kernelSize; dy++) {
      for (let dx = -kernelSize; dx <= kernelSize; dx++) {
        const x = gridX + dx;
        const y = gridY + dy;

        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
          grid[y * gridSize + x] += weight;
        }
      }
    }
  });

  // Find max value for normalization
  let maxVal = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > maxVal) maxVal = grid[i];
  }

  // Create image data with color gradient
  const imageData = ctx.createImageData(gridSize, gridSize);
  
  for (let i = 0; i < grid.length; i++) {
    const normalized = grid[i] / maxVal;
    const pixelIndex = i * 4;

    if (normalized > 0.01) {
      // Color scale: Green -> Yellow -> Red
      let r, g, b, a;
      
      if (normalized < 0.33) {
        // Green to Yellow
        const t = normalized / 0.33;
        r = Math.floor(t * 255);
        g = 255;
        b = 0;
        a = Math.floor(normalized * 255 * 0.7);
      } else if (normalized < 0.66) {
        // Yellow to Orange
        const t = (normalized - 0.33) / 0.33;
        r = 255;
        g = Math.floor((1 - t * 0.5) * 255);
        b = 0;
        a = Math.floor(normalized * 255 * 0.8);
      } else {
        // Orange to Red
        const t = (normalized - 0.66) / 0.34;
        r = 255;
        g = Math.floor((1 - t) * 128);
        b = 0;
        a = Math.floor(normalized * 255 * 0.9);
      }

      imageData.data[pixelIndex] = r;
      imageData.data[pixelIndex + 1] = g;
      imageData.data[pixelIndex + 2] = b;
      imageData.data[pixelIndex + 3] = a;
    } else {
      // Transparent
      imageData.data[pixelIndex + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Convert to blob URL
  const imageUrl = canvas.toDataURL("image/png");
  
  // Create Leaflet bounds
  const leafletBounds = L.latLngBounds(
    L.latLng(minLat, minLon),
    L.latLng(maxLat, maxLon)
  );

  return { imageUrl, bounds: leafletBounds };
}

// Component: Polyline with hover tooltip
function RoutePolylineWithTooltip({ route, polyline }: { route: RoutePoint[]; polyline: [number, number][] }) {
  const map = useMap();
  const [tooltip, setTooltip] = useState<{ lat: number; lon: number; time: string; x: number; y: number } | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    const polylineLayer = L.polyline(polyline, { color: "blue", weight: 4 });
    polylineLayer.addTo(map);
    polylineRef.current = polylineLayer;

    // Hover events
    polylineLayer.on("mousemove", (e: L.LeafletMouseEvent) => {
      const mouseLatLng = e.latlng;
      
      // Find nearest route point
      let nearestPoint = route[0];
      let minDistance = Infinity;

      route.forEach((point) => {
        const dist = getDistance(mouseLatLng.lat, mouseLatLng.lng, point.lat, point.lon);
        if (dist < minDistance) {
          minDistance = dist;
          nearestPoint = point;
        }
      });

      // Get screen coordinates
      const containerPoint = map.latLngToContainerPoint(mouseLatLng);

      setTooltip({
        lat: nearestPoint.lat,
        lon: nearestPoint.lon,
        time: formatTimestamp(nearestPoint.time_unix),
        x: containerPoint.x,
        y: containerPoint.y,
      });
    });

    polylineLayer.on("mouseout", () => {
      setTooltip(null);
    });

    return () => {
      map.removeLayer(polylineLayer);
    };
  }, [map, route, polyline]);

  return (
    <>
      {tooltip && (
        <div
          className="absolute z-[1000] bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs pointer-events-none"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y - 10}px`,
          }}
        >
          <div className="font-semibold">{tooltip.time}</div>
          <div className="text-gray-300">
            {tooltip.lat.toFixed(5)}, {tooltip.lon.toFixed(5)}
          </div>
        </div>
      )}
    </>
  );
}

// Component: Traffic heatmap overlay
function TrafficHeatmapOverlay({ route, visible }: { route: RoutePoint[]; visible: boolean }) {
  const map = useMap();
  const [overlay, setOverlay] = useState<L.ImageOverlay | null>(null);

  useEffect(() => {
    if (!visible) {
      if (overlay) {
        map.removeLayer(overlay);
        setOverlay(null);
      }
      return;
    }

    if (overlay) return; // Already created

    // Calculate bounds
    const lats = route.map((p) => p.lat);
    const lons = route.map((p) => p.lon);
    const bounds: Bounds = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };

    // Add padding
    const latPadding = (bounds.maxLat - bounds.minLat) * 0.1;
    const lonPadding = (bounds.maxLon - bounds.minLon) * 0.1;
    bounds.minLat -= latPadding;
    bounds.maxLat += latPadding;
    bounds.minLon -= lonPadding;
    bounds.maxLon += lonPadding;

    console.log("Generating traffic heatmap...");
    const { imageUrl, bounds: leafletBounds } = generateTrafficHeatmap(route, bounds, 150);

    const imageOverlay = L.imageOverlay(imageUrl, leafletBounds, {
      opacity: 0.6,
      interactive: false,
    });

    imageOverlay.addTo(map);
    setOverlay(imageOverlay);
    console.log("Traffic heatmap added");
  }, [visible, route, map]);

  return null;
}

// Component: GeoTIFF overlay
function GeoTIFFOverlay({ visible }: { visible: boolean }) {
  const map = useMap();
  const [layer, setLayer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      if (layer) {
        map.removeLayer(layer);
        setLayer(null);
      }
      return;
    }

    const loadGeoTIFF = async () => {
      if (layer) return;
      
      setIsLoading(true);
      try {
        console.log("Fetching GeoTIFF...");
        const response = await fetch("http://localhost:8000/proxy/geotiff");
        const arrayBuffer = await response.arrayBuffer();
        
        console.log("Parsing GeoTIFF...");
        const georaster = await parseGeoraster(arrayBuffer);
        
        const geoRasterLayer = new GeoRasterLayer({
          georaster: georaster,
          opacity: 0.7,
          pixelValuesToColorFn: (values: number[]) => {
            const value = values[0];
            if (value === null || value === undefined) return null;
            
            const min = 0;
            const max = 100;
            const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
            
            if (normalized < 0.25) {
              const t = normalized / 0.25;
              return `rgba(0, ${Math.floor(t * 255)}, 255, 0.7)`;
            } else if (normalized < 0.5) {
              const t = (normalized - 0.25) / 0.25;
              return `rgba(0, 255, ${Math.floor((1 - t) * 255)}, 0.7)`;
            } else if (normalized < 0.75) {
              const t = (normalized - 0.5) / 0.25;
              return `rgba(${Math.floor(t * 255)}, 255, 0, 0.7)`;
            } else {
              const t = (normalized - 0.75) / 0.25;
              return `rgba(255, ${Math.floor((1 - t) * 255)}, 0, 0.7)`;
            }
          },
          resolution: 256,
        });
        
        geoRasterLayer.addTo(map);
        setLayer(geoRasterLayer);
        console.log("GeoTIFF layer added");
      } catch (error) {
        console.error("Failed to load GeoTIFF:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGeoTIFF();
  }, [visible, map]);

  if (isLoading && visible) {
    return (
      <div className="absolute top-4 right-4 z-[1000] bg-white px-4 py-2 rounded-lg shadow-lg">
        <p className="text-sm">Loading GeoTIFF...</p>
      </div>
    );
  }

  return null;
}

// Component: Color legend
function ColorLegend({ type }: { type: "geotiff" | "traffic" }) {
  if (type === "geotiff") {
    return (
      <div className="absolute top-4 right-4 z-[1000] bg-white px-3 py-2 rounded-lg shadow-lg">
        <div className="text-xs font-semibold mb-1">GeoTIFF Heatmap</div>
        <div className="flex items-center gap-2">
          <span className="text-xs">Low</span>
          <div
            className="w-24 h-4 rounded"
            style={{
              background: "linear-gradient(to right, rgba(0,0,255,0.7), rgba(0,255,255,0.7), rgba(0,255,0,0.7), rgba(255,255,0,0.7), rgba(255,0,0,0.7))",
            }}
          />
          <span className="text-xs">High</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white px-3 py-2 rounded-lg shadow-lg">
      <div className="text-xs font-semibold mb-1">Traffic Density</div>
      <div className="flex items-center gap-2">
        <span className="text-xs">Low</span>
        <div
          className="w-24 h-4 rounded"
          style={{
            background: "linear-gradient(to right, rgba(0,255,0,0.7), rgba(255,255,0,0.8), rgba(255,128,0,0.85), rgba(255,0,0,0.9))",
          }}
        />
        <span className="text-xs">High</span>
      </div>
    </div>
  );
}

export default function MapView() {
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGeoTIFF, setShowGeoTIFF] = useState(false);
  const [showTrafficHeatmap, setShowTrafficHeatmap] = useState(false);

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const res = await fetch("http://localhost:8000/proxy/route");
        const { base_url } = await res.json();
        
        console.log("Using proxy base URL:", base_url);

        const store = new FetchStore(base_url);
        const arr = await zarr.open(store, { kind: "array" });

        // @ts-ignore - zarrita types are complex
        const { data, shape, stride } = await arr.get();

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

  const polyline = useMemo(() => {
    return route.map((p) => [p.lat, p.lon]) as [number, number][];
  }, [route]);

  if (loading) return <p className="text-center mt-4">Loading route...</p>;
  if (route.length === 0) return <p>No route data found</p>;

  const center: [number, number] = [route[0].lat, route[0].lon];

  return (
    <div className="w-full h-[90vh] relative">
      {/* Toggle Controls */}
      <div className="absolute top-4 left-4 z-[1000] bg-white px-4 py-3 rounded-lg shadow-lg space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showGeoTIFF}
            onChange={(e) => setShowGeoTIFF(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <span className="text-sm font-medium">GeoTIFF Overlay</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showTrafficHeatmap}
            onChange={(e) => setShowTrafficHeatmap(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <span className="text-sm font-medium">Traffic Heatmap</span>
        </label>
      </div>

      {/* Legends */}
      {showGeoTIFF && <ColorLegend type="geotiff" />}
      {showTrafficHeatmap && <ColorLegend type="traffic" />}

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
        
        {/* Overlays */}
        <GeoTIFFOverlay visible={showGeoTIFF} />
        <TrafficHeatmapOverlay route={route} visible={showTrafficHeatmap} />
        
        {/* Route polyline with hover tooltip */}
        <RoutePolylineWithTooltip route={route} polyline={polyline} />
        
        <Marker
          position={center}
          icon={L.icon({
            iconUrl: "https://unpkg.com/leaflet@1.7/dist/images/marker-icon.png",
          })}
        >
          <Popup>Route start</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
