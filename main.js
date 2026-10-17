(() => {
  "use strict";

  const RHO = 1.225; // kg/m^3, sea-level air
  const G = 9.81; // m/s^2
  const P_ATM = 101325; // Pa
  const PERIMETER = 12.2; // m, assumption: 2*(4.2+1.9)
  const P_MAX_W = 80000;

  const $ = (id) => document.getElementById(id);

  const els = {
    power: $("power-slider"),
    powerFill: $("power-fill"),
    bigPower: $("big-power"),
    perFan: $("per-fan"),
    mass: $("mass"),
    area: $("area"),
    eta: $("eta"),
    gap: $("gap"),
    cd: $("cd"),
    mu: $("mu"),
    massVal: $("mass-val"),
    areaVal: $("area-val"),
    etaVal: $("eta-val"),
    gapVal: $("gap-val"),
    cdVal: $("cd-val"),
    muVal: $("mu-val"),
    outPair: $("out-pair"),
    outDp: $("out-dp"),
    outQ: $("out-q"),
    outMdot: $("out-mdot"),
    outF: $("out-f"),
    outG: $("out-g"),
    outN: $("out-n"),
    outFric: $("out-fric"),
    outPcrit: $("out-pcrit"),
    atmNote: $("atm-note"),
    atmDetail: $("atm-detail"),
    status: $("status"),
    statusTitle: $("status-title"),
    statusBody: $("status-body"),
    live: $("live"),
    stagePill: $("stage-pill"),
    anglePill: $("angle-pill"),
    car: $("car"),
    shaftUp: $("shaft-up"),
    shaftDown: $("shaft-down"),
    arrowHold: $("arrow-hold"),
    arrowWeight: $("arrow-weight"),
    particles: $("particles"),
    chartF: $("chart-f"),
    chartQ: $("chart-q"),
    chartNow: $("chart-now"),
    texPair: $("tex-pair"),
    texQ: $("tex-q"),
    texDp: $("tex-dp"),
    texF: $("tex-f"),
    texN: $("tex-n"),
    texPcrit: $("tex-pcrit"),
    subPair: $("sub-pair"),
    subQ: $("sub-q"),
    subDp: $("sub-dp"),
    subF: $("sub-f"),
    subN: $("sub-n"),
    subPcrit: $("sub-pcrit"),
  };

  const state = {
    thetaDeg: 180, // 0 = flat, 90 = vertical, 180 = inverted overhang
    falling: false,
    fallY: 0,
    rampAnim: null,
    particles: [],
    last: null,
  };

  function inputs() {
    const P_kW = Number(els.power.value);
    const P = P_kW * 1000;
    const m = Number(els.mass.value);
    const A = Number(els.area.value);
    const eta = Number(els.eta.value);
    const h_mm = Number(els.gap.value);
    const h = h_mm / 1000;
    const Cd = Number(els.cd.value);
    const mu = Number(els.mu.value);
    const A_gap = PERIMETER * h;
    return { P_kW, P, m, A, eta, h_mm, h, Cd, mu, A_gap };
  }

  /** Core fan + leakage model */
  function compute(inp) {
    const { P, m, A, eta, Cd, A_gap, mu } = inp;
    const sqrt2rho = Math.sqrt(2 / RHO);
    const leakCoeff = Cd * A_gap * sqrt2rho; // Q = leakCoeff * delta_p^(1/2)

    let delta_p = 0;
    let Q = 0;
    if (P > 0 && eta > 0 && leakCoeff > 0) {
      // eta*P = delta_p * Q = delta_p * leakCoeff * sqrt(delta_p)
      // delta_p^(3/2) = eta*P / leakCoeff
      delta_p = Math.pow((eta * P) / leakCoeff, 2 / 3);
      Q = leakCoeff * Math.sqrt(delta_p);
    }

    const pair = eta * P;
    const mdot = RHO * Q;
    const F = delta_p * A;
    const weight = m * G;
    const load = weight > 0 ? F / weight : 0;

    // Ramp: theta 0 flat (need ~0 suction for stationarity on flat), 180 inverted need F>=mg
    // Required normal force from suction against gravity component into the surface:
    // On overhang, surface normal points down; weight toward ground; for inverted, N = F - mg.
    const theta = (state.thetaDeg * Math.PI) / 180;
    // cos component: at 0 deg (wheels on floor) gravity presses into surface (no suction needed to stay);
    // at 180 deg gravity pulls away (need F >= mg). Use: N = F - mg * max(0, -cos(theta_from_upright))
    // Define theta=0 flat upright, theta=180 inverted: gravity component away from surface = mg * sin^2(theta/2)*2... simpler:
    // n_req = mg * max(0, cos(pi - theta)) wait: use nAway = mg * (-Math.cos(theta)) with theta from upright? 
    // Flat upright theta=0: surface below, away-component = 0 (cos inverted).
    // Use: gravityAway = mg * Math.max(0, -Math.cos(thetaRad)) where thetaRad=0 flat (cos=1 => away=0), theta=pi inverted (cos=-1 => away=mg)
    const gravityAway = weight * Math.max(0, -Math.cos(theta));
    const N = F - gravityAway;
    const fric = Math.max(0, N) * mu;

    // Critical power for inverted hold (F = mg)
    const dpCrit = weight / A;
    const Qcrit = leakCoeff * Math.sqrt(Math.max(0, dpCrit));
    const Pcrit = eta > 0 ? (dpCrit * Qcrit) / eta : Infinity;

    return {
      delta_p,
      Q,
      pair,
      mdot,
      F,
      weight,
      load,
      gravityAway,
      N,
      fric,
      dpCrit,
      Qcrit,
      Pcrit,
      leakCoeff,
    };
  }

  function fmt(n, digits) {
    if (!Number.isFinite(n)) return "--";
    return n.toFixed(digits);
  }

  function fmtSci(n, digits) {
    if (!Number.isFinite(n)) return "--";
    if (Math.abs(n) >= 1000 || (Math.abs(n) > 0 && Math.abs(n) < 0.01)) {
      return n.toExponential(digits);
    }
    return n.toFixed(digits);
  }

  function renderKatex() {
    if (typeof katex === "undefined") return;
    const opts = { throwOnError: false, displayMode: true };
    katex.render("P_{\\mathrm{air}} = \\eta P = \\Delta p \\, Q", els.texPair, opts);
    katex.render(
      "Q = C_d A_{\\mathrm{gap}} \\sqrt{\\dfrac{2\\Delta p}{\\rho}},\\quad A_{\\mathrm{gap}} = L h",
      els.texQ,
      opts
    );
    katex.render(
      "\\Delta p = \\left(\\dfrac{\\eta P}{C_d A_{\\mathrm{gap}} \\sqrt{2/\\rho}}\\right)^{2/3}",
      els.texDp,
      opts
    );
    katex.render("F = \\Delta p \\, A", els.texF, opts);
    katex.render("N = F - mg \\quad (\\text{inverted overhang})", els.texN, opts);
    katex.render(
      "P_{\\mathrm{crit}} = \\dfrac{\\Delta p_{\\mathrm{crit}} Q_{\\mathrm{crit}}}{\\eta},\\quad \\Delta p_{\\mathrm{crit}}=\\dfrac{mg}{A}",
      els.texPcrit,
      opts
    );
  }

  function updateEquations(inp, out) {
    const { P_kW, P, m, A, eta, h, Cd, A_gap } = inp;
    const { delta_p, Q, pair, F, weight, N, Pcrit, dpCrit, Qcrit } = out;

    els.subPair.textContent =
      "eta*P = " +
      fmt(eta, 2) +
      " * " +
      fmt(P_kW, 1) +
      " kW = " +
      fmt(pair / 1000, 2) +
      " kW = delta_p * Q";

    els.subQ.textContent =
      "A_gap = " +
      fmt(PERIMETER, 1) +
      " m * " +
      fmt(h * 1000, 1) +
      " mm = " +
      fmt(A_gap, 4) +
      " m^2;  Q = " +
      fmt(Cd, 2) +
      " * " +
      fmt(A_gap, 4) +
      " * sqrt(2*" +
      fmt(delta_p, 0) +
      "/" +
      fmt(RHO, 3) +
      ") = " +
      fmt(Q, 3) +
      " m^3/s";

    els.subDp.textContent =
      "delta_p = (" +
      fmt(pair, 0) +
      " / (" +
      fmt(Cd, 2) +
      "*" +
      fmt(A_gap, 4) +
      "*sqrt(2/" +
      fmt(RHO, 3) +
      ")))^(2/3) = " +
      fmt(delta_p, 0) +
      " Pa = " +
      fmt(delta_p / 1000, 2) +
      " kPa";

    els.subF.textContent =
      "F = " +
      fmt(delta_p, 0) +
      " Pa * " +
      fmt(A, 1) +
      " m^2 = " +
      fmt(F, 0) +
      " N = " +
      fmt(F / 1000, 2) +
      " kN";

    els.subN.textContent =
      "N = " +
      fmt(F / 1000, 2) +
      " kN - " +
      fmt(weight / 1000, 2) +
      " kN = " +
      fmt(N / 1000, 2) +
      " kN  (N < 0 => falls)";

    els.subPcrit.textContent =
      "delta_p_crit = mg/A = " +
      fmt(dpCrit, 0) +
      " Pa; Q_crit = " +
      fmt(Qcrit, 3) +
      " m^3/s; P_crit = " +
      fmt(Pcrit / 1000, 2) +
      " kW";

    const dpNeed = weight / A;
    const frac = (dpNeed / P_ATM) * 100;
    const note =
      "delta_p needed for F = mg is mg/A = " +
      fmt(dpNeed / 1000, 2) +
      " kPa, only " +
      fmt(frac, 1) +
      "% of one atmosphere (101 kPa). Atmospheric pressure easily supplies the force once the underbody is sealed and depressurized.";
    els.atmNote.textContent = note;
    els.atmDetail.textContent = note;
  }

  function placeCar() {
    const car = els.car;
    car.classList.remove("falling", "powerless", "held", "inverted", "upright");

    // Positions as % of stage: flat left-bottom, vertical mid-right, overhang top
    const t = state.thetaDeg / 180;
    let left;
    let top;
    let rot;

    if (state.falling) {
      left = 58;
      top = Math.min(72, 12 + state.fallY);
      rot = 180 + Math.min(40, state.fallY * 0.8);
      car.classList.add("falling", "powerless", "inverted");
    } else if (state.thetaDeg <= 5) {
      left = 12;
      top = 58;
      rot = 0;
      car.classList.add("upright");
    } else if (state.thetaDeg < 90) {
      const u = state.thetaDeg / 90;
      left = 12 + u * 40;
      top = 58 - u * 18;
      rot = state.thetaDeg;
      car.classList.add("upright");
    } else if (state.thetaDeg < 160) {
      const u = (state.thetaDeg - 90) / 70;
      left = 52 + u * 10;
      top = 40 - u * 22;
      rot = state.thetaDeg;
      car.classList.add(state.thetaDeg > 120 ? "inverted" : "upright");
    } else {
      left = 58;
      top = 10;
      rot = 180;
      car.classList.add("inverted");
    }

    car.style.left = left + "%";
    car.style.top = top + "%";
    car.style.transform = "rotate(" + rot + "deg)";
  }

  function updateStatus(inp, out) {
    const { P_kW } = inp;
    const { N, load, F, weight, gravityAway, fric } = out;
    const inverted = state.thetaDeg >= 170;

    els.stagePill.textContent = "F / mg = " + fmt(load, 2);
    const label =
      state.thetaDeg < 10
        ? "flat"
        : state.thetaDeg < 80
          ? "climbing"
          : state.thetaDeg < 110
            ? "vertical"
            : state.thetaDeg < 170
              ? "to overhang"
              : "inverted";
    els.anglePill.textContent = "theta = " + fmt(state.thetaDeg, 0) + " deg (" + label + ")";

    els.arrowHold.textContent = fmt(F / 1000, 1);
    els.arrowWeight.textContent = fmt(weight / 1000, 1);
    els.shaftUp.style.height = Math.max(8, Math.min(90, (F / weight) * 36)) + "px";
    els.shaftDown.style.height = "28px";

    els.status.classList.remove("is-falling", "is-unsafe", "is-ramp");

    if (state.falling) {
      els.status.classList.add("is-falling");
      els.statusTitle.textContent = "Car peeled off";
      els.statusBody.textContent =
        "N < 0: suction downforce is less than the gravity component away from the surface. Restore fan power and press Reset.";
      els.car.classList.add("powerless");
      return;
    }

    if (state.thetaDeg > 5 && state.thetaDeg < 175) {
      els.status.classList.add("is-ramp");
    }

    if (N < 0 && inverted) {
      els.status.classList.add("is-unsafe");
      els.statusTitle.textContent = "Cannot hold -- falling";
      els.statusBody.textContent =
        "At " +
        fmt(P_kW, 1) +
        " kW, F = " +
        fmt(F / 1000, 2) +
        " kN < mg = " +
        fmt(weight / 1000, 2) +
        " kN. Raise fan power or improve the seal.";
      beginFall();
      return;
    }

    if (inverted) {
      els.car.classList.add("held");
      els.statusTitle.textContent = "Held on ceiling";
      els.statusBody.textContent =
        "N = F - mg = " +
        fmt(N / 1000, 2) +
        " kN into the overhang. Available friction mu*N = " +
        fmt(fric / 1000, 2) +
        " kN. Load factor " +
        fmt(load, 2) +
        " g (Tesla claimed up to ~2 g).";
    } else {
      els.car.classList.add("held");
      const need = gravityAway;
      els.statusTitle.textContent = "On ramp (theta = " + fmt(state.thetaDeg, 0) + " deg)";
      els.statusBody.textContent =
        "Gravity component away from surface: " +
        fmt(need / 1000, 2) +
        " kN. Current F = " +
        fmt(F / 1000, 2) +
        " kN. Inverted overhang is the hardest case.";
    }
  }

  function beginFall() {
    if (state.falling) return;
    state.falling = true;
    state.fallY = 0;
    els.car.classList.add("falling", "powerless");
    const start = performance.now();
    const tick = (now) => {
      if (!state.falling) return;
      const t = (now - start) / 1000;
      state.fallY = 0.5 * 120 * t * t; // visual accel
      placeCar();
      if (state.fallY < 70) {
        requestAnimationFrame(tick);
      } else {
        els.statusTitle.textContent = "On the floor";
        els.statusBody.textContent = "Press Reset to overhang to try again with higher fan power or a tighter seal.";
      }
    };
    requestAnimationFrame(tick);
  }

  function drawChart(svg, seriesY, currentX, currentY, yMax, yLabel, weightY) {
    const W = 360;
    const H = 240;
    const pad = { l: 48, r: 16, t: 20, b: 40 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const xMax = P_MAX_W / 1000;

    const xScale = (x) => pad.l + (x / xMax) * iw;
    const yScale = (y) => pad.t + ih - (y / yMax) * ih;

    let path = "";
    seriesY.forEach((pt, i) => {
      const x = xScale(pt.x);
      const y = yScale(pt.y);
      path += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
    });

    const grid = [];
    for (let i = 0; i <= 4; i++) {
      const yv = (yMax * i) / 4;
      const y = yScale(yv);
      grid.push(
        '<line x1="' +
          pad.l +
          '" y1="' +
          y +
          '" x2="' +
          (W - pad.r) +
          '" y2="' +
          y +
          '" stroke="#2a3a55" stroke-width="1"/>'
      );
      grid.push(
        '<text x="' +
          (pad.l - 6) +
          '" y="' +
          (y + 3) +
          '" fill="#9aa8bc" font-size="10" text-anchor="end">' +
          fmt(yv, yMax >= 20 ? 0 : 1) +
          "</text>"
      );
    }
    for (let i = 0; i <= 4; i++) {
      const xv = (xMax * i) / 4;
      const x = xScale(xv);
      grid.push(
        '<text x="' +
          x +
          '" y="' +
          (H - 14) +
          '" fill="#9aa8bc" font-size="10" text-anchor="middle">' +
          fmt(xv, 0) +
          "</text>"
      );
    }

    let weightLine = "";
    if (weightY != null && weightY > 0) {
      const yw = yScale(Math.min(weightY, yMax));
      weightLine =
        '<line x1="' +
        pad.l +
        '" y1="' +
        yw +
        '" x2="' +
        (W - pad.r) +
        '" y2="' +
        yw +
        '" stroke="#ed8936" stroke-width="2" stroke-dasharray="6 4"/>' +
        '<text x="' +
        (W - pad.r) +
        '" y="' +
        (yw - 4) +
        '" fill="#ed8936" font-size="10" text-anchor="end">mg</text>';
    }

    const marker =
      '<circle cx="' +
      xScale(currentX) +
      '" cy="' +
      yScale(Math.min(currentY, yMax)) +
      '" r="5" fill="#ef2f3a" stroke="#fff" stroke-width="1.5"/>';

    svg.innerHTML =
      grid.join("") +
      weightLine +
      '<path d="' +
      path +
      '" fill="none" stroke="#4fd1c5" stroke-width="2.5"/>' +
      marker +
      '<text x="' +
      W / 2 +
      '" y="' +
      (H - 2) +
      '" fill="#9aa8bc" font-size="11" text-anchor="middle">P (kW)</text>' +
      '<text x="14" y="14" fill="#9aa8bc" font-size="11">' +
      yLabel +
      "</text>";
  }

  function updateCharts(inp, out) {
    const ptsF = [];
    const ptsQ = [];
    const n = 41;
    for (let i = 0; i < n; i++) {
      const PkW = (i / (n - 1)) * 80;
      const sample = compute({ ...inp, P: PkW * 1000, P_kW: PkW });
      ptsF.push({ x: PkW, y: sample.F / 1000 });
      ptsQ.push({ x: PkW, y: sample.Q });
    }
    const fMax = Math.max(out.weight / 1000 * 1.4, ptsF[ptsF.length - 1].y * 1.1, 20);
    const qMax = Math.max(ptsQ[ptsQ.length - 1].y * 1.15, 2);
    drawChart(els.chartF, ptsF, inp.P_kW, out.F / 1000, fMax, "F (kN)", out.weight / 1000);
    drawChart(els.chartQ, ptsQ, inp.P_kW, out.Q, qMax, "Q (m^3/s)", null);

    // Mark P_crit on F chart with a vertical line via extra DOM - append to chart-f
    const Pcrit_kW = out.Pcrit / 1000;
    if (Number.isFinite(Pcrit_kW) && Pcrit_kW <= 80) {
      const W = 360;
      const pad = { l: 48, r: 16 };
      const iw = W - pad.l - pad.r;
      const x = pad.l + (Pcrit_kW / 80) * iw;
      els.chartF.innerHTML +=
        '<line x1="' +
        x +
        '" y1="20" x2="' +
        x +
        '" y2="200" stroke="#fc8181" stroke-width="1.5" stroke-dasharray="4 3"/>' +
        '<text x="' +
        x +
        '" y="16" fill="#fc8181" font-size="10" text-anchor="middle">P_crit</text>';
    }

    els.chartNow.textContent =
      "Now: P = " +
      fmt(inp.P_kW, 1) +
      " kW, F = " +
      fmt(out.F / 1000, 2) +
      " kN, Q = " +
      fmt(out.Q, 2) +
      " m^3/s, P_crit = " +
      fmt(Pcrit_kW, 2) +
      " kW";
  }

  function syncParticles(out) {
    const host = els.particles;
    // Scale particle count and speed with Q (typical Q ~ 5 m^3/s)
    const target = Math.min(48, Math.max(0, Math.round(out.Q * 6)));
    while (state.particles.length < target) {
      state.particles.push(spawnParticle());
    }
    while (state.particles.length > target) {
      const p = state.particles.pop();
      if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el);
    }
    state.particleSpeed = 0.35 + Math.min(2.2, out.Q * 0.25);
  }

  function spawnParticle() {
    const el = document.createElement("div");
    el.className = "particle";
    els.particles.appendChild(el);
    return resetParticle({ el, x: 0, y: 0, vx: 0, life: 0 });
  }

  function resetParticle(p) {
    // Start under car (suction region), drift toward rear fans and out
    const carRect = els.car.getBoundingClientRect();
    const stageRect = els.particles.getBoundingClientRect();
    if (!stageRect.width) {
      p.x = 200;
      p.y = 80;
    } else {
      const cx = ((carRect.left + carRect.width * 0.35) - stageRect.left) / stageRect.width;
      const cy = ((carRect.top + carRect.height * 0.35) - stageRect.top) / stageRect.height;
      p.x = (cx + (Math.random() - 0.5) * 0.18) * stageRect.width;
      p.y = (cy + (Math.random() - 0.5) * 0.12) * stageRect.height;
    }
    p.life = 0.4 + Math.random() * 0.8;
    p.vx = 40 + Math.random() * 50;
    p.vy = (Math.random() - 0.5) * 20;
    p.el.style.opacity = String(0.5 + Math.random() * 0.45);
    return p;
  }

  function animateParticles(dt) {
    const stage = els.particles;
    const w = stage.clientWidth || 640;
    const h = stage.clientHeight || 420;
    const spd = state.particleSpeed || 1;
    for (const p of state.particles) {
      p.x += p.vx * spd * dt;
      p.y += p.vy * spd * dt;
      p.life -= dt;
      // Pull slightly toward car rear (exhaust)
      const car = els.car.getBoundingClientRect();
      const st = stage.getBoundingClientRect();
      if (st.width) {
        const tx = car.left + car.width * 0.92 - st.left;
        const ty = car.top + car.height * 0.55 - st.top;
        p.vx += (tx - p.x) * 0.8 * dt;
        p.vy += (ty - p.y) * 0.5 * dt;
      }
      if (p.life <= 0 || p.x > w || p.y < 0 || p.y > h) {
        resetParticle(p);
      }
      p.el.style.transform = "translate(" + p.x + "px," + p.y + "px)";
    }
  }

  function updateUI() {
    const inp = inputs();
    const out = compute(inp);
    state.last = { inp, out };

    els.bigPower.textContent = fmt(inp.P_kW, 1);
    els.perFan.textContent = "= 4 x " + fmt(inp.P_kW / 4, 1) + " kW per fan";
    els.powerFill.style.transform = "scaleX(" + inp.P_kW / 80 + ")";

    els.massVal.textContent = String(Math.round(inp.m));
    els.areaVal.textContent = fmt(inp.A, 1);
    els.etaVal.textContent = fmt(inp.eta, 2);
    els.gapVal.textContent = fmt(inp.h_mm, 1);
    els.cdVal.textContent = fmt(inp.Cd, 2);
    els.muVal.textContent = fmt(inp.mu, 2);

    els.outPair.textContent = fmt(out.pair / 1000, 2) + " kW";
    els.outDp.textContent = fmt(out.delta_p / 1000, 2) + " kPa (" + fmt(out.delta_p, 0) + " Pa)";
    els.outQ.textContent =
      fmt(out.Q, 2) + " m^3/s (" + fmt(out.Q * 1000, 0) + " L/s)";
    els.outMdot.textContent = fmt(out.mdot, 2) + " kg/s";
    els.outF.textContent =
      fmt(out.F / 1000, 2) +
      " kN (" +
      fmt(out.F / G, 0) +
      " kgf)";
    els.outG.textContent = fmt(out.load, 2) + " g";
    els.outN.textContent =
      (out.N < 0 ? "" : "") + fmt(out.N / 1000, 2) + " kN" + (out.N < 0 ? " (falls)" : "");
    els.outFric.textContent = fmt(out.fric / 1000, 2) + " kN";
    els.outPcrit.textContent = fmt(out.Pcrit / 1000, 2) + " kW";

    updateEquations(inp, out);
    updateCharts(inp, out);
    placeCar();
    updateStatus(inp, out);
    syncParticles(out);

    els.live.textContent =
      "Fan power " +
      fmt(inp.P_kW, 1) +
      " kilowatts. Pressure drop " +
      fmt(out.delta_p / 1000, 2) +
      " kilopascals. Volume flow " +
      fmt(out.Q, 2) +
      " cubic meters per second. Load factor " +
      fmt(out.load, 2) +
      " g.";
  }

  function onParamChange() {
    if (state.falling && Number(els.power.value) > 0) {
      // Allow recovery only via Reset; keep falling state until reset
    }
    updateUI();
  }

  function resetScene() {
    state.falling = false;
    state.fallY = 0;
    state.thetaDeg = 180;
    if (state.rampAnim) {
      cancelAnimationFrame(state.rampAnim);
      state.rampAnim = null;
    }
    els.power.value = "80";
    els.mass.value = "1680";
    els.area.value = "4.0";
    els.eta.value = "0.60";
    els.gap.value = "6";
    els.cd.value = "0.62";
    els.mu.value = "1.0";
    updateUI();
  }

  function runRampSequence() {
    if (state.rampAnim) {
      cancelAnimationFrame(state.rampAnim);
      state.rampAnim = null;
    }
    state.falling = false;
    state.fallY = 0;
    state.thetaDeg = 0;
    const start = performance.now();
    const duration = 6500;
    const step = (now) => {
      const u = Math.min(1, (now - start) / duration);
      // Ease: spend time on flat, climb, vertical, overhang
      state.thetaDeg = u * 180;
      updateUI();
      if (u < 1 && !state.falling) {
        state.rampAnim = requestAnimationFrame(step);
      } else {
        state.rampAnim = null;
        state.thetaDeg = 180;
        updateUI();
      }
    };
    state.rampAnim = requestAnimationFrame(step);
  }

  function dropTest() {
    els.power.value = "0";
    state.thetaDeg = 180;
    state.falling = false;
    updateUI();
  }

  // Bind controls
  ["power", "mass", "area", "eta", "gap", "cd", "mu"].forEach((key) => {
    els[key].addEventListener("input", onParamChange);
  });
  $("power-down").addEventListener("click", () => {
    els.power.value = String(Math.max(0, Number(els.power.value) - 5));
    onParamChange();
  });
  $("power-up").addEventListener("click", () => {
    els.power.value = String(Math.min(80, Number(els.power.value) + 5));
    onParamChange();
  });
  $("reset").addEventListener("click", resetScene);
  $("ramp-run").addEventListener("click", runRampSequence);
  $("drop-test").addEventListener("click", dropTest);

  let lastTs = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    animateParticles(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function boot() {
    renderKatex();
    updateUI();
    // Log defaults for sanity-check / console
    const inp = inputs();
    const out = compute(inp);
    console.info("[roadster-ceiling-fan-sim] defaults", {
      delta_p_kPa: +(out.delta_p / 1000).toFixed(2),
      Q_m3s: +out.Q.toFixed(2),
      F_kN: +(out.F / 1000).toFixed(2),
      F_over_mg: +out.load.toFixed(2),
      P_crit_kW: +(out.Pcrit / 1000).toFixed(2),
    });
  }

  if (typeof katex !== "undefined") {
    boot();
  } else {
    // KaTeX defer: wait briefly then boot with or without it
    let tries = 0;
    const wait = setInterval(() => {
      tries += 1;
      if (typeof katex !== "undefined" || tries > 40) {
        clearInterval(wait);
        boot();
      }
    }, 50);
  }
})();
