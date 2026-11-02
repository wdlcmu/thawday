// ThawDay site property tests — Nov 2, 2026 (outside review,
// Section 8). The MCP engine has its own property suite
// (mcp-server/test-properties.mjs); this file proves the WEBSITE
// surfaces share the math:
//
//   1. The ENGINE span is byte-identical in calculator.html,
//      ask.html, and ask-panel.js (the Ask page and its panel run
//      the calculator's engine, not a copy that can drift).
//   2. Across the review grid (weights 8-24 by 0.5, frozen/fresh,
//      brining on/off, dinner times 06:00-21:00, dates
//      Thanksgiving / Christmas / tomorrow / past, now fixed at
//      Nov 2, 2026 12:34), every plan the site engine builds
//      satisfies the same invariants as the MCP suite: rows
//      chronological; oven + roast + rest = dinner to the minute
//      (from-frozen chart when the plan leads with cook-from-
//      frozen); fridge hours before the brine/oven at least the
//      USDA band minimum; cold-water thaw ends exactly at oven-in
//      and starts after now; brine lasts exactly 24h and never
//      starts before the thaw ends (a late cold-water plan with
//      brining carries the brine/thaw warning instead); a
//      cook-from-frozen plan drops the brine row and says to skip
//      it; past buy stamps carry the buyPast flag; no row is
//      stamped with now; frozen buy copy never names Thanksgiving.
//   3. The site engine's USDA tables (thaw days, roast middles,
//      from-frozen middles) match the MCP engine's at every grid
//      weight. The expected table below was generated from BOTH
//      engines on Nov 2, 2026 (33 weights, zero divergences); if
//      either engine's tables change, this fails loudly and the
//      two get reconciled deliberately, not by drift.
//
// Run with TZ=UTC so the site's calendar-day arithmetic lines up
// with the fixed grid:  TZ=UTC node qa-properties.js
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, extra = "") {
  if (ok) { pass++; }
  else { fail++; if (failures.length < 25) failures.push(name + " " + extra); }
}

function engineOf(file) {
  const html = fs.readFileSync(path.join(__dirname, file), "utf8");
  const m = html.match(/\/\/ ENGINE START([\s\S]*?)\/\/ ENGINE END/);
  if (!m) { console.error("FAIL engine markers in " + file); process.exit(1); }
  return m[1];
}
const calcEngine = engineOf("calculator.html");
check("ENGINE span byte-identical: calculator vs ask.html", calcEngine === engineOf("ask.html"));
check("ENGINE span byte-identical: calculator vs ask-panel.js", calcEngine === engineOf("ask-panel.js"));

eval(calcEngine); // defines buildTimeline, planWarning, thawDays, roastMinutes, frozenRoastMinutes, ...

// lb: [thawDays, roastMid, frozenRoastMid] — identical in both engines.
const TABLE = {
  "8": [3, 173, 263], "8.5": [3, 173, 263], "9": [3, 173, 263], "9.5": [3, 173, 263],
  "10": [3, 173, 263], "10.5": [3, 173, 263], "11": [3, 173, 263], "11.5": [3, 173, 263],
  "12": [3, 173, 263], "12.5": [4, 203, 308], "13": [4, 203, 308], "13.5": [4, 203, 308],
  "14": [4, 203, 308], "14.5": [4, 240, 368], "15": [4, 240, 368], "15.5": [4, 240, 368],
  "16": [4, 240, 368], "16.5": [5, 240, 368], "17": [5, 240, 368], "17.5": [5, 240, 368],
  "18": [5, 240, 368], "18.5": [5, 263, 398], "19": [5, 263, 398], "19.5": [5, 263, 398],
  "20": [5, 263, 398], "20.5": [6, 285, 428], "21": [6, 285, 428], "21.5": [6, 285, 428],
  "22": [6, 285, 428], "22.5": [6, 285, 428], "23": [6, 285, 428], "23.5": [6, 285, 428],
  "24": [6, 285, 428],
};
for (const [lbStr, [td, rm, fm]] of Object.entries(TABLE)) {
  const lb = parseFloat(lbStr);
  check(`table parity ${lb} lb`, thawDays(lb) === td && roastMinutes(lb) === rm && frozenRoastMinutes(lb) === fm,
    `site ${thawDays(lb)}/${roastMinutes(lb)}/${frozenRoastMinutes(lb)} vs expected ${td}/${rm}/${fm}`);
}

const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const NOW = new Date(Date.UTC(2026, 10, 2, 12, 34));
const BAND_LO = (lb) => (lb <= 12 ? 1 : lb <= 16 ? 3 : lb <= 20 ? 4 : 5);
const DATES = [
  ["thanksgiving", Date.UTC(2026, 10, 26)],
  ["christmas", Date.UTC(2026, 11, 25)],
  ["tomorrow", Date.UTC(2026, 10, 3)],
  ["past", Date.UTC(2026, 9, 30)],
];
const TIMES = [[6, 0], [9, 0], [12, 0], [17, 0], [18, 0], [21, 0]];

