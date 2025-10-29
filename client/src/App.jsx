import MapView from "./components/MapView";

export default function App() {
  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-center">Traffic Route Viewer</h1>
      <MapView />
    </div>
  );
}
