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
      const width = image.getWidth();
      const height = image.getHeight();
      const bbox = image.getBoundingBox();
      const [west, south, east, north] = bbox;
      const pixelWidth = (east - west) / width;
      const pixelHeight = (north - south) / height;
      console.log(`Bounding box: [${west}, ${south}, ${east}, ${north}]`);
      console.log(`Pixel size: width=${pixelWidth}, height=${pixelHeight}`);
      console.log(`Image size: width=${width}, height=${height}`);

      // Compute pixel coordinates
      const px = Math.floor((SITE.lon - west) / pixelWidth);
      const py = Math.floor((north - SITE.lat) / pixelHeight);
      const idx = py * width + px;
      console.log(`Computed pixel: px=${px}, py=${py}, idx=${idx}`);
      console.log(`Raster length: ${rasters[0].length}`);

      let precipitation = rasters[0][idx];

      // Fallback: search 3x3 window if main pixel is missing
      if (precipitation === undefined || isNaN(precipitation)) {
        console.warn('Main pixel missing, searching 3x3 window for valid value...');
        let found = false;
        for (let dy = -1; dy <= 1 && !found; dy++) {
          for (let dx = -1; dx <= 1 && !found; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = px + dx;
            const ny = py + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx;
              const nval = rasters[0][nidx];
              if (nval !== undefined && !isNaN(nval)) {
                precipitation = nval;
                found = true;
                console.warn(`Used fallback pixel at (px=${nx}, py=${ny}, idx=${nidx}) with value ${nval}`);
              }
            }
          }
        }
        if (!found) {
          throw new Error('Missing precipitation value (even after fallback)');
        }
      }

      // Check if precipitation is valid
      if (precipitation === undefined) {
        throw new Error('Missing precipitation value');
      } else if (isNaN(precipitation)) {
        throw new Error("Invalid precipitation value in TIFF file");
      }

      console.log(`📍 Precipitation at Tahcabo: ${precipitation} mm`);

      // Write result to Firestore (only real data)
      await db.collection("forecast_results").doc("latest").set({
        precipitation_mm: Number(precipitation.toFixed(2)),
        source: "CHIRPS-GEFS",
        source_file: url.split('/').pop(),
        updated_at: DateTime.utc().toISO(),
      });

      console.log("✅ Wrote real forecast to Firestore");
      return true;
    } catch (tiffError) {
      console.error("🔥 TIFF processing failed:", tiffError);
      // Log error to a separate errors collection
      await db.collection("forecast_results").doc("errors").set({
        error: tiffError.message,
        at: DateTime.utc().toISO(),
        source_file: url.split('/').pop(),
      }, { merge: true });
      throw tiffError;
    }
  } catch (err) {
    console.error("❌ Pipeline failed:", err);
    // Log error to a separate errors collection
    await db.collection("forecast_results").doc("errors").set({
      error: err.message,
      at: DateTime.utc().toISO(),
      source_file: url.split('/').pop(),
    }, { merge: true });
    throw err;
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
