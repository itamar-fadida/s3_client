# GeoTIFF Overlay Feature

## Overview
Added a dynamic GeoTIFF heatmap overlay to your React + Leaflet map application. The overlay can be toggled on/off and loads asynchronously from S3.

## What Was Added

### 1. **New Dependencies**
- `georaster` - Parse GeoTIFF files in the browser
- `georaster-layer-for-leaflet` - Display GeoTIFF data as a Leaflet layer
- `@types/leaflet` - TypeScript definitions for Leaflet

### 2. **Server Endpoint** (`server/main.py`)
Added `/proxy/geotiff` endpoint that:
- Fetches GeoTIFF file from S3 (`data/heatmap.tif`)
- Proxies it to the client (avoiding CORS issues)
- Returns the file as `image/tiff` content type

**To change the GeoTIFF file path:**
Edit line 81 in `server/main.py`:
```python
s3_key = "data/heatmap.tif"  # Change this to your file
```

### 3. **Client Component** (`client/src/components/MapView.tsx`)
Added:
- **Toggle checkbox** - In the top-left corner to show/hide the overlay
- **GeoTIFFOverlay component** - Handles loading and displaying the GeoTIFF
- **Heatmap color scale** - Blue → Cyan → Green → Yellow → Red

## How It Works

1. **User clicks checkbox** → Triggers overlay loading
2. **Fetches GeoTIFF** → From `http://localhost:8000/proxy/geotiff`
3. **Parses the file** → Using `georaster` library
4. **Renders as heatmap** → Using `georaster-layer-for-leaflet`
5. **Shows on map** → Overlays the base map with opacity 0.7

## Configuration

### Adjust Heatmap Colors
In `MapView.tsx`, modify the `pixelValuesToColorFn` function (lines 58-87):

```typescript
// Adjust min/max based on your data range
const min = 0;
const max = 100; // Change this!
```

### Adjust Overlay Quality
In `MapView.tsx`, change the resolution (line 88):

```typescript
resolution: 256, // Higher = better quality but slower (128, 256, 512)
```

### Adjust Opacity
In `MapView.tsx`, change the opacity (line 57):

```typescript
opacity: 0.7, // 0.0 (transparent) to 1.0 (opaque)
```

## Testing the Feature

### Option 1: Use Sample GeoTIFF from S3
1. Upload a GeoTIFF file to your S3 bucket at `data/heatmap.tif`
2. Restart the FastAPI server
3. Click the "Show Heatmap Overlay" checkbox
4. The overlay should appear on the map

### Option 2: Use Local File for Testing
Temporarily modify the endpoint to return a sample file:

In `server/main.py`, replace the S3 fetch with:
```python
@app.get("/proxy/geotiff")
async def proxy_geotiff():
    # For testing: read from local file
    with open("sample_heatmap.tif", "rb") as f:
        content = f.read()
    
    return Response(
        content=content,
        media_type="image/tiff",
        headers={"Access-Control-Allow-Origin": "*"}
    )
```

## Generating Sample GeoTIFF Data

Here's a Python script to generate a sample GeoTIFF for testing:

```python
import numpy as np
import rasterio
from rasterio.transform import from_bounds

# Create sample data (100x100 grid)
data = np.random.rand(100, 100) * 100  # Random values 0-100

# Define geographic bounds (adjust to match your route area)
# Example: Tel Aviv area
west, south, east, north = 34.7, 32.0, 35.0, 32.2

transform = from_bounds(west, south, east, north, 100, 100)

# Save as GeoTIFF
with rasterio.open(
    'sample_heatmap.tif',
    'w',
    driver='GTiff',
    height=100,
    width=100,
    count=1,
    dtype=data.dtype,
    crs='+proj=latlong',
    transform=transform,
) as dst:
    dst.write(data, 1)

print("Sample GeoTIFF created: sample_heatmap.tif")
```

## Troubleshooting

### GeoTIFF Not Loading
1. Check browser console for errors
2. Verify the GeoTIFF file exists in S3
3. Check server logs for S3 fetch errors
4. Ensure the GeoTIFF has proper georeferencing

### Wrong Map Location
- Ensure your GeoTIFF's geographic bounds match your route area
- Check the CRS (Coordinate Reference System) - should be EPSG:4326 (WGS84)

### Performance Issues
- Reduce `resolution` value (try 128 or 64)
- Optimize GeoTIFF file size (compress, reduce resolution)
- Consider tiling large GeoTIFFs

## Color Scale Reference

Current heatmap colors:
- **Blue (0-25%)** - Low intensity
- **Cyan (25-50%)** - Medium-low intensity
- **Green (50-75%)** - Medium-high intensity
- **Yellow/Red (75-100%)** - High intensity

## Future Enhancements

Consider adding:
- Multiple GeoTIFF layers (traffic, elevation, etc.)
- Legend showing value ranges
- Time-series animation (multiple timestamped GeoTIFFs)
- Dynamic value range detection
- Custom color palettes
- Download as PNG feature

## Dependencies Used

- **georaster** v1.6.0 - Browser-based GeoTIFF parser
- **georaster-layer-for-leaflet** v3.10.0 - Leaflet integration
- **leaflet** v1.9.4 - Map library
- **react-leaflet** v5.0.0 - React bindings for Leaflet

## Resources

- [Georaster Documentation](https://github.com/GeoTIFF/georaster)
- [Georaster Layer for Leaflet](https://github.com/GeoTIFF/georaster-layer-for-leaflet)
- [GeoTIFF Format](https://en.wikipedia.org/wiki/GeoTIFF)

