/* Rocket ACTION: prototype (design doc Step 7).
   Vanilla JS, no framework, no build, no CDN. Every number on screen comes from
   window.RDI (fixtures.js): literals here are labels and copy only. */
(function () {
"use strict";

const RDI = window.RDI;
if (!RDI) { document.getElementById("main").innerHTML = '<div class="loading">fixtures.js missing: run `python3 tools/build_fixtures.py`</div>'; return; }

/* ---------- tiny helpers ---------- */
const $ = (s, el) => (el || document).querySelector(s);
const h = (tag, attrs, ...kids) => {
  if (attrs && attrs.nodeType) { kids.unshift(attrs); attrs = null; }
  const parts = String(tag).split(/(?=[.#])/);
  const el = document.createElement(parts[0]);
  const idp = parts.find((p) => p.startsWith("#"));
  const cls = parts.slice(1).filter((p) => p.startsWith("."));
  if (idp) el.id = idp.slice(1);
  if (cls.length) el.className = cls.map((c) => c.slice(1)).join(" ");
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, k);
    else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  }
  for (const kid of kids.flat(3)) {
    if (kid === null || kid === undefined) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
};
const svgNS = "http://www.w3.org/2000/svg";
const S = (tag, attrs, ...kids) => {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const kid of kids.flat(3)) if (kid) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
};
const fmt = {
  usd: (v, dec = 0) => (v < 0 ? "-" : "") + "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: dec, minimumFractionDigits: dec }),
  usdM: (v) => "$" + (v / 1e6).toFixed(2) + "M",
  num: (v, d = 2) => (v === null || v === undefined ? "n/a" : Number(v).toLocaleString("en-US", { maximumFractionDigits: d })),
  pct: (v, d = 1) => (v === null || v === undefined ? "n/a" : (v > 0 ? "+" : "") + Number(v).toFixed(d) + "%"),
  p: (v) => (v === null || v === undefined ? "n/a" : v < 0.0001 ? "<0.0001" : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".0")),
};
const chip = (txt, cls) => h("span", { class: "chip " + (cls || "") }, txt);
// Plain-language reading of each rail card: what kind of money the dollars are, and
// what the platform wants to do about them. Keyed by the insight's dominant value lens
// (its largest lens_usd bucket); claim strength follows evidence class. Wording always
// names the study's own comparison as the counterfactual, never an outside peer
// benchmark (PRD: mix differs between books).
const MONEY_SAY = {
  occupancy: { strong: "of rent never collected", weak: "of rent that appears never to be collected" },
  turnover: { strong: "of move-out cost your own comparable homes don't pay", weak: "of move-out cost above what your own comparable homes show" },
  noi: { strong: "of NOI left on the table", weak: "of NOI that appears to be left on the table" },
  capex: { strong: "of spend your own comparison says buys nothing", weak: "of spend associated with no measurable return" },
  retention: { strong: "of renewal income the comparison says is recoverable", weak: "of renewal income that appears recoverable" },
};
// Lifecycle statuses that still print the estimate. Refusal endings (manipulated,
// refuted, guardrail_stopped, inconclusive) live in railSay because they change the
// money clause itself, not just the advice.
const NEXT_SAY = {
  new: "Validate with an experiment.",
  design_stage: "Design stage: no readout yet.",
  in_design: "Experiment in flight.",
  running: "Experiment in flight.",
  continue: "Interim readout; still running.",
  validated: "Tested and validated; the value is in the ledger.",
  underpowered: "Underpowered; more units before anything can be claimed.",
};
const topLens = (i) => Object.entries(i.lens_usd || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
const moneySay = (i, forceWeak) => {
  const say = MONEY_SAY[topLens(i)] || { strong: "of measurable upside", weak: "of measurable upside" };
  return forceWeak || i.evidence_class === "descriptive" ? say.weak : say.strong;
};
// Sentence is a function of (evidence_class, status) so the money clause can never
// assert what the status clause denies: refusals print no live number, refuted frames
// the number as the dead claim, underpowered marks it provisional.
const railSay = (i) => {
  if (i.status === "manipulated") return "Impact withheld: homes sort around the line; no number is published.";
  if (i.status === "inconclusive") return "No estimate to show: the assignment check failed, so a number here would be meaningless.";
  if (i.status === "guardrail_stopped") return "Stopped early by a guardrail; the guardrail is the finding. No full estimate yet.";
  if (i.status === "refuted")
    return Number.isFinite(i.annual_impact_usd)
      ? `Refuted: the claim of ${fmt.usd(i.annual_impact_usd)} ${moneySay(i, true)} did not survive testing. Kept visible on purpose.`
      : "Refuted: the claim did not survive testing. Kept visible on purpose.";
  if (!Number.isFinite(i.annual_impact_usd)) return "Impact not yet priced. " + (NEXT_SAY[i.status] || "See the readout.");
  const usd = fmt.usd(i.annual_impact_usd);
  if (i.status === "underpowered") return `Provisional estimate, not a claim: ${usd} ${moneySay(i, true)}. ${NEXT_SAY.underpowered}`;
  return usd + " " + moneySay(i) + ". " + (NEXT_SAY[i.status] || "See the readout.");
};
// Source status labels describe DELIVERY only (did the export arrive in its window),
// never completeness, so they cannot be read as "all good".
const SRC_LABEL = { healthy: "on time", degraded: "late", stale: "not arriving", standby: "standby", new: "new feed" };
const LENS_GLOSS = { noi: "net operating income per home", turnover: "cost per move-out", occupancy: "vacancy loss / lease-up speed", retention: "renewals (re-leasing avoided)", capex: "capital spend" };
const RUNNING_GLOSS = { make_ready_estimate: "make-ready estimate ($)", condition_score: "inspection condition score (0-10)", days_on_market: "days on market", days_vacant: "days vacant", days_to_expiry_at_review: "days to lease expiry at review", work_order_estimate: "work-order estimate ($)", unit_age_years: "unit age (years)", delinquency_days: "days delinquent", lead_response_hours: "lead response (hours)", lease_term_months: "lease term (months)", marketing_budget_per_listing: "marketing budget per listing ($)", sqft_band: "home size (sqft)", pool_service_estimate: "pool-service estimate ($)", hoa_fee: "HOA fee ($)" };
const cutoffLabel = (v) => (v < 10 || !Number.isInteger(v)
  ? v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  : fmt.num(v));
const POLICY_QUESTIONS = {
  P1: "When the make-ready estimate crosses $2,500, a home gets a full renovation instead of the standard make-ready. Does that change NOI / home?",
  P2: "When an inspection scores a home above 7.0, it gets new floors instead of keeping its existing floors. Does that change NOI / home?",
  P3: "When a listing passes 21 days on market, the home gets a professional photo refresh. Does that change Days to lease?",
  P4: "When a vacancy runs past 30 days, the home gets a rent concession. Does that change Concession days / lease?",
  P5: "When a lease enters its final 90 days, the resident gets a renewal offer. Does that change Renewal rate?",
  P6: "When a work order tops $900, it is routed to the national vendor program. Does that change NOI / home?",
  P7: "When an HVAC unit is older than 46 and a half years, it is replaced instead of repaired on failure. Does that change NOI / home?",
  P8: "When a balance passes 30 days delinquent, the account goes to collections. Does that change NOI / home?",
  P9: "When a tour request goes unanswered for 24 hours, the lead escalates. Does that change NOI / home?",
  P10: "When a lease term goes above 12 months, extended-term pricing applies instead of standard pricing. Does that change NOI / home?",
  P11: "When a listing's marketing budget tops $120, it gets boosted marketing. Does that change NOI / home?",
  P12: "When a home is above 2,200 sqft, it gets the premium renovation tier. Does that change NOI / home?",
  P13: "When a pool-service estimate tops $200, the property gets the premium schedule. Does that change NOI / home?",
  P14: "When HOA fees run above $120, applicants face enhanced screening. Does that change NOI / home?",
};
const POLICY_TODO = {
  P1: "TODO: raise the line and A/B-test the new cutoff, submarket by submarket",
  P2: "TODO: randomized pilot - flip a coin at the line",
  P3: "TODO: standardize the day-21 photo refresh",
  P4: "TODO: roll out with an effective-rent guardrail",
  P5: "TODO: standardize the 90-day renewal offer",
  P6: "TODO: adopt routing; renegotiate program rates",
  P7: "TODO: re-test next season as the fleet ages",
  P8: "TODO: compare regions against each other - don't randomize collections",
  P9: "TODO: A/B the escalation or retire it",
  P10: "TODO: switchback-test the pricing tier market-by-market, not resident-by-resident",
  P11: "TODO: switch boosted marketing by submarket switchback",
  P12: "TODO: A/B the size-band tier or retire it",
  P13: "TODO: A/B the premium schedule or retire it",
  P14: "TODO: weigh screening against its cost",
};
const UNIT_BY_ID = Object.fromEntries(Object.values(RDI.metricCatalog).flat().map((m) => [m.id, m.unit]));
const NAME_BY_ID = Object.fromEntries(Object.values(RDI.metricCatalog).flat().map((m) => [m.id, m.name]));
const metricLabel = (id) => NAME_BY_ID[id] ?? id;
// fUnit contract: catalog units are usd|usd/yr|usd/mo -> fmt.usd; % and pp -> one decimal; days* -> "days".
const metricUnit = (id) => UNIT_BY_ID[id] ?? "";
const fUnit = (id, v, signed = true) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "n/a";
  const u = metricUnit(id), a = Math.abs(v);
  // % and pp values arrive already in percentage points (compute_rd.py multiplies rate outcomes by 100; unit "pp").
  const t = u === "usd/mo" ? fmt.usd(a) + "/mo"
    : u === "usd/yr" ? fmt.usd(a) + "/yr"
    : u === "usd" ? fmt.usd(a)
    : (u === "%" || u === "pp") ? a.toFixed(1) + (u === "pp" ? " pp" : "%")
    : fmt.num(a, 1) + (u.startsWith("days") ? " days" : "");
  return (v < 0 ? "-" : signed && v > 0 ? "+" : "") + t;
};
const sw = (c) => h("span.sw", { style: "background:" + c });
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n)));
  const err = (span / n) / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = step * mult, ticks = [];
  for (let t = Math.ceil(lo / s) * s; t <= hi + 1e-9; t += s) ticks.push(t);
  return ticks;
}

/* ============================================================
   STATE
   ============================================================ */
const state = {
  weights: { ...RDI.thesis.weights },
  live: false,            // /api/health ok + key present
  liveEnabled: true,      // presenter toggle: allow /api/steer to reach the live model this session
  benchmarkOn: !!(window.RDI && RDI.benchmark && RDI.benchmark.enabled_default),  // opt-in starts where the fixture says (off)
  checked: false,         // health check completed
  offline: false,         // no server reachable (file:// path)
  lastSteer: null,        // applied steering payload (survives re-render)
  registered: [],         // designs registered this session
  mapMode: "map",
  designSel: { constraints: {} },   // design lab constraint checkboxes (session state)
  railRefresh: null,      // in-place refresh hooks set by viewMap
};

/* ranking recomputed from stored components (doc Step 5):
   value = Σ w_lens × lens_usd[lens];
   confidence = evidence_weight × coverage_factor × (0.5 + 0.5 × agreement);
   agreement (doc Step 5) = clamp(1 − |realized − predicted| / max(|predicted|, 1), 0, 1)
   when a prior exists, else 1. The ledger row of the insight's measured action is the
   carrier of that prior's predicted/realized pair (doc v9(g)). */
const EV_W = { descriptive: 0.45, quasi_experimental: 0.75, experimental: 1.0 };
function coverageOf(sub) {
  const c = RDI.dataHealth.coverage.find((x) => x.submarket_id === sub);
  return c ? c.pct / 100 : 1;
}
const LEDGER_BY_ACTION = {};
for (const r of RDI.ledger) (LEDGER_BY_ACTION[r.action_id] ||= []).push(r);
const MEASURED_ACTION = {};
for (const a of RDI.actions)
  if (a.insight_id && LEDGER_BY_ACTION[a.id]) MEASURED_ACTION[a.insight_id] ||= a.id;
function rankParts(i, w = state.weights) {
  const vc = Object.keys(w).reduce((s, k) => s + w[k] * (i.lens_usd[k] || 0), 0);
  let agree = 1;
  if (i.prior_effect !== null && i.prior_effect !== undefined) {
    const rows = LEDGER_BY_ACTION[MEASURED_ACTION[i.id]] || [];
    if (rows.length) {
      const pred = rows.reduce((s, r) => s + r.predicted_usd, 0);
      const real = rows.reduce((s, r) => s + r.realized_usd, 0);
      agree = Math.max(0, Math.min(1, 1 - Math.abs(real - pred) / Math.max(Math.abs(pred), 1)));
    }
  }
  const conf = (EV_W[i.evidence_class] ?? 0.45) * coverageOf(i.submarket) * (0.5 + 0.5 * agree);
  return { vc, conf, score: vc * conf, agree };
}
function rankedInsights(w = state.weights) {
  /* PRD hard rule: only experimental insights top the rail. Evidence class is the
     PRIMARY sort key (experimental > quasi > descriptive); refuted always last.
     Score orders within a class. */
  const tier = (i) => (i.status === "refuted" ? -1 : EV_W[i.evidence_class] ?? 0.45);
  return RDI.insights
    .map((i) => ({ i, ...rankParts(i, w) }))
    .sort((a, b) => tier(b.i) - tier(a.i) || b.score - a.score);
}
function normalizeWeights(w = state.weights) {
  const s = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(w)) w[k] = w[k] / s;
  return w;
}

/* ============================================================
   NAV + ROUTER
   ============================================================ */
const ROUTES = [
  // Narrative order = the demo walk, in four chapters (the nav prints the chapter
  // headers): where data comes from -> what AI mined from it -> what was tested and
  // what came back -> what it is all worth. Future edits: keep the chapters.
  ["data", "Data health", "#/data", "Provenance"],
  ["policy", "Policy natural experiment", "#/policy/P1", "AI mined"],
  ["map", "Insights map", "#/map", "AI mined"],
  ["insight", "Insight detail", "#/insight/I1", "AI mined"],
  ["design", "Design lab", "#/design/I1", "Experiment"],
  ["ledger", "Ledger", "#/ledger", "Experiment"],
  ["readout", "Result", "#/readout/E1", "Experiment"],
  ["loop", "Evidence loop", "#/loop", "Experiment"],
  ["opportunity", "Total opportunity", "#/opportunity", "Forecast"],
];
function renderNav() {
  const root = $("#nav-items");
  root.innerHTML = "";
  const hash = location.hash || "#/data";
  let prevGroup = null;
  ROUTES.forEach(([key, label, href, group], ix) => {
    if (group && group !== prevGroup) {
      root.append(h("div.navgroup", null, group));
      prevGroup = group;
    }
    const active = key === "insight" ? hash.startsWith("#/insight/")
      : key === "design" ? hash.startsWith("#/design/")
      : key === "policy" ? hash.startsWith("#/policy/")
      : key === "readout" ? hash.startsWith("#/readout/")
      : hash === href;
    root.append(h("a.navlink", { href, class: "navlink" + (active ? " active" : "") },
      h("span.num", null, String(ix + 1).padStart(2, "0")), label));
  });
}
const ROUTE_FNS = {
  "#/data": viewData, "#/map": viewMap,
  "#/ledger": viewLedger, "#/loop": viewLoop,
  "#/opportunity": viewOpportunity,
};
function route() {
  renderNav();
  state.railRefresh = null;
  const m = location.hash;
  const main = $("#main");
  main.innerHTML = "";
  let fn = ROUTE_FNS[m];
  if (!fn && m.startsWith("#/insight/")) fn = () => viewInsight(m.split("/")[2]);
  if (!fn && m.startsWith("#/design/")) fn = () => viewDesign(m.split("/")[2]);
  if (!fn && m.startsWith("#/policy/")) fn = () => viewPolicy(m.split("/")[2]);
  if (!fn && m.startsWith("#/readout/")) fn = () => viewReadout(m.split("/")[2]);
  // The cutoff registry merged into the ledger; rewrite the hash so old bookmarks and
  // slide links land on the ledger with the nav active state pointing at it too.
  if (m === "#/cutoffs") { location.replace("#/ledger"); return; }
  if (!fn) fn = viewData;
  fn(main);
  window.scrollTo(0, 0);
}

/* ============================================================
   #/data
   ============================================================ */
