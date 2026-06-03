"""
Central path config - repo-relative, so commands work from any working dir.
Matches the existing repo layout: raw inputs in data/raw, trained artifacts
in models/.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

RAW_DIR = ROOT / "data" / "raw"
DATASET = ROOT / "data" / "pace_dataset.parquet"

MODELS_DIR = ROOT / "models"
PACE_MODEL = MODELS_DIR / "pace_model.pkl"
TYRE_MODEL = MODELS_DIR / "tyre_model.json"
MODEL_CARD = MODELS_DIR / "model_card.json"
CIRCUITS = MODELS_DIR / "circuits.json"

FASTF1_CACHE = ROOT / ".fastf1_cache"

MODELS_DIR.mkdir(exist_ok=True)
