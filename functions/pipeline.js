// functions/pipeline.js

const { exec } = require("child_process");
const path = require("path");

/**
 * Runs the Python forecast script and writes its stdout to Firestore.
 *
 * @param {FirebaseFirestore.Firestore} firestore - an initialized Admin‐SDK Firestore instance
 */
async function runForecastPipeline(firestore) {
  return new Promise((resolve, reject) => {
    // adjust this relative path to wherever your forecast_script.py lives
    const scriptPath = path.join(__dirname, "../your-script-folder/forecast_script.py");

    exec(`python3 ${scriptPath}`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing pipeline:`, error);
        return reject(error);
      }
      console.log("Script output:", stdout);

      try {
        const docRef = firestore.collection("forecast_results").doc("latest");
        await docRef.set({
          output: stdout,
          updatedAt: new Date(),
        });
        console.log("Wrote results to Firestore");
        resolve();
      } catch (writeErr) {
        console.error("Error writing to Firestore:", writeErr);
        reject(writeErr);
      }
    });
  });
}

module.exports = { runForecastPipeline };
