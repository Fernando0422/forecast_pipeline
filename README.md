# Forecast Pipeline

A Firebase-based pipeline that fetches precipitation forecast data from CHIRPS-GEFS and stores it in Firestore.

## Local Development

### Prerequisites

- Node.js (v18 or later)
- Firebase CLI
- Firebase project set up with Firestore and Authentication

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Fernando0422/forecast_pipeline.git
   cd forecast_pipeline
   ```

2. Place your Firebase service account key in the functions directory:
   ```bash
   # Copy your serviceAccountKey.json to the functions directory
   cp /path/to/your/serviceAccountKey.json functions/
   ```

### Running the Pipeline Locally

1. Start the Firebase emulators:
   ```bash
   firebase emulators:start --only firestore,auth
   ```

2. In a new terminal, set up the environment variables and run the pipeline:
   ```bash
   export FIRESTORE_EMULATOR_HOST=localhost:8081
   export GOOGLE_APPLICATION_CREDENTIALS=./functions/serviceAccountKey.json
   cd functions && npm install && node index.mjs
   ```

### Production Deployment

The pipeline is automatically deployed and runs daily at 12:00 UTC via GitHub Actions. The workflow:

1. Checks out the latest code
2. Creates a serviceAccountKey.json from the FIREBASE_SERVICE_ACCOUNT secret
3. Runs the pipeline using the production Firestore instance
4. See `.github/workflows/forecast-pipeline.yml` for full CI steps

### Hosting URL

The pipeline writes forecast data to Firestore, which is then accessible via the hosting URL:
`https://mayan-roots-43fe8.web.app/forecasts/data-mean_<YYYYMMDD>_<YYYYMMDD>.tif`

For example: `https://mayan-roots-43fe8.web.app/forecasts/data-mean_20250424_20250428.tif`

> **Note:** When a real GeoTIFF file lands in the `public/forecasts/` directory, the pipeline automatically switches from using mock data to using the real data.

## Project Structure

- `functions/` - Contains the Firebase Functions code
  - `index.mjs` - Main entry point
  - `pipeline.mjs` - Core pipeline logic
  - `serviceAccountKey.json` - Firebase service account credentials (not in repo)
- `.github/workflows/` - GitHub Actions workflows
  - `forecast-pipeline.yml` - Daily forecast pipeline job
- `firebase.json` - Firebase configuration 