let plans = 0;
for (const [dateName, dateMs] of DATES) {
  for (const [hh, mm] of TIMES) {
    const dinner = new Date(dateMs + hh * HOUR + mm * MIN);
    for (let lb = 8; lb <= 24; lb += 0.5) {
      for (const state of ["frozen", "fresh"]) {
        for (const brining of ["no", "yes"]) {
          plans++;
          const tag = `${dateName} ${hh}:${String(mm).padStart(2, "0")} ${lb}lb ${state} brine=${brining}`;
          const rows = buildTimeline(dinner, lb, state, brining, NOW);
          const warn = planWarning(rows, lb, dinner, NOW);
          const oven = rows.find((r) => r.id === "oven");
          const thaw = rows.find((r) => r.id === "thaw");
          const brine = rows.find((r) => r.id === "brine");
          const buy = rows.find((r) => r.id === "buy");

          check(`${tag}: rows chronological`, rows.every((r, i) => i === 0 || rows[i - 1].when <= r.when));
          check(`${tag}: no row stamped with now`, rows.every((r) => r.when.getTime() !== NOW.getTime()));

          const frozenLed = Boolean(thaw && thaw.frozen);
          const mid = frozenLed ? frozenRoastMinutes(lb) : roastMinutes(lb);
          check(`${tag}: oven + roast + rest = dinner to the minute`,
            oven.when.getTime() + (mid + 20) * MIN === dinner.getTime());

          if (dinner.getTime() <= NOW.getTime()) check(`${tag}: past dinner warns past`, warn && warn.kind === "past", JSON.stringify(warn));
          if (buy.when.getTime() <= NOW.getTime()) check(`${tag}: past buy stamp carries buyPast`, buy.buyPast === true);
          if (state === "frozen") check(`${tag}: buy copy is holiday-neutral`, !/Thanksgiving/.test(buy.detail), buy.detail);

          if (state === "fresh") {
            check(`${tag}: fresh plan has no thaw row`, !thaw);
          } else if (thaw && !thaw.late && !thaw.frozen) {
            const firstStep = brine ? brine.when : oven.when;
            const fridgeMin = Math.round((firstStep - thaw.when) / MIN);
            check(`${tag}: fridge hours at least the band minimum`, fridgeMin >= BAND_LO(lb) * 1440, `${fridgeMin}`);
            check(`${tag}: fridge hours at most the band top`, fridgeMin <= thawDays(lb) * 1440, `${fridgeMin}`);
          } else if (thaw && thaw.late) {
            check(`${tag}: cold-water thaw ends exactly at oven-in`, thaw.when.getTime() + lb * 30 * MIN === oven.when.getTime());
            check(`${tag}: cold-water start is after now`, thaw.when.getTime() > NOW.getTime());
            check(`${tag}: cold-water detail phrases a start-by`, /Start cold water by this time/.test(thaw.detail), thaw.detail);
          } else if (thaw && thaw.frozen) {
            check(`${tag}: cook-from-frozen row stamped at oven-in`, thaw.when.getTime() === oven.when.getTime());
          }

          if (brining === "yes") {
            if (frozenLed) {
              check(`${tag}: cook-from-frozen drops the brine row`, !brine);
              check(`${tag}: cook-from-frozen thaw row says skip the brine`, /Skip the brine/.test(thaw.detail), thaw.detail);
            } else if (thaw && thaw.late) {
              // Loop 1 review X2 (Nov 2, 2026): the cold-water thaw
              // ends at oven-in, so the brine row is dropped and the
              // plan warns brine/thaw instead of printing the row.
              check(`${tag}: cold-water path drops the infeasible brine row`, !brine);
              check(`${tag}: dropped brine is marked on the thaw row`, thaw.brineDropped === true);
              check(`${tag}: brine after a cold-water thaw warns brine/thaw`,
                warn && warn.kind === "brine" && warn.reason === "thaw", JSON.stringify(warn));
            } else {
              check(`${tag}: brine row present`, Boolean(brine));
              if (brine) {
                check(`${tag}: brine lasts exactly 24h, under the 48h cap`, oven.when - brine.when === 1440 * MIN);
                if (thaw && !thaw.late && !thaw.frozen) {
                  check(`${tag}: brine starts after the full thaw`, brine.when - thaw.when >= BAND_LO(lb) * DAY);
                }
              }
            }
          } else {
            check(`${tag}: no brine row when not brining`, !brine);
          }
        }
      }
    }
  }
}

console.log(`site property grid: ${plans} plans`);
for (const f of failures) console.log("FAIL  " + f);
console.log(`RESULT ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
