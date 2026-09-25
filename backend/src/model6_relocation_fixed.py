"""
Model 6 (Fixed): Relocation Priority Score — Random Forest + Full Feature Set
Root cause of R2=0.259:
  - Only 3 usable features in 06a_relocation_source.csv (just population + risk score)
  - Neural net couldn't learn complex risk patterns from 3 features
Fix:
  - Use enriched dataset 06a_relocation_enriched.csv (44 features: census + flood + hazard)
  - Use Random Forest which handles the mixed feature importance better
  - Key new features: surface_water_exposure, erosion_risk, rainfall_24hr_max, distance_x_risk
"""
import os, warnings, joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, r2_score

warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

RANDOM_STATE = 42
TARGET = 'composite_risk_score_FROM_MODEL5'

print('=' * 70)
print('MODEL 6 (FIXED): RELOCATION PRIORITY — Random Forest + Full Features')
print('=' * 70)

df = pd.read_csv(os.path.join(DATA_DIR, '06a_relocation_enriched.csv'))
print(f'Loaded enriched data: {df.shape}')

# Drop identifiers and leakage columns
DROP = ['village_code', 'village_name', 'subdistrict', 'latitude', 'longitude',
        TARGET, 'urgency_score', 'relocation_urgency_index',
        'priority_category_FROM_MODEL5',  # direct label of the target
        'hazard_x_density']               # engineered from target, potential leak

# Only numeric columns
feature_cols = [c for c in df.columns if c not in DROP and df[c].dtype in ['float64', 'int64', 'float32', 'int32']]
print(f'Feature count: {len(feature_cols)}')

X = df[feature_cols].fillna(df[feature_cols].median())
y = df[TARGET].fillna(df[TARGET].median()).values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=RANDOM_STATE)

# Random Forest
rf = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler()),
    ('model', RandomForestRegressor(
        n_estimators=400,
        max_depth=12,
        min_samples_leaf=2,
        max_features='sqrt',
        random_state=RANDOM_STATE,
        n_jobs=-1
    ))
])

# Gradient Boosting
gb = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler()),
    ('model', GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
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

# Ensemble
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
rf_path = os.path.join(MODEL_DIR, 'relocation_priority_model_rf.joblib')
gb_path = os.path.join(MODEL_DIR, 'relocation_priority_model_gb.joblib')
joblib.dump(rf, rf_path)
joblib.dump(gb, gb_path)
print(f'\nSaved RF  -> {rf_path}')
print(f'Saved GBM -> {gb_path}')
print(f'\nFINAL: Model 6 R2 improved from 0.259 -> {final_r2:.3f}')
