(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Zooming = factory());
}(this, (function () { 'use strict';

// webkit prefix
var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : '';
var pressDelay = 200;

var options = {
  defaultZoomable: 'img[data-action="zoom"]',
  enableGrab: true,
  transitionDuration: '.4s',
  transitionTimingFunction: 'cubic-bezier(.4,0,0,1)',
  bgColor: '#fff',
  bgOpacity: 1,
  scaleBase: 1.0,
  scaleExtra: 0.5,
  scrollThreshold: 40,
  onOpen: null,
  onClose: null,
  onGrab: null,
  onRelease: null,
  onBeforeOpen: null,
  onBeforeClose: null,
  onBeforeGrab: null,
  onBeforeRelease: null
};

var sniffTransition = function sniffTransition(el) {
  var ret = {};
  var trans = ['webkitTransition', 'transition', 'mozTransition'];
  var tform = ['webkitTransform', 'transform', 'mozTransform'];
  var end = {
    'transition': 'transitionend',
    'mozTransition': 'transitionend',
    'webkitTransition': 'webkitTransitionEnd'
  };

  trans.some(function (prop) {
    if (el.style[prop] !== undefined) {
      ret.transitionProp = prop;
      ret.transEndEvent = end[prop];
      return true;
    }
  });

  tform.some(function (prop) {
    if (el.style[prop] !== undefined) {
      ret.transformProp = prop;
      ret.transformCssProp = prop.replace(/(.*)Transform/, '-$1-transform');
      return true;
    }
  });

  return ret;
};

var checkTrans = function checkTrans(transitionProp, transformProp) {
  return function setStyle(el, styles, remember) {
    var value = void 0;
    if (styles.transition) {
      value = styles.transition;
      delete styles.transition;
      styles[transitionProp] = value;
    }
    if (styles.transform) {
      value = styles.transform;
      delete styles.transform;
      styles[transformProp] = value;
    }

    var s = el.style;
    var original = {};

    for (var key in styles) {
      if (remember) original[key] = s[key] || '';
      s[key] = styles[key];
    }

    return original;
  };
};

var _this = undefined;

// elements
var body = document.body;
var overlay = document.createElement('div');
var target = void 0;
var parent = void 0;

// state
var shown = false;
var lock = false;
var press = false;
var _grab = false;
var lastScrollPosition = null;

// style
var originalStyles = void 0;
var openStyles = void 0;
var translate = void 0;
var scale = void 0;

var srcThumbnail = void 0;
var imgRect = void 0;
var pressTimer = void 0;

var trans = sniffTransition(overlay);
var transformCssProp = trans.transformCssProp;
var transEndEvent = trans.transEndEvent;
var setStyleHelper = checkTrans(trans.transitionProp, trans.transformProp);

var api$1 = {

  listen: function listen(el) {
    if (typeof el === 'string') {
      document.querySelectorAll(el).forEach(function (e) {
        return api$1.listen(e);
      });
      return _this;
    }

    el.style.cursor = prefix + 'zoom-in';

    el.addEventListener('click', function (e) {
      e.preventDefault();

      if (shown) api$1.close();else api$1.open(el);
    });

    return _this;
  },

  config: function config(opts) {
    if (!opts) return options;

    for (var key in opts) {
      options[key] = opts[key];
    }

    setStyle$1(overlay, {
      backgroundColor: options.bgColor,
      transition: 'opacity\n        ' + options.transitionDuration + '\n        ' + options.transitionTimingFunction
    });

    return _this;
  },

  open: function open(el) {
    var cb = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : options.onOpen;

    if (shown || lock || _grab) return;

    target = typeof el === 'string' ? document.querySelector(el) : el;

    if (target.tagName !== 'IMG') return;

    // onBeforeOpen event
    if (options.onBeforeOpen) options.onBeforeOpen(target);

    shown = true;
    lock = true;
    parent = target.parentNode;

    var img = new Image();
    img.onload = imgOnload();
    img.src = target.getAttribute('src');

    parent.appendChild(overlay);
    setTimeout(function () {
      return overlay.style.opacity = options.bgOpacity;
    }, 30);

    document.addEventListener('scroll', scrollHandler);
    document.addEventListener('keydown', keydownHandler);

    target.addEventListener(transEndEvent, function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);

      if (options.enableGrab) addGrabListeners(target);

      lock = false;

      if (cb) cb(target);
    });

    return _this;
  },

  close: function close() {
    var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : options.onClose;

    if (!shown || lock || _grab) return;
    lock = true;

    // onBeforeClose event
    if (options.onBeforeClose) options.onBeforeClose(target);
    overlay.style.opacity = 0;
    target.style.transform = '';

    document.removeEventListener('scroll', scrollHandler);
    document.removeEventListener('keydown', keydownHandler);

    target.addEventListener(transEndEvent, function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);

      if (options.enableGrab) removeGrabListeners(target);

      shown = false;
      lock = false;
      _grab = false;

      setStyle$1(target, originalStyles);
      parent.removeChild(overlay);

      // downgrade source if possible
      if (target.hasAttribute('data-original')) target.setAttribute('src', srcThumbnail);

      if (cb) cb(target);
    });

    return _this;
  },

  grab: function grab(x, y, start) {
    var cb = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : options.onGrab;

    if (!shown || lock) return;
    _grab = true;

    // onBeforeGrab event
    if (options.onBeforeGrab) options.onBeforeGrab(target);

    var dx = x - window.innerWidth / 2,
        dy = y - window.innerHeight / 2;

    var transform = target.style.transform.replace(/translate3d\(.*?\)/i, 'translate3d(' + (translate.x + dx) + 'px, ' + (translate.y + dy) + 'px, 0)').replace(/scale\([0-9|\.]*\)/i, 'scale(' + (scale + options.scaleExtra) + ')');

    setStyle$1(target, {
      cursor: prefix + ' grabbing',
      transition: transformCssProp + ' ' + (start ? options.transitionDuration + ' ' + options.transitionTimingFunction : 'ease'),
      transform: transform
    });

    target.addEventListener(transEndEvent, function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);
      if (cb) cb(target);
    });
  },

  release: function release() {
    var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : options.onRelease;

    if (!shown || lock || !_grab) return;

    // onBeforeRelease event
    if (options.onBeforeRelease) options.onBeforeRelease(target);

    setStyle$1(target, openStyles);

    target.addEventListener(transEndEvent, function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);
      _grab = false;
      if (cb) cb(target);
    });

    return _this;
  }
};

