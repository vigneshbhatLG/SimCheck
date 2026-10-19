(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var sys = function () { return window.webOSSystem; };
  var APP_ID = SimTests.APP_ID;

  // ------------------------------------------------------------------ utils
  function ts() {
    var d = new Date();
    return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
  }
  function logTo(el, text, max) {
    var line = ts() + "  " + text + "\n";
    el.textContent = (line + el.textContent).slice(0, max || 20000);
  }
  function j(v) { try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); } }
  function jc(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem("simcheck." + key));
      localStorage.setItem("simcheck." + key, JSON.stringify(val));
    } catch (e) { return undefined; }
  }

  // ------------------------------------------------------------------ checklist
  var CHECKS = [
    { id: "autotests", t: "Auto tests: full run with no FAIL", auto: true },
    { id: "keys-all", t: "All standard RCU keys received", auto: true },
    { id: "key-repeat", t: "Held arrow/media key auto-repeats (500 ms, then every 100 ms)", auto: true },
    { id: "back", t: "Back key (461) handled in-app (disableBackHistoryAPI)", auto: true },
    { id: "launch", t: "webOSLaunch event", auto: true },
    { id: "relaunch", t: "webOSRelaunch event", auto: true, s: "Press Home, then launch SimCheck again from the App List. Self-launch while in the foreground does nothing in the simulator." },
    { id: "bg", t: "App goes to background (isActivated → false)", auto: true },
    { id: "fg", t: "App returns to foreground", auto: true },
    { id: "orientation", t: "screenOrientationChange event", auto: true },
    { id: "vkb-show", t: "Virtual keyboard shown (keyboardStateChange)", auto: true },
    { id: "vkb-hide", t: "Virtual keyboard hidden", auto: true },
    { id: "pointer-move", t: "Pointer movement on the pad", auto: true },
    { id: "pointer-click", t: "Pointer click", auto: true },
    { id: "wheel", t: "Wheel / scroll", auto: true },
    { id: "webosmouse", t: "webOSMouse Enter / Leave", auto: true },
    { id: "cursor", t: "cursorStateChange (cursor visibility)", auto: true },
    { id: "touch", t: "Touch events (RCU Touch mode on)", auto: true },
    { id: "sensor", t: "mrcu sensor stream delivers coordinates", auto: true },
    { id: "net-sub", t: "Connection status subscription response", auto: true },
    { id: "media-play", t: "Video plays", auto: true },
    { id: "media-keys", t: "RCU media keys control playback", auto: true },
    { id: "media-bg-pause", t: "Video auto-paused when app went to background", auto: true },
    { id: "media-fg-resume", t: "Video auto-resumed when app came back", auto: true },
    { id: "m-home", t: "Home key opens the app list / launcher", s: "Handled by the simulator, never sent to the app" },
    { id: "m-mute", t: "Mute key toggles the mute indicator", s: "Handled by the simulator window" },
    { id: "m-power", t: "Power key", s: "Simulator RCU top button" },
    { id: "m-rcu-app", t: "RCU 'App' button launches an app folder" },
    { id: "m-rcu-close", t: "RCU 'Close' closes the foreground app" },
    { id: "m-rcu-inspect", t: "RCU 'Inspect' opens DevTools" },
    { id: "m-rcu-service", t: "RCU 'Service' adds simcheck\\service and it shows in Service List" },
    { id: "m-svc-toggle", t: "Service List: toggling the service off makes JS Service tests SKIP" },
    { id: "m-touch-remote", t: "Touch remote view works with RCU Touch mode" },
    { id: "m-portrait", t: "RCU 'Portrait' rotates the screen (supportPortraitMode)" },
    { id: "m-auto-reload", t: "Action > Auto Reload: editing a file reloads the app" },
    { id: "m-auto-inspector", t: "Action > Auto Inspector opens DevTools on launch" },
    { id: "m-size", t: "Action > Size: the app re-lays out at 640x360 / 1280x720 / 1920x1080" },
    { id: "m-screensaver", t: "Screen saver appears after the idle timeout (default 120 s)", s: "idle", idle: true },
    { id: "m-tv-location", t: "TV Settings: changing country/timezone shows up in the Settings & time tests" },
    { id: "m-tv-network", t: "TV Settings: changing network pushes a connection-status update" },
    { id: "m-applist", t: "Tools > App List shows SimCheck with its icon" },
  ];
  var checked = store("checks") || {};
  function mark(id) {
    if (checked[id]) return;
    checked[id] = true;
    store("checks", checked);
    renderChecks();
    var c = CHECKS.filter(function (x) { return x.id === id; })[0];
    if (c) toast("✓ " + c.t);
  }
  var lastInput = Date.now();
  function renderChecks() {
    var list = $("manual-list");
    var focusedId = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.check;
    list.innerHTML = "";
    var done = 0;
    CHECKS.forEach(function (c) {
      if (checked[c.id]) done++;
      var b = el("button", "mitem focusable" + (checked[c.id] ? " done" : ""));
      b.dataset.check = c.id;
      var sub = c.idle ? "Idle for " + Math.round((Date.now() - lastInput) / 1000) + " s. Leave the remote alone to trigger it." : (c.s || "");
      b.innerHTML = '<span class="box">' + (checked[c.id] ? "✓" : "") + "</span><span>" + esc(c.t) +
        (sub ? "<small>" + esc(sub) + "</small>" : "") + (c.auto ? '<span class="auto">auto-detected</span>' : "") + "</span>";
      b.addEventListener("click", function () {
        checked[c.id] = !checked[c.id];
        store("checks", checked);
        renderChecks();
      });
      list.appendChild(b);
      if (focusedId === c.id) b.focus();
    });
    $("manual-count").textContent = done + " / " + CHECKS.length + " done";
  }

  // ------------------------------------------------------------------ tabs
  var currentTab = "dashboard";
  function showTab(name) {
    if (!$("tab-" + name)) return;
    currentTab = name;
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.toggle("active", p.id === "tab-" + name); });
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    if (name === "system") renderSysProps();
    if (name === "manual") renderChecks();
  }
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { showTab(t.dataset.tab); });
    t.addEventListener("focus", function () { showTab(t.dataset.tab); });
  });

  // ------------------------------------------------------------------ auto tests
  var results = {}; // index -> result
  var allTests = SimTests.all();
  var running = false;

  function renderResults() {
    var box = $("results");
    var focusedIdx = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.idx;
    box.innerHTML = "";
    var counts = { PASS: 0, FAIL: 0, BUG: 0, NA: 0, SKIP: 0 };
    var group = null;
    var groupHead;
    var gc;
    allTests.forEach(function (t, i) {
      if (t.group !== group) {
        group = t.group;
        groupHead = el("div", "group-h", "<span>" + esc(group) + "</span><span></span>");
        box.appendChild(groupHead);
        gc = { pass: 0, total: 0, head: groupHead };
      }
      var r = results[i];
      var st = r ? r.status : "—";
      if (r && counts[st] !== undefined) counts[st]++;
      gc.total++;
      if (r && (st === "PASS" || st === "NA")) gc.pass++;
      gc.head.lastChild.textContent = gc.pass + "/" + gc.total;
      var row = el("button", "res focusable");
      row.dataset.idx = i;
      row.innerHTML = '<span class="st ' + st + '">' + st + "</span><span>" + esc(t.name) + '</span><span class="ms">' +
        (r && r.ms !== undefined ? r.ms + " ms" : "") + "</span>" + (r && r.reason ? '<span class="why">' + esc(r.reason) + "</span>" : "");
      row.addEventListener("click", function () { showDetail(i); });
      row.addEventListener("focus", function () { showDetail(i); });
      box.appendChild(row);
      if (String(i) === focusedIdx) row.focus();
    });
    var total = allTests.length;
    var ran = Object.keys(results).length;
    $("summary").innerHTML = ["PASS", "FAIL", "BUG", "NA", "SKIP"].map(function (k) {
      return '<span class="chip ' + k + '">' + k + " " + counts[k] + "</span>";
    }).join("") + '<span class="chip">' + ran + "/" + total + "</span>";
    return counts;
  }

  function showDetail(i) {
    var t = allTests[i];
    var r = results[i];
    $("detail-title").textContent = t.group + " › " + t.name;
    var body = "";
    if (t.uri) body += "URI\n" + t.uri + "\n\n";
    if (r && r.params) body += "Params\n" + j(r.params) + "\n\n";
    else if (t.params && typeof t.params !== "function") body += "Params\n" + j(t.params) + "\n\n";
    if (t.expectError !== undefined) body += "Expected: error " + t.expectError + (t.unsupported ? " (unsupported in simulator)" : "") + "\n\n";
    if (t.knownBug) body += "Known simulator bug: " + t.knownBug + "\n\n";
    body += r ? "Status: " + r.status + (r.reason ? " — " + r.reason : "") + "\n\nResponse\n" + j(r.res) : "Not run yet. Press Enter to run this test only.";
    $("detail-body").textContent = body;
  }

  function runList(indexes) {
    if (running) return Promise.resolve();
    running = true;
    var ctx = {};
    var chain = Promise.resolve();
    indexes.forEach(function (i) {
      chain = chain.then(function () {
        results[i] = { status: "RUN" };
        renderResults();
        return SimTests.runOne(allTests[i], ctx).then(function (r) {
          results[i] = r;
        });
      });
    });
    return chain.then(function () {
      running = false;
      var c = renderResults();
      toast("Done: " + c.PASS + " pass, " + c.FAIL + " fail, " + c.BUG + " simulator bugs, " + c.NA + " n/a, " + c.SKIP + " skipped");
      if (indexes.length === allTests.length && c.FAIL === 0) mark("autotests");
    });
  }
  function runAll() {
    results = {};
    runList(allTests.map(function (_, i) { return i; }));
  }
  function runFailed() {
    // Stateful groups (DB, activities) depend on earlier steps, so re-run any group that had a failure in full.
    var badGroups = {};
    allTests.forEach(function (t, i) { if (results[i] && results[i].status === "FAIL") badGroups[t.group] = true; });
    var idx = [];
    allTests.forEach(function (t, i) { if (badGroups[t.group]) idx.push(i); });
    if (!idx.length) { toast("Nothing failed"); return; }
    runList(idx);
  }
  function report() {
    var out = allTests.map(function (t, i) {
      var r = results[i] || {};
      return { group: t.group, name: t.name, uri: t.uri, status: r.status || "NOT RUN", reason: r.reason, response: r.res };
    });
    var text = j({ app: APP_ID, at: new Date().toISOString(), userAgent: navigator.userAgent, results: out });
    console.log("[SimCheck report]", text);
    $("detail-title").textContent = "Report (also printed to the DevTools console)";
    $("detail-body").textContent = text;
    try { navigator.clipboard.writeText(text).then(function () { toast("Report copied to clipboard"); }, function () {}); } catch (e) { /* no clipboard */ }
  }
  $("run-all").addEventListener("click", runAll);
  $("run-failed").addEventListener("click", runFailed);
  $("copy-report").addEventListener("click", report);
  $("results").addEventListener("keydown", function (e) {
    if (e.keyCode === 13 && e.target.dataset.idx !== undefined) {
      var i = Number(e.target.dataset.idx);
      var t = allTests[i];
      // Run the whole group for stateful groups so dependencies exist.
      var stateful = /Database|Activity/.test(t.group);
      var idx = stateful ? allTests.map(function (x, k) { return x.group === t.group ? k : -1; }).filter(function (k) { return k >= 0; }) : [i];
      runList(idx).then(function () { showDetail(i); });
      e.preventDefault();
    }
  });

  // ------------------------------------------------------------------ remote keys
  var KEYS = [
    ["1", 49], ["2", 50], ["3", 51], ["4", 52], ["5", 53], ["6", 54], ["7", 55], ["8", 56], ["9", 57], ["0", 48],
    ["Left", 37], ["Up", 38], ["Right", 39], ["Down", 40], ["Enter", 13], ["Back", 461],
    ["Red", 403], ["Green", 404], ["Yellow", 405], ["Blue", 406],
    ["Play", 415], ["Pause", 19], ["Stop", 413], ["Rewind", 412], ["FastFwd", 417],
  ];
  var keyState = {};
  var keyTiles = {};
  function makeTile(name, code, extra) {
    var t = el("div", "key" + (extra ? " extra" : ""));
    t.innerHTML = '<div class="n">' + esc(name) + '</div><div class="c">keyCode ' + code + '</div><div class="f"><span>down</span><span>press</span><span>up</span><span>repeat</span></div><div class="c k"></div>';
    $("key-grid").appendChild(t);
    keyTiles[code] = t;
    keyState[code] = keyState[code] || { down: 0, press: 0, up: 0, repeat: false, holdCount: 0, name: name };
    return t;
  }
  function resetKeys() {
    $("key-grid").innerHTML = "";
    keyState = {};
    keyTiles = {};
    KEYS.forEach(function (k) { makeTile(k[0], k[1]); });
    $("key-log").textContent = "";
    updateKeyCount();
  }
  function updateKeyCount() {
    var seen = KEYS.filter(function (k) { var s = keyState[k[1]]; return s && s.down > 0; }).length;
    $("keys-seen").textContent = seen + " / " + KEYS.length + " keys";
    $("keys-seen").classList.toggle("on", seen === KEYS.length);
    if (seen === KEYS.length) mark("keys-all");
  }
  function recordKey(e) {
    var code = e.keyCode;
    if (!keyTiles[code]) makeTile(e.key || "?", code, true);
    var s = keyState[code];
    var tile = keyTiles[code];
    var flags = tile.querySelectorAll(".f span");
    if (e.type === "keydown") {
      s.down++;
      s.holdCount++;
      if (s.holdCount > 1 || e.repeat) { s.repeat = true; flags[3].classList.add("on"); if (code !== 13) mark("key-repeat"); }
      flags[0].classList.add("on");
    } else if (e.type === "keypress") {
      s.press++;
      flags[1].classList.add("on");
    } else if (e.type === "keyup") {
      s.up++;
      s.holdCount = 0;
      flags[2].classList.add("on");
    }
    tile.classList.add("seen", "flash");
    setTimeout(function () { tile.classList.remove("flash"); }, 150);
    tile.querySelector(".k").textContent = 'key "' + e.key + '" code "' + e.code + '"';
    if (e.type !== "keydown" || s.holdCount <= 2) {
      logTo($("key-log"), e.type.padEnd(8) + " keyCode=" + code + ' key="' + e.key + '" code="' + e.code + '" which=' + e.which + (e.repeat ? " repeat" : ""), 12000);
    }
    updateKeyCount();
  }
  $("keys-reset").addEventListener("click", resetKeys);

  // ------------------------------------------------------------------ global key handling
  function inTextField() {
    var a = document.activeElement;
    return a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.type !== "button"));
  }
  function exitDialog(open) {
    $("exit-dialog").classList.toggle("hidden", !open);
    if (open) $("exit-no").focus();
    else Nav.focusFirst(document.querySelector(".panel.active"));
  }
  ["keydown", "keypress", "keyup"].forEach(function (type) {
    window.addEventListener(type, function (e) {
      lastInput = Date.now();
      recordKey(e);
    }, true);
  });
  window.addEventListener("keydown", function (e) {
    var code = e.keyCode;
    var first = keyState[code] && keyState[code].holdCount === 1;
    if (code === 461) {
      e.preventDefault();
      if (!first) return;
      mark("back");
      if (!$("exit-dialog").classList.contains("hidden")) { exitDialog(false); return; }
      if (currentTab === "rcu") { toast("Back captured. Press Left to reach the menu."); return; }
      if (inTextField()) { document.activeElement.blur(); return; }
      if (currentTab !== "dashboard") { showTab("dashboard"); document.querySelector(".tab.active").focus(); return; }
      exitDialog(true);
      return;
    }
    if (!first) return;
    if (code >= 49 && code <= 57 && !inTextField() && currentTab !== "rcu") {
      var tab = document.querySelectorAll(".tab")[code - 49];
      if (tab) { showTab(tab.dataset.tab); tab.focus(); }
      return;
    }
    if (currentTab === "dashboard") {
      if (code === 403) runAll();
      if (code === 404) runFailed();
      if (code === 405) report();
    }
    if (currentTab === "media") mediaKey(code);
  });
  $("exit-yes").addEventListener("click", function () {
    if (sys() && sys().platformBack) sys().platformBack();
    else window.close();
  });
  $("exit-no").addEventListener("click", function () { exitDialog(false); });

  // ------------------------------------------------------------------ pointer & touch
  var pstat = { move: 0, click: 0, wheel: 0, pointer: 0, touch: 0, x: "-", y: "-", sensor: 0, cursor: "?" };
  function renderPStats() {
    $("pointer-stats").innerHTML = [["x, y", pstat.x + ", " + pstat.y], ["moves", pstat.move], ["clicks", pstat.click], ["wheel", pstat.wheel],
      ["pointer evts", pstat.pointer], ["touch evts", pstat.touch], ["sensor msgs", pstat.sensor], ["cursor visible", pstat.cursor]]
      .map(function (p) { return '<div class="stat">' + p[0] + "<b>" + esc(p[1]) + "</b></div>"; }).join("");
  }
  var pad = $("pad");
  var lastMoveLog = 0;
  function plog(s) { logTo($("pointer-log"), s, 12000); }
  pad.addEventListener("mousemove", function (e) {
    pstat.move++;
    var r = pad.getBoundingClientRect();
    pstat.x = Math.round(e.clientX); pstat.y = Math.round(e.clientY);
    $("pad-dot").style.display = "block";
    $("pad-dot").style.left = (e.clientX - r.left) + "px";
    $("pad-dot").style.top = (e.clientY - r.top) + "px";
    if (pstat.move > 5) mark("pointer-move");
    if (Date.now() - lastMoveLog > 250) { lastMoveLog = Date.now(); plog("mousemove " + pstat.x + "," + pstat.y + " buttons=" + e.buttons); }
    renderPStats();
  });
  ["mousedown", "mouseup", "click", "dblclick", "contextmenu"].forEach(function (t) {
    pad.addEventListener(t, function (e) {
      if (t === "click") { pstat.click++; mark("pointer-click"); }
      plog(t + " @" + e.clientX + "," + e.clientY + " button=" + e.button);
      renderPStats();
    });
  });
  pad.addEventListener("wheel", function (e) {
    pstat.wheel++; mark("wheel");
    plog("wheel dx=" + e.deltaX + " dy=" + e.deltaY + " mode=" + e.deltaMode);
    renderPStats();
  }, { passive: true });
  ["pointerdown", "pointerup", "pointermove", "pointercancel"].forEach(function (t) {
    pad.addEventListener(t, function (e) {
      pstat.pointer++;
      if (t !== "pointermove") plog(t + " type=" + e.pointerType + " id=" + e.pointerId + " @" + Math.round(e.clientX) + "," + Math.round(e.clientY));
      renderPStats();
    });
  });
  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(function (t) {
    pad.addEventListener(t, function (e) {
      pstat.touch++; mark("touch");
      var tt = e.changedTouches[0];
      if (t !== "touchmove" || pstat.touch % 10 === 0) plog(t + " touches=" + e.touches.length + (tt ? " @" + Math.round(tt.clientX) + "," + Math.round(tt.clientY) : ""));
      renderPStats();
    }, { passive: true });
  });
  var sensorHandle = null;
  $("sensor-toggle").addEventListener("click", function () {
    var b = $("sensor-toggle");
    if (sensorHandle) {
      sensorHandle.cancel(); sensorHandle = null;
      b.textContent = "Start mrcu sensor stream"; b.classList.remove("on");
      plog("sensor: cancelled");
      return;
    }
    b.textContent = "Stop mrcu sensor stream"; b.classList.add("on");
    sensorHandle = Luna.call("luna://com.webos.service.mrcu/sensor/getSensorData", { callbackInterval: 1, subscribe: true }, function (res) {
      if (res.coordinate) {
        pstat.sensor++; mark("sensor");
        if (pstat.sensor % 5 === 1) plog("sensor coordinate " + jc(res.coordinate));
        renderPStats();
      } else {
        plog("sensor: " + jc(res));
      }
    });
    plog("sensor: subscribed. Move the mouse over the app.");
  });
  $("cursor-center").addEventListener("click", function () {
    var ok = sys() && sys().setCursor("default", Math.round(innerWidth / 2), Math.round(innerHeight / 2));
    plog("setCursor(default, center) returned " + ok);
  });

  // ------------------------------------------------------------------ keyboard / vkb
  var INPUTS = [["text", "Name"], ["password", "Password"], ["email", "Email"], ["number", "Number"], ["tel", "Phone"], ["url", "URL"], ["search", "Search"]];
  INPUTS.forEach(function (p) {
    var l = el("label", "", esc(p[1]) + ' <span style="color:var(--na)">type="' + p[0] + '"</span>');
    var i = el("input", "focusable");
    i.type = p[0];
    i.placeholder = p[0] === "number" || p[0] === "tel" ? "VKB: number layout" : "VKB: default layout";
    i.addEventListener("focus", function () { logTo($("input-log"), "focus  " + p[0]); });
    i.addEventListener("blur", function () { logTo($("input-log"), "blur   " + p[0]); });
    i.addEventListener("input", function () { logTo($("input-log"), "input  " + p[0] + ' value="' + (p[0] === "password" ? "•".repeat(i.value.length) : i.value) + '"'); });
    i.addEventListener("change", function () { logTo($("input-log"), "change " + p[0]); });
    l.appendChild(i);
    $("input-form").appendChild(l);
  });
  function onKbd(e) {
    var vis = e.detail && e.detail.visibility !== undefined ? e.detail.visibility : e.visibility;
    $("kbd-state").textContent = "keyboard " + (vis ? "visible" : "hidden") + " · isKeyboardVisible=" + (sys() && sys().isKeyboardVisible);
    $("kbd-state").classList.toggle("on", !!vis);
    logTo($("input-log"), "keyboardStateChange visibility=" + vis);
    mark(vis ? "vkb-show" : "vkb-hide");
  }

  // ------------------------------------------------------------------ system & window
  var PROPS = ["identifier", "deviceInfo", "country", "timeZone", "locale", "localeRegion", "tvSystemInfo", "highContrast", "voiceControl",
    "launchParams", "launchReason", "activityId", "isActivated", "isKeyboardVisible", "screenOrientation", "currentOrientation",
    "cursor.visibility", "isMinimal", "phoneRegion", "timeFormat"];
  function renderSysProps() {
    var tb = $("sys-props");
    var s = sys();
    if (!s) { tb.innerHTML = "<tr><td>webOSSystem</td><td>not available</td></tr>"; return; }
    tb.innerHTML = PROPS.map(function (p) {
      var v;
      try { v = p.split(".").reduce(function (o, k) { return o[k]; }, s); } catch (e) { v = "ERR " + e; }
      if (typeof v === "string" && /^[{[]/.test(v)) { try { v = jc(JSON.parse(v)); } catch (e) { /* keep raw */ } }
      return "<tr><td>" + p + "</td><td>" + esc(typeof v === "object" ? jc(v) : String(v)) + "</td></tr>";
    }).join("") + "<tr><td>window</td><td>" + innerWidth + "×" + innerHeight + " @" + devicePixelRatio + "</td></tr>" +
      "<tr><td>document.hidden</td><td>" + document.hidden + "</td></tr>" +
      "<tr><td>navigator.userAgent</td><td>" + esc(navigator.userAgent) + "</td></tr>";
  }
  $("sys-refresh").addEventListener("click", renderSysProps);
  document.querySelectorAll("[data-orn]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r;
      try { r = sys().setWindowOrientation(b.dataset.orn); } catch (e) { r = String(e); }
      toast("setWindowOrientation(" + b.dataset.orn + ") → " + r);
      setTimeout(renderSysProps, 600);
    });
  });
  $("relaunch").addEventListener("click", function () {
    var params = { from: "simcheck", at: Date.now() };
    Luna.request("luna://com.webos.applicationManager/launch", { id: APP_ID, params: params }).then(function (r) {
      toast("launch self → " + jc(r));
      evlog("applicationManager/launch(self) → " + jc(r));
    });
  });
  $("deactivate").addEventListener("click", function () { sys().deactivate(); });
  $("platform-back").addEventListener("click", function () { sys().platformBack(); });
  $("close-app").addEventListener("click", function () { sys().close(); });
  var subs = {};
  function toggleSub(btnId, key, uri, label) {
    var b = $(btnId);
    b.addEventListener("click", function () {
      if (subs[key]) {
        subs[key].cancel(); delete subs[key];
        b.classList.remove("on"); b.textContent = "Subscribe " + label;
        logTo($("sub-out"), label + ": cancelled");
        return;
      }
      b.classList.add("on"); b.textContent = "Cancel " + label;
      var n = 0;
      subs[key] = Luna.call(uri, { subscribe: true }, function (res) {
        n++;
        if (key === "net") mark("net-sub");
        logTo($("sub-out"), label + " #" + n + " " + jc(res));
      });
    });
  }
  toggleSub("sub-net", "net", "luna://com.webos.service.connectionmanager/getStatus", "connection status");
  toggleSub("sub-time", "time", "luna://com.webos.service.systemservice/time/getSystemTime", "system time");

  // ------------------------------------------------------------------ lifecycle events
  var EVENTS = ["webOSLaunch", "webOSRelaunch", "visibilitychange", "webOSMouse", "keyboardStateChange", "cursorStateChange",
    "screenOrientationChange", "focus", "blur", "resize", "online", "offline"];
  var evSeen = {};
  function evlog(s) { logTo($("event-log"), s, 40000); }
  function renderEvChips() {
    $("event-chips").innerHTML = EVENTS.map(function (n) { return '<span class="chip' + (evSeen[n] ? " on" : "") + '">' + n + (evSeen[n] ? " ×" + evSeen[n] : "") + "</span>"; }).join("");
  }
  function onEvent(name, e, where) {
    evSeen[name] = (evSeen[name] || 0) + 1;
    var d = e.detail !== undefined && e.detail !== null ? " detail=" + jc(e.detail) : "";
    if (name === "visibilitychange") d += " hidden=" + document.hidden + " state=" + document.visibilityState;
    if (name === "resize") d += " " + innerWidth + "×" + innerHeight;
    if (name === "cursorStateChange" || name === "keyboardStateChange") { if (e.visibility !== undefined) d += " visibility=" + e.visibility; }
    evlog(name + " (" + where + ")" + d);
    renderEvChips();
    switch (name) {
      case "webOSLaunch": mark("launch"); break;
      case "webOSRelaunch":
        mark("relaunch");
        evlog("  launchParams now: " + (sys() && jc(sys().launchParams)));
        toast("webOSRelaunch · launchParams " + (sys() && jc(sys().launchParams)));
        break;
      case "webOSMouse": mark("webosmouse"); break;
      case "cursorStateChange": mark("cursor"); pstat.cursor = String(e.detail ? e.detail.visibility : e.visibility); renderPStats(); plog("cursorStateChange " + pstat.cursor); break;
      case "screenOrientationChange": mark("orientation"); break;
      case "visibilitychange": if (document.hidden) onBackground("visibilitychange"); else onForeground("visibilitychange"); break;
    }
  }
  EVENTS.forEach(function (name) {
    // webOS events are dispatched on document; the simulator also flattens some onto window.
    document.addEventListener(name, function (e) { if (name === "keyboardStateChange") onKbd(e); onEvent(name, e, "document"); });
    if (name === "focus" || name === "blur" || name === "resize" || name === "online" || name === "offline") {
      window.addEventListener(name, function (e) { if (e.target === window) onEvent(name, e, "window"); });
    }
  });
  $("events-clear").addEventListener("click", function () { $("event-log").textContent = ""; evSeen = {}; renderEvChips(); });

  // isActivated is updated on go-foreground/go-background even when no DOM event fires, so poll it too.
  var wasActive = sys() ? sys().isActivated : true;
  var inBackground = false;
  function onBackground(src) {
    if (inBackground) return;
    inBackground = true;
    mark("bg");
    evlog("→ BACKGROUND (" + src + ")");
    mediaWasPlaying = !video.paused;
    setTimeout(function () { if (mediaWasPlaying && video.paused) { mark("media-bg-pause"); mlog("auto-paused in background ✓"); } }, 800);
  }
  function onForeground(src) {
    if (!inBackground) return;
    inBackground = false;
    mark("fg");
    evlog("→ FOREGROUND (" + src + ")");
    setTimeout(function () { if (mediaWasPlaying && !video.paused) { mark("media-fg-resume"); mlog("auto-resumed in foreground ✓"); } }, 1200);
  }
  setInterval(function () {
    var s = sys();
    if (s) {
      var a = s.isActivated;
      if (a !== wasActive) {
        evlog("isActivated: " + wasActive + " → " + a);
        wasActive = a;
        if (a) onForeground("isActivated"); else onBackground("isActivated");
      }
    }
    if (currentTab === "manual" && !(document.activeElement && document.activeElement.dataset.check === "m-screensaver")) {
      var idleItem = document.querySelector('[data-check="m-screensaver"] small');
      if (idleItem) idleItem.textContent = "Idle for " + Math.round((Date.now() - lastInput) / 1000) + " s. Leave the remote alone to trigger it.";
    }
  }, 500);
  ["mousemove", "mousedown", "wheel", "touchstart"].forEach(function (t) { window.addEventListener(t, function () { lastInput = Date.now(); }, { capture: true, passive: true }); });

  // ------------------------------------------------------------------ media
  var video = $("video");
  var mediaWasPlaying = false;
  function mlog(s) { logTo($("media-log"), s, 12000); }
  function loadVideo() { video.src = $("media-url").value; video.load(); mlog("load " + video.src); }
  $("media-load").addEventListener("click", loadVideo);
  $("media-play").addEventListener("click", function () { video.play().catch(function (e) { mlog("play() rejected: " + e); }); });
  $("media-pause").addEventListener("click", function () { video.pause(); });
  var lastTU = 0;
  ["loadstart", "loadedmetadata", "canplay", "play", "playing", "pause", "seeking", "seeked", "ended", "error", "waiting", "stalled", "timeupdate"].forEach(function (t) {
    video.addEventListener(t, function () {
      if (t === "timeupdate") { if (Date.now() - lastTU < 2000) return; lastTU = Date.now(); }
      if (t === "playing") mark("media-play");
      mlog(t + (t === "error" && video.error ? " code=" + video.error.code : "") + " t=" + video.currentTime.toFixed(1) + (isFinite(video.duration) ? "/" + video.duration.toFixed(1) : ""));
    });
  });
  function mediaKey(code) {
    if (!video.src) loadVideo();
    var map = {
      415: function () { video.play().catch(function (e) { mlog("play() rejected: " + e); }); return "Play"; },
      19: function () { video.pause(); return "Pause"; },
      413: function () { video.pause(); video.currentTime = 0; return "Stop"; },
      412: function () { video.currentTime = Math.max(0, video.currentTime - 10); return "Rewind −10 s"; },
      417: function () { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); return "FastFwd +10 s"; },
    };
    if (map[code]) { var what = map[code](); mlog("RCU " + what); mark("media-keys"); }
  }

  // ------------------------------------------------------------------ luna console
  var conHandle = null;
  function conRun(subscribe) {
    var uri = $("con-uri").value.trim();
    var params;
    try { params = JSON.parse($("con-params").value || "{}"); } catch (e) { logTo($("con-out"), "Params are not valid JSON: " + e.message); return; }
    if (subscribe) params.subscribe = true;
    if (conHandle) conHandle.cancel();
    var n = 0;
    logTo($("con-out"), "→ " + uri + " " + jc(params));
    conHandle = Luna.call(uri, params, function (res) { n++; logTo($("con-out"), "← #" + n + " " + j(res), 40000); });
  }
  $("con-call").addEventListener("click", function () { conRun(false); });
  $("con-sub").addEventListener("click", function () { conRun(true); });
  $("con-cancel").addEventListener("click", function () { if (conHandle) { conHandle.cancel(); conHandle = null; logTo($("con-out"), "cancelled"); } });
  var PRESETS = [
    ["time", "luna://com.webos.service.systemservice/time/getSystemTime", {}],
    ["configs", "luna://com.webos.service.config/getConfigs", { configNames: ["tv.model.modelname", "tv.hw.panelResolution", "tv.hw.SoCChipType"] }],
    ["sysinfo", "luna://com.webos.service.tv.systemproperty/getSystemInfo", { keys: ["modelName", "firmwareVersion", "sdkVersion", "boardType"] }],
    ["locale", "luna://com.webos.settingsservice/getSystemSettings", { keys: ["localeInfo"] }],
    ["country", "luna://com.webos.settingsservice/getSystemSettings", { category: "option", keys: ["country", "smartServiceCountryCode2"] }],
    ["LGUDID", "luna://com.webos.service.sm/deviceid/getIDs", { idType: ["LGUDID"] }],
    ["network", "luna://com.webos.service.connectionmanager/getStatus", {}],
    ["mute", "luna://com.webos.audio/setMuted", { muted: true }],
    ["appStatus", "luna://com.webos.applicationManager/getAppLoadStatus", { appId: APP_ID }],
    ["sensor", "luna://com.webos.service.mrcu/sensor/getSensorData", { callbackInterval: 1, subscribe: true }],
    ["sensor2", "luna://com.webos.service.mrcu/sensor2/getSensorInterval", {}],
    ["db find", "luna://com.palm.db/find", { query: { from: APP_ID + ":1" } }],
    ["activity", "luna://com.palm.activitymanager/create", { activity: { name: "console.act", description: "c", type: { foreground: true }, callback: { method: "luna://com.webos.service.systemservice/time/getSystemTime", params: {} } }, replace: true, start: true }],
    ["drm", "luna://com.webos.service.drm/isLoaded", { clientId: "x" }],
    ["ble", "luna://com.webos.service.blegatt/getState", {}],
    ["km generate", "luna://com.webos.service.keymanager3/generateKey", { name: "k1", params: { algorithm: "RSA", size: 2048 } }],
    ["km export", "luna://com.webos.service.keymanager3/exportKey", { name: "k1" }],
    ["km begin", "luna://com.webos.service.keymanager3/begin", { name: "k1" }],
    ["km update", "luna://com.webos.service.keymanager3/update", { handle: "PASTE_HANDLE", data: "aGVsbG8=" }],
    ["km finish", "luna://com.webos.service.keymanager3/finish", { handle: "PASTE_HANDLE" }],
    ["km remove", "luna://com.webos.service.keymanager3/removeKey", { name: "k1" }],
    ["svc hello","luna://" + SimTests.SVC_ID + "/hello", { name: "console" }],
    ["svc ticks", "luna://" + SimTests.SVC_ID + "/ticks", { subscribe: true, interval: 1000 }],
  ];
  PRESETS.forEach(function (p) {
    var b = el("button", "btn focusable", esc(p[0]));
    b.addEventListener("click", function () { $("con-uri").value = p[1]; $("con-params").value = j(p[2]); });
    $("presets").appendChild(b);
  });

  // ------------------------------------------------------------------ boot
  var s = sys();
  var model = "";
  try { model = JSON.parse(s.deviceInfo).modelName; } catch (e) { /* not in simulator */ }
  $("env").textContent = "app  " + APP_ID + "\nbridge  " + (Luna.hasBridge() ? "yes" : "NO") + "\nmodel  " + (model || "?") +
    "\nlaunchParams  " + (s ? jc(s.launchParams) : "-");
  resetKeys();
  renderResults();
  renderPStats();
  renderEvChips();
  renderChecks();
  showTab("dashboard");
  $("run-all").focus();
  if (s && s.stageReady) s.stageReady();
  evlog("app loaded · isActivated=" + (s && s.isActivated) + " · launchReason=" + (s && s.launchReason));
  if (!Luna.hasBridge()) toast("WebOSServiceBridge missing: launch this app from the webOS TV Simulator");
})();
