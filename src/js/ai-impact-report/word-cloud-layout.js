/**
 * Word-cloud layout engine for the "Ideas we heard" chart.
 *
 * Ported from the design team's whirl-layout.js (2026-09-17 sketches) as an
 * ES module. Layout, seeding, candidate selection and DRAWING must stay in
 * step: the zero-overlap guarantee depends on drawWord() putting ink exactly
 * where the d3-cloud fork rasterized each label's collision mask.
 *
 *   const WL = createLayoutEngine({ rand, measureCtx });
 *   WL.wrapTwoLines / WL.textWidth
 *   WL.layoutWithD3Cloud(items, { width, height, padding, weight })
 *   WL.layoutFinaleBalanced(items, { width, height, padding, weight })
 *   WL.applySavedFinale(saved, items, width, height)
 *   WL.drawWord(ctx, lines, x, y, fontSize, weight, color, alpha, scale)
 *
 * Items need: label, lines (array of strings), fontSize, subtheme, w, h.
 * d3-cloud adds x, y relative to the field CENTRE.
 *
 * Only the "dense" Phase 2 packing is ported (the kept layout uses it); the
 * sketches' "designed" skeleton + hole-filling seeding was left behind.
 */
import cloud from "./vendor/d3-cloud-multiline.cjs";

const FONT_FAMILY = "'Noto Sans', Arial, sans-serif";
const FINALE_CANDIDATES = 32;
const FINALE_LARGE_N = 6;
// Two same-subtheme labels count as "touching" when the gap between their
// boxes is under SAME_SUBTHEME_GAP_EM times the larger font (floor in px).
const SAME_SUBTHEME_GAP_EM = 2.0;
const SAME_SUBTHEME_GAP_MIN = 24;

// Leading (line pitch, as a multiple of font size) for a wrapped label. A
// flat 1.22 leaves a bigger *absolute* gap between lines the larger the
// font gets, and that gap is genuinely blank in d3-cloud's pixel collision
// mask — nothing stops the packer from parking an unrelated small label in
// it (9/25 review: "Reimagine tort law" wedged inside "Set rules for AI /
// in the workplace"). Tightening leading as fontSize grows shrinks that
// band; small labels, where the gap was never a problem, keep the old 1.22.
// Must be applied identically everywhere a line pitch is computed: drawWord()
// below and the mask rasterizer in vendor/d3-cloud-multiline.cjs (wired up
// in runCloudLayoutSync via cloud.lineHeight()) — otherwise the drawn glyphs
// land somewhere the collision mask never reserved.
// Thresholds are tuned to this chart's actual range (poll fontSizes run
// roughly 11-41px at the "wide" preset; 1.08 barely nudged the 41px case,
// which is why the gap was still wide enough for another label — 9/25).
const LEADING_MAX = 1.22; // at/under LEADING_SMALL_PX, unchanged from before
const LEADING_MIN = 1.0; // at/over LEADING_LARGE_PX: baseline-to-baseline, no slack
const LEADING_SMALL_PX = 18;
const LEADING_LARGE_PX = 38;
function leadingFor(px) {
  if (px <= LEADING_SMALL_PX) return LEADING_MAX;
  if (px >= LEADING_LARGE_PX) return LEADING_MIN;
  const t = (px - LEADING_SMALL_PX) / (LEADING_LARGE_PX - LEADING_SMALL_PX);
  return LEADING_MAX + (LEADING_MIN - LEADING_MAX) * t;
}