function viewData(main) {
  const dh = RDI.dataHealth;
  const pmsList = dh.sources.filter((s) => ["appfolio", "yardi", "buildium", "entrata", "realpage"].includes(s.id));
  const months = RDI.meta.home_months / RDI.meta.homes;
  const pmsHomes = pmsList.map((s) => s.name.replace(/ \(.*\)/, "") + " " + (s.rows / months)).join(", ");
  main.append(h("h1", null, "Data health"),
    h("p.sub", null, "Before any number is computed: where the data comes from, how fresh it is, and which markets are thin. Thin data gets flagged, and every finding that touches it is openly downgraded."),
    h("div.hint.explain", { style: "margin-top:6px" }, "About this demo: these " + RDI.meta.homes.toLocaleString() + " homes were generated by a script, not real customers. The script also wrote an answer key: what is really true, what is noise, what is gamed. The analysis engines never see the key, so every accuracy claim on this screen is graded against it. Every feed is one row per home per month: the five property-management systems add up to exactly " + RDI.meta.homes.toLocaleString() + " homes (" + pmsHomes + "). This is the dashboard the investor pays for; property managers keep working in their own systems."));
  const cards = h("div.grid.g3");
  for (const s of dh.sources) {
    if (s.id === "benchmark") {
      const B = RDI.benchmark;
      if (!B) continue;
      const on = state.benchmarkOn;
      cards.append(h("div.card.tight.rocket-card",
        h("div.spread", h("b", null, s.name), h("span", null, chip("Rocket", "accent"), " ", chip(on ? "sharing" : "off", on ? "benchmark" : ""))),
        h("div.mono.muted.tiny.mt", null, on ? B.operators + " operators pooled · medians refreshed " + B.refreshed : "nothing shared, nothing shown"),
        h("div.muted.micro", null, B.method),
        h("div.mt", h("button.ghost.tiny", {
          type: "button", "aria-pressed": String(on),
          onclick: () => { state.benchmarkOn = !state.benchmarkOn; route(); },
        }, "competitive benchmarking: " + (on ? "on" : "off"))),
        h("div.hint.explain.tiny.mt", null, on
          ? "On: your anonymized medians join the pool, and opted-in operators' averages appear on the insight pages. Revocable; the change applies both ways immediately."
          : "Off means nothing leaves and no competitor figure appears anywhere. Opting in shares pooled medians only, never home-level data, and nobody sees a figure unless at least five operators back it.")));
      continue;
    }
    const standby = s.status === "standby";
    const hs = (!standby && s.id !== "redfin") ? " · " + (s.rows / months).toLocaleString() + (s.rows / months === 1 ? " home" : " homes") : "";
    cards.append(h("div.card.tight" + (s.firstParty ? ".rocket-card" : ""), { id: s.id === "title" ? "src-title" : null },
      h("div.spread", h("b", null, s.name + hs), h("span", null, s.firstParty ? chip("Rocket", "accent") : null, " ", chip(SRC_LABEL[s.status] || s.status, standby ? "" : s.status === "stale" ? "stale" : s.status === "degraded" ? "watch" : "ok"))),
      h("div.mono.muted.tiny.mt", standby ? h("span.explain", "not used in this demo") : null, standby ? h("span.investor-only", "upload a file \u2192") : null, !standby ? s.rows.toLocaleString() + (s.id === "redfin" ? " search events" : " rows") : null),
      h("div.muted.micro", standby ? h("span.explain", "on-ramp for systems without a connector") : null, standby ? h("span.investor-only", "connects any system without a connector") : null, !standby ? "sync " + new Date(s.last_sync).toLocaleString() : null),
      s.id === "title" ? h("div.drift-action", null, s.auto_merged + " duplicate homes auto-merged · " + s.pending_review + " need your check below") : null));
  }
  main.append(h("h3", null, "Connectors"),
    h("p.hint.explain", { style: "margin:2px 0 8px" }, "AppFolio, Yardi, Buildium, Entrata, and RealPage: the programs the customer's property managers run rent, work orders, and leases on, one system per home. Then the feeds Rocket itself brings: Mr. Cooper's servicing view of the same homes' mortgages, Redfin search demand (events, not rows), and the public ownership and title record behind the identity graph. The CSV/SFTP drop is the file on-ramp for any system without a connector; this customer connected the five PMS feeds directly, so it is standing by unused. Note what the chips judge and what they do not: on time / late / not arriving is a delivery verdict only. On time does not mean complete. Buildium is on time with all 548 homes because its file lands every few hours; inside that same file, the Charlotte NW export carries no repair-cost lines for 27 homes. Timeliness is judged here, completeness in the coverage bars below, and a figure is validated only when both say yes."),
    cards);

  main.append(h("div.callout.explain", { style: "margin-top:12px" },
    h("b", null, "The three purple cards are the feeds only Rocket can bring."),
    h("ul.tiny", { style: "margin:6px 0 0 16px" },
      h("li", null, h("b", null, "Mr. Cooper"), " is one of the largest US mortgage servicers; Rocket bought it in 2022, and it services the loans these homes were bought with. Monthly payment behavior on the mortgage behind each home. What it really brings: the earliest warning a portfolio has. An owner whose payments slip is an owner whose homes get deferred maintenance, and you see it here before it shows up in repair costs."),
      h("li", null, h("b", null, "Redfin search intent"), " is how many people looked for homes like yours last month, at what price. What it really brings: demand moves before leases do. A vacancy forecast built on last year's days-to-lease looks backward; this one looks forward."),
      h("li", null, h("b", null, "Rocket Title & Transaction"), " is the public record of who truly owns each home and what is attached to it: liens, transfers, claims. What it really brings: the ground truth under identity. Duplicate merges are only as trustworthy as this record. Its 42-hour lag is county-recorder lag, and every merge decision logs what the feed actually knew when."))));
  main.append(h("h3", null, "Freshness & drift"),
    h("p.hint.explain", { style: "margin:2px 0 8px" }, "Freshness asks: did the data arrive on time? Drift asks: is the data still behaving like its own recent history? Colors carry meaning everywhere on this page: green, orange, red grade how bad something is; purple marks something you or the platform does. The purple line under each drift alert says what the platform does about it, automatically, before any insight is computed."));
  main.append(h("div.g2.grid",
    h("div.card",
      h("div.kpi", h("div.k", null, "worst freshness"), h("div.v", { style: "font-size:17px" }, dh.freshness.worst),
        h("div.s", null, "median " + dh.freshness.median)),
      h("div.hint.explain.mt", null, dh.freshness.note)),
    h("div.card", h("h3", { style: "margin-top:0" }, "Drift alerts"),
      ...dh.drift.map((d) => h("div.mrow", null,
        h("div.spread", null,
          h("span.mono.tiny", null, d.metric),
          h("span", { class: "chip " + (d.impact === "good" ? "ok" : d.impact === "bad" ? "breached" : "watch") }, d.delta + " · " + d.since)),
        h("div.drift-action", null, d.action))))));

  main.append(h("h3", null, "Submarket coverage"),
    h("p.hint.explain", { style: "margin:2px 0 8px" }, "A visibility bar, not a performance bar: it shows how many homes in each market have all nine fields actually recorded. Bar color grades the size of the hole: green, near-complete; orange, moderate loss; red, a named delivery gap with an owner and a fix. These bars grade what arrived, not whether it arrived, which is why a thin market can sit under a connector that is on time; all three thin markets here deliver on schedule and still send incomplete files. A gap is a data-delivery problem, not a judgment on a market or a manager, so the list is ordered worst-first on completeness, names the homes affected, and states the action. Any insight built on a thin market is openly labeled 'benchmarking', not 'validated', until the missing data is supplied."));
  const cs = dh.summary;
  main.append(h("div.card.tight", { style: "margin:0 0 10px" },
    h("div.kpi",
      h("div.k", null, "portfolio completeness"),
      h("div.v", { style: "font-size:19px" }, cs.missing + " homes missing data · " + cs.homes.toLocaleString() + " homes invested"),
      h("div.s", null, "No market is 100% complete, and most of the gap is tolerated on purpose: every market carries a few homes with one field missing, absorbed by the confidence tier, no action needed. Only " + cs.named + " of these " + cs.missing + " homes sit in a named delivery gap, the " + cs.thin + " red bars below, and " + cs.to_contact + " property managers can fix them, one backfill per system (" + cs.systems.join(", ") + ")."))));
  const cov = h("div.grid.g2");
  const barColor = (p) => p >= 95 ? "var(--success)" : p >= 80 ? "var(--warning)" : "var(--error)";
  for (const c of [...dh.coverage].sort((a, b) => a.pct - b.pct)) {
    cov.append(h("div.card.tight",
      h("div.spread", h("span.tiny", null, c.submarket_id), h("span.mono.tiny", null, c.pct.toFixed(1) + "%")),
      h("div.bar", { style: "margin-top:7px" }, h("i", { style: `width:${c.pct}%;background:${barColor(c.pct)}` })),
      c.gaps.length ? h("div.micro", { style: "color:var(--warning);margin-top:6px" }, c.gaps.join("; ")) : null,
      !c.gaps.length && c.missing ? h("div.micro", { style: "margin-top:6px" }, c.missing + " homes missing a field; absorbed by the confidence tier") : null,
      c.action ? h("div.drift-action", null, c.action) : null));
  }
  main.append(cov);

  const tSrc = dh.sources.find((x) => x.id === "title");
  main.append(h("h3", null, "Identity-resolution review queue"),
    h("p.hint.explain", null, "Identity resolution is deduplication: the same physical house filed in two places, here a property-management record on the left and a Rocket Title & Transaction parcel record on the right. Left alone it counts twice: twice the value, twice the rent, twice in every average. The score is match confidence, an ensemble of normalized address, parcel geometry, and owner identity: above 0.99 the platform merges automatically, below 0.87 it treats the pair as two houses. Of the " + (tSrc.auto_merged + tSrc.pending_review) + " duplicate pairs this month, " + tSrc.auto_merged + " cleared that bar on their own; these " + dh.reviewQueue.length + " sit in the gray zone, certain enough to notice and uncertain enough that the platform refuses to guess with the investor's money. The decision happens outside the app, in the parcel record; the write happens inside it: on your confirmation the two records collapse into one home, duplicated history rows drop out, and the ledger counts one house where it counted two."));
  const q = h("table");
  q.append(h("tr", null, h("th", null, "PMS record"), h("th", null, "Submarket"), h("th", null, "Title parcel"), h("th.num", null, "Match confidence"), h("th", null, "")));
  for (const row of dh.reviewQueue) {
    q.append(h("tr", null, h("td.mono.tiny", null, row.system + " · " + row.address), h("td.tiny", null, row.submarket),
      h("td.mono.tiny", null, row.candidate),
      h("td.num", null, row.score.toFixed(2)),
      h("td.right", null, h("button", {
        style: "padding:4px 12px",
        onclick: (e) => { e.target.closest("tr").style.opacity = 0.35; e.target.replaceWith(chip("merged", "ok")); },
      }, "Merge"))));
  }
  const titleLink = h("a", { href: "#/data", style: "cursor:pointer", onclick: (e) => {
    e.preventDefault();
    const el = document.getElementById("src-title");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.outline = "2px solid var(--accent2)";
    setTimeout(() => { el.style.outline = ""; }, 1600);
  } }, "Rocket Title & Transaction");
  main.append(h("div.card", q,
    h("div.drift-action", { style: "margin-top:10px" },
      "The investor's check, per pair, off-app: open the parcel record for both addresses in ", titleLink,
      ". Same APN and owner: the two records are one house, press Merge. Different parcel: they stay two houses and the address match was a coincidence.")));
  main.append(h("details", { style: "margin-top:16px" },
    h("summary", { style: "cursor:pointer;color:var(--muted)" }, "CSV field mapping (14 columns → canonical, 2 flagged). Not on the scripted path"),
    h("div.card.mt",
      h("p.hint.explain", { style: "margin:0 0 10px" }, "Nothing is uploading here: this customer's five systems all have live connectors, so the file drop stands by. This table is the answer for a customer who does need it. If a property manager's software has no connector, they send one file, no IT project. The platform maps its fourteen columns onto the standard fields every engine reads. Two columns come back flagged in orange: their meaning changes between vendors, so the platform will not ingest them on a guess. Click a flag to see the question and answer it; the answer becomes a saved rule. Tenant names are dropped, never stored."),
      csvMappingTable(),
      h("div.drift-action", { style: "margin-top:10px" }, "Unblocking, when this runs for a real file: answer the two questions once, in-app. The raw file is already held, so the platform recomputes the flagged fields under your answer, nothing is re-uploaded, and the answer is remembered per vendor so the next file sails through."))));
}
function csvMappingTable() {
  const cols = [
    ["unit_no", "home_id"], ["prop_addr", "address → entity graph"], ["tenant_name", "(excluded, PII)"],
    ["rent_amt", "scheduled_rent"], ["conv_rent", "effective_rent"], ["lease_start", "lease_start"],
    ["lease_end", "lease_end"], ["turn_date", "move_out"], ["turn_invoice_total", "make_ready_cost"],
    ["wo_total", "work_order_cost"], ["delq_days", "delinquency_days"], ["vac_days", "days_vacant"],
    ["dom", "days_on_market"], ["renewed_flag", "renewal_accepted"],
  ];
  const flags = {
    wo_total: ["work-order total: dollars or a count?", ["Dollars", "A count"]],
    delq_days: ["days delinquent: snapshot or rolling?", ["Point-in-time", "Rolling average"]],
  };
  const t = h("table");
  t.append(h("tr", null, h("th", null, "CSV column"), h("th", null, "Canonical field"), h("th", null, "Ambiguous?")));
  for (const [a, b] of cols) {
    const f = flags[a];
    const cell = h("td");
    if (!f) {
      cell.append(h("span.tiny.muted", "mapped"));
    } else {
      const ask = h("button.ghost", { style: "padding:3px 10px;font-size:11px;color:var(--warning)" }, "\u2691 " + f[0]);
      ask.onclick = () => {
        cell.textContent = "";
        for (const opt of f[1]) {
          const btn = h("button", { style: "padding:3px 10px;font-size:11px;margin:0 6px 0 0" }, opt);
          btn.onclick = () => {
            cell.textContent = "";
            const done = chip(b + " = " + opt.toLowerCase(), "ok");
            const memo = h("div.micro.muted.mt", null, "Rule saved for this vendor; held rows recomputed (demo behavior).");
            cell.append(done, memo);
          };
          cell.append(btn);
        }
      };
      cell.append(ask);
    }
    t.append(h("tr", null, h("td.mono.tiny", null, a), h("td.mono.tiny", null, b), cell));
  }
  return t;
}

/* ============================================================
   #/map
   ============================================================ */
