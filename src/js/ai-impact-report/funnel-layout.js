/**
 * Pure, DOM-free layout math for the "Who participated" participant funnel.
 * participant-funnel.js only draws and animates what this module computes.
 *
 * Ported from the design team's standalone sketch (participant-funnel/
 * funnel-layout.js, itself a cut-down port of funnelCloud.ts, personGlyph.ts
 * and palette.ts in the EngagedCA AI_Deliberations viz repo). Stage copy
 * lives in the .mmmd file, not here. Everything is deterministic given the
 * same data and SEED, so the same input always produces the same picture.
 *
 * Stages (0-based):
 *   0 Phase 1       drifting cloud of every survey respondent
 *   1 Selected      invited respondents bright, the rest dim
 *   2 Phase 2       attendees gather as person glyphs, the rest fall away
 *   3 Conversations attendees split into one orbiting ring per session
 *
 * Data shape (see /public/data/ai-report-participant-funnel.json):
 *   phase1Total: number
 *   regions:     [{ name, surveyCount, attendCount }]
 *   fieldOfWork: [{ name, surveyCount, attendCount }]
 *   sessions:    [{ date, attendees: [{ region, fieldOfWork }] }]
 *   invitedByRegion: [{ name, count }]
 *   invitedTotal: number
 */

// ---- Person glyph -------------------------------------------------------

/** One <path>, from design/noun_person_8354641.svg's 1200x1200 viewBox. */
export const PERSON_PATH =
  "m362.48 350.02c0-63 25.031-123.42 69.562-167.95 44.578-44.531 104.95-69.562 167.95-69.562s123.37 25.031 167.95 69.562c44.531 44.531 69.562 104.95 69.562 167.95 0 62.953-25.031 123.37-69.562 167.9-44.578 44.578-104.95 69.562-167.95 69.562s-123.37-24.984-167.95-69.562c-44.531-44.531-69.562-104.95-69.562-167.9zm272.02 262.5h-69c-94.266 0.09375-184.6 37.594-251.26 104.25-66.609 66.656-104.11 156.98-104.25 251.26 0.046874 37.453 25.641 70.031 62.016 78.984 107.25 26.953 217.4 40.547 327.98 40.5 110.58 0.046876 220.74-13.547 327.98-40.5 36.375-8.9531 61.969-41.531 62.016-78.984-0.14063-94.266-37.641-184.6-104.25-251.26-66.656-66.656-156.98-104.16-251.26-104.25z";

/** The path's own bounding box, so scaling happens around the glyph's true center. */
export const PERSON_BOX = {
  x: 209.99,
  y: 112.5,
  w: 780.02,
  h: 974.99,
  cx: 600,
  cy: 600,
};

/** How much taller than a dot's diameter the person glyph is drawn. Tuned
 * against the tightest seat spacing; raise only with the overlap re-checked. */
const PERSON_SCALE = 1.55;

export function personHeightFor(r) {
  return PERSON_SCALE * 2 * r;
}

export function personWidthFor(r) {
  return personHeightFor(r) * (PERSON_BOX.w / PERSON_BOX.h);
}

// ---- Labels -------------------------------------------------------------

/** Greedy word wrap using an estimated per-character width. A single word
 * wider than the limit gets its own line rather than being split. */
export function wrapLabel(text, maxWidthPx, charWidthPx) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length * charWidthPx > maxWidthPx) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ---- Palette ------------------------------------------------------------

/** Engaged California design-system categorical hues, in assignment order. */
export const DATA_VIZ_CAT = [
  "#53cab0",
  "#65ade1",
  "#c591da",
  "#ee9930",
  "#6d4884",
  "#e45d48",
  "#6c8043",
  "#a9d4f2",
  "#75bc60",
  "#f2c3c7",
];

/** Overflow hues, used only once a dimension has more than 10 real categories. */
const DATA_VIZ_CAT_LIGHTER = [
  "#7fa1c2",
  "#f4cea1",
  "#a395d5",
  "#eca995",
  "#98decd",
  "#ecac67",
  "#abccde",
  "#75bc60",
  "#c591da",
];

/** Non-answers share one neutral instead of spending a hue. */
export const DATA_VIZ_NEUTRAL_LIGHT = "#bcbbc1";