function setStyle$1(el, styles, remember) {
  return setStyleHelper(el, styles, remember);
}

function imgOnload() {
  imgRect = target.getBoundingClientRect();

  // upgrade source if possible
  if (target.hasAttribute('data-original')) {
    srcThumbnail = target.getAttribute('src');

    setStyle$1(target, {
      width: imgRect.width + 'px',
      height: imgRect.height + 'px'
    });

    target.setAttribute('src', target.getAttribute('data-original'));
  }

  // force layout update
  target.offsetWidth;

  openStyles = {
    position: 'relative',
    zIndex: 999,
    cursor: '' + prefix + (options.enableGrab ? 'grab' : 'zoom-out'),
    transition: transformCssProp + '\n      ' + options.transitionDuration + '\n      ' + options.transitionTimingFunction,
    transform: calculateTransform()
  };

  // trigger transition
  originalStyles = setStyle$1(target, openStyles, true);
}

function init() {
  setStyle$1(overlay, {
    zIndex: 998,
    background: options.bgColor,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    transition: 'opacity\n      ' + options.transitionDuration + '\n      ' + options.transitionTimingFunction
  });

  overlay.addEventListener('click', api$1.close);
}

function calculateTransform() {
  var imgHalfWidth = imgRect.width / 2,
      imgHalfHeight = imgRect.height / 2;


  var imgCenter = {
    x: imgRect.left + imgHalfWidth,
    y: imgRect.top + imgHalfHeight
  };

  var windowCenter = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };

  // The distance between image edge and window edge
  var distFromImageEdgeToWindowEdge = {
    x: windowCenter.x - imgHalfWidth,
    y: windowCenter.y - imgHalfHeight
  };

  var scaleHorizontally = distFromImageEdgeToWindowEdge.x / imgHalfWidth;
  var scaleVertically = distFromImageEdgeToWindowEdge.y / imgHalfHeight;

  // The vector to translate image to the window center
  translate = {
    x: windowCenter.x - imgCenter.x,
    y: windowCenter.y - imgCenter.y
  };

  // The additional scale is based on the smaller value of
  // scaling horizontally and scaling vertically
  scale = options.scaleBase + Math.min(scaleHorizontally, scaleVertically);

  return 'translate3d(' + translate.x + 'px, ' + translate.y + 'px, 0) scale(' + scale + ')';
}

function addGrabListeners(el) {
  el.addEventListener('mousedown', mousedownHandler);
  el.addEventListener('mousemove', mousemoveHandler);
  el.addEventListener('mouseup', mouseupHandler);
  el.addEventListener('touchstart', touchstartHandler);
  el.addEventListener('touchmove', touchmoveHandler);
  el.addEventListener('touchend', touchendHandler);
}

function removeGrabListeners(el) {
  el.removeEventListener('mousedown', mousedownHandler);
  el.removeEventListener('mousemove', mousemoveHandler);
  el.removeEventListener('mouseup', mouseupHandler);
  el.removeEventListener('touchstart', touchstartHandler);
  el.removeEventListener('touchmove', touchmoveHandler);
  el.removeEventListener('touchend', touchendHandler);
}

// listeners -----------------------------------------------------------------

function scrollHandler() {
  var scrollTop = window.pageYOffset || (document.documentElement || body.parentNode || body).scrollTop;

  if (lastScrollPosition === null) lastScrollPosition = scrollTop;

  var deltaY = lastScrollPosition - scrollTop;

  if (Math.abs(deltaY) >= options.scrollThreshold) {
    lastScrollPosition = null;
    api$1.close();
  }
}

function keydownHandler(e) {
  var code = e.key || e.code;
  if (code === 'Escape' || e.keyCode === 27) api$1.close();
}

function mousedownHandler(e) {
  e.preventDefault();

  pressTimer = setTimeout(function () {
    press = true;
    api$1.grab(e.clientX, e.clientY, true);
  }, pressDelay);
}

function mousemoveHandler(e) {
  if (press) api$1.grab(e.clientX, e.clientY);
}

function mouseupHandler() {
  clearTimeout(pressTimer);
  press = false;
  api$1.release();
}

function touchstartHandler(e) {
  e.preventDefault();

  pressTimer = setTimeout(function () {
    press = true;
    var touch = e.touches[0];
    api$1.grab(touch.clientX, touch.clientY, true);
  }, pressDelay);
}

function touchmoveHandler(e) {
  if (press) {
    var touch = e.touches[0];
    api$1.grab(touch.clientX, touch.clientY);
  }
}

