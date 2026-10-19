/* Minimal spatial navigation for 5-way remotes: arrows move focus to the nearest .focusable in that direction. */
(function (g) {
  "use strict";

  var DIRS = { 37: "left", 38: "up", 39: "right", 40: "down" };

  function visible(el) {
    if (el.disabled) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth + 2000;
  }

  function candidates() {
    var modal = document.querySelector(".modal:not(.hidden)");
    var scope = modal ? [modal] : [document.getElementById("sidebar"), document.querySelector(".panel.active")];
    var list = [];
    scope.forEach(function (root) {
      if (!root) return;
      Array.prototype.forEach.call(root.querySelectorAll(".focusable"), function (el) {
        if (el.offsetParent !== null) list.push(el);
      });
    });
    return list;
  }

  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function move(dir) {
    var list = candidates();
    var cur = document.activeElement;
    if (!cur || list.indexOf(cur) < 0) {
      if (list[0]) list[0].focus();
      return true;
    }
    var cr = cur.getBoundingClientRect();
    var c = center(cr);
    var best = null;
    var bestScore = Infinity;
    list.forEach(function (el) {
      if (el === cur || !visible(el)) return;
      var r = el.getBoundingClientRect();
      var p = center(r);
      var dx = p.x - c.x;
      var dy = p.y - c.y;
      var main, cross;
      if (dir === "left") { if (r.right > cr.left + 1) return; main = -dx; cross = Math.abs(dy); }
      if (dir === "right") { if (r.left < cr.right - 1) return; main = dx; cross = Math.abs(dy); }
      if (dir === "up") { if (r.bottom > cr.top + 1) return; main = -dy; cross = Math.abs(dx); }
      if (dir === "down") { if (r.top < cr.bottom - 1) return; main = dy; cross = Math.abs(dx); }
      var score = main + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      best.focus();
      best.scrollIntoView({ block: "nearest", inline: "nearest" });
      return true;
    }
    return false;
  }

  function isTextField(el) {
    return el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|password|email|search|url|tel|number)$/.test(el.type)));
  }

  document.addEventListener("keydown", function (e) {
    var dir = DIRS[e.keyCode];
    if (!dir) return;
    var el = document.activeElement;
    // Let left/right move the caret inside text fields, except at the edges.
    if (isTextField(el) && (dir === "left" || dir === "right")) {
      try {
        var atStart = el.selectionStart === 0 && el.selectionEnd === 0;
        var atEnd = el.selectionStart === el.value.length;
        if ((dir === "left" && !atStart) || (dir === "right" && !atEnd)) return;
      } catch (err) { /* number inputs have no selection API */ }
    }
    if (el && el.tagName === "TEXTAREA" && (dir === "up" || dir === "down")) {
      var before = el.value.slice(0, el.selectionStart);
      var lineBefore = before.split("\n").length;
      var lines = el.value.split("\n").length;
      if ((dir === "up" && lineBefore > 1) || (dir === "down" && lineBefore < lines)) return;
    }
    if (move(dir)) e.preventDefault();
  });

  g.Nav = { move: move, focusFirst: function (root) {
    var el = (root || document).querySelector(".focusable");
    if (el) el.focus();
  } };
})(window);
