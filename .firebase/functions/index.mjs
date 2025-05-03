import { runForecastPipeline } from "./pipeline.mjs";

async function main() {
  console.log("🚀 Starting forecast pipeline...");
  try {
    await runForecastPipeline();
    console.log("🎉 Pipeline complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Pipeline failed with error:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 