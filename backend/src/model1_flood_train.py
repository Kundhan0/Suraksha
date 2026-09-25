"""
Model 1: Flood Hazard & Infrastructure Damage
Trains on clean/01_flood_training_clean.csv
Targets: flood_hazard_score (0-1), infrastructure_damage_score (0-1)
"""
from common_utils import load_csv, get_feature_cols, run_regression_pipeline

FILE_NAME = "01_flood_training_clean.csv"
TARGET_HAZARD = "flood_hazard_score"
TARGET_DAMAGE = "infrastructure_damage_score"
SAVE_HAZARD = "flood_hazard_model"
SAVE_DAMAGE = "flood_damage_model"

def main():
    print("=" * 70)
    print("MODEL 1: FLOOD HAZARD & INFRASTRUCTURE DAMAGE")
    print("=" * 70)
    df = load_csv(FILE_NAME)

    feature_cols = get_feature_cols(df, [TARGET_HAZARD, TARGET_DAMAGE],
                                     extra_drop=["flood_damage_estimate_TARGET"])
    result_hazard = run_regression_pipeline(
        df, feature_cols, TARGET_HAZARD,
        model_name="Model 1: Flood Hazard Index",
        save_prefix=SAVE_HAZARD,
    )
    result_damage = run_regression_pipeline(
        df, feature_cols, TARGET_DAMAGE,
        model_name="Model 1: Infrastructure Damage",
        save_prefix=SAVE_DAMAGE,
    )
    return [result_hazard, result_damage]

if __name__ == "__main__":
    main()