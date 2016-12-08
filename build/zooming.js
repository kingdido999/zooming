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

// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------

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

// init ------------------------------------------------------------------------
setStyle$1(overlay, {
  zIndex: 998,
  background: options.bgColor,
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  opacity: 0,
  transition: 'opacity\n    ' + options.transitionDuration + '\n    ' + options.transitionTimingFunction
});

overlay.addEventListener('click', api$1.close);

document.addEventListener('DOMContentLoaded', function () {
  api$1.listen(options.defaultZoomable);
});

{
  // Enable LiveReload
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1"></' + 'script>');
}

return api$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyB3ZWJraXQgcHJlZml4XG5jb25zdCBwcmVmaXggPSAnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlID8gJy13ZWJraXQtJyA6ICcnXG5jb25zdCBwcmVzc0RlbGF5ID0gMjAwXG5cbmNvbnN0IG9wdGlvbnMgPSB7XG4gIGRlZmF1bHRab29tYWJsZTogJ2ltZ1tkYXRhLWFjdGlvbj1cInpvb21cIl0nLFxuICBlbmFibGVHcmFiOiB0cnVlLFxuICB0cmFuc2l0aW9uRHVyYXRpb246ICcuNHMnLFxuICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb246ICdjdWJpYy1iZXppZXIoLjQsMCwwLDEpJyxcbiAgYmdDb2xvcjogJyNmZmYnLFxuICBiZ09wYWNpdHk6IDEsXG4gIHNjYWxlQmFzZTogMS4wLFxuICBzY2FsZUV4dHJhOiAwLjUsXG4gIHNjcm9sbFRocmVzaG9sZDogNDAsXG4gIG9uT3BlbjogbnVsbCxcbiAgb25DbG9zZTogbnVsbCxcbiAgb25HcmFiOiBudWxsLFxuICBvblJlbGVhc2U6IG51bGwsXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcbiAgb25CZWZvcmVHcmFiOiBudWxsLFxuICBvbkJlZm9yZVJlbGVhc2U6IG51bGxcbn1cblxuY29uc3Qgc25pZmZUcmFuc2l0aW9uID0gKGVsKSA9PiB7XG4gIGxldCByZXQgICAgID0ge31cbiAgY29uc3QgdHJhbnMgPSBbJ3dlYmtpdFRyYW5zaXRpb24nLCAndHJhbnNpdGlvbicsICdtb3pUcmFuc2l0aW9uJ11cbiAgY29uc3QgdGZvcm0gPSBbJ3dlYmtpdFRyYW5zZm9ybScsICd0cmFuc2Zvcm0nLCAnbW96VHJhbnNmb3JtJ11cbiAgY29uc3QgZW5kICAgPSB7XG4gICAgJ3RyYW5zaXRpb24nICAgICAgIDogJ3RyYW5zaXRpb25lbmQnLFxuICAgICdtb3pUcmFuc2l0aW9uJyAgICA6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAnd2Via2l0VHJhbnNpdGlvbicgOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgfVxuXG4gIHRyYW5zLnNvbWUocHJvcCA9PiB7XG4gICAgaWYgKGVsLnN0eWxlW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldC50cmFuc2l0aW9uUHJvcCA9IHByb3BcbiAgICAgIHJldC50cmFuc0VuZEV2ZW50ID0gZW5kW3Byb3BdXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfSlcblxuICB0Zm9ybS5zb21lKHByb3AgPT4ge1xuICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXQudHJhbnNmb3JtUHJvcCA9IHByb3BcbiAgICAgIHJldC50cmFuc2Zvcm1Dc3NQcm9wID0gcHJvcC5yZXBsYWNlKC8oLiopVHJhbnNmb3JtLywgJy0kMS10cmFuc2Zvcm0nKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJldFxufVxuXG5jb25zdCBjaGVja1RyYW5zID0gKHRyYW5zaXRpb25Qcm9wLCB0cmFuc2Zvcm1Qcm9wKSA9PiB7XG4gIHJldHVybiBmdW5jdGlvbiBzZXRTdHlsZShlbCwgc3R5bGVzLCByZW1lbWJlcikge1xuICAgIGxldCB2YWx1ZVxuICAgIGlmIChzdHlsZXMudHJhbnNpdGlvbikge1xuICAgICAgdmFsdWUgPSBzdHlsZXMudHJhbnNpdGlvblxuICAgICAgZGVsZXRlIHN0eWxlcy50cmFuc2l0aW9uXG4gICAgICBzdHlsZXNbdHJhbnNpdGlvblByb3BdID0gdmFsdWVcbiAgICB9XG4gICAgaWYgKHN0eWxlcy50cmFuc2Zvcm0pIHtcbiAgICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgICAgZGVsZXRlIHN0eWxlcy50cmFuc2Zvcm1cbiAgICAgIHN0eWxlc1t0cmFuc2Zvcm1Qcm9wXSA9IHZhbHVlXG4gICAgfVxuXG4gICAgbGV0IHMgPSBlbC5zdHlsZVxuICAgIGxldCBvcmlnaW5hbCA9IHt9XG5cbiAgICBmb3IgKGxldCBrZXkgaW4gc3R5bGVzKSB7XG4gICAgICBpZiAocmVtZW1iZXIpIG9yaWdpbmFsW2tleV0gPSBzW2tleV0gfHwgJydcbiAgICAgIHNba2V5XSA9IHN0eWxlc1trZXldXG4gICAgfVxuXG4gICAgcmV0dXJuIG9yaWdpbmFsXG4gIH1cbn1cblxuZXhwb3J0IHsgcHJlZml4LCBwcmVzc0RlbGF5LCBvcHRpb25zLCBzbmlmZlRyYW5zaXRpb24sIGNoZWNrVHJhbnMgfVxuIiwiaW1wb3J0IHsgcHJlZml4LCBwcmVzc0RlbGF5LCBvcHRpb25zLCBzbmlmZlRyYW5zaXRpb24sIGNoZWNrVHJhbnMgfSBmcm9tICcuL2hlbHBlcnMnXG5cbi8vIGVsZW1lbnRzXG5jb25zdCBib2R5ICAgID0gZG9jdW1lbnQuYm9keVxuY29uc3Qgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5sZXQgdGFyZ2V0XG5sZXQgcGFyZW50XG5cbi8vIHN0YXRlXG5sZXQgc2hvd24gPSBmYWxzZVxubGV0IGxvY2sgID0gZmFsc2VcbmxldCBwcmVzcyA9IGZhbHNlXG5sZXQgZ3JhYiAgPSBmYWxzZVxubGV0IGxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcblxuLy8gc3R5bGVcbmxldCBvcmlnaW5hbFN0eWxlc1xubGV0IG9wZW5TdHlsZXNcbmxldCB0cmFuc2xhdGVcbmxldCBzY2FsZVxuXG5sZXQgc3JjVGh1bWJuYWlsXG5sZXQgaW1nUmVjdFxubGV0IHByZXNzVGltZXJcblxuY29uc3QgdHJhbnMgPSBzbmlmZlRyYW5zaXRpb24ob3ZlcmxheSlcbmNvbnN0IHRyYW5zZm9ybUNzc1Byb3AgPSB0cmFucy50cmFuc2Zvcm1Dc3NQcm9wXG5jb25zdCB0cmFuc0VuZEV2ZW50ID0gdHJhbnMudHJhbnNFbmRFdmVudFxuY29uc3Qgc2V0U3R5bGVIZWxwZXIgPSBjaGVja1RyYW5zKHRyYW5zLnRyYW5zaXRpb25Qcm9wLCB0cmFucy50cmFuc2Zvcm1Qcm9wKVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCBhcGkgPSB7XG5cbiAgbGlzdGVuOiAoZWwpID0+IHtcbiAgICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbCkuZm9yRWFjaChlID0+IGFwaS5saXN0ZW4oZSkpXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGVsLnN0eWxlLmN1cnNvciA9IGAke3ByZWZpeH16b29tLWluYFxuXG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIGlmIChzaG93bikgYXBpLmNsb3NlKClcbiAgICAgIGVsc2UgYXBpLm9wZW4oZWwpXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH0sXG5cbiAgY29uZmlnOiAob3B0cykgPT4ge1xuICAgIGlmICghb3B0cykgcmV0dXJuIG9wdGlvbnNcblxuICAgIGZvciAobGV0IGtleSBpbiBvcHRzKSB7XG4gICAgICBvcHRpb25zW2tleV0gPSBvcHRzW2tleV1cbiAgICB9XG5cbiAgICBzZXRTdHlsZShvdmVybGF5LCB7XG4gICAgICBiYWNrZ3JvdW5kQ29sb3I6IG9wdGlvbnMuYmdDb2xvcixcbiAgICAgIHRyYW5zaXRpb246IGBvcGFjaXR5XG4gICAgICAgICR7b3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb259XG4gICAgICAgICR7b3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb259YFxuICAgIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9LFxuXG4gIG9wZW46IChlbCwgY2IgPSBvcHRpb25zLm9uT3BlbikgPT4ge1xuICAgIGlmIChzaG93biB8fCBsb2NrIHx8IGdyYWIpIHJldHVyblxuXG4gICAgdGFyZ2V0ID0gdHlwZW9mIGVsID09PSAnc3RyaW5nJ1xuICAgICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKVxuICAgICAgOiBlbFxuXG4gICAgaWYgKHRhcmdldC50YWdOYW1lICE9PSAnSU1HJykgcmV0dXJuXG5cbiAgICAvLyBvbkJlZm9yZU9wZW4gZXZlbnRcbiAgICBpZiAob3B0aW9ucy5vbkJlZm9yZU9wZW4pIG9wdGlvbnMub25CZWZvcmVPcGVuKHRhcmdldClcblxuICAgIHNob3duID0gdHJ1ZVxuICAgIGxvY2sgPSB0cnVlXG4gICAgcGFyZW50ID0gdGFyZ2V0LnBhcmVudE5vZGVcblxuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpXG4gICAgaW1nLm9ubG9hZCA9IGltZ09ubG9hZCgpXG4gICAgaW1nLnNyYyA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG5cbiAgICBwYXJlbnQuYXBwZW5kQ2hpbGQob3ZlcmxheSlcbiAgICBzZXRUaW1lb3V0KCgpID0+IG92ZXJsYXkuc3R5bGUub3BhY2l0eSA9IG9wdGlvbnMuYmdPcGFjaXR5LCAzMClcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIHNjcm9sbEhhbmRsZXIpXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGtleWRvd25IYW5kbGVyKVxuXG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgZnVuY3Rpb24gb25FbmQgKCkge1xuICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgb25FbmQpXG5cbiAgICAgIGlmIChvcHRpb25zLmVuYWJsZUdyYWIpIGFkZEdyYWJMaXN0ZW5lcnModGFyZ2V0KVxuXG4gICAgICBsb2NrID0gZmFsc2VcblxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH0sXG5cbiAgY2xvc2U6IChjYiA9IG9wdGlvbnMub25DbG9zZSkgPT4ge1xuICAgIGlmICghc2hvd24gfHwgbG9jayB8fCBncmFiKSByZXR1cm5cbiAgICBsb2NrID0gdHJ1ZVxuXG4gICAgLy8gb25CZWZvcmVDbG9zZSBldmVudFxuICAgIGlmIChvcHRpb25zLm9uQmVmb3JlQ2xvc2UpIG9wdGlvbnMub25CZWZvcmVDbG9zZSh0YXJnZXQpXG4gICAgb3ZlcmxheS5zdHlsZS5vcGFjaXR5ID0gMFxuICAgIHRhcmdldC5zdHlsZS50cmFuc2Zvcm0gPSAnJ1xuXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgc2Nyb2xsSGFuZGxlcilcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywga2V5ZG93bkhhbmRsZXIpXG5cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBmdW5jdGlvbiBvbkVuZCAoKSB7XG4gICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBvbkVuZClcblxuICAgICAgaWYgKG9wdGlvbnMuZW5hYmxlR3JhYikgcmVtb3ZlR3JhYkxpc3RlbmVycyh0YXJnZXQpXG5cbiAgICAgIHNob3duID0gZmFsc2VcbiAgICAgIGxvY2sgPSBmYWxzZVxuICAgICAgZ3JhYiA9IGZhbHNlXG5cbiAgICAgIHNldFN0eWxlKHRhcmdldCwgb3JpZ2luYWxTdHlsZXMpXG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQob3ZlcmxheSlcblxuICAgICAgLy8gZG93bmdyYWRlIHNvdXJjZSBpZiBwb3NzaWJsZVxuICAgICAgaWYgKHRhcmdldC5oYXNBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSkgdGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgc3JjVGh1bWJuYWlsKVxuXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfSxcblxuICBncmFiOiBmdW5jdGlvbih4LCB5LCBzdGFydCwgY2IgPSBvcHRpb25zLm9uR3JhYikge1xuICAgIGlmICghc2hvd24gfHwgbG9jaykgcmV0dXJuXG4gICAgZ3JhYiA9IHRydWVcblxuICAgIC8vIG9uQmVmb3JlR3JhYiBldmVudFxuICAgIGlmIChvcHRpb25zLm9uQmVmb3JlR3JhYikgb3B0aW9ucy5vbkJlZm9yZUdyYWIodGFyZ2V0KVxuXG4gICAgY29uc3QgW2R4LCBkeV0gPSBbeCAtIHdpbmRvdy5pbm5lcldpZHRoIC8gMiwgeSAtIHdpbmRvdy5pbm5lckhlaWdodCAvIDJdXG4gICAgY29uc3QgdHJhbnNmb3JtID0gdGFyZ2V0LnN0eWxlLnRyYW5zZm9ybVxuICAgICAgLnJlcGxhY2UoL3RyYW5zbGF0ZTNkXFwoLio/XFwpL2ksIGB0cmFuc2xhdGUzZCgke3RyYW5zbGF0ZS54ICsgZHh9cHgsICR7dHJhbnNsYXRlLnkgKyBkeX1weCwgMClgKVxuICAgICAgLnJlcGxhY2UoL3NjYWxlXFwoWzAtOXxcXC5dKlxcKS9pLCBgc2NhbGUoJHtzY2FsZSArIG9wdGlvbnMuc2NhbGVFeHRyYX0pYClcblxuICAgIHNldFN0eWxlKHRhcmdldCwge1xuICAgICAgY3Vyc29yOiBgJHtwcmVmaXh9IGdyYWJiaW5nYCxcbiAgICAgIHRyYW5zaXRpb246IGAke3RyYW5zZm9ybUNzc1Byb3B9ICR7c3RhcnRcbiAgICAgICAgPyBvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArIG9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgICAgIDogJ2Vhc2UnfWAsXG4gICAgICB0cmFuc2Zvcm06IHRyYW5zZm9ybVxuICAgIH0pXG5cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBmdW5jdGlvbiBvbkVuZCAoKSB7XG4gICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH0pXG4gIH0sXG5cbiAgcmVsZWFzZTogKGNiID0gb3B0aW9ucy5vblJlbGVhc2UpID0+IHtcbiAgICBpZiAoIXNob3duIHx8IGxvY2sgfHwgIWdyYWIpIHJldHVyblxuXG4gICAgLy8gb25CZWZvcmVSZWxlYXNlIGV2ZW50XG4gICAgaWYgKG9wdGlvbnMub25CZWZvcmVSZWxlYXNlKSBvcHRpb25zLm9uQmVmb3JlUmVsZWFzZSh0YXJnZXQpXG5cbiAgICBzZXRTdHlsZSh0YXJnZXQsIG9wZW5TdHlsZXMpXG5cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBmdW5jdGlvbiBvbkVuZCAoKSB7XG4gICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIGdyYWIgPSBmYWxzZVxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gc2V0U3R5bGUoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgcmV0dXJuIHNldFN0eWxlSGVscGVyKGVsLCBzdHlsZXMsIHJlbWVtYmVyKVxufVxuXG5mdW5jdGlvbiBpbWdPbmxvYWQgKCkge1xuICBpbWdSZWN0ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cbiAgLy8gdXBncmFkZSBzb3VyY2UgaWYgcG9zc2libGVcbiAgaWYgKHRhcmdldC5oYXNBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSkge1xuICAgIHNyY1RodW1ibmFpbCA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG5cbiAgICBzZXRTdHlsZSh0YXJnZXQsIHtcbiAgICAgIHdpZHRoOiBgJHtpbWdSZWN0LndpZHRofXB4YCxcbiAgICAgIGhlaWdodDogYCR7aW1nUmVjdC5oZWlnaHR9cHhgXG4gICAgfSlcblxuICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSlcbiAgfVxuXG4gIC8vIGZvcmNlIGxheW91dCB1cGRhdGVcbiAgdGFyZ2V0Lm9mZnNldFdpZHRoXG5cbiAgb3BlblN0eWxlcyA9IHtcbiAgICBwb3NpdGlvbjogJ3JlbGF0aXZlJyxcbiAgICB6SW5kZXg6IDk5OSxcbiAgICBjdXJzb3I6IGAke3ByZWZpeH0ke29wdGlvbnMuZW5hYmxlR3JhYiA/ICdncmFiJyA6ICd6b29tLW91dCd9YCxcbiAgICB0cmFuc2l0aW9uOiBgJHt0cmFuc2Zvcm1Dc3NQcm9wfVxuICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbn1cbiAgICAgICR7b3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb259YCxcbiAgICB0cmFuc2Zvcm06IGNhbGN1bGF0ZVRyYW5zZm9ybSgpXG4gIH1cblxuICAvLyB0cmlnZ2VyIHRyYW5zaXRpb25cbiAgb3JpZ2luYWxTdHlsZXMgPSBzZXRTdHlsZSh0YXJnZXQsIG9wZW5TdHlsZXMsIHRydWUpXG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZVRyYW5zZm9ybSAoKSB7XG4gIGNvbnN0IFtpbWdIYWxmV2lkdGgsIGltZ0hhbGZIZWlnaHRdID0gW2ltZ1JlY3Qud2lkdGggLyAyLCBpbWdSZWN0LmhlaWdodCAvIDJdXG5cbiAgY29uc3QgaW1nQ2VudGVyID0ge1xuICAgIHg6IGltZ1JlY3QubGVmdCArIGltZ0hhbGZXaWR0aCxcbiAgICB5OiBpbWdSZWN0LnRvcCArIGltZ0hhbGZIZWlnaHRcbiAgfVxuXG4gIGNvbnN0IHdpbmRvd0NlbnRlciA9IHtcbiAgICB4OiB3aW5kb3cuaW5uZXJXaWR0aCAvIDIsXG4gICAgeTogd2luZG93LmlubmVySGVpZ2h0IC8gMlxuICB9XG5cbiAgLy8gVGhlIGRpc3RhbmNlIGJldHdlZW4gaW1hZ2UgZWRnZSBhbmQgd2luZG93IGVkZ2VcbiAgY29uc3QgZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UgPSB7XG4gICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdIYWxmV2lkdGgsXG4gICAgeTogd2luZG93Q2VudGVyLnkgLSBpbWdIYWxmSGVpZ2h0XG4gIH1cblxuICBjb25zdCBzY2FsZUhvcml6b250YWxseSA9IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlLnggLyBpbWdIYWxmV2lkdGhcbiAgY29uc3Qgc2NhbGVWZXJ0aWNhbGx5ID0gZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UueSAvIGltZ0hhbGZIZWlnaHRcblxuICAvLyBUaGUgdmVjdG9yIHRvIHRyYW5zbGF0ZSBpbWFnZSB0byB0aGUgd2luZG93IGNlbnRlclxuICB0cmFuc2xhdGUgPSB7XG4gICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdDZW50ZXIueCxcbiAgICB5OiB3aW5kb3dDZW50ZXIueSAtIGltZ0NlbnRlci55XG4gIH1cblxuICAvLyBUaGUgYWRkaXRpb25hbCBzY2FsZSBpcyBiYXNlZCBvbiB0aGUgc21hbGxlciB2YWx1ZSBvZlxuICAvLyBzY2FsaW5nIGhvcml6b250YWxseSBhbmQgc2NhbGluZyB2ZXJ0aWNhbGx5XG4gIHNjYWxlID0gb3B0aW9ucy5zY2FsZUJhc2UgKyBNYXRoLm1pbihzY2FsZUhvcml6b250YWxseSwgc2NhbGVWZXJ0aWNhbGx5KVxuXG4gIHJldHVybiBgdHJhbnNsYXRlM2QoJHt0cmFuc2xhdGUueH1weCwgJHt0cmFuc2xhdGUueX1weCwgMCkgc2NhbGUoJHtzY2FsZX0pYFxufVxuXG5mdW5jdGlvbiBhZGRHcmFiTGlzdGVuZXJzIChlbCkge1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBtb3VzZWRvd25IYW5kbGVyKVxuICBlbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBtb3VzZW1vdmVIYW5kbGVyKVxuICBlbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgbW91c2V1cEhhbmRsZXIpXG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0b3VjaHN0YXJ0SGFuZGxlcilcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdG91Y2htb3ZlSGFuZGxlcilcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0b3VjaGVuZEhhbmRsZXIpXG59XG5cbmZ1bmN0aW9uIHJlbW92ZUdyYWJMaXN0ZW5lcnMgKGVsKSB7XG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG1vdXNlZG93bkhhbmRsZXIpXG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG1vdXNlbW92ZUhhbmRsZXIpXG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBtb3VzZXVwSGFuZGxlcilcbiAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRvdWNoc3RhcnRIYW5kbGVyKVxuICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0b3VjaG1vdmVIYW5kbGVyKVxuICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRvdWNoZW5kSGFuZGxlcilcbn1cblxuLy8gbGlzdGVuZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIHNjcm9sbEhhbmRsZXIgKCkge1xuICBjb25zdCBzY3JvbGxUb3AgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHxcbiAgICAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50IHx8IGJvZHkucGFyZW50Tm9kZSB8fCBib2R5KS5zY3JvbGxUb3BcblxuICBpZiAobGFzdFNjcm9sbFBvc2l0aW9uID09PSBudWxsKSBsYXN0U2Nyb2xsUG9zaXRpb24gPSBzY3JvbGxUb3BcblxuICBjb25zdCBkZWx0YVkgPSBsYXN0U2Nyb2xsUG9zaXRpb24gLSBzY3JvbGxUb3BcblxuICBpZiAoTWF0aC5hYnMoZGVsdGFZKSA+PSBvcHRpb25zLnNjcm9sbFRocmVzaG9sZCkge1xuICAgIGxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcbiAgICBhcGkuY2xvc2UoKVxuICB9XG59XG5cbmZ1bmN0aW9uIGtleWRvd25IYW5kbGVyIChlKSB7XG4gIGNvbnN0IGNvZGUgPSBlLmtleSB8fCBlLmNvZGVcbiAgaWYgKGNvZGUgPT09ICdFc2NhcGUnIHx8IGUua2V5Q29kZSA9PT0gMjcpIGFwaS5jbG9zZSgpXG59XG5cbmZ1bmN0aW9uIG1vdXNlZG93bkhhbmRsZXIgKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgcHJlc3NUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgcHJlc3MgPSB0cnVlXG4gICAgYXBpLmdyYWIoZS5jbGllbnRYLCBlLmNsaWVudFksIHRydWUpXG4gIH0sIHByZXNzRGVsYXkpXG59XG5cbmZ1bmN0aW9uIG1vdXNlbW92ZUhhbmRsZXIgKGUpIHtcbiAgaWYgKHByZXNzKSBhcGkuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSlcbn1cblxuZnVuY3Rpb24gbW91c2V1cEhhbmRsZXIgKCkge1xuICBjbGVhclRpbWVvdXQocHJlc3NUaW1lcilcbiAgcHJlc3MgPSBmYWxzZVxuICBhcGkucmVsZWFzZSgpXG59XG5cbmZ1bmN0aW9uIHRvdWNoc3RhcnRIYW5kbGVyIChlKSB7XG4gIGUucHJldmVudERlZmF1bHQoKVxuXG4gIHByZXNzVGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIHByZXNzID0gdHJ1ZVxuICAgIGNvbnN0IHRvdWNoID0gZS50b3VjaGVzWzBdXG4gICAgYXBpLmdyYWIodG91Y2guY2xpZW50WCwgdG91Y2guY2xpZW50WSwgdHJ1ZSlcbiAgfSwgcHJlc3NEZWxheSlcbn1cblxuZnVuY3Rpb24gdG91Y2htb3ZlSGFuZGxlciAoZSkge1xuICBpZiAocHJlc3MpIHtcbiAgICBjb25zdCB0b3VjaCA9IGUudG91Y2hlc1swXVxuICAgIGFwaS5ncmFiKHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdG91Y2hlbmRIYW5kbGVyICgpIHtcbiAgY2xlYXJUaW1lb3V0KHByZXNzVGltZXIpXG4gIHByZXNzID0gZmFsc2VcbiAgaWYgKGdyYWIpIGFwaS5yZWxlYXNlKClcbiAgZWxzZSBhcGkuY2xvc2UoKVxufVxuXG4vLyBpbml0IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuc2V0U3R5bGUob3ZlcmxheSwge1xuICB6SW5kZXg6IDk5OCxcbiAgYmFja2dyb3VuZDogb3B0aW9ucy5iZ0NvbG9yLFxuICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgdG9wOiAwLFxuICBsZWZ0OiAwLFxuICByaWdodDogMCxcbiAgYm90dG9tOiAwLFxuICBvcGFjaXR5OiAwLFxuICB0cmFuc2l0aW9uOiBgb3BhY2l0eVxuICAgICR7b3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb259XG4gICAgJHtvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gXG59KVxuXG5vdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXBpLmNsb3NlKVxuXG5leHBvcnQgZGVmYXVsdCBhcGlcbiIsImltcG9ydCB7IG9wdGlvbnMgfSBmcm9tICcuL2hlbHBlcnMnXG5pbXBvcnQgYXBpIGZyb20gJy4vem9vbWluZydcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcbiAgYXBpLmxpc3RlbihvcHRpb25zLmRlZmF1bHRab29tYWJsZSlcbn0pXG5cbmlmIChFTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAvLyBFbmFibGUgTGl2ZVJlbG9hZFxuICBkb2N1bWVudC53cml0ZShcbiAgICAnPHNjcmlwdCBzcmM9XCJodHRwOi8vJyArIChsb2NhdGlvbi5ob3N0IHx8ICdsb2NhbGhvc3QnKS5zcGxpdCgnOicpWzBdICtcbiAgICAnOjM1NzI5L2xpdmVyZWxvYWQuanM/c25pcHZlcj0xXCI+PC8nICsgJ3NjcmlwdD4nXG4gIClcbn1cblxuZXhwb3J0IGRlZmF1bHQgYXBpXG4iXSwibmFtZXMiOlsicHJlZml4IiwiZG9jdW1lbnQiLCJkb2N1bWVudEVsZW1lbnQiLCJzdHlsZSIsInByZXNzRGVsYXkiLCJvcHRpb25zIiwic25pZmZUcmFuc2l0aW9uIiwiZWwiLCJyZXQiLCJ0cmFucyIsInRmb3JtIiwiZW5kIiwic29tZSIsInByb3AiLCJ1bmRlZmluZWQiLCJ0cmFuc2l0aW9uUHJvcCIsInRyYW5zRW5kRXZlbnQiLCJ0cmFuc2Zvcm1Qcm9wIiwidHJhbnNmb3JtQ3NzUHJvcCIsInJlcGxhY2UiLCJjaGVja1RyYW5zIiwic2V0U3R5bGUiLCJzdHlsZXMiLCJyZW1lbWJlciIsInZhbHVlIiwidHJhbnNpdGlvbiIsInRyYW5zZm9ybSIsInMiLCJvcmlnaW5hbCIsImtleSIsImJvZHkiLCJvdmVybGF5IiwiY3JlYXRlRWxlbWVudCIsInRhcmdldCIsInBhcmVudCIsInNob3duIiwibG9jayIsInByZXNzIiwiZ3JhYiIsImxhc3RTY3JvbGxQb3NpdGlvbiIsIm9yaWdpbmFsU3R5bGVzIiwib3BlblN0eWxlcyIsInRyYW5zbGF0ZSIsInNjYWxlIiwic3JjVGh1bWJuYWlsIiwiaW1nUmVjdCIsInByZXNzVGltZXIiLCJzZXRTdHlsZUhlbHBlciIsImFwaSIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJmb3JFYWNoIiwibGlzdGVuIiwiZSIsImN1cnNvciIsImFkZEV2ZW50TGlzdGVuZXIiLCJwcmV2ZW50RGVmYXVsdCIsImNsb3NlIiwib3BlbiIsIm9wdHMiLCJiZ0NvbG9yIiwidHJhbnNpdGlvbkR1cmF0aW9uIiwidHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uIiwiY2IiLCJvbk9wZW4iLCJxdWVyeVNlbGVjdG9yIiwidGFnTmFtZSIsIm9uQmVmb3JlT3BlbiIsInBhcmVudE5vZGUiLCJpbWciLCJJbWFnZSIsIm9ubG9hZCIsImltZ09ubG9hZCIsInNyYyIsImdldEF0dHJpYnV0ZSIsImFwcGVuZENoaWxkIiwib3BhY2l0eSIsImJnT3BhY2l0eSIsInNjcm9sbEhhbmRsZXIiLCJrZXlkb3duSGFuZGxlciIsIm9uRW5kIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImVuYWJsZUdyYWIiLCJhZGRHcmFiTGlzdGVuZXJzIiwib25DbG9zZSIsIm9uQmVmb3JlQ2xvc2UiLCJyZW1vdmVHcmFiTGlzdGVuZXJzIiwicmVtb3ZlQ2hpbGQiLCJoYXNBdHRyaWJ1dGUiLCJzZXRBdHRyaWJ1dGUiLCJ4IiwieSIsInN0YXJ0Iiwib25HcmFiIiwib25CZWZvcmVHcmFiIiwiZHgiLCJ3aW5kb3ciLCJpbm5lcldpZHRoIiwiZHkiLCJpbm5lckhlaWdodCIsInNjYWxlRXh0cmEiLCJvblJlbGVhc2UiLCJvbkJlZm9yZVJlbGVhc2UiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJ3aWR0aCIsImhlaWdodCIsIm9mZnNldFdpZHRoIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwiaW1nSGFsZldpZHRoIiwiaW1nSGFsZkhlaWdodCIsImltZ0NlbnRlciIsImxlZnQiLCJ0b3AiLCJ3aW5kb3dDZW50ZXIiLCJkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZSIsInNjYWxlSG9yaXpvbnRhbGx5Iiwic2NhbGVWZXJ0aWNhbGx5Iiwic2NhbGVCYXNlIiwiTWF0aCIsIm1pbiIsIm1vdXNlZG93bkhhbmRsZXIiLCJtb3VzZW1vdmVIYW5kbGVyIiwibW91c2V1cEhhbmRsZXIiLCJ0b3VjaHN0YXJ0SGFuZGxlciIsInRvdWNobW92ZUhhbmRsZXIiLCJ0b3VjaGVuZEhhbmRsZXIiLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImRlbHRhWSIsImFicyIsInNjcm9sbFRocmVzaG9sZCIsImNvZGUiLCJrZXlDb2RlIiwic2V0VGltZW91dCIsImNsaWVudFgiLCJjbGllbnRZIiwicmVsZWFzZSIsInRvdWNoIiwidG91Y2hlcyIsImRlZmF1bHRab29tYWJsZSIs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