const NON_ANSWER = new Set([
  "(not stated)",
  "Not stated",
  "I don't want to say",
  "Non-response",
]);

export function isNonAnswer(value) {
  return NON_ANSWER.has(value);
}

/** One color per category name, in the given order. Non-answers get the
 * neutral; everything else takes the next hue from the ramp. */
export function assignCategoryColors(values) {
  const ramp = DATA_VIZ_CAT.concat(DATA_VIZ_CAT_LIGHTER);
  let cursor = 0;
  return values.map((value) => {
    if (isNonAnswer(value)) return DATA_VIZ_NEUTRAL_LIGHT;
    const color = ramp[cursor % ramp.length];
    cursor++;
    return color;
  });
}

// ---- Cloud layout -------------------------------------------------------

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Seeded Fisher-Yates. */
function shuffle(arr, rand) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Expand counts into a bag of category names, then shuffle. */
function proportionalDraw(counts, rand) {
  const bag = [];
  for (const c of counts) {
    for (let k = 0; k < c.count; k++) bag.push(c.name);
  }
  return shuffle(bag, rand);
}

export const CANVAS = { W: 1040, H: 812 };
export const CX = CANVAS.W / 2;
const CLOUD_Y = 285;
const GATHER_Y = 505;
const NECK_Y = 455;
export const CY = 435;
const BLOBS = 9;

/** Each cluster's internal seat pitch. 20 keeps every cluster clear of its
 * neighbours at the real 14-session layout. */
const SEAT_SPACING = 20;

/** Dot radius at the cloud and ring stages, canvas px. */
export const DOT_SIZE = 3.4;

// Pulse mode tuning (slow rotation plus radial breathing).
const PULSE_AMPLITUDE = 0.08;
const PULSE_ROTATE_FRACTION = 0.08;
const PULSE_PERIOD_BASE = 8.8;
const PULSE_PERIOD_JITTER = 0.3;

/** Gap between a two-ring cluster's rings. Must clear a stacked pair's full
 * glyph height so a moment of alignment never reads as one seat swallowing another. */
const RING_GAP = personHeightFor(6) + 8;

/** Pinned so the cloud's shape does not reshuffle on every reload. */
const SEED = 20250825;

function buildBlobs(rand) {
  const blobs = [];
  for (let i = 0; i < BLOBS; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand());
    blobs.push({
      x: CX + Math.cos(a) * rr * 300,
      y: CLOUD_Y + Math.sin(a) * rr * 96,
      sx: 78 + rand() * 118,
      sy: 36 + rand() * 46,
    });
  }
  return blobs;
}

function packed(n, cx, cy, radius) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt((i + 0.5) / n);
    const a = i * 2.39996323;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export function orbitRings(n) {
  const single = Math.max(20, (n * SEAT_SPACING) / (2 * Math.PI));
  if (single <= 46) return [{ r: single, count: n, rate: 1 }];
  const inner = Math.max(3, Math.round(n * 0.35));
  const rIn = Math.max(20, (inner * SEAT_SPACING) / (2 * Math.PI));
  return [
    { r: rIn, count: inner, rate: 1.4 },
    { r: rIn + RING_GAP, count: n - inner, rate: 1 },
  ];
}

/**
 * Builds the full deterministic dot and cluster layout.
 *
 * Every kept dot carries one real attendee's actual (region, fieldOfWork)
 * pair, so toggling the color dimension never looks like it swapped who
 * attended. Only the dropped dots get region and field of work drawn
 * independently, proportional to the survey counts left after subtracting
 * the real attendees from each category.
 */
