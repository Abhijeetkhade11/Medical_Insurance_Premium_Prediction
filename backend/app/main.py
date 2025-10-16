from pathlib import Path
from typing import Literal, Optional, List, Dict, Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Resolve paths
THIS_FILE = Path(__file__).resolve()
BACKEND_DIR = THIS_FILE.parents[1]
ROOT_DIR = THIS_FILE.parents[2]
MODEL_PATH = BACKEND_DIR / "models" / "model.joblib"
DATASET_PATH = ROOT_DIR / "insurance.csv"

# Load dataset once
if not DATASET_PATH.exists():
    raise RuntimeError(f"Dataset not found at {DATASET_PATH}")

df = pd.read_csv(DATASET_PATH)

app = FastAPI(title="Medical Insurance Predictor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InsuranceFeatures(BaseModel):
    age: int
    sex: Literal['male', 'female']
    bmi: float
    children: int
    smoker: Literal['yes', 'no']
    region: Literal['northeast', 'northwest', 'southeast', 'southwest']


# Try to load model
model = None
if MODEL_PATH.exists():
    try:
        model = joblib.load(MODEL_PATH)
    except Exception as e:
        print(f"Failed to load model: {e}")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "model_loaded": bool(model), "rows": int(df.shape[0])}


@app.post("/predict")
def predict(payload: InsuranceFeatures) -> Dict[str, float]:
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Please train the model first.")

    X = pd.DataFrame([payload.dict()])
    try:
        pred = float(model.predict(X)[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {e}")
    return {"prediction": pred}


@app.get("/analysis/summary")
def analysis_summary() -> Dict[str, Any]:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=[object]).columns.tolist()

    summary = {
        "numeric": df[numeric_cols].describe().to_dict(),
        "categorical_counts": {col: df[col].value_counts().to_dict() for col in categorical_cols},
        "correlation_with_charges": df[numeric_cols].corr()["charges"].drop("charges").to_dict(),
    }
    return summary


def hist_series(series: pd.Series, bins: int = 20) -> Dict[str, List[float]]:
    counts, bin_edges = np.histogram(series.dropna(), bins=bins)
    centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0
    return {"bin_centers": centers.round(3).tolist(), "counts": counts.tolist()}


@app.get("/analysis/distributions")
def analysis_distributions() -> Dict[str, Any]:
    return {
        "age": hist_series(df["age"], bins=20),
        "bmi": hist_series(df["bmi"], bins=20),
        "charges": hist_series(df["charges"], bins=20),
        "sex_counts": df["sex"].value_counts().to_dict(),
        "smoker_counts": df["smoker"].value_counts().to_dict(),
        "region_counts": df["region"].value_counts().to_dict(),
    }


@app.get("/dataset/sample")
def dataset_sample(limit: int = 10) -> List[Dict[str, Any]]:
    return df.head(limit).to_dict(orient="records")


@app.get("/analysis/age_counts")
def analysis_age_counts() -> Dict[str, int]:
    counts = df["age"].value_counts().sort_index()
    return {str(int(k)): int(v) for k, v in counts.items()}


@app.get("/analysis/grouped")
def analysis_grouped(
    cols: str = Query(..., description="Comma-separated 1 or 2 columns to group by"),
    agg: Literal["mean", "count", "median"] = Query("mean"),
    target: str = Query("charges"),
) -> Dict[str, Any]:
    col_list = [c.strip() for c in cols.split(",") if c.strip()]
    if not (1 <= len(col_list) <= 2):
        raise HTTPException(status_code=400, detail="Provide 1 or 2 columns in 'cols'.")
    for c in col_list:
        if c not in df.columns:
            raise HTTPException(status_code=400, detail=f"Unknown column: {c}")
    if agg != "count" and target not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target}' not found")

    try:
        if len(col_list) == 1:
            c1 = col_list[0]
            if agg == "count":
                s = df.groupby(c1).size().sort_index()
                label = "count"
            else:
                s = df.groupby(c1)[target].agg(agg).sort_index()
                label = f"{agg}({target})"
            return {
                "index": [str(x) for x in s.index.tolist()],
                "values": [float(x) for x in s.values.tolist()],
                "label": label,
            }
        else:
            c1, c2 = col_list
            if agg == "count":
                gp = df.groupby([c1, c2]).size().unstack(fill_value=0)
                label = "count"
            else:
                gp = df.groupby([c1, c2])[target].agg(agg).unstack()
                label = f"{agg}({target})"
            gp = gp.sort_index()
            gp = gp.fillna(0)
            return {
                "index": [str(i) for i in gp.index.tolist()],
                "columns": [str(c) for c in gp.columns.tolist()],
                "data": [[float(v) for v in row] for row in gp.values.tolist()],
                "label": label,
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Grouping failed: {e}")
