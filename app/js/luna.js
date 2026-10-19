/* Thin wrapper over WebOSServiceBridge (injected by the simulator / TV runtime). */
(function (g) {
  "use strict";

  function hasBridge() {
    return typeof g.WebOSServiceBridge === "function";
  }

  /**
   * Low-level call. onResponse fires for every response (subscriptions fire repeatedly).
   * Returns a handle with cancel().
   */
  function call(uri, params, onResponse) {
    params = params || {};
    if (!hasBridge()) {
      setTimeout(function () {
        onResponse({
          returnValue: false,
          errorCode: "NO_BRIDGE",
          errorText: "WebOSServiceBridge is not available (not running inside the simulator or a TV)",
        });
      }, 0);
      return { cancel: function () {} };
    }
    var bridge = new g.WebOSServiceBridge();
    bridge.onservicecallback = function (msg) {
      var res;
      try {
        res = typeof msg === "string" ? JSON.parse(msg) : msg;
      } catch (e) {
        res = { returnValue: false, errorText: "Unparsable response: " + msg };
      }
      onResponse(res);
    };
    bridge.call(uri, JSON.stringify(params));
    return {
      cancel: function () {
        try {
          bridge.cancel();
        } catch (e) {
          /* already cancelled */
        }
      },
    };
  }

  /**
   * Promise for the first response. Subscriptions are cancelled after the first
   * response unless keepAlive is set. Resolves {_timeout:true} if nothing comes back.
   */
  function request(uri, params, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeout || 4000;
    return new Promise(function (resolve) {
      var done = false;
      var handle;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        if (handle) handle.cancel();
        resolve({ _timeout: true, returnValue: false, errorText: "No response within " + timeoutMs + " ms" });
      }, timeoutMs);
      handle = call(uri, params, function (res) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (params && params.subscribe && !opts.keepAlive) handle.cancel();
        resolve(res);
      });
    });
  }

  g.Luna = { call: call, request: request, hasBridge: hasBridge };
})(window);