function viewMap(main) {
  const m = RDI.meta;
  main.append(h("h1", null, "Insights map"),
    h("p.sub", null, "What the platform has found, what it can prove, and what is worth acting on for the thesis you told it you care about."));
  const mapHost = h("div.svgwrap");
  const railHost = rail();
  const drawAll = () => {
    drawMap(mapHost);
    drawRail(railHost);
    paintSliders(railHost);
  };
  state.railRefresh = drawAll;
  wireSteering(main, railHost);  // words-in steering above the fold; drawAll is already
  // assigned so a fast keystroke mid-render can't call a stale/undefined railRefresh
  // KPI hovers carry the arithmetic, fully derived from RDI at render time. Sums are
  // computed from the same rows that are listed, so the displayed equation can never
  // drift from the headline metric; if it ever does, both numbers show up side by side.
  const vRows = RDI.ledger.filter((r) => r.finding === "validated");
  const rRows = RDI.ledger.filter((r) => r.finding === "refuted");
  const rowId = (r) => r.policy_id || r.readout_id || r.action_id || "";
  const money = (v) => (v < 0 ? "- " : "") + fmt.usd(Math.abs(v)); // explicit sign, legible after "+"
  const terms = (xs) => xs.join("  +  ");
  const identSum = RDI.insights.reduce((a, i) => a + i.annual_impact_usd, 0);
  const provSum = vRows.reduce((a, r) => a + r.realized_usd, 0);
  const negIds = vRows.filter((r) => r.realized_usd < 0).map(rowId).filter(Boolean);
  // "Identified value" is a partition, not a pile: income lenses (rent/NOI/renewals
  // that aren't arriving) vs cost lenses (move-out and make-ready spend above the
  // matched-home comparison). Both sides sum the same lens_usd rows to the headline.
  const INCOME_LENSES = ["occupancy", "noi", "retention"];
  const sumLens = (keys) => RDI.insights.reduce((a, i) => a + keys.reduce((x, k) => x + (Number((i.lens_usd || {})[k]) || 0), 0), 0);
  const leftSum = sumLens(INCOME_LENSES), saveSum = sumLens(["turnover", "capex"]);
  const warns = [];
  if (Math.abs(leftSum + saveSum - identSum) >= 0.5) warns.push(`lens partition sums to ${fmt.usd(leftSum + saveSum)} vs insight total ${fmt.usd(identSum)}`);
  if (Math.abs(identSum - m.identified_usd) >= 0.5) warns.push(`headline metric reads ${fmt.usdM(m.identified_usd)}`);
  const identCard = kpi("Identified value / yr", fmt.usdM(m.identified_usd), `left on the table ${fmt.usdM(leftSum)} · potential savings ${fmt.usdM(saveSum)}`);
  identCard.title = `Two kinds of money, partitioned by value lens: money left on the table (rent never collected, NOI, renewals: occupancy+noi+retention) = ${fmt.usd(leftSum)}/yr; potential savings (move-out cost and spend above the matched comparison: turnover+capex) = ${fmt.usd(saveSum)}/yr; total ${fmt.usd(leftSum + saveSum)}/yr.` +
    (warns.length ? " CHECK: " + warns.join("; ") + "." : "") +
    " Comparisons are your own matched homes in the same metro, not competitor data. Each impact is untested until an experiment validates it.";
  const provCard = kpi("Proven value / yr", fmt.usd(m.proven_usd), "validated ledger rows only");
  provCard.title = vRows.length
    ? `net realized value across the ${vRows.length} validated rows: ` +
      terms(vRows.map((r) => rowId(r) + " " + money(r.realized_usd))) + `  =  ${fmt.usd(provSum)}/yr` +
      (Math.abs(provSum - m.proven_usd) < 0.5 ? "" : ` (headline metric reads ${fmt.usd(m.proven_usd)})`) +
      (negIds.length ? `. Negative rows (${negIds.join(", ")}) are validated RD findings whose measured outcome movement is negative in dollars; the ledger nets them instead of hiding them.` : "")
    : "no validated rows yet: the platform has banked nothing, and says so";
  const nRd = vRows.filter((r) => r.source === "rd").length;
  const findCard = kpi("Findings", vRows.length + " validated: " + nRd + " RD and " + (vRows.length - nRd) + " Exp",
    rRows.length + " refuted · refusals are product surface");
  findCard.title = "validated: " + vRows.map(rowId).filter(Boolean).join(" ") + " · refuted: " + rRows.map(rowId).filter(Boolean).join(" ");
  main.append(h("div.grid.g4",
    identCard,
    provCard,
    kpi("ROI vs platform fee", m.roi_x + "×", "proven ÷ " + fmt.usd(m.platform_fee_usd) + " annual fee", "pos"),
    findCard));
  if (state.benchmarkOn && RDI.benchmark) {
    const BM = RDI.benchmark;
    const ctx = [
      ["I1", "turnover $/move-out", "turnover_cost_per_moveout"],
      ["I3", "days to lease", "days_to_lease"],
      ["I4", "renewal rate", "renewal_rate"],
    ].map(([iid, label, key]) => {
      const ins = RDI.insights.find((x) => x.id === iid);
      return { iid, label, focal: ins && ins.focal_value, net: RDI.benchmark?.per_metric?.[key] };
    }).filter((c) => c.focal != null && c.net != null);
    if (ctx.length) main.append(h("div.chiprow.mt",
      chip("network context", "benchmark"),
      ...ctx.flatMap((c) => [
        h("span.tiny.muted", null, " ", c.label + ": ", h("b", null, fmt.num(c.focal)), " you vs ", h("b", { style: "color:var(--benchmark)" }, fmt.num(c.net)), " network "),
        h("a.tiny", { href: "#/insight/" + c.iid, style: "color:var(--benchmark)" }, c.iid),
      ]),
      h("span.tiny.muted", null, "· market averages from opted-in operators, each number backed by at least 5 of them, context only, never in the money"),
      h("a.tiny", { href: "#/data" }, "source")));
  }
  main.append(h("div.split", mapHost, railHost));
  drawAll();
}
function kpi(k, v, s, cls) {
  return h("div.card.kpi", h("div.k", null, k), h("div.v" + (cls ? "." + cls : ""), null, v), h("div.s", null, s));
}
// Hand-simplified lon/lat rings for the three states behind the opportunity map
// (coarse demo geometry; the legend says so). Module scope so redraws don't re-allocate.
const STATES = [
  { ab: "AZ", lab: [-113.3, 36.2], ring: [[-114.05, 37.0], [-109.05, 37.0], [-109.05, 31.33],
    [-111.07, 31.33], [-114.55, 32.49], [-114.42, 34.3], [-114.62, 35.0]] },
  { ab: "GA", lab: [-82.2, 32.3], ring: [[-85.6, 35.0], [-83.1, 35.0], [-82.0, 33.5], [-80.9, 32.6],
    [-80.85, 32.04], [-81.5, 30.72], [-84.9, 30.7], [-85.1, 31.0], [-85.6, 33.35]] },
  { ab: "NC", lab: [-78.4, 36.0], ring: [[-84.32, 35.0], [-84.32, 35.97], [-81.67, 35.97],
    [-81.67, 36.59], [-75.8, 36.55], [-75.62, 35.2], [-76.6, 34.65], [-77.9, 33.9],
    [-78.54, 33.87], [-80.78, 34.82]] },
];
function drawMap(wrap) {
  wrap.innerHTML = "";
  const metros = new Set(RDI.submarkets.map((s) => s.metro)).size;
  const head = h("div.spread", h("b", null, `${metros} metros · ${RDI.submarkets.length} submarkets · ${RDI.meta.homes.toLocaleString()} homes`),
    h("a.tiny", { href: "#", onclick: (e) => { e.preventDefault(); state.mapMode = state.mapMode === "map" ? "table" : "map"; drawMap(wrap); } },
      state.mapMode === "map" ? "toggle ranked table" : "toggle map"));
  wrap.append(head);
  const body = h("div", { style: "margin-top:12px" });
  if (state.mapMode === "table") {
    const t = h("table");
    t.append(h("tr", null, ...["Submarket", "Metro", "Homes", "Avg rent", "Insights"].map((x, i) => h("th" + (i > 1 ? ".num" : ""), null, x))));
    for (const sm of RDI.submarkets)
      t.append(h("tr.clk", { onclick: () => (location.hash = "#/insight/" + (sm.insight_ids[0] || "I1")) },
        h("td", null, sm.name), h("td.muted", null, sm.metro), h("td.num", null, sm.homes),
        h("td.num", null, fmt.usd(sm.avg_rent)), h("td.tiny", null, sm.insight_ids.join(" · ") || "n/a")));
    body.append(t);
  } else {
    // Schematic state outlines behind the points: the dots must sit on a recognizable
    // United States, not a blank grid. Rings are hand-simplified (coarse demo geometry,
    // labeled as such in the legend); metros keep their real lat/lon centroids.
    // Uniform px/degree scale with cos(lat) longitude correction so states keep shape.
    const lons = RDI.submarkets.map((s) => s.lon), lats = RDI.submarkets.map((s) => s.lat);
    for (const st of STATES) for (const [lo, la] of st.ring) { lons.push(lo); lats.push(la); }
    const W = 640, H = 230, pad = 22, cosLat = Math.cos(33 * Math.PI / 180);
    const x0 = Math.min(...lons), x1 = Math.max(...lons), y0 = Math.min(...lats), y1 = Math.max(...lats);
    const scale = Math.min((W - 2 * pad) / ((x1 - x0) * cosLat), (H - 2 * pad) / (y1 - y0));
    const px = (lon) => pad + ((W - 2 * pad) - (x1 - x0) * cosLat * scale) / 2 + (lon - x0) * cosLat * scale;
    const py = (lat) => H - pad - ((H - 2 * pad) - (y1 - y0) * scale) / 2 - (lat - y0) * scale;
    const svg = S("svg", { viewBox: `0 0 ${W} ${H}` });
    for (const st of STATES)
      svg.append(S("path", { d: st.ring.map(([lo, la], ix) => (ix ? "L" : "M") + px(lo).toFixed(1) + " " + py(la).toFixed(1)).join(" ") + " Z",
        fill: "var(--surface2)", "fill-opacity": 0.7, stroke: "var(--border)", "stroke-width": 1 }));
    for (const st of STATES)
      svg.append(S("text", { x: px(st.lab[0]), y: py(st.lab[1]), "text-anchor": "middle", "font-size": 14,
        "font-family": "var(--mono)", "letter-spacing": "2px", fill: "var(--muted)", opacity: .8 }, st.ab));
    const ranked = rankedInsights();
    const scores = {};
    for (const r of ranked) scores[r.i.submarket] = Math.max(scores[r.i.submarket] || 0, r.score);
    // Fixed-size points in a tidy grid per metro: true lat/lon spacing inside a metro
    // projects to ~1px, so honest non-overlap means anchoring each metro at its real
    // centroid and laying its submarkets around it, best-scored first.
    // Purple filled = actionable (an insight lives here); muted open circle = no action yet.
    const byMetro = {};
    for (const sm of RDI.submarkets) (byMetro[sm.metro] = byMetro[sm.metro] || []).push(sm);
    const drill = (sm) => { const t = sm.insight_ids[0]; if (t) location.hash = "#/insight/" + t; };
    for (const list of Object.values(byMetro)) {
      const cx = list.reduce((a, s) => a + s.lon, 0) / list.length;
      const cy = list.reduce((a, s) => a + s.lat, 0) / list.length;
      list.sort((a, b) => (scores[b.name] || 0) - (scores[a.name] || 0) || a.name.localeCompare(b.name));
      // 3-column grid, best-scored first (top row first). Slots are capped at 12: a
      // metro cluster stays a tight badge-size group near its centroid no matter how
      // many submarkets the fixture grows; extras share the final slot's neighborhood.
      const topCols = Math.min(list.length, 3);
      list.forEach((sm, ix0) => {
        const ix = Math.min(ix0, 11);
        const x = px(cx) + (ix % 3 - (topCols - 1) / 2) * 15;
        const y = py(cy) + (Math.floor(ix / 3) - 1) * 15;
        const actionable = sm.insight_ids.length > 0;
        const c = S("circle", {
          cx: x, cy: y, r: actionable ? 4.5 : 3.6,
          fill: actionable ? "var(--accent2)" : "none",
          stroke: actionable ? "var(--surface)" : "var(--muted)", "stroke-width": 1.5,
        });
        c.append(S("title", null, `${sm.name} · ${sm.homes} homes · ${sm.insight_ids.length ? sm.insight_ids.join(", ") : "no insight yet"}`));
        if (actionable) {
          c.style.cursor = "pointer";
          c.setAttribute("tabindex", "0");
          c.setAttribute("role", "link");
          c.setAttribute("aria-label", `${sm.name}: open insight ${sm.insight_ids[0]}`);
          const go = () => drill(sm);
          c.addEventListener("click", go);
          c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
        }
        svg.append(c);
      });
    }
    body.append(svg,
      h("div.legend",
        h("span", null, sw("var(--accent2)"), "filled = actionable (has insights) · click to open"),
        h("span", null, "open circle = no action yet"),
        h("span", null, "hover any point for homes & findings"),
        h("span", null, "state outlines schematic; metros at real lat/lon, submarkets gridded")));
  }
  wrap.append(body);
}
function rail() {
  const card = h("div.card");
  card.append(h("h3", { style: "margin-top:0" }, "Your thesis"));
  for (const k of Object.keys(state.weights)) {
    card.append(h("div.wrow",
      h("span.nm", null, k),
      h("input", { type: "range", min: 0, max: 100, value: Math.round(state.weights[k] * 100), "data-k": k, oninput: (e) => { state.weights[e.target.getAttribute("data-k")] = e.target.value / 100; normalizeWeights(); if (state.railRefresh) state.railRefresh(); } }),
      h("span.pv", null, state.weights[k].toFixed(2))));
  }
  card.append(h("div.tiny.mono.muted.mt", { style: "text-transform:uppercase;letter-spacing:.6px" }, "Ranked for you · class first, then your sliders"),
    h("div", { class: "raillist" }));
  card.append(h("div.hint.explain.mt", null, "The order is arithmetic, not vibes: evidence class sorts first, experiments on top and a finding that a test refuted always last. Within a class: dollar impact times your priority sliders, scaled by how good the local data is and whether this lever's predictions held up before."));
  return card;
}
function paintSliders(card) {
  card.querySelectorAll("input[type=range]").forEach((inp) => {
    const k = inp.getAttribute("data-k");
    inp.value = Math.round(state.weights[k] * 100);
    inp.parentElement.querySelector(".pv").textContent = state.weights[k].toFixed(2);
  });
}
function drawRail(card) {
  const list = card.querySelector(".raillist");
  list.innerHTML = "";
  const ranked = rankedInsights();
  for (const { i } of ranked) {
    list.append(h("div.card.tight", { style: "margin:8px 0;cursor:pointer", onclick: () => (location.hash = "#/insight/" + i.id) },
      h("div.spread", h("b.tiny", null, i.id + " · " + i.title), chip(i.status, i.status)),
      h("div.spread.mt",
        h("span.muted.micro", null, i.submarket + " · " + i.metric)),
      h("div.tiny.mt", null, railSay(i)),
      h("div.micro", { style: "color:var(--muted);margin-top:5px" },
        chip(i.evidence_class.replace("_", " "), i.evidence_class === "descriptive" ? "" : "accent"),
        " ", i.confidence_tier + " tier")));
  }
}