export function buildFunnelCloud(data) {
  const rand = mulberry32(SEED);

  const attendCountByRegion = {};
  for (const r of data.regions) attendCountByRegion[r.name] = r.attendCount;

  const droppedRegionCounts = data.regions.map((r) => ({
    name: r.name,
    count: r.surveyCount - r.attendCount,
  }));
  const droppedFieldOfWorkCounts = data.fieldOfWork.map((f) => ({
    name: f.name,
    count: f.surveyCount - f.attendCount,
  }));

  const keptTotal = data.sessions.reduce(
    (sum, s) => sum + s.attendees.length,
    0,
  );

  const droppedRegions = proportionalDraw(droppedRegionCounts, rand);
  const droppedFieldOfWork = proportionalDraw(droppedFieldOfWorkCounts, rand);

  // Blobs, jitter and fall targets are assigned uniformly; a dot's category
  // never affects where it sits, only its color.
  const blobs = buildBlobs(rand);
  const dots = [];
  for (let i = 0; i < data.phase1Total; i++) {
    const b = blobs[i % BLOBS];
    const bx = clamp(b.x + gauss(rand) * b.sx, 70, CANVAS.W - 70);
    const by = clamp(b.y + gauss(rand) * b.sy, 152, 432);
    dots.push({
      cloud: {
        x: bx,
        y: by,
        ax: 7 + rand() * 15,
        ay: 5 + rand() * 11,
        fx: 0.25 + rand() * 0.55,
        fy: 0.2 + rand() * 0.5,
        px: rand() * Math.PI * 2,
        py: rand() * Math.PI * 2,
      },
      fall: [bx + gauss(rand) * 60, CANVAS.H + 70 + rand() * 180],
      neck: [CX + gauss(rand) * 16, NECK_Y],
      gather: [0, 0],
      kept: false,
      invited: false,
      region: "",
      fieldOfWork: "",
      group: -1,
      orbit: null,
    });
  }

  // Dropped dots' categories first, then overwrite kept slots with real attendees.
  let droppedCursor = 0;
  const allIndices = [];
  for (let idx = 0; idx < data.phase1Total; idx++) allIndices.push(idx);
  const keptIndices = shuffle(allIndices, rand).slice(0, keptTotal);
  const keptSet = new Set(keptIndices);
  for (let d = 0; d < data.phase1Total; d++) {
    if (keptSet.has(d)) continue;
    dots[d].region = droppedRegions[droppedCursor];
    dots[d].fieldOfWork = droppedFieldOfWork[droppedCursor];
    droppedCursor++;
  }

  // Sessions arrive chronologically; that order becomes ring position,
  // earliest at the top, clockwise.
  const clusters = data.sessions.map((s, g) => {
    const rings = orbitRings(s.attendees.length);
    const maxR = Math.max(...rings.map((r) => r.r));
    return {
      n: s.attendees.length,
      rings,
      rc: maxR + 7,
      ang: -Math.PI / 2 + g * ((Math.PI * 2) / data.sessions.length),
      x: 0,
      y: 0,
      date: s.date,
      pulsePhase: rand() * Math.PI * 2,
      pulsePeriod:
        PULSE_PERIOD_BASE *
        (1 - PULSE_PERIOD_JITTER / 2 + rand() * PULSE_PERIOD_JITTER),
    };
  });
  const maxRc = Math.max(...clusters.map((c) => c.rc));
  const ringRadius = Math.min(
    214,
    Math.max(150, (data.sessions.length * (2 * maxRc + 24)) / (2 * Math.PI)),
  );
  for (const cl of clusters) {
    cl.x = CX + Math.cos(cl.ang) * ringRadius;
    cl.y = CY + Math.sin(cl.ang) * ringRadius;
  }

  // Seat every real attendee: one kept dot per attendee, with that
  // attendee's real category pair and its orbit seat.
  let keptCursor = 0;
  const flatKeptOrder = [];
  data.sessions.forEach((s, g) => {
    const rings = clusters[g].rings;
    let seatCursor = 0;
    for (const ring of rings) {
      for (let k = 0; k < ring.count; k++, seatCursor++) {
        const dotIdx = keptIndices[keptCursor++];
        const attendee = s.attendees[seatCursor];
        const dot = dots[dotIdx];
        dot.kept = true;
        dot.region = attendee.region;
        dot.fieldOfWork = attendee.fieldOfWork;
        dot.group = g;
        dot.orbit = {
          r: ring.r,
          rate: ring.rate,
          a0:
            clusters[g].ang + Math.PI + (seatCursor / ring.count) * Math.PI * 2,
        };
        flatKeptOrder.push(dotIdx);
      }
    }
  });

  // Gather positions handed out in ring order so the bloom fans out cleanly.
  const gatherPositions = packed(
    keptTotal,
    CX,
    GATHER_Y,
    7 * Math.sqrt(keptTotal) * 2.5,
  );
  const seatsByAngle = gatherPositions
    .map((p) => {
      let a = Math.atan2(p[1] - GATHER_Y, p[0] - CX) + Math.PI / 2;
      if (a < 0) a += Math.PI * 2;
      return { p, a };
    })
    .sort((u, v) => u.a - v.a);
  flatKeptOrder.forEach((dotIdx, k) => {
    dots[dotIdx].gather = seatsByAngle[k].p;
  });

  // Every kept dot was invited; extend "invited" to a proportional draw of
  // dropped dots per region up to that region's invited quota. Runs last so
  // earlier draws keep their deterministic shape.
  const invitedQuotaByRegion = {};
  for (const r of data.invitedByRegion) invitedQuotaByRegion[r.name] = r.count;
  const droppedIndicesByRegion = {};
  dots.forEach((dot, i) => {
    if (dot.kept) {
      dot.invited = true;
      return;
    }
    if (!droppedIndicesByRegion[dot.region])
      droppedIndicesByRegion[dot.region] = [];
    droppedIndicesByRegion[dot.region].push(i);
  });
  for (const region of Object.keys(droppedIndicesByRegion)) {
    const indices = droppedIndicesByRegion[region];
    const extra = Math.max(
      0,
      (invitedQuotaByRegion[region] || 0) - (attendCountByRegion[region] || 0),
    );
    for (const i of shuffle(indices, rand).slice(0, extra))
      dots[i].invited = true;
  }

  return {
    dots,
    clusters,
    ringRadius,
    phase1Total: data.phase1Total,
    keptTotal,
    invitedTotal: data.invitedTotal,
  };
}

