import { runForecastPipeline } from "./pipeline.mjs";

async function main() {
  console.log("🚀 Starting forecast pipeline...");
  try {
    await runForecastPipeline();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 