function touchendHandler() {
  clearTimeout(pressTimer);
  press = false;
  if (_grab) api$1.release();else api$1.close();
}

init();

document.addEventListener('DOMContentLoaded', function () {
  api$1.listen(options.defaultZoomable);
});

{
  // Enable LiveReload
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1"></' + 'script>');
}

return api$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyB3ZWJraXQgcHJlZml4XG5jb25zdCBwcmVmaXggPSAnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlID8gJy13ZWJraXQtJyA6ICcnXG5jb25zdCBwcmVzc0RlbGF5ID0gMjAwXG5cbmNvbnN0IG9wdGlvbnMgPSB7XG4gIGRlZmF1bHRab29tYWJsZTogJ2ltZ1tkYXRhLWFjdGlvbj1cInpvb21cIl0nLFxuICBlbmFibGVHcmFiOiB0cnVlLFxuICB0cmFuc2l0aW9uRHVyYXRpb246ICcuNHMnLFxuICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb246ICdjdWJpYy1iZXppZXIoLjQsMCwwLDEpJyxcbiAgYmdDb2xvcjogJyNmZmYnLFxuICBiZ09wYWNpdHk6IDEsXG4gIHNjYWxlQmFzZTogMS4wLFxuICBzY2FsZUV4dHJhOiAwLjUsXG4gIHNjcm9sbFRocmVzaG9sZDogNDAsXG4gIG9uT3BlbjogbnVsbCxcbiAgb25DbG9zZTogbnVsbCxcbiAgb25HcmFiOiBudWxsLFxuICBvblJlbGVhc2U6IG51bGwsXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcbiAgb25CZWZvcmVHcmFiOiBudWxsLFxuICBvbkJlZm9yZVJlbGVhc2U6IG51bGxcbn1cblxuY29uc3Qgc25pZmZUcmFuc2l0aW9uID0gKGVsKSA9PiB7XG4gIGxldCByZXQgICAgID0ge31cbiAgY29uc3QgdHJhbnMgPSBbJ3dlYmtpdFRyYW5zaXRpb24nLCAndHJhbnNpdGlvbicsICdtb3pUcmFuc2l0aW9uJ11cbiAgY29uc3QgdGZvcm0gPSBbJ3dlYmtpdFRyYW5zZm9ybScsICd0cmFuc2Zvcm0nLCAnbW96VHJhbnNmb3JtJ11cbiAgY29uc3QgZW5kICAgPSB7XG4gICAgJ3RyYW5zaXRpb24nICAgICAgIDogJ3RyYW5zaXRpb25lbmQnLFxuICAgICdtb3pUcmFuc2l0aW9uJyAgICA6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAnd2Via2l0VHJhbnNpdGlvbicgOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgfVxuXG4gIHRyYW5zLnNvbWUocHJvcCA9PiB7XG4gICAgaWYgKGVsLnN0eWxlW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldC50cmFuc2l0aW9uUHJvcCA9IHByb3BcbiAgICAgIHJldC50cmFuc0VuZEV2ZW50ID0gZW5kW3Byb3BdXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfSlcblxuICB0Zm9ybS5zb21lKHByb3AgPT4ge1xuICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXQudHJhbnNmb3JtUHJvcCA9IHByb3BcbiAgICAgIHJldC50cmFuc2Zvcm1Dc3NQcm9wID0gcHJvcC5yZXBsYWNlKC8oLiopVHJhbnNmb3JtLywgJy0kMS10cmFuc2Zvcm0nKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJldFxufVxuXG5jb25zdCBjaGVja1RyYW5zID0gKHRyYW5zaXRpb25Qcm9wLCB0cmFuc2Zvcm1Qcm9wKSA9PiB7XG4gIHJldHVybiBmdW5jdGlvbiBzZXRTdHlsZShlbCwgc3R5bGVzLCByZW1lbWJlcikge1xuICAgIGxldCB2YWx1ZVxuICAgIGlmIChzdHlsZXMudHJhbnNpdGlvbikge1xuICAgICAgdmFsdWUgPSBzdHlsZXMudHJhbnNpdGlvblxuICAgICAgZGVsZXRlIHN0eWxlcy50cmFuc2l0aW9uXG4gICAgICBzdHlsZXNbdHJhbnNpdGlvblByb3BdID0gdmFsdWVcbiAgICB9XG4gICAgaWYgKHN0eWxlcy50cmFuc2Zvcm0pIHtcbiAgICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgICAgZGVsZXRlIHN0eWxlcy50cmFuc2Zvcm1cbiAgICAgIHN0eWxlc1t0cmFuc2Zvcm1Qcm9wXSA9IHZhbHVlXG4gICAgfVxuXG4gICAgbGV0IHMgPSBlbC5zdHlsZVxuICAgIGxldCBvcmlnaW5hbCA9IHt9XG5cbiAgICBmb3IgKGxldCBrZXkgaW4gc3R5bGVzKSB7XG4gICAgICBpZiAocmVtZW1iZXIpIG9yaWdpbmFsW2tleV0gPSBzW2tleV0gfHwgJydcbiAgICAgIHNba2V5XSA9IHN0eWxlc1trZXldXG4gICAgfVxuXG4gICAgcmV0dXJuIG9yaWdpbmFsXG4gIH1cbn1cblxuZXhwb3J0IHsgcHJlZml4LCBwcmVzc0RlbGF5LCBvcHRpb25zLCBzbmlmZlRyYW5zaXRpb24sIGNoZWNrVHJhbnMgfVxuIiwiaW1wb3J0IHsgcHJlZml4LCBwcmVzc0RlbGF5LCBvcHRpb25zLCBzbmlmZlRyYW5zaXRpb24sIGNoZWNrVHJhbnMgfSBmcm9tICcuL2hlbHBlcnMnXG5cbi8vIGVsZW1lbnRzXG5jb25zdCBib2R5ID0gZG9jdW1lbnQuYm9keVxuY29uc3Qgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5sZXQgdGFyZ2V0XG5sZXQgcGFyZW50XG5cbi8vIHN0YXRlXG5sZXQgc2hvd24gPSBmYWxzZVxubGV0IGxvY2sgID0gZmFsc2VcbmxldCBwcmVzcyA9IGZhbHNlXG5sZXQgZ3JhYiA9IGZhbHNlXG5sZXQgbGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuXG4vLyBzdHlsZVxubGV0IG9yaWdpbmFsU3R5bGVzXG5sZXQgb3BlblN0eWxlc1xubGV0IHRyYW5zbGF0ZVxubGV0IHNjYWxlXG5cbmxldCBzcmNUaHVtYm5haWxcbmxldCBpbWdSZWN0XG5sZXQgcHJlc3NUaW1lclxuXG5jb25zdCB0cmFucyA9IHNuaWZmVHJhbnNpdGlvbihvdmVybGF5KVxuY29uc3QgdHJhbnNmb3JtQ3NzUHJvcCA9IHRyYW5zLnRyYW5zZm9ybUNzc1Byb3BcbmNvbnN0IHRyYW5zRW5kRXZlbnQgPSB0cmFucy50cmFuc0VuZEV2ZW50XG5jb25zdCBzZXRTdHlsZUhlbHBlciA9IGNoZWNrVHJhbnModHJhbnMudHJhbnNpdGlvblByb3AsIHRyYW5zLnRyYW5zZm9ybVByb3ApXG5cblxuY29uc3QgYXBpID0ge1xuXG4gIGxpc3RlbjogKGVsKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoZWwpLmZvckVhY2goZSA9PiBhcGkubGlzdGVuKGUpKVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICBlbC5zdHlsZS5jdXJzb3IgPSBgJHtwcmVmaXh9em9vbS1pbmBcblxuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgICBpZiAoc2hvd24pIGFwaS5jbG9zZSgpXG4gICAgICBlbHNlIGFwaS5vcGVuKGVsKVxuICAgIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9LFxuXG4gIGNvbmZpZzogKG9wdHMpID0+IHtcbiAgICBpZiAoIW9wdHMpIHJldHVybiBvcHRpb25zXG5cbiAgICBmb3IgKGxldCBrZXkgaW4gb3B0cykge1xuICAgICAgb3B0aW9uc1trZXldID0gb3B0c1trZXldXG4gICAgfVxuXG4gICAgc2V0U3R5bGUob3ZlcmxheSwge1xuICAgICAgYmFja2dyb3VuZENvbG9yOiBvcHRpb25zLmJnQ29sb3IsXG4gICAgICB0cmFuc2l0aW9uOiBgb3BhY2l0eVxuICAgICAgICAke29wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9ufVxuICAgICAgICAke29wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9ufWBcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfSxcblxuICBvcGVuOiAoZWwsIGNiID0gb3B0aW9ucy5vbk9wZW4pID0+IHtcbiAgICBpZiAoc2hvd24gfHwgbG9jayB8fCBncmFiKSByZXR1cm5cblxuICAgIHRhcmdldCA9IHR5cGVvZiBlbCA9PT0gJ3N0cmluZydcbiAgICAgID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbClcbiAgICAgIDogZWxcblxuICAgIGlmICh0YXJnZXQudGFnTmFtZSAhPT0gJ0lNRycpIHJldHVyblxuXG4gICAgLy8gb25CZWZvcmVPcGVuIGV2ZW50XG4gICAgaWYgKG9wdGlvbnMub25CZWZvcmVPcGVuKSBvcHRpb25zLm9uQmVmb3JlT3Blbih0YXJnZXQpXG5cbiAgICBzaG93biA9IHRydWVcbiAgICBsb2NrID0gdHJ1ZVxuICAgIHBhcmVudCA9IHRhcmdldC5wYXJlbnROb2RlXG5cbiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKVxuICAgIGltZy5vbmxvYWQgPSBpbWdPbmxvYWQoKVxuICAgIGltZy5zcmMgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdzcmMnKVxuXG4gICAgcGFyZW50LmFwcGVuZENoaWxkKG92ZXJsYXkpXG4gICAgc2V0VGltZW91dCgoKSA9PiBvdmVybGF5LnN0eWxlLm9wYWNpdHkgPSBvcHRpb25zLmJnT3BhY2l0eSwgMzApXG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCBzY3JvbGxIYW5kbGVyKVxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBrZXlkb3duSGFuZGxlcilcblxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRyYW5zRW5kRXZlbnQsIGZ1bmN0aW9uIG9uRW5kICgpIHtcbiAgICAgIHRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuXG4gICAgICBpZiAob3B0aW9ucy5lbmFibGVHcmFiKSBhZGRHcmFiTGlzdGVuZXJzKHRhcmdldClcblxuICAgICAgbG9jayA9IGZhbHNlXG5cbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9LFxuXG4gIGNsb3NlOiAoY2IgPSBvcHRpb25zLm9uQ2xvc2UpID0+IHtcbiAgICBpZiAoIXNob3duIHx8IGxvY2sgfHwgZ3JhYikgcmV0dXJuXG4gICAgbG9jayA9IHRydWVcblxuICAgIC8vIG9uQmVmb3JlQ2xvc2UgZXZlbnRcbiAgICBpZiAob3B0aW9ucy5vbkJlZm9yZUNsb3NlKSBvcHRpb25zLm9uQmVmb3JlQ2xvc2UodGFyZ2V0KVxuICAgIG92ZXJsYXkuc3R5bGUub3BhY2l0eSA9IDBcbiAgICB0YXJnZXQuc3R5bGUudHJhbnNmb3JtID0gJydcblxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIHNjcm9sbEhhbmRsZXIpXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGtleWRvd25IYW5kbGVyKVxuXG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgZnVuY3Rpb24gb25FbmQgKCkge1xuICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgb25FbmQpXG5cbiAgICAgIGlmIChvcHRpb25zLmVuYWJsZUdyYWIpIHJlbW92ZUdyYWJMaXN0ZW5lcnModGFyZ2V0KVxuXG4gICAgICBzaG93biA9IGZhbHNlXG4gICAgICBsb2NrID0gZmFsc2VcbiAgICAgIGdyYWIgPSBmYWxzZVxuXG4gICAgICBzZXRTdHlsZSh0YXJnZXQsIG9yaWdpbmFsU3R5bGVzKVxuICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKG92ZXJsYXkpXG5cbiAgICAgIC8vIGRvd25ncmFkZSBzb3VyY2UgaWYgcG9zc2libGVcbiAgICAgIGlmICh0YXJnZXQuaGFzQXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsJykpIHRhcmdldC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHNyY1RodW1ibmFpbClcblxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH0sXG5cbiAgZ3JhYjogZnVuY3Rpb24oeCwgeSwgc3RhcnQsIGNiID0gb3B0aW9ucy5vbkdyYWIpIHtcbiAgICBpZiAoIXNob3duIHx8IGxvY2spIHJldHVyblxuICAgIGdyYWIgPSB0cnVlXG5cbiAgICAvLyBvbkJlZm9yZUdyYWIgZXZlbnRcbiAgICBpZiAob3B0aW9ucy5vbkJlZm9yZUdyYWIpIG9wdGlvbnMub25CZWZvcmVHcmFiKHRhcmdldClcblxuICAgIGNvbnN0IFtkeCwgZHldID0gW3ggLSB3aW5kb3cuaW5uZXJXaWR0aCAvIDIsIHkgLSB3aW5kb3cuaW5uZXJIZWlnaHQgLyAyXVxuICAgIGNvbnN0IHRyYW5zZm9ybSA9IHRhcmdldC5zdHlsZS50cmFuc2Zvcm1cbiAgICAgIC5yZXBsYWNlKFxuICAgICAgICAvdHJhbnNsYXRlM2RcXCguKj9cXCkvaSxcbiAgICAgICAgYHRyYW5zbGF0ZTNkKCR7dHJhbnNsYXRlLnggKyBkeH1weCwgJHt0cmFuc2xhdGUueSArIGR5fXB4LCAwKWApXG4gICAgICAucmVwbGFjZShcbiAgICAgICAgL3NjYWxlXFwoWzAtOXxcXC5dKlxcKS9pLFxuICAgICAgICBgc2NhbGUoJHtzY2FsZSArIG9wdGlvbnMuc2NhbGVFeHRyYX0pYClcblxuICAgIHNldFN0eWxlKHRhcmdldCwge1xuICAgICAgY3Vyc29yOiBgJHtwcmVmaXh9IGdyYWJiaW5nYCxcbiAgICAgIHRyYW5zaXRpb246IGAke3RyYW5zZm9ybUNzc1Byb3B9ICR7c3RhcnRcbiAgICAgICAgPyBvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArIG9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgICAgIDogJ2Vhc2UnfWAsXG4gICAgICB0cmFuc2Zvcm06IHRyYW5zZm9ybVxuICAgIH0pXG5cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBmdW5jdGlvbiBvbkVuZCAoKSB7XG4gICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH0pXG4gIH0sXG5cbiAgcmVsZWFzZTogKGNiID0gb3B0aW9ucy5vblJlbGVhc2UpID0+IHtcbiAgICBpZiAoIXNob3duIHx8IGxvY2sgfHwgIWdyYWIpIHJldHVyblxuXG4gICAgLy8gb25CZWZvcmVSZWxlYXNlIGV2ZW50XG4gICAgaWYgKG9wdGlvbnMub25CZWZvcmVSZWxlYXNlKSBvcHRpb25zLm9uQmVmb3JlUmVsZWFzZSh0YXJnZXQpXG5cbiAgICBzZXRTdHlsZSh0YXJnZXQsIG9wZW5TdHlsZXMpXG5cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBmdW5jdGlvbiBvbkVuZCAoKSB7XG4gICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIGdyYWIgPSBmYWxzZVxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0U3R5bGUoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgcmV0dXJuIHNldFN0eWxlSGVscGVyKGVsLCBzdHlsZXMsIHJlbWVtYmVyKVxufVxuXG5mdW5jdGlvbiBpbWdPbmxvYWQgKCkge1xuICBpbWdSZWN0ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cbiAgLy8gdXBncmFkZSBzb3VyY2UgaWYgcG9zc2libGVcbiAgaWYgKHRhcmdldC5oYXNBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSkge1xuICAgIHNyY1RodW1ibmFpbCA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG5cbiAgICBzZXRTdHlsZSh0YXJnZXQsIHtcbiAgICAgIHdpZHRoOiBgJHtpbWdSZWN0LndpZHRofXB4YCxcbiAgICAgIGhlaWdodDogYCR7aW1nUmVjdC5oZWlnaHR9cHhgXG4gICAgfSlcblxuICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSlcbiAgfVxuXG4gIC8vIGZvcmNlIGxheW91dCB1cGRhdGVcbiAgdGFyZ2V0Lm9mZnNldFdpZHRoXG5cbiAgb3BlblN0eWxlcyA9IHtcbiAgICBwb3NpdGlvbjogJ3JlbGF0aXZlJyxcbiAgICB6SW5kZXg6IDk5OSxcbiAgICBjdXJzb3I6IGAke3ByZWZpeH0ke29wdGlvbnMuZW5hYmxlR3JhYiA/ICdncmFiJyA6ICd6b29tLW91dCd9YCxcbiAgICB0cmFuc2l0aW9uOiBgJHt0cmFuc2Zvcm1Dc3NQcm9wfVxuICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbn1cbiAgICAgICR7b3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb259YCxcbiAgICB0cmFuc2Zvcm06IGNhbGN1bGF0ZVRyYW5zZm9ybSgpXG4gIH1cblxuICAvLyB0cmlnZ2VyIHRyYW5zaXRpb25cbiAgb3JpZ2luYWxTdHlsZXMgPSBzZXRTdHlsZSh0YXJnZXQsIG9wZW5TdHlsZXMsIHRydWUpXG59XG5cbmZ1bmN0aW9uIGluaXQgKCkge1xuICBzZXRTdHlsZShvdmVybGF5LCB7XG4gICAgekluZGV4OiA5OTgsXG4gICAgYmFja2dyb3VuZDogb3B0aW9ucy5iZ0NvbG9yLFxuICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgIHRvcDogMCxcbiAgICBsZWZ0OiAwLFxuICAgIHJpZ2h0OiAwLFxuICAgIGJvdHRvbTogMCxcbiAgICBvcGFjaXR5OiAwLFxuICAgIHRyYW5zaXRpb246IGBvcGFjaXR5XG4gICAgICAke29wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9ufVxuICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gXG4gIH0pXG5cbiAgb3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFwaS5jbG9zZSlcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlVHJhbnNmb3JtICgpIHtcbiAgY29uc3QgW2ltZ0hhbGZXaWR0aCwgaW1nSGFsZkhlaWdodF0gPSBbaW1nUmVjdC53aWR0aCAvIDIsIGltZ1JlY3QuaGVpZ2h0IC8gMl1cblxuICBjb25zdCBpbWdDZW50ZXIgPSB7XG4gICAgeDogaW1nUmVjdC5sZWZ0ICsgaW1nSGFsZldpZHRoLFxuICAgIHk6IGltZ1JlY3QudG9wICsgaW1nSGFsZkhlaWdodFxuICB9XG5cbiAgY29uc3Qgd2luZG93Q2VudGVyID0ge1xuICAgIHg6IHdpbmRvdy5pbm5lcldpZHRoIC8gMixcbiAgICB5OiB3aW5kb3cuaW5uZXJIZWlnaHQgLyAyXG4gIH1cblxuICAvLyBUaGUgZGlzdGFuY2UgYmV0d2VlbiBpbWFnZSBlZGdlIGFuZCB3aW5kb3cgZWRnZVxuICBjb25zdCBkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZSA9IHtcbiAgICB4OiB3aW5kb3dDZW50ZXIueCAtIGltZ0hhbGZXaWR0aCxcbiAgICB5OiB3aW5kb3dDZW50ZXIueSAtIGltZ0hhbGZIZWlnaHRcbiAgfVxuXG4gIGNvbnN0IHNjYWxlSG9yaXpvbnRhbGx5ID0gZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UueCAvIGltZ0hhbGZXaWR0aFxuICBjb25zdCBzY2FsZVZlcnRpY2FsbHkgPSBkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZS55IC8gaW1nSGFsZkhlaWdodFxuXG4gIC8vIFRoZSB2ZWN0b3IgdG8gdHJhbnNsYXRlIGltYWdlIHRvIHRoZSB3aW5kb3cgY2VudGVyXG4gIHRyYW5zbGF0ZSA9IHtcbiAgICB4OiB3aW5kb3dDZW50ZXIueCAtIGltZ0NlbnRlci54LFxuICAgIHk6IHdpbmRvd0NlbnRlci55IC0gaW1nQ2VudGVyLnlcbiAgfVxuXG4gIC8vIFRoZSBhZGRpdGlvbmFsIHNjYWxlIGlzIGJhc2VkIG9uIHRoZSBzbWFsbGVyIHZhbHVlIG9mXG4gIC8vIHNjYWxpbmcgaG9yaXpvbnRhbGx5IGFuZCBzY2FsaW5nIHZlcnRpY2FsbHlcbiAgc2NhbGUgPSBvcHRpb25zLnNjYWxlQmFzZSArIE1hdGgubWluKHNjYWxlSG9yaXpvbnRhbGx5LCBzY2FsZVZlcnRpY2FsbHkpXG5cbiAgcmV0dXJuIGB0cmFuc2xhdGUzZCgke3RyYW5zbGF0ZS54fXB4LCAke3RyYW5zbGF0ZS55fXB4LCAwKSBzY2FsZSgke3NjYWxlfSlgXG59XG5cbmZ1bmN0aW9uIGFkZEdyYWJMaXN0ZW5lcnMgKGVsKSB7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG1vdXNlZG93bkhhbmRsZXIpXG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG1vdXNlbW92ZUhhbmRsZXIpXG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBtb3VzZXVwSGFuZGxlcilcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRvdWNoc3RhcnRIYW5kbGVyKVxuICBlbC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0b3VjaG1vdmVIYW5kbGVyKVxuICBlbC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRvdWNoZW5kSGFuZGxlcilcbn1cblxuZnVuY3Rpb24gcmVtb3ZlR3JhYkxpc3RlbmVycyAoZWwpIHtcbiAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgbW91c2Vkb3duSGFuZGxlcilcbiAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgbW91c2Vtb3ZlSGFuZGxlcilcbiAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG1vdXNldXBIYW5kbGVyKVxuICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdG91Y2hzdGFydEhhbmRsZXIpXG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRvdWNobW92ZUhhbmRsZXIpXG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdG91Y2hlbmRIYW5kbGVyKVxufVxuXG4vLyBsaXN0ZW5lcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gc2Nyb2xsSGFuZGxlciAoKSB7XG4gIGNvbnN0IHNjcm9sbFRvcCA9IHdpbmRvdy5wYWdlWU9mZnNldCB8fFxuICAgIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgfHwgYm9keS5wYXJlbnROb2RlIHx8IGJvZHkpLnNjcm9sbFRvcFxuXG4gIGlmIChsYXN0U2Nyb2xsUG9zaXRpb24gPT09IG51bGwpIGxhc3RTY3JvbGxQb3NpdGlvbiA9IHNjcm9sbFRvcFxuXG4gIGNvbnN0IGRlbHRhWSA9IGxhc3RTY3JvbGxQb3NpdGlvbiAtIHNjcm9sbFRvcFxuXG4gIGlmIChNYXRoLmFicyhkZWx0YVkpID49IG9wdGlvbnMuc2Nyb2xsVGhyZXNob2xkKSB7XG4gICAgbGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuICAgIGFwaS5jbG9zZSgpXG4gIH1cbn1cblxuZnVuY3Rpb24ga2V5ZG93bkhhbmRsZXIgKGUpIHtcbiAgY29uc3QgY29kZSA9IGUua2V5IHx8IGUuY29kZVxuICBpZiAoY29kZSA9PT0gJ0VzY2FwZScgfHwgZS5rZXlDb2RlID09PSAyNykgYXBpLmNsb3NlKClcbn1cblxuZnVuY3Rpb24gbW91c2Vkb3duSGFuZGxlciAoZSkge1xuICBlLnByZXZlbnREZWZhdWx0KClcblxuICBwcmVzc1RpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICBwcmVzcyA9IHRydWVcbiAgICBhcGkuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSwgdHJ1ZSlcbiAgfSwgcHJlc3NEZWxheSlcbn1cblxuZnVuY3Rpb24gbW91c2Vtb3ZlSGFuZGxlciAoZSkge1xuICBpZiAocHJlc3MpIGFwaS5ncmFiKGUuY2xpZW50WCwgZS5jbGllbnRZKVxufVxuXG5mdW5jdGlvbiBtb3VzZXVwSGFuZGxlciAoKSB7XG4gIGNsZWFyVGltZW91dChwcmVzc1RpbWVyKVxuICBwcmVzcyA9IGZhbHNlXG4gIGFwaS5yZWxlYXNlKClcbn1cblxuZnVuY3Rpb24gdG91Y2hzdGFydEhhbmRsZXIgKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgcHJlc3NUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgcHJlc3MgPSB0cnVlXG4gICAgY29uc3QgdG91Y2ggPSBlLnRvdWNoZXNbMF1cbiAgICBhcGkuZ3JhYih0b3VjaC5jbGllbnRYLCB0b3VjaC5jbGllbnRZLCB0cnVlKVxuICB9LCBwcmVzc0RlbGF5KVxufVxuXG5mdW5jdGlvbiB0b3VjaG1vdmVIYW5kbGVyIChlKSB7XG4gIGlmIChwcmVzcykge1xuICAgIGNvbnN0IHRvdWNoID0gZS50b3VjaGVzWzBdXG4gICAgYXBpLmdyYWIodG91Y2guY2xpZW50WCwgdG91Y2guY2xpZW50WSlcbiAgfVxufVxuXG5mdW5jdGlvbiB0b3VjaGVuZEhhbmRsZXIgKCkge1xuICBjbGVhclRpbWVvdXQocHJlc3NUaW1lcilcbiAgcHJlc3MgPSBmYWxzZVxuICBpZiAoZ3JhYikgYXBpLnJlbGVhc2UoKVxuICBlbHNlIGFwaS5jbG9zZSgpXG59XG5cbmluaXQoKVxuXG5leHBvcnQgZGVmYXVsdCBhcGlcbiIsImltcG9ydCB7IG9wdGlvbnMgfSBmcm9tICcuL2hlbHBlcnMnXG5pbXBvcnQgYXBpIGZyb20gJy4vem9vbWluZydcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcbiAgYXBpLmxpc3RlbihvcHRpb25zLmRlZmF1bHRab29tYWJsZSlcbn0pXG5cbmlmIChFTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAvLyBFbmFibGUgTGl2ZVJlbG9hZFxuICBkb2N1bWVudC53cml0ZShcbiAgICAnPHNjcmlwdCBzcmM9XCJodHRwOi8vJyArIChsb2NhdGlvbi5ob3N0IHx8ICdsb2NhbGhvc3QnKS5zcGxpdCgnOicpWzBdICtcbiAgICAnOjM1NzI5L2xpdmVyZWxvYWQuanM/c25pcHZlcj0xXCI+PC8nICsgJ3NjcmlwdD4nXG4gIClcbn1cblxuZXhwb3J0IGRlZmF1bHQgYXBpXG4iXSwibmFtZXMiOlsicHJlZml4IiwiZG9jdW1lbnQiLCJkb2N1bWVudEVsZW1lbnQiLCJzdHlsZSIsInByZXNzRGVsYXkiLCJvcHRpb25zIiwic25pZmZUcmFuc2l0aW9uIiwiZWwiLCJyZXQiLCJ0cmFucyIsInRmb3JtIiwiZW5kIiwic29tZSIsInByb3AiLCJ1bmRlZmluZWQiLCJ0cmFuc2l0aW9uUHJvcCIsInRyYW5zRW5kRXZlbnQiLCJ0cmFuc2Zvcm1Qcm9wIiwidHJhbnNmb3JtQ3NzUHJvcCIsInJlcGxhY2UiLCJjaGVja1RyYW5zIiwic2V0U3R5bGUiLCJzdHlsZXMiLCJyZW1lbWJlciIsInZhbHVlIiwidHJhbnNpdGlvbiIsInRyYW5zZm9ybSIsInMiLCJvcmlnaW5hbCIsImtleSIsImJvZHkiLCJvdmVybGF5IiwiY3JlYXRlRWxlbWVudCIsInRhcmdldCIsInBhcmVudCIsInNob3duIiwibG9jayIsInByZXNzIiwiZ3JhYiIsImxhc3RTY3JvbGxQb3NpdGlvbiIsIm9yaWdpbmFsU3R5bGVzIiwib3BlblN0eWxlcyIsInRyYW5zbGF0ZSIsInNjYWxlIiwic3JjVGh1bWJuYWlsIiwiaW1nUmVjdCIsInByZXNzVGltZXIiLCJzZXRTdHlsZUhlbHBlciIsImFwaSIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJmb3JFYWNoIiwibGlzdGVuIiwiZSIsImN1cnNvciIsImFkZEV2ZW50TGlzdGVuZXIiLCJwcmV2ZW50RGVmYXVsdCIsImNsb3NlIiwib3BlbiIsIm9wdHMiLCJiZ0NvbG9yIiwidHJhbnNpdGlvbkR1cmF0aW9uIiwidHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uIiwiY2IiLCJvbk9wZW4iLCJxdWVyeVNlbGVjdG9yIiwidGFnTmFtZSIsIm9uQmVmb3JlT3BlbiIsInBhcmVudE5vZGUiLCJpbWciLCJJbWFnZSIsIm9ubG9hZCIsImltZ09ubG9hZCIsInNyYyIsImdldEF0dHJpYnV0ZSIsImFwcGVuZENoaWxkIiwib3BhY2l0eSIsImJnT3BhY2l0eSIsInNjcm9sbEhhbmRsZXIiLCJrZXlkb3duSGFuZGxlciIsIm9uRW5kIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImVuYWJsZUdyYWIiLCJhZGRHcmFiTGlzdGVuZXJzIiwib25DbG9zZSIsIm9uQmVmb3JlQ2xvc2UiLCJyZW1vdmVHcmFiTGlzdGVuZXJzIiwicmVtb3ZlQ2hpbGQiLCJoYXNBdHRyaWJ1dGUiLCJzZXRBdHRyaWJ1dGUiLCJ4IiwieSIsInN0YXJ0Iiwib25HcmFiIiwib25CZWZvcmVHcmFiIiwiZHgiLCJ3aW5kb3ciLCJpbm5lcldpZHRoIiwiZHkiLCJpbm5lckhlaWdodCIsInNjYWxlRXh0cmEiLCJvblJlbGVhc2UiLCJvbkJlZm9yZVJlbGVhc2UiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJ3aWR0aCIsImhlaWdodCIsIm9mZnNldFdpZHRoIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwiaW5pdCIsImltZ0hhbGZXaWR0aCIsImltZ0hhbGZIZWlnaHQiLCJpbWdDZW50ZXIiLCJsZWZ0IiwidG9wIiwid2luZG93Q2VudGVyIiwiZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsInNjYWxlQmFzZSIsIk1hdGgiLCJtaW4iLCJtb3VzZWRvd25IYW5kbGVyIiwibW91c2Vtb3ZlSGFuZGxlciIsIm1vdXNldXBIYW5kbGVyIiwidG91Y2hzdGFydEhhbmRsZXIiLCJ0b3VjaG1vdmVIYW5kbGVyIiwidG91Y2hlbmRIYW5kbGVyIiwic2Nyb2xsVG9wIiwicGFnZVlPZmZzZXQiLCJkZWx0YVkiLCJhYnMiLCJzY3JvbGxUaHJlc2hvbGQiLCJjb2RlIiwia2V5Q29kZSIsInNldFRpbWVvdXQiLCJjbGllbnRYIiwiY2xpZW50WSIsInJlbGVhc2UiLCJ0b3VjaCIsInRvdWNoZXMiLCJkZWZhdWx0Wm9vbWFibGUiLCJFTlYiLCJ3cml0ZSIsImxvY2F0aW9uIiwiaG9zdCIsInNwbGl0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTtBQUNBLElBQU1BLFNBQVMsc0JBQXNCQyxTQUFTQyxlQUFULENBQXlCQyxLQUEvQyxHQUF1RCxVQUF2RCxHQUFvRSxFQUFuRjtBQUNBLElBQU1D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
