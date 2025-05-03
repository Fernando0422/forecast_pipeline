import fs from 'fs/promises';
import * as GeoTIFF from 'geotiff';

const TARGET_LAT = 20.63;
const TARGET_LON = -88.52;
const FILE = 'data-mean_20250419_20250423.tif';

async function extractPrecipitation() {
  const buffer = await fs.readFile(FILE);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const [data] = rasters;

  const width = image.getWidth();
  const height = image.getHeight();

  const bbox = image.getBoundingBox(); // [west, south, east, north]
  const pixelWidth = (bbox[2] - bbox[0]) / width;
  const pixelHeight = (bbox[3] - bbox[1]) / height;

  const x = Math.floor((TARGET_LON - bbox[0]) / pixelWidth);
  const y = Math.floor((bbox[3] - TARGET_LAT) / pixelHeight);
  const index = y * width + x;

  const value = data[index];
  console.log(`📍 Precipitation at Tahcabo: ${value.toFixed(2)} mm`);
}

extractPrecipitation().catch(console.error);
