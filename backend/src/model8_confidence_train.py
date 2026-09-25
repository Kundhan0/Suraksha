"""
Model 8: Confidence & Explanation Engine
Trains on clean/05_overall_risk_training_clean.csv
Target: confidence_score (continuous, derived from risk score and hazard diversity)
"""
import numpy as np
from common_utils import (
    load_csv, get_feature_cols, run_regression_pipeline,
)

FILE_NAME = "05_overall_risk_training_clean.csv"
TARGET = "confidence_score"
SAVE = "confidence_explanation_model"


def main():
    print("=" * 70)
    print("MODEL 8: CONFIDENCE & EXPLANATION ENGINE")
    print("=" * 70)
    df = load_csv(FILE_NAME)

    # Confidence is derived from risk score and hazard diversity
    # More variance in risk scores means more meaningful confidence differences
    df["confidence_score"] = (
        0.90
        - 0.30 * df["composite_risk_score_TARGET"]
        + 0.20 * (1.0 - df["hazard_diversity"])
        + 0.10 * (df["max_hazard"] - 0.9)
    )
    df["confidence_score"] = df["confidence_score"].clip(0.4, 0.99)

    feature_cols = get_feature_cols(df, [TARGET])
    result = run_regression_pipeline(
        df, feature_cols, TARGET,
        model_name="Model 8: Confidence & Explanation Engine",
        save_prefix=SAVE,
    )
    return [result]


if __name__ == "__main__":
    main()