/*
 * Test catalog for every luna service the webOS TV Simulator implements,
 * plus the bundled JS service and the injected webOSSystem API.
 *
 * Test fields:
 *   group, name, uri, params (object or fn(ctx))
 *   expectError  - errorCode the call must fail with ("any" = any failure)
 *   unsupported  - with expectError: the simulator intentionally doesn't support it (status N/A)
 *   check(res, ctx) - true, or a string describing what is wrong
 *   save(res, ctx)  - stash values for later steps
 *   knownBug     - text shown when the test fails because of a known simulator defect
 *   skipIf(res)  - returns a reason string to mark SKIP
 *   run(ctx)     - custom async step returning a response object (instead of uri/params)
 */
(function (g) {
  "use strict";

  var APP_ID = (g.webOSSystem && g.webOSSystem.identifier) || "com.lgsi.simcheck";
  var SVC_ID = "com.lgsi.simcheck.service";
  var KIND = APP_ID + ":1";

  var SYS = "luna://com.webos.service.systemservice";
  var MRCU = "luna://com.webos.service.mrcu";
  var DB = "luna://com.palm.db";
  var ACT = "luna://com.palm.activitymanager";
  var SVC = "luna://" + SVC_ID;

  var CONFIG_KEYS = [
    "tv.model.modelname", "tv.model.sysType", "tv.nyx.platformVersion", "tv.nyx.firmwareVersion",
    "tv.nyx.tvBroadcastSystem", "tv.hw.panelResolution", "tv.hw.displayType", "tv.hw.ddrSize",
    "tv.hw.SoCChipType", "tv.model.supportHDR", "tv.config.supportDolbyHDRContents",
    "tv.config.supportDolbyTVATMOS", "tv.model.soundModeType", "tv.rmm.grpCodeName",
    "tv.model.TVBrandName", "tv.model.TVManufacturer", "tv.model.mainboardMaker",
    "wee.platformBizType", "profile.list", "com.webos.service.utp.supportTunerless",
  ];
  var SYSINFO_KEYS = ["modelName", "firmwareVersion", "sdkVersion", "boardType", "UHD", "_3d"];

  function has(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return o != null && k in Object(o) ? o[k] : undefined;
    }, obj) !== undefined;
  }
  function need(res, paths) {
    var missing = paths.filter(function (p) { return !has(res, p); });
    return missing.length ? "missing: " + missing.join(", ") : true;
  }
  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }
  function svcSkip(res) {
    if (res && res.returnValue === false && /Service does not exist/.test(res.errorText || "")) {
      return "JS service not added/active. RCU > Service > pick D:\\simulator\\simcheck\\service, then toggle it on.";
    }
    if (res && res._timeout) return "JS service did not answer (is it toggled on?)";
    return false;
  }

  var DRM_METHODS = ["load", "unload", "isLoaded", "sendDrmMessage", "getRightsError"];
  var BLE_METHODS = ["isEnabled", "startScan", "stopScan", "getState", "pair", "unpair",
    "client/connect", "client/disconnect", "client/getServices", "client/discoverServices",
    "client/setCharacteristicNotification", "client/readCharacteristic", "client/readDescriptor",
    "client/writeCharacteristic", "client/writeDescriptor"];

  var tests = [
    // ---------------------------------------------------------------- System service
    { group: "System Service", name: "time/getSystemTime", uri: SYS + "/time/getSystemTime", params: {},
      check: function (r) { return need(r, ["utc", "localtime.year", "localtime.hour", "timezone", "TZ", "offset"]); } },
    { group: "System Service", name: "time/getSystemTime (subscribe)", uri: SYS + "/time/getSystemTime", params: { subscribe: true },
      check: function (r) { return r.subscribed === true || "subscribed !== true"; } },
    { group: "System Service", name: "legacy alias com.palm.systemservice", uri: "luna://com.palm.systemservice/time/getSystemTime", params: {},
      check: function (r) { return need(r, ["utc"]); } },
    { group: "System Service", name: "unknown method -> error", uri: SYS + "/time/nope", params: {}, expectError: -1 },

    // ---------------------------------------------------------------- Config
    { group: "Config", name: "getConfigs (all 20 TV keys)", uri: "luna://com.webos.service.config/getConfigs", params: { configNames: CONFIG_KEYS },
      check: function (r) {
        if (r.missingConfigs) return "missingConfigs: " + r.missingConfigs.join(", ");
        return Object.keys(r.configs || {}).length === CONFIG_KEYS.length || "configs count mismatch";
      } },
    { group: "Config", name: "getConfigs unknown key -> missingConfigs", uri: "luna://com.webos.service.config/getConfigs", params: { configNames: ["simcheck.bogus"] },
      check: function (r) { return (r.missingConfigs || []).indexOf("simcheck.bogus") >= 0 || "bogus key not reported missing"; } },
    { group: "Config", name: "getConfigs without configNames -> -2", uri: "luna://com.webos.service.config/getConfigs", params: {}, expectError: -2 },

    // ---------------------------------------------------------------- TV system property
    { group: "TV System Property", name: "getSystemInfo (all keys)", uri: "luna://com.webos.service.tv.systemproperty/getSystemInfo", params: { keys: SYSINFO_KEYS },
      check: function (r) { return need(r, SYSINFO_KEYS); } },
    { group: "TV System Property", name: "getSystemInfo (subscribe)", uri: "luna://com.webos.service.tv.systemproperty/getSystemInfo", params: { keys: ["modelName"], subscribe: true },
      check: function (r) { return need(r, ["modelName"]); } },
    { group: "TV System Property", name: "getSystemInfo no keys -> ERROR_06", uri: "luna://com.webos.service.tv.systemproperty/getSystemInfo", params: {}, expectError: "ERROR_06" },
    { group: "TV System Property", name: "getSystemInfo unknown key -> ERROR_06", uri: "luna://com.webos.service.tv.systemproperty/getSystemInfo", params: { keys: ["bogus"] }, expectError: "ERROR_06" },

    // ---------------------------------------------------------------- Settings
    { group: "Settings", name: "localeInfo (keys)", uri: "luna://com.webos.settingsservice/getSystemSettings", params: { keys: ["localeInfo"] },
      check: function (r) { return need(r, ["settings.localeInfo.locales.UI", "settings.localeInfo.timezone"]); } },
    { group: "Settings", name: "localeInfo (key)", uri: "luna://com.webos.settingsservice/getSystemSettings", params: { key: "localeInfo" },
      check: function (r) { return need(r, ["settings.localeInfo.locales.UI"]); } },
    { group: "Settings", name: "localeInfo (subscribe)", uri: "luna://com.webos.settingsservice/getSystemSettings", params: { keys: ["localeInfo"], subscribe: true },
      check: function (r) { return r.subscribed === true || "subscribed !== true"; } },
    { group: "Settings", name: "option: country / smartServiceCountryCode2 / audioGuidance", uri: "luna://com.webos.settingsservice/getSystemSettings",
      params: { category: "option", keys: ["country", "smartServiceCountryCode2", "audioGuidance"] },
      check: function (r) { return need(r, ["settings.country", "settings.smartServiceCountryCode2", "settings.audioGuidance"]); } },
    { group: "Settings", name: "option: single key", uri: "luna://com.webos.settingsservice/getSystemSettings", params: { category: "option", key: "country" },
      check: function (r) { return need(r, ["settings.country"]); } },
    { group: "Settings", name: "caption: captionEnable", uri: "luna://com.webos.settingsservice/getSystemSettings", params: { category: "caption", keys: ["captionEnable"] },
      check: function (r) { return need(r, ["settings.captionEnable"]); } },
    { group: "Settings", name: "option: unknown key -> error", uri: "luna://com.webos.settingsservice/getSystemSettings", params: { category: "option", keys: ["bogus"] }, expectError: "any" },

    // ---------------------------------------------------------------- Device ID
    { group: "Device Unique ID", name: "deviceid/getIDs LGUDID", uri: "luna://com.webos.service.sm/deviceid/getIDs", params: { idType: ["LGUDID"] },
      check: function (r) { return (r.idList && r.idList[0] && r.idList[0].idValue) ? true : "no idValue"; } },
    { group: "Device Unique ID", name: "deviceid/getIDs unsupported type -> ERR.801 entry", uri: "luna://com.webos.service.sm/deviceid/getIDs", params: { idType: ["IMEI"] },
      check: function (r) { return (r.idList && r.idList[0] && r.idList[0].errorCode === "ERR.801") || "expected ERR.801 entry"; } },
    { group: "Device Unique ID", name: "deviceid/getIDs no idType -> ERR.001", uri: "luna://com.webos.service.sm/deviceid/getIDs", params: {}, expectError: "ERR.001" },

    // ---------------------------------------------------------------- Connection manager
    { group: "Connection Manager", name: "getStatus", uri: "luna://com.webos.service.connectionmanager/getStatus", params: {},
      check: function (r) { return need(r, ["isInternetConnectionAvailable", "wired.state", "wifi.state"]); } },
    { group: "Connection Manager", name: "getStatus (subscribe)", uri: "luna://com.webos.service.connectionmanager/getStatus", params: { subscribe: true },
      check: function (r) { return r.subscribed === true || "subscribed !== true"; } },
    { group: "Connection Manager", name: "legacy alias com.palm.connectionmanager", uri: "luna://com.palm.connectionmanager/getStatus", params: {},
      check: function (r) { return need(r, ["isInternetConnectionAvailable"]); } },

    // ---------------------------------------------------------------- Audio
    { group: "Audio", name: "setMuted {muted:false}", uri: "luna://com.webos.audio/setMuted", params: { muted: false },
      knownBug: "audioService.ts switches on `params` instead of `method`, so every audio method returns 'Unknown method'." },
    { group: "Audio", name: "volumeUp", uri: "luna://com.webos.audio/volumeUp", params: {},
      knownBug: "audioService.ts switches on `params` instead of `method`." },
    { group: "Audio", name: "volumeDown", uri: "luna://com.webos.audio/volumeDown", params: {},
      knownBug: "audioService.ts switches on `params` instead of `method`." },

    // ---------------------------------------------------------------- Application manager
    { group: "Application Manager", name: "getAppLoadStatus (self)", uri: "luna://com.webos.applicationManager/getAppLoadStatus", params: { appId: APP_ID },
      check: function (r) { return r.exist === true || "exist !== true"; } },
    { group: "Application Manager", name: "getAppLoadStatus unknown app -> 1", uri: "luna://com.webos.applicationManager/getAppLoadStatus", params: { appId: "com.simcheck.nope" }, expectError: 1 },
    { group: "Application Manager", name: "launch self with params -> webOSRelaunch + new launchParams",
      knownBug: "appLauncher.launchApp() calls switchApp() for a running app: it returns early when the app is foreground (no webOSRelaunch) and never applies the new launchParams.",
      run: function () {
        return new Promise(function (resolve) {
          var nonce = "n" + Date.now();
          var relaunched = false;
          function onRelaunch() { relaunched = true; }
          document.addEventListener("webOSRelaunch", onRelaunch);
          Luna.request("luna://com.webos.applicationManager/launch", { id: APP_ID, params: { nonce: nonce } }).then(function (res) {
            setTimeout(function () {
              document.removeEventListener("webOSRelaunch", onRelaunch);
              var lp = g.webOSSystem ? String(g.webOSSystem.launchParams) : "";
              var paramsOk = lp.indexOf(nonce) >= 0;
              var ok = res.returnValue !== false && relaunched && paramsOk;
              resolve({ returnValue: ok, launchResponse: res, webOSRelaunchFired: relaunched, launchParams: lp,
                errorText: ok ? undefined : (!relaunched ? "no webOSRelaunch" : "") + (!paramsOk ? (relaunched ? "" : ", ") + "launchParams not updated" : "") });
            }, 2500);
          });
        });
      } },
    { group: "Application Manager", name: "launch unknown app -> -101", uri: "luna://com.webos.applicationManager/launch", params: { id: "com.simcheck.nope" }, expectError: -101 },

    // ---------------------------------------------------------------- Magic remote
    { group: "Magic Remote (mrcu)", name: "getAPIVersion", uri: MRCU + "/getAPIVersion", params: {},
      check: function (r) { return need(r, ["version"]); } },
    { group: "Magic Remote (mrcu)", name: "enableDualPairing true", uri: MRCU + "/enableDualPairing", params: { enable: true } },
    { group: "Magic Remote (mrcu)", name: "enableDualPairing false -> 1101", uri: MRCU + "/enableDualPairing", params: { enable: false }, expectError: 1101 },
    { group: "Magic Remote (mrcu)", name: "sensor/getSensorData without subscribe -> 1201", uri: MRCU + "/sensor/getSensorData", params: { callbackInterval: 1 }, expectError: 1201 },
    { group: "Magic Remote (mrcu)", name: "sensor/getSensorData (subscribe)", uri: MRCU + "/sensor/getSensorData", params: { callbackInterval: 1, subscribe: true },
      check: function (r) { return r.subscribed === true || "subscribed !== true"; } },
    { group: "Magic Remote (mrcu)", name: "sensor/resetQuaternion", uri: MRCU + "/sensor/resetQuaternion", params: {} },
    { group: "Magic Remote (mrcu)", name: "sensor2/getSensorState", uri: MRCU + "/sensor2/getSensorState", params: {},
      check: function (r) { return need(r, ["isAlive"]); } },
    { group: "Magic Remote (mrcu)", name: "sensor2/getSensorInterval", uri: MRCU + "/sensor2/getSensorInterval", params: {},
      check: function (r) { return need(r, ["interval", "minInterval", "maxInterval"]); } },
    { group: "Magic Remote (mrcu)", name: "sensor2/setSensorInterval 500", uri: MRCU + "/sensor2/setSensorInterval", params: { interval: 500 } },
    { group: "Magic Remote (mrcu)", name: "sensor2/setSensorInterval 5 -> 1006", uri: MRCU + "/sensor2/setSensorInterval", params: { interval: 5 }, expectError: 1006 },
    { group: "Magic Remote (mrcu)", name: "sensor2/getSensorEventData", uri: MRCU + "/sensor2/getSensorEventData", params: { sensorType: "all", subscribe: true }, expectError: 1003, unsupported: true },
    { group: "Magic Remote (mrcu)", name: "sensor2/cancelSensorDataSubscribe", uri: MRCU + "/sensor2/cancelSensorDataSubscribe", params: {} },
    { group: "Magic Remote (mrcu)", name: "sensor2/resetQuaternion", uri: MRCU + "/sensor2/resetQuaternion", params: {}, expectError: 1003, unsupported: true },

    // ---------------------------------------------------------------- Activity manager
    { group: "Activity Manager", name: "create (replace)", uri: ACT + "/create",
      params: { activity: { name: "simcheck.activity", description: "SimCheck test activity", type: { foreground: true },
        callback: { method: SYS + "/time/getSystemTime", params: {} } }, replace: true, start: false },
      check: function (r) { return typeof r.activityId === "number" || "no numeric activityId"; },
      save: function (r, c) { c.activityId = r.activityId; } },
    { group: "Activity Manager", name: "create duplicate w/o replace -> 2", uri: ACT + "/create",
      params: { activity: { name: "simcheck.activity", description: "dup", type: { foreground: true }, callback: { method: SYS + "/time/getSystemTime", params: {} } } },
      expectError: 2 },
    { group: "Activity Manager", name: "start (by activityId)", uri: ACT + "/start", params: function (c) { return { activityId: c.activityId }; } },
    { group: "Activity Manager", name: "adopt (by name)", uri: ACT + "/adopt", params: { activityName: "simcheck.activity", wait: false } },
    { group: "Activity Manager", name: "complete (no restart = cancel)", uri: ACT + "/complete", params: { activityName: "simcheck.activity" } },
    { group: "Activity Manager", name: "start without id/name -> -10", uri: ACT + "/start", params: {}, expectError: -10 },
    { group: "Activity Manager", name: "cancel unknown -> 2", uri: ACT + "/cancel", params: { activityName: "simcheck.none" }, expectError: 2 },
    { group: "Activity Manager", name: "create+stop+release", run: function () {
        return Luna.request(ACT + "/create", { activity: { name: "simcheck.act2", description: "x", type: { foreground: true },
          callback: { method: SYS + "/time/getSystemTime", params: {} } }, replace: true })
          .then(function () { return Luna.request(ACT + "/stop", { activityName: "simcheck.act2" }); });
      } },

    // ---------------------------------------------------------------- DB8
    { group: "Database (DB8)", name: "putKind", uri: DB + "/putKind",
      params: { id: KIND, owner: APP_ID, indexes: [{ name: "byName", props: [{ name: "name" }] }, { name: "byN", props: [{ name: "n" }] }] } },
    { group: "Database (DB8)", name: "putKind without owner -> -986", uri: DB + "/putKind", params: { id: KIND }, expectError: -986 },
    { group: "Database (DB8)", name: "putKind foreign owner -> -3963", uri: DB + "/putKind", params: { id: "com.other:1", owner: "com.other" }, expectError: -3963 },
    { group: "Database (DB8)", name: "put 2 objects", uri: DB + "/put",
      params: { objects: [{ _kind: KIND, name: "alpha", n: 1 }, { _kind: KIND, name: "beta", n: 2 }] },
      check: function (r) { return (r.results && r.results.length === 2) || "expected 2 results"; },
      save: function (r, c) { c.ids = r.results.map(function (x) { return x.id; }); } },
    { group: "Database (DB8)", name: "put unregistered kind -> -3670", uri: DB + "/put", params: { objects: [{ _kind: "com.simcheck.nokind:1", a: 1 }] }, expectError: -3670 },
    { group: "Database (DB8)", name: "put without _kind -> -3969", uri: DB + "/put", params: { objects: [{ a: 1 }] }, expectError: -3969 },
    { group: "Database (DB8)", name: "get by id", uri: DB + "/get", params: function (c) { return { ids: [c.ids[0]] }; },
      check: function (r) { return (r.results && r.results[0] && r.results[0].name === "alpha") || "alpha not returned"; } },
    { group: "Database (DB8)", name: "find where name = alpha", uri: DB + "/find",
      params: { query: { from: KIND, where: [{ prop: "name", op: "=", val: "alpha" }] } },
      check: function (r) { return (r.results && r.results.length === 1) || "expected 1 result"; } },
    { group: "Database (DB8)", name: "find all", uri: DB + "/find", params: { query: { from: KIND } },
      check: function (r) { return (r.results && r.results.length >= 2) || "expected >= 2 results"; } },
    { group: "Database (DB8)", name: "find with '?' op -> -3978", uri: DB + "/find",
      params: { query: { from: KIND, where: [{ prop: "name", op: "?", val: "al" }] } }, expectError: -3978 },
    { group: "Database (DB8)", name: "merge by id", uri: DB + "/merge", params: function (c) { return { objects: [{ _id: c.ids[0], n: 42 }] }; } },
    { group: "Database (DB8)", name: "get after merge (n = 42)", uri: DB + "/get", params: function (c) { return { ids: [c.ids[0]] }; },
      check: function (r) { return (r.results && r.results[0] && r.results[0].n === 42) || "n was not merged"; } },
    { group: "Database (DB8)", name: "search name ? 'bet'", uri: DB + "/search",
      params: { query: { from: KIND, where: [{ prop: "name", op: "?", val: "bet" }] } },
      check: function (r) { return typeof r.count === "number" || "no count"; } },
    { group: "Database (DB8)", name: "reserveIds (3)", uri: DB + "/reserveIds", params: { count: 3 },
      check: function (r) { return (r.ids && r.ids.length === 3) || "expected 3 ids"; } },
    { group: "Database (DB8)", name: "batch put + find", uri: DB + "/batch",
      params: { operations: [{ method: "put", params: { objects: [{ _kind: KIND, name: "gamma", n: 3 }] } },
        { method: "find", params: { query: { from: KIND } } }] },
      check: function (r) { return need(r, ["responses"]); } },
    { group: "Database (DB8)", name: "watch fires on put", run: function () {
        return new Promise(function (resolve) {
          var first = null;
          var h = Luna.call(DB + "/watch", { query: { from: KIND, where: [{ prop: "name", op: "=", val: "zeta" }] }, subscribe: true }, function (res) {
            if (!first) {
              first = res;
              if (res.returnValue === false) { resolve(res); return; }
              Luna.request(DB + "/put", { objects: [{ _kind: KIND, name: "zeta", n: 9 }] });
              return;
            }
            if (res.fired) { h.cancel(); resolve({ returnValue: true, fired: true, initial: first }); }
          });
          setTimeout(function () { h.cancel(); resolve({ returnValue: false, errorText: "watch did not fire within 3 s", initial: first }); }, 3000);
        });
      } },
    { group: "Database (DB8)", name: "putPermissions", uri: DB + "/putPermissions",
      params: { permissions: [{ type: "db.kind", object: KIND, caller: "com.simcheck.other", operations: { read: "allow" } }] } },
    { group: "Database (DB8)", name: "del by ids", uri: DB + "/del", params: function (c) { return { ids: [c.ids[1]] }; },
      check: function (r) { return (r.results && r.results.length === 1) || "expected 1 deleted"; } },
    { group: "Database (DB8)", name: "del by query", uri: DB + "/del", params: { query: { from: KIND } },
      check: function (r) { return typeof r.count === "number" || "no count"; } },
    { group: "Database (DB8)", name: "delKind", uri: DB + "/delKind", params: { id: KIND } },
    { group: "Database (DB8)", name: "find after delKind -> error", uri: DB + "/find", params: { query: { from: KIND } }, expectError: "any" },
    { group: "Database (DB8)", name: "com.webos.mediadb alias", uri: "luna://com.webos.mediadb/reserveIds", params: { count: 1 },
      check: function (r) { return (r.ids && r.ids.length === 1) || "expected 1 id"; } },

    // ---------------------------------------------------------------- Bundled JS service
    { group: "JS Service", name: "hello", uri: SVC + "/hello", params: { name: "SimCheck" }, skipIf: svcSkip,
      check: function (r) { return r.message === "Hello, SimCheck!" || "unexpected message"; } },
    { group: "JS Service", name: "echo (payload round-trip)", uri: SVC + "/echo", params: { a: 1, b: [true, "x"] }, skipIf: svcSkip,
      check: function (r) { return (r.echo && r.echo.a === 1 && r.echo.b[1] === "x") || "payload changed"; } },
    { group: "JS Service", name: "info/version (category route)", uri: SVC + "/info/version", params: {}, skipIf: svcSkip,
      check: function (r) { return need(r, ["version", "node"]); } },
    { group: "JS Service", name: "ticks subscription (3 updates)", skipIf: svcSkip, run: function () {
        return new Promise(function (resolve) {
          var got = [];
          var h = Luna.call(SVC + "/ticks", { subscribe: true, interval: 300 }, function (res) {
            if (res.returnValue === false) { h.cancel(); resolve(res); return; }
            got.push(res.tick);
            if (got.length >= 3) { h.cancel(); resolve({ returnValue: true, ticks: got }); }
          });
          setTimeout(function () { h.cancel(); resolve({ _timeout: got.length === 0, returnValue: false, errorText: "got " + got.length + " ticks", ticks: got }); }, 4000);
        });
      } },
    { group: "JS Service", name: "service -> luna call (getSystemTime)", uri: SVC + "/lunaTime", params: {}, skipIf: svcSkip,
      check: function (r) { return need(r, ["fromLuna.utc"]); } },
    { group: "JS Service", name: "unregistered method -> -1", uri: SVC + "/nope", params: {}, expectError: -1,
      skipIf: function (r) { return /Service does not exist/.test(r.errorText || "") ? "JS service not added/active" : false; } },
    { group: "JS Service", name: "unknown service -> 'Service does not exist'", uri: "luna://com.simcheck.nosuchservice/x", params: {}, expectError: -1 },
  ];

  // ---------------------------------------------------------------- Key Manager 3 (custom simulator service)
  var KM = "luna://com.webos.service.keymanager3";
  var KM_KEY = "simcheck.key";
  function kmSkip(res) {
    return res && /Service does not exist/.test(res.errorText || "") ? "keymanager3 not registered in this simulator build (restart the main process: type rs)" : false;
  }
  [
    { name: "removeKey (cleanup, may fail)", uri: KM + "/removeKey", params: { name: KM_KEY }, lenient: true },
    { name: "generateKey", uri: KM + "/generateKey", params: { name: KM_KEY, params: { algorithm: "RSA", size: 2048 } } },
    { name: "generateKey duplicate -> -10002", uri: KM + "/generateKey", params: { name: KM_KEY, params: {} }, expectError: -10002 },
    { name: "exportKey", uri: KM + "/exportKey", params: { name: KM_KEY }, check: function (r) { return need(r, ["pubkey"]); } },
    { name: "begin", uri: KM + "/begin", params: { name: KM_KEY },
      check: function (r) { return need(r, ["handle"]); }, save: function (r, c) { c.kmHandle = r.handle; } },
    { name: "update", uri: KM + "/update", params: function (c) { return { handle: c.kmHandle, data: "aGVsbG8=" }; },
      check: function (r) { return r.consumed_size === 5 || "consumed_size should be 5 for 'hello'"; } },
    { name: "finish", uri: KM + "/finish", params: function (c) { return { handle: c.kmHandle }; }, check: function (r) { return need(r, ["output"]); } },
    { name: "update after finish -> -20028", uri: KM + "/update", params: function (c) { return { handle: c.kmHandle, data: "" }; }, expectError: -20028 },
    { name: "begin + abort", run: function () {
        return Luna.request(KM + "/begin", { name: KM_KEY }).then(function (r) {
          return r.returnValue === false ? r : Luna.request(KM + "/abort", { handle: r.handle });
        });
      } },
    { name: "abort unknown handle -> -20028", uri: KM + "/abort", params: { handle: "nope" }, expectError: -20028 },
    { name: "begin unknown key -> -10001", uri: KM + "/begin", params: { name: "simcheck.missing" }, expectError: -10001 },
    { name: "removeKey", uri: KM + "/removeKey", params: { name: KM_KEY } },
    { name: "exportKey removed -> -10001", uri: KM + "/exportKey", params: { name: KM_KEY }, expectError: -10001 },
    { name: "importKey", uri: KM + "/importKey", params: { name: KM_KEY + ".imp", data: "AAAA", params: { algorithm: "AES" } } },
    { name: "importKey duplicate -> -10002", uri: KM + "/importKey", params: { name: KM_KEY + ".imp", data: "AAAA" }, expectError: -10002 },
    { name: "removeKey imported", uri: KM + "/removeKey", params: { name: KM_KEY + ".imp" } },
    { name: "unknown method -> -1", uri: KM + "/nope", params: {}, expectError: -1 },
  ].forEach(function (t) {
    t.group = "Key Manager 3";
    t.skipIf = t.lenient
      ? function (r) { return kmSkip(r) || (r.returnValue === false ? "nothing to clean up" : false); }
      : kmSkip;
    tests.push(t);
  });

  DRM_METHODS.forEach(function (m) {
    tests.push({ group: "DRM", name: m, uri: "luna://com.webos.service.drm/" + m, params: { clientId: "x" }, expectError: 999, unsupported: true });
  });
  BLE_METHODS.forEach(function (m) {
    tests.push({ group: "BLE GATT", name: m, uri: "luna://com.webos.service.blegatt/" + m, params: {}, expectError: -1, unsupported: true });
  });

  // ---------------------------------------------------------------- webOSSystem (sync checks)
  function sys() { return g.webOSSystem; }
  function prop(name, validate) {
    return { group: "webOSSystem API", name: name, sync: function () {
      var s = sys();
      if (!s) return { returnValue: false, errorText: "window.webOSSystem missing" };
      var v;
      try { v = name.split(".").reduce(function (o, k) { return o[k]; }, s); } catch (e) { return { returnValue: false, errorText: String(e) }; }
      var ok = validate ? validate(v) : v !== undefined;
      return { returnValue: ok === true, value: v, errorText: ok === true ? undefined : (typeof ok === "string" ? ok : "invalid value") };
    } };
  }
  function isJson(v) { try { JSON.parse(v); return true; } catch (e) { return "not JSON: " + v; } }
  var syncTests = [
    { group: "webOSSystem API", name: "globals: webOSSystem / PalmSystem / WebOSServiceBridge / PalmServiceBridge / webOSGetResource", sync: function () {
      var miss = ["webOSSystem", "PalmSystem", "WebOSServiceBridge", "PalmServiceBridge", "webOSGetResource"].filter(function (k) { return !g[k]; });
      return { returnValue: miss.length === 0, errorText: miss.length ? "missing: " + miss.join(", ") : undefined };
    } },
    prop("identifier", function (v) { return v === APP_ID || "expected " + APP_ID; }),
    prop("deviceInfo", isJson),
    prop("country", isJson),
    prop("timeZone"),
    prop("locale"),
    prop("localeRegion"),
    prop("tvSystemInfo"),
    prop("highContrast"),
    prop("voiceControl"),
    prop("launchParams"),
    prop("launchReason"),
    prop("activityId", function () { return true; }),
    prop("isActivated", function (v) { return typeof v === "boolean" || "not boolean"; }),
    prop("isKeyboardVisible", function (v) { return typeof v === "boolean" || "not boolean"; }),
    prop("screenOrientation"),
    prop("currentOrientation"),
    prop("cursor.visibility", function (v) { return typeof v === "boolean" || "not boolean"; }),
    prop("isMinimal"),
    { group: "webOSSystem API", name: "getIdentifier()", sync: function () { var v = sys().getIdentifier(); return { returnValue: v === APP_ID, value: v }; } },
    { group: "webOSSystem API", name: "devicePixelRatio()", sync: function () { var v = sys().devicePixelRatio(); return { returnValue: typeof v === "number", value: v }; } },
    { group: "webOSSystem API", name: "cursor.getCursorState()", sync: function () { var v = sys().cursor.getCursorState(); return { returnValue: isJson(v) === true, value: v }; } },
    { group: "webOSSystem API", name: "isWebViewLaunched()", sync: function () { return { returnValue: sys().isWebViewLaunched() === false, value: false }; } },
    { group: "webOSSystem API", name: "arg checks throw TypeError (setWindowProperty())",
      knownBug: "Simulator throws TypeError in the preload, but Electron's contextBridge re-throws it as a plain Error, so apps can't rely on `instanceof TypeError` / e.name.",
      sync: function () {
      try { sys().setWindowProperty(); return { returnValue: false, errorText: "did not throw" }; } catch (e) {
        // Thrown from the preload's isolated world, so `instanceof TypeError` is false across realms.
        return { returnValue: !!e && e.name === "TypeError", value: String(e), errorText: e && e.name !== "TypeError" ? "threw " + e : undefined };
      }
    } },
    { group: "webOSSystem API", name: "no-op stubs callable (stageReady, keepAlive, PmLogString, addBannerMessage...)", sync: function () {
      var s = sys();
      s.stageReady(); s.stagePreparing(); s.containerReady(); s.activate(); s.keepAlive(true); s.PmLogString(); s.PmTrace("x");
      s.addBannerMessage(); s.clearBannerMessages(); s.setKeyMask(["x"]); s.setLoadErrorPolicy("default"); s.enableFullScreenMode(true);
      s.window.setFocus(); s.window.setProperty("a", "b"); s.window.setInputRegion([], []);
      return { returnValue: true };
    } },
  ];

  // ---------------------------------------------------------------- runner
  function verdict(t, res, ctx) {
    if (t.skipIf) {
      var skip = t.skipIf(res);
      if (skip) return { status: "SKIP", reason: skip };
    }
    if (res._timeout) return { status: "FAIL", reason: res.errorText };
    var failed = res.returnValue === false || (res.errorCode !== undefined && res.returnValue !== true);
    if (t.expectError !== undefined) {
      if (!failed) return { status: "FAIL", reason: "expected error " + t.expectError + " but call succeeded" };
      if (t.expectError !== "any" && String(res.errorCode) !== String(t.expectError)) {
        return { status: "FAIL", reason: "expected errorCode " + t.expectError + ", got " + res.errorCode };
      }
      return { status: t.unsupported ? "NA" : "PASS", reason: t.unsupported ? "not supported by simulator (expected)" : (res.errorCode !== undefined ? "error " + res.errorCode : '"' + res.errorText + '"') + " as expected" };
    }
    if (failed) {
      return { status: t.knownBug ? "BUG" : "FAIL", reason: t.knownBug || [res.errorCode, res.errorText].filter(function (x) { return x !== undefined; }).join(": ") || "returnValue false" };
    }
    if (t.check) {
      var c;
      try { c = t.check(res, ctx); } catch (e) { c = "check threw: " + e; }
      if (c !== true) return { status: "FAIL", reason: c || "check failed" };
    }
    if (t.save) {
      try { t.save(res, ctx); } catch (e) { /* later steps will report */ }
    }
    return { status: "PASS", reason: "" };
  }

  function runOne(t, ctx) {
    var started = performance.now();
    var p;
    if (t.sync) {
      p = Promise.resolve().then(function () {
        try { return t.sync(); } catch (e) { return { returnValue: false, errorText: String(e) }; }
      });
    } else if (t.run) {
      p = t.run(ctx);
    } else {
      var params;
      try { params = typeof t.params === "function" ? t.params(ctx) : t.params; } catch (e) {
        return Promise.resolve({ test: t, res: { returnValue: false, errorText: "depends on earlier step: " + e }, status: "FAIL", reason: "depends on an earlier step that failed", ms: 0, params: null });
      }
      p = Luna.request(t.uri, params).then(function (res) { res.__params = params; return res; });
    }
    return p.then(function (res) {
      var params = res.__params; delete res.__params;
      var v = verdict(t, res, ctx);
      return { test: t, res: res, params: params, status: v.status, reason: v.reason, ms: Math.round(performance.now() - started) };
    });
  }

  g.SimTests = {
    APP_ID: APP_ID,
    SVC_ID: SVC_ID,
    all: function () { return syncTests.concat(tests); },
    groups: function () {
      var seen = [];
      syncTests.concat(tests).forEach(function (t) { if (seen.indexOf(t.group) < 0) seen.push(t.group); });
      return seen;
    },
    runOne: runOne,
    wait: wait,
  };
})(window);
