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

// Data structures
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

// Convert Unix timestamp to readable time (HH:MM:SS)
function formatTimestamp(unixTime: number): string {
  const date = new Date(unixTime * 1000);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Calculate accurate distance between two GPS points (meters)
function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  // Convert to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Generate traffic density heatmap using Gaussian smoothing
function generateTrafficHeatmap(
  route: RoutePoint[],
  bounds: Bounds,
  gridSize: number = 100
): { imageUrl: string; bounds: L.LatLngBounds } {
  // Create offscreen canvas for rendering
  const canvas = document.createElement("canvas");
  canvas.width = gridSize;
  canvas.height = gridSize;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Cannot get canvas context");

  // Create 2D density grid (Float32Array for performance)
  const grid = new Float32Array(gridSize * gridSize);
  const { minLat, maxLat, minLon, maxLon } = bounds;
  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;

  // Apply Gaussian blur for smooth heatmap effect
  const sigma = 3; // Gaussian spread (2=sharp, 5=smooth)
  const kernelSize = 9; // Influence radius (pixels)

  // For each route point, add Gaussian "hotspot" to grid
  route.forEach((point) => {
    // Convert GPS to grid pixel coordinates
    const gridX = Math.floor(((point.lon - minLon) / lonRange) * gridSize);
    const gridY = Math.floor(((maxLat - point.lat) / latRange) * gridSize); // Flip Y for image

    // Spread influence to nearby pixels
    for (let dy = -kernelSize; dy <= kernelSize; dy++) {
      for (let dx = -kernelSize; dx <= kernelSize; dx++) {
        const x = gridX + dx;
        const y = gridY + dy;

        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          // Gaussian weight decreases with distance
          const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
          grid[y * gridSize + x] += weight;
        }
      }
    }
  });

  // Find max density for color normalization
  let maxVal = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > maxVal) maxVal = grid[i];
  }

  // Convert density values to colored pixels
  const imageData = ctx.createImageData(gridSize, gridSize);

  for (let i = 0; i < grid.length; i++) {
    const normalized = grid[i] / maxVal; // 0.0 to 1.0
    const pixelIndex = i * 4; // RGBA format

    if (normalized > 0.01) {
      // Apply color gradient based on density
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

  // Convert canvas to PNG data URL
  const imageUrl = canvas.toDataURL("image/png");

  // Create geographic bounds for Leaflet overlay
  const leafletBounds = L.latLngBounds(
    L.latLng(minLat, minLon),
    L.latLng(maxLat, maxLon)
  );

  return { imageUrl, bounds: leafletBounds };
}

// Interactive route line with hover tooltip showing timestamp & coords
function RoutePolylineWithTooltip({
  route,
  polyline,
}: {
  route: RoutePoint[];
  polyline: [number, number][];
}) {
  const map = useMap();
  const [tooltip, setTooltip] = useState<{
    lat: number;
    lon: number;
    time: string;
    x: number;
    y: number;
  } | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    // Create blue route line
    const polylineLayer = L.polyline(polyline, { color: "blue", weight: 4 });
    polylineLayer.addTo(map);
    polylineRef.current = polylineLayer;

    // On hover: find & show nearest point
    polylineLayer.on("mousemove", (e: L.LeafletMouseEvent) => {
      const mouseLatLng = e.latlng;

      // Find closest route point to cursor
      let nearestPoint = route[0];
      let minDistance = Infinity;

      route.forEach((point) => {
        const dist = getDistance(
          mouseLatLng.lat,
          mouseLatLng.lng,
          point.lat,
          point.lon
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestPoint = point;
        }
      });

      // Convert to screen pixels for tooltip positioning
      const containerPoint = map.latLngToContainerPoint(mouseLatLng);

      // Update tooltip state
      setTooltip({
        lat: nearestPoint.lat,
        lon: nearestPoint.lon,
        time: formatTimestamp(nearestPoint.time_unix),
        x: containerPoint.x,
        y: containerPoint.y,
      });
    });

    // Hide tooltip when mouse leaves route
    polylineLayer.on("mouseout", () => {
      setTooltip(null);
    });

    // Cleanup on unmount
    return () => {
      map.removeLayer(polylineLayer);
    };
  }, [map, route, polyline]);

  return (
    <>
      {/* Floating tooltip that follows cursor */}
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

// Client-side traffic density heatmap (Green=low, Red=high)
function TrafficHeatmapOverlay({
  route,
  visible,
}: {
  route: RoutePoint[];
  visible: boolean;
}) {
  const map = useMap();
  const [overlay, setOverlay] = useState<L.ImageOverlay | null>(null);

  useEffect(() => {
    // Remove overlay if toggled off
    if (!visible) {
      if (overlay) {
        map.removeLayer(overlay);
        setOverlay(null);
      }
      return;
    }

    if (overlay) return; // Already generated

    // Calculate route bounding box
    const lats = route.map((p) => p.lat);
    const lons = route.map((p) => p.lon);
    const bounds: Bounds = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };

    // Add 10% padding around route
    const latPadding = (bounds.maxLat - bounds.minLat) * 0.1;
    const lonPadding = (bounds.maxLon - bounds.minLon) * 0.1;
    bounds.minLat -= latPadding;
    bounds.maxLat += latPadding;
    bounds.minLon -= lonPadding;
    bounds.maxLon += lonPadding;

    console.log("Generating traffic heatmap...");
    // Generate heatmap image (150x150 grid)
    const { imageUrl, bounds: leafletBounds } = generateTrafficHeatmap(
      route,
      bounds,
      150
    );

    // Add as image overlay with exact geographic alignment
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

// Remote GeoTIFF overlay from S3 (elevation, terrain, etc.)
function GeoTIFFOverlay({ visible }: { visible: boolean }) {
  const map = useMap();
  const [layer, setLayer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Remove layer if toggled off
    if (!visible) {
      if (layer) {
        map.removeLayer(layer);
        setLayer(null);
      }
      return;
    }

    const loadGeoTIFF = async () => {
      if (layer) return; // Already loaded

      setIsLoading(true);
      try {
        console.log("Fetching GeoTIFF from S3...");
        const response = await fetch("http://localhost:8000/proxy/geotiff");
        const arrayBuffer = await response.arrayBuffer();

        console.log("Parsing GeoTIFF data...");
        const georaster = await parseGeoraster(arrayBuffer);

        // Create colored overlay layer
        const geoRasterLayer = new GeoRasterLayer({
          georaster: georaster,
          opacity: 0.7,
          pixelValuesToColorFn: (values: number[]) => {
            const value = values[0]; // First band
            if (value === null || value === undefined) return null;

            // Normalize to 0-1 range (adjust min/max for your data!)
            const min = 0;
            const max = 100; // TODO: Change based on your GeoTIFF range
            const normalized = Math.max(
              0,
              Math.min(1, (value - min) / (max - min))
            );

            // Color gradient: Blue → Cyan → Green → Yellow → Red
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

// Color scale legend (shows what colors mean)
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
              background:
                "linear-gradient(to right, rgba(0,0,255,0.7), rgba(0,255,255,0.7), rgba(0,255,0,0.7), rgba(255,255,0,0.7), rgba(255,0,0,0.7))",
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
            background:
              "linear-gradient(to right, rgba(0,255,0,0.7), rgba(255,255,0,0.8), rgba(255,128,0,0.85), rgba(255,0,0,0.9))",
          }}
        />
        <span className="text-xs">High</span>
      </div>
    </div>
  );
}

// Main map component
export default function MapView() {
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState("Initializing...");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showGeoTIFF, setShowGeoTIFF] = useState(false);
  const [showTrafficHeatmap, setShowTrafficHeatmap] = useState(false);

  // Load route data from Zarr on mount
  useEffect(() => {
    const fetchRoute = async () => {
      try {
        console.log("🚀 Starting route fetch...");
        setLoadingStep("Connecting to server...");
        setProgress(10);

        // OPTION 1: Load from public directory (for local testing)
        // FetchStore needs absolute URL, not relative path
        const base_url = `${window.location.origin}/data/route.zarr`;
        
        /* OPTION 2: Load from FastAPI server (for S3)
        console.log("📡 Fetching proxy URL from http://localhost:8000/proxy/route");
        const res = await fetch("http://localhost:8000/proxy/route");
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("❌ Server response:", errorText);
          throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }
        
        const { base_url } = await res.json();
        */
        
        console.log("✅ Using absolute URL:", base_url);

        setLoadingStep("Loading Zarr metadata...");
        setProgress(30);

        // First, verify the zarr.json file exists and is accessible
        console.log("🔍 Testing if zarr.json is accessible...");
        const testUrl = `${base_url}/zarr.json`;
        console.log("   Testing URL:", testUrl);
        
        const testResponse = await fetch(testUrl);
        console.log("   Response status:", testResponse.status);
        console.log("   Response headers:", Object.fromEntries(testResponse.headers.entries()));
        
        if (!testResponse.ok) {
          throw new Error(`zarr.json not found at ${testUrl}. Status: ${testResponse.status}`);
        }
        
        const testText = await testResponse.text();
        console.log("   Response preview (first 200 chars):", testText.substring(0, 200));
        
        // Try to parse it as JSON
        try {
          const jsonData = JSON.parse(testText);
          console.log("✅ zarr.json is valid JSON!");
          console.log("   Content:", jsonData);
        } catch (e) {
          console.error("❌ zarr.json is NOT valid JSON!");
          throw new Error(`Invalid JSON in zarr.json: ${e.message}`);
        }

        // Open Zarr dataset
        console.log("📦 Creating FetchStore with base URL:", base_url);
        const store = new FetchStore(base_url);
        console.log("   Store created:", store);
        
        console.log("📦 Attempting to open Zarr array...");
        console.log("   This will try to read zarr.json and load metadata");
        
        let arr;
        try {
          arr = await zarr.open(store, { kind: "array" });
          console.log("✅ Zarr store opened successfully!");
          console.log("   Array object:", arr);
        } catch (zarrError: any) {
          console.error("❌ zarr.open() failed!");
          console.error("   Error:", zarrError);
          console.error("   Error message:", zarrError.message);
          console.error("   This usually means zarrita can't read the zarr.json format or a file is missing");
          throw zarrError;
        }

        setLoadingStep("Reading route data...");
        setProgress(60);

        // @ts-ignore - zarrita types are complex
        console.log("📊 Fetching array data...");
        console.log("   Array methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(arr)));
        
        // For zarrita, we need to use getRaw() or slice notation
        let data;
        try {
          console.log("   Trying arr.getRaw()...");
          data = await arr.getRaw();
          console.log("   ✅ getRaw() worked!");
        } catch (e) {
          console.log("   ❌ getRaw() failed, trying alternative...");
          // Try getting full slice
          data = await arr.get([null, null]);
        }
        
        console.log("✅ Got data array!");
        console.log("   - Data type:", typeof data);
        console.log("   - Data:", data);
        console.log("   - Data shape:", arr.shape);
        console.log("   - Data length:", data?.length);

        setLoadingStep("Processing route points...");
        setProgress(80);

        // Extract route points from Zarr array
        const routePoints: RoutePoint[] = [];
        console.log("🔄 Processing data...");
        console.log("   Data structure check:", {
          isArray: Array.isArray(data),
          hasLength: data?.length !== undefined,
          firstElement: data?.[0],
          shape: arr.shape
        });
        
        // Handle different data formats
        const numPoints = arr.shape[0];
        console.log(`   Processing ${numPoints} points...`);
        
        for (let i = 0; i < numPoints; i++) {
          // Data might be nested arrays or flat TypedArray
          let lon, lat, time_unix;
          
          if (Array.isArray(data[i])) {
            // Nested array format: [[lon, lat, time], ...]
            lon = data[i][0];
            lat = data[i][1];
            time_unix = data[i][2];
          } else {
            // Flat array format: [lon0, lat0, time0, lon1, lat1, time1, ...]
            lon = data[i * 3];
            lat = data[i * 3 + 1];
            time_unix = data[i * 3 + 2];
          }
          
          routePoints.push({ lat, lon, time_unix });
          
          // Progress update every 1000 points
          if (i % 1000 === 0) {
            console.log(`   Processed ${i}/${numPoints} points...`);
          }
        }
        console.log("✅ Processed", routePoints.length, "route points");

        setLoadingStep("Rendering map...");
        setProgress(100);

        setRoute(routePoints);
        setLoading(false);
        console.log("🎉 Route loaded successfully!");
      } catch (err: any) {
        // Enhanced error logging
        console.error("=" .repeat(50));
        console.error("❌ ERROR LOADING ROUTE");
        console.error("=" .repeat(50));
        console.error("Error object:", err);
        console.error("Error message:", err?.message);
        console.error("Error name:", err?.name);
        console.error("Error stack:", err?.stack);
        console.error("=" .repeat(50));
        
        // Set user-friendly error message
        const errorMessage = err?.message || err?.toString() || "Unknown error occurred";
        setError(errorMessage);
        setLoadingStep("Error occurred");
        setLoading(false);
      }
    };

    // Add delay to see progress bar (optional, remove in production)
    setTimeout(() => {
      fetchRoute();
    }, 100);
  }, []);

  // Cache polyline coordinates (only recalculate if route changes)
  const polyline = useMemo(() => {
    return route.map((p) => [p.lat, p.lon]) as [number, number][];
  }, [route]);

  // Show loading screen with progress
  if (loading) {
    return (
      <div className="w-full h-[90vh] flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full px-6">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              🗺️ Route Viewer
            </h1>
            <p className="text-gray-600">Loading your route data...</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{loadingStep}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 mb-1">
                    Error Loading Route
                  </h3>
                  <p className="text-red-700 text-sm mb-3">{error}</p>
                  <div className="text-xs text-red-600 space-y-1">
                    <p>Troubleshooting:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Make sure FastAPI server is running on port 8000</li>
                      <li>Check if Zarr files exist in S3 or local path</li>
                      <li>Open browser console (F12) for detailed logs</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Helpful Tips */}
          {!error && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                💡 <strong>Tip:</strong> Open browser console (F12) to see detailed loading progress
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show error if no route data
  if (route.length === 0) {
    return (
      <div className="w-full h-[90vh] flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <span className="text-6xl mb-4 block">📭</span>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            No Route Data Found
          </h2>
          <p className="text-gray-600 mb-4">
            The route loaded successfully but contains no data points.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Center map on first route point
  const center: [number, number] = [route[0].lat, route[0].lon];

  return (
    <div className="w-full h-[90vh] relative">
      {/* Overlay toggle controls (top-left) */}
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

      {/* Color scale legends (conditional) */}
      {showGeoTIFF && <ColorLegend type="geotiff" />}
      {showTrafficHeatmap && <ColorLegend type="traffic" />}

      {/* Main map */}
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        className="w-full h-full rounded-2xl shadow-lg"
      >
        {/* Base map tiles */}
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Optional overlays */}
        <GeoTIFFOverlay visible={showGeoTIFF} />
        <TrafficHeatmapOverlay route={route} visible={showTrafficHeatmap} />

        {/* Interactive route with hover tooltip */}
        <RoutePolylineWithTooltip route={route} polyline={polyline} />

        {/* Start marker */}
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
