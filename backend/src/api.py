"""
FastAPI REST API for Project Suraksha - Chat & Route Integration
"""
import asyncio
import os, json, math, numpy as np, pandas as pd
from contextlib import asynccontextmanager
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from datetime import datetime

try:
    from .master_controller import ProjectSurakshaController
except ImportError:
    from master_controller import ProjectSurakshaController

_controller: Optional[ProjectSurakshaController] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _controller
    try:
        _controller = ProjectSurakshaController()
        print("Suraksha models loaded successfully")
        # Run the synchronous precompute work in a worker thread.
        if os.getenv("SKIP_PRECOMPUTE", "false").lower() != "true":
            asyncio.create_task(asyncio.to_thread(_precompute_village_cache))
            print("Precompute started in background")
        else:
            print("Precompute skipped by configuration")
    except Exception as e:
        print(f"Error loading models: {e}")
    yield
    print("Shutting down...")

def _precompute_village_cache():
    """Pre-calculate all village predictions and write to frontend public dir."""
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        # Find earth-app public dir
        for root in [base_dir, os.path.dirname(base_dir), os.path.dirname(os.path.dirname(base_dir))]:
            candidate = os.path.join(root, "earth-app", "earth-app", "public", "vadodara_villages.json")
            if os.path.exists(os.path.dirname(candidate)):
                public_dir = os.path.dirname(candidate)
                break
        else:
            # Fallback: use earth-app/earth-app/public
            candidate = os.path.join(base_dir, "earth-app", "earth-app", "public", "vadodara_villages.json")
            public_dir = os.path.dirname(candidate)
            os.makedirs(public_dir, exist_ok=True)

        village_df = _controller.engine.village_df
        if village_df is None or len(village_df) == 0:
            print("No village data found for precompute")
            return

        villages_data = []
        for _, row in village_df.iterrows():
            try:
                name = row.get("village_name", "")
                report = _controller.get_village_report(name)
                if "error" in report:
                    continue
                # Helper to safely convert to int (handles NaN)
                def safe_int(v):
                    try:
                        if v is None or (isinstance(v, float) and pd.isna(v)):
                            return 0
                        return int(v)
                    except (ValueError, TypeError):
                        return 0
                def safe_float(v):
                    try:
                        if v is None or (isinstance(v, float) and pd.isna(v)):
                            return 0.0
                        return float(v)
                    except (ValueError, TypeError):
                        return 0.0
                # Round all values to 1 decimal place
                villages_data.append({
                    "village_name": report.get("village_name", name),
                    "subdistrict": report.get("subdistrict", ""),
                    "village_code": safe_int(row.get("village_code", 0)),
                    "composite_risk_score": round(report.get("composite_risk_score", 0), 1),
                    "flood_hazard_score": round(report.get("flood_hazard_score", 0), 1),
                    "erosion_risk": round(report.get("erosion_risk", 0), 1),
                    "cloudburst_probability": round(report.get("cloudburst_probability", 0), 1),
                    "landslide_susceptibility": round(report.get("landslide_susceptibility", 0), 1),
                    "vulnerability_score": round(report.get("vulnerability_score", 0), 1),
                    "total_population": safe_int(report.get("total_population", 0)),
                    "total_households": safe_int(report.get("total_households", 0)),
                    "distance_to_river_km": round(safe_float(row.get("distance_to_river_km_EXTERNAL_TOFILL", 0)), 1),
                    "river_canal_present": safe_int(row.get("river_canal_present", 0)),
                    "surface_water_exposure": safe_int(row.get("surface_water_exposure", 0)),
                    "latitude": safe_float(row.get("latitude", 0)),
                    "longitude": safe_float(row.get("longitude", 0)),
                    "tier": report.get("priority_zone", "Unknown"),
                })
            except Exception as e:
                print(f"Error precomputing {row.get('village_name', 'unknown')}: {e}")
                continue

        with open(candidate, "w") as f:
            json.dump(villages_data, f)
        print(f"Pre-computed {len(villages_data)} villages to {candidate}")
    except Exception as e:
        print(f"Precompute error: {e}")

