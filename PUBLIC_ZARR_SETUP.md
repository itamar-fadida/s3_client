# How to Load Zarr from Public Directory

## 📁 Setup Instructions

### Step 1: Copy Your Zarr Folder to Public

Copy your `route.zarr` folder into the `client/public/` directory:

```bash
# Windows (PowerShell)
Copy-Item -Path ".\data\route.zarr" -Destination ".\client\public\" -Recurse

# Windows (Command Prompt)
xcopy /E /I .\data\route.zarr .\client\public\route.zarr

# Linux/Mac
cp -r ./data/route.zarr ./client/public/
```

### Step 2: Verify Directory Structure

Your structure should look like:

```
client/
├── public/
│   ├── route.zarr/
│   │   ├── zarr.json          ← Required!
│   │   ├── c/                 ← Chunks folder
│   │   │   ├── 0/
│   │   │   │   └── 0
│   │   │   ├── 1/
│   │   │   │   └── 0
│   │   │   └── ...
│   │   └── .zattrs (optional)
│   └── vite.svg
├── src/
└── package.json
```

### Step 3: The Code is Already Set!

The code now loads from `/route.zarr` (public directory) by default:

```typescript
const base_url = "/route.zarr"; // Files in public/route.zarr/
```

### Step 4: Restart Your Dev Server

```bash
cd client
npm run dev
```

---

## 🔍 Check Console Logs

Open browser console (F12) and you should see:

```
🚀 Starting route fetch...
✅ Using base URL: /route.zarr
📦 Opening Zarr store from: /route.zarr
📦 Attempting to open Zarr array...
✅ Zarr store opened successfully!
📊 Fetching array data...
✅ Got data array!
   - Shape: [1000, 3]
   - Data length: 1000
🔄 Processing 1000 points...
✅ Processed 1000 route points
🎉 Route loaded successfully!
```

---

## ⚠️ If You See Errors

### Error: "Failed to fetch zarr.json"

**Problem:** File doesn't exist or path is wrong

**Solution:**
1. Check that `client/public/route.zarr/zarr.json` exists
2. Verify the file structure matches above
3. Restart the dev server

```bash
# Check if file exists (Windows)
dir client\public\route.zarr\zarr.json

# Check if file exists (Linux/Mac)
ls client/public/route.zarr/zarr.json
```

### Error: "404 Not Found"

**Problem:** File path incorrect

**Solution:**
- Make sure folder is named exactly `route.zarr` (case-sensitive on Linux/Mac)
- Check there's no extra nested folders

### Error: "Unexpected token '<'"

**Problem:** Getting HTML instead of JSON

**Solution:**
- Vite dev server not serving the files correctly
- Restart: `npm run dev`

---

## 🔄 Switch Back to S3 (When Ready)

When you want to use S3 again, edit `MapView.tsx`:

```typescript
// Comment out this line:
// const base_url = "/route.zarr";

// Uncomment this block:
console.log("📡 Fetching proxy URL from http://localhost:8000/proxy/route");
const res = await fetch("http://localhost:8000/proxy/route");

if (!res.ok) {
  const errorText = await res.text();
  console.error("❌ Server response:", errorText);
  throw new Error(`Server error: ${res.status} ${res.statusText}`);
}

const { base_url } = await res.json();
```

---

## 🎯 Quick Checklist

- [ ] Copied `route.zarr` folder to `client/public/`
- [ ] Verified `zarr.json` exists in the folder
- [ ] Restarted dev server (`npm run dev`)
- [ ] Opened browser console (F12)
- [ ] Refreshed the page
- [ ] Checked console logs for errors

---

## 💡 Pro Tips

1. **Console logs are now VERY detailed** - You'll see exactly what's happening
2. **Errors show full stack traces** - Easy to debug
3. **Progress bar updates at each step** - Not stuck at 10% anymore!
4. **Public folder is faster** - No server needed for testing

---

## 📊 Expected Console Output

### Success (What You Want to See):
```
🚀 Starting route fetch...
✅ Using base URL: /route.zarr
📦 Opening Zarr store from: /route.zarr
📦 Attempting to open Zarr array...
✅ Zarr store opened successfully!
📊 Fetching array data...
✅ Got data array!
🔄 Processing 1000 points...
✅ Processed 1000 route points
🎉 Route loaded successfully!
```

### Error (What to Debug):
```
🚀 Starting route fetch...
✅ Using base URL: /route.zarr
📦 Opening Zarr store from: /route.zarr
📦 Attempting to open Zarr array...
==================================================
❌ ERROR LOADING ROUTE
==================================================
Error object: TypeError: Failed to fetch
Error message: Failed to fetch
Error name: TypeError
==================================================
```

If you see the error format above, the file doesn't exist or path is wrong!

---

## 🚀 You're Ready!

The code now:
- ✅ Loads from public directory by default
- ✅ Shows detailed console logs
- ✅ Catches and displays all errors
- ✅ Updates progress bar correctly
- ✅ No more stuck at 10%!

Just copy your Zarr files and refresh! 🎉

