"""
Model 6: Relocation Planning & Candidate Site Suitability
Trains on clean/06a_relocation_source_clean.csv and clean/06b_relocation_candidates_clean.csv
Targets: composite_risk_score_FROM_MODEL5 (regression), site_suitability_score_TARGET (regression)
"""
from common_utils import load_csv, get_feature_cols, run_regression_pipeline

SOURCE_FILE = "06a_relocation_source_clean.csv"
SITE_FILE = "06b_relocation_candidates_clean.csv"
SOURCE_TARGET = "composite_risk_score_FROM_MODEL5"
SITE_TARGET = "site_suitability_score_TARGET"
SAVE_SOURCE = "relocation_priority_model"
SAVE_SITE = "relocation_suitability_model"


def main():
    print("=" * 70)
    print("MODEL 6: RELOCATION PLANNING & SITE SUITABILITY")
    print("=" * 70)

    src_df = load_csv(SOURCE_FILE)
    src_feature_cols = get_feature_cols(src_df, [SOURCE_TARGET])
    result_source = run_regression_pipeline(
        src_df, src_feature_cols, SOURCE_TARGET,
        model_name="Model 6: Relocation Priority Score",
        save_prefix=SAVE_SOURCE,
    )

    site_df = load_csv(SITE_FILE)
    site_feature_cols = get_feature_cols(site_df, [SITE_TARGET])
    result_site = run_regression_pipeline(
        site_df, site_feature_cols, SITE_TARGET,
        model_name="Model 6: Relocation Site Suitability",
        save_prefix=SAVE_SITE,
    )
    return [result_source, result_site]


if __name__ == "__main__":
    main()