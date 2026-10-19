# SimCheck: webOS TV Simulator coverage app

SimCheck is a webOS TV web app with a bundled JS service. It exercises everything the webOS TV Simulator implements: every luna service and method, the `webOSSystem` API, all RCU keys, pointer, touch, VKB, orientation, lifecycle events and media. It also flags the places where the simulator behaves differently from a real TV.

```
simcheck/
  app/       launch this folder in the simulator (RCU > App)
  service/   add this folder in the simulator (RCU > Service), then switch it on in the Service List
```

## Running it

1. Start the simulator, press **App** on the RCU and pick `simcheck` (or `simcheck/app`; both have an `appinfo.json`).
   The folder picker only shows folders, so you won't see `appinfo.json` in it. That's normal.
   For a packaged build you can also run: `webOS_TV_26_Simulator_x.y.z.exe D:\simulator\simcheck\app "{\"from\":\"cli\"}"`
2. Press **Service** on the RCU, pick `simcheck/service`, and make sure it is switched on in Tools > Service List.
3. On the **Auto Tests** tab, press **RED** (or "Run all").
4. Work through the other tabs. The **Checklist** tab ticks items as the app detects them, and lists the simulator-only features you tick by hand.

> When you launch the simulator from a VS Code terminal, unset `ELECTRON_RUN_AS_NODE` first. Otherwise the exe runs as plain Node and exits immediately with code 9.

## Remote keys

| Key | Action |
|---|---|
| Arrows / Enter | Move focus / activate |
| 1–9 | Jump to a tab (not on the Remote Keys tab) |
| RED / GREEN / YELLOW | Run all / re-run failed groups / show the JSON report (Auto Tests tab) |
| Play, Pause, Stop, ◀◀, ▶▶ | Control the video (Media tab) |
| Back | Return to Auto Tests, then the exit dialog (`platformBack()`) |

## Result statuses

| Status | Meaning |
|---|---|
| PASS | Behaves as the simulator source and webOS docs describe. Negative tests pass when they return the expected error code. |
| FAIL | Unexpected result. Click the row to see the request and response. |
| BUG | Reproduces a known simulator defect (see below). |
| N/A | The simulator deliberately does not support it (DRM, BLE GATT, sensor2 event data). |
| SKIP | Needs the JS service, which is not added or not switched on. |

## Coverage (126 automated tests)

- **luna services:** systemservice (time), config (all 20 keys), tv.systemproperty, settingsservice (localeInfo, option, caption), sm/deviceid, connectionmanager, audio, applicationManager, mrcu (sensor and sensor2), activitymanager (create, start, adopt, complete, stop, cancel), palm.db/mediadb (putKind, put, get, find, merge, search, watch, batch, reserveIds, putPermissions, del, delKind, plus the error paths), drm, blegatt. Both `com.palm.*` and `com.webos.*` service name aliases are covered.
- **JS service:** request/response, payload round-trip, category route (`info/version`), subscription with cancel, service-to-luna call, unknown method and unknown service.
- **webOSSystem:** every property, the method stubs, argument checks, and the `PalmSystem` / `PalmServiceBridge` / `webOSGetResource` aliases.
- **Interactive tabs:** 25 RCU keys (keydown, keypress, keyup and auto-repeat), mouse, wheel, pointer, touch, `webOSMouse`, `cursorStateChange`, the mrcu sensor stream, `setCursor`, 7 input types against the VKB, `setWindowOrientation`, relaunch, deactivate/close, live network and time subscriptions, foreground/background detection, and media pause/resume when the app is backgrounded.

## Simulator bugs SimCheck found

1. `src/main/service/lunaService/audioService.ts` uses `switch (params)` where it should use `switch (method)`. As a result `setMuted`, `volumeUp` and `volumeDown` always return "Unknown method".
2. `appLauncher.launchApp()` on an app that is already running calls `switchApp()`. That returns early for the foreground app, so no `webOSRelaunch` fires, and it never applies the new `launchParams` in either case.
3. Argument-count errors from `webOSSystem.*` are thrown as `TypeError` in the preload, but contextBridge re-throws them as a plain `Error`.
4. Not covered by a test because it needs a network toggle: `connectionManager.getStatus` changes the shared `defaultConnectionStatus` object in place. After the network has been "connected" once, it never reports "disconnected" again.
5. Not covered by a test: nothing ever emits `settings-updated`, so `getSystemSettings` subscriptions never receive updates.
