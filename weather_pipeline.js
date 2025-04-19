// 📦 weather_pipeline.js
// This script fetches the latest CHIRPS-GEFS GeoTIFF, extracts rainfall at Tahcabo,
// and uploads the result to Firestore.

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as GeoTIFF from 'geotiff';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// 🌎 Target coordinates for Tahcabo
const TARGET_LAT = 20.63;
const TARGET_LON = -88.52;
const FIRESTORE_COLLECTION = 'weather';
const FIRESTORE_DOCUMENT = 'tahcabo_forecast';

// 🔐 Firebase setup
const serviceAccount = JSON.parse(await fs.readFile('./serviceAccountKey.json', 'utf-8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 🌐 Scrape latest .tif file
const BASE_URL = 'https://data.chc.ucsb.edu/products/EWX/data/forecasts/CHIRPS-GEFS_precip_v12/05day/precip_mean/';

async function getLatestTIFUrl() {
  const { data: html } = await axios.get(BASE_URL);
  const $ = cheerio.load(html);
  const links = $('a')
    .map((i, el) => $(el).attr('href'))
    .get()
    .filter(href => href.endsWith('.tif'))
    .sort(); // sorted by date (latest is last)

  const latestFile = links[links.length - 1];
  const fullUrl = BASE_URL + latestFile;
  return { url: fullUrl, filename: latestFile };
}

// 🗺️ Extract precipitation from GeoTIFF
async function extractPrecipitation(filepath) {
  const buffer = await fs.readFile(filepath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const [data] = rasters;

  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();
  const pixelWidth = (bbox[2] - bbox[0]) / width;
  const pixelHeight = (bbox[3] - bbox[1]) / height;
  const x = Math.floor((TARGET_LON - bbox[0]) / pixelWidth);
  const y = Math.floor((bbox[3] - TARGET_LAT) / pixelHeight);
  const index = y * width + x;

  return data[index];
}

// 🔥 Upload to Firestore
async function uploadToFirestore(value, sourceFilename) {
  const docRef = db.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOCUMENT);
  await docRef.set({
    precipitation_mm: value,
    updated_at: new Date().toISOString(),
    source_file: sourceFilename,
    source: 'CHIRPS-GEFS'
  });
}

// 🧠 Master function
async function main() {
  console.log('🚀 Starting forecast pipeline...');
  const { url, filename } = await getLatestTIFUrl();
  console.log(`📥 Downloading ${filename}...`);
  const localPath = path.join('./', filename);

  const response = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.writeFile(localPath, response.data);
  console.log(`✅ Downloaded ${filename}`);

  const precipValue = await extractPrecipitation(localPath);
  console.log(`📍 Precipitation at Tahcabo: ${precipValue.toFixed(2)} mm`);

  await uploadToFirestore(precipValue, filename);
  console.log(`🔥 Uploaded to Firestore!`);

  await fs.unlink(localPath); // delete local .tif to save space
  console.log('🧼 Cleaned up. Done.');
}

main().catch(console.error);
