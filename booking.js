/* DG Nails - Interactive Online Booking Widget
   Self-contained: injects its own markup + styles, runs the booking flow,
   and sends each confirmed booking to a Google Apps Script Web App that
   (1) creates a Google Calendar event and (2) emails nailswinnipeg@gmail.com.
   See SETUP.md to connect your Google account (60 seconds). */
(function(){
"use strict";

// ===== CONFIG ===============================================
// Paste your Apps Script Web App URL here after running SETUP.md.
// Until then, the widget gracefully falls back to email/WhatsApp.
var ENDPOINT = "https://script.google.com/macros/s/AKfycbwtS9PEZr-vPT_fs4MICJQ3qCk1wE-4yvewZnd0TZfNdHneuytTKaBvff-LKF1uOjIz/exec";
var SALON_EMAIL = "nailswinnipeg@gmail.com";
var SALON_WHATSAPP = "14313368788";
var TZ = "America/Winnipeg";

// Services with duration (minutes) + price, drawn from the DG Nails menu.
var SERVICES = [
  { name: "Color Change", price: 20, mins: 30, cat: "Regular" },
  { name: "Manicure Regular", price: 25, mins: 45, cat: "Regular" },
  { name: "Pedicure Regular", price: 40, mins: 50, cat: "Regular" },
  { name: "Mani & Pedi", price: 65, mins: 90, cat: "Regular" },
  { name: "Manicure Shellac", price: 40, mins: 60, cat: "Shellac" },
  { name: "Pedicure Shellac", price: 45, mins: 60, cat: "Shellac" },
  { name: "Mani & Pedi Shellac", price: 85, mins: 120, cat: "Shellac" },
  { name: "New Gel Set", price: 50, mins: 90, cat: "Full set" },
  { name: "New Acrylic Set", price: 50, mins: 90, cat: "Full set" },
  { name: "Ombre Full Set", price: 70, mins: 105, cat: "Full set" },
  { name: "Gel Overlay with Shellac", price: 60, mins: 75, cat: "Overlay" },
  { name: "Gel or Acrylic Toes", price: 65, mins: 75, cat: "Toes" },
  { name: "French Toes", price: 75, mins: 80, cat: "Toes" },
  { name: "Nail art", price: 10, mins: 30, cat: "Add-on" },
  { name: "Restorative nail care", price: 35, mins: 45, cat: "Care" },
  { name: "Acrylic or Gel Removal", price: 20, mins: 30, cat: "Removal" }
];

// Opening hours by weekday (0=Sun..6=Sat). null = closed/by request.
var HOURS = {
  0: null,            // Sunday: by request
  1: [10, 19],        // Mon
  2: [10, 19],        // Tue
  3: [10, 19],        // Wed
  4: [10, 19],        // Thu
  5: [10, 19],        // Fri
  6: [9, 17]          // Sat
};
var SLOT_STEP = 30; // minutes between selectable start times

// ===== STATE ================================================
var state = { service: null, date: null, time: null, name: "", phone: "", email: "", notes: "", step: 1, viewMonth: null };

// ===== HELPERS ==============================================
function el(tag, attrs, html){ var e = document.createElement(tag); if(attrs){ for(var k in attrs){ if(k==="class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } } if(html!=null) e.innerHTML = html; return e; }
function pad(n){ return (n<10?"0":"")+n; }
function esc(s){ return String(s||"").replace(/[<>&"]/g, function(c){ return {"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]; }); }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtDate(d){ return d.toLocaleDateString("en-CA", { weekday:"long", month:"long", day:"numeric", year:"numeric" }); }
function fmtTime(mins){ var h=Math.floor(mins/60), m=mins%60; var ap=h>=12?"PM":"AM"; var hh=h%12; if(hh===0) hh=12; return hh+":"+pad(m)+" "+ap; }
function slotsFor(date){ var day=date.getDay(); var h=HOURS[day]; if(!h) return []; var out=[]; var start=h[0]*60, end=h[1]*60; var dur=state.service?state.service.mins:30; for(var t=start; t+dur<=end; t+=SLOT_STEP){ out.push(t); } return out; }
function endLocalISO(date, startMin, durMin){ var d=new Date(date); d.setHours(0, startMin+durMin, 0, 0); return d; }
function startLocal(date, startMin){ var d=new Date(date); d.setHours(0, startMin, 0, 0); return d; }

// ===== STYLES (scoped, matches DG Nails palette) ============
function injectStyles(){
  if(document.getElementById("dgb-styles")) return;
  var css = ""
  + ".dgb{--rose:#d94f85;--wine:#842851;--gold:#c99a4a;--ink:#2d2230;--muted:#766a73;--line:#eadbe1;--paper:#fffafc;--cream:#fff0e7;font-family:'Nunito Sans',system-ui,sans-serif;color:var(--ink);}"
  + ".dgb-shell{max-width:920px;margin:0 auto;background:var(--paper);border:1px solid var(--line);border-radius:28px;box-shadow:0 24px 80px rgba(82,38,61,.17);overflow:hidden;}"
  + ".dgb-top{padding:26px clamp(18px,4vw,40px);background:linear-gradient(135deg,#fff0e7,#ffe3ee);border-bottom:1px solid var(--line);}"
  + ".dgb-eyebrow{letter-spacing:.18em;text-transform:uppercase;font-size:12px;font-weight:800;color:var(--rose);margin:0 0 6px;}"
  + ".dgb-title{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:clamp(26px,4vw,40px);margin:0;color:var(--wine);}"
  + ".dgb-steps{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;}"
  + ".dgb-pill{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--muted);background:rgba(255,255,255,.6);border:1px solid var(--line);padding:7px 13px;border-radius:999px;transition:.25s;}"
  + ".dgb-pill.active{color:#fff;background:linear-gradient(135deg,var(--rose),var(--wine));border-color:transparent;box-shadow:0 8px 20px rgba(132,40,81,.25);}"
  + ".dgb-pill.done{color:var(--wine);border-color:var(--rose);}"
  + ".dgb-pill .dgb-num{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.06);font-size:12px;}"
  + ".dgb-pill.active .dgb-num{background:rgba(255,255,255,.25);}"
  + ".dgb-body{padding:clamp(18px,4vw,40px);}"
  + ".dgb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;}"
  + ".dgb-card{text-align:left;cursor:pointer;background:#fff;border:1.5px solid var(--line);border-radius:18px;padding:16px;transition:.2s;}"
  + ".dgb-card:hover{transform:translateY(-3px);border-color:var(--rose);box-shadow:0 14px 30px rgba(217,79,133,.18);}"
  + ".dgb-card.sel{border-color:var(--rose);background:linear-gradient(135deg,#fff,#fff4f8);box-shadow:0 14px 30px rgba(217,79,133,.22);}"
  + ".dgb-card h4{margin:0 0 6px;font-size:15px;color:var(--ink);}"
  + ".dgb-card .dgb-meta{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);}"
  + ".dgb-card .dgb-price{color:var(--wine);font-weight:800;}"
  + ".dgb-cat{display:inline-block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:6px;}"
  + ".dgb-cal{max-width:380px;}"
  + ".dgb-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}"
  + ".dgb-cal-head strong{font-size:17px;color:var(--wine);}"
  + ".dgb-nav{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:#fff;cursor:pointer;font-size:16px;color:var(--wine);transition:.2s;}"
  + ".dgb-nav:hover{background:var(--cream);}"
  + ".dgb-dow,.dgb-days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}"
  + ".dgb-dow span{text-align:center;font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;}"
  + ".dgb-day{aspect-ratio:1;border:1px solid transparent;border-radius:12px;background:#fff;cursor:pointer;font-weight:700;color:var(--ink);transition:.15s;}"
  + ".dgb-day:hover:not(:disabled){background:var(--cream);}"
  + ".dgb-day:disabled{color:#cdbfc8;cursor:not-allowed;background:transparent;}"
  + ".dgb-day.sel{background:linear-gradient(135deg,var(--rose),var(--wine));color:#fff;}"
  + ".dgb-day.req{outline:1px dashed var(--gold);}"
  + ".dgb-slots{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;}"
  + ".dgb-slot{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;transition:.18s;}"
  + ".dgb-slot:hover{border-color:var(--rose);}"
  + ".dgb-slot.sel{background:linear-gradient(135deg,var(--rose),var(--wine));color:#fff;border-color:transparent;}"
  + ".dgb-field{margin-bottom:14px;}"
  + ".dgb-field label{display:block;font-size:13px;font-weight:800;color:var(--wine);margin-bottom:6px;}"
  + ".dgb-field input,.dgb-field textarea{width:100%;border:1.5px solid var(--line);border-radius:12px;padding:11px 13px;font:inherit;background:#fff;}"
  + ".dgb-field input:focus,.dgb-field textarea:focus{outline:none;border-color:var(--rose);box-shadow:0 0 0 3px rgba(217,79,133,.15);}"
  + ".dgb-summary{background:var(--cream);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:18px;font-size:14px;}"
  + ".dgb-summary div{display:flex;justify-content:space-between;padding:4px 0;}"
  + ".dgb-summary .dgb-tot{border-top:1px dashed var(--gold);margin-top:6px;padding-top:8px;font-weight:800;color:var(--wine);}"
  + ".dgb-actions{display:flex;justify-content:space-between;gap:12px;margin-top:22px;flex-wrap:wrap;}"
  + ".dgb-btn{border:none;border-radius:999px;padding:13px 26px;font-weight:800;font-size:15px;cursor:pointer;transition:.2s;}"
  + ".dgb-btn.primary{color:#fff;background:linear-gradient(135deg,var(--rose),var(--wine));box-shadow:0 10px 24px rgba(132,40,81,.28);}"
  + ".dgb-btn.primary:hover{transform:translateY(-2px);}"
  + ".dgb-btn.primary:disabled{opacity:.45;cursor:not-allowed;transform:none;}"
  + ".dgb-btn.ghost{background:#fff;border:1.5px solid var(--line);color:var(--wine);}"
  + ".dgb-hint{font-size:13px;color:var(--muted);margin-top:8px;}"
  + ".dgb-done{text-align:center;padding:20px 6px;}"
  + ".dgb-check{width:84px;height:84px;margin:0 auto 16px;border-radius:50%;background:linear-gradient(135deg,var(--rose),var(--wine));display:grid;place-items:center;color:#fff;font-size:42px;animation:dgbpop .5s ease;}"
  + "@keyframes dgbpop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1)}}"
  + ".dgb-done h3{font-family:'Cormorant Garamond',serif;color:var(--wine);font-size:30px;margin:0 0 8px;}"
  + ".dgb-addcal{display:inline-flex;gap:8px;margin-top:14px;}"
  + ".dgb-spin{display:inline-block;width:18px;height:18px;border:3px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:dgbspin .7s linear infinite;vertical-align:-3px;margin-right:8px;}"
  + "@keyframes dgbspin{to{transform:rotate(360deg)}}"
  + "@media(max-width:560px){.dgb-actions{flex-direction:column-reverse;}.dgb-btn{width:100%;}}";
  var s = el("style", { id:"dgb-styles" }); s.textContent = css; document.head.appendChild(s);
}

// ===== RENDER ===============================================
var root;
function stepsBar(){
  var labels = ["Service","Date & time","Your details","Confirm"];
  var h = "<div class='dgb-steps'>";
  for(var i=0;i<labels.length;i++){
    var n=i+1, cls="dgb-pill"+(state.step===n?" active":"")+(state.step>n?" done":"");
    h += "<span class='"+cls+"'><span class='dgb-num'>"+(state.step>n?"\u2713":n)+"</span>"+labels[i]+"</span>";
  }
  return h+"</div>";
}
function render(){
  injectStyles();
  var h = "<div class='dgb'><div class='dgb-shell'>";
  h += "<div class='dgb-top'><p class='dgb-eyebrow'>Online booking</p><h2 class='dgb-title'>Reserve your beauty moment</h2>"+stepsBar()+"</div>";
  h += "<div class='dgb-body' id='dgb-body'></div></div></div>";
  root.innerHTML = h;
  var body = root.querySelector("#dgb-body");
  if(state.step===1) renderServices(body);
  else if(state.step===2) renderWhen(body);
  else if(state.step===3) renderDetails(body);
  else if(state.step===4) renderConfirm(body);
  else if(state.step===5) renderDone(body);
}
function renderServices(body){
  var h = "<p class='dgb-hint' style='margin-top:0'>Choose the service you would like. Prices and durations are approximate and confirmed in studio.</p><div class='dgb-grid'>";
  SERVICES.forEach(function(s,i){
    var sel = state.service && state.service.name===s.name ? " sel" : "";
    h += "<button type='button' class='dgb-card"+sel+"' data-i='"+i+"'><span class='dgb-cat'>"+esc(s.cat)+"</span><h4>"+esc(s.name)+"</h4><div class='dgb-meta'><span>"+s.mins+" min</span><span class='dgb-price'>$"+s.price+"</span></div></button>";
  });
  h += "</div><div class='dgb-actions'><span></span><button type='button' class='dgb-btn primary' id='dgb-next' disabled>Continue \u2192</button></div>";
  body.innerHTML = h;
  body.querySelectorAll(".dgb-card").forEach(function(c){
    c.addEventListener("click", function(){ state.service = SERVICES[+c.dataset.i]; state.time=null; render(); });
  });
  var nx = body.querySelector("#dgb-next");
  if(state.service){ nx.disabled=false; nx.addEventListener("click", function(){ state.step=2; render(); }); }
}

function renderWhen(body){
  var today = new Date(); today.setHours(0,0,0,0);
  if(!state.viewMonth) state.viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  var vm = state.viewMonth;
  var monthName = vm.toLocaleDateString("en-CA", { month:"long", year:"numeric" });
  var first = new Date(vm.getFullYear(), vm.getMonth(), 1);
  var startPad = first.getDay();
  var daysInMonth = new Date(vm.getFullYear(), vm.getMonth()+1, 0).getDate();
  var prevDisabled = (vm.getFullYear()===today.getFullYear() && vm.getMonth()===today.getMonth());
  var h = "<div class='dgb-cal'><div class='dgb-cal-head'><button type='button' class='dgb-nav' id='dgb-prev'"+(prevDisabled?" disabled":"")+">\u2039</button><strong>"+monthName+"</strong><button type='button' class='dgb-nav' id='dgb-nextm'>\u203a</button></div>";
  h += "<div class='dgb-dow'><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class='dgb-days'>";
  for(var p=0;p<startPad;p++) h += "<span></span>";
  for(var d=1; d<=daysInMonth; d++){
    var date = new Date(vm.getFullYear(), vm.getMonth(), d);
    var dow = date.getDay();
    var past = date < today;
    var closed = HOURS[dow]===null && dow!==0; // (none currently)
    var byReq = dow===0;
    var disabled = past;
    var sel = state.date && sameDay(date, state.date) ? " sel" : "";
    var reqcls = byReq ? " req" : "";
    h += "<button type='button' class='dgb-day"+sel+reqcls+"' data-d='"+d+"'"+(disabled?" disabled":"")+" title='"+(byReq?"Sunday \u2013 by request":"")+"'>"+d+"</button>";
  }
  h += "</div><p class='dgb-hint'>Dashed days are Sundays (by request). We confirm every booking personally.</p></div>";
  h += "<div id='dgb-slotwrap'></div>";
  h += "<div class='dgb-actions'><button type='button' class='dgb-btn ghost' id='dgb-back'>\u2190 Back</button><button type='button' class='dgb-btn primary' id='dgb-next' disabled>Continue \u2192</button></div>";
  body.innerHTML = h;
  body.querySelector("#dgb-back").addEventListener("click", function(){ state.step=1; render(); });
  var prev = body.querySelector("#dgb-prev"); if(prev && !prev.disabled) prev.addEventListener("click", function(){ state.viewMonth=new Date(vm.getFullYear(), vm.getMonth()-1, 1); render(); });
  body.querySelector("#dgb-nextm").addEventListener("click", function(){ state.viewMonth=new Date(vm.getFullYear(), vm.getMonth()+1, 1); render(); });
  body.querySelectorAll(".dgb-day").forEach(function(b){ if(b.disabled) return; b.addEventListener("click", function(){ state.date=new Date(vm.getFullYear(), vm.getMonth(), +b.dataset.d); state.time=null; render(); setTimeout(drawSlots,0); }); });
  drawSlots();
  function drawSlots(){
    var w = body.querySelector("#dgb-slotwrap"); if(!w) return;
    if(!state.date){ w.innerHTML=""; return; }
    var slots = slotsFor(state.date);
    var hh = "<p style='font-weight:800;color:var(--wine);margin:18px 0 0'>"+fmtDate(state.date)+"</p>";
    if(state.date.getDay()===0){ hh += "<p class='dgb-hint'>Sundays are by request \u2013 pick a preferred time and we will confirm.</p>"; if(!slots.length){ slots=[]; for(var t=600;t+ (state.service?state.service.mins:30) <= 1020; t+=SLOT_STEP) slots.push(t); } }
    if(!slots.length){ hh += "<p class='dgb-hint'>No times available this day. Please choose another date.</p>"; }
    hh += "<div class='dgb-slots'>";
    slots.forEach(function(t){ var s2=state.time===t?" sel":""; hh += "<button type='button' class='dgb-slot"+s2+"' data-t='"+t+"'>"+fmtTime(t)+"</button>"; });
    hh += "</div>";
    w.innerHTML = hh;
    w.querySelectorAll(".dgb-slot").forEach(function(b){ b.addEventListener("click", function(){ state.time=+b.dataset.t; drawSlots(); var nx=body.querySelector("#dgb-next"); nx.disabled=false; }); });
    var nx=body.querySelector("#dgb-next"); nx.disabled = !(state.date && state.time!=null);
    nx.onclick = function(){ if(state.date && state.time!=null){ state.step=3; render(); } };
  }
}

function renderDetails(body){
  var h = "<div style='max-width:520px'>";
  h += "<div class='dgb-field'><label>Full name *</label><input id='dgb-name' type='text' autocomplete='name' value='"+esc(state.name)+"' placeholder='Jane Doe'></div>";
  h += "<div class='dgb-field'><label>Phone *</label><input id='dgb-phone' type='tel' autocomplete='tel' value='"+esc(state.phone)+"' placeholder='(431) 000-0000'></div>";
  h += "<div class='dgb-field'><label>Email *</label><input id='dgb-email' type='email' autocomplete='email' value='"+esc(state.email)+"' placeholder='jane@example.com'></div>";
  h += "<div class='dgb-field'><label>Notes (optional)</label><textarea id='dgb-notes' rows='3' placeholder='Inspiration, shape, color, allergies...'>"+esc(state.notes)+"</textarea></div>";
  h += "</div><div class='dgb-actions'><button type='button' class='dgb-btn ghost' id='dgb-back'>\u2190 Back</button><button type='button' class='dgb-btn primary' id='dgb-next'>Review \u2192</button></div>";
  body.innerHTML = h;
  body.querySelector("#dgb-back").addEventListener("click", function(){ state.step=2; render(); });
  body.querySelector("#dgb-next").addEventListener("click", function(){
    state.name = body.querySelector("#dgb-name").value.trim();
    state.phone = body.querySelector("#dgb-phone").value.trim();
    state.email = body.querySelector("#dgb-email").value.trim();
    state.notes = body.querySelector("#dgb-notes").value.trim();
    if(!state.name || !state.phone || !state.email){ alert("Please fill in your name, phone and email."); return; }
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.email)){ alert("Please enter a valid email address."); return; }
    state.step=4; render();
  });
}
function renderConfirm(body){
  var s=state.service;
  var h = "<div class='dgb-summary'>";
  h += "<div><span>Service</span><strong>"+esc(s.name)+"</strong></div>";
  h += "<div><span>Date</span><strong>"+fmtDate(state.date)+"</strong></div>";
  h += "<div><span>Time</span><strong>"+fmtTime(state.time)+" \u2013 "+fmtTime(state.time+s.mins)+"</strong></div>";
  h += "<div><span>Name</span><strong>"+esc(state.name)+"</strong></div>";
  h += "<div><span>Phone</span><strong>"+esc(state.phone)+"</strong></div>";
  h += "<div><span>Email</span><strong>"+esc(state.email)+"</strong></div>";
  if(state.notes) h += "<div><span>Notes</span><strong>"+esc(state.notes)+"</strong></div>";
  h += "<div class='dgb-tot'><span>Estimated total</span><span>$"+s.price+"</span></div></div>";
  h += "<p class='dgb-hint'>By confirming, your request is sent to DG Nails. We will personally confirm your appointment by phone or email.</p>";
  h += "<div class='dgb-actions'><button type='button' class='dgb-btn ghost' id='dgb-back'>\u2190 Back</button><button type='button' class='dgb-btn primary' id='dgb-submit'>Confirm booking \u2713</button></div>";
  body.innerHTML = h;
  body.querySelector("#dgb-back").addEventListener("click", function(){ state.step=3; render(); });
  body.querySelector("#dgb-submit").addEventListener("click", submitBooking);
}

// ===== SUBMIT / INTEGRATION =================================
function toISO(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes())+":00"; }
function gcalStamp(d){ return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+"T"+pad(d.getHours())+pad(d.getMinutes())+"00"; }
function buildPayload(){
  var s=state.service; var start=startLocal(state.date, state.time); var end=endLocalISO(state.date, state.time, s.mins);
  return { service:s.name, price:s.price, durationMins:s.mins, startISO:toISO(start), endISO:toISO(end), dateText:fmtDate(state.date), timeText:fmtTime(state.time), name:state.name, phone:state.phone, email:state.email, notes:state.notes, timezone:TZ, source:"dgnail.ca booking widget" };
}
function clientCalLink(){
  var s=state.service; var start=startLocal(state.date, state.time); var end=endLocalISO(state.date, state.time, s.mins);
  var det = "Service: "+s.name+" ($"+s.price+")\nDG Nails, 261-A Vaughan Street, Winnipeg";
  return "https://www.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent("DG Nails \u2013 "+s.name)+"&dates="+gcalStamp(start)+"/"+gcalStamp(end)+"&details="+encodeURIComponent(det)+"&location="+encodeURIComponent("261-A Vaughan Street, Winnipeg, MB R3C 1T8")+"&ctz="+encodeURIComponent(TZ);
}
function whatsappLink(){
  var s=state.service; var msg="Hello DG Nails, I would like to book:\n\u2022 "+s.name+" ($"+s.price+")\n\u2022 "+fmtDate(state.date)+" at "+fmtTime(state.time)+"\n\u2022 Name: "+state.name+"\n\u2022 Phone: "+state.phone+"\n\u2022 Email: "+state.email+(state.notes?"\n\u2022 Notes: "+state.notes:"");
  return "https://wa.me/"+SALON_WHATSAPP+"?text="+encodeURIComponent(msg);
}
function submitBooking(){
  var btn = document.getElementById("dgb-submit"); if(btn){ btn.disabled=true; btn.innerHTML="<span class='dgb-spin'></span>Sending..."; }
  var payload = buildPayload();
  if(ENDPOINT){
    fetch(ENDPOINT, { method:"POST", mode:"no-cors", keepalive:true, headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:JSON.stringify(payload) })
      .then(function(){ state.step=5; render(); })
      .catch(function(){ state.step=5; render(); }); // no-cors style; assume delivered
  } else {
    // Fallback until Apps Script is connected: open WhatsApp prefilled.
    window.open(whatsappLink(), "_blank");
    state.step=5; render();
  }
}
function renderDone(body){
  var h = "<div class='dgb-done'><div class='dgb-check'>\u2713</div><h3>Thank you, "+esc(state.name.split(" ")[0])+"!</h3>";
  h += "<p class='dgb-hint' style='font-size:15px'>Your request for <strong>"+esc(state.service.name)+"</strong> on <strong>"+fmtDate(state.date)+"</strong> at <strong>"+fmtTime(state.time)+"</strong> has been sent. DG Nails will confirm shortly.</p>";
  h += "<div class='dgb-addcal'><a class='dgb-btn primary' href='"+clientCalLink()+"' target='_blank' rel='noopener'>\uD83D\uDCC5 Add to my calendar</a></div>";
  h += "<div class='dgb-actions' style='justify-content:center'><button type='button' class='dgb-btn ghost' id='dgb-restart'>Book another \u21BB</button></div></div>";
  body.innerHTML = h;
  body.querySelector("#dgb-restart").addEventListener("click", function(){ state={ service:null,date:null,time:null,name:"",phone:"",email:"",notes:"",step:1,viewMonth:null }; render(); });
}


// ===== INIT =================================================
function smoothTo(id){ var t=document.getElementById(id); if(t) t.scrollIntoView({ behavior:"smooth", block:"start" }); }
function wireAnchors(){
  var links = document.querySelectorAll('a[href="#reservation"], a[href$="#reservation"]');
  links.forEach(function(a){ a.addEventListener("click", function(e){ e.preventDefault(); smoothTo("reservation"); }); });
}
function init(){
  root = document.getElementById("reservation");
  if(!root){
    root = el("section", { id:"reservation", style:"padding:64px clamp(16px,5vw,40px);scroll-margin-top:90px" });
    var contact = document.getElementById("contact");
    if(contact && contact.parentNode){ contact.parentNode.insertBefore(root, contact); }
    else { document.body.appendChild(root); }
  }
  render();
  wireAnchors();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
