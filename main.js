/* Upside-down fan car.
   Shared scale: fan output 0-100 equals the upward force on the car.
   Weight is fixed. The car stays on the ceiling only when hold >= weight.
   The fan pushes air away from the ceiling. It does not vacuum the car up. */
(function () {
  "use strict";

  var WEIGHT = 60;
  var FALL_MASS = 36;
  var DRIVE_SPEED = 0.16;
  var ARROW_MAX = 78;
  var SVG_H = 196;
  var WHEEL_BOTTOM = 54;
  var THUMB = 44;

  var C = { w: 360, h: 230, l: 48, r: 58, t: 16, b: 36 };

  var stage = document.getElementById("stage");
  var car = document.getElementById("car");
  var svg = car.querySelector(".car-svg");
  var shadow = document.getElementById("shadow");
  var particleLayer = document.getElementById("particles");
  var fanAnchor = document.getElementById("fan-anchor");
  var blades = document.getElementById("blades");
  var wheelRear = document.getElementById("wheel-rear");
  var wheelFront = document.getElementById("wheel-front");
  var airMarks = document.getElementById("air-marks");
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
    impact: false
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

  function holdForce(fan) {
    return fan;
  }

  function X(v) {
    return C.l + (v / 100) * (C.w - C.l - C.r);
  }

  function Y(v) {
    return C.t + (1 - v / 100) * (C.h - C.t - C.b);
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function buildChart() {
    var stick = svgEl("rect", {
      x: X(0),
      y: Y(100),
      width: X(100) - X(0),
      height: Y(WEIGHT) - Y(100),
      fill: "#d9f3ea"
    });
    var fall = svgEl("rect", {
      x: X(0),
      y: Y(WEIGHT),
      width: X(100) - X(0),
      height: Y(0) - Y(WEIGHT),
      fill: "#f8d2cc"
    });
    var axisX = svgEl("line", {
      x1: X(0),
      y1: Y(0),
      x2: X(100),
      y2: Y(0),
      stroke: "#17202b",
      "stroke-width": 2
    });
    var axisY = svgEl("line", {
      x1: X(0),
      y1: Y(0),
      x2: X(0),
      y2: Y(100),
      stroke: "#17202b",
      "stroke-width": 2
    });
    var gravity = svgEl("line", {
      x1: X(0),
      y1: Y(WEIGHT),
      x2: X(100),
      y2: Y(WEIGHT),
      stroke: "#c2410c",
      "stroke-width": 3,
      "stroke-dasharray": "7 5"
    });
    var relation = svgEl("line", {
      x1: X(0),
      y1: Y(0),
      x2: X(100),
      y2: Y(100),
      stroke: "#0e7c66",
      "stroke-width": 3
    });
    var cross = svgEl("circle", {
      cx: X(WEIGHT),
      cy: Y(WEIGHT),
      r: 5,
      fill: "#fffdf8",
      stroke: "#c2410c",
      "stroke-width": 3
    });
    cursor = svgEl("line", {
      x1: X(75),
      y1: Y(75),
      x2: X(75),
      y2: Y(0),
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

    [0, WEIGHT, 100].forEach(function (tick) {
      var tx = svgEl("text", { x: X(tick), y: Y(0) + 20, "text-anchor": "middle", class: "tick" });
      tx.textContent = String(tick);
      chart.appendChild(tx);
      var ty = svgEl("text", { x: X(0) - 8, y: Y(tick) + 4, "text-anchor": "end", class: "tick" });
      ty.textContent = String(tick);
      chart.appendChild(ty);
    });

    var xName = svgEl("text", { x: (X(0) + X(100)) / 2, y: C.h - 4, "text-anchor": "middle", class: "axis-name" });
    xName.textContent = "風扇輸出";
    var yName = svgEl("text", { x: 16, y: 14, class: "axis-name" });
    yName.textContent = "力";
    var gName = svgEl("text", { x: X(100) + 8, y: Y(WEIGHT) + 5, class: "axis-name" });
    gName.textContent = "重力";

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
    slider.setAttribute("aria-valuetext", fan + "%, 貼天花力 " + fan + ", 重力 " + WEIGHT);
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
  }

  function copyForState() {
    var fan = sim.fan;
    var nums = "風扇輸出 " + fan + ", 貼天花力 " + fan + ", 重力 " + WEIGHT + ". ";
    if (sim.mode === "floor") {
      if (fan >= WEIGHT) {
        return {
          tone: "bad",
          title: "已經落地",
          pill: "落地",
          body: nums + "吸力夠大, 不過要撳重置先返上天花."
        };
      }
      return {
        tone: "bad",
        title: "跌咗",
        pill: "跌咗",
        body: nums + "風扇太細力, 吸力細過重力, 跌咗!"
      };
    }
    if (sim.mode === "ceiling" && fan >= WEIGHT) {
      if (fan === WEIGHT) {
        return {
          tone: "ok",
          title: "啱啱夠",
          pill: "貼住",
          body: nums + "吸力同重力一樣大, 可以倒掛!"
        };
      }
      return {
        tone: "ok",
        title: "可以倒掛",
        pill: "貼住行緊",
        body: nums + "吸力夠大, 頂住重力, 可以倒掛!"
      };
    }
    if (fan >= WEIGHT && sim.vy < -0.05) {
      return {
        tone: "ok",
        title: "推返上天花",
        pill: "升緊",
        body: nums + "吸力夠大, 淨力推向天花."
      };
    }
    if (fan >= WEIGHT) {
      return {
        tone: "warn",
        title: "減速中",
        pill: "減速",
        body: nums + "吸力已經大過重力, 架車減速緊."
      };
    }
    var gap = WEIGHT - fan;
    var title = gap >= 25 ? "跌得快" : gap >= 8 ? "跌緊" : "慢慢跌";
    return {
      tone: "bad",
      title: title,
      pill: title,
      body: nums + "風扇太細力, 吸力細過重力, 跌緊!"
    };
  }

  function stepPhysics(dt) {
    var hold = holdForce(sim.fan);
    var netDown = WEIGHT - hold;

    if (sim.mode === "ceiling") {
      if (hold >= WEIGHT) {
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
        if (hold >= WEIGHT) sim.mode = "ceiling";
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
      sim.vy = 0;
    }

    if (!reduceMotion) {
      sim.fanAngle = (sim.fanAngle + sim.fan * 8 * dt) % 360;
    }
  }

  function stageMetrics() {
    var stageH = stage.clientHeight;
    var ceilingH = stage.querySelector(".ceiling").offsetHeight;
    var floorH = stage.querySelector(".floor").offsetHeight;
    var svgRect = svg.getBoundingClientRect();
    var svgH = svgRect.height || 150;
    var svgW = svgRect.width || 180;
    var wheelOffset = (WHEEL_BOTTOM / SVG_H) * svgH;
    var topY = ceilingH - wheelOffset - 4;
    var bottomY = stageH - floorH - svgH + 10;
    if (bottomY < topY) bottomY = topY;
    var arrowW = 86;
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

  function renderCar() {
    var m = stageMetrics();
    var px = m.minX + sim.x * (m.maxX - m.minX);
    var py = m.topY + sim.y * (m.bottomY - m.topY);
    var tilt = 0;
    if (!reduceMotion && sim.mode === "air") tilt = Math.sin(sim.y * 10) * 2.5;
    if (sim.mode === "floor") tilt = -3;
    car.style.transform = "translate(" + px + "px, " + py + "px) rotate(" + tilt + "deg)";

    blades.setAttribute("transform", "rotate(" + sim.fanAngle + " 122 152)");
    wheelRear.setAttribute("transform", "rotate(" + sim.wheelAngle + " 62 34)");
    wheelFront.setAttribute("transform", "rotate(" + sim.wheelAngle + " 186 34)");
    airMarks.setAttribute("opacity", sim.fan <= 0 ? "0" : String(0.35 + (sim.fan / 100) * 0.65));

    var hold = holdForce(sim.fan);
    var upH = (hold / 100) * ARROW_MAX;
    var downH = (WEIGHT / 100) * ARROW_MAX;
    document.getElementById("shaft-up").style.height = Math.max(upH, hold > 0 ? 6 : 0) + "px";
    document.getElementById("shaft-down").style.height = downH + "px";
    document.getElementById("arrow-up").classList.toggle("is-low", hold < WEIGHT);
    document.getElementById("arrow-hold").textContent = String(hold);

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
        sim.particles.push({
          x: origin.x + (Math.random() - 0.5) * 22,
          y: origin.y,
          vy: 70 + sim.fan * 1.6 + Math.random() * 50,
          life: 0,
          max: 0.42 + Math.random() * 0.28,
          wobble: Math.random() * Math.PI * 2
        });
      }
    } else {
      sim.emitAcc = 0;
    }

    var stageH = stage.clientHeight;
    var next = [];
    for (i = 0; i < sim.particles.length; i += 1) {
      var p = sim.particles[i];
      p.life += dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.life * 9 + p.wobble) * 12 * dt;
      if (p.life < p.max && p.y < stageH - 28) next.push(p);
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
      node.style.transform = "translate(" + particle.x + "px, " + particle.y + "px) scaleY(" + (0.7 + sim.fan / 200) + ")";
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
    var hold = holdForce(fan);
    var copy = copyForState();
    var cmp = hold > WEIGHT ? "大過" : hold < WEIGHT ? "細過" : "等於";
    var net = hold - WEIGHT;
    var netText = net > 0 ? "淨力: 吸力贏 " + net : net < 0 ? "淨力: 重力贏 " + (-net) : "淨力: 打和";
    var verdict = "吸力 " + hold + " " + cmp + " 重力 " + WEIGHT;
    var chartText;
    if (hold > WEIGHT) chartText = "而家個點: 風扇輸出 " + fan + ", 貼天花力 " + hold + ". 個點高過重力線, 所以貼得住.";
    else if (hold < WEIGHT) chartText = "而家個點: 風扇輸出 " + fan + ", 貼天花力 " + hold + ". 個點低過重力線, 所以會跌.";
    else chartText = "而家個點: 風扇輸出 " + fan + ", 貼天花力 " + hold + ". 個點啱啱喺重力線上.";

    var key = [fan, sim.mode, copy.title, Math.sign(sim.vy)].join("|");
    if (key === lastReadout) {
      moveChartDot(fan, hold);
      return;
    }
    lastReadout = key;

    document.getElementById("big-fan").textContent = String(fan);
    document.getElementById("fan-num").textContent = fan + "%";
    document.getElementById("hold-num").textContent = String(hold);
    document.getElementById("vs-hold-num").textContent = String(hold);
    document.getElementById("fan-fill").style.width = fan + "%";
    var holdFill = document.getElementById("hold-fill");
    holdFill.style.width = hold + "%";
    holdFill.classList.toggle("is-low", hold < WEIGHT);
    var vsHold = document.getElementById("vs-hold");
    vsHold.style.height = hold + "%";
    vsHold.classList.toggle("is-low", hold < WEIGHT);
    document.getElementById("vs-mid").textContent = cmp;
    document.getElementById("vs-mid").className = "vs-mid " + (hold >= WEIGHT ? "is-ok" : "is-bad");
    document.getElementById("verdict").textContent = verdict;
    document.getElementById("net").textContent = netText;
    document.getElementById("chart-now").textContent = chartText;

    var status = document.getElementById("status");
    status.className = "status is-" + copy.tone;
    document.getElementById("status-title").textContent = copy.title;
    document.getElementById("status-body").textContent = copy.body;
    stage.className = "stage is-" + copy.tone;
    var pill = document.getElementById("stage-pill");
    pill.textContent = copy.pill;
    pill.className = "tag is-" + copy.tone;
    resetBtn.classList.toggle("is-needed", sim.mode === "floor");

    moveChartDot(fan, hold);

    var immediate = copy.title !== queueTitle;
    queueTitle = copy.title;
    queueLive(copy.body, immediate);
  }

  var queueTitle = "";

  function moveChartDot(fan, hold) {
    if (!dot) return;
    var x = X(fan);
    var y = Y(hold);
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("fill", hold >= WEIGHT ? "#0e7c66" : "#b42318");
    dotHalo.setAttribute("cx", x);
    dotHalo.setAttribute("cy", y);
    cursor.setAttribute("x1", x);
    cursor.setAttribute("x2", x);
    cursor.setAttribute("y1", y);
    cursor.setAttribute("y2", Y(0));
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
    document.querySelectorAll("[data-weight]").forEach(function (el) {
      el.textContent = String(WEIGHT);
    });
    document.getElementById("vs-weight").style.height = WEIGHT + "%";
    document.querySelectorAll(".vs-line, #gmark").forEach(function (el) {
      if (el.id === "gmark") el.style.left = WEIGHT + "%";
      else el.style.bottom = WEIGHT + "%";
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
