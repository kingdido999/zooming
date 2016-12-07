(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Zooming = factory());
}(this, (function () { 'use strict';

var options = {
  defaultZoomable: 'img[data-action="zoom"]',
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

// webkit prefix helper
var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : '';

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

// style
var originalStyles = void 0;
var openStyles = void 0;
var translate = void 0;
var scale = void 0;

var srcThumbnail = void 0;
var imgRect = void 0;
var pressTimer = void 0;
var lastScrollPosition = null;

var pressDelay = 200;

// compatibility stuff
var trans = sniffTransition(overlay);
var transitionProp = trans.transition;
var transformProp = trans.transform;
var transformCssProp = transformProp.replace(/(.*)Transform/, '-$1-transform');
var transEndEvent = trans.transEnd;

var api = {

  config: function config(opts) {
    if (!opts) return options;

    for (var key in opts) {
      options[key] = opts[key];
    }

    setStyle(overlay, {
      backgroundColor: options.bgColor,
      transition: 'opacity ' + options.transitionDuration + ' ' + options.transitionTimingFunction
    });

    return this;
  },

  open: function open(el, cb) {
    if (shown || lock || _grab) return;

    target = typeof el === 'string' ? document.querySelector(el) : el;

    if (target.tagName !== 'IMG') return;

    // onBeforeOpen event
    if (options.onBeforeOpen) options.onBeforeOpen(target);

    shown = true;
    lock = true;
    parent = target.parentNode;

    var img = new Image();

    img.onload = function () {
      imgRect = target.getBoundingClientRect();

      // upgrade source if possible
      if (target.hasAttribute('data-original')) {
        srcThumbnail = target.getAttribute('src');

        setStyle(target, {
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
        cursor: prefix + 'grab',
        transition: transformCssProp + ' ' + options.transitionDuration + ' ' + options.transitionTimingFunction,
        transform: calculateTransform()
      };

      // trigger transition
      originalStyles = setStyle(target, openStyles, true);
    };

    img.src = target.getAttribute('src');

    // insert overlay
    parent.appendChild(overlay);
    setTimeout(function () {
      overlay.style.opacity = options.bgOpacity;
    }, 30);

    document.addEventListener('scroll', scrollHandler);
    document.addEventListener('keydown', keydownHandler);

    target.addEventListener(transEndEvent, function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);
      target.addEventListener('mousedown', mousedownHandler);
      target.addEventListener('mousemove', mousemoveHandler);
      target.addEventListener('mouseup', mouseupHandler);
      target.addEventListener('touchstart', touchstartHandler);
      target.addEventListener('touchmove', touchmoveHandler);
      target.addEventListener('touchend', touchendHandler);

      lock = false;
      cb = cb || options.onOpen;
      if (cb) cb(target);
    });

    return this;
  },

  close: function close(cb) {
    if (!shown || lock || _grab) return;
    lock = true;

    // onBeforeClose event
    if (options.onBeforeClose) options.onBeforeClose(target);

    // remove overlay
    overlay.style.opacity = 0;

    target.style.transform = '';

    document.removeEventListener('scroll', scrollHandler);
    document.removeEventListener('keydown', keydownHandler);

    target.addEventListener(transEndEvent, function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);
      target.removeEventListener('mousedown', mousedownHandler);
      target.removeEventListener('mousemove', mousemoveHandler);
      target.removeEventListener('mouseup', mouseupHandler);
      target.removeEventListener('touchstart', touchstartHandler);
      target.removeEventListener('touchmove', touchmoveHandler);
      target.removeEventListener('touchend', touchendHandler);

      setStyle(target, originalStyles);
      parent.removeChild(overlay);
      shown = false;
      lock = false;
      _grab = false;

      // downgrade source if possible
      if (target.hasAttribute('data-original')) {
        target.setAttribute('src', srcThumbnail);
      }

      cb = typeof cb === 'function' ? cb : options.onClose;
      if (cb) cb(target);
    });

    return this;
  },

  grab: function grab(x, y, start, cb) {
    if (!shown || lock) return;
    _grab = true;

    // onBeforeGrab event
    if (options.onBeforeGrab) options.onBeforeGrab(target);

    var dx = x - window.innerWidth / 2;
    var dy = y - window.innerHeight / 2;
    var oldTransform = target.style.transform;
    var transform = oldTransform.replace(/translate3d\(.*?\)/i, 'translate3d(' + (translate.x + dx) + 'px,' + (translate.y + dy) + 'px, 0)').replace(/scale\([0-9|\.]*\)/i, 'scale(' + (scale + options.scaleExtra) + ')');

    setStyle(target, {
      cursor: prefix + 'grabbing',
      transition: transformCssProp + ' ' + (start ? options.transitionDuration + ' ' + options.transitionTimingFunction : 'ease'),
      transform: transform
    });

    target.addEventListener(transEndEvent, function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);
      cb = cb || options.onGrab;
      if (cb) cb(target);
    });
  },

  release: function release(cb) {
    if (!shown || lock || !_grab) return;

    // onBeforeRelease event
    if (options.onBeforeRelease) options.onBeforeRelease(target);

    setStyle(target, openStyles);

    target.addEventListener(transEndEvent, function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);
      _grab = false;

      cb = typeof cb === 'function' ? cb : options.onRelease;
      if (cb) cb(target);
    });

    return this;
  },

  listen: function listen(el) {
    if (typeof el === 'string') {
      var els = document.querySelectorAll(el);
      var i = els.length;

      while (i--) {
        this.listen(els[i]);
      }

      return this;
    }

    el.style.cursor = prefix + 'zoom-in';

    el.addEventListener('click', function (e) {
      e.preventDefault();

      if (shown) api.close();else api.open(el);
    });

    return this;
  }
};

