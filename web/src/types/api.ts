export type Compound = "SOFT" | "MEDIUM" | "HARD";

export interface Circuit {
  slug: string;
  name: string;
  typical_laps: number;
  median_pace: number;
}

export interface ModelCard {
  cv_mae_s: number;
  cv_r2: number;
  fuel_effect_s: number;
  n_laps: number;
  n_circuits: number;
  years: [number, number];
}

export interface Pit { lap: number; compound: Compound; }
export interface Stint { compound: Compound; start: number; end: number; laps: number; }
export interface MC { mean: number; p10: number; p90: number; std: number; }

export interface Recommended {
  start_compound: Compound;
  pits: Pit[];
  stints: Stint[];
  stops: number;
  total_s: number;
  total_min: number;
  mc: MC;
}

export interface PaceCurve {
  laps: number[];
  recommended_lap: number[];
  baseline_lap: number[];
  recommended_cum: number[];
  baseline_cum: number[];
}

export interface Alternative {
  sequence: Compound[];
  pits: Pit[];
  total_s: number;
  delta_s: number;
}

export interface UndercutRow {
  pit: number;
  lap: number;
  compound: Compound;
  "undercut(-1)": number;
  "overcut(+1)": number;
}

export interface OptimiseResponse {
  circuit: string;
  circuit_name: string;
  year: number;
  laps: number;
  temp: number;
  status: Record<string, "SC" | "VSC">;
  recommended: Recommended;
  pace_curve: PaceCurve;
  alternatives: Alternative[];
  undercut: UndercutRow[];
  model_card: ModelCard;
}

export interface OptimiseRequest {
  circuit: string;
  year: number;
  laps: number;
  temp: number;
  start_compound: Compound | null;
  max_stops: number;
  sc_lap: number;
  vsc_lap: number;
}

export interface CircuitGeo {
  path: string | null;
  gp: string;
}
