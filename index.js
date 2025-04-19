require("dotenv").config();
const admin = require("firebase-admin");

// 🔐 Authenticate with Firebase using your service account
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// 🗃️ Connect to Firestore
const db = admin.firestore();

// 🌧️ Dummy forecast data for now
const forecast = {
  updated_at: new Date().toISOString(),
  short_term: {
    precip_mm: 12.4,
    confidence: "high",
    source: "CHIRPS-GEFS"
  },
  long_term: {
    season: "May-Jun-Jul",
    wet_probability: 0.75,
    dry_probability: 0.1,
    normal_probability: 0.15,
    source: "IRI"
  },
  metadata: {
    lat: 20.63,
    lon: -88.52
  }
};

// 🔄 Upload forecast to Firestore
async function uploadForecast() {
  try {
    await db.collection("forecast").doc("tahcabo").set(forecast);
    console.log("🌦️ Forecast uploaded to Firestore successfully!");
  } catch (err) {
    console.error("🔥 Error uploading forecast:", err);
  }
}

uploadForecast();