// Collision padding (px added around a label's mask on every side, so two
// labels' visual gap is the sum of both their paddings) — same ramp as
// leading, over the same size range, but growing instead of shrinking: the
// big words are the ones that read as crowded, so give them a bit more
// breathing room. Small labels keep the original 2px so the dense fringe
// (185 items packed tight already) doesn't start dropping labels.
const PADDING_MIN = 2; // at/under LEADING_SMALL_PX, unchanged from before
const PADDING_MAX = 4; // at/over LEADING_LARGE_PX
function paddingFor(px) {
  if (px <= LEADING_SMALL_PX) return PADDING_MIN;
  if (px >= LEADING_LARGE_PX) return PADDING_MAX;
  const t = (px - LEADING_SMALL_PX) / (LEADING_LARGE_PX - LEADING_SMALL_PX);
  return PADDING_MIN + (PADDING_MAX - PADDING_MIN) * t;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createLayoutEngine({ rand, measureCtx }) {
  // ---- text measurement / wrapping ----------------------------------------
  const measCache = new Map();
  function fontStr(px, weight) {
    return `${weight || 400} ${px}px ${FONT_FAMILY}`;
  }
  function textWidth(text, px, weight) {
    const key = `${text}|${px}|${weight}`;
    let w = measCache.get(key);
    if (w === undefined) {
      measureCtx.font = fontStr(px, weight);
      w = measureCtx.measureText(text).width;
      measCache.set(key, w);
    }
    return w;
  }
  /** Wraps onto at most two lines at the space that best balances them. */
  function wrapTwoLines(text, px, weight, maxW) {
    if (textWidth(text, px, weight) <= maxW) return [text];
    const words = text.split(" ");
    if (words.length === 1) return [text];
    let best = [text];
    let bestMax = Number.POSITIVE_INFINITY;
    for (let i = 1; i < words.length; i++) {
      const l1 = words.slice(0, i).join(" ");
      const l2 = words.slice(i).join(" ");
      const w = Math.max(textWidth(l1, px, weight), textWidth(l2, px, weight));
      if (w < bestMax) {
        bestMax = w;
        best = [l1, l2];
      }
    }
    return best;
  }

  // ---- one synchronous d3-cloud run ---------------------------------------
  // d3-cloud completes its whole placement loop inside the first step() when
  // timeInterval is Infinity (the default), firing 'end' before start()
  // returns. Mutates items in place (x, y relative to the field centre).
  function runCloudLayoutSync(
    items,
    { width, height, padding, weight, keepSprites },
  ) {
    let placed = null;
    cloud()
      .keepSprites(!!keepSprites)
      .size([width, height])
      .words(items)
      .padding(padding)
      .rotate(() => 0)
      .font(FONT_FAMILY) // must match fontStr() byte for byte
      .fontWeight(weight)
      .fontSize((d) => d.fontSize)
      .lineHeight((d) => d.fontSize * leadingFor(d.fontSize))
      .text((d) => d.label)
      .random(rand)
      .on("end", (p) => {
        placed = p;
      })
      .start();
    if (!placed) throw new Error("d3-cloud did not complete synchronously");
    return placed;
  }

  function layoutWithD3Cloud(items, opts) {
    return runCloudLayoutSync(items, opts);
  }

  // ---- Phase 2: best of several candidate layouts -------------------------
  function finaleCandidateMetrics(items, placed, width, height) {
    const set = new Set(placed);
    const boxes = items
      .map((w) =>
        set.has(w)
          ? {
              w,
              cx: w.x + width / 2,
              cy: w.y + height / 2,
              hw: w.w / 2,
              hh: w.h / 2,
            }
          : null,
      )
      .filter(Boolean);
    let L = 0;
    let R = 0;
    let T = 0;
    let B = 0;
    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (const b of boxes) {
      const area = 4 * b.hw * b.hh;
      const bx0 = b.cx - b.hw;
      const bx1 = b.cx + b.hw;
      const by0 = b.cy - b.hh;
      const by1 = b.cy + b.hh;
      const leftFrac = clamp01((width / 2 - bx0) / (bx1 - bx0));
      const topFrac = clamp01((height / 2 - by0) / (by1 - by0));
      L += area * leftFrac;
      R += area * (1 - leftFrac);
      T += area * topFrac;
      B += area * (1 - topFrac);
      x0 = Math.min(x0, bx0);
      x1 = Math.max(x1, bx1);
      y0 = Math.min(y0, by0);
      y1 = Math.max(y1, by1);
    }
    const imbalance = Math.abs(L - R) / (L + R) + Math.abs(T - B) / (T + B);
    const fmax = Math.max(...items.map((w) => w.fontSize));
    let touching = 0;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.w.subtheme !== b.w.subtheme) continue;
        const gap = Math.max(
          Math.abs(a.cx - b.cx) - (a.hw + b.hw),
          Math.abs(a.cy - b.cy) - (a.hh + b.hh),
        );
        const need = Math.max(
          SAME_SUBTHEME_GAP_MIN,
          SAME_SUBTHEME_GAP_EM * Math.max(a.w.fontSize, b.w.fontSize),
        );
        if (gap < need)
          touching += (a.w.fontSize * b.w.fontSize) / (fmax * fmax);
      }
    }
    // Largest empty pocket inside the content bbox (largest empty square).
    const CELL = 20;
    const gw = Math.ceil(width / CELL);
    const gh = Math.ceil(height / CELL);
    const occ = new Uint8Array(gw * gh);
    for (const b of boxes) {
      const cx0 = Math.max(0, Math.floor((b.cx - b.hw) / CELL));
      const cx1 = Math.min(gw - 1, Math.floor((b.cx + b.hw) / CELL));
      const cy0 = Math.max(0, Math.floor((b.cy - b.hh) / CELL));
      const cy1 = Math.min(gh - 1, Math.floor((b.cy + b.hh) / CELL));
      for (let y = cy0; y <= cy1; y++)
        for (let x = cx0; x <= cx1; x++) occ[y * gw + x] = 1;
    }
    const gx0 = Math.ceil(x0 / CELL);
    const gx1 = Math.floor(x1 / CELL) - 1;
    const gy0 = Math.ceil(y0 / CELL);
    const gy1 = Math.floor(y1 / CELL) - 1;
    const sq = new Int16Array(gw * gh);
    let maxSq = 0;
    for (let y = gy0; y <= gy1; y++) {
      for (let x = gx0; x <= gx1; x++) {
        const i = y * gw + x;
        if (occ[i]) {
          sq[i] = 0;
          continue;
        }
        const up = y > gy0 ? sq[i - gw] : 0;
        const left = x > gx0 ? sq[i - 1] : 0;
        const diag = y > gy0 && x > gx0 ? sq[i - gw - 1] : 0;
        sq[i] = 1 + Math.min(up, left, diag);
        if (sq[i] > maxSq) maxSq = sq[i];
      }
    }
    const hole = maxSq * CELL;
    return {
      dropped: items.length - placed.length,
      imbalance,
      touching,
      hole,
      score: 3 * imbalance + 1 * touching + 6 * (hole / height),
      bbox: { x0, y0, x1, y1 },
    };
  }

  /** Dense packing seeds: every word starts near the centre; the largest
   * few are stacked in a column so same-colour big words never touch. */
  function seedFinaleDense(items, width, height) {
    const jitter = 0.02 * Math.min(width, height);
    for (const w of items) {
      w.seedX = width / 2 + (rand() - 0.5) * 2 * jitter;
      w.seedY = height / 2 + (rand() - 0.5) * 2 * jitter;
    }
    const bySize = items.slice().sort((a, b) => b.fontSize - a.fontSize);
    const centre = bySize[0];
    const GAP = 8;
    const above = [];
    const below = [];
    const heightOf = (stack) => stack.reduce((t, w) => t + w.h + GAP, 0);
    const outer = (stack) => (stack.length ? stack[stack.length - 1] : centre);
    const remaining = bySize.slice(1, FINALE_LARGE_N);
    const sides = [above, below];
    const capPerSide = 0.42 * height - centre.h / 2;
    for (let si = 0; remaining.length && si < 2 * FINALE_LARGE_N; si++) {
      const side = sides[si % 2];
      let idx = remaining.findIndex((w) => w.subtheme !== outer(side).subtheme);
      if (idx < 0) idx = 0;
      const w = remaining[idx];
      if (heightOf(side) + GAP + w.h > capPerSide) {
        if (heightOf(sides[(si + 1) % 2]) + GAP + w.h > capPerSide) break;
        continue;
      }
      remaining.splice(idx, 1);
      const off = centre.h / 2 + heightOf(side) + GAP + w.h / 2;
      w.seedX = width / 2 + (rand() - 0.5) * jitter;
      w.seedY = height / 2 + (side === above ? -off : off);
      side.push(w);
    }
  }

  function boxGap(a, b) {
    return Math.max(
      Math.abs(a.x - b.x) - (a.w + b.w) / 2,
      Math.abs(a.y - b.y) - (a.h + b.h) / 2,
    );
  }

  /** True when the two largest same-subtheme labels sit too close. */
  function biggestSamePairTouches(placed) {
    const bySize = placed.slice().sort((a, b) => b.fontSize - a.fontSize);
    for (let i = 0; i < bySize.length; i++) {
      const a = bySize[i];
      const b = bySize.find((w, j) => j > i && w.subtheme === a.subtheme);
      if (!b) continue;
      return (
        boxGap(a, b) <
        Math.max(SAME_SUBTHEME_GAP_MIN, SAME_SUBTHEME_GAP_EM * a.fontSize)
      );
    }
    return false;
  }

  function touchingPairs(placed, fmax) {
    const out = [];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        if (a.subtheme !== b.subtheme) continue;
        const need = Math.max(
          SAME_SUBTHEME_GAP_MIN,
          SAME_SUBTHEME_GAP_EM * Math.max(a.fontSize, b.fontSize),
        );
        if (boxGap(a, b) < need)
          out.push({ a, b, wgt: (a.fontSize * b.fontSize) / (fmax * fmax) });
      }
    }
    return out.sort((p, q) => q.wgt - p.wgt);
  }

  /** Repair pass: for each same-colour touching pair (worst first), pin every
   * other word where it is and re-seed the smaller word at a few alternative
   * spots or swap it with a like-sized word of another colour. Accept only
   * if every label still places and the touching total goes down. */
  function repairSameSubthemeAdjacency(items, best, runOpts) {
    const { width, height } = runOpts;
    const fmax = Math.max(...items.map((w) => w.fontSize));
    const apply = (pos) => {
      items.forEach((w, i) => {
        w.x = pos[i][0];
        w.y = pos[i][1];
      });
    };
    const total = (pairs) => pairs.reduce((t, p) => t + p.wgt, 0);
    let pos = best.pos.map((p) => p.slice());
    apply(pos);
    let pairs = touchingPairs(items, fmax);
    const stuck = new Set();
    for (let pass = 0; pass < 12 && pairs.length; pass++) {
      const pair = pairs.find((p) => !stuck.has(`${p.a.label}|${p.b.label}`));
      if (!pair) break;
      const mover = pair.a.fontSize <= pair.b.fontSize ? pair.a : pair.b;
      const other = mover === pair.a ? pair.b : pair.a;
      const cx = mover.x + width / 2;
      const cy = mover.y + height / 2;
      const ox = other.x + width / 2;
      const oy = other.y + height / 2;
      const tries = [
        [width - cx, height - cy],
        [2 * ox - cx, 2 * oy - cy],
        [cx, height - cy],
        [width - cx, cy],
        [width / 2, height * 0.15],
        [width / 2, height * 0.85],
        [width * 0.15, height / 2],
        [width * 0.85, height / 2],
      ];
      const partners = items
        .filter(
          (w) =>
            w !== mover &&
            w !== other &&
            w.subtheme !== mover.subtheme &&
            Math.abs(w.w - mover.w) / mover.w < 0.4 &&
            Math.abs(w.h - mover.h) / mover.h < 0.4,
        )
        .sort((p, q) => Math.abs(p.w - mover.w) - Math.abs(q.w - mover.w))
        .slice(0, 6);
      const before = total(pairs);
      let bestTry = null;
      const attempt = (setSeeds) => {
        items.forEach((w, i) => {
          w.x = undefined;
          w.y = undefined;
          w.seedX = pos[i][0] + width / 2;
          w.seedY = pos[i][1] + height / 2;
        });
        setSeeds();
        const placed = runCloudLayoutSync(items, runOpts);
        if (placed.length !== items.length) return;
        const after = total(touchingPairs(items, fmax));
        if (after < before - 1e-9 && (!bestTry || after < bestTry.after))
          bestTry = { after, pos: items.map((w) => [w.x, w.y]) };
      };
      for (const [tx, ty] of tries) {
        attempt(() => {
          mover.seedX = Math.min(
            Math.max(tx, mover.w / 2 + 4),
            width - mover.w / 2 - 4,
          );
          mover.seedY = Math.min(
            Math.max(ty, mover.h / 2 + 4),
            height - mover.h / 2 - 4,
          );
        });
      }
      for (const partner of partners) {
        attempt(() => {
          const pi = items.indexOf(partner);
          const mi = items.indexOf(mover);
          mover.seedX = pos[pi][0] + width / 2;
          mover.seedY = pos[pi][1] + height / 2;
          partner.seedX = pos[mi][0] + width / 2;
          partner.seedY = pos[mi][1] + height / 2;
        });
      }
      if (bestTry) {
        pos = bestTry.pos;
        apply(pos);
        pairs = touchingPairs(items, fmax);
      } else {
        stuck.add(`${pair.a.label}|${pair.b.label}`);
        apply(pos);
      }
    }
    apply(pos);
    const m = finaleCandidateMetrics(items, items, width, height);
    m.pos = pos;
    m.bigPairTouch = biggestSamePairTouches(items);
    return m;
  }

  /** Lay out the Phase 2 ideas: FINALE_CANDIDATES dense runs, keep the one
   * with no drops, the big same-colour pair apart, and the best score; then
   * repair small same-colour adjacencies and centre the result rigidly. */
  function layoutFinaleBalanced(items, opts) {
    const { width, height } = opts;
    let best = null;
    let fewestDrops = null;
    const runOpts = Object.assign({}, opts, { keepSprites: true });
    for (let k = 0; k < FINALE_CANDIDATES; k++) {
      for (const w of items) {
        w.x = undefined;
        w.y = undefined;
      }
      seedFinaleDense(items, width, height);
      const placed = runCloudLayoutSync(items, runOpts);
      const m = finaleCandidateMetrics(items, placed, width, height);
      m.pos = items.map((w) => (placed.includes(w) ? [w.x, w.y] : null));
      m.bigPairTouch = biggestSamePairTouches(placed);
      if (!fewestDrops || m.dropped < fewestDrops.dropped) fewestDrops = m;
      if (m.dropped === 0) {
        const better =
          !best ||
          (best.bigPairTouch && !m.bigPairTouch) ||
          (best.bigPairTouch === m.bigPairTouch && m.score < best.score);
        if (better) best = m;
      }
    }
    if (!best) {
      console.warn(
        `ideas cloud: no candidate placed all ${items.length} labels; using the one with fewest drops (${fewestDrops.dropped}).`,
      );
      best = fewestDrops;
    }
    if (best.dropped === 0)
      best = repairSameSubthemeAdjacency(items, best, runOpts);
    for (const w of items) w.sprite = undefined;
    const dx = Math.round(width / 2 - (best.bbox.x0 + best.bbox.x1) / 2);
    const dy = Math.round(height / 2 - (best.bbox.y0 + best.bbox.y1) / 2);
    items.forEach((w, i) => {
      const p = best.pos[i];
      if (p) {
        w.x = p[0] + dx;
        w.y = p[1] + dy;
      }
    });
    return items.filter((w, i) => best.pos[i]);
  }

  // ---- drawing ------------------------------------------------------------
  /** Renders at the exact anchor the fork rasterized the collision mask at:
   * alphabetic baseline, lineHeight = fontSize * leadingFor(fontSize), lines
   * left-aligned to x - floor(maxLineWidth / 2). Any deviation draws ink the
   * mask never covered and can produce overlaps. */
  function drawWord(ctx, lines, x, y, fontSize, weight, color, alpha, scale) {
    if (alpha <= 0.008) return;
    const k = scale || 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = fontStr(fontSize * k, weight);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const maxLineWidth = Math.max(
      ...lines.map((l) => ctx.measureText(l).width),
    );
    const anchorX = x - Math.floor(maxLineWidth / 2);
    const lh = fontSize * k * leadingFor(fontSize);
    const startY = (-(lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, anchorX, y + startY + i * lh);
    });
  }

  /** Width of a fixed probe string in the font actually in use. Stored with a
   * kept layout and compared on load so positions computed with Noto Sans are
   * never applied while a fallback font is rendering. */
  function fontProbe() {
    return (
      Math.round(
        textWidth("Hold AI companies liable for harm they cause", 40, 700) *
          100,
      ) / 100
    );
  }
  /** Apply a kept Phase 2 layout if it was made for this field, these labels,
   * these line breaks and font sizes, in this font. Returns true if applied. */
  function applySavedFinale(saved, items, width, height) {
    if (
      !saved ||
      !saved.field ||
      saved.field.w !== width ||
      saved.field.h !== height
    )
      return false;
    if (
      saved.fontProbe != null &&
      Math.abs(saved.fontProbe - fontProbe()) > 0.75
    )
      return false;
    if (!Array.isArray(saved.items) || saved.items.length !== items.length)
      return false;
    const byLabel = new Map(saved.items.map((s) => [s.label, s]));
    for (const w of items) {
      const s = byLabel.get(w.label);
      if (
        !s ||
        Math.abs(s.fontSize - w.fontSize) > 0.01 ||
        s.lines.join("\n") !== w.lines.join("\n")
      )
        return false;
    }
    for (const w of items) {
      const s = byLabel.get(w.label);
      w.x = s.x;
      w.y = s.y;
    }
    return true;
  }

  return {
    textWidth,
    wrapTwoLines,
    leadingFor,
    paddingFor,
    layoutWithD3Cloud,
    layoutFinaleBalanced,
    applySavedFinale,
    fontProbe,
    drawWord,
  };
}
