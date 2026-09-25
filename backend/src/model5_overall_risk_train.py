"""
Model 5: Multi-Hazard Composite Risk Index & Priority Zonation
Trains on clean/05_overall_risk_training_clean.csv
Targets: composite_risk_score_TARGET (regression), priority_category_TARGET (classification)
"""
from common_utils import (load_csv, get_feature_cols, run_regression_pipeline,
                          run_classification_pipeline)

FILE_NAME = "05_overall_risk_training_clean.csv"
TARGET_REG = "composite_risk_score_TARGET"
TARGET_CLF = "priority_category_TARGET"
LEAKAGE_COLS = ["exposure_score_TARGET", "vulnerability_score_TARGET"]


def main():
    print("=" * 70)
    print("MODEL 5: MULTI-HAZARD COMPOSITE RISK INDEX & ZONATION")
    print("=" * 70)
    df = load_csv(FILE_NAME)

    feature_cols_reg = get_feature_cols(
        df, [TARGET_REG, TARGET_CLF], extra_drop=LEAKAGE_COLS
    )
    result_reg = run_regression_pipeline(
        df, feature_cols_reg, TARGET_REG,
        model_name="Model 5: Composite Risk Score",
        save_prefix="overall_risk_model",
    )

    feature_cols_clf = get_feature_cols(
        df, [TARGET_REG, TARGET_CLF], extra_drop=LEAKAGE_COLS
    )
    result_clf = run_classification_pipeline(
        df, feature_cols_clf, TARGET_CLF,
        model_name="Model 5: Priority Zonation Category",
        save_prefix="priority_zonation_model",
    )
    return [result_reg, result_clf]


if __name__ == "__main__":
    main()