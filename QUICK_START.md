# Quick Start Guide

## 🚀 What's New

Your map application now has **4 major features**:

### 1. 🖱️ Hover Tooltips on Route
- **Hover** over the blue route line
- See **timestamp** and **coordinates** instantly
- Tooltip follows your cursor
- No lag, no performance hit

### 2. 🗺️ GeoTIFF Overlay
- Toggle with **"GeoTIFF Overlay"** checkbox
- Loads heatmap from S3 (elevation, terrain, etc.)
- Blue → Cyan → Green → Yellow → Red color scale
- Legend in top-right corner

### 3. 🚦 Traffic Heatmap (Dynamic)
- Toggle with **"Traffic Heatmap"** checkbox
- Generated **in your browser** from route points
- Shows route density (where you spent most time)
- Green → Yellow → Orange → Red color scale
- Legend in bottom-right corner
- Uses Gaussian smoothing for professional look

### 4. 📊 Color Legends
- **Top-right**: GeoTIFF scale
- **Bottom-right**: Traffic density scale
- Automatically show/hide with overlays

---

## 🎮 How to Use

### Step 1: Start Your App
```bash
# Terminal 1 - Start server
cd server
python main.py

# Terminal 2 - Start client
cd client
npm install  # First time only
npm run dev
```

### Step 2: View Your Map
1. Open browser to `http://localhost:5173`
2. Wait for route to load (blue line appears)
3. See two checkboxes in top-left corner

### Step 3: Try Features

**Hover Tooltip:**
- Move mouse over blue route line
- Tooltip appears showing time and location
- Move away to hide

**GeoTIFF Overlay:**
- Click "GeoTIFF Overlay" checkbox
- Wait 1-2 seconds for loading
- See colored overlay appear
- Legend shows in top-right

**Traffic Heatmap:**
- Click "Traffic Heatmap" checkbox
- Generates instantly (no loading!)
- See density hotspots
- Legend shows in bottom-right

**Try Both!**
- Enable both overlays at once
- Compare patterns
- Toggle on/off as needed

---

## 🎨 What You'll See

### Route Line (Always Visible)
- **Blue line** showing your route
- Thicker than before (easier to hover)
- Start marker with popup

### When You Hover
```
┌─────────────────┐
│ 14:23:45        │
│ 32.08123, 34... │
└─────────────────┘
```

### GeoTIFF Overlay
- Colored transparent layer
- Covers entire map area
- Based on your GeoTIFF file data

### Traffic Heatmap
- Colored transparent layer
- Only covers route bounding box
- Red spots = dense clusters
- Green spots = sparse areas

### Legends

**Top-Right (GeoTIFF):**
```
GeoTIFF Heatmap
Low [█████████] High
```

**Bottom-Right (Traffic):**
```
Traffic Density
Low [█████████] High
```

---

## ⚙️ Configuration

### Change GeoTIFF File
Edit `server/main.py` line 81:
```python
s3_key = "data/heatmap.tif"  # Change this
```

### Adjust Traffic Heatmap Smoothness
Edit `client/src/components/MapView.tsx` lines 73-74:
```typescript
const sigma = 3;        // Spread: 2 (sharp) to 5 (smooth)
const kernelSize = 9;   // Radius: 7 to 15
```

### Adjust Heatmap Quality
Edit line 262:
```typescript
generateTrafficHeatmap(route, bounds, 150) // 100 (fast) to 200 (quality)
```

### Adjust Overlay Opacity
**GeoTIFF** (line 326):
```typescript
opacity: 0.7,  // 0.0 (invisible) to 1.0 (opaque)
```

**Traffic** (line 258):
```typescript
opacity: 0.6,
```

---

## 🎯 Common Use Cases

### Finding Traffic Congestion
1. Enable **Traffic Heatmap**
2. Look for red hotspots
3. These are areas where route points cluster
4. Indicates slow movement or stops

### Analyzing Elevation
1. Upload elevation GeoTIFF to S3
2. Enable **GeoTIFF Overlay**
3. Red = high elevation
4. Blue = low elevation

### Time Analysis
1. Hover over route segments
2. Note timestamps
3. Calculate time between points
4. Identify delays

### Combined Analysis
1. Enable both overlays
2. See if traffic correlates with terrain
3. Find patterns
4. Optimize future routes

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| No route showing | Check server is running on port 8000 |
| GeoTIFF won't load | Verify file exists in S3 at `data/heatmap.tif` |
| Traffic heatmap blank | Ensure route has >10 points |
| Tooltip not showing | Hover directly on blue line (not near it) |
| Performance lag | Disable one overlay, reduce grid size to 100 |
| Colors look wrong | Adjust min/max values in code |

---

## 📱 Browser Compatibility

✅ **Fully Supported:**
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

⚠️ **Limited Support:**
- Older browsers may have slower canvas rendering
- Mobile browsers work but may be slower

---

## 🔥 Pro Tips

1. **Generate traffic heatmap first** (it's instant)
2. **GeoTIFF loads slower** - be patient
3. **Hover tooltip works even with overlays on**
4. **Disable overlays when not needed** for better performance
5. **Zoom in to see more detail** on heatmaps
6. **Use both legends** to interpret colors correctly
7. **Check console** for debugging info

---

## 📈 Performance Tips

**For Large Routes (>5000 points):**
- Reduce heatmap grid to 100
- Use sigma = 2 (less spread)
- Consider reducing route point density

**For Slow Devices:**
- Enable one overlay at a time
- Reduce GeoTIFF resolution to 128
- Use traffic heatmap only (no server load)

**For Best Visual Quality:**
- Use grid size 200
- Use sigma = 4
- Enable both overlays
- Use high-quality GeoTIFF

---

## 🎓 Understanding the Heatmaps

### Traffic Heatmap Colors
- 🟢 **Green**: Few route points (fast travel)
- 🟡 **Yellow**: Moderate density
- 🟠 **Orange**: High density (slower travel)
- 🔴 **Red**: Very high density (stops, congestion)

### GeoTIFF Colors (depends on your data)
- 🔵 **Blue**: Low values
- 🟢 **Green**: Medium values
- 🟡 **Yellow**: Medium-high values
- 🔴 **Red**: High values

### Interpreting Overlaps
- Both red = high elevation + congestion
- GeoTIFF red + Traffic green = elevation without traffic
- GeoTIFF blue + Traffic red = low elevation but congested

---

## 📦 What Was Installed

New npm packages:
```json
{
  "georaster": "^1.6.0",
  "georaster-layer-for-leaflet": "^3.10.0",
  "@types/leaflet": "^1.9.12"
}
```

To reinstall:
```bash
cd client
npm install
```

---

## 🚀 Next Steps

1. **Test with your data** - Upload a real GeoTIFF
2. **Adjust colors** - Match your data range
3. **Customize opacity** - Find the right balance
4. **Try different routes** - See various patterns
5. **Optimize performance** - Tune for your hardware

---

## 📚 More Information

- **Full feature documentation**: See `FEATURES.md`
- **GeoTIFF setup**: See `GEOTIFF_FEATURE.md`
- **Technical details**: Check code comments in `MapView.tsx`

---

## 💬 Quick Reference

```bash
# Start everything
cd server && python main.py &
cd client && npm run dev

# Install packages
cd client && npm install

# Check for errors
# Open browser console (F12)

# Restart server
# Ctrl+C, then python main.py again
```

---

**You're all set! Enjoy your enhanced map visualization! 🎉**

Need help? Check the console logs or refer to `FEATURES.md` for detailed documentation.