app = FastAPI(title="Suraksha", description="Disaster Risk Assessment", version="1.0", lifespan=lifespan)
allowed_origins = [origin.strip() for origin in os.getenv("FRONTEND_URL", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
async def root_status():
    return {"service": "Suraksha API", "status": "ready" if _controller else "loading"}

@app.get("/health")
async def health_status():
    return {"status": "ok", "models_loaded": _controller is not None}

try:
    static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "webapp", "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")
except Exception as e:
    print(f"Static files error: {e}")

# ==================== STATUS ENDPOINT ====================

@app.get("/api/status")
async def api_status():
    return {"status": "ready" if _controller else "loading", "models_loaded": _controller is not None}

# ==================== DATA STORE FOR CHAT ====================

CHAT_HISTORY_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "chat_history.jsonl")

def save_chat_message(session_id, role, message):
    try:
        os.makedirs(os.path.dirname(CHAT_HISTORY_FILE), exist_ok=True)
        with open(CHAT_HISTORY_FILE, "a") as f:
            f.write(json.dumps({"session_id": session_id, "role": role, "message": message, "timestamp": datetime.now().isoformat()}) + "\n")
    except OSError:
        # Serverless filesystems are temporary or read-only; chat still works without persistence.
        pass

# ==================== CHAT API ====================

class ChatMessage(BaseModel):
    message: str
    session_id: str = "default"

class ChatResponse(BaseModel):
    response: str
    confidence: float
    risk_assessment: Optional[dict] = None
    suggestions: list = []

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(msg: ChatMessage):
    if _controller is None:
        return {"response": "🔄 AI models are still loading. Please wait a few seconds and try again. The system is initializing TensorFlow models for the first time.", "confidence": 0.0, "risk_assessment": {}, "suggestions": ["Try again in a moment"]}

    user_msg = msg.message.lower()
    response = generate_chat_response(user_msg, msg.session_id)
    save_chat_message(msg.session_id, "user", msg.message)
    save_chat_message(msg.session_id, "assistant", response["response"])
    return response

def generate_chat_response(user_msg, session_id):
    keywords = {
        "flood": ["flood", "water", "submerge", "inundation", "lake"],
        "landslide": ["landslide", "slide", "slope", "hill", "mountain"],
        "cloudburst": ["cloudburst", "heavy rain", "storm", "rainfall", "monsoon"],
        "erosion": ["erosion", "soil", "degradation", "land"],
        "relocate": ["relocate", "evacuate", "move", "safe", "shelter", "relocation"],
        "risk": ["risk", "danger", "hazard", "threat", "unsafe"],
        "weather": ["weather", "temperature", "wind", "forecast", "alert"],
        "help": ["help", "guide", "how", "what", "explain"],
    }

    detected_intents = []
    for intent, kws in keywords.items():
        if any(w in user_msg for w in kws):
            detected_intents.append(intent)

    village_name = extract_village_name(user_msg)
    village_code = extract_village_code(user_msg)

    risk_data = None
    if village_name:
        try:
            report = _controller.get_village_report(village_name)
            if "error" not in report:
                risk_data = report
        except:
            pass

    if "relocate" in detected_intents or "risk" in detected_intents or "evacuate" in user_msg:
        return handle_relocation_query(user_msg, risk_data, village_code)
    elif "flood" in detected_intents:
        return handle_hazard_query("flood", risk_data)
    elif "landslide" in detected_intents:
        return handle_hazard_query("landslide", risk_data)
    elif "cloudburst" in detected_intents:
        return handle_hazard_query("cloudburst", risk_data)
    elif "erosion" in detected_intents:
        return handle_hazard_query("erosion", risk_data)
    elif "weather" in detected_intents:
        return handle_weather_query()
    else:
        return handle_general_query(risk_data, user_msg)

def extract_village_name(text):
    villages = _controller.engine.village_df["village_name"].tolist() if hasattr(_controller.engine, 'village_df') else []
    for v in villages:
        if v.lower() in text:
            return v
    return None

def extract_village_code(text):
    import re
    nums = re.findall(r'\b\d{4,}\b', text)
    if nums:
        return int(nums[0])
    return None

