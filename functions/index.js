// functions/index.js

const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const serviceAccount = require("./mayan-roots-43fe8-firebase-adminsdk-fbsvc-00504a1b8a.json");
const { runForecastPipeline } = require("./pipeline");

// initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();

exports.forecast = onRequest(async (req, res) => {
  console.log("Starting forecast pipeline…");
  try {
    await runForecastPipeline(firestore);
    res.send("Forecast pipeline executed successfully!");
  } catch (err) {
    console.error("Pipeline failed:", err);
    res.status(500).send("Pipeline execution error");
  }
});
