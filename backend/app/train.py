from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

THIS_FILE = Path(__file__).resolve()
BACKEND_DIR = THIS_FILE.parents[1]
ROOT_DIR = THIS_FILE.parents[2]
MODEL_DIR = BACKEND_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

DATASET_PATH = ROOT_DIR / "insurance.csv"
MODEL_PATH = MODEL_DIR / "model.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"

assert DATASET_PATH.exists(), f"Dataset not found at {DATASET_PATH}"

df = pd.read_csv(DATASET_PATH)

target = "charges"
features = [c for c in df.columns if c != target]

X = df[features]
y = df[target]

numeric_features = X.select_dtypes(include=[np.number]).columns.tolist()
categorical_features = X.select_dtypes(exclude=[np.number]).columns.tolist()

preprocess = ColumnTransformer(
    transformers=[
        ("num", Pipeline(steps=[("scaler", StandardScaler())]), numeric_features),
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
    ]
)

model = GradientBoostingRegressor(random_state=42)

pipe = Pipeline(steps=[("preprocess", preprocess), ("model", model)])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

pipe.fit(X_train, y_train)

preds = pipe.predict(X_test)
mae = float(mean_absolute_error(y_test, preds))
r2 = float(r2_score(y_test, preds))

joblib.dump(pipe, MODEL_PATH)

with open(METRICS_PATH, "w", encoding="utf-8") as f:
    json.dump({"mae": mae, "r2": r2, "features": features}, f, indent=2)

print(f"Saved model to {MODEL_PATH}")
print(f"MAE: {mae:.2f} | R2: {r2:.3f}")