setStyle(overlay, {
  zIndex: 998,
  background: options.bgColor,
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  opacity: 0,
  transition: 'opacity ' + options.transitionDuration + ' ' + options.transitionTimingFunction
});

overlay.addEventListener('click', api.close);
document.addEventListener('DOMContentLoaded', api.listen(options.defaultZoomable));

// helpers -------------------------------------------------------------------

function setStyle(el, styles, remember) {
  checkTrans(styles);
  var s = el.style;
  var original = {};

  for (var key in styles) {
    if (remember) original[key] = s[key] || '';
    s[key] = styles[key];
  }

  return original;
}

function sniffTransition() {
  var ret = {};
  var trans = ['webkitTransition', 'transition', 'mozTransition'];
  var tform = ['webkitTransform', 'transform', 'mozTransform'];
  var end = {
    'transition': 'transitionend',
    'mozTransition': 'transitionend',
    'webkitTransition': 'webkitTransitionEnd'
  };

  trans.some(function (prop) {
    if (overlay.style[prop] !== undefined) {
      ret.transition = prop;
      ret.transEnd = end[prop];
      return true;
    }
  });

  tform.some(function (prop) {
    if (overlay.style[prop] !== undefined) {
      ret.transform = prop;
      return true;
    }
  });

  return ret;
}

function checkTrans(styles) {
  var value;
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
}

function calculateTransform() {
  var imgHalfWidth = imgRect.width / 2;
  var imgHalfHeight = imgRect.height / 2;

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

  var transform = 'translate3d(' + translate.x + 'px,' + translate.y + 'px, 0) ' + 'scale(' + scale + ')';

  return transform;
}

// listeners -----------------------------------------------------------------

function scrollHandler() {
  var scrollTop = window.pageYOffset || (document.documentElement || body.parentNode || body).scrollTop;

  if (lastScrollPosition === null) lastScrollPosition = scrollTop;

  var deltaY = lastScrollPosition - scrollTop;

  if (Math.abs(deltaY) >= options.scrollThreshold) {
    lastScrollPosition = null;
    api.close();
  }
}

function keydownHandler(e) {
  var code = e.key || e.code;
  if (code === 'Escape' || e.keyCode === 27) api.close();
}

function mousedownHandler(e) {
  e.preventDefault();

  pressTimer = setTimeout(function () {
    press = true;
    api.grab(e.clientX, e.clientY, true);
  }, pressDelay);
}

function mousemoveHandler(e) {
  if (press) api.grab(e.clientX, e.clientY);
}

function mouseupHandler() {
  clearTimeout(pressTimer);
  press = false;
  api.release();
}

function touchstartHandler(e) {
  e.preventDefault();

  pressTimer = setTimeout(function () {
    press = true;
    var touch = e.touches[0];
    api.grab(touch.clientX, touch.clientY, true);
  }, pressDelay);
}

function touchmoveHandler(e) {
  if (press) {
    var touch = e.touches[0];
    api.grab(touch.clientX, touch.clientY);
  }
}

function touchendHandler() {
  clearTimeout(pressTimer);
  press = false;
  if (_grab) api.release();else api.close();
}

{
  // Enable LiveReload
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1"></' + 'script>');
}

