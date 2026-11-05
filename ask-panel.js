/* ThawDay ask panel (2026-11-01): the /ask page's engine, verbatim, in a
   second door. The block between ENGINE START and ASK PARSER END below is
   byte-identical to ask.html's except three getElementById arguments,
   which point at this panel's own elements (askp-hint, askp-answer,
   askp-calclink). Proof: ask-panel-2026-11-01/evidence/engine-diff.txt
   and the parity harness (answers byte-identical to /ask). The parser
   runs on this page; nothing typed is sent or saved. Page glue from
   ask.html (URL ?q= init, history.replaceState) is not part of the
   engine and is not copied; panel glue follows the engine block. */
(function(){
"use strict";
// ENGINE START
const CONSTANTS = {
  fridgeThawBands: {source:"USDA FSIS thaw chart, verified 2026-10-22", bands:[[12,3],[16,4],[20,5],[24,6]]},
  roastBandsUnstuffed: {source:"USDA FSIS Lets Talk Turkey 325F chart, verified 2026-10-22", bands:[[12,[165,180]],[14,[180,225]],[18,[225,255]],[20,[255,270]],[24,[270,300]]]},
  coldWaterMinPerLb: {value:30, source:"USDA, verified 2026-10-22"},
  restMinutes: {value:20, source:"kitchen practice, not a USDA number"},
  sidesBeforeMinutes: {value:90, source:"kitchen practice"},
  brineBeforeOvenMinutes: {value:1440, source:"kitchen practice; USDA hard rule: refrigerated at 40F or less, never longer than 2 days, discard brine"},
  roastBandsFromFrozen: {source:"USDA SOS on Turkey Day from-frozen chart (usda.gov), verified 2026-10-30", bands:[[12,[255,270]],[14,[270,345]],[18,[345,390]],[20,[390,405]],[24,[405,450]]]}
};
function thawDays(lb){ for(const [max,d] of CONSTANTS.fridgeThawBands.bands){ if(lb<=max) return d; } return 6; }
function roastMinutes(lb){ for(const [max,[lo,hi]] of CONSTANTS.roastBandsUnstuffed.bands){ if(lb<=max) return Math.round((lo+hi)/2); } return 285; }
function frozenRoastBand(lb){ for(const [max,band] of CONSTANTS.roastBandsFromFrozen.bands){ if(lb<=max) return band; } return [405,450]; }
function frozenRoastMinutes(lb){ const [lo,hi]=frozenRoastBand(lb); return Math.round((lo+hi)/2); }
function buildTimeline(dinner, lb, state, brine, now){
  const rows=[]; const MIN=60000;
  /* 2026-10-29 (ADV-3): day-count steps are calendar days, not 24-hour
     blocks. Subtracting whole days in milliseconds kept the elapsed time
     exact but moved the stamped clock time one hour across a daylight-
     saving change (dinner Mon Nov 2, 2026 5:00 PM stamped a thaw start
     of Thu Oct 29 6:00 PM). setDate arithmetic keeps the dinner's
     wall-clock time. Minute steps below (roast, brine, sides, rest) are
     real durations and stay in milliseconds, exactly as before. */
  const daysBefore=(d,n)=>{ const x=new Date(d.getTime()); x.setDate(x.getDate()-n); return x; };
  /* 2026-10-29 (semantic audit S2): the buy step is kitchen practice,
     not a core step, and its date can already be past while dinner is
     still ahead (frozen buy is 11 days out, fresh 2). That plan still
     works -- the honest move is "buy it now" -- so this is a note on
     the buy row itself (plus a buyPast flag render() reads for the
     share text), NOT a planWarning: the past / late / lead / brine
     warnings and their precedence are untouched. No date moves. */
  const BUY_PAST_NOTE=" That buy date has passed. Buy it now if you can.";
  const buyRow=(when,detail)=>{ const past=!!(now && when.getTime()<=now.getTime()); const r={id:"buy", label:"Buy the turkey", when:when, detail:past?detail+BUY_PAST_NOTE:detail}; if(past) r.buyPast=true; return r; };
  const ovenIn=new Date(dinner.getTime()-(roastMinutes(lb)+CONSTANTS.restMinutes.value)*MIN);
  const brineStart=new Date(ovenIn.getTime()-CONSTANTS.brineBeforeOvenMinutes.value*MIN);
  let cookFromFrozen=false, effOvenIn=ovenIn;
  if(state==="frozen"){ rows.push(buyRow(daysBefore(dinner,11),"Buy by this date (kitchen practice). Frozen birds sell out the weekend before your dinner."));
    /* 2026-11-02 (outside-review Bugs 1 and 2 — the same fix as the
       MCP engine): the fridge move counts back from the first step
       that needs a thawed bird, the brine start when brining and
       dinner otherwise, so a brining bird really gets its full band
       in the fridge before the brine. The late cold-water row is
       anchored to oven-in minus 30 minutes per pound and reads as a
       start-by time; it is never stamped with now. When even that
       start has passed, the plan leads with cook-from-frozen on the
       USDA from-frozen chart. */
    const thawStart = brine==="yes" ? daysBefore(brineStart,thawDays(lb)) : daysBefore(dinner,thawDays(lb));
    if(now && now>thawStart){
      const cwStart=new Date(ovenIn.getTime()-lb*CONSTANTS.coldWaterMinPerLb.value*MIN);
      if(cwStart.getTime()>now.getTime()){ rows.push({id:"thaw", late:true, label:"Thaw in cold water", when:cwStart, detail:"Fridge thaw start has passed. Start cold water by this time: it takes about "+(Math.round((lb*30/60)*10)/10)+" hours (30 minutes per pound), and the bird finishes thawing right as it goes in the oven. Seal it in a leak-proof plastic bag and submerge it in cold tap water. Change the water every 30 minutes, and cook it right after it thaws."}); }
      else { cookFromFrozen=true; }
    }
    else { rows.push({id:"thaw", label:"Move the turkey to the fridge", when:thawStart, detail:"Fridge thaw, per the USDA chart. Keep the fridge at 40 F or below."}); }
  } else { rows.push(buyRow(daysBefore(dinner,2),"Fresh: buy 1 to 2 days before cooking.")); }
  if(cookFromFrozen){ effOvenIn=new Date(dinner.getTime()-(frozenRoastMinutes(lb)+CONSTANTS.restMinutes.value)*MIN);
    rows.push({id:"thaw", frozen:true, label:"Cook the turkey from frozen", when:effOvenIn, detail:"No time left to thaw, and cold water cannot finish before the oven either. Cook it from frozen instead: the bird goes in the oven still frozen, at the oven time in this plan."+(brine==="yes"?" Skip the brine: a bird cooked from frozen cannot be brined first.":"")}); }
  /* 2026-11-02 (Loop 1 review X2, the same fix as the MCP engine):
     on the cold-water path the thaw ends exactly at oven-in, so no
     brine can fit after it. The brine step is DROPPED there (it used
     to print stamped before the thaw row, in the past); the thaw row
     carries a brineDropped marker so planWarning still returns the
     brine/thaw verdict, whose only suggestion is skipping. */
  const thawRowNow=rows.find(r=>r.id==="thaw");
  if(brine==="yes" && !cookFromFrozen && thawRowNow && thawRowNow.late){ thawRowNow.brineDropped=true; }
  else if(brine==="yes" && !cookFromFrozen) rows.push({id:"brine", label:"Start brining", when:brineStart, detail: state==="frozen" ? "Brine in the fridge the whole time, never longer than two days, discard the brine after. The bird finishes thawing by this time on this plan." : "Brine in the fridge the whole time, never longer than two days, discard the brine after."});
  rows.push({id:"oven", label:"Turkey goes in the oven", when:effOvenIn, detail:"325 F. The chart aims, the thermometer decides: 165 F."});
  rows.push({id:"sides", label:"Start the sides", when:new Date(dinner.getTime()-CONSTANTS.sidesBeforeMinutes.value*MIN), detail:"Ninety minutes out."});
  rows.push({id:"rest", label:"Rest and carve", when:new Date(dinner.getTime()-CONSTANTS.restMinutes.value*MIN), detail:"Rest before carving. Done at 165 F in the thickest part."});
  rows.sort((a,b)=>a.when-b.when); return rows;
}
function planWarning(rows,lb,dinner,now){
  // Feasibility only: compares the plan's own computed times against each
  // other. No USDA numbers live here; the only figure used is the same
  // cold-water minutes-per-pound constant the thaw row already quotes.
  if(now && dinner.getTime()<=now.getTime()) return {kind:"past"};
  const thaw=rows.find(r=>r.id==="thaw"), oven=rows.find(r=>r.id==="oven");
  if(thaw && thaw.late && oven){
    const finish=new Date(thaw.when.getTime()+lb*CONSTANTS.coldWaterMinPerLb.value*60000);
    if(finish.getTime()>oven.when.getTime()) return {kind:"late", finish:finish};
  }
  /* 2026-10-29 (adversarial pass): a fresh bird (or any bird whose thaw
     already fits) with dinner too soon for the roast itself got no
     warning at all -- the oven time landed in the past and the plan
     still read as normal on screen, in the copied text, and on the
     card. Same feasibility rule, one step later: if the oven time has
     already passed, the roast cannot finish before this dinner. */
  if(now && oven && oven.when.getTime()<=now.getTime()) return {kind:"lead", oven:oven.when};
  /* 2026-10-29 (ADV-2): a brine step that cannot happen was shown as a
     normal step. The brine is stamped 24 hours before oven-in, so a
     dinner less than a day away puts its start in the past, and on the
     late cold-water path it can be stamped before the thaw it depends
     on even finishes. Brining is optional, so this warns. This
     check runs last, so the stronger past / late / lead verdicts above
     keep winning exactly as before. No USDA numbers live here either:
     the cold-water finish reuses the same finish the late check just
     computed from the plan's own rows. Updated 2026-11-02 (Loop 1
     review X2): buildTimeline now DROPS the brine step on the
     cold-water path, so the would-be brine start is recomputed from
     the oven row when no brine row exists, and the thaw-reason
     warning offers only the out that fits (skip the brine). */
  const brineRow=rows.find(r=>r.id==="brine");
  if(now && (brineRow || (thaw && thaw.brineDropped))){
    if(thaw && thaw.late){
      const cwFinish=new Date(thaw.when.getTime()+lb*CONSTANTS.coldWaterMinPerLb.value*60000);
      const brineWhen=brineRow?brineRow.when:new Date(oven.when.getTime()-CONSTANTS.brineBeforeOvenMinutes.value*60000);
      if(brineWhen.getTime()<cwFinish.getTime()) return {kind:"brine", brine:brineWhen, finish:cwFinish, reason:"thaw"};
    }
    if(brineRow && brineRow.when.getTime()<=now.getTime()) return {kind:"brine", brine:brineRow.when, reason:"past"};
  }
  return null;
}
// ENGINE END
function fmt(d){ return d.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); }
function fmtShort(d){ return d.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric"}).replace(":00",""); }
function fmtDateOnly(d){ return d.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}); }
function durText(min){ const h=Math.floor(min/60), r=min%60; return (h?h+" hour"+(h===1?"":"s"):"")+(h&&r?" ":"")+(r?r+" minutes":""); }
/* ASK PARSER START — deterministic words-to-inputs. Every date and number
   in the answer comes from the engine above; this parser only reads the
   visitor's words into the same four inputs the calculator takes
   (weight, frozen/fresh, brine, dinner date+time). A word it cannot read
   is never guessed silently: the summary line under the answer prints
   every value used, and anything filled in by default is named. */
