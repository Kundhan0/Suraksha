"""
Model 2: Soil Erosion Risk
Trains on clean/02_erosion_training_clean.csv
Target: erosion_risk_score_TARGET (0-1)
"""
from common_utils import load_csv, get_feature_cols, run_regression_pipeline

FILE_NAME = "02_erosion_training_clean.csv"
TARGET = "erosion_risk_score_TARGET"
SAVE = "erosion_risk_model"

def main():
    print("=" * 70)
    print("MODEL 2: SOIL EROSION RISK")
    print("=" * 70)
    df = load_csv(FILE_NAME)
    feature_cols = get_feature_cols(df, [TARGET])
    result = run_regression_pipeline(
        df, feature_cols, TARGET,
        model_name="Model 2: Soil Erosion Risk Score",
        save_prefix=SAVE,
    )
    return [result]

if __name__ == "__main__":
    main()