const { Firestore } = require("@google-cloud/firestore");
const { exec } = require("child_process");
const path = require("path");

const firestore = new Firestore();

async function runForecastPipeline() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "../your-script-folder/forecast_script.py");

    exec(`python3 ${scriptPath}`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing pipeline: ${error}`);
        return reject(error);
      }

      console.log("Script output:", stdout);

      // 🔥 OPTIONAL: Push something to Firestore here
      const docRef = firestore.collection("forecast_results").doc("latest");
      await docRef.set({
        output: stdout,
        updatedAt: new Date(),
      });

      resolve();
    });
  });
}

module.exports = { runForecastPipeline };
