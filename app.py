"""
F1 Strategy Optimizer - app.

Thin presentation layer over the engine. All race logic lives in f1opt/;
this file only collects inputs, calls optimise(), and renders. It shows the
recommended (safety-car-robust) plan, the deterministic alternatives, the
undercut/overcut trade, a stint timeline, the pace curve, and an honest model
card so the numbers are never a black box.
"""
import json

import numpy as np
import matplotlib.pyplot as plt

import streamlit as st

from f1opt.paths import CIRCUITS, MODEL_CARD
from f1opt.model.lap_time import LapTimeModel
from f1opt.model.tyre_model import TyreModel
from f1opt.strategy.simulator import Strategy, simulate
from f1opt.strategy.optimizer import optimise

st.set_page_config("F1 Strategy Optimizer", layout="wide", page_icon="🏁")

COMPOUND_COLOR = {"SOFT": "#E10600", "MEDIUM": "#FFD200", "HARD": "#EBEBEB"}

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Space+Grotesk:wght@500;700&display=swap');
html, body, [data-testid="stAppViewContainer"] { background:#0A0A0A; color:#fff; }
* { font-family:'Inter',sans-serif; }
.block-container { max-width:1300px; padding-top:2rem; }
h1.title { font-family:'Space Grotesk'; font-size:2.6rem; font-weight:700;
  background:linear-gradient(120deg,#fff,#E10600); -webkit-background-clip:text;
  -webkit-text-fill-color:transparent; margin-bottom:.2rem; }
.sub { color:#8F8F8F; margin-bottom:1.5rem; }
.card { background:#111; border:1px solid rgba(255,255,255,.08); border-radius:16px;
  padding:1.3rem 1.5rem; margin-bottom:1rem; }
.metric { font-family:'Space Grotesk'; font-size:2.1rem; font-weight:700; }
.label { color:#6a6a6a; font-size:.72rem; text-transform:uppercase; letter-spacing:.09em; }
.pill { display:inline-block; padding:.18rem .7rem; border-radius:100px; font-size:.78rem;
  font-weight:700; color:#000; margin-right:.4rem; }
.modelcard { background:#0d0d0d; border:1px solid rgba(225,6,0,.25); border-radius:12px;
  padding:1rem 1.2rem; font-size:.85rem; color:#bbb; }
</style>
""", unsafe_allow_html=True)


@st.cache_resource
def load_engine():
    return LapTimeModel()


@st.cache_data
def load_circuits():
    if CIRCUITS.exists():
        return json.load(open(CIRCUITS))
    return {"silverstone": {"name": "Silverstone", "typical_laps": 52, "median_pace": 90.0}}


circuits = load_circuits()
ltm = load_engine()
tyre = ltm.tyre

st.markdown('<h1 class="title">F1 Strategy Optimizer</h1>', unsafe_allow_html=True)
st.markdown('<div class="sub">Pit strategy on a model trained on real lap data, '
            'judged on its expected outcome under safety-car uncertainty.</div>',
            unsafe_allow_html=True)

with st.sidebar:
    st.markdown("### Race setup")
    slug = st.selectbox("Circuit", list(circuits.keys()),
                        format_func=lambda s: circuits[s]["name"],
                        index=list(circuits.keys()).index("silverstone")
                        if "silverstone" in circuits else 0)
    info = circuits[slug]
    laps = st.slider("Race laps", 30, 78, int(info["typical_laps"]))
    year = st.slider("Season", 2014, 2024, 2024)
    temp = st.slider("Track temperature (°C)", 15, 55, 35)
    start = st.selectbox("Starting compound", ["Auto", "SOFT", "MEDIUM", "HARD"])
    max_stops = st.radio("Max stops", [1, 2, 3], index=1, horizontal=True)
    st.markdown("##### Known safety cars (optional)")
    sc_lap = st.number_input("Safety Car at lap", 0, laps, 0)
    vsc_lap = st.number_input("Virtual SC at lap", 0, laps, 0)
    go = st.button("Optimise strategy", use_container_width=True, type="primary")

status = {}
if sc_lap:
    for l in range(sc_lap, min(laps, sc_lap + 4)):
        status[l] = "SC"
if vsc_lap:
    for l in range(vsc_lap, min(laps, vsc_lap + 2)):
        status.setdefault(l, "VSC")

if go:
    with st.spinner("Searching strategy space + Monte-Carlo ranking…"):
        res = optimise(slug, year, laps, temp=temp,
                       start_compound=None if start == "Auto" else start,
                       max_stops=max_stops, status_by_lap=status or None, ltm=ltm)
    best = res["best"]
    strat = best.strategy

    c1, c2, c3, c4 = st.columns(4)
    for col, lbl, val in [
        (c1, "Recommended time", f"{best.time/60:.2f}<span style='font-size:1rem'> min</span>"),
        (c2, "MC expected", f"{best.mc['mean']/60:.2f}<span style='font-size:1rem'> min</span>"),
        (c3, "Stops", f"{len(strat.pits)}"),
        (c4, "Risk band (p10–p90)", f"{(best.mc['p90']-best.mc['p10']):.0f}<span style='font-size:1rem'> s</span>"),
    ]:
        col.markdown(f'<div class="card"><div class="label">{lbl}</div>'
                     f'<div class="metric">{val}</div></div>', unsafe_allow_html=True)

    # Stint timeline
    st.markdown("#### Recommended strategy")
    bar = '<div class="card">'
    for comp, s, e in strat.stints(laps):
        width = (e - s + 1) / laps * 100
        bar += (f'<span style="display:inline-block;width:{width:.1f}%;background:'
                f'{COMPOUND_COLOR[comp]};color:#000;font-weight:700;font-size:.75rem;'
                f'padding:.55rem 0;text-align:center;border-right:2px solid #0A0A0A;">'
                f'{comp[0]} · L{s}-{e}</span>')
    bar += '</div>'
    st.markdown(bar, unsafe_allow_html=True)

    cols = st.columns(2)
    with cols[0]:
        st.markdown("#### Undercut / overcut")
        st.caption("Pure pace impact of shifting each stop ±1 lap (+ = slower). "
                   "Track-position gains from jumping rivals aren't modelled.")
        for u in res["undercut"]:
            line = f"**Stop {u['pit']}** · lap {u['lap']} → {u['compound']}  "
            if "undercut(-1)" in u:
                line += f"· undercut {u['undercut(-1)']:+.2f}s "
            if "overcut(+1)" in u:
                line += f"· overcut {u['overcut(+1)']:+.2f}s"
            st.markdown(line)
    with cols[1]:
        st.markdown("#### Alternatives")
        for c in res["alternatives"][:5]:
            seq = " → ".join([c.strategy.start_compound[0]] +
                             [comp[0] for _, comp in c.strategy.pits])
            pits = ", ".join(f"L{l}" for l, _ in c.strategy.pits)
            st.markdown(f"`{seq}`  pit {pits}  ·  +{(c.time-best.time):.1f}s")

    # Pace curve vs a naive baseline
    st.markdown("#### Pace curve")
    opt_curve = simulate(strat, slug, year, laps, temp, status or None, ltm).cumulative
    naive = Strategy("MEDIUM", [(laps // 2, "HARD")])
    base_curve = simulate(naive, slug, year, laps, temp, status or None, ltm).cumulative
    fig, ax = plt.subplots(figsize=(13, 5), facecolor="#0A0A0A")
    ax.set_facecolor("#111")
    x = np.arange(1, laps + 1)
    ax.plot(x, opt_curve, color="#FFD200", lw=3, label="Recommended")
    ax.plot(x, base_curve, color="#E10600", lw=2, ls="--", label="Naive 1-stop (Med→Hard)")
    for lap, comp in strat.pits:
        ax.axvline(lap, color="#FFD200", ls=":", alpha=.5)
    for l, s in status.items():
        ax.axvline(l, color="#00D2FF" if s == "VSC" else "#FF1E1E", alpha=.25)
    ax.set_xlabel("Lap", color="#fff"); ax.set_ylabel("Cumulative time (s)", color="#fff")
    ax.tick_params(colors="#8F8F8F"); ax.grid(alpha=.08)
    for sp in ax.spines.values():
        sp.set_color((1, 1, 1, .1))
    ax.legend(facecolor="#111", labelcolor="#fff", edgecolor=(1, 1, 1, .1))
    st.pyplot(fig, use_container_width=True)

    gain = base_curve[-1] - opt_curve[-1]
    st.markdown(f'<div class="card">Recommended plan is <b>{gain:.1f}s</b> faster than a '
                f'naive one-stop here, and was chosen for the best <b>expected</b> time '
                f'across {200} simulated safety-car scenarios.</div>', unsafe_allow_html=True)
else:
    st.info("Set up the race in the sidebar and hit **Optimise strategy**.")

# Honest model card
st.markdown("---")
metrics = json.load(open(MODEL_CARD)) if MODEL_CARD.exists() else {}
st.markdown(f"""
<div class="modelcard">
<b>Model card.</b> Base pace is learned from real Ergast laps (2014-2024,
~215k clean green-flag laps) — circuit + fuel-burn + temperature.
Held-out race-weekend CV: <b>MAE {metrics.get('cv_mae_s', 2.6):.2f}s</b>,
<b>R² {metrics.get('cv_r2', 0.85):.2f}</b>.
Tyre degradation comes from the {tyre.source} (Ergast has no compound data;
run the FastF1 pipeline to learn real per-compound wear). Undercut figures are
pure pace deltas, not track-position gains. Safety cars are modelled with
correct physics: laps slower, pit loss cheaper.
</div>
""", unsafe_allow_html=True)
