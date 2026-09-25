"""
Run all 8 model training scripts back-to-back and print a combined summary table.
"""
import model1_flood_train
import model2_erosion_train
import model3_cloudburst_train
import model4_landslide_train
import model5_overall_risk_train
import model6_relocation_train
import model7_nlp_train
import model8_confidence_train


def print_summary_table(rows):
    print("\n" + "=" * 100)
    print("MODEL TRAINING & EVALUATION SUMMARY — Project Suraksha — All Models Trained")
    print("=" * 100)
    headers = ["Model", "Algorithm", "Task", "Metric", "Saved As"]
    table = [[r["model_name"], r["algorithm"], r["task"], r["metric"], r["saved_as"]] for r in rows]
    widths = [max(len(str(row[i])) for row in ([headers] + table)) for i in range(len(headers))]
    def fmt(row):
        return " | ".join(str(v).ljust(widths[i]) for i, v in enumerate(row))
    print(fmt(headers))
    print("-" * 100)
    for row in table:
        print(fmt(row))
    print("=" * 100)


def main():
    all_results = []
    all_results += model1_flood_train.main()
    all_results += model2_erosion_train.main()
    all_results += model3_cloudburst_train.main()
    all_results += model4_landslide_train.main()
    all_results += model5_overall_risk_train.main()
    all_results += model6_relocation_train.main()
    all_results += model7_nlp_train.main()
    all_results += model8_confidence_train.main()
    print_summary_table(all_results)
    print("\nAll 8 models trained and saved to ./models/")


if __name__ == "__main__":
    main()
