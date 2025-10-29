# How to Use Local Zarr Files

## The Problem You Had

The error `<!doctype "..." is not valid JSON` means the browser tried to load Zarr files but got HTML instead. This happens when the files don't exist at that URL.

## ✅ Solution: Use the FastAPI Proxy (Already Fixed!)

Your code now uses the proxy again:

```typescript
// Get proxy endpoint from FastAPI server
const res = await fetch("http://localhost:8000/proxy/route");
const { base_url } = await res.json();
```

The proxy handles authentication and serves files correctly!

---

## 📁 Where to Put Your Zarr Files

### Option 1: In Your S3 Bucket (Recommended)

Upload your local Zarr folder to S3:

```bash
# Upload entire Zarr directory
aws s3 cp route.zarr/ s3://your-bucket/data/route.zarr/ --recursive

# The structure should be:
# s3://your-bucket/data/route.zarr/zarr.json
# s3://your-bucket/data/route.zarr/c/0/0
# s3://your-bucket/data/route.zarr/c/1/0
# etc...
```

### Option 2: Local Development (For Testing)

If you want to test with local files without S3:

**Step 1:** Update the server proxy to read from local filesystem:

```python
# server/main.py

@app.get("/proxy/route/{path:path}")
async def proxy_s3_file(path: str):
    """Proxy local Zarr files"""
    import os
    from pathlib import Path
    
    # Path to your local Zarr folder
    local_zarr_path = Path("../data/route.zarr") / path
    
    try:
        print(f"Reading local file: {local_zarr_path}")
        
        if not local_zarr_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        
        with open(local_zarr_path, "rb") as f:
            content = f.read()
        
        # Detect content type
        if path.endswith(".json"):
            content_type = "application/json"
        else:
            content_type = "application/octet-stream"
        
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache"  # Disable cache for local dev
            }
        )
    except Exception as e:
        print(f"Error reading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 2:** Make sure your directory structure is:

```
s3_client/
├── data/
│   └── route.zarr/
│       ├── zarr.json           ← Required!
│       ├── c/                  ← Chunks
│       │   ├── 0/
│       │   │   └── 0
│       │   ├── 1/
│       │   │   └── 0
│       │   └── ...
│       └── .zattrs (optional)
├── server/
│   └── main.py
└── client/
```

---

## 🔍 Debug Checklist

If you still get errors:

### 1. **Check Server is Running**
```bash
cd server
python main.py

# You should see:
# INFO:     Uvicorn running on http://localhost:8000
```

### 2. **Test the Proxy Endpoint**
Open browser or use curl:
```bash
curl http://localhost:8000/proxy/route

# Should return:
# {"base_url": "http://localhost:8000/proxy/route"}
```

### 3. **Test Zarr JSON File**
```bash
curl http://localhost:8000/proxy/route/zarr.json

# Should return JSON like:
# {"shape": [1000, 3], "chunks": [100, 3], ...}
```

If you get HTML (`<!doctype`), the file doesn't exist!

### 4. **Check Your Zarr File Structure**

Your Zarr folder should have:
- `zarr.json` or `.zarray` - metadata file
- `c/` folder - chunks directory
- Numbered subfolders: `c/0/`, `c/1/`, etc.

**Check with:**
```bash
# Windows
dir data\route.zarr /s

# Linux/Mac
ls -la data/route.zarr/
```

### 5. **Verify .env Configuration**

```bash
# server/.env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
ROUTE_ZARR_PREFIX=data/route.zarr
TRAFFIC_ZARR_PREFIX=data/traffic.zarr
SIGNED_URL_EXPIRE=3600
```

---

## 🎯 Quick Test

1. **Start server:**
```bash
cd server
python main.py
```

2. **Check proxy works:**
```bash
curl http://localhost:8000/proxy/route
```

3. **Start client:**
```bash
cd client
npm run dev
```

4. **Open browser:**
```
http://localhost:5173
```

5. **Check console:**
- Should see: "Using proxy base URL: http://localhost:8000/proxy/route"
- Should NOT see: "Unexpected token '<'"

---

## 📝 Understanding the Comments in Code

The code now has short, helpful comments explaining what each part does:

```typescript
// Convert Unix timestamp to readable time (HH:MM:SS)
function formatTimestamp(unixTime: number) { ... }

// Calculate accurate distance between two GPS points (meters)
function getDistance(lat1, lon1, lat2, lon2) { ... }

// Generate traffic density heatmap using Gaussian smoothing
function generateTrafficHeatmap(...) { ... }

// Interactive route line with hover tooltip
function RoutePolylineWithTooltip(...) { ... }

// Client-side traffic density heatmap (Green=low, Red=high)
function TrafficHeatmapOverlay(...) { ... }

// Remote GeoTIFF overlay from S3 (elevation, terrain, etc.)
function GeoTIFFOverlay(...) { ... }

// Main map component
export default function MapView() { ... }
```

Each function has:
- **What it does** (one line description)
- **Key steps** (inline comments)
- **Important values** (e.g., "TODO: Change based on your data")

---

## 🚀 Ready to Go!

Your code is now:
- ✅ Fixed to use the proxy
- ✅ Has helpful comments throughout
- ✅ Will work with S3 files
- ✅ Can be adapted for local files

Just make sure your FastAPI server is running and can access the Zarr files!

**Need more help?** Check the console for specific error messages.

