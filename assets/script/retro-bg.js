(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var DEG = Math.PI / 180;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var whenPreloaded = window.whenPreloaded || function (fn) { fn(); };

  // Projection constants were fitted against the gridlines of the reference poster (735x919 space).
  var GLOBE = { cx: 572.5, cy: 312.1, r: 154.9, tilt: 10.33 * DEG, roll: 23.49 * DEG, latStep: 15, meridians: 24, periodMs: 120000 };
  var RING = {
    tilt: 10 * DEG,
    roll: 24 * DEG,
    camera: 18,
    bands: [[2.24, 2.39], [2.58, 2.94], [3.08, 3.67]],
    segments: 120,
    hatch: 48,
    periodMs: 360000
  };
  // Flat colour bands around the ring, each starting at the given longitude (degrees).
  var RING_BANDS = [
    [-180, '#4a628f'], [-140, '#3f9a92'], [-62, '#4a628f'], [-44, '#6a4f96'], [-26, '#c0447e'],
    [-10, '#e8445e'], [95, '#c0447e'], [130, '#6a4f96'], [160, '#4a628f']
  ];
  var FRAME_MS = 1000 / 30;

  function toScreen(sx, sy, roll, z) {
    var c = Math.cos(roll);
    var s = Math.sin(roll);
    return { x: sx * c - sy * s + GLOBE.cx, y: sx * s + sy * c + GLOBE.cy, z: z };
  }

  function globePoint(lat, lon) {
    var x = Math.cos(lat) * Math.sin(lon);
    var y = Math.sin(lat);
    var z = Math.cos(lat) * Math.cos(lon);
    var y2 = y * Math.cos(GLOBE.tilt) - z * Math.sin(GLOBE.tilt);
    var z2 = y * Math.sin(GLOBE.tilt) + z * Math.cos(GLOBE.tilt);
    return toScreen(GLOBE.r * x, -GLOBE.r * y2, GLOBE.roll, z2);
  }

  function ringPoint(radius, lon) {
    var x = radius * Math.sin(lon);
    var z = radius * Math.cos(lon);
    var y2 = -z * Math.sin(RING.tilt);
    var z2 = z * Math.cos(RING.tilt);
    var k = RING.camera / (RING.camera - z2);
    return toScreen(GLOBE.r * x * k, -GLOBE.r * y2 * k, RING.roll, z2);
  }

  function fmt(p) {
    return p.x.toFixed(1) + ' ' + p.y.toFixed(1);
  }

  function polyline(points, visible) {
    var d = '';
    var pen = false;
    points.forEach(function (p) {
      if (!visible(p)) {
        pen = false;
        return;
      }
      d += (pen ? 'L' : 'M') + fmt(p);
      pen = true;
    });
    return d;
  }

  function ringColor(lonDeg) {
    for (var i = RING_BANDS.length - 1; i > 0; i--) {
      if (lonDeg >= RING_BANDS[i][0]) return RING_BANDS[i][1];
    }
    return RING_BANDS[0][1];
  }

  function setPath(pair, d) {
    pair[0].setAttribute('d', d);
    pair[1].setAttribute('d', d);
  }

  function inkTwin(el, thin) {
    var ink = el.cloneNode(false);
    ink.setAttribute('class', thin ? 'ink-line thin' : 'ink-line');
    el.parentNode.insertBefore(ink, el);
    return [el, ink];
  }

  function drawLatitudes(path) {
    var d = '';
    for (var lat = -90 + GLOBE.latStep; lat < 90; lat += GLOBE.latStep) {
      var pts = [];
      for (var lon = 0; lon <= 360; lon += 4) pts.push(globePoint(lat * DEG, lon * DEG));
      d += polyline(pts, function (p) { return p.z > 0; });
    }
    path.setAttribute('d', d);
  }

  function drawMeridians(pair, phase) {
    var d = '';
    for (var m = 0; m < GLOBE.meridians; m++) {
      var lon = phase + (m * 2 * Math.PI) / GLOBE.meridians;
      var pts = [];
      for (var lat = -90; lat <= 90; lat += 4) pts.push(globePoint(lat * DEG, lon));
      d += polyline(pts, function (p) { return p.z > 0; });
    }
    setPath(pair, d);
  }

  function drawRingStatic(back, front) {
    var step = (2 * Math.PI) / RING.segments;
    RING.bands.forEach(function (band) {
      for (var i = 0; i < RING.segments; i++) {
        var a0 = -Math.PI + i * step;
        var a1 = a0 + step;
        var mid = ringPoint((band[0] + band[1]) / 2, a0 + step / 2);
        var color = ringColor((a0 + step / 2) / DEG);
        var seg = document.createElementNS(SVG_NS, 'path');
        seg.setAttribute('d', 'M' + fmt(ringPoint(band[0], a0)) + 'L' + fmt(ringPoint(band[1], a0)) +
          'L' + fmt(ringPoint(band[1], a1)) + 'L' + fmt(ringPoint(band[0], a1)) + 'Z');
        seg.setAttribute('fill', color);
        seg.setAttribute('stroke', color);
        seg.setAttribute('stroke-width', '0.6');
        (mid.z > 0 ? front : back).fills.appendChild(seg);
      }
    });

    var backD = '';
    var frontD = '';
    RING.bands.forEach(function (band) {
      band.forEach(function (radius) {
        var pts = [];
        for (var lon = -180; lon <= 180; lon += 1.5) pts.push(ringPoint(radius, lon * DEG));
        backD += polyline(pts, function (p) { return p.z <= 0; });
        frontD += polyline(pts, function (p) { return p.z >= 0; });
      });
    });
    back.outline.setAttribute('d', backD);
    front.outline.setAttribute('d', frontD);
  }

  function drawRingHatch(back, front, phase) {
    var backD = '';
    var frontD = '';
    RING.bands.forEach(function (band) {
      for (var k = 0; k < RING.hatch; k++) {
        var lon = phase + (k * 2 * Math.PI) / RING.hatch;
        var p0 = ringPoint(band[0], lon);
        var p1 = ringPoint(band[1], lon);
        var seg = 'M' + fmt(p0) + 'L' + fmt(p1);
        if (p0.z + p1.z > 0) frontD += seg;
        else backD += seg;
      }
    });
    setPath(back.hatch, backD);
    setPath(front.hatch, frontD);
  }

  function ringLayer(root, name) {
    var group = root.querySelector('.ring-' + name);
    return {
      fills: group.querySelector('.ring-fills'),
      outline: group.querySelector('.ring-outline'),
      hatch: group.querySelector('.ring-hatch')
    };
  }

  function initPoster() {
    var poster = document.querySelector('.poster');
    if (!poster) return;
    var meridians = poster.querySelector('.globe-mer');
    var back = ringLayer(poster, 'back');
    var front = ringLayer(poster, 'front');

    var latitudes = poster.querySelector('.globe-lat');
    drawLatitudes(latitudes);
    drawRingStatic(back, front);
    inkTwin(latitudes);
    inkTwin(poster.querySelector('.globe-rim'));
    inkTwin(back.outline);
    inkTwin(front.outline);
    poster.querySelectorAll('.poster-line').forEach(function (line) {
      inkTwin(line);
    });
    meridians = inkTwin(meridians);
    back.hatch = inkTwin(back.hatch, true);
    front.hatch = inkTwin(front.hatch, true);

    function render(now) {
      drawMeridians(meridians, ((now / GLOBE.periodMs) % 1) * 2 * Math.PI);
      drawRingHatch(back, front, ((now / RING.periodMs) % 1) * 2 * Math.PI);
    }

    render(0);
    if (reduceMotion) return;

    var last = 0;
    requestAnimationFrame(function frame(now) {
      if (now - last >= FRAME_MS) {
        last = now;
        render(now);
      }
      requestAnimationFrame(frame);
    });
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  var STAR_LAYERS = [
    { name: 'far', share: 0.55, size: 1, colors: ['#7d7768', '#a39c88'] },
    { name: 'mid', share: 0.3, size: 2, colors: ['#a39c88', '#cfc7b0'] },
    { name: 'near', share: 0.15, size: 3, colors: ['#cfc7b0', '#f2ead3'] }
  ];

  function buildStars() {
    var first = document.querySelector('.star-layer');
    var width = first.offsetWidth / 2;
    var height = Math.max(first.offsetHeight, window.screen.height || 0);
    var total = Math.round(Math.min(560, Math.max(120, (width * window.innerHeight) / 2500)));

    STAR_LAYERS.forEach(function (cfg) {
      var layer = document.querySelector('.star-layer[data-stars="' + cfg.name + '"]');
      var shadows = [];
      var count = Math.round(total * cfg.share);
      for (var i = 0; i < count; i++) {
        var x = Math.round(rand(0, width));
        var y = Math.round(rand(0, height));
        var color = cfg.colors[i % cfg.colors.length];
        shadows.push(x + 'px ' + y + 'px ' + color);
        shadows.push((x + width) + 'px ' + y + 'px ' + color);
      }
      var dots = document.createElement('i');
      dots.className = 'star-dots';
      dots.style.width = cfg.size + 'px';
      dots.style.height = cfg.size + 'px';
      dots.style.boxShadow = shadows.join(',');
      layer.textContent = '';
      layer.appendChild(dots);
    });

    var near = document.querySelector('.star-layer[data-stars="near"]');
    var twinkles = Math.round(total / 18);
    for (var t = 0; t < twinkles; t++) {
      var tx = rand(0, width);
      var ty = rand(0, window.innerHeight);
      var style = '--tw:' + rand(1.2, 3.2).toFixed(2) + 's;--td:-' + rand(0, 3).toFixed(2) + 's;top:' + Math.round(ty) + 'px;';
      [tx, tx + width].forEach(function (left) {
        var star = document.createElement('i');
        star.className = 'star-twinkle';
        star.style.cssText = style + 'left:' + Math.round(left) + 'px';
        near.appendChild(star);
      });
    }
    return width;
  }

  function initStars() {
    if (!document.querySelector('.star-layer')) return;
    var lastWidth = buildStars();
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (document.querySelector('.star-layer').offsetWidth / 2 !== lastWidth) lastWidth = buildStars();
      }, 250);
    });
  }

  function initParallax() {
    var cosmos = document.getElementById('cosmos');
    if (!cosmos) return;
    var layers = Array.prototype.map.call(cosmos.querySelectorAll('[data-depth]'), function (el) {
      return { el: el, depth: Number(el.getAttribute('data-depth')) };
    });
    var ticking = false;

    function update() {
      var vh = window.innerHeight;
      var y = Math.min(window.scrollY, vh * 2.5);
      cosmos.style.setProperty('--dim', Math.min(window.scrollY / vh, 1).toFixed(3));
      if (!reduceMotion) {
        layers.forEach(function (layer) {
          layer.el.style.transform = 'translate(0px,' + (-y * layer.depth).toFixed(1) + 'px)';
        });
      }
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function initReveals() {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      observer.observe(el);
    });
  }

  // Lissajous loop (3:2) keeps the rocket roaming the whole background; it turns to face its direction of travel.
  function initShip() {
    var ship = document.querySelector('.ship-fly');
    var cosmos = document.getElementById('cosmos');
    if (!ship) return;
    if (reduceMotion) {
      ship.hidden = true;
      return;
    }
    var PERIOD_MS = 46000;
    var start = performance.now();

    requestAnimationFrame(function frame(now) {
      var w = cosmos.clientWidth;
      var h = cosmos.clientHeight;
      var size = ship.offsetWidth;
      var t = ((now - start) / PERIOD_MS) * 2 * Math.PI;
      var ax = (w - size) / 2;
      var ay = (h - size) / 2 * 0.85;
      var x = w / 2 + ax * Math.sin(3 * t) - size / 2;
      var y = h / 2 + ay * Math.sin(2 * t + Math.PI / 4) - size / 4;
      var dx = 3 * ax * Math.cos(3 * t);
      var dy = 2 * ay * Math.cos(2 * t + Math.PI / 4);
      var angle = Math.atan2(dy, dx) * 180 / Math.PI;
      ship.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + angle.toFixed(1) + 'deg)';
      requestAnimationFrame(frame);
    });
  }

  initPoster();
  initShip();
  initStars();
  initParallax();
  whenPreloaded(initReveals);
})();
