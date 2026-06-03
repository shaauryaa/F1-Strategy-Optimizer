# PITWALL — F1 Strategy Optimizer

**Live demo:** [f1-strategy-optimizer.vercel.app](https://f1-strategy-optimizer.vercel.app)  
**API:** [f1-strategy-optimizer.onrender.com](https://f1-strategy-optimizer.onrender.com/health)

Pit-strategy optimisation built on a lap-time model trained on **real** race data (215k laps, 32 circuits, 2014–2024), judged on its **expected** outcome under safety-car uncertainty via Monte Carlo — not a single deterministic guess.

```
Recommended: SOFT → (L18) SOFT → (L36) MEDIUM
  deterministic 80m 21s · MC expected 82m 2s · risk band p10–p90 ≈ 3.6 min
```

---

## Stack

| Layer | Tech |
|---|---|
| Backend API | FastAPI · uvicorn · deployed on Render |
| ML model | scikit-learn (HistGradientBoosting) · joblib · pandas |
| Data | Ergast CSVs (offline) · FastF1 (optional, real tyre data) |
| Frontend | Next.js 15 · Tailwind CSS · deployed on Vercel |

---

## Running locally

**Prerequisites:** Python 3.10+, Node.js 18+

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Build the dataset (offline, uses bundled Ergast CSVs)
python -m f1opt.data.build_dataset

# 3. Train models
python -m f1opt.model.pace_model
python -m f1opt.model.tyre_model

# 4. Start the FastAPI backend (port 8000)
uvicorn api:app --reload --port 8000

# 5. In a separate terminal, start the Next.js frontend
cd web && npm install && npm run dev   # → http://localhost:3000

# 6. Run the test suite
pytest -q
```

---

## Deploy

### Frontend — Vercel

1. Import the repo into [Vercel](https://vercel.com).
2. Set **Root Directory** to `web/`.
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://<your-render-url>`.
4. Deploy — `web/vercel.json` tells Vercel it's a Next.js project.

### API — Render

1. New Web Service → connect this repo.
2. Render auto-reads `render.yaml` — build command, start command, and health check path are pre-configured.
3. No model files need to be committed; the build step trains the model fresh from the bundled Ergast CSVs.

---

## How it works

```
lap_time = base_pace(circuit, fuel, temp, year)      ← learned from real laps
         + tyre_delta(compound, tyre_age, temp)       ← physical / calibrated
         × track_status_multiplier(green / VSC / SC)  ← correct SC physics
```

- **Base pace** — gradient-boosted model trained on ~215k clean green-flag laps.
  Captures circuit pace, fuel-burn trend (~1.9 s/lap lighter as tank empties),
  and temperature. Race-weekend grouped CV (holds out whole race weekends):
  **MAE ≈ 2.6 s, R² ≈ 0.85**.

- **Tyre layer** — transparent Pirelli-style model: per-compound fresh offset,
  linear wear, and a cliff once the tyre ages out, with temperature scaling.
  Produces the realistic soft-fast-then-cliffs / hard-slow-but-durable crossover.
  The FastF1 pipeline replaces it with wear rates *learned from real per-compound laps*.

- **Strategy search** — enumerates all FIA-legal 1–3 stop strategies, simulates
  each, re-ranks the leaders by **Monte Carlo expected time** over random
  safety-car scenarios, and reports the **undercut/overcut** pace trade for each stop.

---

## Web UI

- **Hero** — recommended strategy, MC time band, stint visualisation.
- **What It Buys You** — seconds saved vs naive one-stop, MC safety-car cost, p10–p90 risk spread.
- **The Road Not Taken** — ranked alternatives with compare toggle and undercut/overcut analysis.
- **Model card** — CV MAE, R², training data provenance.

---

## Repo layout

```
f1opt/
  data/
    build_dataset.py     Ergast CSVs → clean pace dataset (offline)
    fastf1_pipeline.py   FastF1 → dataset with real compound + tyre life (network)
  model/
    features.py          single source of truth for features
    pace_model.py        learned base-pace model + race-weekend CV
    tyre_model.py        physical / calibratable tyre layer
    lap_time.py          composes base + tyre + track status
  strategy/
    conditions.py        SC/VSC physics
    simulator.py         deterministic + Monte Carlo race simulation
    optimizer.py         FIA-legal search + MC re-rank + undercut/overcut
api.py                   FastAPI service — /optimise, /circuits, /health
render.yaml              Render deploy config (build + start commands, health check)
web/                     Next.js 15 frontend
  src/components/
    Hero.tsx
    ThePlan.tsx
    WhatItBuysYou.tsx
    TheRoadNotTaken.tsx
    ConfigDrawer.tsx
  vercel.json            Vercel deploy config
data/raw/                Ergast CSVs (bundled, offline)
models/                  trained artefacts generated at build time (gitignored *.pkl)
```
