// ThawDay late-arrival guard QA - GPT loop run 605, Oct 22, 2026.
// Asserts: (1) on-time plans are unchanged when now is before thaw start,
// (2) a late arrival (now after thaw start) replaces the fridge row with a
// cold-water row carrying only verified numbers, (3) fresh plans unaffected.
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/calculator.html','utf8');
const m=html.match(/\/\/ ENGINE START([\s\S]*?)\/\/ ENGINE END/);
if(!m){ console.error('FAIL engine markers'); process.exit(1); }
eval(m[1]);
let pass=0, fail=0;
function check(name, ok){ console.log((ok?'PASS':'FAIL')+' '+name); ok?pass++:fail++; }
const dinner=new Date(Date.UTC(2026,10,26,17,0)); // Thu Nov 26, 2026 5:00 PM UTC
// On-time: now Nov 1, 14 lb thaw start is Nov 22 -> normal fridge row
const onTime=buildTimeline(dinner,14,'frozen','no',new Date(Date.UTC(2026,10,1,12,0)));
const ot=onTime.find(r=>r.id==='thaw');
check('on-time thaw row is fridge row', !!ot && !ot.late && ot.label==='Move the turkey to the fridge');
check('on-time thaw start Nov 22 17:00 UTC', ot.when.getTime()===Date.UTC(2026,10,22,17,0));
// No-now call (legacy qa.js shape) still returns fridge row
const legacy=buildTimeline(dinner,14,'frozen','no');
check('no-now call unchanged', legacy.find(r=>r.id==='thaw').late===undefined);
// Late: now Nov 25 9:00 AM UTC, 14 lb frozen -> cold-water row
const late=buildTimeline(dinner,14,'frozen','no',new Date(Date.UTC(2026,10,25,9,0)));
const lt=late.find(r=>r.id==='thaw');
check('late thaw row flagged late', !!lt && lt.late===true);
// 2026-11-02 (outside-review Bug 2): the row used to read "Thaw in
// cold water today" and be stamped with now. It is now labeled
// plainly and anchored to oven-in minus 30 minutes per pound
// (14 lb: oven-in Nov 26 13:17 UTC minus 7 hours = Nov 26 06:17 UTC),
// so the thaw ends exactly when the bird goes in the oven.
check('late row label is the plain cold-water label', lt.label==='Thaw in cold water');
check('late row detail has 7 hours (14 lb x 30 min)', lt.detail.includes('about 7 hours'));
check('late row detail has start-by phrasing', lt.detail.includes('Start cold water by this time'));
check('late row detail has water-change rule', lt.detail.includes('Change the water every 30 minutes'));
check('late row detail has cook-right-after rule', lt.detail.includes('cook it right after it thaws'));
check('late row when is anchored oven-in minus 7h, not now', lt.when.getTime()===Date.UTC(2026,10,26,6,17));
check('late thaw ends exactly at oven-in', lt.when.getTime()+7*3600000===late.find(r=>r.id==='oven').when.getTime());
// Cook-from-frozen lead: dinner Nov 26 17:00 with now Nov 26 12:00
// leaves an anchored start (06:17) already past, so the plan leads
// with the USDA from-frozen chart instead of a cold-water row.
const cfz=buildTimeline(dinner,14,'frozen','no',new Date(Date.UTC(2026,10,26,12,0)));
const cfzThaw=cfz.find(r=>r.id==='thaw');
check('too-late plan leads with cook-from-frozen', !!cfzThaw && cfzThaw.frozen===true && cfzThaw.label==='Cook the turkey from frozen');
check('cook-from-frozen oven-in uses the from-frozen chart (dinner minus 308 + 20 min)',
  cfz.find(r=>r.id==='oven').when.getTime()===Date.UTC(2026,10,26,17,0)-(308+20)*60000);
const cfzBrine=buildTimeline(dinner,14,'frozen','yes',new Date(Date.UTC(2026,10,26,12,0)));
check('cook-from-frozen drops the brine row and says skip the brine',
  !cfzBrine.find(r=>r.id==='brine') && cfzBrine.find(r=>r.id==='thaw').detail.includes('Skip the brine'));
// Loop 1 review X2 (Nov 2, 2026): frozen + brining with a feasible
// cold-water window (now Nov 25 09:00, dinner Nov 26 17:00, 14 lb).
// The thaw ends exactly at oven-in, so no brine can fit after it:
// the brine row is dropped, the thaw row carries the marker, and
// planWarning still returns the brine/thaw verdict.
const x2=buildTimeline(dinner,14,'frozen','yes',new Date(Date.UTC(2026,10,25,9,0)));
check('X2 cold-water brining plan drops the brine row', !x2.find(r=>r.id==='brine'));
check('X2 thaw row carries the brineDropped marker', x2.find(r=>r.id==='thaw').brineDropped===true);
const x2w=planWarning(x2,14,dinner,new Date(Date.UTC(2026,10,25,9,0)));
check('X2 planWarning returns brine/thaw, finish = oven-in',
  !!x2w && x2w.kind==='brine' && x2w.reason==='thaw' && x2w.finish.getTime()===x2.find(r=>r.id==='oven').when.getTime());
check('X2 rows stay chronological without the brine row', x2.every((r,i)=>i===0||x2[i-1].when<=r.when));
const okBrine=buildTimeline(dinner,14,'frozen','yes',new Date(Date.UTC(2026,10,1,12,0)));
check('feasible brining plan keeps the brine row', !!okBrine.find(r=>r.id==='brine'));
check('late timeline still chronological', late.every((r,i)=>i===0||late[i-1].when<=r.when));
// Late 20 lb: 10 hours
const late20=buildTimeline(dinner,20,'frozen','no',new Date(Date.UTC(2026,10,25,9,0)));
check('late 20 lb detail has 10 hours', late20.find(r=>r.id==='thaw').detail.includes('about 10 hours'));
// Fresh bird, late now: no thaw row at all, guard does not fire
const fresh=buildTimeline(dinner,14,'fresh','no',new Date(Date.UTC(2026,10,25,9,0)));
check('fresh has no thaw row', !fresh.find(r=>r.id==='thaw'));
// Copy hygiene on VISIBLE copy only (Item 123 Packet C re-point, Oct 26, 2026):
// script/style blocks and HTML comments are stripped first, then tags. The fleet
// PostHog rollout (Oct 25) put 2 em dashes in JS comments inside <script>, so the
// old raw-HTML checks failed on live bytes while visible copy was 0/0. A dash typed
// into real page text still fails here (counterfactual-proven, Item 123 P3 report).
const visibleLate=html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,' ');
check('no em dashes in visible copy', !(visibleLate.match(/\u2014/g)||[]).length);
check('no en dashes in visible copy', !(visibleLate.match(/\u2013/g)||[]).length);
console.log(`RESULT ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