function cloudPosition(dot, clock, driftSpeed) {
  return [
    dot.cloud.x +
      Math.sin(clock * dot.cloud.fx * driftSpeed * 3 + dot.cloud.px) *
        dot.cloud.ax,
    dot.cloud.y +
      Math.cos(clock * dot.cloud.fy * driftSpeed * 3 + dot.cloud.py) *
        dot.cloud.ay,
  ];
}

/** "orbit" is a steady rotation; "pulse" rotates slowly while breathing in
 * and out, in sync across a cluster. */
export function orbitPosition(dot, cluster, clock, orbitSpeed, mode) {
  if (!dot.orbit) return [cluster.x, cluster.y];
  if (mode === "pulse") {
    const a =
      dot.orbit.a0 +
      clock * orbitSpeed * dot.orbit.rate * PULSE_ROTATE_FRACTION;
    const breathe =
      1 +
      PULSE_AMPLITUDE *
        Math.sin(
          (clock / cluster.pulsePeriod) * Math.PI * 2 + cluster.pulsePhase,
        );
    const r = dot.orbit.r * breathe;
    return [cluster.x + Math.cos(a) * r, cluster.y + Math.sin(a) * r];
  }
  const a2 = dot.orbit.a0 + clock * orbitSpeed * dot.orbit.rate;
  return [
    cluster.x + Math.cos(a2) * dot.orbit.r,
    cluster.y + Math.sin(a2) * dot.orbit.r,
  ];
}

