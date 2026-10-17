/* Upside-down fan car with real-ish units.
   Fans in the rear diffuser pull air from under the floor (public fan-car layout).
   Model (classroom simplification of sealed underbody suction):
     Q  = Q_max * (fan%/100)          volume flow out of the underbody [m3/s]
     dP = K * Q^2                     pressure drop under the floor [Pa]
                                      (leakage-like: more flow needs more suction)
     F  = dP * AREA                   downforce toward the road/ceiling [N]
   Stick when F >= mass * g.
   Numbers are tuned to classroom scale, inspired by published fan-car ranges
   (roughly a few m3/s of air and kN of force), not a claim about any production car. */
(function () {
  "use strict";

  var G = 9.81;
  var CAR_MASS_KG = 1500;
  var WEIGHT_N = CAR_MASS_KG * G;
  var AREA_M2 = 2.5;
  var Q_MAX = 5.0;
  var FAN_STICK = 60;
  var Q_STICK = Q_MAX * (FAN_STICK / 100);
  var DP_STICK = WEIGHT_N / AREA_M2;
  var K_PRESS = DP_STICK / (Q_STICK * Q_STICK);
  var F_MAX_N = K_PRESS * Q_MAX * Q_MAX * AREA_M2;

  var FALL_MASS = 36;
  var DRIVE_SPEED = 0.16;
  var ARROW_MAX = 54;
  var SVG_H = 150;
  var WHEEL_BOTTOM = 40;
  var THUMB = 44;

  var C = { w: 360, h: 230, l: 52, r: 62, t: 16, b: 40 };

  var stage = document.getElementById("stage");
  var car = document.getElementById("car");
  var carBody = document.getElementById("car-body");
  var svg = car.querySelector(".car-svg");
  var shadow = document.getElementById("shadow");
  var particleLayer = document.getElementById("particles");
  var fanAnchor = document.getElementById("fan-anchor");
  var fanSpins = Array.prototype.slice.call(document.querySelectorAll(".fan-spin")).map(function (node) {
    return {
      node: node,
      base: node.getAttribute("transform") || ""
    };
  });
  var wheelRear = document.getElementById("wheel-rear");
  var wheelFront = document.getElementById("wheel-front");
  var airMarks = document.getElementById("air-marks");
  var suctionMarks = document.getElementById("suction-marks");
  var slider = document.getElementById("fan-slider");
  var sliderFill = document.getElementById("slider-fill");
  var resetBtn = document.getElementById("reset");
  var live = document.getElementById("live");
  var chart = document.getElementById("chart");

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = motionQuery.matches;

  var sim = {
    fan: 75,
    mode: "ceiling",
    x: 0.28,
    dir: 1,
    y: 0,
    vy: 0,
    fanAngle: 0,
    wheelAngle: 0,
    last: performance.now(),
    particles: [],
    dusts: [],
    emitAcc: 0,
    impact: false,
    demoClimb: false,
    demoFan: 15,
    demoTarget: 95,
    demoWait: 0
  };

  var puffNodes = [];
  var dustNodes = [];
  var dotHalo = null;
  var dot = null;
  var cursor = null;
  var lastReadout = "";
  var lastLive = "";
  var liveTimer = 0;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function physicsFromFan(fanPct) {
    var u = clamp(fanPct, 0, 100) / 100;
    var Q = Q_MAX * u;
    var dP = K_PRESS * Q * Q;
    var F = dP * AREA_M2;
    return {
      fan: fanPct,
      Q: Q,
      Q_Ls: Q * 1000,
      dP: dP,
      dP_kPa: dP / 1000,
      F: F,
      F_kN: F / 1000,
      F_kgf: F / G,
      weightN: WEIGHT_N,
      weightKg: CAR_MASS_KG,
      stuck: F + 1e-6 >= WEIGHT_N,
      fill: F_MAX_N > 0 ? (100 * F) / F_MAX_N : 0,
      weightFill: F_MAX_N > 0 ? (100 * WEIGHT_N) / F_MAX_N : 0
    };
  }

  function holdForce(fan) {
    return physicsFromFan(fan).F;
  }

  function fmt(n, digits) {
    var d = digits == null ? 1 : digits;
    return Number(n).toFixed(d);
  }

  function X(fanPct) {
    return C.l + (fanPct / 100) * (C.w - C.l - C.r);
  }

  function Yforce(forceN) {
    var top = F_MAX_N;
    return C.t + (1 - forceN / top) * (C.h - C.t - C.b);
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function buildChart() {
    while (chart.firstChild) chart.removeChild(chart.firstChild);

    var stick = svgEl("rect", {
      x: X(0),
      y: Yforce(F_MAX_N),
      width: X(100) - X(0),
      height: Yforce(WEIGHT_N) - Yforce(F_MAX_N),
      fill: "#d9f3ea"
    });
    var fall = svgEl("rect", {
      x: X(0),
      y: Yforce(WEIGHT_N),
      width: X(100) - X(0),
      height: Yforce(0) - Yforce(WEIGHT_N),
      fill: "#f8d2cc"
    });
    var axisX = svgEl("line", {
      x1: X(0),
      y1: Yforce(0),
      x2: X(100),
      y2: Yforce(0),
      stroke: "#17202b",
      "stroke-width": 2
    });
    var axisY = svgEl("line", {
      x1: X(0),
      y1: Yforce(0),
      x2: X(0),
      y2: Yforce(F_MAX_N),
      stroke: "#17202b",
      "stroke-width": 2
    });
    var gravity = svgEl("line", {
      x1: X(0),
      y1: Yforce(WEIGHT_N),
      x2: X(100),
      y2: Yforce(WEIGHT_N),
      stroke: "#c2410c",
      "stroke-width": 3,
      "stroke-dasharray": "7 5"
    });

    var relation = svgEl("path", {
      fill: "none",
      stroke: "#0e7c66",
      "stroke-width": 3
    });
    var pts = [];
    var i;
    for (i = 0; i <= 20; i += 1) {
      var fan = (i / 20) * 100;
      var phy = physicsFromFan(fan);
      pts.push((i === 0 ? "M" : "L") + X(fan) + " " + Yforce(phy.F));
    }
    relation.setAttribute("d", pts.join(" "));

    var cross = svgEl("circle", {
      cx: X(FAN_STICK),
      cy: Yforce(WEIGHT_N),
      r: 5,
      fill: "#fffdf8",
      stroke: "#c2410c",
      "stroke-width": 3
    });
    cursor = svgEl("line", {
      x1: X(75),
      y1: Yforce(physicsFromFan(75).F),
      x2: X(75),
      y2: Yforce(0),
      stroke: "#1d4e89",
      "stroke-width": 2,
      "stroke-dasharray": "3 4"
    });
    dotHalo = svgEl("circle", {
      r: 11,
      fill: "#fffdf8",
      stroke: "#17202b",
      "stroke-width": 2
    });
    dot = svgEl("circle", { r: 7, fill: "#0e7c66" });

    [0, FAN_STICK, 100].forEach(function (tick) {
      var phy = physicsFromFan(tick);
      var tx = svgEl("text", { x: X(tick), y: Yforce(0) + 18, "text-anchor": "middle", class: "tick" });
      tx.textContent = fmt(phy.Q, 1);
      chart.appendChild(tx);
    });
    [0, WEIGHT_N, F_MAX_N].forEach(function (forceN) {
      var ty = svgEl("text", { x: X(0) - 6, y: Yforce(forceN) + 4, "text-anchor": "end", class: "tick" });
      ty.textContent = fmt(forceN / 1000, forceN === 0 ? 0 : 1);
      chart.appendChild(ty);
    });

    var xName = svgEl("text", { x: (X(0) + X(100)) / 2, y: C.h - 2, "text-anchor": "middle", class: "axis-name" });
    xName.textContent = "Q (m³/s)";
    var yName = svgEl("text", { x: 14, y: 14, class: "axis-name" });
    yName.textContent = "F (kN)";
    var gName = svgEl("text", { x: X(100) + 6, y: Yforce(WEIGHT_N) + 5, class: "axis-name" });
    gName.textContent = "mg";

    [stick, fall, axisX, axisY, gravity, relation, cross, cursor, dotHalo, dot, xName, yName, gName].forEach(function (node) {
      chart.appendChild(node);
    });
  }

  function buildPools() {
    var i;
    for (i = 0; i < 30; i += 1) {
      var puff = document.createElement("span");
      puff.className = "puff";
      puff.style.display = "none";
      particleLayer.appendChild(puff);
      puffNodes.push(puff);
    }
    for (i = 0; i < 8; i += 1) {
      var dust = document.createElement("span");
      dust.className = "dust";
      dust.style.display = "none";
      particleLayer.appendChild(dust);
      dustNodes.push(dust);
    }
  }

  function setFan(raw) {
    sim.fan = clamp(Math.round(Number(raw)), 0, 100);
    if (Number(slider.value) !== sim.fan) slider.value = String(sim.fan);
    paintFanChrome();
  }

  function paintFanChrome() {
    var fan = sim.fan;
    var phy = physicsFromFan(fan);
    slider.setAttribute(
      "aria-valuetext",
      "輸出 " + fan + "%, Q " + fmt(phy.Q, 2) + " 立方米每秒, F " + fmt(phy.F_kN, 1) + " 千牛頓, mg " + fmt(WEIGHT_N / 1000, 1) + " 千牛頓"
    );
    sliderFill.style.width = "calc((100% - " + THUMB + "px) * " + (fan / 100) + " + " + (THUMB / 2) + "px)";
    document.querySelectorAll("[data-fan]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(Number(btn.dataset.fan) === fan));
    });
  }

  function resetSim() {
    sim.mode = "ceiling";
    sim.y = 0;
    sim.vy = 0;
    sim.x = 0.22;
    sim.dir = 1;
    sim.particles.length = 0;
    sim.dusts.length = 0;
    sim.impact = false;
    sim.wheelAngle = 0;
    sim.demoClimb = false;
  }

  // Put the car on the ground so kids can raise the rear fans and watch it climb.
  function placeOnGround(fanValue) {
    sim.mode = "floor";
    sim.y = 1;
    sim.vy = 0;
    sim.x = 0.32;
    sim.dir = 1;
    sim.particles.length = 0;
    sim.dusts.length = 0;
    sim.impact = false;
    sim.demoClimb = false;
    setFan(fanValue == null ? 20 : fanValue);
  }

  // Reproduce ground -> ceiling: land weak, then ramp fan until it lifts and sticks.
  function playGroundToCeiling() {
    placeOnGround(15);
    sim.demoClimb = true;
    sim.demoFan = 15;
    sim.demoTarget = 95;
    sim.demoWait = 0.7;
  }

  function copyForState() {
    var phy = physicsFromFan(sim.fan);
    var nums =
      "Q = " +
      fmt(phy.Q, 2) +
      " m³/s, ΔP = " +
      fmt(phy.dP_kPa, 2) +
      " kPa, F = " +
      fmt(phy.F_kN, 1) +
      " kN (" +
      fmt(phy.F_kgf, 0) +
      " kgf), mg = " +
      fmt(WEIGHT_N / 1000, 1) +
      " kN. ";
    if (sim.mode === "floor") {
      if (phy.stuck) {
        return {
          tone: "ok",
          title: "F > mg · 開始升向天花板",
          pill: "起飛",
          body: nums + "淨力指向天花板, 車輛正離開地面."
        };
      }
      return {
        tone: "bad",
        title: "地面 · F < mg",
        pill: "地面",
        body: nums + "提高輸出至 ≥ " + FAN_STICK + "% (Q ≥ " + fmt(Q_STICK, 1) + " m³/s) 使 F ≥ mg."
      };
    }
    if (sim.mode === "ceiling" && phy.stuck) {
      if (Math.abs(phy.F - WEIGHT_N) < WEIGHT_N * 0.02) {
        return {
          tone: "ok",
          title: "臨界平衡 F ≈ mg",
          pill: "臨界",
          body: nums + "剛好滿足可貼條件."
        };
      }
      return {
        tone: "ok",
        title: "可貼天花板 · F ≥ mg",
        pill: "可貼",
        body: nums + "下壓力足以抵抗重量, 保持倒掛."
      };
    }
    if (phy.stuck && sim.vy < -0.05) {
      return {
        tone: "ok",
        title: "上升中 · F_net > 0",
        pill: "上升",
        body: nums + "F > mg, 加速度指向天花板."
      };
    }
    if (phy.stuck) {
      return {
        tone: "warn",
        title: "減速中 · 仍 F ≥ mg",
        pill: "減速",
        body: nums + "速度仍指向地面, 但淨力已改為指向天花板."
      };
    }
    var gapN = WEIGHT_N - phy.F;
    var title = gapN >= 6000 ? "快速墜落" : gapN >= 2000 ? "墜落中" : "緩慢墜落";
    return {
      tone: "bad",
      title: title + " · F < mg",
      pill: title,
      body: nums + "淨力指向地面."
    };
  }

  function stepPhysics(dt) {
    var phy = physicsFromFan(sim.fan);
    var hold = phy.F;
    var netDown = (WEIGHT_N - hold) / 1000;

    if (sim.mode === "ceiling") {
      if (phy.stuck) {
        sim.y = 0;
        sim.vy = 0;
        sim.x += sim.dir * DRIVE_SPEED * dt;
        if (sim.x >= 1) {
          sim.x = 1;
          sim.dir = -1;
        } else if (sim.x <= 0) {
          sim.x = 0;
          sim.dir = 1;
        }
        if (!reduceMotion) sim.wheelAngle -= sim.dir * 260 * dt;
      } else {
        sim.mode = "air";
        sim.vy = 0;
      }
    }

    if (sim.mode === "air") {
      var accel = netDown / FALL_MASS;
      // Keep a tiny gap visible: a 1-point miss still lands in a few seconds.
      if (netDown > 0) accel = Math.max(accel, 0.18);
      else if (netDown < 0) accel = Math.min(accel, -0.18);
      sim.vy = clamp(sim.vy + accel * dt, -3, 3);
      sim.y += sim.vy * dt;
      sim.x += sim.dir * 0.03 * dt;
      if (sim.x < 0) {
        sim.x = 0;
        sim.dir = 1;
      } else if (sim.x > 1) {
        sim.x = 1;
        sim.dir = -1;
      }

      if (sim.y <= 0) {
        sim.y = 0;
        sim.vy = 0;
        if (phy.stuck) sim.mode = "ceiling";
      } else if (sim.y >= 1) {
        sim.y = 1;
        if (!reduceMotion && sim.vy > 0.45) {
          sim.vy = -sim.vy * 0.25;
          sim.impact = true;
        } else {
          sim.vy = 0;
          sim.mode = "floor";
          sim.impact = true;
        }
      }
    }

    if (sim.mode === "floor") {
      sim.y = 1;
      if (phy.stuck) {
        // Strong enough rear-fan downforce: leave the ground and climb to the ceiling.
        sim.mode = "air";
        sim.vy = -0.55;
        sim.impact = true;
      } else {
        sim.vy = 0;
      }
    }

    if (sim.demoClimb) {
      if (sim.demoWait > 0) {
        sim.demoWait -= dt;
      } else {
        sim.demoFan = Math.min(sim.demoTarget, sim.demoFan + 55 * dt);
        setFan(Math.round(sim.demoFan));
        if (sim.fan >= sim.demoTarget && sim.mode === "ceiling") {
          sim.demoClimb = false;
        }
      }
    }

    if (!reduceMotion) {
      sim.fanAngle = (sim.fanAngle + sim.fan * 8 * dt) % 360;
    }
  }

  function stageMetrics() {
    var stageH = stage.clientHeight;
    var ceilingH = stage.querySelector(".ceiling").offsetHeight;
    var floorH = stage.querySelector(".floor").offsetHeight;
    var svgH = svg.clientHeight || 150;
    var svgW = svg.clientWidth || 180;
    var wheelOffset = (WHEEL_BOTTOM / SVG_H) * svgH;
    var topY = ceilingH - wheelOffset - 4;
    var bottomY = stageH - floorH - svgH + 6;
    if (bottomY < topY) bottomY = topY;
    var arrowW = 120;
    var minX = 8;
    var maxX = Math.max(minX, stage.clientWidth - svgW - arrowW);
    return {
      topY: topY,
      bottomY: bottomY,
      minX: minX,
      maxX: maxX,
      svgW: svgW,
      svgH: svgH,
      stageH: stageH,
      floorH: floorH
    };
  }

  // Art is drawn for the ceiling (wheels at the top). Near the ground we flip it
  // upright so wheels sit on the floor, not above the roof.
  function isUpright() {
    if (sim.mode === "floor") return true;
    if (sim.mode === "ceiling") return false;
    return sim.y > 0.5;
  }

  function renderCar() {
    var m = stageMetrics();
    var px = m.minX + sim.x * (m.maxX - m.minX);
    var py = m.topY + sim.y * (m.bottomY - m.topY);
    var upright = isUpright();
    var tilt = 0;
    if (!reduceMotion && sim.mode === "air") tilt = Math.sin(sim.y * 10) * 2.5;
    if (sim.mode === "floor") tilt = 2;
    car.style.transform = "translate(" + px + "px, " + py + "px) rotate(" + tilt + "deg)";
    carBody.style.transform = upright ? "scaleY(-1)" : "scaleY(1)";
    car.classList.toggle("is-upright", upright);
    car.classList.toggle("is-inverted", !upright);

    fanSpins.forEach(function (fan) {
      fan.node.setAttribute("transform", fan.base + " rotate(" + sim.fanAngle + ")");
    });
    // Wheel spin direction follows travel; invert when the body is flipped upright.
    var wheelSpin = upright ? -sim.wheelAngle : sim.wheelAngle;
    wheelRear.setAttribute("transform", "rotate(" + wheelSpin + " 78 26)");
    wheelFront.setAttribute("transform", "rotate(" + wheelSpin + " 208 26)");
    var airOpacity = sim.fan <= 0 ? "0" : String(0.35 + (sim.fan / 100) * 0.65);
    airMarks.setAttribute("opacity", airOpacity);
    if (suctionMarks) suctionMarks.setAttribute("opacity", airOpacity);

    var phyArrow = physicsFromFan(sim.fan);
    var upH = (phyArrow.fill / 100) * ARROW_MAX;
    var downH = (phyArrow.weightFill / 100) * ARROW_MAX;
    document.getElementById("shaft-up").style.height = (phyArrow.F > 0 ? Math.max(upH, 8) : 0) + "px";
    document.getElementById("shaft-down").style.height = downH + "px";
    document.querySelector("#arrow-up .head").style.visibility = phyArrow.F > 0 ? "visible" : "hidden";
    document.getElementById("arrow-up").classList.toggle("is-low", !phyArrow.stuck);
    document.getElementById("arrow-hold").textContent = fmt(phyArrow.F_kgf, 0);

    var shadowY = m.stageH - m.floorH - 8;
    shadow.style.transform = "translate(" + (px + m.svgW * 0.5) + "px, " + shadowY + "px) scale(" + (0.55 + sim.y * 0.7) + ", 1)";
    shadow.style.opacity = String(0.12 + sim.y * 0.4);

    if (sim.impact) {
      sim.impact = false;
      burstDust(px + m.svgW * 0.5, py + m.svgH - 8);
    }
  }

  function fanOrigin() {
    var s = stage.getBoundingClientRect();
    var f = fanAnchor.getBoundingClientRect();
    return {
      x: f.left - s.left + f.width / 2,
      y: f.top - s.top + f.height / 2
    };
  }

  function renderParticles(dt) {
    var i;
    if (reduceMotion) {
      sim.particles.length = 0;
      sim.emitAcc = 0;
    } else if (sim.fan > 1) {
      var origin = fanOrigin();
      sim.emitAcc += (sim.fan / 100) * 34 * dt;
      while (sim.emitAcc >= 1 && sim.particles.length < 30) {
        sim.emitAcc -= 1;
        // Exhaust leaves the REAR outlet, mostly rearward.
        sim.particles.push({
          x: origin.x,
          y: origin.y + (Math.random() - 0.5) * 28,
          vx: 90 + sim.fan * 1.4 + Math.random() * 40,
          vy: (Math.random() - 0.35) * 36,
          life: 0,
          max: 0.38 + Math.random() * 0.28,
          wobble: Math.random() * Math.PI * 2
        });
      }
    } else {
      sim.emitAcc = 0;
    }

    var stageW = stage.clientWidth;
    var stageH = stage.clientHeight;
    var next = [];
    for (i = 0; i < sim.particles.length; i += 1) {
      var p = sim.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt + Math.sin(p.life * 9 + p.wobble) * 8 * dt;
      if (p.life < p.max && p.x < stageW - 8 && p.y < stageH - 20 && p.y > 8) next.push(p);
    }
    sim.particles = next;

    for (i = 0; i < puffNodes.length; i += 1) {
      var node = puffNodes[i];
      var particle = sim.particles[i];
      if (!particle) {
        node.style.display = "none";
        continue;
      }
      var t = particle.life / particle.max;
      node.style.display = "block";
      node.style.transform = "translate(" + particle.x + "px, " + particle.y + "px) scaleX(" + (1.1 + sim.fan / 180) + ")";
      node.style.opacity = String(1 - t);
    }

    var dustNext = [];
    for (i = 0; i < sim.dusts.length; i += 1) {
      var d = sim.dusts[i];
      d.life += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 80 * dt;
      if (d.life < d.max) dustNext.push(d);
    }
    sim.dusts = dustNext;
    for (i = 0; i < dustNodes.length; i += 1) {
      var dustNode = dustNodes[i];
      var dust = sim.dusts[i];
      if (!dust) {
        dustNode.style.display = "none";
        continue;
      }
      dustNode.style.display = "block";
      dustNode.style.transform = "translate(" + dust.x + "px, " + dust.y + "px)";
      dustNode.style.opacity = String(1 - dust.life / dust.max);
    }
  }

  function burstDust(x, y) {
    if (reduceMotion) return;
    var n;
    for (n = 0; n < 6; n += 1) {
      if (sim.dusts.length >= dustNodes.length) break;
      sim.dusts.push({
        x: x + (Math.random() - 0.5) * 70,
        y: y,
        vx: (Math.random() - 0.5) * 90,
        vy: -20 - Math.random() * 50,
        life: 0,
        max: 0.45
      });
    }
  }

  function renderReadouts() {
    var fan = sim.fan;
    var phy = physicsFromFan(fan);
    var copy = copyForState();
    var cmp = phy.F > WEIGHT_N ? ">" : phy.F < WEIGHT_N ? "<" : "=";
    var netN = phy.F - WEIGHT_N;
    var netText =
      "F_net = F − mg = " +
      fmt(netN / 1000, 2) +
      " kN (" +
      (netN > 0 ? "指向天花板" : netN < 0 ? "指向地面" : "平衡") +
      ")";
    var verdict = "F = " + fmt(phy.F_kN, 2) + " kN  " + cmp + "  mg = " + fmt(WEIGHT_N / 1000, 2) + " kN";
    var chartText =
      "工作點: Q = " +
      fmt(phy.Q, 2) +
      " m³/s, ΔP = " +
      fmt(phy.dP_kPa, 2) +
      " kPa, F = " +
      fmt(phy.F_kN, 2) +
      " kN. " +
      (phy.stuck ? "位於 F ≥ mg 區." : "位於 F < mg 區.");

    var key = [fan, sim.mode, copy.title, Math.sign(sim.vy)].join("|");
    if (key === lastReadout) {
      moveChartDot(phy);
      return;
    }
    lastReadout = key;

    document.getElementById("big-fan").textContent = String(fan);
    document.getElementById("q-num").textContent = fmt(phy.Q, 2);
    document.getElementById("q-liters").textContent = fmt(phy.Q_Ls, 0);
    document.getElementById("dp-num").textContent = fmt(phy.dP_kPa, 2);
    document.getElementById("hold-num").textContent = fmt(phy.F_kgf, 0);
    document.getElementById("hold-kn").textContent = fmt(phy.F_kN, 1);
    document.getElementById("vs-hold-num").textContent = fmt(phy.F_kgf, 0);
    document.getElementById("fan-fill").style.width = fan + "%";
    document.getElementById("q-fill").style.width = fan + "%";
    var holdFill = document.getElementById("hold-fill");
    holdFill.style.width = phy.fill + "%";
    holdFill.classList.toggle("is-low", !phy.stuck);
    var dpFill = document.getElementById("dp-fill");
    if (dpFill) {
      dpFill.style.width = phy.fill + "%";
      dpFill.classList.toggle("is-low", !phy.stuck);
    }
    var vsHold = document.getElementById("vs-hold");
    vsHold.style.height = phy.fill + "%";
    vsHold.classList.toggle("is-low", !phy.stuck);
    document.getElementById("vs-mid").textContent = cmp;
    document.getElementById("vs-mid").className = "vs-mid " + (phy.stuck ? "is-ok" : "is-bad");
    document.getElementById("verdict").textContent = verdict;
    document.getElementById("net").textContent = netText;
    document.getElementById("chart-now").textContent = chartText;
    document.getElementById("formula-live").textContent =
      "F = ΔP · A = " +
      fmt(phy.dP_kPa, 2) +
      " kPa × " +
      fmt(AREA_M2, 1) +
      " m² = " +
      fmt(phy.F_kN, 2) +
      " kN  (= " +
      fmt(phy.F_kgf, 0) +
      " kgf)";

    var status = document.getElementById("status");
    status.className = "status is-" + copy.tone;
    document.getElementById("status-title").textContent = copy.title;
    document.getElementById("status-body").textContent = copy.body;
    stage.className = "stage is-" + copy.tone;
    var pill = document.getElementById("stage-pill");
    pill.textContent = copy.pill;
    pill.className = "tag is-" + copy.tone;
    resetBtn.classList.toggle("is-needed", sim.mode === "floor" && !phy.stuck);

    moveChartDot(phy);

    var immediate = copy.title !== queueTitle;
    queueTitle = copy.title;
    queueLive(copy.body, immediate);
  }

  var queueTitle = "";

  function moveChartDot(phy) {
    if (!dot) return;
    var x = X(phy.fan);
    var y = Yforce(phy.F);
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("fill", phy.stuck ? "#0e7c66" : "#b42318");
    dotHalo.setAttribute("cx", x);
    dotHalo.setAttribute("cy", y);
    cursor.setAttribute("x1", x);
    cursor.setAttribute("x2", x);
    cursor.setAttribute("y1", y);
    cursor.setAttribute("y2", Yforce(0));
  }

  var livePrimed = false;

  function queueLive(text, immediate) {
    if (!livePrimed) {
      livePrimed = true;
      lastLive = text;
      return;
    }
    var send = function () {
      if (text === lastLive) return;
      lastLive = text;
      live.textContent = text;
    };
    clearTimeout(liveTimer);
    if (immediate) send();
    else liveTimer = setTimeout(send, 450);
  }

  function frame(now) {
    if (document.hidden) return;
    var dt = Math.min(0.05, (now - sim.last) / 1000);
    sim.last = now || performance.now();
    if (!dt || dt < 0) dt = 0.016;
    stepPhysics(dt);
    renderCar();
    renderParticles(dt);
    renderReadouts();
    requestAnimationFrame(frame);
  }

  function initWeights() {
    var weightFill = physicsFromFan(100).weightFill;
    document.querySelectorAll("[data-weight-kg]").forEach(function (el) {
      el.textContent = String(CAR_MASS_KG);
    });
    document.querySelectorAll("[data-weight-kn]").forEach(function (el) {
      el.textContent = fmt(WEIGHT_N / 1000, 1);
    });
    document.querySelectorAll("[data-area]").forEach(function (el) {
      el.textContent = fmt(AREA_M2, 1);
    });
    document.querySelectorAll("[data-q-max]").forEach(function (el) {
      el.textContent = fmt(Q_MAX, 1);
    });
    document.querySelectorAll("[data-q-stick]").forEach(function (el) {
      el.textContent = fmt(Q_STICK, 1);
    });
    document.getElementById("vs-weight-num").textContent = String(CAR_MASS_KG);
    document.getElementById("vs-weight").style.height = weightFill + "%";
    document.querySelectorAll(".vs-line, #gmark").forEach(function (el) {
      if (el.id === "gmark") el.style.left = weightFill + "%";
      else el.style.bottom = weightFill + "%";
    });
  }

  slider.addEventListener("input", function () {
    setFan(slider.value);
  });
  document.getElementById("fan-down").addEventListener("click", function () {
    setFan(sim.fan - 10);
  });
  document.getElementById("fan-up").addEventListener("click", function () {
    setFan(sim.fan + 10);
  });
  document.querySelectorAll("[data-fan]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setFan(btn.dataset.fan);
    });
  });
  resetBtn.addEventListener("click", resetSim);
  var groundBtn = document.getElementById("from-ground");
  if (groundBtn) {
    groundBtn.addEventListener("click", function () {
      playGroundToCeiling();
    });
  }
  var groundManualBtn = document.getElementById("place-ground");
  if (groundManualBtn) {
    groundManualBtn.addEventListener("click", function () {
      placeOnGround(20);
    });
  }

  if (motionQuery.addEventListener) {
    motionQuery.addEventListener("change", function (event) {
      reduceMotion = event.matches;
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      sim.last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  initWeights();
  buildChart();
  buildPools();
  setFan(75);
  renderCar();
  renderReadouts();
  requestAnimationFrame(frame);
})();