return api;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9vcHRpb25zLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IG9wdGlvbnMgPSB7XG4gIGRlZmF1bHRab29tYWJsZTogJ2ltZ1tkYXRhLWFjdGlvbj1cInpvb21cIl0nLFxuICB0cmFuc2l0aW9uRHVyYXRpb246ICcuNHMnLFxuICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb246ICdjdWJpYy1iZXppZXIoLjQsMCwwLDEpJyxcbiAgYmdDb2xvcjogJyNmZmYnLFxuICBiZ09wYWNpdHk6IDEsXG4gIHNjYWxlQmFzZTogMS4wLFxuICBzY2FsZUV4dHJhOiAwLjUsXG4gIHNjcm9sbFRocmVzaG9sZDogNDAsXG4gIG9uT3BlbjogbnVsbCxcbiAgb25DbG9zZTogbnVsbCxcbiAgb25HcmFiOiBudWxsLFxuICBvblJlbGVhc2U6IG51bGwsXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcbiAgb25CZWZvcmVHcmFiOiBudWxsLFxuICBvbkJlZm9yZVJlbGVhc2U6IG51bGxcbn1cbiIsImltcG9ydCB7IG9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnXG5cbi8vIHdlYmtpdCBwcmVmaXggaGVscGVyXG5jb25zdCBwcmVmaXggPSAnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlID8gJy13ZWJraXQtJyA6ICcnXG5cbi8vIGVsZW1lbnRzXG5jb25zdCBib2R5ID0gZG9jdW1lbnQuYm9keVxuY29uc3Qgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5cbmxldCB0YXJnZXRcbmxldCBwYXJlbnRcblxuLy8gc3RhdGVcbmxldCBzaG93biA9IGZhbHNlXG5sZXQgbG9jayAgPSBmYWxzZVxubGV0IHByZXNzID0gZmFsc2VcbmxldCBncmFiID0gZmFsc2VcblxuLy8gc3R5bGVcbmxldCBvcmlnaW5hbFN0eWxlc1xubGV0IG9wZW5TdHlsZXNcbmxldCB0cmFuc2xhdGVcbmxldCBzY2FsZVxuXG5sZXQgc3JjVGh1bWJuYWlsXG5sZXQgaW1nUmVjdFxubGV0IHByZXNzVGltZXJcbmxldCBsYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG5cbmNvbnN0IHByZXNzRGVsYXkgPSAyMDBcblxuLy8gY29tcGF0aWJpbGl0eSBzdHVmZlxuY29uc3QgdHJhbnMgPSBzbmlmZlRyYW5zaXRpb24ob3ZlcmxheSlcbmNvbnN0IHRyYW5zaXRpb25Qcm9wID0gdHJhbnMudHJhbnNpdGlvblxuY29uc3QgdHJhbnNmb3JtUHJvcCA9IHRyYW5zLnRyYW5zZm9ybVxuY29uc3QgdHJhbnNmb3JtQ3NzUHJvcCA9IHRyYW5zZm9ybVByb3AucmVwbGFjZSgvKC4qKVRyYW5zZm9ybS8sICctJDEtdHJhbnNmb3JtJylcbmNvbnN0IHRyYW5zRW5kRXZlbnQgPSB0cmFucy50cmFuc0VuZFxuXG5jb25zdCBhcGkgPSB7XG5cbiAgY29uZmlnOiBmdW5jdGlvbiAob3B0cykge1xuICAgIGlmICghb3B0cykgcmV0dXJuIG9wdGlvbnNcblxuICAgIGZvciAodmFyIGtleSBpbiBvcHRzKSB7XG4gICAgICBvcHRpb25zW2tleV0gPSBvcHRzW2tleV1cbiAgICB9XG5cbiAgICBzZXRTdHlsZShvdmVybGF5LCB7XG4gICAgICBiYWNrZ3JvdW5kQ29sb3I6IG9wdGlvbnMuYmdDb2xvcixcbiAgICAgIHRyYW5zaXRpb246ICdvcGFjaXR5ICcgK1xuICAgICAgICBvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArXG4gICAgICAgIG9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH0sXG5cbiAgb3BlbjogZnVuY3Rpb24gKGVsLCBjYikge1xuICAgIGlmIChzaG93biB8fCBsb2NrIHx8IGdyYWIpIHJldHVyblxuXG4gICAgdGFyZ2V0ID0gdHlwZW9mIGVsID09PSAnc3RyaW5nJ1xuICAgICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKVxuICAgICAgOiBlbFxuXG4gICAgaWYgKHRhcmdldC50YWdOYW1lICE9PSAnSU1HJykgcmV0dXJuXG5cbiAgICAvLyBvbkJlZm9yZU9wZW4gZXZlbnRcbiAgICBpZiAob3B0aW9ucy5vbkJlZm9yZU9wZW4pIG9wdGlvbnMub25CZWZvcmVPcGVuKHRhcmdldClcblxuICAgIHNob3duID0gdHJ1ZVxuICAgIGxvY2sgPSB0cnVlXG4gICAgcGFyZW50ID0gdGFyZ2V0LnBhcmVudE5vZGVcblxuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKVxuXG4gICAgaW1nLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaW1nUmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuXG4gICAgICAvLyB1cGdyYWRlIHNvdXJjZSBpZiBwb3NzaWJsZVxuICAgICAgaWYgKHRhcmdldC5oYXNBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSkge1xuICAgICAgICBzcmNUaHVtYm5haWwgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdzcmMnKVxuXG4gICAgICAgIHNldFN0eWxlKHRhcmdldCwge1xuICAgICAgICAgIHdpZHRoOiBpbWdSZWN0LndpZHRoICsgJ3B4JyxcbiAgICAgICAgICBoZWlnaHQ6IGltZ1JlY3QuaGVpZ2h0ICsgJ3B4J1xuICAgICAgICB9KVxuXG4gICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSlcbiAgICAgIH1cblxuICAgICAgLy8gZm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgICAgdGFyZ2V0Lm9mZnNldFdpZHRoXG5cbiAgICAgIG9wZW5TdHlsZXMgPSB7XG4gICAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgICB6SW5kZXg6IDk5OSxcbiAgICAgICAgY3Vyc29yOiBwcmVmaXggKyAnZ3JhYicsXG4gICAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybUNzc1Byb3AgKyAnICcgK1xuICAgICAgICAgIG9wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9uICsgJyAnICtcbiAgICAgICAgICBvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbixcbiAgICAgICAgdHJhbnNmb3JtOiBjYWxjdWxhdGVUcmFuc2Zvcm0oKVxuICAgICAgfVxuXG4gICAgICAvLyB0cmlnZ2VyIHRyYW5zaXRpb25cbiAgICAgIG9yaWdpbmFsU3R5bGVzID0gc2V0U3R5bGUodGFyZ2V0LCBvcGVuU3R5bGVzLCB0cnVlKVxuICAgIH1cblxuICAgIGltZy5zcmMgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdzcmMnKVxuXG4gICAgLy8gaW5zZXJ0IG92ZXJsYXlcbiAgICBwYXJlbnQuYXBwZW5kQ2hpbGQob3ZlcmxheSlcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgb3ZlcmxheS5zdHlsZS5vcGFjaXR5ID0gb3B0aW9ucy5iZ09wYWNpdHlcbiAgICB9LCAzMClcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIHNjcm9sbEhhbmRsZXIpXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGtleWRvd25IYW5kbGVyKVxuXG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgZnVuY3Rpb24gb25FbmQgKCkge1xuICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgbW91c2Vkb3duSGFuZGxlcilcbiAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBtb3VzZW1vdmVIYW5kbGVyKVxuICAgICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBtb3VzZXVwSGFuZGxlcilcbiAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdG91Y2hzdGFydEhhbmRsZXIpXG4gICAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdG91Y2htb3ZlSGFuZGxlcilcbiAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRvdWNoZW5kSGFuZGxlcilcblxuICAgICAgbG9jayA9IGZhbHNlXG4gICAgICBjYiA9IGNiIHx8IG9wdGlvbnMub25PcGVuXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfSxcblxuICBjbG9zZTogZnVuY3Rpb24gKGNiKSB7XG4gICAgaWYgKCFzaG93biB8fCBsb2NrIHx8IGdyYWIpIHJldHVyblxuICAgIGxvY2sgPSB0cnVlXG5cbiAgICAvLyBvbkJlZm9yZUNsb3NlIGV2ZW50XG4gICAgaWYgKG9wdGlvbnMub25CZWZvcmVDbG9zZSkgb3B0aW9ucy5vbkJlZm9yZUNsb3NlKHRhcmdldClcblxuICAgIC8vIHJlbW92ZSBvdmVybGF5XG4gICAgb3ZlcmxheS5zdHlsZS5vcGFjaXR5ID0gMFxuXG4gICAgdGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICcnXG5cbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdzY3JvbGwnLCBzY3JvbGxIYW5kbGVyKVxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBrZXlkb3duSGFuZGxlcilcblxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRyYW5zRW5kRXZlbnQsIGZ1bmN0aW9uIG9uRW5kICgpIHtcbiAgICAgIHRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG1vdXNlZG93bkhhbmRsZXIpXG4gICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgbW91c2Vtb3ZlSGFuZGxlcilcbiAgICAgIHRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgbW91c2V1cEhhbmRsZXIpXG4gICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRvdWNoc3RhcnRIYW5kbGVyKVxuICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRvdWNobW92ZUhhbmRsZXIpXG4gICAgICB0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0b3VjaGVuZEhhbmRsZXIpXG5cbiAgICAgIHNldFN0eWxlKHRhcmdldCwgb3JpZ2luYWxTdHlsZXMpXG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQob3ZlcmxheSlcbiAgICAgIHNob3duID0gZmFsc2VcbiAgICAgIGxvY2sgPSBmYWxzZVxuICAgICAgZ3JhYiA9IGZhbHNlXG5cbiAgICAgIC8vIGRvd25ncmFkZSBzb3VyY2UgaWYgcG9zc2libGVcbiAgICAgIGlmICh0YXJnZXQuaGFzQXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsJykpIHtcbiAgICAgICAgdGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgc3JjVGh1bWJuYWlsKVxuICAgICAgfVxuXG4gICAgICBjYiA9IHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICA/IGNiXG4gICAgICAgIDogb3B0aW9ucy5vbkNsb3NlXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfSxcblxuICBncmFiOiBmdW5jdGlvbih4LCB5LCBzdGFydCwgY2IpIHtcbiAgICBpZiAoIXNob3duIHx8IGxvY2spIHJldHVyblxuICAgIGdyYWIgPSB0cnVlXG5cbiAgICAvLyBvbkJlZm9yZUdyYWIgZXZlbnRcbiAgICBpZiAob3B0aW9ucy5vbkJlZm9yZUdyYWIpIG9wdGlvbnMub25CZWZvcmVHcmFiKHRhcmdldClcblxuICAgIGNvbnN0IGR4ID0geCAtIHdpbmRvdy5pbm5lcldpZHRoIC8gMlxuICAgIGNvbnN0IGR5ID0geSAtIHdpbmRvdy5pbm5lckhlaWdodCAvIDJcbiAgICBjb25zdCBvbGRUcmFuc2Zvcm0gPSB0YXJnZXQuc3R5bGUudHJhbnNmb3JtXG4gICAgY29uc3QgdHJhbnNmb3JtID0gb2xkVHJhbnNmb3JtXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAvdHJhbnNsYXRlM2RcXCguKj9cXCkvaSxcbiAgICAgICAgICAgICd0cmFuc2xhdGUzZCgnICsgKHRyYW5zbGF0ZS54ICsgZHgpICsgJ3B4LCcgKyAodHJhbnNsYXRlLnkgKyBkeSkgKyAncHgsIDApJylcbiAgICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAgIC9zY2FsZVxcKFswLTl8XFwuXSpcXCkvaSxcbiAgICAgICAgICAgICdzY2FsZSgnICsgKHNjYWxlICsgb3B0aW9ucy5zY2FsZUV4dHJhKSArICcpJylcblxuICAgIHNldFN0eWxlKHRhcmdldCwge1xuICAgICAgY3Vyc29yOiBwcmVmaXggKyAnZ3JhYmJpbmcnLFxuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtQ3NzUHJvcCArICcgJyArIChcbiAgICAgICAgc3RhcnRcbiAgICAgICAgPyBvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArIG9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgICAgIDogJ2Vhc2UnXG4gICAgICApLFxuICAgICAgdHJhbnNmb3JtOiB0cmFuc2Zvcm1cbiAgICB9KVxuXG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgZnVuY3Rpb24gb25FbmQgKCkge1xuICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICBjYiA9IGNiIHx8IG9wdGlvbnMub25HcmFiXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9KVxuICB9LFxuXG4gIHJlbGVhc2U6IGZ1bmN0aW9uKGNiKSB7XG4gICAgaWYgKCFzaG93biB8fCBsb2NrIHx8ICFncmFiKSByZXR1cm5cblxuICAgIC8vIG9uQmVmb3JlUmVsZWFzZSBldmVudFxuICAgIGlmIChvcHRpb25zLm9uQmVmb3JlUmVsZWFzZSkgb3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UodGFyZ2V0KVxuXG4gICAgc2V0U3R5bGUodGFyZ2V0LCBvcGVuU3R5bGVzKVxuXG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgZnVuY3Rpb24gb25FbmQgKCkge1xuICAgICAgdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICBncmFiID0gZmFsc2VcblxuICAgICAgY2IgPSB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbidcbiAgICAgICAgPyBjYlxuICAgICAgICA6IG9wdGlvbnMub25SZWxlYXNlXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfSxcblxuICBsaXN0ZW46IGZ1bmN0aW9uIChlbCkge1xuICAgIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGVsKVxuICAgICAgbGV0IGkgPSBlbHMubGVuZ3RoXG5cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5saXN0ZW4oZWxzW2ldKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGVsLnN0eWxlLmN1cnNvciA9IHByZWZpeCArICd6b29tLWluJ1xuXG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgICAgaWYgKHNob3duKSBhcGkuY2xvc2UoKVxuICAgICAgZWxzZSBhcGkub3BlbihlbClcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxufVxuXG5zZXRTdHlsZShvdmVybGF5LCB7XG4gIHpJbmRleDogOTk4LFxuICBiYWNrZ3JvdW5kOiBvcHRpb25zLmJnQ29sb3IsXG4gIHBvc2l0aW9uOiAnZml4ZWQnLFxuICB0b3A6IDAsXG4gIGxlZnQ6IDAsXG4gIHJpZ2h0OiAwLFxuICBib3R0b206IDAsXG4gIG9wYWNpdHk6IDAsXG4gIHRyYW5zaXRpb246ICdvcGFjaXR5ICcgK1xuICAgIG9wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9uICsgJyAnICtcbiAgICBvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxufSlcblxub3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFwaS5jbG9zZSlcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBhcGkubGlzdGVuKG9wdGlvbnMuZGVmYXVsdFpvb21hYmxlKSlcblxuLy8gaGVscGVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIHNldFN0eWxlIChlbCwgc3R5bGVzLCByZW1lbWJlcikge1xuICBjaGVja1RyYW5zKHN0eWxlcylcbiAgbGV0IHMgPSBlbC5zdHlsZVxuICBsZXQgb3JpZ2luYWwgPSB7fVxuXG4gIGZvciAodmFyIGtleSBpbiBzdHlsZXMpIHtcbiAgICBpZiAocmVtZW1iZXIpIG9yaWdpbmFsW2tleV0gPSBzW2tleV0gfHwgJydcbiAgICBzW2tleV0gPSBzdHlsZXNba2V5XVxuICB9XG5cbiAgcmV0dXJuIG9yaWdpbmFsXG59XG5cbmZ1bmN0aW9uIHNuaWZmVHJhbnNpdGlvbiAoKSB7XG4gIGxldCByZXQgICA9IHt9XG4gIGNvbnN0IHRyYW5zID0gWyd3ZWJraXRUcmFuc2l0aW9uJywgJ3RyYW5zaXRpb24nLCAnbW96VHJhbnNpdGlvbiddXG4gIGNvbnN0IHRmb3JtID0gWyd3ZWJraXRUcmFuc2Zvcm0nLCAndHJhbnNmb3JtJywgJ21velRyYW5zZm9ybSddXG4gIGNvbnN0IGVuZCAgID0ge1xuICAgICd0cmFuc2l0aW9uJyAgICAgICA6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAnbW96VHJhbnNpdGlvbicgICAgOiAndHJhbnNpdGlvbmVuZCcsXG4gICAgJ3dlYmtpdFRyYW5zaXRpb24nIDogJ3dlYmtpdFRyYW5zaXRpb25FbmQnXG4gIH1cblxuICB0cmFucy5zb21lKGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgaWYgKG92ZXJsYXkuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0LnRyYW5zaXRpb24gPSBwcm9wXG4gICAgICByZXQudHJhbnNFbmQgPSBlbmRbcHJvcF1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHRmb3JtLnNvbWUoZnVuY3Rpb24gKHByb3ApIHtcbiAgICBpZiAob3ZlcmxheS5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXQudHJhbnNmb3JtID0gcHJvcFxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBjaGVja1RyYW5zIChzdHlsZXMpIHtcbiAgdmFyIHZhbHVlXG4gIGlmIChzdHlsZXMudHJhbnNpdGlvbikge1xuICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zaXRpb25cbiAgICBkZWxldGUgc3R5bGVzLnRyYW5zaXRpb25cbiAgICBzdHlsZXNbdHJhbnNpdGlvblByb3BdID0gdmFsdWVcbiAgfVxuICBpZiAoc3R5bGVzLnRyYW5zZm9ybSkge1xuICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNmb3JtXG4gICAgc3R5bGVzW3RyYW5zZm9ybVByb3BdID0gdmFsdWVcbiAgfVxufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVUcmFuc2Zvcm0gKCkge1xuICBjb25zdCBpbWdIYWxmV2lkdGggPSBpbWdSZWN0LndpZHRoIC8gMlxuICBjb25zdCBpbWdIYWxmSGVpZ2h0ID0gaW1nUmVjdC5oZWlnaHQgLyAyXG5cbiAgY29uc3QgaW1nQ2VudGVyID0ge1xuICAgIHg6IGltZ1JlY3QubGVmdCArIGltZ0hhbGZXaWR0aCxcbiAgICB5OiBpbWdSZWN0LnRvcCArIGltZ0hhbGZIZWlnaHRcbiAgfVxuXG4gIGNvbnN0IHdpbmRvd0NlbnRlciA9IHtcbiAgICB4OiB3aW5kb3cuaW5uZXJXaWR0aCAvIDIsXG4gICAgeTogd2luZG93LmlubmVySGVpZ2h0IC8gMlxuICB9XG5cbiAgLy8gVGhlIGRpc3RhbmNlIGJldHdlZW4gaW1hZ2UgZWRnZSBhbmQgd2luZG93IGVkZ2VcbiAgY29uc3QgZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UgPSB7XG4gICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdIYWxmV2lkdGgsXG4gICAgeTogd2luZG93Q2VudGVyLnkgLSBpbWdIYWxmSGVpZ2h0XG4gIH1cblxuICBjb25zdCBzY2FsZUhvcml6b250YWxseSA9IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlLnggLyBpbWdIYWxmV2lkdGhcbiAgY29uc3Qgc2NhbGVWZXJ0aWNhbGx5ID0gZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UueSAvIGltZ0hhbGZIZWlnaHRcblxuICAvLyBUaGUgdmVjdG9yIHRvIHRyYW5zbGF0ZSBpbWFnZSB0byB0aGUgd2luZG93IGNlbnRlclxuICB0cmFuc2xhdGUgPSB7XG4gICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdDZW50ZXIueCxcbiAgICB5OiB3aW5kb3dDZW50ZXIueSAtIGltZ0NlbnRlci55XG4gIH1cblxuICAvLyBUaGUgYWRkaXRpb25hbCBzY2FsZSBpcyBiYXNlZCBvbiB0aGUgc21hbGxlciB2YWx1ZSBvZlxuICAvLyBzY2FsaW5nIGhvcml6b250YWxseSBhbmQgc2NhbGluZyB2ZXJ0aWNhbGx5XG4gIHNjYWxlID0gb3B0aW9ucy5zY2FsZUJhc2UgKyBNYXRoLm1pbihzY2FsZUhvcml6b250YWxseSwgc2NhbGVWZXJ0aWNhbGx5KVxuXG4gIGNvbnN0IHRyYW5zZm9ybSA9XG4gICAgICAndHJhbnNsYXRlM2QoJyArIHRyYW5zbGF0ZS54ICsgJ3B4LCcgKyB0cmFuc2xhdGUueSArICdweCwgMCkgJyArXG4gICAgICAnc2NhbGUoJyArIHNjYWxlICsgJyknXG5cbiAgcmV0dXJuIHRyYW5zZm9ybVxufVxuXG4vLyBsaXN0ZW5lcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gc2Nyb2xsSGFuZGxlciAoKSB7XG4gIHZhciBzY3JvbGxUb3AgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHxcbiAgICAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50IHx8IGJvZHkucGFyZW50Tm9kZSB8fCBib2R5KS5zY3JvbGxUb3BcblxuICBpZiAobGFzdFNjcm9sbFBvc2l0aW9uID09PSBudWxsKSBsYXN0U2Nyb2xsUG9zaXRpb24gPSBzY3JvbGxUb3BcblxuICB2YXIgZGVsdGFZID0gbGFzdFNjcm9sbFBvc2l0aW9uIC0gc2Nyb2xsVG9wXG5cbiAgaWYgKE1hdGguYWJzKGRlbHRhWSkgPj0gb3B0aW9ucy5zY3JvbGxUaHJlc2hvbGQpIHtcbiAgICBsYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgYXBpLmNsb3NlKClcbiAgfVxufVxuXG5mdW5jdGlvbiBrZXlkb3duSGFuZGxlciAoZSkge1xuICB2YXIgY29kZSA9IGUua2V5IHx8IGUuY29kZVxuICBpZiAoY29kZSA9PT0gJ0VzY2FwZScgfHwgZS5rZXlDb2RlID09PSAyNykgYXBpLmNsb3NlKClcbn1cblxuZnVuY3Rpb24gbW91c2Vkb3duSGFuZGxlciAoZSkge1xuICBlLnByZXZlbnREZWZhdWx0KClcblxuICBwcmVzc1RpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICBwcmVzcyA9IHRydWVcbiAgICBhcGkuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSwgdHJ1ZSlcbiAgfSwgcHJlc3NEZWxheSlcbn1cblxuZnVuY3Rpb24gbW91c2Vtb3ZlSGFuZGxlciAoZSkge1xuICBpZiAocHJlc3MpIGFwaS5ncmFiKGUuY2xpZW50WCwgZS5jbGllbnRZKVxufVxuXG5mdW5jdGlvbiBtb3VzZXVwSGFuZGxlciAoKSB7XG4gIGNsZWFyVGltZW91dChwcmVzc1RpbWVyKVxuICBwcmVzcyA9IGZhbHNlXG4gIGFwaS5yZWxlYXNlKClcbn1cblxuZnVuY3Rpb24gdG91Y2hzdGFydEhhbmRsZXIgKGUpIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgcHJlc3NUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgcHJlc3MgPSB0cnVlXG4gICAgdmFyIHRvdWNoID0gZS50b3VjaGVzWzBdXG4gICAgYXBpLmdyYWIodG91Y2guY2xpZW50WCwgdG91Y2guY2xpZW50WSwgdHJ1ZSlcbiAgfSwgcHJlc3NEZWxheSlcbn1cblxuZnVuY3Rpb24gdG91Y2htb3ZlSGFuZGxlciAoZSkge1xuICBpZiAocHJlc3MpIHtcbiAgICB2YXIgdG91Y2ggPSBlLnRvdWNoZXNbMF1cbiAgICBhcGkuZ3JhYih0b3VjaC5jbGllbnRYLCB0b3VjaC5jbGllbnRZKVxuICB9XG59XG5cbmZ1bmN0aW9uIHRvdWNoZW5kSGFuZGxlciAoKSB7XG4gIGNsZWFyVGltZW91dChwcmVzc1RpbWVyKVxuICBwcmVzcyA9IGZhbHNlXG4gIGlmIChncmFiKSBhcGkucmVsZWFzZSgpXG4gIGVsc2UgYXBpLmNsb3NlKClcbn1cblxuaWYgKEVOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIC8vIEVuYWJsZSBMaXZlUmVsb2FkXG4gIGRvY3VtZW50LndyaXRlKFxuICAgICc8c2NyaXB0IHNyYz1cImh0dHA6Ly8nICsgKGxvY2F0aW9uLmhvc3QgfHwgJ2xvY2FsaG9zdCcpLnNwbGl0KCc6JylbMF0gK1xuICAgICc6MzU3MjkvbGl2ZXJlbG9hZC5qcz9zbmlwdmVyPTFcIj48LycgKyAnc2NyaXB0PidcbiAgKVxufVxuXG5cbmV4cG9ydCBkZWZhdWx0IGFwaVxuIl0sIm5hbWVzIjpbIm9wdGlvbnMiLCJwcmVmaXgiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsInN0eWxlIiwiYm9keSIsIm92ZXJsYXkiLCJjcmVhdGVFbGVtZW50IiwidGFyZ2V0IiwicGFyZW50Iiwic2hvd24iLCJsb2NrIiwicHJlc3MiLCJncmFiIiwib3JpZ2luYWxTdHlsZXMiLCJvcGVuU3R5bGVzIiwidHJhbnNsYXRlIiwic2NhbGUiLCJzcmNUaHVtYm5haWwiLCJpbWdSZWN0IiwicHJlc3NUaW1lciIsImxhc3RTY3JvbGxQb3NpdGlvbiIsInByZXNzRGVsYXkiLCJ0cmFucyIsInNuaWZmVHJhbnNpdGlvbiIsInRyYW5zaXRpb25Qcm9wIiwidHJhbnNpdGlvbiIsInRyYW5zZm9ybVByb3AiLCJ0cmFuc2Zvcm0iLCJ0cmFuc2Zvcm1Dc3NQcm9wIiwicmVwbGFjZSIsInRyYW5zRW5kRXZlbnQiLCJ0cmFuc0VuZCIsImFwaSIsIm9wdHMiLCJrZXkiLCJiZ0NvbG9yIiwidHJhbnNpdGlvbkR1cmF0aW9uIiwidHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uIiwiZWwiLCJjYiIsInF1ZXJ5U2VsZWN0b3IiLCJ0YWdOYW1lIiwib25CZWZvcmVPcGVuIiwicGFyZW50Tm9kZSIsImltZyIsIkltYWdlIiwib25sb2FkIiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiaGFzQXR0cmlidXRlIiwiZ2V0QXR0cmlidXRlIiwid2lkdGgiLCJoZWlnaHQiLCJzZXRBdHRyaWJ1dGUiLCJvZmZzZXRXaWR0aCIsImNhbGN1bGF0ZVRyYW5zZm9ybSIsInNldFN0eWxlIiwic3JjIiwiYXBwZW5kQ2hpbGQiLCJvcGFjaXR5IiwiYmdPcGFjaXR5IiwiYWRkRXZlbnRMaXN0ZW5lciIsInNjcm9sbEhhbmRsZXIiLCJrZXlkb3duSGFuZGxlciIsIm9uRW5kIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm1vdXNlZG93bkhhbmRsZXIiLCJtb3VzZW1vdmVIYW5kbGVyIiwibW91c2V1cEhhbmRsZXIiLCJ0b3VjaHN0YXJ0SGFuZGxlciIsInRvdWNobW92ZUhhbmRsZXIiLCJ0b3VjaGVuZEhhbmRsZXIiLCJvbk9wZW4iLCJvbkJlZm9yZUNsb3NlIiwicmVtb3ZlQ2hpbGQiLCJvbkNsb3NlIiwieCIsInkiLCJzdGFydCIsIm9uQmVmb3JlR3JhYiIsImR4Iiwid2luZG93IiwiaW5uZXJXaWR0aCIsImR5IiwiaW5uZXJIZWlnaHQiLCJvbGRUcmFuc2Zvcm0iLCJzY2FsZUV4dHJhIiwib25HcmFiIiwib25CZWZvcmVSZWxlYXNlIiwib25SZWxlYXNlIiwiZWxzIiwicXVlcnlTZWxlY3RvckFsbCIsImkiLCJsZW5ndGgiLCJsaXN0ZW4iLCJjdXJzb3IiLCJlIiwicHJldmVudERlZmF1bHQiLCJjbG9zZSIsIm9wZW4iLCJkZWZhdWx0Wm9vbWFibGUiLCJzdHlsZXMiLCJyZW1lbWJlciIsInMiLCJvcmlnaW5hbCIsInJldCIsInRmb3JtIiwiZW5kIiwic29tZSIsInByb3AiLCJ1bmRlZmluZWQiLCJjaGVja1RyYW5zIiwidmFsdWUiLCJpbWdIYWxmV2lkdGgiLCJpbWdIYWxmSGVpZ2h0IiwiaW1nQ2VudGVyIiwibGVmdCIsInRvcCIsIndpbmRvd0NlbnRlciIsImRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlIiwic2NhbGVIb3Jpem9udGFsbHkiLCJzY2FsZVZlcnRpY2FsbHkiLCJzY2FsZUJhc2UiLCJNYXRoIiwibWluIiwic2Nyb2xsVG9wIiwicGFnZVlPZmZzZXQiLCJkZWx0YVkiLCJhYnMiLCJzY3JvbGxUaHJlc2hvbGQiLCJjb2RlIiwia2V5Q29kZSIsInNldFRpbWVvdXQiLCJjbGllbnRYIiwiY2xpZW50WSIsInJlbGVhc2UiLCJ0b3VjaCIsInRvdWNoZXMiLCJFTlYiLCJ3cml0ZSIsImxvY2F0aW9uIiwiaG9zdCIsInNwbGl0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBTyxJQUFNQSxVQUFVO21CQUNKLHlCQURJO3NCQUVELEtBRkM7NEJBR0ssd0JBSEw7V0FJWixNQUpZO2FBS1Ys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