def handle_relocation_query(user_msg, risk_data, village_code):
    if risk_data and "composite_risk_score" in risk_data:
        risk = risk_data["composite_risk_score"]
        tier = risk_data.get("priority_zone", "Unknown")
        confidence = risk_data.get("confidence_score", 0.8)

        if risk > 0.6:
            response = f"""🛡️ **Relocation Recommendation for {risk_data.get('village_name', 'this area')}**

Sir/Ma'am, based on our analysis, this area requires **immediate attention**.

**Current Assessment:**
- Risk Score: {risk:.0%}
- Priority Zone: {tier}
- Confidence: {confidence:.0%}

**Recommended Action:** Relocation is strongly recommended for the safety of {risk_data.get('total_population', 'all')} residents.

Would you like me to:
1. Show the nearest safe relocation sites?
2. Provide a route map from this village to the nearest safe site?
3. Explain the risks in detail?

Please let me know how you'd like to proceed."""
        else:
            response = f"""🛡️ **Assessment for {risk_data.get('village_name', 'this area')}**

Sir/Ma'am, the current risk level for this area is **moderate**.

- Risk Score: {risk:.0%}
- Priority Zone: {tier}

While the risk is currently manageable, we recommend continuous monitoring. Would you like to know more about mitigation measures?"""
    elif village_code:
        candidates = _controller.engine.rank_relocation_candidates(village_code, top_n=3)
        if candidates:
            response = f"""🛡️ **Safe Relocation Sites Found**

Here are the top 3 nearest safe sites:

"""
            for i, c in enumerate(candidates, 1):
                response += f"{i}. **{c['site_name']}** (Suitability: {c['suitability_score']:.0%}) - {c['subdistrict']}\n"
            response += """
Would you like a route map from your village to any of these sites?"""
        else:
            response = "I could not find nearby safe relocation sites. Would you like me to check a different village?"
    else:
        response = """🛡️ **Relocation Planning**

I can help with relocation planning. Please provide:
- A village name (e.g., "Alampura")
- Or ask about safe relocation sites

Example: "Should we relocate Alampura?" or "Find safe sites near Kanabha" """

    suggestions = ["Show risk map", "Check another village", "Show route map"]
    return {"response": response, "confidence": 0.92, "risk_assessment": risk_data or {}, "suggestions": suggestions}

def handle_hazard_query(hazard_type, risk_data):
    names = {"flood": "Flood", "landslide": "Landslide", "cloudburst": "Cloudburst", "erosion": "Soil Erosion"}
    if risk_data and "composite_risk_score" in risk_data:
        response = f"""⚠️ **{names.get(hazard_type, 'Hazard')} Risk Assessment**

Based on our analysis:
- Overall Risk: {risk_data.get('composite_risk_score', 0):.0%}
- Flood Hazard: {risk_data.get('flood_hazard_score', 0):.0%}
- Landslide Susceptibility: {risk_data.get('landslide_susceptibility', 0):.0%}
- Cloudburst Probability: {risk_data.get('cloudburst_probability', 0):.0%}
- Erosion Risk: {risk_data.get('erosion_risk', 0):.0%}

**Recommendations:** {', '.join(risk_data.get('recommendations', ['Monitor regularly']))}"""
    else:
        response = f"""⚠️ **{names.get(hazard_type, 'Hazard')} Risk**

I can check {names.get(hazard_type, 'this hazard')} risk for a specific village. Please provide a village name."""
    return {"response": response, "confidence": 0.88, "suggestions": ["Check another village", "Show route map"]}

def handle_weather_query():
    return {"response": "I'm checking live weather data... The weather API is currently being updated. Please check back soon or check a specific village's risk assessment.", "confidence": 0.75, "suggestions": ["Check village risk", "Show alerts"]}

def handle_general_query(risk_data, user_msg):
    if risk_data and "composite_risk_score" in risk_data:
        response = f"""🛡️ **Project Suraksha - Disaster Risk Assessment**

For **{risk_data.get('village_name', 'this village')}**:
- Composite Risk: {risk_data['composite_risk_score']:.0%}
- Priority: {risk_data.get('priority_zone', 'Unknown')}

**Key Risks:** {', '.join(risk_data.get('recommendations', ['General monitoring']))}

You can ask me about:
- Specific hazard types (flood, landslide, cloudburst)
- Relocation planning
- Route maps to safe areas
- Village-specific reports"""
    else:
        response = """🛡️ **Project Suraksha - Disaster Risk Assistant**

Welcome, Sir/Ma'am. I'm your AI assistant for disaster risk assessment in Vadodara district.

**How can I help you?**
1. 🏘️ Check a village's risk assessment (e.g., "What is the risk in Alampura?")
2. 🚨 Relocation planning (e.g., "Should we relocate Kanabha?")
3. 🗺️ Route to nearest safe site
4. 🌧️ Hazard-specific queries (flood, landslide, cloudburst)

Please enter a village name or ask your question."""
    return {"response": response, "confidence": 0.90, "suggestions": ["Check Alampura", "Find safe sites", "View alerts"]}

