"""
Generate Zarr data locally without compression for browser usage.
This creates Zarr v3 format that zarrita can read directly.
"""
import os
import time
import numpy as np
import zarr
from pathlib import Path

# -----------------------------
# Generate route (lon, lat, time)
# -----------------------------
def generate_route(n_points=10_000):
    base_lat, base_lon = 51.5074, -0.1278  # London center
    t0 = int(time.time())
    lats = base_lat + np.random.uniform(-0.05, 0.05, n_points)
    lons = base_lon + np.random.uniform(-0.05, 0.05, n_points)
    times = np.arange(t0, t0 + n_points * 10, 10, dtype=np.int64)  # every 10s
    route = np.stack([lons, lats, times], axis=1)
    return route

# -----------------------------
# Generate traffic (time, value)
# -----------------------------
def generate_traffic(route):
    times = route[:, 2]
    base_traffic = 50 + 20 * np.sin(np.linspace(0, 10, len(times)))  # smooth wave
    noise = np.random.normal(0, 5, len(times))
    traffic = np.stack([times, base_traffic + noise], axis=1)
    return traffic

# -----------------------------
# Create local Zarr without compression
# -----------------------------
def create_local_zarr(array, path, chunks):
    """Create a Zarr array locally WITHOUT compression for browser usage."""
    
    # Remove existing directory if it exists
    if os.path.exists(path):
        import shutil
        shutil.rmtree(path)
    
    # Create array with NO compression (Zarr v2 format for compatibility)
    z = zarr.open(
        path,
        mode='w',
        shape=array.shape,
        chunks=chunks,
        dtype=array.dtype,
        compressor=None,  # ← NO COMPRESSION!
        fill_value=0,
        zarr_format=2  # Force v2 format for browser compatibility
    )
    
    # Write data
    z[:] = array
    
    print(f"Created {path}")
    print(f"   Shape: {array.shape}")
    print(f"   Dtype: {array.dtype}")
    print(f"   Chunks: {chunks}")
    print(f"   Compression: None (browser-friendly!)")

# -----------------------------
# Main
# -----------------------------
def main():
    print("Generating route and traffic data...")
    
    route = generate_route(10_000)
    traffic = generate_traffic(route)
    
    print("\nCreating Zarr arrays (no compression)...")
    
    # Create in a temporary location first
    create_local_zarr(route, "../client/public/data/route.zarr", chunks=(1000, 3))
    create_local_zarr(traffic, "../client/public/data/traffic.zarr", chunks=(1000, 2))
    
    print("\nDone! Files created in client/public/data/")
    print("\nRoute data:")
    print(f"   First point: lon={route[0,0]:.4f}, lat={route[0,1]:.4f}, time={route[0,2]}")
    print(f"   Last point: lon={route[-1,0]:.4f}, lat={route[-1,1]:.4f}, time={route[-1,2]}")
    print(f"   Total points: {len(route)}")

if __name__ == "__main__":
    main()

