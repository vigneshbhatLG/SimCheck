// SimCheck JS service. Add it in the simulator with RCU > "Service" and pick this folder.
const Service = require("webos-service");

const service = new Service("com.lgsi.simcheck.service");
const tickTimers = {};

service.register("hello", (message) => {
  const name = (message.payload && message.payload.name) || "world";
  message.respond({ returnValue: true, message: `Hello, ${name}!` });
});

service.register("echo", (message) => {
  message.respond({ returnValue: true, echo: message.payload, sender: message.sender, category: message.category });
});

// Category route: luna://com.lgsi.simcheck.service/info/version
service.register("info/version", (message) => {
  message.respond({ returnValue: true, version: "1.0.0", node: process.version, pid: process.pid });
});

// Subscription: pushes { tick: n } every `interval` ms until the caller cancels.
service.register(
  "ticks",
  (message) => {
    if (!message.isSubscription) {
      message.respond({ returnValue: false, errorCode: -2, errorText: "subscribe:true is required" });
      return;
    }
    const interval = Math.max(100, Number(message.payload.interval) || 1000);
    let tick = 0;
    message.respond({ returnValue: true, subscribed: true, tick });
    tickTimers[message.uniqueToken] = setInterval(() => {
      tick += 1;
      message.respond({ returnValue: true, tick });
    }, interval);
  },
  (message) => {
    clearInterval(tickTimers[message.uniqueToken]);
    delete tickTimers[message.uniqueToken];
    message.cancel({ returnValue: true, cancelled: true });
  },
);

// Service -> luna call, proving JS services can reach built-in luna services.
service.register("lunaTime", (message) => {
  service.call("luna://com.webos.service.systemservice/time/getSystemTime", {}, (res) => {
    message.respond({ returnValue: true, fromLuna: res.payload });
  });
});
