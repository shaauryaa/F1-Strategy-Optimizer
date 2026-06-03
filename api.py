"""
FastAPI service exposing the strategy engine.

Thin layer over f1opt/: validates inputs, calls optimise(), serialises the
result (including lap-by-lap pace curves for the frontend chart). The engine is
unchanged - this just makes it callable over HTTP so any frontend can use it.
"""
from __future__ import annotations

import json
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from f1opt.paths import CIRCUITS, MODEL_CARD
from f1opt.model.lap_time import LapTimeModel
from f1opt.strategy.simulator import Strategy, simulate
from f1opt.strategy.optimizer import optimise

app = FastAPI(title="F1 Strategy Optimizer API", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])


@lru_cache(maxsize=1)
def engine() -> LapTimeModel:
    return LapTimeModel()


@lru_cache(maxsize=1)
def circuits() -> dict:
    return json.load(open(CIRCUITS)) if CIRCUITS.exists() else {}


class OptimiseRequest(BaseModel):
    circuit: str
    year: int = Field(2024, ge=2014, le=2024)
    laps: int = Field(ge=30, le=78)
    temp: float = Field(30.0, ge=15, le=55)
    start_compound: str | None = None
    max_stops: int = Field(2, ge=1, le=3)
    sc_lap: int = 0
    vsc_lap: int = 0


@app.get("/health")
def health():
    return {"status": "ok", "circuits": len(circuits())}


@app.get("/circuits")
def list_circuits():
    return [{"slug": k, **v} for k, v in circuits().items()]


@app.get("/model-card")
def model_card():
    return json.load(open(MODEL_CARD)) if MODEL_CARD.exists() else {}


@app.post("/optimise")
def run_optimise(req: OptimiseRequest):
    if req.circuit not in circuits():
        raise HTTPException(404, f"Unknown circuit '{req.circuit}'")
    ltm = engine()
    status: dict[int, str] = {}
    if req.sc_lap:
        for l in range(req.sc_lap, min(req.laps, req.sc_lap + 4)):
            status[l] = "SC"
    if req.vsc_lap:
        for l in range(req.vsc_lap, min(req.laps, req.vsc_lap + 2)):
            status.setdefault(l, "VSC")

    res = optimise(req.circuit, req.year, req.laps, temp=req.temp,
                   start_compound=req.start_compound, max_stops=req.max_stops,
                   status_by_lap=status or None, ltm=ltm)
    best = res["best"]
    s = best.strategy

    # Lap-by-lap pace curves: recommended vs a naive one-stop baseline.
    rec_cum = simulate(s, req.circuit, req.year, req.laps, req.temp, status or None, ltm).cumulative
    naive = Strategy("MEDIUM", [(req.laps // 2, "HARD")])
    base_cum = simulate(naive, req.circuit, req.year, req.laps, req.temp, status or None, ltm).cumulative
    rec_lap = np.diff(rec_cum, prepend=0.0)
    base_lap = np.diff(base_cum, prepend=0.0)

    def cand(c):
        seq = [c.strategy.start_compound] + [comp for _, comp in c.strategy.pits]
        return {"sequence": seq,
                "pits": [{"lap": l, "compound": comp} for l, comp in c.strategy.pits],
                "total_s": round(c.time, 1),
                "delta_s": round(c.time - best.time, 1)}

    return {
        "circuit": req.circuit, "circuit_name": circuits()[req.circuit]["name"],
        "year": req.year, "laps": req.laps, "temp": req.temp,
        "status": {str(k): v for k, v in status.items()},
        "recommended": {
            "start_compound": s.start_compound,
            "pits": [{"lap": l, "compound": comp} for l, comp in s.pits],
            "stints": [{"compound": c, "start": a, "end": b, "laps": b - a + 1}
                       for c, a, b in s.stints(req.laps)],
            "stops": len(s.pits),
            "total_s": round(best.time, 1),
            "total_min": round(best.time / 60, 2),
            "mc": {k: round(v, 1) for k, v in best.mc.items()},
        },
        "pace_curve": {
            "laps": list(range(1, req.laps + 1)),
            "recommended_lap": [round(x, 2) for x in rec_lap],
            "baseline_lap": [round(x, 2) for x in base_lap],
            "recommended_cum": [round(x, 1) for x in rec_cum],
            "baseline_cum": [round(x, 1) for x in base_cum],
        },
        "alternatives": [cand(c) for c in res["alternatives"][:5]],
        "undercut": res["undercut"],
        "model_card": model_card(),
    }
