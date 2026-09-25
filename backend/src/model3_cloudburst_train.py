"""
Model 3: Cloudburst Risk
Trains on clean/03_cloudburst_training_clean.csv
Target: cloudburst_exceedance_probability_TARGET (0-1)
"""
from common_utils import load_csv, get_feature_cols, run_regression_pipeline

FILE_NAME = "03_cloudburst_training_clean.csv"
TARGET = "cloudburst_exceedance_probability_TARGET"
SAVE = "cloudburst_risk_model"

def main():
    print("=" * 70)
    print("MODEL 3: CLOUDBURST RISK")
    print("=" * 70)
    df = load_csv(FILE_NAME)
    feature_cols = get_feature_cols(df, [TARGET])
    result = run_regression_pipeline(
        df, feature_cols, TARGET,
        model_name="Model 3: Cloudburst Exceedance Probability",
        save_prefix=SAVE,
    )
    return [result]

if __name__ == "__main__":
    main()