/** Where a dot should be, and how it should look, at a given stage. */
export function dotTarget(
  dot,
  stage,
  dimension,
  clusters,
  clock,
  driftSpeed,
  orbitSpeed,
  motionMode,
) {
  const category = dot[dimension];
  const [cloudX, cloudY] = cloudPosition(dot, clock, driftSpeed);

  if (stage === 0) {
    return {
      x: cloudX,
      y: cloudY,
      r: DOT_SIZE,
      alpha: 0.62,
      categoryKey: category,
      person: false,
    };
  }
  if (stage === 1) {
    return dot.invited
      ? {
          x: cloudX,
          y: cloudY,
          r: DOT_SIZE,
          alpha: 1,
          categoryKey: category,
          person: false,
        }
      : {
          x: cloudX,
          y: cloudY,
          r: DOT_SIZE,
          alpha: 0.1,
          categoryKey: "__dropped",
          person: false,
        };
  }
  if (stage === 2) {
    return dot.kept
      ? {
          x: dot.gather[0],
          y: dot.gather[1],
          viaX: dot.neck[0],
          viaY: dot.neck[1],
          r: 7,
          alpha: 1,
          categoryKey: category,
          person: true,
        }
      : {
          x: dot.fall[0],
          y: dot.fall[1],
          r: DOT_SIZE,
          alpha: 0,
          categoryKey: "__dropped",
          person: false,
        };
  }
  if (stage === 3 && dot.kept && dot.group >= 0) {
    const pos = orbitPosition(
      dot,
      clusters[dot.group],
      clock,
      orbitSpeed,
      motionMode,
    );
    return {
      x: pos[0],
      y: pos[1],
      r: 6,
      alpha: 1,
      categoryKey: category,
      person: false,
    };
  }
  return {
    x: dot.fall[0],
    y: dot.fall[1],
    r: DOT_SIZE,
    alpha: 0,
    categoryKey: "__dropped",
    person: false,
  };
}

// ---- Stage timing helpers ---------------------------------------------

export const STAGE_COUNT = 4;

export function easeInOut(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Header crossfade tracking the stage transition progress t (0-1). */
export function headerCrossfade(t) {
  const k = easeInOut(Math.min(1, t * 1.6));
  return { k, useTo: k >= 0.5, opacity: Math.abs(k - 0.5) * 2 };
}

/** Vertical extent of each stage's dot content, measured from the layout. */
export function stageBands(layout) {
  let cloudTop = Number.POSITIVE_INFINITY;
  let cloudBottom = Number.NEGATIVE_INFINITY;
  for (const dot of layout.dots) {
    cloudTop = Math.min(cloudTop, dot.cloud.y - dot.cloud.ay - DOT_SIZE);
    cloudBottom = Math.max(cloudBottom, dot.cloud.y + dot.cloud.ay + DOT_SIZE);
  }
  const cloudBand = { top: cloudTop, bottom: cloudBottom };

  const GATHER_DOT_R = 7;
  let gatherTop = Number.POSITIVE_INFINITY;
  let gatherBottom = Number.NEGATIVE_INFINITY;
  for (const dot of layout.dots) {
    if (!dot.kept) continue;
    const half = personHeightFor(GATHER_DOT_R) / 2;
    gatherTop = Math.min(gatherTop, dot.gather[1] - half);
    gatherBottom = Math.max(gatherBottom, dot.gather[1] + half);
  }
  const gatherBand = { top: gatherTop, bottom: gatherBottom };

  let ringTop = Number.POSITIVE_INFINITY;
  let ringBottom = Number.NEGATIVE_INFINITY;
  for (const cl of layout.clusters) {
    ringTop = Math.min(ringTop, cl.y - cl.rc);
    ringBottom = Math.max(ringBottom, cl.y + cl.rc);
  }
  const ringBand = { top: ringTop, bottom: ringBottom };

  return [cloudBand, cloudBand, gatherBand, ringBand];
}

/** Per-stage y offset that centers each band on the same line. */
export function stageYShift(bands, dotTop, dotBottom) {
  const target = (dotTop + dotBottom) / 2;
  return bands.map((b) => target - (b.top + b.bottom) / 2);
}

// ---- Legend height reservation ------------------------------------------

/**
 * Renders the legend for every dimension once, measures each, and pins the
 * element's min-height to the tallest. Toggling dimensions then changes
 * colors only; nothing below the legend moves. Re-run on resize.
 *
 * @param {HTMLElement} legendEl
 * @param {string[]} dimensions
 * @param {(dimension: string) => void} renderFor  renders the legend for a dimension
 * @param {string} current  dimension to leave rendered afterwards
 */
export function reserveLegendHeight(legendEl, dimensions, renderFor, current) {
  if (!legendEl) return;
  legendEl.style.minHeight = "";
  let tallest = 0;
  for (const d of dimensions) {
    renderFor(d);
    tallest = Math.max(tallest, legendEl.getBoundingClientRect().height);
  }
  renderFor(current);
  legendEl.style.minHeight = `${Math.ceil(tallest)}px`;
}
