"""
Project Suraksha — Unified Integration Layer
Combines all trained models into one prediction pipeline.
"""
import os, json, joblib, numpy as np, pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")


class SurakshaEngine:
    """
    Unified inference engine for all Project Suraksha models.
    """

    def __init__(self, model_dir=MODEL_DIR):
        self.model_dir = model_dir
        self.models = {}
        self._load_models()
        self._load_village_data()

    def _load_models(self):
        """Load all trained Keras models with their preprocessors."""
        for prefix in [
            "flood_hazard_model", "flood_damage_model",
            "erosion_risk_model", "cloudburst_risk_model",
            "landslide_risk_model", "overall_risk_model",
            "priority_zonation_model", "relocation_priority_model",
            "relocation_suitability_model", "confidence_explanation_model",
        ]:
            keras_path = os.path.join(self.model_dir, f"{prefix}.keras")
            prep_path = os.path.join(self.model_dir, f"{prefix}_preprocessor.joblib")
            feat_path = os.path.join(self.model_dir, f"{prefix}_features.joblib")
            if os.path.exists(keras_path) and os.path.exists(prep_path):
                import tensorflow as tf
                from tensorflow import keras
                self.models[prefix] = {
                    "model": keras.models.load_model(keras_path),
                    "preprocessor": joblib.load(prep_path),
                    "feature_cols": joblib.load(feat_path),
                }
            else:
                self.models[prefix] = None

        # NLP model has TextVectorization built-in, no separate preprocessor
        nlp_path = os.path.join(self.model_dir, "nlp_intent_model.keras")
        if os.path.exists(nlp_path):
            import tensorflow as tf
            from tensorflow import keras
            self.models["nlp_intent_model"] = {
                "model": keras.models.load_model(nlp_path),
                "preprocessor": None,
                "feature_cols": None,
                "label_encoder": joblib.load(os.path.join(self.model_dir, "nlp_intent_model_label_encoder.joblib")),
            }

    def _load_village_data(self):
        """Load village data for lookups."""
        self.village_df = pd.read_csv(os.path.join(DATA_DIR, "01_flood_training_ready.csv"))

    def _prepare_features(self, df, model_key):
        """Apply sklearn preprocessor for a specific model, filling missing values."""
        if model_key not in self.models or self.models[model_key] is None:
            return None
        info = self.models[model_key]
        for col in info["feature_cols"]:
            if col not in df.columns:
                df[col] = 0.0
        X = info["preprocessor"].transform(df[info["feature_cols"]])
        if hasattr(X, "toarray"):
            X = X.toarray()
        return X

    def predict_all_hazards(self, village_features):
        """Run all hazard models. Returns dict with all scores."""
        df = pd.DataFrame([village_features])
        result = {}

        result["flood_hazard_score"] = self._predict_with_model("flood_hazard_model", df)
        if result["flood_hazard_score"] is not None:
            result["flood_hazard_score"] = float(np.clip(result["flood_hazard_score"], 0.0, 1.0))

        result["flood_damage_estimate"] = self._predict_with_model("flood_damage_model", df)

        result["erosion_risk"] = self._predict_with_model("erosion_risk_model", df)
        if result["erosion_risk"] is not None:
            result["erosion_risk"] = float(np.clip(result["erosion_risk"], 0.0, 1.0))

        result["cloudburst_probability"] = self._predict_with_model("cloudburst_risk_model", df)
        if result["cloudburst_probability"] is not None:
            result["cloudburst_probability"] = float(np.clip(result["cloudburst_probability"], 0.0, 1.0))

        result["landslide_susceptibility"] = self._predict_with_model("landslide_risk_model", df)
        if result["landslide_susceptibility"] is not None:
            result["landslide_susceptibility"] = float(np.clip(result["landslide_susceptibility"], 0.0, 1.0))

        # Composite risk
        scores = [
            result["flood_hazard_score"], result["erosion_risk"],
            result["cloudburst_probability"], result["landslide_susceptibility"]
        ]
        weights = [0.30, 0.15, 0.20, 0.35]
        valid = [(s, w) for s, w in zip(scores, weights) if s is not None]
        if valid:
            result["composite_risk_score"] = float(np.clip(
                sum(s * w for s, w in valid) / sum(w for _, w in valid), 0.0, 1.0
            ))
        else:
            result["composite_risk_score"] = None

        composite = result["composite_risk_score"]
        if composite is not None:
            if composite >= 0.8: result["priority_zone"] = "Critical"
            elif composite >= 0.6: result["priority_zone"] = "High"
            elif composite >= 0.4: result["priority_zone"] = "Medium"
            else: result["priority_zone"] = "Low"
        else:
            result["priority_zone"] = "Unknown"

        result["relocation_priority"] = self._predict_with_model("relocation_priority_model", df)

        return result

    def _predict_with_model(self, model_key, df):
        """Predict using a Keras model."""
        if model_key not in self.models or self.models[model_key] is None:
            return None
        X = self._prepare_features(df.copy(), model_key)
        return float(self.models[model_key]["model"].predict(X, verbose=0).flatten()[0])

    def classify_intent(self, text):
        """Classify user query intent. Returns {intent, confidence}."""
        if "nlp_intent_model" not in self.models or self.models["nlp_intent_model"] is None:
            return {"intent": "unknown", "confidence": 0.0}
        import tensorflow as tf
        model_info = self.models["nlp_intent_model"]
        # The model already includes the TextVectorization layer inside it.
        # Pass raw string(s) — model will tokenize internally via its built-in TextVectorization.
        text_input = [text] if isinstance(text, str) else text
        text_2d = np.array(text_input).reshape(-1, 1).astype(object)
        text_tf = tf.convert_to_tensor(text_2d, dtype=tf.string)
        preds = model_info["model"].predict(text_tf, verbose=0)
        idx = int(np.argmax(preds[0]))
        le = model_info.get("label_encoder")
        if le is None:
            le = joblib.load(os.path.join(MODEL_DIR, "nlp_intent_model_label_encoder.joblib"))
        intent = le.inverse_transform([idx])[0]
        confidence = float(preds[0][idx])
        return {"intent": intent, "confidence": confidence}

    def get_village_report(self, village_name):
        """Full risk report for a village."""
        row = self.village_df[self.village_df["village_name"].str.lower() == village_name.lower()]
        if len(row) == 0:
            return {"error": f"Village '{village_name}' not found"}
        features = row.iloc[0].to_dict()
        hazards = self.predict_all_hazards(features)
        # Round all float values to 2 decimal places for clean output
        for k, v in hazards.items():
            if isinstance(v, float):
                hazards[k] = round(v, 2)
        report = {"village_name": village_name}
        report.update(hazards)
        report["human_readable_risk"] = self._get_risk_label(hazards.get("composite_risk_score"))
        report["recommendations"] = self._get_recommendations(hazards)
        return report

    def _get_risk_label(self, score):
        if score is None: return "Unknown"
        if score >= 0.8: return "CRITICAL — Immediate evacuation"
        if score >= 0.6: return "HIGH — Relocation planning"
        if score >= 0.4: return "MEDIUM — Mitigation needed"
        return "LOW — Monitor only"

    def _get_recommendations(self, hazards):
        recs = []
        if hazards.get("flood_hazard_score", 0) and hazards["flood_hazard_score"] > 0.5:
            recs.append("Elevate critical infrastructure above flood level")
        if hazards.get("landslide_susceptibility", 0) and hazards["landslide_susceptibility"] > 0.5:
            recs.append("Install slope stabilization and drainage")
        if hazards.get("cloudburst_probability", 0) and hazards["cloudburst_probability"] > 0.5:
            recs.append("Establish storm drainage and early warning")
        if hazards.get("erosion_risk", 0) and hazards["erosion_risk"] > 0.5:
            recs.append("Soil conservation and reforestation")
        if not recs:
            recs.append("Continue monitoring")
        return recs

    def rank_relocation_candidates(self, village_code, top_n=5):
        """Top N relocation sites for a village with population capacity and distance."""
        candidates = pd.read_csv(os.path.join(DATA_DIR, "06b_relocation_candidates_ready.csv"))
        scored = []
        # Get origin village coordinates for distance calculation
        origin = self.village_df[self.village_df["village_code"] == village_code]
        origin_lat = origin.iloc[0]["latitude"] if len(origin) > 0 else None
        origin_lon = origin.iloc[0]["longitude"] if len(origin) > 0 else None

        for _, site in candidates.iterrows():
            site_dict = site.to_dict()
            suitability = self._predict_with_model("relocation_suitability_model", pd.DataFrame([site_dict]))
            score = float(suitability) if suitability is not None else 0.0
            site_lat = site.get("latitude")
            site_lon = site.get("longitude")
            distance = self._haversine(origin_lat, origin_lon, site_lat, site_lon) if origin_lat and origin_lon else None
            scored.append({
                "site_name": site.get("village_name", "Candidate"),
                "subdistrict": site.get("subdistrict", "Unknown"),
                "suitability_score": round(score, 4),
                "population_capacity": int(site.get("estimated_carrying_capacity_TARGET", 0) or 0),
                "buildable_area_ha": float(site.get("buildable_area_ha_EXTERNAL_TOFILL", 0) or 0),
                "distance_km": round(distance, 2) if distance else None,
                "latitude": site_lat,
                "longitude": site_lon,
            })
        scored.sort(key=lambda x: x["suitability_score"], reverse=True)
        return scored[:top_n]

    def _haversine(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two points in kilometers."""
        if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
            return None
        R = 6371.0
        p1, p2 = np.radians(lat1), np.radians(lat2)
        dp = np.radians(lat2 - lat1)
        dl = np.radians(lon2 - lon1)
        a = np.sin(dp/2)**2 + np.cos(p1) * np.cos(p2) * np.sin(dl/2)**2
        return 2 * R * np.arcsin(np.sqrt(a))

    def get_confidence(self, prediction_dict):
        """Confidence score with explanation."""
        composite = prediction_dict.get("composite_risk_score", 0.5)
        if composite >= 0.8:
            confidence, explanation = 0.92, "High-confidence critical risk."
        elif composite >= 0.6:
            confidence, explanation = 0.85, "High-confidence elevated risk."
        elif composite >= 0.4:
            confidence, explanation = 0.75, "Moderate confidence risk."
        else:
            confidence, explanation = 0.88, "High-confidence low risk."

        risk_factors = []
        for h in ["flood_hazard_score", "landslide_susceptibility", "cloudburst_probability", "erosion_risk"]:
            if prediction_dict.get(h, 0) and prediction_dict[h] > 0.5:
                risk_factors.append(h.replace("_", " ").title())
        if not risk_factors:
            risk_factors = ["No major hazards"]
        return {"confidence_score": confidence, "explanation": explanation, "key_risk_factors": risk_factors}

    def check_live_alert(self, features_dict):
        """Check live alert status."""
        rainfall = features_dict.get("rainfall_24hr_max_mm_EXTERNAL_TOFILL", 0)
        flood_score = features_dict.get("flood_hazard_score", features_dict.get("flood_hazard_score_TARGET", 0))
        if rainfall > 250 or (flood_score and flood_score > 0.8):
            alert, actions = "CRITICAL", ["Immediate evacuation", "Activate shelters", "Deploy rescue"]
        elif rainfall > 150 or (flood_score and flood_score > 0.6):
            alert, actions = "WARNING", ["Prepare evacuation", "Monitor water", "Alert communities"]
        elif rainfall > 100:
            alert, actions = "WATCH", ["Increase monitoring", "Pre-position relief supplies"]
        else:
            alert, actions = "NORMAL", ["Continue monitoring"]
        pop = features_dict.get("total_population", 0)
        return {"alert_level": alert, "recommended_actions": actions,
                "estimated_population_affected": int(pop * (flood_score or 0.1))}

    def run_batch(self, csv_path=None):
        """Process all villages and return risk ranking."""
        if csv_path is None:
            csv_path = os.path.join(DATA_DIR, "01_flood_training_ready.csv")
        df = pd.read_csv(csv_path)
        results = []
        for _, row in df.iterrows():
            hazards = self.predict_all_hazards(row.to_dict())
            result = {"village_name": row.get("village_name"), "subdistrict": row.get("subdistrict")}
            result.update(hazards)
            result["tier"] = self._get_tier(result.get("composite_risk_score"))
            results.append(result)
        results.sort(key=lambda x: x.get("composite_risk_score") or 0, reverse=True)
        return results

    def _get_tier(self, score):
        if score is None: return "Unknown"
        if score >= 0.8: return "TIER 1"
        if score >= 0.6: return "TIER 2"
        if score >= 0.4: return "TIER 3"
        return "TIER 4"
