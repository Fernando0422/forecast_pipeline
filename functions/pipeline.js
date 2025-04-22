// functions/pipeline.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const { exec } = require("child_process");
const path = require("path");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function runForecastPipeline() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "../weather_pipeline.js");

    exec(`node ${scriptPath}`, async (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Error running forecast script:", error);
        return reject(error);
      }
      const output = stdout.trim();
      console.log("📦 Script output:", output);

      try {
        await db
          .collection("forecast_results")
          .doc("latest")
          .set({
            output,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log("✅ Wrote forecast to Firestore");
        resolve();
      } catch (writeErr) {
        console.error("❌ Error writing to Firestore:", writeErr);
        reject(writeErr);
      }
    });
  });
}

if (require.main === module) {
  runForecastPipeline()
    .then(() => {
      console.log("🎉 Pipeline complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("🔥 Pipeline failed", err);
      process.exit(1);
    });
}

module.exports = runForecastPipeline;
