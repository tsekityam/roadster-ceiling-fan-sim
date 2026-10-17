# Roadster Ceiling Suction Model

High-school physics demo of the October 2026 Tesla Roadster upside-down reveal at SpaceX McGregor. Multi-mode fans pull air from under the car; the resulting pressure drop produces downforce `F = delta_p * A`. Cold-gas thrusters are separate and are not what holds the car on the ceiling.

**Live:** [https://kytse.com/roadster-ceiling-fan-sim/](https://kytse.com/roadster-ceiling-fan-sim/)

**Repo:** [tsekityam/roadster-ceiling-fan-sim](https://github.com/tsekityam/roadster-ceiling-fan-sim)

## Run locally

Static site: no build step.

```bash
python3 -m http.server 8765
```

Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/).

Or open `index.html` directly in a browser (KaTeX loads from jsDelivr CDN).

## Model (defaults)

| Symbol | Default | Source |
|--------|---------|--------|
| P | 80 kW (4 x 20 kW) | Car and Driver / Tesla |
| m | 1680 kg (~3700 lb) | Car and Driver (approx.) |
| A | 4.0 m^2 | assumption |
| eta | 0.60 | assumption |
| h | 6 mm | assumption (seal gap) |
| L | 12.2 m | assumption (perimeter) |
| Cd | 0.62 | assumption |
| rho | 1.225 kg/m^3 | air |

Formulas:

- `eta * P = delta_p * Q`
- `Q = Cd * A_gap * sqrt(2 * delta_p / rho)` with `A_gap = L * h`
- `delta_p = (eta*P / (Cd*A_gap*sqrt(2/rho)))^(2/3)`
- `F = delta_p * A`, `N = F - mg` when inverted
- `P_crit` from `F = mg`

Simplified: steady flow, uniform underbody pressure, no speed-dependent aero.

## Deploy

GitHub Pages from `main` via `.github/workflows/pages.yml`.
