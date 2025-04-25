// functions/pipeline.mjs

import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };
import { fileURLToPath } from "url";
import path from "path";
import fetch from "node-fetch";
import { fromArrayBuffer } from "geotiff";
import { DateTime } from "luxon";  // for easy date math

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Coordinates for Tahcabo
const SITE = { lon: -88.48, lat: 20.18 };

// ————————————————
// 🔗 Real CHIRPS‐GEFS URL builder
function chirpsUrl() {
  const today = DateTime.utc();
  const start = today.toFormat("yyyyLLdd");
  const end   = today.plus({ days: 4 }).toFormat("yyyyLLdd");
  return `https://data.chc.ucsb.edu/products/EWX/data/forecasts/` +
         `CHIRPS-GEFS_precip_v12/05day/precip_mean/` +
         `data-mean_${start}_${end}.tif`;
}
// ————————————————

// Mock function to generate a simple precipitation value
function getMockPrecipitation() {
  // Generate a random precipitation value between 0 and 10 mm
  return (Math.random() * 10).toFixed(2);
}

export async function runForecastPipeline() {
  const url = chirpsUrl();
  console.log("📥 Downloading", url);
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download TIFF: ${res.status} ${res.statusText}`);

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("Empty TIFF file");
    }

    try {
      const tiff = await fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();
      const rasters = await image.readRasters();
      const [originX, originY] = image.getOrigin();
      const [pxW, pxH] = image.getResolution();
      const width = image.getWidth();

      // Compute pixel coordinates
      const px = Math.floor((SITE.lon - originX) / pxW);
      const py = Math.floor((originY - SITE.lat) / pxH);
      const idx = py * width + px;
      let precipitation = rasters[0][idx];

      // Check if precipitation is valid
      if (precipitation === undefined) {
        console.warn('Missing precipitation value, treating as 0');
        precipitation = 0;
      } else if (isNaN(precipitation)) {
        throw new Error("Invalid precipitation value in TIFF file");
      }

      console.log(`📍 Precipitation at Tahcabo: ${precipitation} mm`);

      // Write result to Firestore
      const window = `${url.match(/data-mean_(\d+)_/)[1]} → ${url.match(/_(\d+)\.tif$/)[1]}`;
      await db.collection("forecast_results").doc("latest").set({
        precipitation: Number(precipitation.toFixed(2)),
        window,
        timestamp: DateTime.utc().toISO(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isMock: false,
      });

      console.log("✅ Wrote forecast to Firestore");
      return true;
    } catch (tiffError) {
      console.error("🔥 TIFF processing failed:", tiffError);
      throw new Error(`Invalid TIFF file: ${tiffError.message}`);
    }
  } catch (err) {
    console.warn("⚠️ Using mock data:", err.message);
    // Fallback: write mock data if real fetch fails
    const mockPrecipitation = getMockPrecipitation();
    await db.collection("forecast_results").doc("latest").set({
      precipitation: Number(mockPrecipitation),
      window: "mock",
      error: err.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isMock: true,
    }, { merge: true });
    
    console.log(`📍 Using mock precipitation: ${mockPrecipitation} mm`);
    console.log("✅ Wrote mock data to Firestore");
    return true;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runForecastPipeline()
    .then(() => { console.log("🎉 Pipeline complete"); process.exit(0); })
    .catch((error) => { 
      console.error("❌ Pipeline failed:", error);
      process.exit(1);
    });
}

export default runForecastPipeline;
