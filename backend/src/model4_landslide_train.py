"""
Model 4: Landslide Risk
Trains on clean/04_landslide_training_clean.csv
Target: landslide_susceptibility_score_TARGET (0-1)
"""
from common_utils import load_csv, get_feature_cols, run_regression_pipeline

FILE_NAME = "04_landslide_training_clean.csv"
TARGET = "landslide_susceptibility_score_TARGET"
SAVE = "landslide_risk_model"

def main():
    print("=" * 70)
    print("MODEL 4: LANDSLIDE RISK")
    print("=" * 70)
    df = load_csv(FILE_NAME)
    feature_cols = get_feature_cols(df, [TARGET])
    result = run_regression_pipeline(
        df, feature_cols, TARGET,
        model_name="Model 4: Landslide Susceptibility Score",
        save_prefix=SAVE,
    )
    return [result]

if __name__ == "__main__":
    main()