# F1 Strategy Optimizer

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
cd web
npm install
npm run dev           # → http://localhost:3000

# 6. Run the test suite
pytest -q             # should pass 11 tests
```

---

## Deploy

### Frontend — Vercel

1. Import the repo into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `web/`.
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://<your-api-url>`.
4. Deploy — Vercel auto-detects Next.js.

### API — Render or Fly.io

**Render (free tier):**
1. New Web Service → connect this repo.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn api:app --host 0.0.0.0 --port $PORT`
4. The `/health` endpoint confirms the service is live.

**Fly.io:**
```bash
fly launch            # follow prompts, choose Python runtime
fly deploy
```
Set `PORT` to `8080` and use the same start command above.

> The `data/pace_dataset.parquet` and trained model files in `models/` must be
> present at deploy time — commit them (they are not gitignored except the
> parquet) or bundle them in the build step.

---

Pit-strategy optimisation built on a lap-time model trained on **real** race
data, and judged on its **expected** outcome under safety-car uncertainty —
not a single deterministic guess.

```
Recommended: SOFT → (L16) SOFT → (L32) MEDIUM
  deterministic 81.83 min · MC expected 83.73 min · risk band p10–p90 ≈ 4.1 min
```

---

## How it works

The lap time of any lap is composed from two clearly-separated pieces, so
nothing is a black box and the two layers never double-count:

```
lap_time = base_pace(circuit, fuel, temp, year)      ← learned from real laps
         + tyre_delta(compound, tyre_age, temp)       ← physical / calibrated
         × track_status_multiplier(green / VSC / SC)  ← correct SC physics
```

- **Base pace** is a gradient-boosted model trained on ~215k clean green-flag
  laps from the Ergast dataset (2014–2024). It captures circuit pace, the
  fuel-burn trend (cars get ~1.9 s/lap faster as the tank empties — a real,
  measured effect) and temperature.
  Held-out **race-weekend** cross-validation: **MAE ≈ 2.6 s, R² ≈ 0.85**.
  (The split holds out whole race weekends, so the score reflects predicting a
  race the model hasn't seen on a circuit it knows — which is how the optimiser
  is actually used.)

- **Tyre layer** owns all compound and degradation behaviour: a transparent
  Pirelli-style model (per-compound fresh offset, linear wear, and a cliff once
  the tyre ages out), with temperature scaling. It produces the realistic
  soft-fast-then-cliffs / hard-slow-but-durable crossover that makes strategy a
  real decision. Ergast has **no** compound data, so by default this is a
  physical prior; the FastF1 pipeline below replaces it with wear rates
  *learned from real per-compound laps*.

- **Strategy search** enumerates the realistic space (1–3 stops, every compound
  sequence, a grid of pit laps), simulates each through the shared lap-time
  model, enforces the real **FIA two-compound rule**, then re-ranks the leaders
  by **Monte-Carlo expected time** over random safety-car scenarios so the
  recommendation is robust, not lucky. It also reports the **undercut/overcut**
  pace trade around each stop.

## The data story (read this)

Ergast gives real lap times but **not** tyre compound, tyre age or track
temperature — which is exactly why the previous version randomised them. This
rebuild is honest about that line:

- **Learned from real data:** circuit base pace, fuel burn, temperature.
- **Physical prior (calibratable):** compound degradation.

To make degradation *learned* too, run the FastF1 pipeline (2018+ has real
`Compound` and `TyreLife`). It needs network access and isn't runnable in every
sandbox, but everything downstream consumes its output unchanged.

## Quickstart

```bash
pip install -r requirements.txt

# 1. Build the dataset from the bundled Ergast dump (offline, fast)
python -m f1opt.data.build_dataset

# 2. Train + honestly evaluate the base pace model, build the tyre model
python -m f1opt.model.pace_model
python -m f1opt.model.tyre_model

# 3. Run the app
streamlit run app.py

# 4. (optional, recommended) upgrade to REAL tyre data via FastF1 — run locally
python -m f1opt.data.fastf1_pipeline 2018 2024 --cache .fastf1_cache
python -m f1opt.model.pace_model      # retrain on the richer data
python -m f1opt.model.tyre_model      # now LEARNS per-compound wear

# tests
pytest -q
```

## Layout

```
f1opt/
  paths.py             central, repo-relative paths (data/raw in, models/ out)
  data/
    build_dataset.py     real Ergast laps -> clean dataset (infers stints) [offline]
    fastf1_pipeline.py   FastF1 -> dataset w/ real compound, tyre life, temp [network]
  model/
    features.py          single source of truth for features (base/tyre split)
    pace_model.py        learned base-pace model + race-weekend CV
    tyre_model.py        physical / calibratable compound-degradation layer
    lap_time.py          composes base + tyre + conditions (the one lap-time fn)
  strategy/
    conditions.py        correct safety-car physics (laps slower, pit loss cheaper)
    simulator.py         deterministic + Monte-Carlo race simulation
    optimizer.py         FIA-legal search + MC re-rank + undercut/overcut
app.py                   Streamlit UI
tests/test_engine.py     locks in the fixes

data/raw/                your existing Ergast CSVs (inputs)
data/pace_dataset.parquet  generated dataset (gitignored)
models/                  trained artifacts: pace_model.pkl, tyre_model.json, +json
```

## Web UI

The Next.js frontend (`web/`) presents the optimizer output across several sections:

- **Hero** — recommended strategy with Monte-Carlo time band and stint visualisation.
- **What It Buys You** — cumulative time comparison vs a naive baseline.
- **The Road Not Taken** — ranked alternative strategies with three interactive features:
  - **Compare toggle** on each row: select any two strategies to open a side-by-side panel showing compound sequence, per-stint breakdown (compound, start lap, end lap, lap count), total time, stop count, and delta vs optimal. Selecting a third strategy automatically drops the oldest.
  - **Undercut check** — per-stop undercut/overcut delta coloured green (saves time) or red (costs time); neutral grey for a zero delta.
  - The recommended strategy is labelled *chosen* in the ranked list and *Recommended* in the comparison panel.
- **Model card** — CV MAE, R², training data provenance.

## What's intentionally *not* modelled

- **Track position / traffic.** This is a single-car pace model, so "undercut"
  here is the pure pace delta of pitting a lap earlier, not the position you'd
  gain by jumping a rival in traffic. Multi-car modelling is the natural next step.
- **Weather changes mid-race** (inters/wets switchovers).
- **Driver-specific pace** (available from FastF1 — a good future feature).

## Changes from the previous version

The previous version trained on `np.random` synthetic rows fitted to a hardcoded
formula, evaluated with a leaky random split, engineered features three
different (and inconsistent) ways so the optimiser and simulator disagreed, had
backwards and unused safety-car code, never enforced the two-compound rule, and
compared against a strawman baseline. This rebuild trains on real laps with a
grouped split, uses one feature definition everywhere, fixes the safety-car
physics, enforces the FIA rule, adds Monte-Carlo robustness and undercut
analysis, and ships tests.
