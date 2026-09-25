# Project Suraksha (SIH26191)

Multi-Hazard Disaster Risk Assessment System for Vadodara District, Gujarat, India.

## Quick Start

```bash
cd final_project
pip install -r requirements.txt
python -m uvicorn src.api:app --host 0.0.0.0 --port 8001 --reload
```

Open browser at **http://localhost:8001**

## Project Structure

```
final_project/
├── src/                    # Source code
│   ├── common_utils.py     # Shared utilities
│   ├── integration.py      # SurakshaEngine - model inference
│   ├── master_controller.py  # Orchestration controller
│   ├── api.py              # FastAPI REST API
│   ├── model*.py           # Individual model training scripts
│   └── run_all_models.py   # Batch training runner
│
├── data/                   # Training datasets (CSVs)
├── models/                 # Trained model files (.keras + .joblib)
├── webapp/
│   ├── frontend/           # HTML pages
│   └── static/             # CSS + JS assets
│
├── output/                 # Generated GIS exports, rankings
├── .vscode/                # VS Code configuration
├── requirements.txt        # Python dependencies
├── start_suraksha.bat      # Windows startup script
└── README.md               # This file
```

## Running in VS Code

### Method 1: Launch Configuration (Recommended)

1. Open the `final_project` folder in VS Code
2. Press `F5` or go to Run > Start Debugging
3. Select **"Python: Suraksha API"**
4. The API starts on http://localhost:8001
5. Open browser to http://localhost:8001

### Method 2: Terminal

1. Open integrated terminal (`Ctrl+` ` `)
2. Run: `python -m uvicorn src.api:app --host 0.0.0.0 --port 8001 --reload`
3. Open browser to http://localhost:8001

### Method 3: Batch File

Double-click `start_suraksha.bat` from Explorer.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health check |
| `/predict/hazard` | POST | Predict hazard scores |
| `/predict/intent` | POST | Classify user intent |
| `/report/{village_name}` | GET | Full village risk report |
| `/relocation/candidates/{village_code}` | GET | Top relocation sites |
| `/alert/check` | POST | Real-time alert checking |
| `/batch/risk_ranking` | GET | All 680 villages ranked |
| `/map/geojson` | GET | GIS GeoJSON export |
| `/live/weather/{village_name}` | GET | Live weather data |
| `/live/alerts` | GET | Active disaster alerts |
| `/help` | GET | API documentation |

## Features

- **Multi-Hazard Assessment**: Flood, Erosion, Cloudburst, Landslide
- **Composite Risk Scoring**: Weighted combination of all hazards
- **Priority Tiers**: TIER 1 (Critical) through TIER 4 (Monitor)
- **Relocation Planning**: Optimal site selection with suitability scoring
- **NLP Support**: Natural language query classification
- **Real-time Alerts**: Weather-based critical alert system
- **GIS Export**: Interactive maps with GeoJSON format
- **Confidence Scores**: Explainable AI with key risk factors

## Technologies

- **Backend**: FastAPI, TensorFlow/Keras, scikit-learn, pandas
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Leaflet.js
- **Data**: Open-Meteo API, GDACS RSS feeds
- **Deployment**: Uvicorn ASGI server

## Training Data

- 680 villages in Vadodara district
- 9 raster layers (elevation, rainfall, slope, etc.)
- Multi-modal model ensemble (Keras + sklearn RF/GB)
- 11 trained models, all saved in `models/`
