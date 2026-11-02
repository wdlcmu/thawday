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
  if(state==="frozen"){ rows.push(buyRow(daysBefore(dinner,11),"Buy by this date (kitchen practice). Frozen birds sell out the weekend before Thanksgiving."));
    const thawStart=daysBefore(dinner,thawDays(lb));
    if(now && now>thawStart){ rows.push({id:"thaw", late:true, label:"Thaw in cold water today", when:new Date(now.getTime()), detail:"Fridge thaw start has passed. Cold water takes about "+(Math.round((lb*30/60)*10)/10)+" hours (30 minutes per pound). Seal it in a leak-proof plastic bag and submerge it in cold tap water. Change the water every 30 minutes, and cook it right after it thaws."}); }
    else { rows.push({id:"thaw", label:"Move the turkey to the fridge", when:thawStart, detail:"Fridge thaw, per the USDA chart. Keep the fridge at 40 F or below."}); }
  } else { rows.push(buyRow(daysBefore(dinner,2),"Fresh: buy 1 to 2 days before cooking.")); }
  const ovenIn=new Date(dinner.getTime()-(roastMinutes(lb)+CONSTANTS.restMinutes.value)*MIN);
  if(brine==="yes") rows.push({id:"brine", label:"Start brining", when:new Date(ovenIn.getTime()-CONSTANTS.brineBeforeOvenMinutes.value*MIN), detail: state==="frozen" ? "Brine in the fridge the whole time, never longer than two days, discard the brine after. Start once the bird is thawed." : "Brine in the fridge the whole time, never longer than two days, discard the brine after."});
  rows.push({id:"oven", label:"Turkey goes in the oven", when:ovenIn, detail:"325 F. The chart aims, the thermometer decides: 165 F."});
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
     on even finishes. Brining is optional, so this warns (it does not
     drop the step): the honest outs are a shorter brine or none. This
     check runs last, so the stronger past / late / lead verdicts above
     keep winning exactly as before. No USDA numbers live here either:
     the cold-water finish reuses the same finish the late check just
     computed from the plan's own rows. */
  const brineRow=rows.find(r=>r.id==="brine");
  if(now && brineRow){
    if(thaw && thaw.late){
      const cwFinish=new Date(thaw.when.getTime()+lb*CONSTANTS.coldWaterMinPerLb.value*60000);
      if(brineRow.when.getTime()<cwFinish.getTime()) return {kind:"brine", brine:brineRow.when, finish:cwFinish, reason:"thaw"};
    }
    if(brineRow.when.getTime()<=now.getTime()) return {kind:"brine", brine:brineRow.when, reason:"past"};
  }
  return null;
}
// ENGINE END
function fmt(d){ return d.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); }
function fmtShort(d){ return d.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric"}).replace(":00",""); }
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
    if(dropped){ var cand=kept.join(" "); if(/cold water|fridge|refrigerator|counter\w*|room temperature|lukewarm|tepid|warm|hot/.test(cand)||(/water/.test(cand)&&/every 30 minutes/.test(cand))) pt=cand; }
  }
  if(/\bcounter\w*|room temperature/.test(pt)) p.premise="counter";
  else if(/lukewarm\b|tepid\b|warm-?ish\b|\bheated\b|(?:feels?|felt) (?:warm|hot)\b|\b(?:warm|hot)(?: \w+){0,3}? (?:water|sink|basin|bath|soak|tub)\b/.test(pt)) p.premise="warmwater";
  else if(/cold water/.test(pt)&&/(overnight|all night|(?:through|for|over) the (?:whole )?night|through tonight|through (?:the )?(?:dawn|sunrise|daybreak)|(?:till|until|til) (?:the |tomorrow )?morning|(?:till|until|til) (?:i|we) wake|(?:till|until|til) (?:(?:i|we) (?:get|wake) up|(?:everyone|everybody) (?:gets|wakes) up)|(?:till|until|til) (?:the )?(?:dawn|sunrise|daybreak|first light|sunup|daylight|break of (?:the )?day|first crack of (?:light|dawn)|day breaks|crack of (?:the )?dawn|sun (?:comes up|rises|is up|comes back up|peeks up))|midnight (?:to|till|until) (?:the )?(?:morning|dawn|sunrise|daybreak)|while (?:[a-z]+ ){0,3}(?:asleep|sleeping|sleeps|sleep)\b|while (?:i|we) (?:sleep|am asleep|am sleeping)|while i'?m (?:sleeping|asleep))/.test(pt)) p.premise="coldovernight";
  /* 2026-11-01 (Addendum 919): the hold read only "been in the fridge
     for N days". It now reads the shapes people actually use ("thawed
     3 days ago", "since Monday", "finished thawing on Wednesday",
     "in the refrigerator for 2 days", "thawed yesterday") and counts
     forward to the day the cook plans to cook, so a past-window bird
     gets its warning even when the cook day is still ahead. Only
     calendar arithmetic lives here; the food-safety number is still
     the published 1-to-2-day rule in answerAsk. */
  var thawedWord=/\bthawed\b|\bdefrosted\b|\bdid thaw\b|finished thawing/.test(t)||/out of the freezer/.test(t)
    /* Addendum 952: "finish thawing" in its other forms (finish /
       finishing / finishes thawing) and a bare "finished yesterday"
       are completion evidence too — the finish forms only when the
       text also carries a past-day word the count can use, so a
       plain "how long does it take to finish thawing" question
       keeps its plan. The emphatic past "did thaw" joins the main
       read (a past statement by shape; "did not thaw" does not
       match it). */
    ||(/(?:\bfinish\w*|\bdone|\bcompleted) thawing\b/.test(t)&&/(yesterday|days? ago|day before yesterday)/.test(t))
    /* Addendum 956: "done thawing" / "completed thawing" are
       completion evidence behind the same past-day gate, so a
       timing question ("how long until it is done thawing")
       still keeps its plan. */
    ||/\bfinish\w* yesterday\b/.test(t);
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
    return !/\s+(?:and|but)\s+(?=(?:i|it|the|my|we|they|this|that)\b|(?:thawed|defrosted|sat|stayed|left|kept|been|was|were|has|have|had|is|are|finished|spent|want|wants)\b)|\s+so\s+(?=(?:i|it|the|my|we|they)\b)/.test(mid); };
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
  { var claims=[], govLate956=false;
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
        if(gov956.shape==="since"||gov956.shape==="on") govLate956=true;
        holdM=gov956.shape==="hold"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null;
        beenThawedM=gov956.shape==="been"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null;
        agoM=gov956.shape==="ago"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null;
        sinceM=gov956.shape==="since"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null;
        thawOnM=gov956.shape==="on"?{0:gov956.text,1:gov956.cap,index:gov956.index}:null; } } }
  if(holdM&&negAt(holdM.index)) holdM=null;
  if(beenThawedM&&negAt(beenThawedM.index)) beenThawedM=null;
  if(agoM&&negAt(agoM.index)) agoM=null;
  var holdCue=holdM||beenThawedM||/how long can a thawed/.test(t)
    ||(thawedWord&&/(fridge|refrigerator)/.test(t)&&/(still ok|still good|still safe|how long|ok to|safe to)/.test(t))
    ||(thawedWord&&(sinceM||thawOnM||agoM||/day before yesterday/.test(t)||/\byesterday\b/.test(t)||/\bsitting\b/.test(t)||/(still ok|still good|still safe|ok to cook|is it ok|good for)/.test(t)))
    ||(/\bsitting\b/.test(t)&&sinceM);
  if(holdCue){ p.premise="hold";
    var elapsed=null;
    if(holdM) elapsed=dayNum(holdM[1]);
    else if(beenThawedM) elapsed=dayNum(beenThawedM[1]);
    else if(agoM) elapsed=dayNum(agoM[1]);
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
  for(var wi=0;wi<wdayHits.length;wi++){ var wh=wdayHits[wi];
    var before=t.slice(Math.max(0,wh.idx-24),wh.idx), after=t.slice(wh.idx+wh.name.length,wh.idx+wh.name.length+10);
    if(/(it'?s|it is|today is|today'?s)\s+$/.test(before)) continue;
    var score=0;
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
  return `<div class="row warnrow"><strong>${warning.kind==="past"?"That dinner time is already past.":"This plan cannot work as entered."}</strong><br>${warning.kind==="past"?"Pick a date and time ahead of you, and the plan will line up.":warning.kind==="lead"?`The turkey would have had to go in the oven at ${fmt(warning.oven)}. There is not enough time to roast it before this dinner. What can work instead: a smaller bird, or a later dinner.`:warning.kind==="brine"?(warning.reason==="thaw"?`Brining was set to start at ${fmt(warning.brine)}, but the turkey does not finish thawing until ${fmt(warning.finish)}. A brine cannot start before the bird is thawed. What can work instead: skip the brine, or use a shorter brine once it thaws.`:`Brining was set to start at ${fmt(warning.brine)}. That time has already passed, so a full brine cannot fit before this dinner. What can work instead: skip the brine, or use a shorter brine that starts now.`):`Cold water from now finishes thawing at ${fmt(warning.finish)}. The turkey needs to be in the oven before then. What can work instead: a smaller bird, a fresh bird, or a later dinner.`}</div>`;
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
  if(p.intent==="thaw"&&thaw){ lead=thaw.late?`Fridge thaw has already passed for this dinner. Use cold water today: about ${Math.round((lb*30/60)*10)/10} hours. The full plan is below.`:p.coldWater?`In cold water, a ${lb} lb turkey thaws in about ${Math.round((lb*30/60)*10)/10} hours (30 minutes per pound). Seal it in a leak-proof plastic bag, submerge it in cold tap water, change the water every 30 minutes, and cook it right after it thaws. The fridge plan is below.`:`A ${lb} lb turkey takes ${thawDays(lb)} days to thaw in the fridge. Start thawing ${fmt(thaw.when)}. Move the turkey to the fridge then. The full plan is below.`; }
  else if(p.intent==="plan"&&p.coldWater&&/cold water time/i.test(raw)&&thaw){ lead=`In cold water, a ${lb} lb turkey thaws in about ${Math.round((lb*30/60)*10)/10} hours (30 minutes per pound). Seal it in a leak-proof plastic bag, submerge it in cold tap water, change the water every 30 minutes, and cook it right after it thaws. The fridge plan is below.`; }
  else if(p.intent==="roast"&&oven){ lead=`A ${lb} lb turkey roasts in about ${durText(roastMinutes(lb))} at 325 F. In the oven by ${fmt(oven.when)} for this dinner. The full plan is below.`; }
  else if(p.intent==="fromfrozen"){ var fb0=frozenRoastBand(lb); lead=`Yes. USDA says cooking a turkey from frozen is safe. For a ${lb} lb bird at 325 F, plan on ${durText(fb0[0])} to ${durText(fb0[1])}. The details are in the plan below.`; }
  var rowsHtml=rows.map(r=>`<div class="row"><strong>${fmt(r.when)}</strong><br>${r.label}<br>${r.detail}</div>`).join("");
  var coldHtml = state==="frozen" ? `<h2>Cold-water backup</h2><p>Running late? Cold water thaws in about ${Math.round((lb*30/60)*10)/10} hours (${lb} lb at 30 minutes per pound). Seal the bird in a leak-proof plastic bag and submerge it in cold tap water. Change the water every 30 minutes, and cook it right after it thaws.</p>` : "";
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
  if(thaw&&thaw.late){ var cwFinish=new Date(now.getTime()+lb*CONSTANTS.coldWaterMinPerLb.value*60000);
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
  function runAsk(){
    answerAsk(q.value);
    var hint=document.getElementById("askp-hint");
    if(hint && hint.scrollIntoView){ try{ hint.scrollIntoView({block:"start"}); }catch(e){} }
  }
  function init(){
    if(inited) return; inited=true;
    goBtn.addEventListener("click",runAsk);
    q.addEventListener("keydown",function(ev){ if(ev.key==="Enter"&&!ev.shiftKey){ ev.preventDefault(); runAsk(); } });
    panel.querySelectorAll(".chip").forEach(function(ch){ ch.addEventListener("click",function(){ q.value=ch.getAttribute("data-q"); runAsk(); }); });
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
      if (!w || !h) { resting = null; return; }
      var vw = window.innerWidth, vh = window.innerHeight;
      var left = parsePx(cs.left), right = parsePx(cs.right);
      var top = parsePx(cs.top), bottom = parsePx(cs.bottom);
      var box = {};
      if (left !== null && cs.left !== 'auto') box.left = left;
      else if (right !== null && cs.right !== 'auto') box.left = vw - right - w;
      else box.left = vw - w; /* fallback: assume right-anchored */
      if (top !== null && cs.top !== 'auto') box.top = top;
      else if (bottom !== null && cs.bottom !== 'auto') box.top = vh - bottom - h;
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

    function setYield(on) {
      if (on === yielded) return;
      yielded = on;
      pill.classList.toggle(className, on);
    }

    function schedule() {
      if (ticking || destroyed) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }
    function scheduleRelayout() {
      /* Layout may have changed: recompute the resting box and the target
         list, then re-evaluate. This is the ONLY place resting is dropped. */
      resting = null;
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
  if (window.FleetYieldGuard) {
    FleetYieldGuard.init({ pill: '#askp-open', panel: '#askp-panel' });
  }
})();
/* ================= FLEET YIELD GUARD END ================= */