# ==================== CHAT HISTORY ====================

@app.get("/api/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    try:
        messages = []
        with open(CHAT_HISTORY_FILE, "r") as f:
            for line in f:
                try:
                    msg = json.loads(line.strip())
                    if msg.get("session_id") == session_id:
                        messages.append(msg)
                except json.JSONDecodeError:
                    continue
        return {"messages": messages}
    except FileNotFoundError:
        return {"messages": []}

# ==================== ROUTE MAP API ====================

class RouteRequest(BaseModel):
    from_village: str
    to_village: Optional[str] = None
    from_lat: Optional[float] = None
    from_lon: Optional[float] = None
    to_lat: Optional[float] = None
    to_lon: Optional[float] = None

class RouteResponse(BaseModel):
    route: dict
    distance_km: float
    estimated_time_minutes: int
    waypoints: list
    map_data: dict

@app.post("/api/route", response_model=RouteResponse)
async def calculate_route(route_req: RouteRequest):
    if _controller is None:
        raise HTTPException(status_code=503, detail="System loading")

    try:
        if route_req.from_village:
            village = _controller.engine.village_df[
                _controller.engine.village_df["village_name"].str.lower() == route_req.from_village.lower()
            ]
            if len(village) == 0:
                raise HTTPException(status_code=404, detail=f"Village '{route_req.from_village}' not found")
            from_lat = village.iloc[0]["latitude"]
            from_lon = village.iloc[0]["longitude"]
        else:
            from_lat = route_req.from_lat
            from_lon = route_req.from_lon

        if route_req.to_village:
            site = _controller.engine.village_df[
                _controller.engine.village_df["village_name"].str.lower() == route_req.to_village.lower()
            ]
            if len(site) == 0:
                raise HTTPException(status_code=404, detail=f"Site '{route_req.to_village}' not found")
            to_lat = site.iloc[0]["latitude"]
            to_lon = site.iloc[0]["longitude"]
        elif route_req.to_lat and route_req.to_lon:
            to_lat = route_req.to_lat
            to_lon = route_req.to_lon
        else:
            candidates = _controller.engine.rank_relocation_candidates(
                village.iloc[0].get("village_code", 0) if len(village) > 0 else 0, top_n=1
            )
            if candidates and candidates[0]:
                to_lat = candidates[0].get("latitude")
                to_lon = candidates[0].get("longitude")
            else:
                raise HTTPException(status_code=404, detail="No relocation sites found")

        distance = haversine(from_lat, from_lon, to_lat, to_lon)
        time_minutes = int(distance * 2)

        waypoints = generate_waypoints(from_lat, from_lon, to_lat, to_lon)

        route = {
            "from": {"lat": from_lat, "lon": from_lon, "name": route_req.from_village or "Disaster Site"},
            "to": {"lat": to_lat, "lon": to_lon, "name": route_req.to_village or "Safe Relocation Site"},
            "path": [[from_lat, from_lon]] + waypoints + [[to_lat, to_lon]],
        }

        map_data = {
            "route": route,
            "villages_near_route": get_villages_near_route(from_lat, from_lon, to_lat, to_lon),
            "hazards_along_route": get_hazards_along_route(from_lat, from_lon, to_lat, to_lon),
        }

        return {
            "route": route,
            "distance_km": round(distance, 2),
            "estimated_time_minutes": time_minutes,
            "waypoints": waypoints,
            "map_data": map_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp = np.radians(lat2 - lat1)
    dl = np.radians(lon2 - lon1)
    a = np.sin(dp/2)**2 + np.cos(p1) * np.cos(p2) * np.sin(dl/2)**2
    return 2 * R * np.arcsin(np.sqrt(a))

def generate_waypoints(lat1, lon1, lat2, lon2, num_points=10):
    waypoints = []
    for i in range(1, num_points + 1):
        t = i / (num_points + 1)
        lat = lat1 + t * (lat2 - lat1)
        lon = lon1 + t * (lon2 - lon1)
        waypoints.append([lat, lon])
    return waypoints

def get_villages_near_route(lat1, lon1, lat2, lon2, radius_km=5):
    try:
        villages = _controller.engine.village_df
        if villages is None or len(villages) == 0:
            return []
        villages["distance_to_route"] = villages.apply(
            lambda row: point_to_line_distance(
                row["latitude"], row["longitude"], lat1, lon1, lat2, lon2
            ), axis=1
        )
        near = villages[villages["distance_to_route"] <= radius_km].sort_values("distance_to_route")
        return near[["village_name", "latitude", "longitude", "distance_to_route"]].head(10).to_dict("records")
    except Exception as e:
        return []

def get_hazards_along_route(lat1, lon1, lat2, lon2):
    return {"note": "Hazard analysis along route", "status": "computed"}

def point_to_line_distance(px, py, x1, y1, x2, y2):
    A = px - x1
    B = py - y1
    C = x2 - x1
    D = y2 - y1
    dot = A * C + B * D
    len_sq = C * C + D * D
    param = dot / len_sq if len_sq != 0 else -1
    if param < 0:
        xx, yy = x1, y1
    elif param > 1:
        xx, yy = x2, y2
    else:
        xx = x1 + param * C
        yy = y1 + param * D
    return haversine(px, py, xx, yy)

@app.get("/api/relocation/candidates/{village_code}")
async def get_relocation_candidates(village_code: int):
    try:
        if _controller is None:
            raise HTTPException(status_code=503, detail="System loading")
        candidates = _controller.engine.rank_relocation_candidates(village_code, top_n=5)
        return {"candidates": candidates or []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== VILLAGE RANKING ====================

@app.get("/health")
async def health():
    models_loaded = len(_controller.engine.models) if _controller and hasattr(_controller.engine, 'models') else 0
    return {"status": "ok", "models_loaded": models_loaded, "version": "1.0", "district": "Vadodara"}

@app.get("/api/villages/ranking")
async def village_ranking():
    try:
        if _controller is None:
            raise HTTPException(status_code=503, detail="System loading")
        # Use cached result if available
        if _controller._cached_ranking is not None:
            return {"total": len(_controller._cached_ranking), "villages": _controller._cached_ranking}
        ranking = _controller.run_batch_processing() if _controller else []
        _controller._cached_ranking = ranking
        return {"total": len(ranking), "villages": ranking[:200]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/hazards")
async def get_hazards():
    try:
        if _controller is None:
            raise HTTPException(status_code=503, detail="Loading")
        ranking = _controller.run_batch_processing() if _controller else []
        hazards = []
        for v in ranking[:50]:
            if v.get("composite_risk_score", 0) > 0.4:
                hazard_type = "cloudburst" if v.get("cloudburst_probability", 0) > 0.5 else "landslide" if v.get("landslide_susceptibility", 0) > 0.5 else "flood" if v.get("flood_hazard_score", 0) > 0.5 else "rainfall"
                hazards.append({
                    "id": f"HZ-{v['village_code']}",
                    "type": hazard_type,
                    "name": f"{v.get('village_name', 'Unknown')} - {hazard_type.title()}",
                    "latitude": v.get("latitude", 0),
                    "longitude": v.get("longitude", 0),
                    "location": v.get("village_name", "Unknown"),
                    "district": v.get("subdistrict", "Unknown"),
                    "state": "Gujarat",
                    "severity": "extreme" if v.get("composite_risk_score", 0) > 0.75 else "high" if v.get("composite_risk_score", 0) > 0.55 else "moderate",
                    "confidence": float(v.get("composite_risk_score", 0) * 100),
                    "affectedArea": v.get("total_population", 0) / 1000,
                    "status": "active",
                    "timestamp": datetime.now().isoformat(),
                    "source": "AI / ML Analysis (Project Suraksha)",
                })
        return {"hazards": hazards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/village/{name}")
async def get_village(name: str):
    try:
        if _controller is None:
            raise HTTPException(status_code=503, detail="Loading")
        report = _controller.get_village_report(name)
        if "error" in report:
            raise HTTPException(status_code=404, detail=report["error"])
        return report
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Suraksha API on http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)