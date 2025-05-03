const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const TIF_DIR = "https://data.chc.ucsb.edu/products/EWX/data/forecasts/CHIRPS-GEFS_precip_v12/05day/precip_mean/";

async function getLatestTIFUrl() {
  try {
    const { data: html } = await axios.get(TIF_DIR);
    const $ = cheerio.load(html);
    const links = $("a")
      .map((i, el) => $(el).attr("href"))
      .get()
      .filter(link => link.endsWith(".tif") && link.includes("data-mean_"));

    // Sort files by date (filename has format: data-mean_YYYYMMDD_YYYYMMDD.tif)
    const sorted = links.sort((a, b) => {
      const aDate = a.match(/_(\d{8})_/)[1];
      const bDate = b.match(/_(\d{8})_/)[1];
      return bDate.localeCompare(aDate); // Descending
    });

    const latestFile = sorted[0];
    const fullUrl = TIF_DIR + latestFile;
    console.log(`🛰️ Latest file: ${latestFile}`);
    return { url: fullUrl, filename: latestFile };
  } catch (err) {
    console.error("Failed to fetch TIF list:", err);
  }
}

async function downloadTIF(url, filename) {
  const writer = fs.createWriteStream(path.join(__dirname, filename));
  const { data } = await axios.get(url, { responseType: "stream" });
  data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      console.log("✅ Download complete:", filename);
      resolve(filename);
    });
    writer.on("error", reject);
  });
}

// Run it
(async () => {
  const { url, filename } = await getLatestTIFUrl();
  await downloadTIF(url, filename);
})();
