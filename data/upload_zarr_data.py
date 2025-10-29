import os
import time
import numpy as np
import zarr
import s3fs
from dotenv import load_dotenv

load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("S3_BUCKET")

ROUTE_ZARR_PATH = os.getenv("ROUTE_ZARR_PATH")
TRAFFIC_ZARR_PATH = os.getenv("TRAFFIC_ZARR_PATH")

# -----------------------------
# Configure S3FS filesystem
# -----------------------------
fs = s3fs.S3FileSystem(
    key=AWS_ACCESS_KEY_ID,
    secret=AWS_SECRET_ACCESS_KEY,
    client_kwargs={"region_name": AWS_REGION},
)

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
# Upload Zarr directly to S3
# -----------------------------
def upload_zarr(array, path, shape, dtype, chunks):
    """Create and upload a Zarr array to S3."""
    store_path = f"{S3_BUCKET}/{path}"
    store = s3fs.S3Map(root=store_path, s3=fs, check=False)
    z = zarr.open(store, mode="w", shape=shape, chunks=chunks, dtype=dtype)
    z[:] = array
    print(f"✅ Uploaded {path} to s3://{store_path}")

# -----------------------------
# Main
# -----------------------------
def main():
    route = generate_route()
    traffic = generate_traffic(route)

    upload_zarr(route, ROUTE_ZARR_PATH, shape=route.shape, dtype=route.dtype, chunks=(1000, 3))
    upload_zarr(traffic, TRAFFIC_ZARR_PATH, shape=traffic.shape, dtype=traffic.dtype, chunks=(1000, 2))

if __name__ == "__main__":
    main()