function thanksgivingDay(year){ var nov1=new Date(year,10,1); var offset=(4-nov1.getDay()+7)%7; return new Date(year,10,1+offset+21); }
function nextThanksgiving(today){ var tg=thanksgivingDay(today.getFullYear()); if(tg<today) tg=thanksgivingDay(today.getFullYear()+1); return tg; }
function parseAsk(raw, nowOverride){
  var now=nowOverride||new Date();
  var today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  var t=" "+String(raw).toLowerCase().replace(/[\u2019]/g,"'")+" ";
  var p={state:"frozen",brine:"no",intent:"plan",dateDefaulted:false,timeDefaulted:false,stateExplicit:false,brineExplicit:false};
  var wm=t.match(/(\d+(?:\.\d+)?)\s*-?\s*(lbs?|pounds?|pounder)\b/);
  if(wm) p.lb=parseFloat(wm[1]);
  if(!p.lb){
    var gm=t.match(/(\d+)\s*(people|guests|persons|person)\b/);
    if(gm){ p.guests=parseInt(gm[1],10); p.leftovers=/leftover/.test(t); p.fromGuests=true;
      p.lb=Math.min(24,Math.max(8,Math.ceil(p.guests*(p.leftovers?1.5:1)))); }
  }
  if(/\bfresh\b/.test(t)){ p.state="fresh"; p.stateExplicit=true; }
  else if(/\bfrozen\b/.test(t)){ p.state="frozen"; p.stateExplicit=true; }
  if(/no brine|without brine|skip (the )?brine/.test(t)){ p.brine="no"; p.brineExplicit=true; }
  else if(/\bbrine\b|\bbrining\b|salt water/.test(t)){ p.brine="yes"; p.brineExplicit=true; }
  if(/from frozen/.test(t)&&/(cook|bake|roast|oven)/.test(t)) p.intent="fromfrozen";
  else if(/(thaw|defrost)/.test(t)&&/(when|how long|how many|start|begin|need)/.test(t)) p.intent="thaw";
  else if(/cold water/.test(t)&&/(how long|how many)/.test(t)) p.intent="thaw";
  else if(/(roast|cook|bake)/.test(t)&&/(how long|when|what time)/.test(t)) p.intent="roast";
  /* 2026-11-01 (Addendum 907-B): unsafe-premise + hold-window detection.
     These questions carry their own published answer on the site's pages;
     the premise is recorded here and answerAsk leads with that answer.
     No numbers live here: the lead sentences are the pages' own words. */
  /* 2026-11-01 (Addendum 924): one ring wider, same gates, same order.
     Premise patterns hear countertop / warm tap water / all night /
     lukewarm; hold counts hear spelled numbers one-twelve. No published
     number lives here; dayNum only reads the visitor's own count. */
  var numWord={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
  var dayNum=function(s){ return /^\d+$/.test(s)?parseInt(s,10):numWord[s]; };
  var holdM=t.match(/(?:fridge|refrigerator) for (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days?/);
  /* 2026-11-01 (Addendum 930): one ring wider again, same gates, same
     order, plus SPEC-3's narrow negation guard. SPEC-1: daybreak words
     (dawn / sunrise), waking words (get up), sleeper forms beyond first
     person (while everyone is asleep, while we are asleep), and "from
     midnight to morning" join the overnight family. SPEC-2: warm|hot
     fires across a small noun window (warm sink full of water, warm
     soaking bath); heated, hyphenated warm-ish, and "feels warm" join
     the warm family. SPEC-3: the premise gates read pt, not t: a clause
     whose premise word sits inside a negation's scope (not / never /
     no / n't / refuse; Addendum 950: scope runs to the end of its own
     clause-part, not a 6-token ruler, and a fresh clause opened by
     and/but ends it) is dropped, but only when a method (safe or
     offered) is still named in what remains; an unsafe alternative
     offered in its own clause keeps firing.
     Assurance fix (Addendum 1002, 2026-11-01): when the kept text
     carries no premise pattern at all, pt adopts it even without a
     method word — a bare negated unsafe statement ("I did NOT leave
     it on the counter") no longer draws the safety lead.
     Every other read still uses t; the hold read drops its own
     duration claims when they sit inside the same kind of negated
     span (Addendum 932), and the clause split now hears dashes. */
  var pt=t;
  { var rawSplit=t.split(/([.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+)/), clauses=[], seps=[], kept=[], dropped=false, dropIdx={};
    for(var ri=0;ri<rawSplit.length;ri++){ if(ri%2===0) clauses.push(rawSplit[ri]); else seps.push(rawSplit[ri]); }
    var negRe=/\b(?:not|never|no)\b|\b\w+n't\b|\brefus\w*\b/;
    var methRe=/^(?:warm|hot|tepid|lukewarm|heated|cold|counter\w*|fridge|refrigerator|water|bath|soak|tub|overnight)$/;
    var scopeRe=/\s+(?:and|but)\s+(?=(?:i|it|the|my|we|they|this|that)\b|(?:thawed|defrosted|sat|stayed|left|kept|been|was|were|has|have|had|is|are|finished|spent|want|wants)\b)|\s+so\s+(?=(?:i|it|the|my|we|they)\b)/;
    var methHit=function(txt){ var toks=txt.trim().split(/\s+/);
      for(var ai=0;ai<toks.length;ai++){ var parts=toks[ai].split("-");
        for(var pi=0;pi<parts.length;pi++){ if(methRe.test(parts[pi].replace(/^[^a-z]+|[^a-z]+$/g,""))) return true; } } return false; };
    for(var ci=0;ci<clauses.length;ci++){ var cl=clauses[ci], isNeg=false;
      if(dropIdx[ci]){ dropped=true; continue; }
      var nm=cl.match(negRe);
      if(nm){ var scope=cl.slice(nm.index+nm[0].length), scp=scope.search(scopeRe); if(scp>=0) scope=scope.slice(0,scp);
        if(methHit(scope)) isNeg=true;
        else if(scp<0){ /* Addendum 952: a parenthetical comma-part does not
             end a negation's scope ("I would not, even if you paid me,
             ever leave a bird sitting in cold water all night long"): the
             scope carries across comma-only boundaries until a method
             word, a fresh clause opening the next part, a scope cut
             inside the next part, or a hard boundary ends it. The whole
             governed span drops together. */
          var cj=ci;
          while(cj<clauses.length-1&&/^,+$/.test((seps[cj]||"").trim())){ var nx=clauses[cj+1];
            if(/^\s*(?:and|but|so)\b/.test(nx)) break;
            var nscp=nx.search(scopeRe), nscope=nscp>=0?nx.slice(0,nscp):nx;
            if(methHit(nscope)){ for(var dk=ci;dk<=cj+1;dk++) dropIdx[dk]=true; isNeg=true; break; }
            if(nscp>=0) break;
            cj++; } } }
      if(isNeg) dropped=true; else kept.push(cl); }
    if(dropped){ var cand=kept.join(" "); if(/cold water|fridge|refrigerator|counter\w*|room temperature|lukewarm|tepid|warm|hot/.test(cand)||(/water/.test(cand)&&/every 30 minutes/.test(cand))||!(/\bcounter\w*|room temperature|lukewarm\b|tepid\b|warm-?ish\b|\bheated\b|(?:feels?|felt) (?:warm|hot)\b|\b(?:warm|hot)(?: \w+){0,3}? (?:water|sink|basin|bath|soak|tub)\b|cold water/.test(cand))) pt=cand; }
  }
  if(/\bcounter\w*|room temperature/.test(pt)) p.premise="counter";
  else if(/lukewarm\b|tepid\b|warm-?ish\b|\bheated\b|(?:feels?|felt) (?:warm|hot)\b|\b(?:warm|hot)(?: \w+){0,3}? (?:water|sink|basin|bath|soak|tub)\b/.test(pt)) p.premise="warmwater";
  else if(/cold water/.test(pt)&&/(overnight|all night|(?:through|for|over) the (?:whole )?night|through tonight|through (?:the )?(?:dawn|sunrise|daybreak)|(?:till|until|til) (?:the |tomorrow )?morning|(?:till|until|til) (?:i|we) wake|(?:till|until|til) (?:(?:i|we) (?:get|wake) up|(?:everyone|everybody) (?:gets|wakes) up)|(?:till|until|til) (?:the )?(?:dawn|sunrise|daybreak|first light|sunup|daylight|break of (?:the )?day|first crack of (?:light|dawn)|day breaks|crack of (?:the )?dawn|sun (?:comes up|rises|is up|comes back up|peeks up))|midnight (?:to|till|until) (?:the )?(?:morning|dawn|sunrise|daybreak)|while (?:[a-z]+ ){0,3}(?:asleep|sleeping|sleeps|sleep)\b|while (?:i|we) (?:sleep|am asleep|am sleeping)|while i'?m (?:sleeping|asleep))/.test(pt)) p.premise="coldovernight";
  /* SPEC-COLDQA1103-3 (2026-11-03): the still-frozen scenario. The two
     rescue paths are weight-free facts the site already publishes (the
     still-frozen page leads with them), so a bird named still frozen
     with no weight yet gets them first, as a premise, and the weight
     ask follows — the same verdict-first shape as the safety premises
     above. With a weight the premise never sets: the plan already
     carries both paths, exactly as before. A negated still-frozen
     ("not still frozen") never sets it. No number lives here: the
     lead sentences in answerAsk are the site's own published words. */
  /* SPEC-COLDQA1103-3B (2026-11-03): one ring wider, same guards. The
     panic statement wears plainer words than "still": frozen solid,
     completely / totally / entirely / fully frozen, partly / half
     frozen on its own, and frozen this (or on Thanksgiving) morning
     are the same no-weight statement, so they take the same premise
     and the same verbatim lead above. The pattern still names a
     frozen STATE, never a bare frozen bird: "how long to thaw a
     frozen turkey" and "my turkey is frozen" stay exactly as before,
     and with a weight the premise never sets. The negation guard is
     the shipped one widened to the new shapes: a state phrase counts
     only when no not / never / n't / no longer / no more sits within
     the three words before it, so a purely negated mention never
     fires, and the hold read below still wins for a bird that
     thawed yesterday. */
  var fsRe3B=/\b(?:still (?:(?:partly|half)[ -])?frozen|frozen[ -]solid|solid frozen|(?:completely|totally|entirely|fully|partly|partially|half)[ -]frozen|frozen (?:this morning|(?:on |this )?thanksgiving(?: morning)?))/g, fsM3B=null, fsHit3B;
  while((fsHit3B=fsRe3B.exec(t))!==null){ if(!/(?:\bnot\b|\bnever\b|n't|\bno longer\b|\bno more\b)(?:\s+\w+){0,3}\s*$/.test(t.slice(0,fsHit3B.index))){ fsM3B=fsHit3B; break; } }
  if(!p.premise && !p.lb && fsM3B) p.premise="stillfrozen";
  /* 2026-11-01 (Addendum 919): the hold read only "been in the fridge
     for N days". It now reads the shapes people actually use ("thawed
     3 days ago", "since Monday", "finished thawing on Wednesday",
     "in the refrigerator for 2 days", "thawed yesterday") and counts
     forward to the day the cook plans to cook, so a past-window bird
     gets its warning even when the cook day is still ahead. Only
     calendar arithmetic lives here; the food-safety number is still
     the published 1-to-2-day rule in answerAsk. */
  /* Addendum 1031: the finish terms of thawedWord are negation-
     scoped. The Addendum 952 clauses heard through a negation —
     "Defrosting was not finished yesterday" verdicted as thawed
     from yesterday, and with a later cook day escalated to a false
     "Do not cook it" — because they were tested on the raw text
     while the negAt guard covered only the day-claim scans.
     negFinAt mirrors negAt exactly (same clause split, same
     last-negation read, same fresh-clause break), and finishHit
     accepts a finish match only when it does not sit inside a
     negation's scope in its own clause. A second, unnegated finish
     match in the same text still counts, a negation in another
     clause or after the match moves nothing, and the non-finish
     reads (thawed / defrosted / did thaw / out of the freezer)
     are untouched — the finish family is scoped, not blunted. */
  /* Addendum 1046: the sentence-initial BARE correction whose
     asserted day trails inside the finish clause — "Not yesterday
     it finished thawing three days ago". With no comma, the
     fronted "not" shares one clause part with the finish verb and
     the trailing claim, so negFinAt read the finish as negated
     and negAt read the asserted claim as negated: the verdict
     never landed (a missing verdict, never a false one). The two
     helpers below recognize the construction under a tight key:
     the clause part opens with "not <day claim>", the clause
     carries exactly two day claims in total, and between the
     negated day and the target only subject / auxiliary tokens
     (plus, for the day read, one finish phrase) appear. The
     no-asserted-day control (zero trailing claims), plain
     negated finishes (no fronted opener), the cleft (no day
     before its "not"), and the mirror orders whose days both sit
     before the finish verb (zero trailing claims) all fall
     outside the key by construction. */
  var dayPat1046="(?:the\\s+)?(?:(?:day before yesterday\\b|yesterday\\b|(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+days?\\s+ago\\b))";
  var countDay1046=function(str){ var n=0; str=str.replace(/day before yesterday\b/g,function(){ n++; return " "; }); str=str.replace(/\byesterday\b/g,function(){ n++; return " "; }); var m1046=str.match(/(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?\s+ago\b/g); if(m1046) n+=m1046.length; return n; };
  var clauseOf1046=function(i){ var s=0,e=t.length,bm,bre=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/g; while((bm=bre.exec(t))!==null){ if(bm.index+bm[0].length<=i) s=bm.index+bm[0].length; else if(bm.index>=i){ e=bm.index; break; } } return {s:s,e:e,txt:t.slice(s,e)}; };
  /* Addendum 1051: the 1046 token key widened by class — sentence
     adverbs (finally/just/already/now/actually/recently/eventually),
     possessive determiners (my/our), and pronoun subjects (they/we)
     are now admitted between the fronted negated day and the finish
     target in both helpers. The exactly-two-claims key and the
     opener requirement are unchanged. */
  /* Addendum 1056: pronoun subjects (i/you/he/she) and possessive
     determiners (your/his/her/its/their) COMPLETE their closed classes,
     and the auxiliary set gains am. Sentence adverbs are an open class:
     they are admitted only as ONE bounded wildcard token in the adverb
     position (not first, alphabetic, never a structural DENY word; in
     the day read it must precede the finish word). The exactly-two-
     claims key and the opener requirement are unchanged. */
  var frontedFin1046=function(i){ var cl=clauseOf1046(i); if(countDay1046(cl.txt)!==2) return false; if(countDay1046(t.slice(i,cl.e))!==1) return false; var pre=t.slice(cl.s,i), mm=pre.match(new RegExp("^\\s*not\\s+"+dayPat1046+"\\s+")); if(!mm) return false; var rest=pre.slice(mm[0].length).trim(); if(!rest) return true; var toks=rest.split(/\s+/); if(toks.length>6) return false; var ok={it:1,the:1,turkey:1,bird:1,was:1,were:1,been:1,has:1,have:1,had:1,is:1,are:1,i:1,you:1,he:1,she:1,your:1,his:1,her:1,its:1,their:1,am:1,my:1,our:1,they:1,we:1,finally:1,just:1,already:1,now:1,actually:1,recently:1,eventually:1}, deny={until:1,till:1,til:1,and:1,but:1,or:1,nor:1,so:1,not:1,never:1,no:1,that:1,if:1,when:1,while:1,since:1,before:1,after:1,then:1,there:1,here:1,yesterday:1,today:1,tomorrow:1,ago:1,day:1,days:1,one:1,two:1,three:1,four:1,five:1,six:1,seven:1,eight:1,nine:1,ten:1,eleven:1,twelve:1,in:1,on:1,at:1,for:1,with:1,from:1,by:1,of:1,to:1,into:1,thawing:1,defrosting:1,defrost:1,thawed:1,defrosted:1,finished:1,finishing:1,finishes:1,finish:1,completed:1,completing:1,completes:1,complete:1,done:1,sat:1,stayed:1,left:1,kept:1,spent:1,me:1,him:1,us:1,them:1,mine:1,yours:1,ours:1,theirs:1,fridge:1,freezer:1,counter:1,what:1,how:1,why:1,who:1}, wild=-1; for(var ti=0;ti<toks.length;ti++){ var tk=toks[ti]; if(ok[tk]) continue; if(wild>=0||ti===0||deny[tk]||!/^[a-z]+$/.test(tk)||tk.length<2||tk.length>20) return false; wild=ti; } return true; };
  /* C13 adjudication (2026-11-02): the 1056 wildcard may also sit AFTER
     the completed finish phrase ("finished thawing really three days
     ago") — the after-phrase slot the 1056 lane pinned as C13. Before
     this fix the asserted day read as negated there and the negated
     day governed: a false 2 INSIDE for a 4-PAST bird. The wildcard
     still may not sit between the finish word and its thaw word. */
  var frontedDay1046=function(i){ var cl=clauseOf1046(i); if(countDay1046(cl.txt)!==2) return false; var pre=t.slice(cl.s,i); if(countDay1046(pre)!==1) return false; var mm=pre.match(new RegExp("^\\s*not\\s+"+dayPat1046+"\\s+")); if(!mm) return false; var rest=pre.slice(mm[0].length).trim(), toks=rest?rest.split(/\s+/):[], ok={it:1,the:1,turkey:1,bird:1,was:1,were:1,been:1,has:1,have:1,had:1,is:1,are:1,i:1,you:1,he:1,she:1,your:1,his:1,her:1,its:1,their:1,am:1,my:1,our:1,they:1,we:1,finally:1,just:1,already:1,now:1,actually:1,recently:1,eventually:1,thawing:1,defrosting:1,defrost:1,finished:1,finishing:1,finishes:1,finish:1,completed:1,completing:1,completes:1,complete:1,done:1}, deny={until:1,till:1,til:1,and:1,but:1,or:1,nor:1,so:1,not:1,never:1,no:1,that:1,if:1,when:1,while:1,since:1,before:1,after:1,then:1,there:1,here:1,yesterday:1,today:1,tomorrow:1,ago:1,day:1,days:1,one:1,two:1,three:1,four:1,five:1,six:1,seven:1,eight:1,nine:1,ten:1,eleven:1,twelve:1,in:1,on:1,at:1,for:1,with:1,from:1,by:1,of:1,to:1,into:1,thawing:1,defrosting:1,defrost:1,thawed:1,defrosted:1,finished:1,finishing:1,finishes:1,finish:1,completed:1,completing:1,completes:1,complete:1,done:1,sat:1,stayed:1,left:1,kept:1,spent:1,me:1,him:1,us:1,them:1,mine:1,yours:1,ours:1,theirs:1,fridge:1,freezer:1,counter:1,what:1,how:1,why:1,who:1}, hasFin=false, hasThaw=false, wild=-1, finIdx=-1, thawFin=-1; if(toks.length>9) return false; for(var ti=0;ti<toks.length;ti++){ var tk=toks[ti]; if(/^(?:finished|finishing|finishes|finish|completed|completing|completes|complete|done)$/.test(tk)){ hasFin=true; if(finIdx<0) finIdx=ti; } if(tk==="thawing"||tk==="defrosting"||tk==="defrost"){ hasThaw=true; if(finIdx>=0&&ti>finIdx&&thawFin<0) thawFin=ti; } if(ok[tk]) continue; if(wild>=0||ti===0||deny[tk]||!/^[a-z]+$/.test(tk)||tk.length<2||tk.length>20) return false; wild=ti; } if(wild>=0&&(finIdx<0||(wild>finIdx&&(thawFin<0||wild<thawFin)))) return false; return hasFin&&hasThaw; };
  /* Addendum 1066 SPEC-C13-R1: frontedDay1046 above rejects the
     asserted day when a token AFTER the completed finish phrase
     fails its bounded wildcard test (a second unknown adverb, a
     DENY word, an over-length / 1-char / alphanumeric token). The
     governance fallback then let the NEGATED day govern — a false
     2 INSIDE, the C13 defect one ring out. This read mirrors
     frontedDay1046's own key and sets for an asserted ago claim
     and reports exactly that rejection: the fronted key holds,
     frontedFin1046 accepted the finish verb, the until idiom does
     not apply, and the walk's ONLY admission failure sits strictly
     after the thaw word that completes the finish phrase. The
     holdCue suppression below then asks back instead of letting
     the negated day govern. Bare asserted claims are out of scope
     by design (their mirrors land correctly via the bare fallback
     today), and SPEC-C13-R2's between-slot stays outside: a token
     failing at or before the thaw word never fires this read. */
  var frontedReject1066=function(i){ var cl=clauseOf1046(i); if(countDay1046(cl.txt)!==2) return false; var pre=t.slice(cl.s,i); if(countDay1046(pre)!==1) return false; if(/(?:until|till|til)\s+(?:the\s+)?$/.test(pre)) return false; var mm=pre.match(new RegExp("^\\s*not\\s+"+dayPat1046+"\\s+")); if(!mm) return false; var restStr=pre.slice(mm[0].length), rest=restStr.trim(), toks=rest?rest.split(/\s+/):[], ok={it:1,the:1,turkey:1,bird:1,was:1,were:1,been:1,has:1,have:1,had:1,is:1,are:1,i:1,you:1,he:1,she:1,your:1,his:1,her:1,its:1,their:1,am:1,my:1,our:1,they:1,we:1,finally:1,just:1,already:1,now:1,actually:1,recently:1,eventually:1,thawing:1,defrosting:1,defrost:1,finished:1,finishing:1,finishes:1,finish:1,completed:1,completing:1,completes:1,complete:1,done:1}, deny={until:1,till:1,til:1,and:1,but:1,or:1,nor:1,so:1,not:1,never:1,no:1,that:1,if:1,when:1,while:1,since:1,before:1,after:1,then:1,there:1,here:1,yesterday:1,today:1,tomorrow:1,ago:1,day:1,days:1,one:1,two:1,three:1,four:1,five:1,six:1,seven:1,eight:1,nine:1,ten:1,eleven:1,twelve:1,in:1,on:1,at:1,for:1,with:1,from:1,by:1,of:1,to:1,into:1,thawing:1,defrosting:1,defrost:1,thawed:1,defrosted:1,finished:1,finishing:1,finishes:1,finish:1,completed:1,completing:1,completes:1,complete:1,done:1,sat:1,stayed:1,left:1,kept:1,spent:1,me:1,him:1,us:1,them:1,mine:1,yours:1,ours:1,theirs:1,fridge:1,freezer:1,counter:1,what:1,how:1,why:1,who:1}, hasFin=false, hasThaw=false, wild=-1, finIdx=-1, thawFin=-1, failAfter=false; if(toks.length>9||!toks.length) return false; for(var ti=0;ti<toks.length;ti++){ var tk=toks[ti]; if(/^(?:finished|finishing|finishes|finish|completed|completing|completes|complete|done)$/.test(tk)){ hasFin=true; if(finIdx<0) finIdx=ti; } if(tk==="thawing"||tk==="defrosting"||tk==="defrost"){ hasThaw=true; if(finIdx>=0&&ti>finIdx&&thawFin<0) thawFin=ti; } if(ok[tk]) continue; if(wild>=0||ti===0||deny[tk]||!/^[a-z]+$/.test(tk)||tk.length<2||tk.length>20){ if(thawFin>=0&&ti>thawFin){ failAfter=true; continue; } return false; } wild=ti; } if(!hasFin||!hasThaw||!failAfter) return false; var fm=restStr.match(/\b(?:finished|finishing|finishes|finish|completed|completing|completes|complete|done)\b/); if(!fm) return false; return frontedFin1046(cl.s+mm[0].length+fm.index); };
  var negFinAt=function(i){ var s=0,bm,bre=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/g;
    while((bm=bre.exec(t))!==null){ if(bm.index>=i) break; s=bm.index+bm[0].length; }
    var seg=t.slice(s,i), nm=null, nx, nre=/\b(?:not|never|no)\b|\b\w+n't\b/g;
    while((nx=nre.exec(seg))!==null) nm=nx; if(!nm) return false;
    var mid=seg.slice(nm.index+nm[0].length);
    /* Addendum 1042 SPEC-2: a BARE correction that has completed
       before the match spends the negation's scope for the finish
       verb too, in the two shapes the "but" break cannot see:
       (a) mid is exactly two day claims — "not yesterday three
       days ago it finished thawing" (fronted pre-correction);
       (b) mid is exactly one day claim, optionally opening a new
       subject, and the clause text BEFORE the negation carries
       its own day claim — "Three days ago not yesterday it
       finished thawing" (fronted correction; day governance
       already walks back to that fronted day). A plain negated
       finish matches neither (empty mid; the day follows the
       verb), and a cleft with no day before its "not" ("It was
       not three days ago that it finished thawing") fails (b)'s
       fronted-day gate and keeps its ask-back. */
    var day1042="(?:the\\s+)?(?:(?:day before yesterday\\b|yesterday\\b|(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+days?\\s+ago\\b))", bareCorr1042=new RegExp("^\\s*"+day1042+"\\s+"+day1042+"(?:\\s+(?:i|it|the|my|we|they|this|that|thawing|defrosting)\\b|\\s*$)").test(mid)||(new RegExp("(?:day before yesterday\\b|yesterday\\b|(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+days?\\s+ago\\b)").test(seg.slice(0,nm.index))&&new RegExp("^\\s*"+day1042+"(?:\\s+(?:i|it|the|my|we|they|this|that|thawing|defrosting)\\b|\\s*$)").test(mid));
    /* Addendum 1039 SPEC-3: a correction that has COMPLETED before
       the match — "not yesterday but three days ago that it
       finished thawing" — spends the negation's scope: the "but
       <day claim>" inside mid asserted the true day, and the
       finish verb in the trailing clause is asserted, not negated.
       The negation read here is the LAST one before the match, so
       a finish verb under its own later "not" never sees an
       earlier correction in its mid. */
    return !(/\s+(?:and|but)\s+(?=(?:i|it|the|my|we|they|this|that)\b|(?:thawed|defrosted|sat|stayed|left|kept|been|was|were|has|have|had|is|are|finished|spent|want|wants)\b)|\s+so\s+(?=(?:i|it|the|my|we|they)\b)/.test(mid)||/\s+(?:and|but)\s+$/.test(mid)||/\s+but\s+(?:the\s+)?(?:day before yesterday\b|yesterday\b|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?\s+ago\b)/.test(mid)||bareCorr1042||frontedFin1046(i)); };
  var finishHit=function(re){ re.lastIndex=0; var m; while((m=re.exec(t))!==null){ if(!negFinAt(m.index)) return true;
      /* "not ... until <past day>" is the idiom for completion AT
         that day ("It did not finish thawing until yesterday" =
         it finished yesterday), so a negated match whose own clause
         continues "until yesterday / the day before yesterday /
         N days ago" still counts. */
      var rest=t.slice(m.index+m[0].length), be=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/.exec(rest), tail=be?rest.slice(0,be.index):rest;
      if(/^\s*(?:\w+\s+){0,4}?(?:until|till|til)\s+(?:the\s+)?(?:day before yesterday|yesterday)\b/.test(tail)||/^\s*(?:\w+\s+){0,4}?(?:until|till|til)\s+(?:the\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?\s+ago\b/.test(tail)) return true; } return false; };
  /* Addendum 1035 SPEC-3: the passive negated finish ("Thawing was
     not finished until yesterday") matches no finishHit pattern —
     the negation sits between "was" and the finish word, and the
     finish word is not followed by "thawing" — so untilHit1035
     hears it on its own terms: the match counts ONLY when its own
     clause continues "until / till / til <past day>", the same
     tail test as finishHit's idiom exception. A plain negated
     passive with no until tail ("Thawing was not finished
     yesterday") never fires it and keeps its ask-back. */
  var untilHit1035=function(re){ re.lastIndex=0; var m; while((m=re.exec(t))!==null){
      var rest=t.slice(m.index+m[0].length), be=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/.exec(rest), tail=be?rest.slice(0,be.index):rest;
      if(/^\s*(?:\w+\s+){0,4}?(?:until|till|til)\s+(?:the\s+)?(?:day before yesterday|yesterday)\b/.test(tail)||/^\s*(?:\w+\s+){0,4}?(?:until|till|til)\s+(?:the\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?\s+ago\b/.test(tail)) return true; } return false; };
  var thawedWord=/\bthawed\b|\bdefrosted\b|\bdid thaw\b/.test(t)||/out of the freezer/.test(t)||finishHit(/finished thawing/g)
    /* Addendum 952: "finish thawing" in its other forms (finish /
       finishing / finishes thawing) and a bare "finished yesterday"
       are completion evidence too — the finish forms only when the
       text also carries a past-day word the count can use, so a
       plain "how long does it take to finish thawing" question
       keeps its plan. The emphatic past "did thaw" joins the main
       read (a past statement by shape; "did not thaw" does not
       match it). */
    ||(finishHit(/(?:\bfinish\w*|\bdone|\bcomplete|\bcompleted) thawing\b/g)&&/(yesterday|days? ago|day before yesterday)/.test(t))
    /* Addendum 956: "done thawing" / "completed thawing" are
       completion evidence behind the same past-day gate, so a
       timing question ("how long until it is done thawing")
       still keeps its plan. */
    ||finishHit(/\bfinish\w* yesterday\b/g)
    /* Addendum 960 SPEC-4: the defrosting finish synonyms join the
       thawing ones behind the same past-day gate ("finished
       defrosting yesterday", "done defrosting three days ago"), so
       a defrosting timing question still keeps its plan while a
       finished defrosting with a past day verdicts like "It
       defrosted yesterday" already did. */
    ||(finishHit(/(?:\bfinish\w*|\bdone|\bcomplete|\bcompleted) defrosting\b/g)&&/(yesterday|days? ago|day before yesterday)/.test(t))
    /* Addendum 1027: the passive gerund-subject family joins the
       finish forms behind the same past-day gate ("Thawing was
       complete three days ago", "The defrosting was done
       yesterday", "The defrost was complete yesterday"). The
       subject is the thawing itself and the completion word follows
       "was", so none of the active forms above ever heard it and
       the verdict never landed — a bird past the window got a
       weight ask-back instead of its warning. The gate is SPEC-4's
       own (a yesterday / N-days-ago / day-before-yesterday claim
       must be present), so a passive shape with no past-day
       evidence changes nothing, and a timing question ("How long
       until defrosting is complete?", which uses "is", not "was")
       keeps its plan. */
    ||(finishHit(/(?:\bthawing|\bdefrosting|\bdefrost) was (?:complete|completed|done|finished)\b/g)&&/(yesterday|days? ago|day before yesterday)/.test(t))
    /* Addendum 1039 SPEC-2: the gerund-subject ACTIVE finish joins
       behind the same past-day gate ("Thawing finished three days
       ago", "Defrosting finished the day before yesterday",
       "Thawing completed three days ago", "The thawing finished
       three days ago") — the finish verb follows the gerund subject
       directly, with no "was", so neither the active forms above
       (verb before "thawing") nor the 1027 passive (verb after
       "was") ever heard it, and only the bare "finished yesterday"
       shape landed. finishHit's negation scope still applies. */
    ||(finishHit(/(?:\bthawing|\bdefrosting) (?:finish\w*|done|complete|completed)\b/g)&&/(yesterday|days? ago|day before yesterday)/.test(t))
    /* Addendum 1035 SPEC-3: the passive "not ... until" idiom joins
       behind untilHit1035's own tail test ("Thawing was not
       finished until yesterday", "Defrosting was not complete
       until the day before yesterday") — no separate past-day gate,
       because the until tail already names the past day. */
    ||untilHit1035(/(?:\bthawing|\bdefrosting|\bdefrost) (?:was (?:not|never)|wasn'?t) (?:complete|completed|done|finished)\b/g);
  var beenThawedM=t.match(/been thawed for (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days?/);
  var wdNames=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  var sinceM=t.match(/\bsince (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  var thawOnM=t.match(/(?:finished thawing(?: \w+)?|thawed|defrosted) on (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  var agoM=t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days? ago/);
  /* 2026-11-01 (Addendum 932): the SPEC-3 negation span now reaches
     the hold read's own duration claims. A "fridge for N days",
     "been thawed for N days", or "N days ago" match that sits
     inside a negation's scope in its own clause ("did not sit in
     the fridge for 3 days", "hasn't been in the fridge for three
     days") is dropped, so the true thawed-when evidence ("thawed
     yesterday") decides instead. A negation elsewhere in the
     sentence ("thawed three days ago and I did not get to cook
     it") leaves the claim standing - the warning is kept.
     Addendum 950: both reads now use scope, not the 6-token ruler -
     a fresh clause opened by and/but ends a negation's reach, and
     with no fresh clause between, the negation governs however
     many words sit between. Spelled counts run one-twelve, and a
     self-correction ("No wait, ...") withdraws earlier claims. */
  var negAt=function(i){ var s=0,bm,bre=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/g;
    while((bm=bre.exec(t))!==null){ if(bm.index>=i) break; s=bm.index+bm[0].length; }
    var seg=t.slice(s,i), nm=null, nx, nre=/\b(?:not|never|no)\b|\b\w+n't\b/g;
    while((nx=nre.exec(seg))!==null) nm=nx; if(!nm) return false;
    var mid=seg.slice(nm.index+nm[0].length);
    /* Addendum 1035 SPEC-1: a day claim that immediately follows
       "but" in its clause is the asserted side of a "not <day> but
       <day>" correction ("finished thawing not yesterday but three
       days ago") — the fresh clause opens WITH the day claim
       itself, the same trailing-break shape negFinAt carries for
       the finish word — so the negation does not govern it. The
       negated day on the other side of the "but" keeps its drop:
       its own read still ends in the negation, not in a "but". */
    /* Addendum 1042 SPEC-1: a bare PRE-correction — "not yesterday
       three days ago", negation first, no "but", no comma — spends
       the negation's scope on its own day: when the whole mid is
       exactly one day claim (plus an optional trailing "the" that
       opens an asserted "the day before yesterday"), the target
       claim that follows is the correction's ASSERTED side, not
       part of the negation's scope. Without this break the
       asserted claim read as negated, the post-governance drop
       nulled it, and the raw-text fallback counted the negated
       day — a past-window bird read "still inside". The negated
       day's own read (empty mid) and every mid carrying more
       than the one day claim are unchanged. */
    return !(/\s+(?:and|but)\s+(?=(?:i|it|the|my|we|they|this|that)\b|(?:thawed|defrosted|sat|stayed|left|kept|been|was|were|has|have|had|is|are|finished|spent|want|wants)\b)|\s+so\s+(?=(?:i|it|the|my|we|they)\b)/.test(mid)||/\s+but\s+(?:the\s+)?$/.test(mid)||/^\s*(?:the\s+)?(?:day before yesterday\b|yesterday\b|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?\s+ago\b)(?:\s+the)?\s*$/.test(mid)||frontedDay1046(i)); };
  /* Addendum 950: a self-correction withdraws the claims made before
     it ("It sat in the fridge for 3 days. No wait, it thawed
     yesterday..."); the corrected evidence after the marker decides.
     Addendum 952: the markers become the correction-act family
     (actually no / sorry, I meant / scratch that / correction / my
     mistake join no wait / wait, no / I mean(t)), the corrected
     evidence may be a bare day word ("No wait, yesterday."), and a
     withdrawn claim is replaced by re-scanning the text AFTER the
     marker in the same read's own shape — so a correction that
     restates a claim ("Actually no, it did thaw three days ago")
     still counts it, and a claim the cook never corrected is
     never withdrawn. */
  var corrM=t.match(/\b(?:no wait|wait,? no|actually,? no|scratch that|correction|my mistake|i meant?)\b/);
  if(corrM){ var post=t.slice(corrM.index);
    if(/(?:thawed|defrosted|finish\w* thawing|yesterday|day before yesterday|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days? ago|(?:fridge|refrigerator) for (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days?|been thawed for (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days?)/.test(post)){
      var reScan=function(re){ var m2=post.match(re); return m2?{0:m2[0],1:m2[1],index:corrM.index+m2.index}:null; };
      if(holdM&&holdM.index<corrM.index) holdM=reScan(/(?:fridge|refrigerator) for (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days?/);
      if(beenThawedM&&beenThawedM.index<corrM.index) beenThawedM=reScan(/been thawed for (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days?/);
      if(agoM&&agoM.index<corrM.index) agoM=reScan(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days? ago/);
      if(sinceM&&sinceM.index<corrM.index) sinceM=reScan(/\bsince (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
      if(thawOnM&&thawOnM.index<corrM.index) thawOnM=reScan(/(?:finished thawing(?: \w+)?|thawed|defrosted) on (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/); } }
  /* Addendum 956: the correction act, structurally. The marker list
     above only hears corrections spoken with a listed marker; cooks
     also correct themselves by simply restating ("It thawed five
     days ago. It thawed yesterday."), with an unlisted interjection
     ("Oops,", "My bad,", "Hold on,"), or twice in a row. So collect
     EVERY day-evidence claim about the thaw in text order — the
     five shaped reads plus a bare yesterday / day before yesterday
     standing in a thaw clause or standing alone — and when the
     claims DISAGREE, the LAST one governs: a restatement is how a
     correction is spoken, with or without a marker. When the claims
     agree (an elaboration of the same count) nothing moves, and a
     single claim moves nothing either. Three kinds of claim never
     compete: one inside a conditional clause ("if it had thawed
     five days ago") is a hypothesis, not a statement; an "ago"
     claim in a buy-event clause ("I bought the turkey five days
     ago") is about a different event; a "since <weekday>" whose
     clause names no thawing ("in the freezer since Friday") is
     about storage, not the thaw. The negation guard below still
     applies to whichever claim governs, so a correction INTO a
     worse count keeps the worse verdict. */
  { var claims=[], govLate956=false, govBare1035=null;
    var clOf956=function(i){ var s=0,e=t.length,bm,bre=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/g;
      while((bm=bre.exec(t))!==null){ if(bm.index+bm[0].length<=i) s=bm.index+bm[0].length; else if(bm.index>=i){ e=bm.index; break; } }
      return {txt:t.slice(s,e),pre:t.slice(s,i)}; };
    var addClaim956=function(shape,idx,txt,cap,days){ var cl=clOf956(idx);
      if(/\b(?:if|suppose|imagine)\b/.test(cl.pre)) return;
      if((shape==="ago"||shape==="hold"||shape==="been")&&/\b(?:bought|purchased|picked(?: \w+)? up)\b/.test(cl.pre)&&!/thaw|defrost/.test(cl.txt)) return;
      if(shape==="since"&&!/thaw|defrost/.test(cl.txt)) return;
      claims.push({shape:shape,index:idx,text:txt,cap:cap,days:days}); };
    var scanC956=function(re,fn){ re.lastIndex=0; var m; while((m=re.exec(t))!==null) fn(m); };
    scanC956(new RegExp("(?:fridge|refrigerator) for (\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days?","g"),function(m){ addClaim956("hold",m.index,m[0],m[1],dayNum(m[1])); });
    scanC956(new RegExp("been thawed for (\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days?","g"),function(m){ addClaim956("been",m.index,m[0],m[1],dayNum(m[1])); });
    scanC956(new RegExp("(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days? ago","g"),function(m){ addClaim956("ago",m.index,m[0],m[1],dayNum(m[1])); });
    scanC956(new RegExp("\\bsince (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b","g"),function(m){ addClaim956("since",m.index,m[0],m[1],(today.getDay()-wdNames.indexOf(m[1])+7)%7); });
    scanC956(new RegExp("(?:finished thawing(?: \\w+)?|thawed|defrosted) on (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b","g"),function(m){ addClaim956("on",m.index,m[0],m[1],(today.getDay()-wdNames.indexOf(m[1])+7)%7); });
    var bareStop956={i:1,me:1,it:1,that:1,the:1,a:1,an:1,is:1,was:1,when:1,meant:1,mean:1,say:1,said:1,correction:1,no:1,wait:1,actually:1,sorry:1,oops:1,my:1,bad:1,hold:1,on:1,hang:1,well:1,oh:1,and:1,but:1,so:1};
    var addBare956=function(idx,txt,days){ for(var si=0;si<claims.length;si++){ if(idx>=claims[si].index&&idx<claims[si].index+claims[si].text.length) return; }
      var cl=clOf956(idx);
      if(/\b(?:if|suppose|imagine)\b/.test(cl.pre)) return;
      if(/thaw|defrost|out of the freezer/.test(cl.txt)){ claims.push({shape:"bare",index:idx,text:txt,cap:null,days:days}); return; }
      var rest=cl.txt.replace(/day before yesterday|yesterday/g," ").replace(/[^a-z' ]/g," ").split(/\s+/), ok=true;
      for(var wi=0;wi<rest.length;wi++){ if(rest[wi]&&!bareStop956[rest[wi].replace(/^'+|'+$/g,"")]){ ok=false; break; } }
      if(ok) claims.push({shape:"bare",index:idx,text:txt,cap:null,days:days}); };
    scanC956(/\bday before yesterday\b/g,function(m){ addBare956(m.index,m[0],2); });
    scanC956(/\byesterday\b/g,function(m){ addBare956(m.index,m[0],1); });
    claims.sort(function(a,b){ return a.index-b.index; });
    if(claims.length>=2){ var disagree956=false;
      for(var di=1;di<claims.length;di++) if(claims[di].days!==claims[0].days) disagree956=true;
      if(disagree956){ var gov956=claims[claims.length-1];
        /* Addendum 1039 SPEC-1: the governing claim may be the
           NEGATED side of a bare afterthought correction with no
           separator ("finished thawing three days ago not
           yesterday") — the comma / dash forms split the negated
           day into its own clause part, where the bare-claim scan
           rejects it, but the bare form's clause carries the thaw
           word, so the negated day is collected and, as the last
           claim, governs. A day claim (ago / bare) inside a
           negation's scope in its own clause (negAt; the until
           idiom's ago claim exempt, as in the 1035 SPEC-2 fix)
           cannot govern: walk back to the last day claim that is
           not negated. If none exists, governance is unchanged. */
        var negDay1039=function(c){ if(c.shape!=="ago"&&c.shape!=="bare") return false;
          if(c.shape==="ago"&&/(?:until|till|til)\s+(?:the\s+)?$/.test(clOf956(c.index).pre)) return false;
          return negAt(c.index); };
        if(negDay1039(gov956)){ for(var gi1039=claims.length-2;gi1039>=0;gi1039--){ if(!negDay1039(claims[gi1039])){ gov956=claims[gi1039]; break; } } }
        if(gov956.shape==="since"||gov956.shape==="on") govLate956=true;
        if(gov956.shape==="bare") govBare1035=gov956.days;
        holdM=gov956.shape==="hold"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null;
        beenThawedM=gov956.shape==="been"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null;
        agoM=gov956.shape==="ago"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null;
        sinceM=gov956.shape==="since"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null;
        thawOnM=gov956.shape==="on"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null; } } }
  /* Addendum 960 SPEC-1: the buy-event exclusion reaches the base
     ago read. The 956 claim list already drops an "ago" claim in a
     buy-event clause ("I bought the turkey five days ago" is about
     the shopping trip, not the thaw), but the base agoM above is a
     plain first-match read, so with a single thaw claim beside it
     (no disagreement for the claim rule to resolve) the buy count
     still decided the verdict — a bird thawed yesterday was
     condemned on its buy date. When the standing agoM sits in a
     buy-event clause, replace it with the first ago claim that is
     not in one, or with no claim at all. A claim the 956 rule let
     govern already passed this same test, so this moves nothing
     there. */
  if(agoM){ var isBuy960=function(idx){ var s=0,e=t.length,bm,bre=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/g;
      while((bm=bre.exec(t))!==null){ if(bm.index+bm[0].length<=idx) s=bm.index+bm[0].length; else if(bm.index>=idx){ e=bm.index; break; } }
      return /\b(?:bought|purchased|picked(?: \w+)? up)\b/.test(t.slice(s,idx))&&!/thaw|defrost/.test(t.slice(s,e)); };
    if(isBuy960(agoM.index)){ var agoRe960=/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days? ago/g, am960, nxt960=null;
      while((am960=agoRe960.exec(t))!==null){ if(!isBuy960(am960.index)){ nxt960={0:am960[0],1:am960[1],index:am960.index}; break; } }
      agoM=nxt960; } }
  if(holdM&&negAt(holdM.index)) holdM=null;
  if(beenThawedM&&negAt(beenThawedM.index)) beenThawedM=null;
  /* Addendum 1035 SPEC-2: an "N days ago" claim that directly
     follows until/till/til in its own clause is the "not ...
     until" idiom's asserted completion day ("did not finish
     thawing until three days ago" = it finished three days ago) —
     the same assertion finishHit's idiom exception honors for
     thawedWord — so the negAt drop, which reads the "not" of
     "did not", must not take it; without it the verdict rendered
     its preamble with no count at all. */
  var untilDay1035=function(i){ var s=0,bm,bre=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/g;
    while((bm=bre.exec(t))!==null){ if(bm.index>=i) break; s=bm.index+bm[0].length; }
    return /(?:until|till|til)\s+(?:the\s+)?$/.test(t.slice(s,i)); };
  if(agoM&&negAt(agoM.index)&&!untilDay1035(agoM.index)) agoM=null;
  /* Addendum 960 SPEC-2: the standalone continuous shape ("It has
     been thawing since Monday") joins the hold read on its own
     terms (the last holdCue term below). It carries no "thawed"
     word for thawedWord and no "sitting" for the sitting term, so
     it never verdicted — a weight ask-back with no weight, a
     warning-free plan with one. The since read itself already
     counted these days correctly whenever another claim made the
     question a hold question. */
  var holdCue=holdM||beenThawedM||/how long can a thawed/.test(t)
    ||(thawedWord&&/(fridge|refrigerator)/.test(t)&&/(still ok|still good|still safe|how long|ok to|safe to)/.test(t))
    ||(thawedWord&&(sinceM||thawOnM||agoM||/day before yesterday/.test(t)||/\byesterday\b/.test(t)||/\bsitting\b/.test(t)||/(still ok|still good|still safe|ok to cook|is it ok|good for)/.test(t)))
    ||(/\bsitting\b/.test(t)&&sinceM)
    ||(/\bbeen thawing\b/.test(t)&&sinceM);
  /* Addendum 960 SPEC-3: a timing question built on the fully /
     completely-thawed adjectives ("How long until a 14 lb turkey
     is completely thawed in the fridge?") asks for the thaw
     duration, not a finished thaw — but the word "thawed" plus
     "how long" plus "fridge" fired the hold read, which answered
     with the hold rule alone and no plan. When the question
     carries no past-day evidence at all (no ago / since /
     on-weekday / hold / been claim and no yesterday word), it is
     the K07 timing shape in adjective dress: let it keep its
     plan. The same adjectives WITH past evidence ("It was
     completely thawed yesterday") still verdict exactly as
     before. */
  if(holdCue&&/how long until\b/.test(t)&&/(?:completely|fully) thawed\b/.test(t)&&!agoM&&!sinceM&&!thawOnM&&!holdM&&!beenThawedM&&!/yesterday|day before yesterday/.test(t)) holdCue=false;
  /* Addendum 1066 SPEC-C13-R1: a fronted correction whose asserted
     ago claim frontedDay1046 rejected over an after-phrase token
     (frontedReject1066) gets no verdict — the negated day must never
     govern, so the question asks back on the ordinary path. */
  if(holdCue){ var dayRe1066=/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) days? ago/g, dm1066; while((dm1066=dayRe1066.exec(t))!==null){ if(frontedReject1066(dm1066.index)){ holdCue=false; break; } } }
  if(holdCue){ p.premise="hold";
    var elapsed=null;
    if(holdM) elapsed=dayNum(holdM[1]);
    else if(beenThawedM) elapsed=dayNum(beenThawedM[1]);
    else if(agoM) elapsed=dayNum(agoM[1]);
    /* Addendum 1035 SPEC-1: when the governing claim is a bare day,
       its own count decides — the raw-text fallbacks below scan in
       fixed day-before-yesterday-before-yesterday order and can
       land on the NEGATED phrase of a reversed correction ("not
       the day before yesterday but yesterday"). */
    else if(govBare1035!=null) elapsed=govBare1035;
    else if(!govLate956&&/day before yesterday/.test(t)) elapsed=2;
    else if(!govLate956&&/\byesterday\b/.test(t)) elapsed=1;
    else if(sinceM) elapsed=(today.getDay()-wdNames.indexOf(sinceM[1])+7)%7;
    else if(thawOnM) elapsed=(today.getDay()-wdNames.indexOf(thawOnM[1])+7)%7;
    if(elapsed!=null){ var cookOff=0;
      if(/day after tomorrow/.test(t)) cookOff=2;
      else if(/\btomorrow\b/.test(t)) cookOff=1;
      else { var cookM=t.match(/(?:cook|good for|eat|serve)[^.]{0,24}?\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/); if(cookM) cookOff=(wdNames.indexOf(cookM[1])-today.getDay()+7)%7; }
      p.holdDays=elapsed+cookOff; if(cookOff>0) p.holdFuture=true;
    }
  }
  p.coldWater=/cold water/.test(t);
  /* 2026-11-01 (Addendum 907-A): weekday scan. A weekday inside a
     current-day clause ("it's Tuesday", "it is Wednesday", "today is
     Tuesday") names TODAY, never the dinner day. The dinner weekday is
     the remaining token bound to the dinner ("for Thursday", "by
     Thursday", "Thursday dinner", "dinner is Thursday"); when both
     appear, the dinner-bound one wins. */
  var wdayRe=/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g, wdayHit, wdayHits=[];
  while((wdayHit=wdayRe.exec(t))!==null){ wdayHits.push({name:wdayHit[1],idx:wdayHit.index}); }
  var dinnerWday=null, dinnerScore=-1;
  /* SPEC-TD-EVE-03 (2026-11-04): a weekday may only fill the dinner
     slot from a dinner clause, never from a state clause. The old
     proximity score let "still frozen solid on Tuesday" (state, +2
     for "on") beat "make a Thursday 6pm dinner" (no proximity cue),
     so the plan was built for the frozen day. Now: segment the text
     into clauses; a weekday whose clause prefix names the bird's
     state (frozen / bought / in the freezer / since) and whose clause
     carries no dinner word is excluded outright; a weekday inside a
     clause that carries a dinner word (dinner / eat / serve / meal /
     a holiday) outranks any bare proximity cue; a negated weekday
     ("not Thursday") never fills the slot. Weekdays in neither kind
     of clause keep the old proximity scoring, so plain shapes like
     "turkey for Thursday" parse exactly as before. */
  var segOfEve=function(i){ var s=0,e=t.length,bm,bre=/[.,;:!?()]+|\s+[-\u2013\u2014]\s*|[-\u2013\u2014]\s+|[\u2013\u2014]+/g;
    while((bm=bre.exec(t))!==null){ if(bm.index+bm[0].length<=i) s=bm.index+bm[0].length; else if(bm.index>=i){ e=bm.index; break; } }
    return {txt:t.slice(s,e),pre:t.slice(s,i)}; };
  for(var wi=0;wi<wdayHits.length;wi++){ var wh=wdayHits[wi];
    var before=t.slice(Math.max(0,wh.idx-24),wh.idx), after=t.slice(wh.idx+wh.name.length,wh.idx+wh.name.length+10);
    if(/(it'?s|it is|today is|today'?s)\s+$/.test(before)) continue;
    if(/\bnot\s+$/.test(before)) continue;
    var segEve=segOfEve(wh.idx);
    var segDinnerEve=/\b(dinner|supper|eat|eats|eating|ate|serve|serves|serving|served|meal|thanksgiving|christmas)\b/.test(segEve.txt);
    var segStateEve=/(frozen|rock[ -]hard|solid|bought|purchased|picked up|freezer|still hard|hasn'?t thawed|not thawed)/.test(segEve.pre)
      ||/(?:^|\s)since\s+$/.test(segEve.pre);
    if(segStateEve&&!segDinnerEve) continue;
    var score=0;
    if(segDinnerEve) score+=3;
    if(/\b(for|by|on)\s+$/.test(before)) score+=2;
    if(/^\s+(dinner|night)\b/.test(after)) score+=2;
    if(/dinner( is| on)?\s*$/.test(before)) score+=2;
    if(score>dinnerScore){ dinnerScore=score; dinnerWday=wh; }
  }
  var date=null;
  if(/thanksgiving/.test(t)){ date=nextThanksgiving(today); p.dateLabel="Thanksgiving"; }
  else if(/christmas/.test(t)){ date=new Date(today.getFullYear(),11,25); if(date<today) date=new Date(today.getFullYear()+1,11,25); p.dateLabel="Christmas Day"; }
  else if(/tomorrow/.test(t)){ date=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1); }
  else if(/today|tonight/.test(t)&&!dinnerWday){ date=new Date(today.getFullYear(),today.getMonth(),today.getDate()); }
  if(!date){
    var months={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
    var mm=t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\b/);
    if(mm){ date=new Date(today.getFullYear(),months[mm[1]],parseInt(mm[2],10)); if(date<today) date=new Date(today.getFullYear()+1,months[mm[1]],parseInt(mm[2],10)); }
    else { var md=t.match(/\b(\d{1,2})\/(\d{1,2})\b/); if(md){ date=new Date(today.getFullYear(),parseInt(md[1],10)-1,parseInt(md[2],10)); if(date<today) date=new Date(today.getFullYear()+1,parseInt(md[1],10)-1,parseInt(md[2],10)); } }
  }
  if(!date){
    var wdays={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
    /* Addendum 907-A: only the dinner-bound weekday token reaches here;
       current-day mentions were filtered out in the scan above. */
    var dm=dinnerWday?{1:dinnerWday.name}:null;
    if(dm){ var target=wdays[dm[1]]; var tg=nextThanksgiving(today);
      /* Seasonal rule, in the site's own register: this is a Thanksgiving
         tool (the homepage counts down to it, the quiz pre-fills it). In
         the 40 days before Thanksgiving, "Thursday" means Thanksgiving
         Day. Outside that run-up, a named weekday is its next one. The
         summary always prints the full date used, so this is checkable. */
      if(target===4 && tg.getTime()>=today.getTime() && (tg.getTime()-today.getTime())<=40*86400000){ date=tg; p.dateLabel="Thanksgiving"; }
      else { date=new Date(today.getFullYear(),today.getMonth(),today.getDate()); do{ date.setDate(date.getDate()+1); }while(date.getDay()!==target); }
    }
  }
  if(!date){ date=nextThanksgiving(today); p.dateLabel="Thanksgiving"; p.dateDefaulted=true; }
  var hh=17, mi=0, mer=null, tm=t.match(/(\d{1,2})(?::(\d{2}))?\s*(pm|am)\b/)||t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if(tm){ hh=parseInt(tm[1],10); mi=tm[2]?parseInt(tm[2],10):0; mer=tm[3]||null;
    if(mer==="pm"&&hh<12) hh+=12; else if(mer==="am"&&hh===12) hh=0; else if(!mer&&hh>=1&&hh<=11) hh+=12;
    p.timeDefaulted=false;
  } else p.timeDefaulted=true;
  date.setHours(hh,mi,0,0);
  p.dinner=date; return p;
}
function warnHtmlFor(warning){
  if(!warning) return "";
  /* Same verdict words as the calculator's render(), from the same
     warning object planWarning() returns. */
  return `<div class="row warnrow"><strong>${warning.kind==="past"?"That dinner time is already past.":"This plan cannot work as entered."}</strong><br>${warning.kind==="past"?"Pick a date and time ahead of you, and the plan will line up.":warning.kind==="lead"?`The turkey would have had to go in the oven at ${fmt(warning.oven)}. There is not enough time to roast it before this dinner. What can work instead: a smaller bird, or a later dinner.`:warning.kind==="brine"?(warning.reason==="thaw"?`Brining was set to start at ${fmt(warning.brine)}, but the turkey does not finish thawing until ${fmt(warning.finish)}. A brine cannot start before the bird is thawed. What can work instead: skip the brine.`:`Brining was set to start at ${fmt(warning.brine)}. That time has already passed, so a full brine cannot fit before this dinner. What can work instead: skip the brine, or use a shorter brine that starts now.`):`Cold water from now finishes thawing at ${fmt(warning.finish)}. The turkey needs to be in the oven before then. What can work instead: a smaller bird, a fresh bird, or a later dinner.`}</div>`;
}
function answerAsk(raw, nowOverride){
  var now=nowOverride||new Date();
  var hint=document.getElementById("askp-hint"), out=document.getElementById("askp-answer");
  var p=parseAsk(raw, now);
  /* Addendum 907-B: premise leads, in the site's own published words.
     A hold-window question is answered by the 1-to-2-day rule alone:
     the bird it describes is already thawed, so no frozen plan is
     built for it, and the rule does not need a weight. */
  var premiseHtml="";
  if(p.premise==="counter") premiseHtml=`<div class="row"><strong>No. Never thaw a turkey on the counter.</strong><br>The outside warms up hours before the inside thaws. Bacteria grow in that warm layer. Use the fridge, at 40 F or below, or cold water. The safe plan is below.</div>`;
  else if(p.premise==="warmwater") premiseHtml=`<div class="row"><strong>No. Warm water speeds up the wrong thing.</strong><br>The surface of the bird warms into the danger zone long before the center thaws. Cold water, changed every 30 minutes, is the fast safe method. The safe plan is below.</div>`;
  else if(p.premise==="coldovernight") premiseHtml=`<div class="row"><strong>No. Cold water only works while you are awake to change it.</strong><br>Change the water every 30 minutes. Cook it right after it thaws. An overnight soak breaks both rules at once. The safe plan is below.</div>`;
  else if(p.premise==="stillfrozen") premiseHtml=`<div class="row"><strong>Dinner can still happen.</strong><br>Two safe paths. Cold water: seal the bird in a leak-proof plastic bag and submerge it in cold tap water, at 30 minutes per pound. Change the water every 30 minutes, and cook it right after it thaws. Or cook it from frozen: USDA says cooking a turkey from frozen is safe, and it takes at least 50 percent longer than a thawed bird. Never thaw on the counter. The safe plan is below.</div>`;
  if(p.premise==="hold"){
    hint.textContent="";
    var holdVerdict = p.holdDays==null ? "" : (p.holdDays>2 ? (p.holdFuture ? ` By the day you cook it, yours will have been thawed for ${p.holdDays} days. That is past the window. Do not cook it.` : ` Yours has been in the fridge for ${p.holdDays} days. That is past the window. Do not cook it.`) : (p.holdFuture ? ` By the day you cook it, yours will have been thawed for ${p.holdDays} day${p.holdDays===1?"":"s"}. That is still inside the window.` : ` At ${p.holdDays} day${p.holdDays===1?"":"s"}, it is still inside that window. Cook it today.`));
    out.innerHTML=`<div class="row"><strong>Cook a thawed turkey within 1 to 2 days. That is the USDA rule.</strong><br>The clock starts when the turkey is fully thawed.${holdVerdict}</div>`;
    document.getElementById("askp-calclink").innerHTML="";
    return {rows:[],warning:null,parsed:p};
  }
  /* Addendum 919: an unsafe premise gets its No even when no weight
     was given; the weight ask follows the No instead of replacing it. */
  if(premiseHtml&&!p.lb){ hint.textContent="";
    out.innerHTML=premiseHtml.replace(" The safe plan is below.","")+"<div class=\"row\"><strong>One thing I still need: the turkey.</strong><br>Say its weight, like \"a 14-pound turkey\". Or say how many people are eating, like \"turkey for 10 people\". Then I can build the safe plan.</div>";
    document.getElementById("askp-calclink").innerHTML="";
    return {rows:[],warning:null,parsed:p};
  }
  if(!p.lb){ hint.textContent="";
    out.innerHTML=`<div class="row"><strong>One thing I still need: the turkey.</strong><br>Say its weight, like "a 14-pound turkey". Or say how many people are eating, like "turkey for 10 people". The examples above show the shape.</div>`;
    return null;
  }
  if(!(p.lb>=8&&p.lb<=24)){ hint.textContent="This tool covers 8 to 24 lb birds, the range in the USDA charts it uses. It cannot give a timeline outside that range."; out.innerHTML=""; return null; }
  hint.textContent="";
  var dinner=p.dinner, lb=p.lb, state=p.state, brine=p.brine;
  var rows=buildTimeline(dinner,lb,state,brine,now);
  var warning=planWarning(rows,lb,dinner,now);
  var thaw=rows.find(r=>r.id==="thaw"), oven=rows.find(r=>r.id==="oven");
  var summary=`Your plan: ${lb} lb ${state} turkey, dinner ${fmt(dinner)}${p.dateLabel?" ("+p.dateLabel+")":""}.`;
  if(p.fromGuests) summary+=` For ${p.guests} people${p.leftovers?", with leftovers":""}, that is a ${lb} lb bird.`;
  if(p.dateDefaulted||p.timeDefaulted) summary+=` Dinner is set to ${fmt(dinner)}. Say a different day or time in your words to change it.`;
  if(!p.stateExplicit||!p.brineExplicit) summary+=` ${state==="frozen"?"Frozen":"Fresh"}, ${brine==="yes"?"with a brine":"no brine"}. Say "fresh" or "brine it" in your words to change that.`;
  var lead="";
  /* SPEC-TD-EVE-03 (2026-11-04), second half: when cold water is the
     method the visitor asked for, its plan leads — with the exact
     start clock (oven time minus 30 minutes per pound, the same
     start the late-thaw row already prints) — before any fridge
     plan. Before, only the literal words "cold water time" earned
     that lead on a plan turn, so an asked-for rescue method arrived
     as a duration-only "backup" paragraph with no start time. */
  var cwStartEve = (oven&&state==="frozen") ? new Date(oven.when.getTime()-lb*30*60000) : null;
  if(p.intent==="thaw"&&thaw){ lead=thaw.frozen?`There is no time left to thaw this bird. Cook it from frozen: it goes in the oven at ${fmt(oven.when)}. The full plan is below.`:thaw.late?`Fridge thaw has already passed for this dinner. Use cold water: start by ${fmt(thaw.when)}, about ${Math.round((lb*30/60)*10)/10} hours, and it finishes thawing right as the bird goes in the oven. The full plan is below.`:p.coldWater?`In cold water, a ${lb} lb turkey thaws in about ${Math.round((lb*30/60)*10)/10} hours (30 minutes per pound). Start by ${fmt(cwStartEve)} so it finishes thawing as it goes in the oven. Seal it in a leak-proof plastic bag, submerge it in cold tap water, change the water every 30 minutes, and cook it right after it thaws. The fridge plan is below.`:`A ${lb} lb turkey takes ${thawDays(lb)} days to thaw in the fridge. Start thawing ${fmt(thaw.when)}. Move the turkey to the fridge then. The full plan is below.`; }
  else if(p.intent==="plan"&&p.coldWater&&thaw&&!thaw.frozen&&cwStartEve){ lead=`Cold water, as you asked: start by ${fmt(cwStartEve)}, about ${Math.round((lb*30/60)*10)/10} hours (30 minutes per pound), and it finishes thawing as the bird goes in the oven. Seal the bird in a leak-proof plastic bag and submerge it in cold tap water. Change the water every 30 minutes, and cook it right after it thaws. The fridge plan is below.`; }
  else if(p.intent==="roast"&&oven){ lead=`A ${lb} lb turkey roasts in about ${durText(roastMinutes(lb))} at 325 F. In the oven by ${fmt(oven.when)} for this dinner. The full plan is below.`; }
  else if(p.intent==="fromfrozen"){ var fb0=frozenRoastBand(lb); lead=`Yes. USDA says cooking a turkey from frozen is safe. For a ${lb} lb bird at 325 F, plan on ${durText(fb0[0])} to ${durText(fb0[1])}. The details are in the plan below.`; }
  var rowsHtml=rows.map(r=>`<div class="row"><strong>${r.id==="buy"?fmtDateOnly(r.when):fmt(r.when)}</strong><br>${r.label}<br>${r.detail}</div>`).join("");
  var coldHtml = state==="frozen" ? `<h2>Cold-water backup</h2><p>Running late? Cold water thaws in about ${Math.round((lb*30/60)*10)/10} hours (${lb} lb at 30 minutes per pound).${p.coldWater&&cwStartEve?` For this dinner, start by ${fmt(cwStartEve)}.`:""} Seal the bird in a leak-proof plastic bag and submerge it in cold tap water. Change the water every 30 minutes, and cook it right after it thaws.</p>` : "";
  var frozenHtml="";
  if(state==="frozen"){
    var fb=frozenRoastBand(lb), fmid=frozenRoastMinutes(lb);
    var fOven=new Date(dinner.getTime()-(fmid+CONSTANTS.restMinutes.value)*60000);
    var fPast = fOven.getTime()<=now.getTime();
    frozenHtml = `<h2>Cook it from frozen</h2><p>No time to thaw at all? USDA says cooking a turkey from frozen is safe. It takes at least 50 percent longer than a thawed bird. For a ${lb} lb bird at 325 F, plan on ${durText(fb[0])} to ${durText(fb[1])}. A plan uses the middle, ${durText(fmid)}: in the oven by ${fmt(fOven)} for this dinner, then rest 20 minutes.${fPast?" That oven time has already passed, so this path cannot finish for this dinner either. A smaller bird, or a later dinner, can work.":""}</p><p>Do not use an oven bag. Pull the giblet packet out with tongs once the bird has baked 20 to 30 minutes. Done is still 165 F in the thickest part of the breast, the innermost thigh, and the innermost wing.</p><p>From-frozen times from the USDA chart, checked Oct 30, 2026.</p>`;
  }
  var planHtml=warnHtmlFor(warning)+rowsHtml+coldHtml;
  var bodyHtml = p.intent==="fromfrozen" ? frozenHtml+planHtml : planHtml+frozenHtml;
  /* Addendum 907-B: a late cold-water thaw that runs overnight carries
     the awake-to-change caveat from the overnight page. */
  if(thaw&&thaw.late){ var cwFinish=new Date(thaw.when.getTime()+lb*CONSTANTS.coldWaterMinPerLb.value*60000);
    if(cwFinish.getDate()!==now.getDate()||cwFinish.getMonth()!==now.getMonth()) bodyHtml+=`<div class="row"><strong>That cold-water time runs overnight.</strong><br>Cold water only works while you are awake to change it, every 30 minutes. Do not leave the turkey soaking overnight.</div>`; }
  out.innerHTML=premiseHtml+`<div class="row"><strong>${summary}</strong>${lead?`<br><span class="lead">${lead}</span>`:""}</div>`+bodyHtml;
  var dstr=dinner.getFullYear()+"-"+String(dinner.getMonth()+1).padStart(2,"0")+"-"+String(dinner.getDate()).padStart(2,"0");
  var tstr=String(dinner.getHours()).padStart(2,"0")+":"+String(dinner.getMinutes()).padStart(2,"0");
  document.getElementById("askp-calclink").innerHTML=`Want the picture card, print view, or calendar file? <a href="/calculator?via=share&w=${lb}&s=${state}&b=${brine}&d=${dstr}&t=${tstr}">Open this plan in the calculator</a>. It builds those from this same plan.`;
  try{ fleetTrack("ask_answered",{tool:"turkey-timeline-ask",intent:p.intent}); }catch(e){}
  return {rows:rows,warning:warning,parsed:p};
}
/* ASK PARSER END */
/* ================= ASK PANEL GLUE (panel-only) ================= */
(function(){
  var openBtn=document.getElementById("askp-open"), panel=document.getElementById("askp-panel"),
      closeBtn=document.getElementById("askp-close"), q=document.getElementById("askp-q"),
      goBtn=document.getElementById("askp-go"), lastFocus=null, inited=false;
  if(!openBtn||!panel) return;
  function lock(on){ document.documentElement.style.overflow=on?"hidden":""; document.body.style.overflow=on?"hidden":""; }
  /* Ask rebuild, homepage door (2026-11-03): the panel now talks to
     the same thawday-chat worker as the /ask page (POST /api/chat),
     so a conversation here carries the same session memory (the bird,
     the dinner, the brine) and the same non-plan answers. The panel
     holds the worker's session facts in memory only, exactly like
     the /ask page: nothing is stored, and closing the page ends the
     session. Plan and safety text is the worker's deterministic
     engine output, served verbatim below as text — this panel never
     composes numbers or safety wording of its own. If the worker is
     unreachable, the in-page engine above (answerAsk) answers as the
     grounded fallback, the same degrade the /ask page aims for: a
     grounded reply, never a dead end. */
  var panelFacts=null, panelBusy=false;
  function renderWorkerReply(reply){
    var out=document.getElementById("askp-answer");
    out.innerHTML="";
    var row=document.createElement("div"); row.className="row";
    String(reply||"").split(/\n+/).forEach(function(seg,i){
      if(i>0) row.appendChild(document.createElement("br"));
      row.appendChild(document.createTextNode(seg));
    });
    out.appendChild(row);
  }
  function panelCalcLink(facts){
    if(!facts||!facts.lb||!facts.dinnerParts) return;
    var dp=facts.dinnerParts;
    var dstr=dp.y+"-"+String(dp.mo+1).padStart(2,"0")+"-"+String(dp.d).padStart(2,"0");
    var tstr=String(dp.h).padStart(2,"0")+":"+String(dp.mi).padStart(2,"0");
    document.getElementById("askp-calclink").innerHTML="Want the picture card, print view, or calendar file? <a href=\"/calculator?via=share&w="+facts.lb+"&s="+(facts.state||"frozen")+"&b="+(facts.brine||"no")+"&d="+dstr+"&t="+tstr+"\">Open this plan in the calculator</a>. It builds those from this same plan.";
  }
  function runAsk(){
    if(panelBusy) return;
    var msg=(q.value||"").trim();
    if(!msg) return;
    var hint=document.getElementById("askp-hint");
    panelBusy=true; goBtn.disabled=true;
    if(hint) hint.textContent="ThawDay is thinking\u2026";
    function done(){
      panelBusy=false; goBtn.disabled=false;
      if(hint){ hint.textContent=""; if(hint.scrollIntoView){ try{ hint.scrollIntoView({block:"start"}); }catch(e){} } }
    }
    function fallback(){
      try{ fleetTrack("ask_fallback",{tool:"turkey-timeline-ask",surface:"panel",route:"transport-fallback"}); }catch(e){}
      answerAsk(msg);
      done();
    }
    var payload={message:msg}; if(panelFacts) payload.facts=panelFacts;
    /* One silent retry before the fallback, the /ask page's own
       pattern: a transport blip degrades to a grounded reply, not
       a wrong one. */
    function attempt(triesLeft){
      fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
        .then(function(r){ if(!r.ok) throw new Error("chat http "+r.status); return r.json(); })
        .then(function(j){
          if(!j||typeof j.reply!=="string"||!j.reply) throw new Error("chat bad reply");
          if(j.facts) panelFacts=j.facts;
          renderWorkerReply(j.reply);
          var route=(j.meta&&j.meta.route)||"unknown";
          if(route==="plan") panelCalcLink(panelFacts);
          try{ fleetTrack("ask_answered",{tool:"turkey-timeline-ask",surface:"panel",route:route}); }catch(e){}
          done();
        })
        .catch(function(){ if(triesLeft>0) attempt(triesLeft-1); else fallback(); });
    }
    attempt(1);
  }
  function init(){
    if(inited) return; inited=true;
    goBtn.addEventListener("click",runAsk);
    q.addEventListener("keydown",function(ev){ if(ev.key==="Enter"&&!ev.shiftKey){ ev.preventDefault(); runAsk(); } });
    panel.querySelectorAll(".chip").forEach(function(ch){ ch.addEventListener("click",function(){ q.value=ch.getAttribute("data-q"); goBtn.click(); }); });
  }
  function open(){
    init(); lastFocus=document.activeElement;
    panel.hidden=false; lock(true);
    q.focus();
  }
  function close(){
    panel.hidden=true; lock(false);
    if(lastFocus&&lastFocus.focus) lastFocus.focus(); else openBtn.focus();
  }
  openBtn.addEventListener("click",open);
  closeBtn.addEventListener("click",close);
  panel.addEventListener("click",function(ev){ if(ev.target===panel) close(); });
  document.addEventListener("keydown",function(ev){ if(ev.key==="Escape"&&!panel.hidden) close(); });
})();
})();

/* ================= FLEET YIELD GUARD START =================
   Phase B adoption (2026-11-01) of the fleet reference guard v1.0
   (builds/fleet-yield-guard-2026-11-01/ADOPTION-SPEC.md, ThawDay
   section): the fixed ask pill (#askp-open) yields below the fold
   whenever a visible interactive element would intersect its RESTING
   box (computed from untransformed CSS position + offset size, never
   from its rendered rect — the PMC oscillation rule). A focused pill
   and an open panel never yield. Everything above this block is the
   pre-adoption file byte for byte; rollback = remove this block and
   the FLEET YIELD GUARD CSS block in ask-panel.css. */
/* Fleet Yield Guard — reference implementation v1.0 (2026-11-01)
 *
 * SPEC + STAGING ONLY. Not deployed to any live site by this package.
 * Adoption ships per-site through the keeper after review — see ../ADOPTION-SPEC.md
 *
 * Problem it solves (D7 fleet finding, Nov 1 2026):
 *   A fixed Ask/Chat pill sits on top of real controls. Each site's home-grown
 *   guard watched only SOME elements (text nodes on PMC, one card on Secret
 *   Santa, the hero <h1> on Dadiosity, nothing on ThawDay's calculator), so
 *   at some scroll stop the pill always ate someone's tap.
 *
 * This guard watches ANY visible interactive element and yields the pill
 * (slides it off the fold) whenever one would intersect the pill's RESTING box.
 *
 * Anti-oscillation — the whole point, learned from PMC Addendum 985:
 *   The PMC guard read the pill's live getBoundingClientRect(). Mid-transition
 *   that rect INCLUDES the yield transform, so the guard measured itself,
 *   decided it was clear, un-yielded back onto the control, and oscillated.
 *   This guard NEVER measures the pill's rendered rect after init. It computes
 *   the resting box ONCE per layout (resize / orientation / pill size change)
 *   from the pill's untransformed CSS position (computed bottom/right/left/top
 *   + offsetWidth/offsetHeight, both transform-free) and caches it. Target
 *   rects are compared against that cached box, so the pill's own transform
 *   can never feed back into the decision. A 6px hysteresis band on the
 *   clear-check makes the state sticky at boundary scroll positions.
 *
 * Proven mechanics kept from tonight's ships:
 *   - SS Add.987: resting box from CSS constants (innerHeight - offset - size);
 *     a focused pill never yields; an open panel never yields.
 *   - PMC Add.985: band from untransformed position; watch interactive
 *     elements, not text.
 *   - Fleet: transform yield (translateY calc(100% + gap)), .25s ease,
 *     transition:none under prefers-reduced-motion.
 *   - Companion (page-side, in the adoption spec, not this file):
 *     html{scroll-padding-bottom} + footer padding so anchor landings and
 *     max-scroll targets can also clear by scrolling (ThawDay Add.979 pattern).
 *
 * Usage (drop-in, no dependencies, ES5-safe like the fleet's inline scripts):
 *   <link rel="stylesheet" href="fleet-yield-guard.css">   (or inline the 3 rules)
 *   <script src="fleet-yield-guard.js"></script>
 *   <script>
 *     FleetYieldGuard.init({
 *       pill: '#askp-open',              // selector or element (required)
 *       panel: '#askpWrap',              // optional: open panel element/selector;
 *                                        //   pill never yields while it is open/visible
 *       panelOpen: function(){...},     // optional alternative to `panel`
 *       targets: null,                   // optional extra selector; default is
 *                                        //   ANY interactive element (see SELECTOR)
 *       exclude: '.site-header, .site-nav', // optional: never watch these
 *       gap: 20,                         // px past the fold when yielded
 *       className: 'fyg-yield'           // yield class (CSS ships the transform)
 *     });
 *   </script>
 * Multiple pills on one page (Secret Santa has two): call init() once per pill.
 * Each call returns a handle { refresh, destroy, isYielded }.
 */
(function (global) {
  'use strict';

  var SELECTOR = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
    '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
    '[tabindex]:not([tabindex="-1"])', '[data-fyg-watch]'
  ].join(',');

  var HYSTERESIS = 6; /* px: once yielded, the hit test uses the resting box
                         EXPANDED by this much, so a target must clear the
                         box by >6px before the pill returns */

  function toEl(x) {
    if (!x) return null;
    if (typeof x === 'string') return document.querySelector(x);
    return x;
  }
  function toList(sel, root) {
    if (!sel) return [];
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function parsePx(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function init(opts) {
    opts = opts || {};
    var pill = toEl(opts.pill);
    if (!pill) return null;
    var panel = toEl(opts.panel);
    var className = opts.className || 'fyg-yield';
    var gap = (typeof opts.gap === 'number') ? opts.gap : 20;
    var extraTargets = opts.targets || null;
    var excludeSel = opts.exclude || null;

    pill.classList.add('fyg-pill');
    pill.style.setProperty('--fyg-gap', gap + 'px');

    var resting = null;   /* cached untransformed box {top,bottom,left,right} */
    var yielded = false;
    var ticking = false;
    var destroyed = false;
    var targets = [];

    /* --- resting box: computed from CSS position + offset size ONLY.
           offsetWidth/offsetHeight and computed bottom/right/left/top are
           all unaffected by transforms. Never call pill.getBoundingClientRect()
           here — that is the PMC oscillation bug. --- */
    function computeResting() {
      var cs = window.getComputedStyle(pill);
      var w = pill.offsetWidth, h = pill.offsetHeight;
      if (!w || !h) { return; } /* SPEC-05: pill may be display:none while yielded; keep the last known box */
      var vw = window.innerWidth, vh = window.innerHeight;
      var left = parsePx(cs.left), right = parsePx(cs.right);
      var top = parsePx(cs.top), bottom = parsePx(cs.bottom);
      var box = {};
      if (left !== null && cs.left !== 'auto') box.left = left;
      else if (right !== null && cs.right !== 'auto') box.left = vw - right - w;
      else box.left = vw - w; /* fallback: assume right-anchored */
      /* ThawDay adoption correction (Phase B, 2026-11-01): for a
         bottom-anchored pill, derive the top from bottom + offset
         height FIRST. Chromium resolves computed `top` for such an
         element to a value that can sit 8-16px above the rendered
         box (measured live in the adoption probes: computed 764px
         vs rendered bottom edge 820px on a 780px expectation), which
         shifted the whole resting box up and left the pill's lower
         band unguarded. Bottom + offset size are both transform-free
         and exact — the same constants method as the Secret Santa
         Addendum 987 guard this reference generalizes. */
      if (bottom !== null && cs.bottom !== 'auto') box.top = vh - bottom - h;
      else if (top !== null && cs.top !== 'auto') box.top = top;
      else box.top = vh - h;
      box.right = box.left + w;
      box.bottom = box.top + h;
      resting = box;
    }

    function collectTargets() {
      var list = toList(SELECTOR);
      if (extraTargets) list = list.concat(toList(extraTargets));
      var excludes = excludeSel ? toList(excludeSel) : [];
      targets = list.filter(function (el) {
        if (el === pill) return false;
        if (pill.contains(el)) return false;
        if (panel && (el === panel || panel.contains(el))) return false;
        for (var i = 0; i < excludes.length; i++) {
          if (el === excludes[i] || excludes[i].contains(el)) return false;
        }
        return true;
      });
    }

    function panelIsOpen() {
      if (typeof opts.panelOpen === 'function') return !!opts.panelOpen();
      if (!panel) return false;
      if (panel.hidden) return false;
      var cs = window.getComputedStyle(panel);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    }

    function update() {
      ticking = false;
      if (destroyed) return;
      /* A focused pill, or an open panel, never yields (SS 987 rule). */
      if (panelIsOpen() || document.activeElement === pill || pill.contains(document.activeElement)) {
        setYield(false);
        return;
      }
      if (!resting) computeResting();
      if (!resting) return;
      var box = resting;
      /* Hysteresis: yield on ANY overlap with the resting box; once yielded,
         a target must clear the box EXPANDED by HYSTERESIS px before the
         pill returns. (An early draft shrank the box for the return check instead —
         the harness's boundary fixture caught the limit cycle that creates
         for shallow overlaps: yield -> not-hit -> un-yield -> hit. See
         REPORT.md, harness bug log #2.) */
      var ex = yielded ? HYSTERESIS : 0;
      var hit = false;
      for (var i = 0; i < targets.length; i++) {
        var el = targets[i];
        /* Skip non-rendered targets cheaply before paying for a rect. */
        if (el.offsetParent === null && window.getComputedStyle(el).position !== 'fixed' && window.getComputedStyle(el).position !== 'sticky') {
          /* offsetParent is null for display:none and for fixed elements;
             fixed/sticky fall through to the rect check below. */
          if (window.getComputedStyle(el).display === 'none') continue;
        }
        var b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        if (b.bottom > box.top - ex && b.top < box.bottom + ex &&
            b.right > box.left - ex && b.left < box.right + ex) { hit = true; break; }
      }
      setYield(hit);
    }

    var hideTimer = null;
    function setYield(on) {
      if (on === yielded) return;
      yielded = on;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      if (on) {
        pill.classList.add(className);
        /* SPEC-05 (Nov 4, 2026): after the slide-out finishes, remove the
           pill from layout. Parked below the fold it still had a rect that
           overlapped tap targets scrolling near the bottom edge (the
           cold-QA settled sweep caught chips and footer links under that
           parked rect). With display:none the rect is zero and the settled
           pill can cover nothing, at any scroll depth. */
        hideTimer = setTimeout(function () {
          hideTimer = null;
          if (yielded) pill.classList.add('fyg-hidden');
        }, 300);
      } else {
        pill.classList.remove('fyg-hidden');
        void pill.offsetWidth; /* reflow so the slide back in still animates */
        pill.classList.remove(className);
      }
    }

    function schedule() {
      if (ticking || destroyed) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }
    function scheduleRelayout() {
      /* Layout may have changed: recompute the resting box and the target
         list, then re-evaluate. This is the ONLY place resting is dropped.
         SPEC-05: while the pill is display:none (yielded) it has no size;
         keep the last known box rather than dropping it. */
      if (pill.offsetWidth) resting = null;
      collectTargets();
      schedule();
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', scheduleRelayout);
    window.addEventListener('orientationchange', scheduleRelayout);
    pill.addEventListener('focus', function () { setYield(false); }, true);
    pill.addEventListener('blur', schedule, true);

    var mo = null;
    if (window.MutationObserver) {
      /* Results, sealed links, tallies and cards appear dynamically
         (Secret Santa payoff screen, FMB tally, PP results). Watch for
         added/removed nodes and attribute changes that show/hide them. */
      mo = new MutationObserver(function () { collectTargets(); schedule(); });
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    }

    collectTargets();
    computeResting();
    update();

    return {
      refresh: scheduleRelayout,
      isYielded: function () { return yielded; },
      destroy: function () {
        destroyed = true;
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', scheduleRelayout);
        window.removeEventListener('orientationchange', scheduleRelayout);
        if (mo) mo.disconnect();
        setYield(false);
      }
    };
  }

  global.FleetYieldGuard = { init: init, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);

;(function(){
  if (!window.FleetYieldGuard) return;
  var handle = FleetYieldGuard.init({ pill: '#askp-open', panel: '#askp-panel', gap: 28 });
  /* gap 28 (not the reference default 20): device emulation renders
     this pill's resting bottom inset at 24px against the CSS 16px, so
     a 20px gap left a 4px yielded sliver inside the fold in the
     adoption probes. 28 clears the fold in both geometries. */
  if (!handle) return;
  /* The resting box is cached at init; if the viewport or the pill's
     own size settles afterwards (browser chrome, font swap), the cached
     box goes stale and the pill's lower band stops yielding. Recompute
     it once everything has loaded, and again when fonts land. */
  window.addEventListener('load', function () { handle.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { handle.refresh(); });
})();
/* ================= FLEET YIELD GUARD END ================= */
