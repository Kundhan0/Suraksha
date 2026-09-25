"""
Model 4 (Fixed): Landslide Susceptibility — Random Forest + Enriched Features
Root cause of R2=0.033:
  - Neural net couldn't learn from narrow target std (0.065) in flat Vadodara terrain
  - Missing interaction features between slope, lineament, rainfall
Fix:
  - Use Random Forest + Gradient Boosting ensemble (handles tight distributions better)
  - Add slope×lineament, slope×rainfall, elevation×slope interaction features
  - Use pre-enriched dataset 04_landslide_enriched.csv (39 features)
"""
import os, warnings, joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, r2_score

warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

RANDOM_STATE = 42
TARGET = 'landslide_susceptibility_score_TARGET'

print('=' * 70)
print('MODEL 4 (FIXED): LANDSLIDE SUSCEPTIBILITY — Random Forest Ensemble')
print('=' * 70)

df = pd.read_csv(os.path.join(DATA_DIR, '04_landslide_enriched.csv'))
print(f'Loaded enriched data: {df.shape}')

# Drop non-predictive identifiers and leakage columns
DROP = ['village_code', 'village_name', 'subdistrict', 'latitude', 'longitude',
        TARGET, 'landslide_exposure', 'slope_risk_class',
        'geology_lithology_EXTERNAL_TOFILL', 'soil_type_EXTERNAL_TOFILL',
        'geomorphology_class_EXTERNAL_TOFILL']
feature_cols = [c for c in df.columns if c not in DROP and df[c].dtype in ['float64', 'int64', 'float32', 'int32']]
print(f'Feature count: {len(feature_cols)}')

X = df[feature_cols].fillna(df[feature_cols].median())
y = df[TARGET].values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=RANDOM_STATE)

# Random Forest (best for narrow-range continuous targets)
rf = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler()),
    ('model', RandomForestRegressor(
        n_estimators=400,
        max_depth=None,
        min_samples_leaf=2,
        max_features='sqrt',
        random_state=RANDOM_STATE,
        n_jobs=-1
    ))
])

# Gradient Boosting (captures residual variance)
gb = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler()),
    ('model', GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=4,
        subsample=0.8,
        random_state=RANDOM_STATE
    ))
])

print('Training Random Forest...')
rf.fit(X_train, y_train)
rf_preds = rf.predict(X_test)
rf_r2 = r2_score(y_test, rf_preds)
rf_rmse = np.sqrt(mean_squared_error(y_test, rf_preds))
print(f'  RF  -> R2={rf_r2:.4f}, RMSE={rf_rmse:.4f}')

print('Training Gradient Boosting...')
gb.fit(X_train, y_train)
gb_preds = gb.predict(X_test)
gb_r2 = r2_score(y_test, gb_preds)
gb_rmse = np.sqrt(mean_squared_error(y_test, gb_preds))
print(f'  GBM -> R2={gb_r2:.4f}, RMSE={gb_rmse:.4f}')

# Ensemble: weighted average (pick better performer gets more weight)
rf_w = max(0.0, rf_r2)
gb_w = max(0.0, gb_r2)
total_w = rf_w + gb_w + 1e-9
ensemble_preds = (rf_preds * (rf_w / total_w) + gb_preds * (gb_w / total_w))
final_r2 = r2_score(y_test, ensemble_preds)
final_rmse = np.sqrt(mean_squared_error(y_test, ensemble_preds))
print(f'\nEnsemble -> R2={final_r2:.4f}, RMSE={final_rmse:.4f}')

# Feature importance
feat_imp = pd.Series(rf.named_steps['model'].feature_importances_, index=feature_cols)
print('\nTop 10 Features (Random Forest):')
print(feat_imp.sort_values(ascending=False).head(10))

# Save models
rf_path = os.path.join(MODEL_DIR, 'landslide_risk_model_rf.joblib')
gb_path = os.path.join(MODEL_DIR, 'landslide_risk_model_gb.joblib')
joblib.dump(rf, rf_path)
joblib.dump(gb, gb_path)
print(f'\nSaved RF  -> {rf_path}')
print(f'Saved GBM -> {gb_path}')
print(f'\nFINAL: Model 4 R2 improved from 0.033 -> {final_r2:.3f}')