/* ---------- steering (Step 8) ---------- */
const CANNED = [
  { phrase: "i care most about turnover cost in phoenix", weights: { noi: 0.20, occupancy: 0.15, turnover: 0.45, capex: 0.10, retention: 0.10 },
    cohort: "Phoenix West homes in the active turnover window (vacant-to-lease), plus move-outs scheduled this quarter",
    framing: "Pre-lease processing at 45 days cuts turnover cost per move-out at least in half in Phoenix West.",
    rationale: "Turnover dominates the ledger's validated value in that metro." },
  { phrase: "atlanta occupancy", weights: { noi: 0.20, occupancy: 0.45, turnover: 0.15, capex: 0.05, retention: 0.15 },
    cohort: "Atlanta submarkets with listing-to-lease gaps above the portfolio median",
    framing: "Photo-standard compliance above twelve images measurably shortens days-to-lease in Atlanta OTP.",
    rationale: "Occupancy levers carry the largest un-mined cutoff surface in Atlanta." },
  { phrase: "capex discipline", weights: { noi: 0.25, occupancy: 0.05, turnover: 0.20, capex: 0.40, retention: 0.10 },
    cohort: "Charlotte South make-readies above the scoping threshold",
    framing: "Turn-renovation spend above the scoping threshold does not raise NOI per home.",
    rationale: "The RD readout at the scoping cutoff already refutes the spend; discipline compounds." },
];
function cannedFor(text) {
  const low = text.toLowerCase();
  return CANNED.find((c) => low.includes(c.phrase)
    || (c.phrase === CANNED[0].phrase && /turnover/.test(low) && /phoenix/.test(low))
    || (c.phrase === CANNED[1].phrase && /occupancy/.test(low) && /atlanta/.test(low))
    || (c.phrase === CANNED[2].phrase && /capex/.test(low))) || CANNED[0];
}
function wireSteering(main, railHost) {
  const modeChip = chip("", "");
  const toggle = h("button.ghost.tiny", { type: "button" });
  const paintMode = () => {
    modeChip.textContent = !state.liveEnabled ? "live steering off"
      : state.live ? "live · model"
        : state.offline ? "offline · file://"
          : state.checked ? "canned fallback" : "checking…";
    modeChip.className = "chip " + (!state.liveEnabled ? "watch"
      : state.live ? "ok" : state.offline ? "stale" : state.checked ? "watch" : "");
    toggle.textContent = state.liveEnabled ? "live steering: on" : "live steering: off";
    toggle.setAttribute("aria-pressed", String(state.liveEnabled));
    toggle.title = "Send steering to the live model (falls back to canned answers on any error).";
  };
  toggle.addEventListener("click", () => { state.liveEnabled = !state.liveEnabled; paintMode(); });
  paintMode();
  const box = h("div.card", { style: "margin-top:16px" },
    h("div.spread", h("b", null, "Steer the platform in words"), h("div.row", modeChip, toggle)),
    h("p.hint.explain.mt", null, "The model turns your words into priorities and a plain-English cohort description. It never writes a number; every figure here is computed by the engines."));
  const inp = h("input", { type: "text", placeholder: "“I care most about turnover cost in Phoenix”", style: "margin-top:8px" });
  const out = h("div.mt");
  box.append(inp, out);
  main.append(box);
  if (state.lastSteer) renderSteerResult(out, state.lastSteer);
  let tm = null;
  inp.addEventListener("input", () => {
    clearTimeout(tm);
    tm = setTimeout(() => applySteer(inp.value.trim(), out, railHost), 600);
  });
}
async function applySteer(text, out, railHost) {
  out.innerHTML = "";
  out.append(h("div.skel", { style: "width:70%" }), h("div.skel", { style: "width:45%" }));
  let payload = null, live = false;
  if (state.live && state.liveEnabled) {
    try {
      const r = await fetch("/api/steer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (r.ok) { payload = await r.json(); live = true; }
    } catch { /* fall through to canned */ }
  }
  if (!payload) {
    const canned = cannedFor(text);
    payload = { weights: canned.weights, constraints: [], cohort_override: { def: canned.cohort }, hypothesis_framing: canned.framing, rationale: canned.rationale };
    showBadge("canned steering: " + (!state.liveEnabled ? "live steering off (toggle it back on)" : state.offline ? "file:// (live steering disabled)" : state.checked && !state.live ? "no live key" : "upstream failed") + " (demo runs identically, badge visible by design)");
  } else hideBadge();
  for (const k of Object.keys(state.weights)) state.weights[k] = payload.weights[k] ?? state.weights[k];
  normalizeWeights();
  state.lastSteer = payload;
  renderSteerResult(out, payload);
  if (state.railRefresh) state.railRefresh();
}
function renderSteerResult(out, payload) {
  out.innerHTML = "";
  out.append(h("div.row",
    ...Object.entries(payload.weights).map(([k, v]) => chip(k + " " + Number(v).toFixed(2), "accent"))));
  if (payload.cohort_override)
    out.append(h("div.callout.mt", null, h("b", null, "Cohort (text-only): "), payload.cohort_override.def));
  out.append(h("div.callout.ok.mt", null, h("b", null, "Hypothesis: "), payload.hypothesis_framing, " ", h("span.muted", null, "· " + payload.rationale)));
}
let badgeEl;
function showBadge(t) { badgeEl = badgeEl || h("div.badge"); badgeEl.textContent = t; badgeEl.classList.add("show"); document.body.append(badgeEl); }
function hideBadge() { if (badgeEl) badgeEl.classList.remove("show"); }

/* ============================================================
   #/insight/<id>
   ============================================================ */
function viewInsight(id) {
  const main = $("#main");
  const i = RDI.insights.find((x) => x.id === (id || "I1").toUpperCase()) || RDI.insights[0];
  main.append(h("h1", null, i.title));
  main.append(h("div.tabs",
    ...RDI.insights.map((x) => h("a" + (x.id === i.id ? ".active" : ""), { href: "#/insight/" + x.id, title: x.title }, x.id))));
  main.append(h("p.sub", null, i.segment, " · ", i.metric, " · evidence ", i.evidence_class.replace("_", " "), " · ", i.confidence_tier, " tier"));
  main.append(h("div.grid.g4",
    kpi("Gap", fmt.num(i.gap) + " " + unitOf(i.metric), i.gap_ci ? `95% CI [${fmt.num(i.gap_ci[0])}, ${fmt.num(i.gap_ci[1])}]` : ""),
    kpi("Cohort n", (i.cohort.n ?? 0).toLocaleString(), i.cohort.def),
    kpi("Annual impact", fmt.usd(i.annual_impact_usd), "peer-recovered value, cohort scope"),
    kpi("Data coverage", Math.round(100 * (coverageOf(i.submarket) || 0)) + "%", "data health of " + i.submarket + "; feeds the confidence behind the rail ordering")));
  main.append(h("div.g2.grid.mt",
    h("div.card", h("h3", { style: "margin-top:0" }, "Provenance"),
      h("table",
        h("tr", null, h("th", null, "Source"), h("th.num", null, "Rows"), h("th", null, "As of")),
        ...i.provenance.map((p) => h("tr", null, h("td.tiny", null, p.source), h("td.num", null, p.rows.toLocaleString()), h("td.tiny.muted", null, p.as_of))))),
    h("div.card", h("h3", { style: "margin-top:0" }, "Priors"),
      h("div", { style: "margin:6px 0" }, i.prior_effect
        ? h("div", null, h("b.tiny", null, "Prior effect · " + i.prior_effect.source),
          h("div.mono.tiny.muted", null, fmt.num(i.prior_effect.mean) + (i.prior_effect.ci ? " [" + fmt.num(i.prior_effect.ci[0]) + ", " + fmt.num(i.prior_effect.ci[1]) + "]" : ""),
            i.prior_effect.n_experiments ? " · " + i.prior_effect.n_experiments + " experiment" + (i.prior_effect.n_experiments > 1 ? "s" : "") : ""))
        : h("div.hint.note", null, "No prior: nothing has been measured on this lever yet, so the estimate starts from the peer baseline.")),
      shrinkageBox(i))));
  const bc = benchCard(i);
  if (bc) main.append(bc);
  main.append(h("div.btnrow",
      h("button", { onclick: () => (location.hash = "#/design/" + i.id) }, "Design experiment →"),
      h("a", { href: "#/ledger" }, h("button.ghost", null, "View mined cutoffs in the ledger"))));
  drawInsightChart(main, i);
}
// Competitive benchmark (opt-in network context). Deliberately outside the money: benchmark
// numbers never enter impact dollars, ranking, or the ledger. Refusals come from the fixture's
// refused map (a real property of the feed), never invented by the UI. Market averages only:
// this is not the experiment effect ledger.
function benchCard(i) {
  const B = RDI.benchmark;
  if (!B || !i.metric) return null;
  const head = h("div.spread", h("h3", { style: "margin:0" }, "Competitive benchmark"), chip("network · " + (state.benchmarkOn ? "on" : "off"), "benchmark"));
  if (!state.benchmarkOn) {
    return h("div.card.tight", head,
      h("div.hint.explain.mt", null, "Nothing is uploading here: an anonymized average across other Rocket operators who opted in. Off right now, so nothing is shared and nothing is shown. ",
        h("a", { href: "#/data" }, "Turn it on under Data provenance"), "."));
  }
  const v = B.per_metric[i.metric];
  if (v == null) {
    return h("div.card.tight", head,
      h("div.hint.note.mt", null, B.refused && B.refused[i.metric] === "below_k_floor"
        ? "Not shown: fewer than 5 opted-in operators have a comparable book behind " + i.metric + ". Publishing a median of four would identify someone, so the platform refuses instead."
        : "Not in the shared benchmark: opted-in operators do not pool " + i.metric + " into a published cell."));
  }
  const unit = unitOf(i.metric);
  const rows = [
    ["Your homes", i.focal_value, "var(--accent)", ""],
    ["Network median", v, "var(--benchmark)", B.operators + " operators · refreshed " + B.refreshed],
    ["Matched peer cohort", i.cohort_value, "var(--c2)", "your other homes, same metro"],
  ];
  const nums = rows.map((r) => Number(r[1])).filter(Number.isFinite);
  const max = Math.max(...nums, 1);
  return h("div.card.tight", head,
    h("div.mt", ...rows.flatMap(([lab, val, color, note]) => [
      h("div.tiny.muted.mt", null, lab + (note ? " · " + note : "")),
      h("div.bar", { title: lab + ": " + fmt.num(val) + " " + unit },
        h("i", { style: "width:" + (Number.isFinite(val) ? Math.max(4, Math.round(100 * val / max)) : 0) + "%;background:" + color })),
      h("div.mono.tiny", { style: "margin:2px 0 -6px" }, fmt.num(val) + (unit ? " " + unit : "")),
    ])),
    h("div.hint.explain.tiny.mt", null, "Read it as market context, not evidence: ", B.method,
      " This is a market average, not an effect from the experiment ledger. Your gap here may be operational (yours to fix) or industry-wide (everyone's to accept); the money and ranking on this page come only from your own matched homes and your own experiments."));
}
function unitOf(metric) { return ({ days_to_lease: "days", renewal_rate: "pp", effective_rent_per_home: "$/mo", concession_days_per_lease: "days", noi_per_home: "$/yr", capex_per_home: "$/yr", turnover_cost_per_moveout: "$" })[metric] || ""; }
function shrinkageBox(i) {
  const aid = MEASURED_ACTION[i.id];
  const sh = aid && RDI.shrinkage[aid];
  if (!sh) return h("div.hint.note", null, "No cross-customer prior yet: fewer than five operators have measured results on this lever, so pooling would risk identifying someone.");
  const op = sh.operator_prior, cross = sh.cross_customer_prior;
  return h("div.mt",
    h("div.tiny.muted", null, "Empirical-Bayes decomposition (k = 4):"),
    h("div.mono.tiny", { style: "margin-top:6px;line-height:1.9" },
      "w = n/(n+k) = " + sh.w,
      h("br", null), "operator prior  " + fmt.num(op.mean) + "  (" + (op.source || "") + ")",
      h("br", null), "cross-customer   " + (cross ? fmt.num(cross.mean) + "  (" + cross.n_operators + " operators)" : "none"),
      h("br", null), h("b", { style: "color:var(--accent2)" }, "shrunk → " + fmt.num(sh.shrunk))));
}
function drawInsightChart(main, i) {
  const svg = S("svg", { viewBox: "0 0 640 200" });
  const focal = i.focal_value, cohort = i.cohort_value;
  const net = state.benchmarkOn && RDI.benchmark && RDI.benchmark.per_metric ? RDI.benchmark.per_metric[i.metric] : null;
  const vals = [focal, cohort].concat(net == null ? [] : [net]);
  const lo = Math.min(...vals) * 0.6 || 0, hi = Math.max(...vals) * 1.25 || 1;
  const X = (v) => 60 + ((v - lo) / (hi - lo)) * 520;
  svg.append(S("line", { x1: 60, y1: 120, x2: 580, y2: 120, stroke: "var(--border)" }));
  svg.append(S("line", { x1: X(cohort), y1: 60, x2: X(cohort), y2: 140, stroke: "var(--c2)", "stroke-width": 3 }));
  svg.append(S("text", { x: X(cohort), y: 52, "text-anchor": "middle", "font-size": 11, fill: "var(--c2)" }, "peer cohort " + fmt.num(cohort)));
  if (net != null) {
    svg.append(S("line", { x1: X(net), y1: 120, x2: X(net), y2: 196, stroke: "var(--benchmark)", "stroke-width": 3, "stroke-dasharray": "5 4" }));
    svg.append(S("text", { x: X(net), y: 188, "text-anchor": "middle", "font-size": 11, fill: "var(--benchmark)" }, "network median " + fmt.num(net)));
  }
  if (i.gap_ci && i.gap_ci[1] > i.gap_ci[0])
    svg.append(S("line", { x1: X(focal + i.gap_ci[0]), y1: 100, x2: X(focal + i.gap_ci[1]), y2: 100, stroke: "var(--accent)", "stroke-width": 5, opacity: 0.35 }));
  svg.append(S("line", { x1: X(focal), y1: 80, x2: X(focal), y2: 150, stroke: "var(--accent)", "stroke-width": 3 }));
  svg.append(S("text", { x: X(focal), y: 170, "text-anchor": "middle", "font-size": 11, fill: "var(--accent2)" }, "focal " + fmt.num(focal)));
  main.append(h("div.svgwrap.mt", h("h3", { style: "margin-top:0" }, "Focal vs peer cohort: " + i.metric), svg,
    h("div.legend", h("span.muted", null, i.metric + " · gap " + fmt.num(i.gap) + " · CI " + (i.gap_ci ? "[" + fmt.num(i.gap_ci[0]) + ", " + fmt.num(i.gap_ci[1]) + "]" : "n/a")))));
}

/* ============================================================
   #/design/<insightId>: the design ladder (PRD order, binding)
   ============================================================ */
const LADDER = [
  { rung: "Regression discontinuity", why: "A hard cutoff exists on this lever: no assignment, no fairness exposure, no interference. Always preferred." },
  { rung: "Switchback (submarket × time)", why: "Demand-side lever with interference between neighboring units, so treatment rotates on a submarket by 4-week cell grid." },
  { rung: "Stepped wedge (staggered rollout)", why: "The operator will not withhold treatment, so timing is randomized and everyone is eventually treated. Also the meta-measurement design." },
  { rung: "Home-level A/B", why: "Non-resident-facing, low-interference operational lever with independent units." },
  { rung: "DiD / synthetic control", why: "Nothing else available: the weakest design, flagged as such." },
];
function ladderFor(insight, policies, unit, constraints) {
  const rows = LADDER.map((L, ix) => ({ ...L, ix: ix + 1, rej: null }));
  const R = (sel, reasons) => {
    rows.forEach((r, ix) => { if (ix !== sel) r.rej = reasons[ix] ?? "not preferred for this lever"; });
    return { rows, sel, note: "" };
  };
  if (constraints.resident_facing_pricing) {
    rows.forEach((r) => { r.rej = "resident-facing pricing is never randomized (rule 3)"; });
    return { rows, sel: -1, note: "Rule 3 blocks every rung: the platform never randomizes resident-facing pricing. Operational proxies (turnover, occupancy, capex) remain available." };
  }
  if (unit === "metro") {
    rows.forEach((r, ix) => {
      if (ix === 1) r.rej = "recommended fallback: switchback on submarket × 4-week cells (see E5)";
      else r.rej = ix === 0 ? "3 metro clusters, underpowered; RD needs homes, not metros" : "coarser than the situation allows at 3 clusters";
    });
    return { rows, sel: -1, note: "unit = metro renders underpowered: 3 clusters. Builder recommends switchback." };
  }
  const related = policies.filter((p) => p.lens && insight.lens_usd[p.lens] > 0 && p.status !== "underpowered");
  const cutoff = related[0];
  if (constraints.interference_risk)
    return R(1, {
      0: "interference risk high: demand lever, units are not stable, the cutoff comparison is contaminated",
      2: "wedge carries no interference protection this lever needs",
      3: "units not independent: home-level A/B is invalid here",
      4: "a randomized design is available, so DiD is a fallback, not the choice",
    });
  if (cutoff && cutoff.mccrary.p >= 0.01)
    return R(0, {
      1: "no interference on this lever: rotation is unnecessary operational cost",
      2: "the operator can run this design directly; a wedge spends rollout time it does not need",
      3: "assignment is unnecessary: the operator already runs the cutoff",
      4: "a clean natural experiment exists, so DiD is the weakest rung",
    });
  return R(2, {
    0: cutoff
      ? "the nearest cutoff is manipulated (McCrary p < 0.01); convert the policy to a randomized pilot"
      : "no cutoff on this lever: no continuous running variable with a hard threshold",
    1: "not a demand lever: interference is not the binding constraint",
    3: "operator will not withhold treatment",
    4: "a randomized design is available, so DiD is the weakest rung",
  });
}
function viewDesign(id) {
  const main = $("#main");
  const i = RDI.insights.find((x) => x.id === (id || "I1").toUpperCase()) || RDI.insights[0];
  const d = RDI.designs.find((x) => x.insight_id === i.id);
  const tabs = h("div.tabs",
    ...RDI.insights.map((x) => h("a" + (x.id === i.id ? ".active" : ""), { href: "#/design/" + x.id }, x.id)));
  main.append(h("h1", null, "Design lab · " + i.id), tabs, h("p.sub", null, "The builder picks the strongest study design the situation allows, walking down a fixed list and explaining why each weaker option was rejected."));
  if (!d) main.append(h("div.callout.warn", null, "No study design has been registered for " + i.id + " yet; the builder proposes one below."));
  const unitSel = h("select", ...["home", "submarket", "metro"].map((u) => h("option", { value: u, selected: u === "home" }, u)));
  const con = state.designSel.constraints;
  const checks = [
    ["interference_risk", "interference risk high (demand lever)"],
    ["fairness_review_required", "fairness review required"],
    ["resident_facing_pricing", "resident-facing pricing (NEVER randomized)"],
  ];
  const cbox = h("div.card.mt", h("h3", { style: "margin-top:0" }, "Constraints"));
  for (const [k, label] of checks)
    cbox.append(h("label.tiny", { style: "display:block;margin:7px 0" },
      h("input", { type: "checkbox", checked: !!con[k], onchange: (e) => { con[k] = e.target.checked; render(); } }), " " + label));
  const ladderHost = h("div.mt");
  const render = () => {
    const unit = unitSel.value;
    const L = ladderFor(i, RDI.policies, unit, con);
    ladderHost.innerHTML = "";
    const ul = h("ul.ladder");
    L.rows.forEach((r, ix) => ul.append(h("li" + (ix === L.sel ? ".sel" : ".rej"),
      h("span.rk", null, String(r.ix)), h("div", h("b", null, r.rung),
        h("div.why", null, ix === L.sel ? r.why : r.rej)))));
    ladderHost.append(ul);
    if (L.note) ladderHost.append(h("div.callout" + (L.sel === -1 ? ".warn" : ""), null, L.note));
    ladderHost.append(powerCard(unit));
  };
  unitSel.addEventListener("change", render);
  main.append(h("div.grid.g2",
    h("div.card",
      h("h3", { style: "margin-top:0" }, "Pre-registered design · " + (d ? d.insight_id : i.id)),
      h("label.fl", null, "Falsifiable hypothesis (editable)"),
      h("textarea", { rows: 3 }, (d && d.hypothesis) || hypoFrom(i)),
      h("div.grid.g2.mt",
        h("div", h("label.fl", null, "Primary metric (catalog)"), h("select", {}, ...(d ? [d.primary_metric] : RDI.metricCatalog.primary.map((x) => x.id)).map((m) => h("option", { value: m }, m)))),
        h("div", h("label.fl", null, "Randomization unit"), unitSel)),
      h("div.mt", h("label.fl", null, "Secondary metrics"), h("div.tiny.mono.muted", null, (d && d.secondary_metrics || []).join(" · ") || "n/a")),
      h("div.mt", h("label.fl", null, "Guardrails"), h("div", {}, ...(d && d.guardrails || []).map((g) => chip(g, "accent"))))),
    h("div", cbox, ladderHost)));
  render();
  main.append(registerBox(i, d, unitSel));
}
function hypoFrom(i) {
  return `Raising the focal cohort's ${i.metric} to the peer benchmark cuts annual ${i.metric} impact by at least half of the measured gap within two quarters, with guardrails intact.`;
}
function powerCard(unit) {
  const k = { home: 2400, submarket: 18, metro: 3 }[unit];
  const nPer = unit === "home" ? 1 : { submarket: 133, metro: 800 }[unit];
  const icc = unit === "home" ? 0.02 : 0.08;
  const deff = 1 + (nPer - 1) * icc;
  const mde = 2.8 * Math.sqrt((2 * deff) / (k * nPer)) * 0.55;
  const runtime = unit === "home" ? "1 quarter" : unit === "submarket" ? "2 quarters" : "n/a";
  const powered = k >= 12;
  return h("div.card.mt", h("h3", { style: "margin-top:0" }, "Power (computed from unit choice)"),
    h("div.grid.g4",
      kpi("Clusters", k, "randomized units"),
      kpi("ICC", icc, "design effect " + deff.toFixed(1)),
      kpi("MDE", (mde * 100).toFixed(1) + "% rel", "80% power · α .05"),
      kpi("Runtime", runtime, "24-month panel")),
    !powered && h("div.callout.warn.mt", null, "underpowered: " + k + " clusters; builder recommends switchback on submarket × 4-week cells (E5 pattern)."));
}
function registerBox(i, d, unitSel) {
  const box = h("div.card.mt", h("h3", { style: "margin-top:0" }, "Register experiment"));
  const btn = h("button", null, "Register → operations");
  btn.addEventListener("click", () => {
    const n = RDI.experiments.length + state.registered.length + 1;
    const rec = {
      id: "E" + n, insight: i.id, owner: "You (PM demo)", ref: "wo-batch-e" + n + "-2026w42",
      readout: "2026-12-15", unit: unitSel.value,
      checklist: ["metric snapshot locked", "guardrail thresholds confirmed", "ops export queued"],
    };
    state.registered.push(rec);
    box.innerHTML = "";
    box.append(h("h3", { style: "margin-top:0" }, "Registered"),
      h("div.callout.ok", null, "Owner: ", rec.owner, " · readout ", rec.readout, " · export_ref ", h("code", null, rec.ref),
        h("ul.tiny", null, ...rec.checklist.map((x) => h("li", null, x))),
        " ", h("a.tiny", { href: "#/ledger" }, "→ appears in the ledger")));
  });
  box.append(h("div.hint.explain", null, "Registration emits an owner, checklist, readout date, and a work-order export reference."), h("div.btnrow", btn));
  return box;
}

/* ============================================================
   #/policy/<id>: the RD readout
   ============================================================ */
function viewPolicy(id) {
  const main = $("#main");
  const p = RDI.policies.find((x) => x.id === (id || "P1").toUpperCase()) || RDI.policies[0];
  const metricName = Object.values(RDI.metricCatalog).flat().find((x) => x.id === p.outcome_metric)?.name ?? "the outcome";
  const question = POLICY_QUESTIONS[p.id] ?? `Does ${p.name.toLowerCase()} change ${metricName}?`;
  const costSec = (p.secondary_effects || []).find((s) => s.outcome_metric === "capex_per_home");
  let aLine;
  if (p.status === "manipulated") {
    aLine = "Unknown with current data: the number that triggers this rule is sorted at the line (proof below), so \u201cjust under\u201d and \u201cjust over\u201d are no longer the same kind of home.";
  } else if (p.status === "underpowered") {
    aLine = "Unknown with current data: too few homes sit near the line to tell a real difference from noise.";
  } else if (p.estimate == null || !p.ci) {
    aLine = "Unknown with current data: no effect is reported for this cutoff.";
  } else if (p.verdict === "effect") {
    aLine = `Yes. Just past the line, ${metricName} is ${fUnit(p.outcome_metric, p.estimate)} versus otherwise-identical homes just under it (95% CI ${fUnit(p.outcome_metric, p.ci[0], false)} to ${fUnit(p.outcome_metric, p.ci[1], false)}).`;
  } else if (p.verdict === "no_effect" && costSec && costSec.ci && costSec.estimate > 0 && p.ci[1] > 0 && costSec.ci[0] > 0
    && p.ci[1] < costSec.ci[0]
    && metricUnit(p.outcome_metric) === "usd/yr" && metricUnit(costSec.outcome_metric) === "usd/yr") {
    // Strict annual-vs-annual, asserted on BOTH sides via the catalog as single unit source
    // (fixture outcome_unit strings are heterogeneous; do not use them for logic).
    // Guard additionally requires optimistic gain < conservative spend, so the "never pays"
    // claim is arithmetically implied; otherwise fall through to the plain "No" line.
    const ratio = Math.min(99, Math.floor((100 * p.ci[1]) / costSec.ci[0]));
    aLine = `No. In the measured year, even the most favorable plausible gain (${fUnit(p.outcome_metric, p.ci[1])}) covers at most ${ratio < 1 ? "less than 1%" : ratio + "%"} of the extra annual spend at its lower bound (${fUnit(costSec.outcome_metric, costSec.ci[0])}); nothing at this line pays for itself.`;
  } else if (p.verdict === "no_effect") {
    aLine = `No. Just past the line, ${metricName} differs by ${fUnit(p.outcome_metric, p.estimate)} (95% CI ${fUnit(p.outcome_metric, p.ci[0], false)} to ${fUnit(p.outcome_metric, p.ci[1], false)}); statistically indistinguishable from the twins just under it.`;
  } else {
    aLine = "Unknown with current data: no effect is reported for this cutoff.";
  }
  main.append(h("h1", null, p.id + " · " + p.name),
    h("div.tabs",
      ...RDI.policies.map((x) => h("a" + (x.id === p.id ? ".active" : ""), { href: "#/policy/" + x.id }, x.id))),
    h("p.sub", null, h("b", null, "Q: "), question + " ",
      h("b", null, "A: "), aLine + " ",
      h("b", null, "The line: "), "a de facto policy: what your managers actually do, written down or not. The outcomes jump at exactly this number because your decision history crosses it: \u201c" + p.policy_text + "\u201d."));
  // Placement between the Q/A and the sample line is the user's explicit call:
  // the action is the point of the screen, top position, every policy.
  const actionCard = h("div.action-card",
    h("div.todo", null, POLICY_TODO[p.id] ?? "TODO: review next ops cycle"),
    h("p", null, p.recommendation ?? "Review next ops cycle."),
    opportunityLine(p), projLine(p));
  main.append(actionCard);
  main.append(h("div.tiny.muted.mt", null, `n=${p.n_in_bandwidth} homes / ${p.n_rows_in_bandwidth} rows near the line`));
  // NOTE (PRD six end states): the chip ternary defaults any unknown status to "valid" and
  // build_fixtures asserts the three-status enum; if guardrail_stopped/inconclusive policy
  // statuses are ever introduced, extend BOTH the build enum assert and this chip map.
  main.append(h("div.row", chip(p.status.replace(/_/g, " "), p.status === "manipulated" ? "manipulated" : p.status === "underpowered" ? "underpowered" : "valid"),
    p.verdict ? chip("verdict: " + p.verdict, p.verdict === "effect" ? "effect" : "") : chip("verdict: suppressed"),
    chip(p.lens, "accent")));
  if (p.status === "manipulated") {
    main.append(h("div.callout.err.mt", null, "This cutoff is being gamed: the number of homes on each side of the line jumps at exactly the wrong spot (density test p ", fmt.p(p.mccrary.p), "). Regression discontinuity is invalid here."));
    main.append(h("div.svgwrap.mt", mccraryChart(p)));
    main.append(h("div.hint.explain.mt", null, "Effect numbers are suppressed by design: a gamed threshold must not render an estimate."));
    main.append(h("div.hint.note.mt", null,
      p.id === "P2"
        ? h("span", null, h("b", null, "The way out: let a draw, not the score, pick which homes get new floors. "),
          "For every home coming up for turnover inspection over the next lease-up season, if it scores near 7.0 a coin decides: new floors, or clean and list as-is. Nobody gains from shading a score, so Days to lease and Effective rent / home finally answer whether the work pays. Register it in the design lab; results land in the ledger, and this refusal becomes a number.")
        : h("span", null, h("b", null, `The way out: let a draw, not the rule, pick which homes get treated near the ${cutoffLabel(p.cutoff)} cutoff. `),
          `For the next cohort of decisions at the line, flip a coin: treat, or hold. Nobody gains from nudging the number that triggers the rule, so ${metricName} finally gets measured where the rule claims to move it. Register it in the design lab; results land in the ledger, and this refusal becomes a number.`)));
    return;
  }
  main.append(h("div.g2.grid.mt",
    h("div.svgwrap", scatterChart(p)),
    h("div",
      h("div.svgwrap", mccraryChart(p)),
      h("div.card.mt", h("h3", { style: "margin-top:0" }, "Robustness strip"),
        bandwidthStrip(p), robustnessStrip(p), specNotes(p)))));
  main.append(h("div.card.mt", h("h3", { style: "margin-top:0" }, "Secondary effects: " + p.id),
    ...p.secondary_effects.map((s) => h("div.spread", { style: "margin:6px 0" },
      h("span.tiny", null, metricLabel(s.outcome_metric)),
      h("span.mono.tiny", null, fUnit(s.outcome_metric, s.estimate), h("span.muted", null, ` [${fUnit(s.outcome_metric, s.ci[0], false)}, ${fUnit(s.outcome_metric, s.ci[1], false)}]`))))));
}
// Portfolio-average asking rent, weighted by submarket homes; submarkets missing avg_rent are
// skipped rather than zero-filled (zero would bias the average down). Portfolio-wide on purpose -
// it is the same proxy the rendered "upper-bound cash proxy" caveat refers to.
function avgAskRent() {
  let rs = 0, hs = 0;
  for (const s of RDI.submarkets || []) { if (s.avg_rent > 0 && s.homes > 0) { rs += s.avg_rent * s.homes; hs += s.homes; } }
  return hs ? rs / hs : null;
}
// Action-card dollar line: converts a certified effect into money using ONLY fixture fields, at the
// conservative near-zero end of the 95% interval. Direction is read from the estimate sign and the
// metric identity decides what the days mean (idle vs comped). Asking rent is an upper-bound cash
// proxy and the line says so; the count multiplier one-off $ metrics would need is not measured, so
// those (and unpriceable units) get NO line - an unpriced result is a count or silence, never an
// invented dollar. Returns null for anything that hasn't earned an effect verdict.
function opportunityLine(p) {
  if (p.verdict !== "effect" || p.estimate == null || !p.ci) return null;
  const band = p.n_in_bandwidth;
  if (!(band > 0)) return null;
  const unit = metricUnit(p.outcome_metric);
  // "conservative bound" is only meaningful when the interval excludes zero; a straddling or
  // touching zero CI (an invariant the effect verdict should guarantee but screen numbers must not
  // trust) silences the line instead of overstating the effect.
  if (!(p.ci[0] > 0 || p.ci[1] < 0)) return null;
  const bound = Math.min(Math.abs(p.ci[0]), Math.abs(p.ci[1]));
  const label = () => h("b", null, "Opportunity: ");
  // Metric-identity gates mirror the pp branch: wording may only name a metric it actually ran on.
  if (unit === "usd/yr" && /noi/.test(p.outcome_metric)) {
    const dir = p.estimate < 0 ? "reduces" : "increases";
    return h("div.opp.mt", null, label(),
      `At the study's conservative bound this rule ${dir} NOI by ${fmt.usd(bound)} per home per year - ${fmt.usd(bound * band)}/yr across the ${fmt.num(band)} measured homes.`);
  }
  if (/^days/.test(unit)) {
    const rent = avgAskRent();
    if (!rent) return null;
    // One lease per measured home: where homes listed more than once (P3 has 1,158 rows over 775
    // homes), this UNDERstates the annual effect - conservative, same direction as the bound.
    const perHome = bound * (rent / 30);
    let why;
    if (/concession/.test(p.outcome_metric))
      why = p.estimate < 0 ? `each treated listing pays ${fmt.num(bound, 1)} fewer days of comped rent`
        : `each treated listing pays out ${fmt.num(bound, 1)} extra days of comped rent`;
    else if (/lease|vacant|market/.test(p.outcome_metric))
      why = p.estimate < 0 ? `each treated home sits idle ${fmt.num(bound, 1)} days less`
        : `each treated home sits idle ${fmt.num(bound, 1)} days longer`;
    else
      why = `${metricLabel(p.outcome_metric)} shifts by ${fmt.num(bound, 1)} days per treated home`;
    return h("div.opp.mt", null, label(),
      `${why} - priced at portfolio-average asking rent (${fmt.usd(rent)}/mo; an upper-bound cash proxy, NOI recovery is lower), that is ${fmt.usd(perHome)} per home, ${fmt.usd(perHome * band)} across the ${fmt.num(band)} measured listings.`);
  }
  // pp wording is lease-specific, so it belongs ONLY to renewal_rate; any other pp metric
  // (delinquency_30d_rate, satisfaction scores) would get a fabricated "leases" claim: silence.
  if (unit === "pp" && /renewal/.test(p.outcome_metric)) {
    const leases = (bound / 100) * band;
    const countTxt = leases < 1
      ? `works out to fewer than one retained lease in total, across the ${fmt.num(band)} measured homes`
      : `is ${fmt.num(Math.round(leases))} ${p.estimate < 0 ? "fewer retained leases" : "extra retained leases"} across the ${fmt.num(band)} measured homes`;
    return h("div.opp.mt", null, label(),
      `${p.estimate < 0 ? "Minus" : "Plus"} ${fmt.num(bound, 1)}pp at the conservative bound ${countTxt}. Each avoided move-out saves turnover cost - unpriced in this study, so we state the count, not a dollar.`);
  }
  // usd one-offs (turnover_cost_per_moveout), usd/mo, %: no count multiplier is measured here,
  // so pricing them would invent numbers. Silence over fabrication.
  return null;
}
// Annual $ projection if the policy's recommendation is adopted portfolio-wide. Inputs are all
// fixture-emitted: crossover population (adoption_econ), lease-up rate and NOI margin (economics),
// asking rent (submarkets). A projection is a triple: floor = conservative CI bound, est = point
// estimate (the fair projection: with a symmetric CI it is both the mean and the median of the
// study's value distribution), ceiling = optimistic CI bound. Explicitly a
// FORECAST: the RD effect is measured at the cutoff and assumed to transfer across the crossover
// population - the card and the Total opportunity page both say so.
// Returns {kind:"income", sub:"days"|"noi", floor, est, ceiling, eventsYr} | {kind:"avoided", ...} |
// {kind:"count", perYr, note} | null.
// Which sign of an effect is GOOD per metric. A projection only exists for beneficial,
// CI-resolved effects; a significant-but-harmful rule projects nothing (silence over a
// confidently wrong positive on the headline page). Polarity list is mirrored by
// verify_fixtures.gate_adoption, which recomputes every projection from fixtures.
const GOOD_DIR = { days_to_lease: -1, concession_days_per_lease: -1, noi_per_home: 1,
                   renewal_rate: 1, effective_rent_per_home: 1 };
const eventsLabel = (ae, n) => ae.events_unit === "homes"
  ? `${fmt.num(n)} homes past the line`
  : `${fmt.num(n)} ${ae.events_unit}/yr`;
// Exactly one of {pr, reason} is set: the projection the card/page shows, or the precise
// reason nothing is projected (the aggregate page promises named, accurate exclusion reasons -
// inferring a cause from verdict alone would mislabel, e.g., an unpriceable good effect as "cost").
function adoptionValue(p) {
  const ae = p.adoption_econ, ec = RDI.economics;
  const no = (reason) => ({ pr: null, reason });
  if (p.status === "manipulated") return no("the running variable is steered around the line, so no effect can be read and nothing is safe to project.");
  if (p.status === "underpowered") return no("too few homes near the line to claim value in either direction.");
  if (!ae || !ec || typeof ae.crossover_share !== "number" || !(ae.crossover_share >= 0) || !(ae.events_per_yr > 0))
    return no("the pricing population or portfolio economics are missing from the fixture data, so nothing can be honestly priced.");
  const firesYr = ae.events_per_yr * ae.crossover_share;
  if (p.verdict === "effect" && p.estimate != null && p.ci && (p.ci[0] > 0 || p.ci[1] < 0)) {
    const good = GOOD_DIR[p.outcome_metric];
    if (good === undefined) return no("no benefit polarity is defined for this metric, so a dollar projection would be an opinion, not a measurement.");
    if (Math.sign(p.estimate) !== good) return no("the measured effect is money going out, not value coming back, so there is nothing to project as upside.");
    const unit = metricUnit(p.outcome_metric);
    const bound = Math.min(Math.abs(p.ci[0]), Math.abs(p.ci[1]));
    if (/^days/.test(unit)) {
      const rent = avgAskRent();
      if (!rent || !(ec.noi_margin > 0)) return no("asking rent or NOI margin is missing from the panel economics, so idle days cannot be converted to dollars.");
      const perDay = (rent / 30) * ec.noi_margin;
      return { pr: { kind: "income", sub: "days", floor: bound * perDay * firesYr, est: Math.abs(p.estimate) * perDay * firesYr, ceiling: Math.max(Math.abs(p.ci[0]), Math.abs(p.ci[1])) * perDay * firesYr, eventsYr: firesYr } };
    }
    if (unit === "usd/yr" && /noi/.test(p.outcome_metric))
      return { pr: { kind: "income", sub: "noi", floor: bound * firesYr, est: Math.abs(p.estimate) * firesYr, ceiling: Math.max(Math.abs(p.ci[0]), Math.abs(p.ci[1])) * firesYr, eventsYr: firesYr } };
    if (unit === "usd/mo")
      return { pr: { kind: "income", sub: "rent", floor: bound * 12 * firesYr, est: Math.abs(p.estimate) * 12 * firesYr, ceiling: Math.max(Math.abs(p.ci[0]), Math.abs(p.ci[1])) * 12 * firesYr, eventsYr: firesYr } };
    if (unit === "pp" && /renewal/.test(p.outcome_metric)) {
      const perYr = (bound / 100) * firesYr;
      return { pr: { kind: "count", perYr, note: `≈${fmt.num(Math.round(perYr))} extra retained leases/yr; each avoided move-out saves turnover cost, unpriced here` } };
    }
    return no("no measured count multiplier exists to price this effect; unpriced, not unimportant.");
  }
  if (p.verdict === "no_effect" && p.status === "valid_natural_experiment") {
    const cap = (p.secondary_effects || []).find((s) => s.outcome_metric === "capex_per_home");
    if (cap && cap.ci && cap.ci[0] > 0)
      return { pr: { kind: "avoided", floor: cap.ci[0] * firesYr, est: Math.max(cap.estimate, cap.ci[0]) * firesYr, ceiling: cap.ci[1] * firesYr, eventsYr: firesYr } };
  }
  return no("the rule does nothing measurable, and no measured spend sits on the other side of the line to avoid.");
}
function adoptionProjection(p) { return adoptionValue(p).pr; }
function projLine(p) {
  const pr = adoptionProjection(p);
  if (!pr) return null;
  if (pr.kind === "count")
    return h("div.proj.mt", null, h("b", null, "Projected at scale: "), pr.note);
  const lead = pr.kind === "avoided"
    ? "Not adopting this saves (spend with no measured return):"
    : "Projected annual value if adopted:";
  const pricing = pr.kind === "avoided"
    ? `priced on ${eventsLabel(p.adoption_econ, Math.round(pr.eventsYr))}, at the measured extra spend per home (full dollars, no margin). `
    : pr.sub === "noi"
      ? `priced on ${eventsLabel(p.adoption_econ, Math.round(pr.eventsYr))}, in the study's own NOI dollars per treated home-year (no margin conversion; NOI is already net). `
      : pr.sub === "rent"
        ? `priced on ${eventsLabel(p.adoption_econ, Math.round(pr.eventsYr))}, in rent dollars per treated home-year (monthly effect × 12; incremental rent falls through to NOI). `
        : `priced on ${eventsLabel(p.adoption_econ, Math.round(pr.eventsYr))}, at the NOI margin ${Math.round(RDI.economics.noi_margin * 100)}% of asking rent (idle days recover lost rent net of opex). `;
  return h("div.proj.mt", null, h("b", null, lead + " "),
    `${fmt.usd(pr.floor)} – ${fmt.usd(pr.ceiling)}/yr (fair projection ${fmt.usd(pr.est)}), `, pricing,
    h("i", null, "Projected, not measured: assumes the cutoff effect holds across every home the rule fires on."));
}
function scatterChart(p) {
  const bins = p.bins;
  const xs = bins.map((b) => b.x), ys = bins.map((b) => b.mean);
  const c = p.cutoff, W = 560, H = 300, pad = 46;
  const xlo = Math.min(...xs), xhi = Math.max(...xs);
  const ylo = Math.min(...ys) - 40, yhi = Math.max(...ys) + 40;
  const X = (v) => pad + ((v - xlo) / (xhi - xlo)) * (W - 2 * pad);
  const Y = (v) => H - pad - ((v - ylo) / (yhi - ylo)) * (H - 2 * pad);
  const svg = S("svg", { viewBox: `0 0 ${W} ${H}` });
  const bw = p.bandwidth;
  svg.append(S("rect", { x: X(c - bw), y: 20, width: X(c + bw) - X(c - bw), height: H - 2 * pad, fill: "var(--accent)", opacity: 0.07 }));
  for (const t of niceTicks(ylo, yhi)) svg.append(S("g", null,
    S("line", { x1: pad, y1: Y(t), x2: W - pad, y2: Y(t), stroke: "var(--border)", "stroke-width": 0.6 }),
    S("text", { x: pad - 8, y: Y(t) + 4, "text-anchor": "end", "font-size": 10, fill: "var(--muted)" }, fmt.num(t, 0))));
  for (const t of niceTicks(xlo, xhi)) svg.append(S("text", { x: X(t), y: H - pad + 16, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, fmt.num(t, 0)));
  for (const b of bins) svg.append(S("circle", { cx: X(b.x), cy: Y(b.mean), r: 3, fill: "var(--fg)", opacity: b.x >= c ? 0.9 : 0.55 }));
  const fit = localFitPts(bins, c, bw);
  svg.append(S("path", { d: fitPath(fit, X, Y), stroke: "var(--c2)", "stroke-width": 2, fill: "none" }));
  svg.append(S("line", { x1: X(c), y1: 24, x2: X(c), y2: H - pad, stroke: "var(--warning)", "stroke-dasharray": "5 4" }));
  svg.append(S("text", { x: X(c), y: 16, "text-anchor": "middle", "font-size": 10, fill: "var(--warning)" }, "cutoff " + cutoffLabel(c)));
  svg.append(S("text", { x: W / 2, y: H - 6, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, RUNNING_GLOSS[p.running_var] ?? p.running_var));
  svg.append(S("text", { x: 12, y: H / 2, "font-size": 10, fill: "var(--muted)", transform: `rotate(-90 12 ${H / 2})`, "text-anchor": "middle" }, metricLabel(p.outcome_metric)));
  if (p.estimate !== null && fit.length === 2 && fit[0].length && fit[1].length) {
    // localFitPts samples g=0..10 per arm, so index 0 of each arm is the fitted point AT the cutoff;
    // the last index is the far end of the arm (chart edge). The bracket must connect the two cutoff vertices.
    const yL = fit[0][0][1], yR = fit[1][0][1];
    const est = p.estimate, ci = p.ci;
    svg.append(S("path", { d: `M${X(c) - 6} ${Y(yL)} H${X(c) + 4} V${Y(yR)} H${X(c) - 6}`, stroke: "var(--accent)", "stroke-width": 2, fill: "none" }));
    svg.append(S("text", { x: X(c) + 12, y: Y(Math.min(yL, yR)) - 6, "font-size": 11, fill: "var(--accent2)" }, `jump ${fUnit(p.outcome_metric, est)}`));
    svg.append(S("text", { x: X(c) + 12, y: Y(Math.min(yL, yR)) + 8, "font-size": 10, fill: "var(--muted)" }, `[${fUnit(p.outcome_metric, ci[0], false)}, ${fUnit(p.outcome_metric, ci[1], false)}]`));
  }
  const g = RUNNING_GLOSS[p.running_var] ?? "";
  // Unit-aware cutoff text for the example line, from RUNNING_GLOSS (single source for running-var wording):
  // money glosses get "$", "days ..." glosses get "days", a trailing "(unit)" parenthetical supplies its own unit,
  // and score glosses (no unit word) render the bare number.
  const cutoffText = (gloss, value) => {
    if (!gloss) return null;
    if (gloss.includes("($)")) return "$" + cutoffLabel(value);
    const unit = gloss.match(/\((\w+)\)/)?.[1] ?? (/^days?\b/.test(gloss) ? "days" : "");
    return cutoffLabel(value) + (unit ? " " + unit : "");
  };
  const cutTxt = cutoffText(g, c);
  const stepTxt = fUnit(p.outcome_metric, p.estimate);
  // Interpretation only for verdicts that earned it; no catch-all else (a null/unknown verdict
  // or missing estimate must never print a confident claim).
  let resultTxt = "";
  if (p.estimate != null && p.ci) {
    if (p.status === "underpowered") resultTxt = `Here the step reads ${stepTxt}, but with only ${fmt.num(p.n_in_bandwidth)} homes in the band it could easily be noise.`;
    else if (p.verdict === "effect") resultTxt = `Here the step is ${stepTxt} - too large to be luck; that is the rule's effect.`;
    else if (p.verdict === "no_effect") resultTxt = `Here the step is ${stepTxt} - too small to tell apart from zero, so this chart shows no effect.`;
  }
  return h("div", h("h3", { style: "margin-top:0" }, metricLabel(p.outcome_metric) + " vs " + (g || p.running_var)), svg,
    h("div.legend",
      h("span", null, sw("var(--fg)"), "averages of similar homes"),
      h("span", null, sw("var(--c2)"), "trend on each side"),
      h("span.muted", null, "shaded: homes close enough to be twins, differing only by the rule")),
    h("div.hint.mt", null,
      // The scatter window is cutoff +/- 1.5 bandwidth (compute_rd bins_series); claiming every study
      // home is plotted would be false, so n_total is named as the study population, not the plotted set.
      `The study covers ${fmt.num(p.n_total)} homes in total; the chart zooms in on estimates near the cutoff. The shaded region is the bandwidth: the ${fmt.num(p.n_in_bandwidth)} homes closest to the line, treated as twins, and they decide the step. The Robustness strip card re-runs the study at half and double this window. ` +
      `Example: two near-identical homes land on opposite sides of ${cutTxt ? "the cutoff at " + cutTxt : "this rule"} - one gets the rule, one does not, so the gap between the trend lines at the dashed line is the step we read as the rule's effect. ` +
      resultTxt));
}
function localFitPts(bins, c, bw) {
  const out = [];
  for (const side of [-1, 1]) {
    const inb = bins.filter((b) => (b.x - c) * side > 0 && Math.abs(b.x - c) <= bw * 1.15);
    if (!inb.length) { out.push([]); continue; }
    const pts = [];
    for (let g = 0; g <= 10; g++) {
      const xv = c + side * (bw * 1.15 * g / 10);
      let sw1 = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
      for (const b of inb) {
        const u = (b.x - xv) / bw, kw = Math.abs(u) < 1 ? 1 - u * u : 0;
        sw1 += kw; swx += kw * (b.x - xv); swy += kw * b.mean; swxx += kw * (b.x - xv) ** 2; swxy += kw * (b.x - xv) * b.mean;
      }
      if (!sw1) continue;
      const den = sw1 * swxx - swx * swx;
      const bhat = den ? (sw1 * swxy - swx * swy) / den : 0, ahat = (swy - bhat * swx) / sw1;
      pts.push([xv, ahat]);
    }
    out.push(pts);
  }
  return out;
}
const fitPath = (pts, X, Y) => pts.map((arm) => arm.map(([x, y], ix) => (ix ? "L" : "M") + X(x).toFixed(1) + " " + Y(y).toFixed(1)).join(" ")).join(" ");
function mccraryChart(p) {
  const c = p.cutoff;
  const hist = p.mccrary_hist;
  const W = 520, H = 210, pad = 34;
  const xs = hist.map((b) => b.x);
  const lo = Math.min(...xs) - 0.3, hi = Math.max(...xs) + 0.3;
  const m = Math.max(...hist.map((b) => b.n));
  const X = (v) => pad + ((v - lo) / (hi - lo)) * (W - 2 * pad);
  const binW = hist.length > 1 ? (hist[1].x - hist[0].x) : 1;
  const plotH = H - 2.4 * pad;
  const svg = S("svg", { viewBox: `0 0 ${W} ${H}` });
  for (const b of hist) {
    const y = H - pad - (b.n / m) * plotH;
    svg.append(S("rect", { x: X(b.x - binW / 2), y, width: Math.max(2, X(b.x + binW / 2) - X(b.x - binW / 2) - 1), height: H - pad - y, fill: b.x < c ? "var(--c1)" : "var(--c3)", opacity: 0.75 }));
  }
  svg.append(S("line", { x1: X(c), y1: 12, x2: X(c), y2: H - pad, stroke: "var(--warning)", "stroke-dasharray": "4 3" }));
  svg.append(S("text", { x: X(c), y: 10, "text-anchor": "middle", "font-size": 10, fill: "var(--warning)" }, "cutoff " + cutoffLabel(c)));
  svg.append(S("line", { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: "var(--border)" }));
  svg.append(S("text", { x: X(xs[0] - binW / 2), y: H - pad + 12, "text-anchor": "middle", "font-size": 9, fill: "var(--muted)" }, fmt.num(xs[0] - binW / 2, 1)));
  svg.append(S("text", { x: X(xs[xs.length - 1] + binW / 2), y: H - pad + 12, "text-anchor": "middle", "font-size": 9, fill: "var(--muted)" }, fmt.num(xs[xs.length - 1] + binW / 2, 1)));
  svg.append(S("text", { x: W / 2, y: H - 6, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, RUNNING_GLOSS[p.running_var] ?? p.running_var));
  svg.append(S("text", { x: pad - 4, y: H - pad - plotH + 4, "text-anchor": "end", "font-size": 9, fill: "var(--muted)" }, m));
  svg.append(S("text", { x: pad - 4, y: H - pad + 1, "text-anchor": "end", "font-size": 9, fill: "var(--muted)" }, "0"));
  svg.append(S("text", { x: 10, y: H / 2, "font-size": 10, fill: "var(--muted)", transform: `rotate(-90 10 ${H / 2})`, "text-anchor": "middle" }, "homes"));
  return h("div", h("h3", { style: "margin-top:0" }, "Density of the running variable (McCrary)"), svg,
    h("div.legend", h("span.mono.tiny", null, "log-jump " + fmt.num(p.mccrary.log_jump, 3) + " · p " + fmt.p(p.mccrary.p)),
      h("span.muted", null, p.status === "manipulated"
        ? "a crowd piled up before the line: the number is being managed, so the comparison breaks"
        : "no sign of a crowd at the line: no evidence the number is being gamed, so the comparison isn't broken by sorting")));
}
function bandwidthStrip(p) {
  const W = 480, H = 110, pad = 66;
  // Label = multiple of the main bandwidth (0.5x/1x/2x), not the raw dollar window. The 1x row IS
  // the main estimate; if a fixture ever omits it, append it so the headline can't vanish from its
  // own sensitivity strip or escape the axis range.
  let vals = p.bandwidth_sensitivity || [];
  const isMain = (v) => p.bandwidth && Math.abs(v.bandwidth - p.bandwidth) <= 1e-9 * p.bandwidth;
  if (!p.bandwidth || !vals.length) return h("div.tiny.muted", null, "bandwidth sensitivity: n/a");
  if (!vals.some(isMain)) vals = vals.concat([{ bandwidth: p.bandwidth, estimate: p.estimate, ci: p.ci }]);
  const lo = Math.min(...vals.flatMap((v) => v.ci)), hi = Math.max(...vals.flatMap((v) => v.ci));
  const X = (v) => pad + ((v - lo) / (hi - lo || 1)) * (W - 2 * pad);
  const svg = S("svg", { viewBox: `0 0 ${W} ${H}` });
  svg.append(S("line", { x1: X(0), y1: 8, x2: X(0), y2: H - 18, stroke: "var(--muted)", "stroke-dasharray": "3 3" }));
  vals.forEach((v, ix) => {
    const y = 16 + ix * 22;
    svg.append(S("line", { x1: X(v.ci[0]), y1: y, x2: X(v.ci[1]), y2: y, stroke: "var(--accent)", "stroke-width": 4, opacity: 0.8 }));
    svg.append(S("circle", { cx: X(v.estimate), cy: y, r: 3.4, fill: "var(--fg)" }));
    svg.append(S("text", { x: pad - 8, y: y + 4, "text-anchor": "end", "font-size": 10, fill: isMain(v) ? "var(--fg)" : "var(--muted)" }, fmt.num(v.bandwidth / p.bandwidth, 2) + "×bw"));
  });
  return h("div", h("div.tiny.muted", null, "bandwidth sensitivity, shared axis"), svg,
    h("div.hint.mt", null, `The dashed line marks zero: a window whose bar crosses it is unresolved. `, bandwidthVerdict(p)));
}
// ciSpan: prefers an array ci; anything else (missing, number, object) falls back to
// estimate +/- 1.96*se, which is non-finite when se is also missing. finiteCI separates "interval
// missing/broken/reversed" (UNTESTABLE) from "interval includes zero" (unresolved) from "interval
// excludes zero" (resolved) - callers must never let a data hole read as a pass or a failure.
const ciSpan = (v) => v ? (Array.isArray(v.ci) ? v.ci : [v.estimate - 1.96 * v.se, v.estimate + 1.96 * v.se]) : [NaN, NaN];
const finiteCI = (v) => { const [a, b] = ciSpan(v); return Number.isFinite(a) && Number.isFinite(b) && a <= b; };
const untestable = (v) => !v || !Number.isFinite(v.estimate) || !finiteCI(v);
const crossesZero = (v) => { const [a, b] = ciSpan(v); return a <= 0 && b >= 0; };
// Verdict read from the fixture's own sensitivity rows - no hand-written claims.
function bandwidthVerdict(p) {
  // Non-numeric estimates dropped before any math; rows without a usable interval are counted and
  // disclosed, never silently folded into a pass.
  const rows = (p.bandwidth_sensitivity || []).filter((v) => v && Number.isFinite(v.estimate));
  if (rows.length < 2) return "";
  const testable = rows.filter((v) => finiteCI(v));
  if (!testable.length) return "No window has a usable interval, so window width cannot be tested here.";
  const holes = rows.length - testable.length;
  const holeTxt = holes ? ` Note: ${holes} of ${rows.length} windows lacked a usable interval and were excluded.` : "";
  const primaryOk = Number.isFinite(p.estimate) && finiteCI(p);
  const ests = rows.map((v) => v.estimate);
  const lo = Math.min(...ests), hi = Math.max(...ests);
  const eps = (hi - lo) * 1e-6; // an estimate at exact zero is no direction
  const signs = new Set(ests.filter((e) => Math.abs(e) > eps).map(Math.sign));
  if (signs.size > 1)
    return `Warning: the answer changes direction with the window (${fUnit(p.outcome_metric, lo)} to ${fUnit(p.outcome_metric, hi)}). An effect that exists only at one window width is not an effect.${holeTxt}`;
  const primaryTxt = primaryOk ? ` (primary: ${fUnit(p.outcome_metric, p.estimate)})` : "";
  if (testable.every(crossesZero))
    return `Widening or shrinking the window does not matter: nothing is found at any window width.${holeTxt}`;
  if (testable.every((v) => !crossesZero(v)))
    return `Widening or shrinking the window does not matter: every window resolves an effect of the same sign${primaryTxt}.${holeTxt}`;
  if (!primaryOk)
    return `Non-zero point estimates agree in direction across windows, but the estimates range from ${fUnit(p.outcome_metric, lo)} to ${fUnit(p.outcome_metric, hi)} and this study's own interval is unavailable, so no interval comparison can be made.${holeTxt}`;
  const [pclo, pchi] = ciSpan(p);
  const contained = lo >= pclo && hi <= pchi;
  return `Non-zero point estimates agree in direction across windows, but results differ in how resolved they are: ` +
    (contained
      ? `every window's estimate lies inside the primary interval, and the windows that resolve it agree.`
      : `the estimates range from ${fUnit(p.outcome_metric, lo)} to ${fUnit(p.outcome_metric, hi)}, past the primary interval; read that interval as the honest range.`) + holeTxt;
}
/* Robustness strip (doc §3.4): one row per specification, CI always rendered.
   A quadratic/donut spec whose CI dwarfs the primary CI is labeled as such
   instead of left to imply robustness (review r2). */
const ciWidth = (v) => (v.ci ? v.ci[1] - v.ci[0] : 2 * 1.96 * v.se);
function robustnessRows(p) {
  const weakNote = (v) => (ciWidth(v) > 4 * ciWidth(p) ? " · CI ≫ primary: uninformative at this scale" : "");
  return [
    ["quadratic (robustness)", p.quadratic, true, weakNote(p.quadratic)],
    ["donut (drop cutoff bins)", p.donut, true, weakNote(p.donut)],
    ...p.placebos.map((pl) => [`placebo cutoff ${fmt.num(pl.cutoff, 1)}`, pl, pl.estimate !== null, ""]),
  ];
}
function robustnessStrip(p) {
  return h("table", h("tr", null, h("th", null, "spec"), h("th.num", null, "estimate"), h("th.num", null, "95% CI")),
    ...robustnessRows(p).map(([label, v, has, note]) => h("tr", null, h("td.tiny", null, label + note),
      has ? h("td.num", null, fmt.num(v.estimate)) : h("td.num.muted", null, "support-truncated"),
      has ? h("td.num.muted", null, finiteCI(v) ? `[${fmt.num(ciSpan(v)[0], 1)}, ${fmt.num(ciSpan(v)[1], 1)}]` : "no interval") : h("td.num.muted", null, "n/a"))));
}
// Each spec checks one way a trend-line jump could be fake; the conclusion is computed from the
// fixture values, never hand-asserted. primaryCrosses/primaryResolved branch the wording per verdict.
function specNotes(p) {
  if (!Number.isFinite(p.estimate) || !finiteCI(p))
    return h("div.hint.mt", null, "This study's estimate or interval is missing, so the robustness checks are not interpretable.");
  const primaryCrosses = crossesZero(p);
  const [pclo, pchi] = ciSpan(p);
  const pSign = Math.sign((pclo + pchi) / 2); // sign of the primary interval midpoint
  const pEstSign = Math.sign(p.estimate) || pSign; // sign of the study estimate; midpoint sign only if the estimate is exactly 0
  // "agrees with the primary" = the spec estimate sits inside the primary 95% interval; if a spec
  // moves the answer outside the study's own uncertainty band, the result depends on that choice.
  const agree = (v) => Math.sign(v.estimate) === pSign && v.estimate >= pclo && v.estimate <= pchi;
  const branch = (v, name) => !v ? "this check was not run."
    : v.estimate === null ? "support-truncated: too few homes near the line to test."
      : !Number.isFinite(v.estimate) ? "estimate unavailable - not testable."
      : !finiteCI(v) ? "no interval to test - untested, not a null result."
      : primaryCrosses
        ? crossesZero(v) ? "still nothing to find."
          : Math.sign(v.estimate) === pEstSign
            ? `but the ${name} resolves in the same direction the primary window could not - inspect before believing either.`
            : `but the ${name} resolves in the OPPOSITE direction to the study's estimate (${fUnit(p.outcome_metric, v.estimate)}): a sign flip, not a confirmation.`
        : crossesZero(v) ? "the result disappears once this is allowed: not safe to spend on."
          : agree(v) ? "the result survives." : `the answer moves to ${fUnit(p.outcome_metric, v.estimate)}: the result depends on this choice.`;
  const placebos = p.placebos || [];
  const plEntries = placebos.filter((pl) => pl);
  const testable = plEntries.filter((pl) => !untestable(pl));
  const holes = plEntries.length - testable.length;
  const holeTxt = holes ? ` (${testable.length} of ${plEntries.length} testable)` : "";
  const jumps = testable.filter((pl) => !crossesZero(pl)).length;
  const plTxt = !plEntries.length ? "this check was not run."
    : !testable.length ? plEntries.some((pl) => Number.isFinite(pl.estimate))
      ? "no placebo has a usable interval - untested, not a null result."
      : "support-truncated: too few homes at the fake cutoffs to test."
      : jumps ? `a fake cutoff shows a jump${holeTxt} - treat this study's jump as suspect.`
        : `no jump appears at any fake cutoff${holeTxt}.`;
  return h("div.hint.mt",
    h("div", null, h("b", null, "quadratic - "), `lets each side's trend curve instead of forcing a near-straight line; checks a curve faking a jump. Here: ${branch(p.quadratic, "curved fit")}`),
    h("div", null, h("b", null, "donut - "), `drops the homes sitting exactly at the line; checks an effect living only in that razor-thin sliver (the shape gaming produces). Here: ${branch(p.donut, "fit that drops on-line homes")}`),
    h("div", null, h("b", null, "placebo cutoffs - "), `re-run the identical study at fake cutoffs where no rule exists; a jump there means the method invents jumps. Here: ${plTxt}`));
}

/* ============================================================
   #/opportunity: what adoption of the whole certified policy set is worth
   ============================================================ */
const PROJ_KIND = {
  income: ["income projection", "effect"],
  avoided: ["avoided spend", "valid"],
  count: ["count-only", ""],
};
function projBuckets() {
  const rows = [], excluded = [];
  for (const p of RDI.policies) {
    const v = adoptionValue(p);
    if (v.pr) rows.push({ p, pr: v.pr });
    else excluded.push([p, v.reason]);
  }
  const sum = (kind, side) => rows.filter((r) => r.pr.kind === kind && r.pr[side] != null)
    .reduce((a, r) => a + r.pr[side], 0);
  const bucket = (kind) => ({ floor: sum(kind, "floor"), est: sum(kind, "est"), ceiling: sum(kind, "ceiling") });
  return { rows, excluded, income: bucket("income"), avoided: bucket("avoided") };
}
function viewOpportunity(main) {
  const b = projBuckets();
  const floor = b.income.floor + b.avoided.floor, est = b.income.est + b.avoided.est,
        ceiling = b.income.ceiling + b.avoided.ceiling;
  const band = RDI.economics?.adoption_band;  // computed odds (tools/compute_rd.adoption_band)
  const xs = RDI.economics?.experiment_scale; // validated pilots not yet policy, scaled (build_fixtures)
  const confident = (p) => p == null ? "conservatively" : (p >= .995 ? ">99%" : Math.round(p * 100) + "%") + " confident";
  const unlikely = (p) => p == null ? "unlikely" : (p < .01 ? "<1%" : Math.round(p * 100) + "%") + " likely";
  const NOI = RDI.economics?.portfolio?.noi_yr;  // annualized portfolio NOI, panel sum
  const pct = (v) => `${(100 * v / NOI).toFixed(1)}%`;
  main.append(h("h1", null, "Total opportunity if adopted"),
    h("p.sub", null, `What the ${RDI.policies.length} policy experiments already in your operating manual are worth per year if every certified recommendation is adopted: measured effects priced on the populations the rules actually fire on, nothing hand-typed. Excluded studies are listed, by name and reason, below.`));
  main.append(h("div.callout.explain", null,
    "How to read the headline: every number is a ", h("b", null, "forecast"),
    ", not a measurement. The effect size is measured at the cutoff with regression discontinuity (see each policy natural experiment); the population it would act on is counted from the panel. Projecting a cutoff effect across the whole crossover population assumes it transfers. Dollar figures exclude excluded studies; excluded studies are excluded loudly, below.",
    h("div.mt", null, "The headline range is ", h("b", null, "floor – ceiling"), ": the ",
      h("b", null, "floor"), ` holds unless every study undershoots its own 95% interval (${confident(band?.p_floor)}); the `,
      h("b", null, "fair projection"), " is our central expectation, both the mean and the median of what the data supports; the ",
      h("b", null, "ceiling"), ` assumes every effect lands at its luckiest bound (${unlikely(band?.p_ceiling)}). Odds come from the studies' own CI widths, not from opinion.`),
    h("div.mt", null, "Two kinds of dollars, kept separate on purpose: ",
      chip("income projection", "effect"), " new NOI from measured effects (faster lease-ups, fewer concession days, higher NOI). ",
      chip("avoided spend", "valid"), " the P1-style case: the rule spends measurable money with no measured return, so not adopting it avoids that spend. Counting both is fair; they do not overlap. A certified effect that is only money going out is not upside and is excluded, with its reason.")));
  main.append(h("div.grid.g4",
    kpi("Projected value / yr", NOI ? `${fmt.usdM(floor)} – ${fmt.usdM(ceiling)}` : `${fmt.usd(floor)} – ${fmt.usd(ceiling)}`,
      `fair projection ${fmt.usd(est)} · floor ${confident(band?.p_floor)} · ceiling ${unlikely(band?.p_ceiling)}`, "proj"),
    kpi("New income / yr", `${fmt.usd(b.income.floor)} – ${fmt.usd(b.income.ceiling)}`,
      `fair projection ${fmt.usd(b.income.est)} · measured effects × crossover populations`),
    kpi("Avoided spend / yr", `${fmt.usd(b.avoided.floor)} – ${fmt.usd(b.avoided.ceiling)}`,
      `fair projection ${fmt.usd(b.avoided.est)} · spend the data says buys nothing, if the rule is dropped`),
    kpi("Studies excluded", String(b.excluded.length),
      "each reason is named in the table below, per study")));
  if (NOI) {
    // Vertical step-down: every bar anchored at the same left edge on the NOI scale,
    // longest to shortest. The band's three claims plus the narrowest one, top-down:
    // whole book -> ceiling (unlucky world) -> fair projection -> floor (~certain) -> income-only.
    const steps = [
      { label: "portfolio NOI", v: NOI, color: "var(--success)", cap: `${fmt.usdM(NOI)}/yr · whole book` },
      ...(xs && xs.total_scaled_usd ? [{ label: "+ validated pilots, scaled", v: est + xs.total_scaled_usd, color: "var(--accent2)", op: .5,
        cap: `${fmt.usd(est + xs.total_scaled_usd)} = ${pct(est + xs.total_scaled_usd)} · policy band fair + scaled pilots; conservative (overlap subtracted) ${fmt.usd(est + xs.total_conservative_usd)}` }] : []),
      { label: "policy band ceiling", v: ceiling, color: "var(--accent2)", op: .35,
        cap: `${fmt.usd(ceiling)} = ${pct(ceiling)} · ${unlikely(band?.p_ceiling)}` },
      { label: "fair projection", v: est, color: "var(--accent2)", op: .7,
        cap: `${fmt.usd(est)} = ${pct(est)} · expected value = median` },
      { label: "projected floor", v: floor, color: "var(--accent2)",
        cap: `${fmt.usd(floor)} = ${pct(floor)} · ${confident(band?.p_floor)}` },
      { label: "income only, fair", v: b.income.est, color: "var(--accent2)", op: .25,
        cap: `${fmt.usd(b.income.est)} = ${pct(b.income.est)} · excludes avoided capex` },
    ].sort((s1, s2) => (s2.v ?? 0) - (s1.v ?? 0));
    main.append(h("div.card.mt",
      h("div.tiny.mono.muted", { style: "text-transform:uppercase;letter-spacing:.6px" }, "Projected value against portfolio NOI · one scale"),
      h("div.wsteps.mt", ...steps.map((s) => h("div.lrow",
        h("div.tiny.mono.muted.ll", null, s.label),
        h("div.lt", h("i.lb", { style: `width:${(100 * s.v / NOI).toFixed(2)}%;background:${s.color};opacity:${s.op ?? 1}` })),
        h("div.tiny.lv", { style: `color:${s.color}` }, s.cap)))),
      h("div.tiny.muted.mt", null,
        `Odds are arithmetic, not opinion: each study's SE is its published CI width ÷ 3.92, and the total is the sum of independent normals; a shared panel would widen the band, so treat the ceiling odds as flattering. Bars mix avoided capex (real cash avoided, not NOI) with measured income; income only, at the fair projection, is the narrowest defensible claim: ${pct(b.income.est)} of NOI. Floor alone ≈ +${fmt.usd(floor / (RDI.meta.homes || 1))}/home/yr.`)));
  }
  const t = h("table");
  t.append(h("tr", null, ...["Policy", "Rule fires on", "Effect", "Kind", "Annual value, floor – ceiling"].map((x, i) => h("th" + (i === 4 ? ".num" : ""), null, x))));
  const ordered = b.rows.sort((a, x) => (x.pr.floor ?? 0) - (a.pr.floor ?? 0));
  for (const { p, pr } of ordered) {
    const ae = p.adoption_econ, [kLabel, kCls] = PROJ_KIND[pr.kind];
    t.append(h("tr.clk", { onclick: () => (location.hash = "#/policy/" + p.id) },
      h("td", h("b", null, p.id), " ", h("span.tiny", null, p.name)),
      h("td.tiny.mono.muted", null, eventsLabel(ae, Math.round(pr.eventsYr ?? ae.events_per_yr * ae.crossover_share))),
      h("td.num.tiny", { style: "white-space:nowrap" }, fUnit(p.outcome_metric, p.estimate)),
      h("td", null, chip(kLabel, kCls)),
      pr.kind === "count"
        ? h("td.num.tiny.muted", null, `${fmt.num(Math.round(pr.perYr))} extra leases/yr`)
        : h("td.num", { style: "white-space:nowrap" },
            fmt.usd(pr.floor), " – ", fmt.usd(pr.ceiling), " ",
            h("span.tiny.muted", null, `(fair ${fmt.usd(pr.est)}${pr.kind === "avoided" ? ", avoided" : ""})`))));
  }
  main.append(h("div.card.mt", t, h("div.tiny.muted.mt", null,
    "Count-only studies add leases, not dollars, so they are intentionally absent from the headline total.")));
  if (xs?.rows?.length) {
    const bmetric = {};
    for (const r of xs.rows) { const ii = RDI.insights.find((x) => x.id === r.insight_id); bmetric[r.action_id] = state.benchmarkOn && ii ? RDI.benchmark?.per_metric?.[ii.metric] : null; }
    const showNet = xs.rows.some((r) => bmetric[r.action_id] != null);
    const tx = h("table");
    tx.append(h("tr", null, ...[["Validated pilot", ""], ["What ran", ""], ["Realized in pilot", ".num"], ["Scaled to the book", ".num"], ["Scale target", ""]].concat(showNet ? [["Network median", ".num"]] : []).map(([x, cls]) => h("th" + cls, null, x))));
    for (const r of xs.rows)
      tx.append(h("tr.clk", { onclick: () => (location.hash = "#/design/" + r.insight_id) },
        h("td", h("b", null, r.action_id), " ", h("span.tiny", null, r.lever),
          r.net_of ? h("div.tiny.muted", null, "overlaps " + r.net_of.join("+") + " in the band; conservative figure below") : null),
        h("td.tiny.mono.muted", null, ...r.readouts.flatMap((rd, idx) => [idx ? " + " : "", h("a", { href: "#/readout/" + rd, onclick: (e) => e.stopPropagation() }, rd)]), " · " + r.scope_homes + " homes"),
        h("td.num.tiny", null, fmt.usd(r.realized_usd) + "/yr"),
        h("td.num", { style: "color:var(--accent2)" }, fmt.usd(r.scaled_usd) + "/yr",
          r.conservative_usd != null
            ? h("div.tiny.muted", { title: "the band study " + (r.net_of || []).join("/") + " already claims at least this much through its own channel" },
              r.conservative_usd > 0 ? "conservative " + fmt.usd(r.conservative_usd)
                : "already inside the " + r.net_of.join("/") + " band claim")
            : null),
        h("td.tiny.muted", null, r.insight_id + " portfolio pricing"),
        ...(showNet ? [h("td.num.tiny", { style: "color:var(--benchmark)" }, bmetric[r.action_id] == null ? "–" : fmt.num(bmetric[r.action_id]))] : [])));
    main.append(h("div.card.mt",
      h("h3", { style: "margin-top:0" }, "Validated experiments not yet policy, scaled to the book"),
      h("div.hint.explain.tiny.mt", null, "These levers were validated by randomized pilots, but no rule of yours fires on them portfolio-wide yet, so the policy band above never priced them. ",
        h("b", null, xs.method),
        " In other words: a projection, not more ledger."),
      tx,
      h("div.mt", null,
        h("b", { style: "color:var(--accent2)" }, "Scaled pilot total: " + fmt.usd(xs.total_scaled_usd) + "/yr"),
        xs.total_conservative_usd !== xs.total_scaled_usd
          ? h("span.tiny.muted", null, " · conservative view (overlap subtracted): " + fmt.usd(xs.total_conservative_usd) + "/yr")
          : null,
        h("span.tiny.muted", null, " · additive to the policy band; the conservative view above subtracts study overlap")),
      h("div.tiny.muted.mt", null, "Kept out, loudly: ",
        ...(xs.excluded || []).flatMap((el, idx) => [idx ? " · " : "", h("b", null, el.id + " "), el.why]))));
  }
  if (b.excluded.length) {
    const te = h("table");
    te.append(h("tr", null, ...["Excluded study", "Why nothing is projected"].map((x) => h("th", null, x))));
    for (const [p, why] of b.excluded)
      te.append(h("tr.clk", { onclick: () => (location.hash = "#/policy/" + p.id) },
        h("td", h("b", null, p.id), " ", h("span.tiny", null, p.name), " ", chip(p.status.replace(/_/g, " "), p.status === "manipulated" ? "manipulated" : p.status === "underpowered" ? "underpowered" : "")),
        h("td.tiny.muted", null, why)));
    main.append(h("div.card.mt", h("div.tiny.muted", { style: "margin-bottom:6px" },
      "These stay out of the headline even though a number could be squeezed from them. An honest total is the sum of what survives scrutiny."), te));
  }
  const ec = RDI.economics;
  main.append(h("div.hint.mt",
    h("div", null, h("b", null, "assumptions "), `· panel covers ${ec.years} years · ${fmt.num(ec.lease_ups_per_home_yr)} lease-ups per home-year · NOI margin ${Math.round(ec.noi_margin * 100)}% of asking rent (avg ask ${fmt.usd(avgAskRent())}/mo; portfolio NOI ${ec.portfolio?.noi_yr ? fmt.usdM(ec.portfolio.noi_yr) + "/yr" : "n/a"}) · days recovered at lost-rent value · effects assumed to transfer from the cutoff to every home the rule fires on`),
    h("div.mt", null, h("b", null, "one page, one count "), `· the map's identified value (${fmt.usdM(RDI.meta.identified_usd)}) prices insight-level theses; this page prices certified studies only. The scaled-pilot section promotes ${xs?.rows?.length ? xs.rows.length : 0} map theses (${xs?.rows?.map((r) => r.insight_id).join(", ") || "none"}) because pilots validated them: the same dollars shown where they were found, now where they are projected. Do not add this page to the map, the totals overlap by design.`)));
}

/* ============================================================
   #/ledger
   ============================================================ */
function viewLedger(main) {
  main.append(h("h1", null, "Experiment ledger"),
    h("p.sub", null, "Every study this portfolio is running, live pilots and naturally occurring ones, in one table. Including the studies the platform refused to certify; that list is on purpose."));
  const t1 = h("table");
  t1.append(h("tr", null, ...["Experiment", "Design", "Status", "n / n", "SRM", "Guardrails", "Owner", "Export ref"].map((x, i) => h("th" + (i === 3 ? ".num" : ""), null, x))));
  const allExp = RDI.experiments.concat(state.registered.map((r) => ({
    id: r.id, name: "registered from design lab · " + r.insight, status: "registered", design_type: "home A/B",
    unit: r.unit, enrolled: 0, owner: r.owner, srm: "pending", guardrails: [], export_ref: r.ref, readout_id: null,
  })));
  for (const e of allExp) {
    t1.append(h("tr.clk", { onclick: () => { if (e.readout_id) location.hash = "#/readout/" + e.id; } },
      h("td", h("b", null, e.id), " ", h("span.tiny.muted", null, e.name)),
      h("td.tiny.mono.muted", null, e.design_type + " · " + e.unit),
      h("td", null, chip(e.status, e.status)),
      h("td.num", null, e.enrolled ? e.enrolled.toLocaleString() : "n/a"),
      h("td", null, e.srm === "failed" ? chip("SRM failed", "breached") : e.srm ? chip("SRM " + e.srm, e.srm === "ok" ? "ok" : "") : chip("n/a")),
      h("td", null, ...(e.guardrails || []).map((g) => chip("guard " + g, g === "breached" ? "breached" : g === "watch" ? "watch" : "ok"))),
      h("td.tiny", null, e.owner),
      h("td.tiny.mono.muted", null, e.export_ref || "n/a")));
  }
  main.append(h("h3", null, "Randomized · " + allExp.length), h("div.card", t1));
  const t2 = h("table");
  t2.append(h("tr", null, ...["Policy", "n (homes)", "McCrary", "Verdict", "Status", "Effect (CI)", "Lens"].map((x, i) => h("th" + (i === 1 || i === 5 ? ".num" : ""), null, x))));
  for (const p of RDI.policies)
    t2.append(h("tr.clk", { onclick: () => (location.hash = "#/policy/" + p.id) },
      h("td", h("b", null, p.id), " ", h("span.tiny.muted", null, p.name)),
      h("td.num", null, p.n_in_bandwidth),
      h("td", null, chip("McCrary " + fmt.p(p.mccrary.p), p.mccrary.p < 0.01 ? "manipulated" : "ok")),
      h("td", null, p.verdict ? chip(p.verdict, p.verdict === "effect" ? "effect" : "") : chip("suppressed", "manipulated")),
      h("td", null, chip(p.status.replace(/_/g, " "), p.status === "manipulated" ? "manipulated" : p.status === "underpowered" ? "underpowered" : "valid")),
      h("td.num", null, p.estimate === null ? "n/a" : fmt.num(p.estimate) + " [" + fmt.num(p.ci[0]) + ", " + fmt.num(p.ci[1]) + "]"),
      h("td.tiny.muted", { title: LENS_GLOSS[p.lens] || "" }, p.lens || "—")));
  main.append(h("h3.mt", null, "Natural experiments (mined cutoffs) · " + RDI.policies.length),
    h("div.card",
      h("div.hint.explain", null, "You are already running these: thresholds your operators keep hitting, mined from your own decision history. ",
        h("b", null, "Status"), " asks whether the both-sides comparison can be trusted (manipulated rows publish no estimate); ",
        h("b", null, "Verdict"), " is what the data says where the design is sound. The ", h("b", null, "Lens"),
        " column marks which value bucket each outcome moves (hover for what it counts); the map's thesis weights multiply these buckets by your opinion."),
      t2));
}

/* ============================================================
   #/readout/<expId>
   ============================================================ */
function viewReadout(id) {
  const main = $("#main");
  const want = (id || "E1").toUpperCase();
  const tabs = h("div.tabs",
    ...RDI.experiments.map((e) => h("a" + (e.id === want ? ".active" : ""), { href: "#/readout/" + e.id }, e.id)));
  main.append(h("h1", null, "Result"), tabs);
  const e = RDI.experiments.find((x) => x.id === want) || RDI.experiments[0];
  const r = RDI.readouts.find((x) => x.id === e.id);
  if (!r) {
    main.append(h("div.callout.warn", null, e.id + " is still in design stage; no readout exists yet. ", e.recommendation || "",
      " Registering the design (design lab) is the path to a readout."));
    return;
  }
  main.append(h("p.sub", null, h("b", null, e.name), " · ", e.design_type, " · ", e.status, " · owner ", e.owner, " · window ", e.started_at, " → ", e.ends_at));
  const p = r.primary, srm = r.srm || {};
  if (srm.status === "failed") {
    const hasAlloc = srm.n_assigned != null && srm.n_assigned_treatment != null;
    const allocT = hasAlloc ? srm.n_assigned_treatment : srm.n_treatment;
    const allocC = hasAlloc ? srm.n_assigned - srm.n_assigned_treatment : srm.n_control;
    main.append(h("div.callout.err", null, "Sample-ratio mismatch: χ² p ", fmt.p(srm.p), ". The groups are not comparable, so no results are shown and this study is excluded from the ledger. ", h("b", null, "This is a product finding, not a bug."),
      r.decision ? h("div.mt", null, "Decision: ", r.decision) : null));
    main.append(h("div.grid.g3.mt",
      kpi("Assigned T", allocT, hasAlloc ? "homes assigned" : "analysis sample"),
      kpi("Assigned C", allocC, "expected share " + srm.expected_share),
      kpi("χ²", srm.chi2, "p " + fmt.p(srm.p))));
    if (hasAlloc)
      main.append(h("div.tiny.muted.mt", null, "χ² runs on the full allocation above, which is where the ratio mismatch lives; the analysis sample is smaller after exclusions (", srm.n_treatment, " T / ", srm.n_control, " C)."));
    return;
  }
  main.append(h("div.grid.g4",
    kpi("Lift", fmt.pct(p.lift_pct), `treatment ${fmt.num(p.treatment)} vs control ${fmt.num(p.control)} · ${p.metric}`),
    kpi("Fixed-horizon p", fmt.p(p.p), "one-shot test"),
    kpi("Sequential p", fmt.p(p.sequential_p), "mSPRT · τ = 0.005σ · smallest α excluded"),
    kpi("CUPED", p.cuped_variance_reduction_pct + "%", "variance reduction · adj lift " + fmt.pct(p.cuped_lift_pct))));
  main.append(h("div.g2.grid.mt",
    h("div.card", h("h3", { style: "margin-top:0" }, "Cumulative effect (looks)"), sparkChart(r)),
    h("div.card", h("h3", { style: "margin-top:0" }, "Guardrails"), guardrailTable(r))));
  const segHead = ["segment", "nT/nC", "lift", "raw p", "FDR q", "after FDR"].map((x, i) =>
    h("th" + (i > 0 && i < 5 ? ".num" : ""), null, x));
  const segRows = (r.segments || []).map((sg) => h("tr", null,
    h("td.tiny", null, sg.label),
    h("td.num", null, sg.n_t + "/" + sg.n_c),
    h("td.num", null, fmt.pct(sg.lift, 1)),
    h("td.num", null, fmt.p(sg.p)),
    h("td.num", null, fmt.p(sg.q)),
    h("td", null, sg.significant_after_fdr ? chip("sig", "ok") : chip("ns", ""))));
  main.append(h("div.card.mt", h("h3", { style: "margin-top:0" }, "Segments · raw p and BH q (q<0.10)"),
    h("table", h("tr", null, ...segHead), ...segRows)));
  main.append(h("div.callout" + (e.id === "E4" ? ".warn" : ""), { style: "margin-top:14px" }, h("b", null, "Decision: "), r.decision));
}
function guardrailTable(r) {
  return h("table",
    h("tr", null, h("th", null, "metric"), h("th.num", null, "Δ"), h("th.num", null, "95% CI"), h("th", null, "")),
    ...(r.guardrails || []).map((g) => h("tr", null,
      h("td.tiny.mono", null, g.metric),
      h("td.num", null, fmt.num(g.delta)),
      h("td.num.muted", null, g.ci ? `[${fmt.num(g.ci[0])}, ${fmt.num(g.ci[1])}]` : "n/a"),
      h("td", null, chip(g.status, g.status)))));
}
function sparkChart(r) {
  const s = r.series;
  const W = 460, H = 160, pad = 44;
  const lifts = s.map((x) => x.lift);
  const lo = Math.min(...lifts, 0) - 0.5, hi = Math.max(...lifts, 0) + 0.5;
  const X = (ix) => pad + (ix / (s.length - 1)) * (W - 2 * pad);
  const Y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  const svg = S("svg", { viewBox: `0 0 ${W} ${H}` });
  svg.append(S("line", { x1: pad, y1: Y(0), x2: W - pad, y2: Y(0), stroke: "var(--muted)", "stroke-dasharray": "3 3" }));
  svg.append(S("path", { d: s.map((x, ix) => (ix ? "L" : "M") + X(ix) + " " + Y(x.lift)).join(" "), stroke: "var(--accent)", "stroke-width": 2, fill: "none" }));
  s.forEach((x, ix) => {
    svg.append(S("circle", { cx: X(ix), cy: Y(x.lift), r: 3.4, fill: "var(--fg)" }));
    svg.append(S("text", { x: X(ix), y: H - pad + 16, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, "look " + x.look));
    svg.append(S("text", { x: X(ix), y: Y(x.lift) - 8, "text-anchor": "middle", "font-size": 9, fill: "var(--muted)" }, "n=" + x.n));
  });
  return h("div", svg, h("div.legend", h("span.muted", null, "cumulative lift on the primary metric across scheduled looks · fixed-horizon and sequential p side by side above")));
}

/* ============================================================
   #/loop
   ============================================================ */
function viewLoop(main) {
  main.append(h("h1", null, "The evidence loop"),
    h("p.sub", null, "The platform is graded on calibration: what it said would happen versus what did. Rows that proved out become proven dollars; rows that did not stay on the page, especially those."));
  const t = h("table");
  t.append(h("tr", null, ...["Action", "Source", "Predicted", "Realized", "Scope", "Truth", "Finding"].map((x, i) => h("th" + (i > 1 && i < 6 ? ".num" : ""), null, x))));
  for (const r of RDI.ledger) {
    const act = RDI.actions.find((a) => a.id === r.action_id);
    t.append(h("tr", null,
      h("td", h("b", null, r.action_id), " ", h("span.tiny.muted", null, act ? act.name : "")),
      h("td", null, chip(r.source, r.source === "rd" ? "accent" : "")),
      h("td.num", null, fmt.usd(r.predicted_usd)), h("td.num", null, fmt.usd(r.realized_usd)),
      h("td.num.muted", null, r.scope_homes + " homes"),
      h("td.num.muted", null, fmt.num(r.truth, 1)),
      h("td", null, chip(r.finding, r.finding === "validated" ? "ok" : "refuted"))));
  }
  main.append(h("div.card", t));
  main.append(h("div.g2.grid.mt", calibrationChart(), h("div.card",
    h("h3", { style: "margin-top:0" }, "Why calibration, not engagement"),
    h("p.tiny", null, "Every estimate re-enters the priors: realized lift shrinks the next operator's prior (k=4 empirical Bayes), new validated thresholds regenerate cutoffs, and the ranked rail re-sorts. A platform judged on clicks optimizes for drama; judged on calibration slope it optimizes for truth."),
    h("h3", null, "The regenerating flywheel"),
    h("p.tiny", null, "estimate → prior → recommendation → realized outcome → calibration → re-ranked signals. Realized lift from the ledger flows back into the causal feature store; validated thresholds flow back into the cutoff registry."),
    h("h3", null, "Stated limits"),
    h("ul.tiny.muted", null, ...RDI.limits.map((l) => h("li", null, l))))));
}
function calibrationChart() {
  const pts = RDI.calibration.points;
  const W = 460, H = 380, pad = 58;
  const m = Math.max(...pts.map((p) => Math.max(Math.abs(p.predicted), Math.abs(p.realized)))) * 1.15;
  const X = (v) => pad + ((v + m) / (2 * m)) * (W - 2 * pad);
  const Y = (v) => H - pad - ((v + m) / (2 * m)) * (H - 2 * pad);
  const svg = S("svg", { viewBox: `0 0 ${W} ${H}` });
  svg.append(S("line", { x1: X(-m), y1: Y(0), x2: X(m), y2: Y(0), stroke: "var(--border)" }));
  svg.append(S("line", { x1: X(0), y1: Y(-m), x2: X(0), y2: Y(m), stroke: "var(--border)" }));
  svg.append(S("line", { x1: X(-m), y1: Y(-m), x2: X(m), y2: Y(m), stroke: "var(--muted)", "stroke-dasharray": "4 4", opacity: 0.6 }));
  svg.append(S("text", { x: X(m) - 6, y: Y(m) + 12, "text-anchor": "end", "font-size": 10, fill: "var(--muted)" }, "y = x"));
  const slope = RDI.calibration.slope, icept = RDI.calibration.intercept;
  svg.append(S("line", { x1: X(-m), y1: Y(-m * slope + icept), x2: X(m), y2: Y(m * slope + icept), stroke: "var(--accent)", "stroke-width": 2 }));
  for (const p of pts) {
    const refuted = String(p.label).startsWith("A8");
    svg.append(S("circle", { cx: X(p.predicted), cy: Y(p.realized), r: 5, fill: refuted ? "var(--error)" : p.label.endsWith("rd") ? "var(--c1)" : "var(--c2)", "fill-opacity": 0.85, stroke: "var(--surface)" }));
    svg.append(S("text", { x: X(p.predicted) + 8, y: Y(p.realized) + 3, "font-size": 9, fill: "var(--muted)" }, p.label));
  }
  svg.append(S("text", { x: W - 10, y: H - 14, "text-anchor": "end", "font-size": 11, fill: "var(--muted)" }, "predicted (USD/yr)"));
  svg.append(S("text", { x: 12, y: 16, "font-size": 11, fill: "var(--muted)" }, "realized (USD/yr)"));
  return h("div.svgwrap", h("h3", { style: "margin-top:0" }, "Calibration · slope " + RDI.calibration.slope + " (band 0.75–1.25)"), svg,
    h("div.legend", h("span", null, sw("var(--c1)"), "RD rows"), h("span", null, sw("var(--c2)"), "randomized"), h("span", null, sw("var(--error)"), "refuted")));
}

/* ============================================================
   boot
   ============================================================ */
window.addEventListener("hashchange", route);
/* ---------- demo-explanation visibility (eye toggle) ---------- */
const EYE_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function applyExplain(on) {
  document.body.classList.toggle("explain-off", !on);
  const btn = $("#explain-toggle");
  if (!btn) return;
  btn.innerHTML = (on ? EYE_ON : EYE_OFF) + '<span class="lbl">' + (on ? "explainer on" : "investor view") + "</span>";
  btn.classList.toggle("off", !on);
  btn.title = on ? "Click to hide the demo explanations (show the paid investor view)" : "Demo explanations hidden; click to show them";
  try { localStorage.setItem("rdi-explain", on ? "1" : "0"); } catch { /* private mode */ }
}
function initExplain() {
  let on = true;
  try { on = localStorage.getItem("rdi-explain") !== "0"; } catch { /* default on */ }
  applyExplain(on);
  const btn = $("#explain-toggle");
  if (btn) btn.addEventListener("click", () => applyExplain(document.body.classList.contains("explain-off")));
}

async function boot() {
  initExplain();
  route();
  try {
    const r = await fetch("/api/health");
    const j = await r.json();
    state.live = Boolean(j.key);
    state.checked = true;
    const el = $("#health");
    el.className = "health" + (j.key ? "" : " off");
    el.innerHTML = '<span class="dot"></span>' + (j.key ? "steering live · " + j.model : "server up · no key (canned)");
  } catch {
    state.checked = true;
    state.live = false;
    state.offline = true;
    const el = $("#health");
    el.className = "health off";
    el.innerHTML = '<span class="dot"></span>offline · file://, live steering disabled';
  }
  if (!location.hash) location.hash = "#/data";
  route();
}
boot();
})();
