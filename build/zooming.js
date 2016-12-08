(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Zooming = factory());
}(this, (function () { 'use strict';

// webkit prefix
var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : '';
var pressDelay = 200;

var defaults = {
  zoomable: 'img[data-action="zoom"]',
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

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

















var set = function set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

var Zooming$1 = function () {
  function Zooming(opts) {
    classCallCheck(this, Zooming);


    // elements
    this.body = document.body;
    this.overlay = document.createElement('div');
    this.target;
    this.parent;

    // state
    this._shown = false;
    this._lock = false;
    this._press = false;
    this._grab = false;
    this._lastScrollPosition = null;

    // style
    this.originalStyles;
    this.openStyles;
    this.translate;
    this.scale;

    this.srcThumbnail;
    this.imgRect;
    this.pressTimer;

    this.trans = sniffTransition(this.overlay);
    this.setStyleHelper = checkTrans(this.trans.transitionProp, this.trans.transformProp);

    this._init(opts);
  }

  createClass(Zooming, [{
    key: 'config',
    value: function config(opts) {
      if (!opts) return this;

      for (var key in opts) {
        this.options[key] = opts[key];
      }

      this._setStyle(this.overlay, {
        backgroundColor: this.options.bgColor,
        transition: 'opacity ' + this.options.transitionDuration + ' ' + this.options.transitionTimingFunction
      });

      return this;
    }
  }, {
    key: 'open',
    value: function open(el, cb) {
      if (this._shown || this._lock || this._grab) return;

      this.target = typeof el === 'string' ? document.querySelector(el) : el;

      if (this.target.tagName !== 'IMG') return;

      // onBeforeOpen event
      if (this.options.onBeforeOpen) this.options.onBeforeOpen(this.target);

      this._shown = true;
      this._lock = true;
      this.parent = this.target.parentNode;

      var img = new Image();
      img.onload = this._imgOnload();
      img.src = this.target.getAttribute('src');

      this._insertOverlay();

      document.addEventListener('scroll', this.scrollHandler);
      document.addEventListener('keydown', this.keydownHandler);

      this.target.addEventListener(this.trans.transEndEvent, function onEnd() {
        this.target.removeEventListener(this.trans.transEndEvent, onEnd);
        if (this.options.enableGrab) this._addGrabListeners();

        this._lock = false;
        cb = cb || this.options.onOpen;
        if (cb) cb(this.target);
      }.bind(this));

      return this;
    }
  }, {
    key: 'close',
    value: function close(cb) {
      if (!this._shown || this._lock || this._grab) return;
      this._lock = true;

      // onBeforeClose event
      if (this.options.onBeforeClose) this.options.onBeforeClose(this.target);

      this._removeOverlay();

      this.target.style.transform = '';

      document.removeEventListener('scroll', this.scrollHandler);
      document.removeEventListener('keydown', this.keydownHandler);

      this.target.addEventListener(this.trans.transEndEvent, function onEnd() {
        this.target.removeEventListener(this.trans.transEndEvent, onEnd);
        if (this.options.enableGrab) this._removeGrabListeners();

        this._setStyle(this.target, this.originalStyles);
        this.parent.removeChild(this.overlay);
        this._shown = false;
        this._lock = false;
        this._grab = false;

        // downgrade source if possible
        if (this.target.hasAttribute('data-original')) {
          this.target.setAttribute('src', this.srcThumbnail);
        }

        cb = typeof cb === 'function' ? cb : this.options.onClose;
        if (cb) cb(this.target);
      }.bind(this));

      return this;
    }
  }, {
    key: 'grab',
    value: function grab(x, y, start, cb) {
      if (!this._shown || this._lock) return;
      this._grab = true;

      // onBeforeGrab event
      if (this.options.onBeforeGrab) this.options.onBeforeGrab(this.target);

      var dx = x - window.innerWidth / 2;
      var dy = y - window.innerHeight / 2;
      var oldTransform = this.target.style.transform;
      var transform = oldTransform.replace(/translate3d\(.*?\)/i, 'translate3d(' + (this.translate.x + dx) + 'px,' + (this.translate.y + dy) + 'px, 0)').replace(/scale\([0-9|\.]*\)/i, 'scale(' + (this.scale + this.options.scaleExtra) + ')');

      this._setStyle(this.target, {
        cursor: prefix + 'grabbing',
        transition: this.trans.transformCssProp + ' ' + (start ? this.options.transitionDuration + ' ' + this.options.transitionTimingFunction : 'ease'),
        transform: transform
      });

      this.target.addEventListener(this.trans.transEndEvent, function onEnd() {
        this.target.removeEventListener(this.trans.transEndEvent, onEnd);

        cb = typeof cb === 'function' ? cb : this.options.onGrab;
        if (cb) cb(this.target);
      }.bind(this));
    }
  }, {
    key: 'release',
    value: function release(cb) {
      if (!this._shown || this._lock || !this._grab) return;

      // onBeforeRelease event
      if (this.options.onBeforeRelease) this.options.onBeforeRelease(this.target);

      this._setStyle(this.target, this.openStyles);

      this.target.addEventListener(this.trans.transEndEvent, function onEnd() {
        this.target.removeEventListener(this.trans.transEndEvent, onEnd);
        this._grab = false;

        cb = typeof cb === 'function' ? cb : this.options.onRelease;
        if (cb) cb(this.target);
      }.bind(this));

      return this;
    }
  }, {
    key: 'listen',
    value: function listen(el) {
      var _this = this;

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

        if (_this._shown) _this.close();else _this.open(el);
      });

      return this;
    }
  }, {
    key: '_init',
    value: function _init(opts) {
      // config options
      this.options = {};
      Object.assign(this.options, defaults);
      this.config(opts);

      // initial overlay setup
      this._setStyle(this.overlay, {
        zIndex: 998,
        background: this.options.bgColor,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0,
        transition: 'opacity ' + this.options.transitionDuration + ' ' + this.options.transitionTimingFunction
      });

      this.overlay.addEventListener('click', this.close);

      this.scrollHandler = this.scrollHandler.bind(this);
      this.keydownHandler = this.keydownHandler.bind(this);

      if (this.options.enableGrab) {
        this.mousedownHandler = this.mousedownHandler.bind(this);
        this.mousemoveHandler = this.mousemoveHandler.bind(this);
        this.mouseupHandler = this.mouseupHandler.bind(this);
        this.touchstartHandler = this.touchstartHandler.bind(this);
        this.touchmoveHandler = this.touchmoveHandler.bind(this);
        this.touchendHandler = this.touchendHandler.bind(this);
      }
    }
  }, {
    key: '_imgOnload',
    value: function _imgOnload() {
      this.imgRect = this.target.getBoundingClientRect();

      // upgrade source if possible
      if (this.target.hasAttribute('data-original')) {
        this.srcThumbnail = this.target.getAttribute('src');

        this._setStyle(this.target, {
          width: this.imgRect.width + 'px',
          height: this.imgRect.height + 'px'
        });

        this.target.setAttribute('src', this.target.getAttribute('data-original'));
      }

      // force layout update
      this.target.offsetWidth;

      this.openStyles = {
        position: 'relative',
        zIndex: 999,
        cursor: prefix + (this.options.enableGrab ? 'grab' : 'zoom-out'),
        transition: this.trans.transformCssProp + ' ' + this.options.transitionDuration + ' ' + this.options.transitionTimingFunction,
        transform: this._calculateTransform()
      };

      // trigger transition
      this.originalStyles = this._setStyle(this.target, this.openStyles, true);
    }
  }, {
    key: '_insertOverlay',
    value: function _insertOverlay() {
      var _this2 = this;

      this.parent.appendChild(this.overlay);

      setTimeout(function () {
        _this2.overlay.style.opacity = _this2.options.bgOpacity;
      }, 30);
    }
  }, {
    key: '_removeOverlay',
    value: function _removeOverlay() {
      this.overlay.style.opacity = 0;
    }
  }, {
    key: '_setStyle',
    value: function _setStyle(el, styles, remember) {
      return this.setStyleHelper(el, styles, remember);
    }
  }, {
    key: '_calculateTransform',
    value: function _calculateTransform() {
      var imgHalfWidth = this.imgRect.width / 2;
      var imgHalfHeight = this.imgRect.height / 2;

      var imgCenter = {
        x: this.imgRect.left + imgHalfWidth,
        y: this.imgRect.top + imgHalfHeight
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
      this.translate = {
        x: windowCenter.x - imgCenter.x,
        y: windowCenter.y - imgCenter.y
      };

      // The additional scale is based on the smaller value of
      // scaling horizontally and scaling vertically
      this.scale = this.options.scaleBase + Math.min(scaleHorizontally, scaleVertically);

      var transform = 'translate3d(' + this.translate.x + 'px,' + this.translate.y + 'px, 0) ' + 'scale(' + this.scale + ')';

      return transform;
    }
  }, {
    key: '_addGrabListeners',
    value: function _addGrabListeners() {
      this.target.addEventListener('mousedown', this.mousedownHandler);
      this.target.addEventListener('mousemove', this.mousemoveHandler);
      this.target.addEventListener('mouseup', this.mouseupHandler);
      this.target.addEventListener('touchstart', this.touchstartHandler);
      this.target.addEventListener('touchmove', this.touchmoveHandler);
      this.target.addEventListener('touchend', this.touchendHandler);
    }
  }, {
    key: '_removeGrabListeners',
    value: function _removeGrabListeners() {
      this.target.removeEventListener('mousedown', this.mousedownHandler);
      this.target.removeEventListener('mousemove', this.mousemoveHandler);
      this.target.removeEventListener('mouseup', this.mouseupHandler);
      this.target.removeEventListener('touchstart', this.touchstartHandler);
      this.target.removeEventListener('touchmove', this.touchmoveHandler);
      this.target.removeEventListener('touchend', this.touchendHandler);
    }

    // listeners -----------------------------------------------------------------

  }, {
    key: 'scrollHandler',
    value: function scrollHandler() {
      var scrollTop = window.pageYOffset || (document.documentElement || this.body.parentNode || this.body).scrollTop;

      if (this._lastScrollPosition === null) this._lastScrollPosition = scrollTop;

      var deltaY = this._lastScrollPosition - scrollTop;

      if (Math.abs(deltaY) >= this.options.scrollThreshold) {
        this._lastScrollPosition = null;
        this.close();
      }
    }
  }, {
    key: 'keydownHandler',
    value: function keydownHandler(e) {
      var code = e.key || e.code;
      if (code === 'Escape' || e.keyCode === 27) this.close();
    }
  }, {
    key: 'mousedownHandler',
    value: function mousedownHandler(e) {
      var _this3 = this;

      e.preventDefault();

      this.pressTimer = setTimeout(function () {
        _this3._press = true;
        _this3.grab(e.clientX, e.clientY, true);
      }, pressDelay);
    }
  }, {
    key: 'mousemoveHandler',
    value: function mousemoveHandler(e) {
      if (this._press) this.grab(e.clientX, e.clientY);
    }
  }, {
    key: 'mouseupHandler',
    value: function mouseupHandler() {
      clearTimeout(this.pressTimer);
      this._press = false;
      this.release();
    }
  }, {
    key: 'touchstartHandler',
    value: function touchstartHandler(e) {
      var _this4 = this;

      e.preventDefault();

      this.pressTimer = setTimeout(function () {
        _this4._press = true;
        var touch = e.touches[0];
        _this4.grab(touch.clientX, touch.clientY, true);
      }, pressDelay);
    }
  }, {
    key: 'touchmoveHandler',
    value: function touchmoveHandler(e) {
      if (this._press) {
        var touch = e.touches[0];
        this.grab(touch.clientX, touch.clientY);
      }
    }
  }, {
    key: 'touchendHandler',
    value: function touchendHandler() {
      clearTimeout(this.pressTimer);
      this._press = false;
      if (this._grab) this.release();else this.close();
    }
  }]);
  return Zooming;
}();

document.addEventListener('DOMContentLoaded', function () {

  // listen to zoomable elements by default
  new Zooming$1().listen(defaults.zoomable);
});

{
  // Enable LiveReload
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1"></' + 'script>');
}

return Zooming$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyB3ZWJraXQgcHJlZml4XG5jb25zdCBwcmVmaXggPSAnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlID8gJy13ZWJraXQtJyA6ICcnXG5jb25zdCBwcmVzc0RlbGF5ID0gMjAwXG5cbmNvbnN0IGRlZmF1bHRzID0ge1xuICB6b29tYWJsZTogJ2ltZ1tkYXRhLWFjdGlvbj1cInpvb21cIl0nLFxuICBlbmFibGVHcmFiOiB0cnVlLFxuICB0cmFuc2l0aW9uRHVyYXRpb246ICcuNHMnLFxuICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb246ICdjdWJpYy1iZXppZXIoLjQsMCwwLDEpJyxcbiAgYmdDb2xvcjogJyNmZmYnLFxuICBiZ09wYWNpdHk6IDEsXG4gIHNjYWxlQmFzZTogMS4wLFxuICBzY2FsZUV4dHJhOiAwLjUsXG4gIHNjcm9sbFRocmVzaG9sZDogNDAsXG4gIG9uT3BlbjogbnVsbCxcbiAgb25DbG9zZTogbnVsbCxcbiAgb25HcmFiOiBudWxsLFxuICBvblJlbGVhc2U6IG51bGwsXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcbiAgb25CZWZvcmVHcmFiOiBudWxsLFxuICBvbkJlZm9yZVJlbGVhc2U6IG51bGxcbn1cblxuY29uc3Qgc25pZmZUcmFuc2l0aW9uID0gKGVsKSA9PiB7XG4gIGxldCByZXQgICAgID0ge31cbiAgY29uc3QgdHJhbnMgPSBbJ3dlYmtpdFRyYW5zaXRpb24nLCAndHJhbnNpdGlvbicsICdtb3pUcmFuc2l0aW9uJ11cbiAgY29uc3QgdGZvcm0gPSBbJ3dlYmtpdFRyYW5zZm9ybScsICd0cmFuc2Zvcm0nLCAnbW96VHJhbnNmb3JtJ11cbiAgY29uc3QgZW5kICAgPSB7XG4gICAgJ3RyYW5zaXRpb24nICAgICAgIDogJ3RyYW5zaXRpb25lbmQnLFxuICAgICdtb3pUcmFuc2l0aW9uJyAgICA6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAnd2Via2l0VHJhbnNpdGlvbicgOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgfVxuXG4gIHRyYW5zLnNvbWUocHJvcCA9PiB7XG4gICAgaWYgKGVsLnN0eWxlW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldC50cmFuc2l0aW9uUHJvcCA9IHByb3BcbiAgICAgIHJldC50cmFuc0VuZEV2ZW50ID0gZW5kW3Byb3BdXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfSlcblxuICB0Zm9ybS5zb21lKHByb3AgPT4ge1xuICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXQudHJhbnNmb3JtUHJvcCA9IHByb3BcbiAgICAgIHJldC50cmFuc2Zvcm1Dc3NQcm9wID0gcHJvcC5yZXBsYWNlKC8oLiopVHJhbnNmb3JtLywgJy0kMS10cmFuc2Zvcm0nKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJldFxufVxuXG5jb25zdCBjaGVja1RyYW5zID0gKHRyYW5zaXRpb25Qcm9wLCB0cmFuc2Zvcm1Qcm9wKSA9PiB7XG4gIHJldHVybiBmdW5jdGlvbiBzZXRTdHlsZShlbCwgc3R5bGVzLCByZW1lbWJlcikge1xuICAgIGxldCB2YWx1ZVxuICAgIGlmIChzdHlsZXMudHJhbnNpdGlvbikge1xuICAgICAgdmFsdWUgPSBzdHlsZXMudHJhbnNpdGlvblxuICAgICAgZGVsZXRlIHN0eWxlcy50cmFuc2l0aW9uXG4gICAgICBzdHlsZXNbdHJhbnNpdGlvblByb3BdID0gdmFsdWVcbiAgICB9XG4gICAgaWYgKHN0eWxlcy50cmFuc2Zvcm0pIHtcbiAgICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgICAgZGVsZXRlIHN0eWxlcy50cmFuc2Zvcm1cbiAgICAgIHN0eWxlc1t0cmFuc2Zvcm1Qcm9wXSA9IHZhbHVlXG4gICAgfVxuXG4gICAgbGV0IHMgPSBlbC5zdHlsZVxuICAgIGxldCBvcmlnaW5hbCA9IHt9XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gc3R5bGVzKSB7XG4gICAgICBpZiAocmVtZW1iZXIpIG9yaWdpbmFsW2tleV0gPSBzW2tleV0gfHwgJydcbiAgICAgIHNba2V5XSA9IHN0eWxlc1trZXldXG4gICAgfVxuXG4gICAgcmV0dXJuIG9yaWdpbmFsXG4gIH1cbn1cblxuZXhwb3J0IHsgcHJlZml4LCBwcmVzc0RlbGF5LCBkZWZhdWx0cywgc25pZmZUcmFuc2l0aW9uLCBjaGVja1RyYW5zIH1cbiIsImltcG9ydCB7IHByZWZpeCwgcHJlc3NEZWxheSwgZGVmYXVsdHMsIHNuaWZmVHJhbnNpdGlvbiwgY2hlY2tUcmFucyB9IGZyb20gJy4vaGVscGVycydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIGNvbnN0cnVjdG9yKG9wdHMpIHtcblxuICAgIC8vIGVsZW1lbnRzXG4gICAgdGhpcy5ib2R5ID0gZG9jdW1lbnQuYm9keVxuICAgIHRoaXMub3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG4gICAgdGhpcy50YXJnZXRcbiAgICB0aGlzLnBhcmVudFxuXG4gICAgLy8gc3RhdGVcbiAgICB0aGlzLl9zaG93biA9IGZhbHNlXG4gICAgdGhpcy5fbG9jayAgPSBmYWxzZVxuICAgIHRoaXMuX3ByZXNzID0gZmFsc2VcbiAgICB0aGlzLl9ncmFiICA9IGZhbHNlXG4gICAgdGhpcy5fbGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuXG4gICAgLy8gc3R5bGVcbiAgICB0aGlzLm9yaWdpbmFsU3R5bGVzXG4gICAgdGhpcy5vcGVuU3R5bGVzXG4gICAgdGhpcy50cmFuc2xhdGVcbiAgICB0aGlzLnNjYWxlXG5cbiAgICB0aGlzLnNyY1RodW1ibmFpbFxuICAgIHRoaXMuaW1nUmVjdFxuICAgIHRoaXMucHJlc3NUaW1lclxuXG4gICAgdGhpcy50cmFucyA9IHNuaWZmVHJhbnNpdGlvbih0aGlzLm92ZXJsYXkpXG4gICAgdGhpcy5zZXRTdHlsZUhlbHBlciA9IGNoZWNrVHJhbnModGhpcy50cmFucy50cmFuc2l0aW9uUHJvcCwgdGhpcy50cmFucy50cmFuc2Zvcm1Qcm9wKVxuXG4gICAgdGhpcy5faW5pdChvcHRzKVxuICB9XG5cbiAgY29uZmlnIChvcHRzKSB7XG4gICAgaWYgKCFvcHRzKSByZXR1cm4gdGhpc1xuXG4gICAgZm9yIChsZXQga2V5IGluIG9wdHMpIHtcbiAgICAgIHRoaXMub3B0aW9uc1trZXldID0gb3B0c1trZXldXG4gICAgfVxuXG4gICAgdGhpcy5fc2V0U3R5bGUodGhpcy5vdmVybGF5LCB7XG4gICAgICBiYWNrZ3JvdW5kQ29sb3I6IHRoaXMub3B0aW9ucy5iZ0NvbG9yLFxuICAgICAgdHJhbnNpdGlvbjogJ29wYWNpdHkgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBvcGVuIChlbCwgY2IpIHtcbiAgICBpZiAodGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jayB8fCB0aGlzLl9ncmFiKSByZXR1cm5cblxuICAgIHRoaXMudGFyZ2V0ID0gdHlwZW9mIGVsID09PSAnc3RyaW5nJ1xuICAgICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKVxuICAgICAgOiBlbFxuXG4gICAgaWYgKHRoaXMudGFyZ2V0LnRhZ05hbWUgIT09ICdJTUcnKSByZXR1cm5cblxuICAgIC8vIG9uQmVmb3JlT3BlbiBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKSB0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKHRoaXMudGFyZ2V0KVxuXG4gICAgdGhpcy5fc2hvd24gPSB0cnVlXG4gICAgdGhpcy5fbG9jayA9IHRydWVcbiAgICB0aGlzLnBhcmVudCA9IHRoaXMudGFyZ2V0LnBhcmVudE5vZGVcblxuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpXG4gICAgaW1nLm9ubG9hZCA9IHRoaXMuX2ltZ09ubG9hZCgpXG4gICAgaW1nLnNyYyA9IHRoaXMudGFyZ2V0LmdldEF0dHJpYnV0ZSgnc3JjJylcblxuICAgIHRoaXMuX2luc2VydE92ZXJsYXkoKVxuXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgdGhpcy5zY3JvbGxIYW5kbGVyKVxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLmtleWRvd25IYW5kbGVyKVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zLnRyYW5zRW5kRXZlbnQsIChmdW5jdGlvbiBvbkVuZCAoKSB7XG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMudHJhbnMudHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHRoaXMuX2FkZEdyYWJMaXN0ZW5lcnMoKVxuXG4gICAgICB0aGlzLl9sb2NrID0gZmFsc2VcbiAgICAgIGNiID0gY2IgfHwgdGhpcy5vcHRpb25zLm9uT3BlblxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9KS5iaW5kKHRoaXMpKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGNsb3NlIChjYikge1xuICAgIGlmICghdGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jayB8fCB0aGlzLl9ncmFiKSByZXR1cm5cbiAgICB0aGlzLl9sb2NrID0gdHJ1ZVxuXG4gICAgLy8gb25CZWZvcmVDbG9zZSBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVDbG9zZSkgdGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UodGhpcy50YXJnZXQpXG5cbiAgICB0aGlzLl9yZW1vdmVPdmVybGF5KClcblxuICAgIHRoaXMudGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICcnXG5cbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdzY3JvbGwnLCB0aGlzLnNjcm9sbEhhbmRsZXIpXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMua2V5ZG93bkhhbmRsZXIpXG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnMudHJhbnNFbmRFdmVudCwgKGZ1bmN0aW9uIG9uRW5kICgpIHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFucy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikgdGhpcy5fcmVtb3ZlR3JhYkxpc3RlbmVycygpXG5cbiAgICAgIHRoaXMuX3NldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9yaWdpbmFsU3R5bGVzKVxuICAgICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5vdmVybGF5KVxuICAgICAgdGhpcy5fc2hvd24gPSBmYWxzZVxuICAgICAgdGhpcy5fbG9jayA9IGZhbHNlXG4gICAgICB0aGlzLl9ncmFiID0gZmFsc2VcblxuICAgICAgLy8gZG93bmdyYWRlIHNvdXJjZSBpZiBwb3NzaWJsZVxuICAgICAgaWYgKHRoaXMudGFyZ2V0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbCcpKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNUaHVtYm5haWwpXG4gICAgICB9XG5cbiAgICAgIGNiID0gdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nXG4gICAgICAgID8gY2JcbiAgICAgICAgOiB0aGlzLm9wdGlvbnMub25DbG9zZVxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9KS5iaW5kKHRoaXMpKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGdyYWIgKHgsIHksIHN0YXJ0LCBjYikge1xuICAgIGlmICghdGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jaykgcmV0dXJuXG4gICAgdGhpcy5fZ3JhYiA9IHRydWVcblxuICAgIC8vIG9uQmVmb3JlR3JhYiBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVHcmFiKSB0aGlzLm9wdGlvbnMub25CZWZvcmVHcmFiKHRoaXMudGFyZ2V0KVxuXG4gICAgY29uc3QgZHggPSB4IC0gd2luZG93LmlubmVyV2lkdGggLyAyXG4gICAgY29uc3QgZHkgPSB5IC0gd2luZG93LmlubmVySGVpZ2h0IC8gMlxuICAgIGNvbnN0IG9sZFRyYW5zZm9ybSA9IHRoaXMudGFyZ2V0LnN0eWxlLnRyYW5zZm9ybVxuICAgIGNvbnN0IHRyYW5zZm9ybSA9IG9sZFRyYW5zZm9ybVxuICAgICAgICAgIC5yZXBsYWNlKFxuICAgICAgICAgICAgL3RyYW5zbGF0ZTNkXFwoLio/XFwpL2ksXG4gICAgICAgICAgICAndHJhbnNsYXRlM2QoJyArICh0aGlzLnRyYW5zbGF0ZS54ICsgZHgpICsgJ3B4LCcgKyAodGhpcy50cmFuc2xhdGUueSArIGR5KSArICdweCwgMCknKVxuICAgICAgICAgIC5yZXBsYWNlKFxuICAgICAgICAgICAgL3NjYWxlXFwoWzAtOXxcXC5dKlxcKS9pLFxuICAgICAgICAgICAgJ3NjYWxlKCcgKyAodGhpcy5zY2FsZSArIHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhKSArICcpJylcblxuICAgIHRoaXMuX3NldFN0eWxlKHRoaXMudGFyZ2V0LCB7XG4gICAgICBjdXJzb3I6IHByZWZpeCArICdncmFiYmluZycsXG4gICAgICB0cmFuc2l0aW9uOiB0aGlzLnRyYW5zLnRyYW5zZm9ybUNzc1Byb3AgKyAnICcgKyAoXG4gICAgICAgIHN0YXJ0XG4gICAgICAgID8gdGhpcy5vcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb25cbiAgICAgICAgOiAnZWFzZSdcbiAgICAgICksXG4gICAgICB0cmFuc2Zvcm06IHRyYW5zZm9ybVxuICAgIH0pXG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnMudHJhbnNFbmRFdmVudCwgKGZ1bmN0aW9uIG9uRW5kICgpIHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFucy50cmFuc0VuZEV2ZW50LCBvbkVuZClcblxuICAgICAgY2IgPSB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbidcbiAgICAgICAgPyBjYlxuICAgICAgICA6IHRoaXMub3B0aW9ucy5vbkdyYWJcbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfSkuYmluZCh0aGlzKSlcbiAgfVxuXG4gIHJlbGVhc2UgKGNiKSB7XG4gICAgaWYgKCF0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrIHx8ICF0aGlzLl9ncmFiKSByZXR1cm5cblxuICAgIC8vIG9uQmVmb3JlUmVsZWFzZSBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVSZWxlYXNlKSB0aGlzLm9wdGlvbnMub25CZWZvcmVSZWxlYXNlKHRoaXMudGFyZ2V0KVxuXG4gICAgdGhpcy5fc2V0U3R5bGUodGhpcy50YXJnZXQsIHRoaXMub3BlblN0eWxlcylcblxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodGhpcy50cmFucy50cmFuc0VuZEV2ZW50LCAoZnVuY3Rpb24gb25FbmQgKCkge1xuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICAgICAgdGhpcy5fZ3JhYiA9IGZhbHNlXG5cbiAgICAgIGNiID0gdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nXG4gICAgICAgID8gY2JcbiAgICAgICAgOiB0aGlzLm9wdGlvbnMub25SZWxlYXNlXG4gICAgICBpZiAoY2IpIGNiKHRoaXMudGFyZ2V0KVxuICAgIH0pLmJpbmQodGhpcykpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgbGlzdGVuIChlbCkge1xuICAgIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGVsKVxuICAgICAgbGV0IGkgPSBlbHMubGVuZ3RoXG5cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5saXN0ZW4oZWxzW2ldKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGVsLnN0eWxlLmN1cnNvciA9IHByZWZpeCArICd6b29tLWluJ1xuXG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIGlmICh0aGlzLl9zaG93bikgdGhpcy5jbG9zZSgpXG4gICAgICBlbHNlIHRoaXMub3BlbihlbClcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIF9pbml0IChvcHRzKSB7XG4gICAgLy8gY29uZmlnIG9wdGlvbnNcbiAgICB0aGlzLm9wdGlvbnMgPSB7fVxuICAgIE9iamVjdC5hc3NpZ24odGhpcy5vcHRpb25zLCBkZWZhdWx0cylcbiAgICB0aGlzLmNvbmZpZyhvcHRzKVxuXG4gICAgLy8gaW5pdGlhbCBvdmVybGF5IHNldHVwXG4gICAgdGhpcy5fc2V0U3R5bGUodGhpcy5vdmVybGF5LCB7XG4gICAgICB6SW5kZXg6IDk5OCxcbiAgICAgIGJhY2tncm91bmQ6IHRoaXMub3B0aW9ucy5iZ0NvbG9yLFxuICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICB0b3A6IDAsXG4gICAgICBsZWZ0OiAwLFxuICAgICAgcmlnaHQ6IDAsXG4gICAgICBib3R0b206IDAsXG4gICAgICBvcGFjaXR5OiAwLFxuICAgICAgdHJhbnNpdGlvbjogJ29wYWNpdHkgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgfSlcblxuICAgIHRoaXMub3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuY2xvc2UpXG5cbiAgICB0aGlzLnNjcm9sbEhhbmRsZXIgPSB0aGlzLnNjcm9sbEhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMua2V5ZG93bkhhbmRsZXIgPSB0aGlzLmtleWRvd25IYW5kbGVyLmJpbmQodGhpcylcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgdGhpcy5tb3VzZWRvd25IYW5kbGVyID0gdGhpcy5tb3VzZWRvd25IYW5kbGVyLmJpbmQodGhpcylcbiAgICAgIHRoaXMubW91c2Vtb3ZlSGFuZGxlciA9IHRoaXMubW91c2Vtb3ZlSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgICB0aGlzLm1vdXNldXBIYW5kbGVyID0gdGhpcy5tb3VzZXVwSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgICB0aGlzLnRvdWNoc3RhcnRIYW5kbGVyID0gdGhpcy50b3VjaHN0YXJ0SGFuZGxlci5iaW5kKHRoaXMpXG4gICAgICB0aGlzLnRvdWNobW92ZUhhbmRsZXIgPSB0aGlzLnRvdWNobW92ZUhhbmRsZXIuYmluZCh0aGlzKVxuICAgICAgdGhpcy50b3VjaGVuZEhhbmRsZXIgPSB0aGlzLnRvdWNoZW5kSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgfVxuICB9XG5cbiAgX2ltZ09ubG9hZCAoKSB7XG4gICAgdGhpcy5pbWdSZWN0ID0gdGhpcy50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcblxuICAgIC8vIHVwZ3JhZGUgc291cmNlIGlmIHBvc3NpYmxlXG4gICAgaWYgKHRoaXMudGFyZ2V0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbCcpKSB7XG4gICAgICB0aGlzLnNyY1RodW1ibmFpbCA9IHRoaXMudGFyZ2V0LmdldEF0dHJpYnV0ZSgnc3JjJylcblxuICAgICAgdGhpcy5fc2V0U3R5bGUodGhpcy50YXJnZXQsIHtcbiAgICAgICAgd2lkdGg6IHRoaXMuaW1nUmVjdC53aWR0aCArICdweCcsXG4gICAgICAgIGhlaWdodDogdGhpcy5pbWdSZWN0LmhlaWdodCArICdweCdcbiAgICAgIH0pXG5cbiAgICAgIHRoaXMudGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsJykpXG4gICAgfVxuXG4gICAgLy8gZm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgIHRoaXMudGFyZ2V0Lm9mZnNldFdpZHRoXG5cbiAgICB0aGlzLm9wZW5TdHlsZXMgPSB7XG4gICAgICBwb3NpdGlvbjogJ3JlbGF0aXZlJyxcbiAgICAgIHpJbmRleDogOTk5LFxuICAgICAgY3Vyc29yOiBwcmVmaXggKyAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIgPyAnZ3JhYicgOiAnem9vbS1vdXQnKSxcbiAgICAgIHRyYW5zaXRpb246IHRoaXMudHJhbnMudHJhbnNmb3JtQ3NzUHJvcCArICcgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uLFxuICAgICAgdHJhbnNmb3JtOiB0aGlzLl9jYWxjdWxhdGVUcmFuc2Zvcm0oKVxuICAgIH1cblxuICAgIC8vIHRyaWdnZXIgdHJhbnNpdGlvblxuICAgIHRoaXMub3JpZ2luYWxTdHlsZXMgPSB0aGlzLl9zZXRTdHlsZSh0aGlzLnRhcmdldCwgdGhpcy5vcGVuU3R5bGVzLCB0cnVlKVxuICB9XG5cbiAgX2luc2VydE92ZXJsYXkgKCkge1xuICAgIHRoaXMucGFyZW50LmFwcGVuZENoaWxkKHRoaXMub3ZlcmxheSlcblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5vdmVybGF5LnN0eWxlLm9wYWNpdHkgPSB0aGlzLm9wdGlvbnMuYmdPcGFjaXR5XG4gICAgfSwgMzApXG4gIH1cblxuICBfcmVtb3ZlT3ZlcmxheSAoKSB7XG4gICAgdGhpcy5vdmVybGF5LnN0eWxlLm9wYWNpdHkgPSAwXG4gIH1cblxuICBfc2V0U3R5bGUgKGVsLCBzdHlsZXMsIHJlbWVtYmVyKSB7XG4gICAgcmV0dXJuIHRoaXMuc2V0U3R5bGVIZWxwZXIoZWwsIHN0eWxlcywgcmVtZW1iZXIpXG4gIH1cblxuICBfY2FsY3VsYXRlVHJhbnNmb3JtICgpIHtcbiAgICBjb25zdCBpbWdIYWxmV2lkdGggPSB0aGlzLmltZ1JlY3Qud2lkdGggLyAyXG4gICAgY29uc3QgaW1nSGFsZkhlaWdodCA9IHRoaXMuaW1nUmVjdC5oZWlnaHQgLyAyXG5cbiAgICBjb25zdCBpbWdDZW50ZXIgPSB7XG4gICAgICB4OiB0aGlzLmltZ1JlY3QubGVmdCArIGltZ0hhbGZXaWR0aCxcbiAgICAgIHk6IHRoaXMuaW1nUmVjdC50b3AgKyBpbWdIYWxmSGVpZ2h0XG4gICAgfVxuXG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0ge1xuICAgICAgeDogd2luZG93LmlubmVyV2lkdGggLyAyLFxuICAgICAgeTogd2luZG93LmlubmVySGVpZ2h0IC8gMlxuICAgIH1cblxuICAgIC8vIFRoZSBkaXN0YW5jZSBiZXR3ZWVuIGltYWdlIGVkZ2UgYW5kIHdpbmRvdyBlZGdlXG4gICAgY29uc3QgZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UgPSB7XG4gICAgICB4OiB3aW5kb3dDZW50ZXIueCAtIGltZ0hhbGZXaWR0aCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gaW1nSGFsZkhlaWdodFxuICAgIH1cblxuICAgIGNvbnN0IHNjYWxlSG9yaXpvbnRhbGx5ID0gZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UueCAvIGltZ0hhbGZXaWR0aFxuICAgIGNvbnN0IHNjYWxlVmVydGljYWxseSA9IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlLnkgLyBpbWdIYWxmSGVpZ2h0XG5cbiAgICAvLyBUaGUgdmVjdG9yIHRvIHRyYW5zbGF0ZSBpbWFnZSB0byB0aGUgd2luZG93IGNlbnRlclxuICAgIHRoaXMudHJhbnNsYXRlID0ge1xuICAgICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdDZW50ZXIueCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gaW1nQ2VudGVyLnlcbiAgICB9XG5cbiAgICAvLyBUaGUgYWRkaXRpb25hbCBzY2FsZSBpcyBiYXNlZCBvbiB0aGUgc21hbGxlciB2YWx1ZSBvZlxuICAgIC8vIHNjYWxpbmcgaG9yaXpvbnRhbGx5IGFuZCBzY2FsaW5nIHZlcnRpY2FsbHlcbiAgICB0aGlzLnNjYWxlID0gdGhpcy5vcHRpb25zLnNjYWxlQmFzZSArIE1hdGgubWluKHNjYWxlSG9yaXpvbnRhbGx5LCBzY2FsZVZlcnRpY2FsbHkpXG5cbiAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlM2QoJyArIHRoaXMudHJhbnNsYXRlLnggKyAncHgsJyArIHRoaXMudHJhbnNsYXRlLnkgKyAncHgsIDApICcgK1xuICAgICAgICAnc2NhbGUoJyArIHRoaXMuc2NhbGUgKyAnKSdcblxuICAgIHJldHVybiB0cmFuc2Zvcm1cbiAgfVxuXG4gIF9hZGRHcmFiTGlzdGVuZXJzICgpIHtcbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLm1vdXNlZG93bkhhbmRsZXIpXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5tb3VzZW1vdmVIYW5kbGVyKVxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLm1vdXNldXBIYW5kbGVyKVxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0aGlzLnRvdWNoc3RhcnRIYW5kbGVyKVxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMudG91Y2htb3ZlSGFuZGxlcilcbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMudG91Y2hlbmRIYW5kbGVyKVxuICB9XG5cbiAgX3JlbW92ZUdyYWJMaXN0ZW5lcnMgKCkge1xuICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMubW91c2Vkb3duSGFuZGxlcilcbiAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLm1vdXNlbW92ZUhhbmRsZXIpXG4gICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMubW91c2V1cEhhbmRsZXIpXG4gICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMudG91Y2hzdGFydEhhbmRsZXIpXG4gICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy50b3VjaG1vdmVIYW5kbGVyKVxuICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy50b3VjaGVuZEhhbmRsZXIpXG4gIH1cblxuICAvLyBsaXN0ZW5lcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICBzY3JvbGxIYW5kbGVyICgpIHtcbiAgICBjb25zdCBzY3JvbGxUb3AgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHxcbiAgICAgIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgfHwgdGhpcy5ib2R5LnBhcmVudE5vZGUgfHwgdGhpcy5ib2R5KS5zY3JvbGxUb3BcblxuICAgIGlmICh0aGlzLl9sYXN0U2Nyb2xsUG9zaXRpb24gPT09IG51bGwpIHRoaXMuX2xhc3RTY3JvbGxQb3NpdGlvbiA9IHNjcm9sbFRvcFxuXG4gICAgY29uc3QgZGVsdGFZID0gdGhpcy5fbGFzdFNjcm9sbFBvc2l0aW9uIC0gc2Nyb2xsVG9wXG5cbiAgICBpZiAoTWF0aC5hYnMoZGVsdGFZKSA+PSB0aGlzLm9wdGlvbnMuc2Nyb2xsVGhyZXNob2xkKSB7XG4gICAgICB0aGlzLl9sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9XG4gIH1cblxuICBrZXlkb3duSGFuZGxlciAoZSkge1xuICAgIGNvbnN0IGNvZGUgPSBlLmtleSB8fCBlLmNvZGVcbiAgICBpZiAoY29kZSA9PT0gJ0VzY2FwZScgfHwgZS5rZXlDb2RlID09PSAyNykgdGhpcy5jbG9zZSgpXG4gIH1cblxuICBtb3VzZWRvd25IYW5kbGVyIChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICB0aGlzLnByZXNzVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuX3ByZXNzID0gdHJ1ZVxuICAgICAgdGhpcy5ncmFiKGUuY2xpZW50WCwgZS5jbGllbnRZLCB0cnVlKVxuICAgIH0sIHByZXNzRGVsYXkpXG4gIH1cblxuICBtb3VzZW1vdmVIYW5kbGVyIChlKSB7XG4gICAgaWYgKHRoaXMuX3ByZXNzKSB0aGlzLmdyYWIoZS5jbGllbnRYLCBlLmNsaWVudFkpXG4gIH1cblxuICBtb3VzZXVwSGFuZGxlciAoKSB7XG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucHJlc3NUaW1lcilcbiAgICB0aGlzLl9wcmVzcyA9IGZhbHNlXG4gICAgdGhpcy5yZWxlYXNlKClcbiAgfVxuXG4gIHRvdWNoc3RhcnRIYW5kbGVyIChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICB0aGlzLnByZXNzVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuX3ByZXNzID0gdHJ1ZVxuICAgICAgY29uc3QgdG91Y2ggPSBlLnRvdWNoZXNbMF1cbiAgICAgIHRoaXMuZ3JhYih0b3VjaC5jbGllbnRYLCB0b3VjaC5jbGllbnRZLCB0cnVlKVxuICAgIH0sIHByZXNzRGVsYXkpXG4gIH1cblxuICB0b3VjaG1vdmVIYW5kbGVyIChlKSB7XG4gICAgaWYgKHRoaXMuX3ByZXNzKSB7XG4gICAgICBjb25zdCB0b3VjaCA9IGUudG91Y2hlc1swXVxuICAgICAgdGhpcy5ncmFiKHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFkpXG4gICAgfVxuICB9XG5cbiAgdG91Y2hlbmRIYW5kbGVyICgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuICAgIHRoaXMuX3ByZXNzID0gZmFsc2VcbiAgICBpZiAodGhpcy5fZ3JhYikgdGhpcy5yZWxlYXNlKClcbiAgICBlbHNlIHRoaXMuY2xvc2UoKVxuICB9XG59XG4iLCJpbXBvcnQgeyBkZWZhdWx0cyB9IGZyb20gJy4vaGVscGVycydcbmltcG9ydCBab29taW5nIGZyb20gJy4vem9vbWluZydcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcblxuICAvLyBsaXN0ZW4gdG8gem9vbWFibGUgZWxlbWVudHMgYnkgZGVmYXVsdFxuICBuZXcgWm9vbWluZygpLmxpc3RlbihkZWZhdWx0cy56b29tYWJsZSlcbn0pXG5cbmlmIChFTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAvLyBFbmFibGUgTGl2ZVJlbG9hZFxuICBkb2N1bWVudC53cml0ZShcbiAgICAnPHNjcmlwdCBzcmM9XCJodHRwOi8vJyArIChsb2NhdGlvbi5ob3N0IHx8ICdsb2NhbGhvc3QnKS5zcGxpdCgnOicpWzBdICtcbiAgICAnOjM1NzI5L2xpdmVyZWxvYWQuanM/c25pcHZlcj0xXCI+PC8nICsgJ3NjcmlwdD4nXG4gIClcbn1cblxuZXhwb3J0IGRlZmF1bHQgWm9vbWluZ1xuIl0sIm5hbWVzIjpbInByZWZpeCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50Iiwic3R5bGUiLCJwcmVzc0RlbGF5IiwiZGVmYXVsdHMiLCJzbmlmZlRyYW5zaXRpb24iLCJlbCIsInJldCIsInRyYW5zIiwidGZvcm0iLCJlbmQiLCJzb21lIiwicHJvcCIsInVuZGVmaW5lZCIsInRyYW5zaXRpb25Qcm9wIiwidHJhbnNFbmRFdmVudCIsInRyYW5zZm9ybVByb3AiLCJ0cmFuc2Zvcm1Dc3NQcm9wIiwicmVwbGFjZSIsImNoZWNrVHJhbnMiLCJzZXRTdHlsZSIsInN0eWxlcyIsInJlbWVtYmVyIiwidmFsdWUiLCJ0cmFuc2l0aW9uIiwidHJhbnNmb3JtIiwicyIsIm9yaWdpbmFsIiwia2V5IiwiWm9vbWluZyIsIm9wdHMiLCJib2R5Iiwib3ZlcmxheSIsImNyZWF0ZUVsZW1lbnQiLCJ0YXJnZXQiLCJwYXJlbnQiLCJfc2hvd24iLCJfbG9jayIsIl9wcmVzcyIsIl9ncmFiIiwiX2xhc3RTY3JvbGxQb3NpdGlvbiIsIm9yaWdpbmFsU3R5bGVzIiwib3BlblN0eWxlcyIsInRyYW5zbGF0ZSIsInNjYWxlIiwic3JjVGh1bWJuYWlsIiwiaW1nUmVjdCIsInByZXNzVGltZXIiLCJzZXRTdHlsZUhlbHBlciIsIl9pbml0Iiwib3B0aW9ucyIsIl9zZXRTdHlsZSIsImJnQ29sb3IiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJ0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24iLCJjYiIsInF1ZXJ5U2VsZWN0b3IiLCJ0YWdOYW1lIiwib25CZWZvcmVPcGVuIiwicGFyZW50Tm9kZSIsImltZyIsIkltYWdlIiwib25sb2FkIiwiX2ltZ09ubG9hZCIsInNyYyIsImdldEF0dHJpYnV0ZSIsIl9pbnNlcnRPdmVybGF5IiwiYWRkRXZlbnRMaXN0ZW5lciIsInNjcm9sbEhhbmRsZXIiLCJrZXlkb3duSGFuZGxlciIsIm9uRW5kIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImVuYWJsZUdyYWIiLCJfYWRkR3JhYkxpc3RlbmVycyIsIm9uT3BlbiIsImJpbmQiLCJvbkJlZm9yZUNsb3NlIiwiX3JlbW92ZU92ZXJsYXkiLCJfcmVtb3ZlR3JhYkxpc3RlbmVycyIsInJlbW92ZUNoaWxkIiwiaGFzQXR0cmlidXRlIiwic2V0QXR0cmlidXRlIiwib25DbG9zZSIsIngiLCJ5Iiwic3RhcnQiLCJvbkJlZm9yZUdyYWIiLCJkeCIsIndpbmRvdyIsImlubmVyV2lkdGgiLCJkeSIsImlubmVySGVpZ2h0Iiwib2xkVHJhbnNmb3JtIiwic2NhbGVFeHRyYSIsIm9uR3JhYiIsIm9uQmVmb3JlUmVsZWFzZSIsIm9uUmVsZWFzZSIsImVscyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwibGVuZ3RoIiwibGlzdGVuIiwiY3Vyc29yIiwiZSIsInByZXZlbnREZWZhdWx0IiwiY2xvc2UiLCJvcGVuIiwiYXNzaWduIiwiY29uZmlnIiwibW91c2Vkb3duSGFuZGxlciIsIm1vdXNlbW92ZUhhbmRsZXIiLCJtb3VzZXVwSGFuZGxlciIsInRvdWNoc3RhcnRIYW5kbGVyIiwidG91Y2htb3ZlSGFuZGxlciIsInRvdWNoZW5kSGFuZGxlciIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsIndpZHRoIiwiaGVpZ2h0Iiwib2Zmc2V0V2lkdGgiLCJfY2FsY3VsYXRlVHJhbnNmb3JtIiwiYXBwZW5kQ2hpbGQiLCJvcGFjaXR5IiwiYmdPcGFjaXR5IiwiaW1nSGFsZldpZHRoIiwiaW1nSGFsZkhlaWdodCIsImltZ0NlbnRlciIsImxlZnQiLCJ0b3AiLCJ3aW5kb3dDZW50ZXIiLCJkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZSIsInNjYWxlSG9yaXpvbnRhbGx5Iiwic2NhbGVWZXJ0aWNhbGx5Iiwic2NhbGVCYXNlIiwiTWF0aCIsIm1pbiIsInNjcm9sbFRvcCIsInBhZ2VZT2Zmc2V0IiwiZGVsdGFZIiwiYWJzIiwic2Nyb2xsVGhyZXNob2xkIiwiY29kZSIsImtleUNvZGUiLCJzZXRUaW1lb3V0IiwiZ3JhYiIsImNsaWVudFgiLCJjbGllbnRZIiwicmVsZWFzZSIsInRvdWNoIiwidG91Y2hlcyIsInpvb21hYmxlIiwiRU5WIiwid3JpdGUiLCJsb2NhdGlvbiIsImhvc3QiLCJzcGxpdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDQSxJQUFNQSxTQUFTLHNCQUFzQkMsU0FBU0MsZUFBVCxDQUF5QkMsS0FBL0MsR0FBdUQsVUFBdkQsR0FBb0UsRUFBbkY7QUFDQSxJQUFNQyxhQUFhLEdBQW5COztBQUVBLElBQU1DLFdBQVc7WUFDTCx5QkFESztjQUVILElBRkc7c0JBR0ssS0FITDs0QkFJVyx3QkFKWDtXQUtOLE1BTE07YUFNSixDQU5JO2FBT0osR0FQSTtjQVFILEdBUkc7bUJBU0UsRUFURjtVQVVQLElBVk87V0FXTixJQVhNO1VBWVAsSUFaTzthQWFKLElBYkk7Z0JBY0QsSUFkQztpQkFlQSxJQWZBO2dCQWdCRCxJQWhCQzttQkFpQkU7Q0FqQm5COztBQW9CQSxJQUFNQyxrQkFBa0IsU0FBbEJBLGVBQWtCLENBQUNDLEVBQUQsRUFBUTtNQUMxQkMsTUFBVSxFQUFkO01BQ01DLFFBQVEsQ0FBQyxrQkFBRCxFQUFxQixZQUFyQixFQUFtQyxlQUFuQyxDQUFkO01BQ01DLFFBQVEsQ0FBQyxpQkFBRCxFQUFvQixXQUFwQixFQUFpQyxjQUFqQyxDQUFkO01BQ01DLE1BQVE7a0JBQ1MsZUFEVDtxQkFFUyxlQUZUO3dCQUdTO0dBSHZCOztRQU1NQyxJQUFOLENBQVcsZ0JBQVE7UUFDYkwsR0FBR0osS0FBSCxDQUFTVSxJQUFULE1BQW1CQyxTQUF2QixFQUFrQztVQUM1QkMsY0FBSixHQUFxQkYsSUFBckI7VUFDSUcsYUFBSixHQUFvQkwsSUFBSUUsSUFBSixDQUFwQjthQUNPLElBQVA7O0dBSko7O1FBUU1ELElBQU4sQ0FBVyxnQkFBUTtRQUNiTCxHQUFHSixLQUFILENBQVNVLElBQVQsTUFBbUJDLFNBQXZCLEVBQWtDO1VBQzVCRyxhQUFKLEdBQW9CSixJQUFwQjtVQUNJSyxnQkFBSixHQUF1QkwsS0FBS00sT0FBTCxDQUFhLGVBQWIsRUFBOEIsZUFBOUIsQ0FBdkI7YUFDTyxJQUFQOztHQUpKOztTQVFPWCxHQUFQO0NBMUJGOztBQTZCQSxJQUFNWSxhQUFhLFNBQWJBLFVBQWEsQ0FBQ0wsY0FBRCxFQUFpQkUsYUFBakIsRUFBbUM7U0FDN0MsU0FBU0ksUUFBVCxDQUFrQmQsRUFBbEIsRUFBc0JlLE1BQXRCLEVBQThCQyxRQUE5QixFQUF3QztRQUN6Q0MsY0FBSjtRQUNJRixPQUFPRyxVQUFYLEVBQXVCO2NBQ2JILE9BQU9HLFVBQWY7YUFDT0gsT0FBT0csVUFBZDthQUNPVixjQUFQLElBQXlCUyxLQUF6Qjs7UUFFRUYsT0FBT0ksU0FBWCxFQUFzQjtjQUNaSixPQUFPSSxTQUFmO2FBQ09KLE9BQU9JLFNBQWQ7YUFDT1QsYUFBUCxJQUF3Qk8sS0FBeEI7OztRQUdFRyxJQUFJcEIsR0FBR0osS0FBWDtRQUNJeUIsV0FBVyxFQUFmOztTQUVLLElBQUlDLEdBQVQsSUFBZ0JQLE1BQWhCLEVBQXdCO1VBQ2xCQyxRQUFKLEVBQWNLLFNBQVNDLEdBQVQsSUFBZ0JGLEVBQUVFLEdBQUYsS0FBVSxFQUExQjtRQUNaQSxHQUFGLElBQVNQLE9BQU9PLEdBQVAsQ0FBVDs7O1dBR0tELFFBQVA7R0FyQkY7Q0FERixDQTBCQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUM3RXFCRTttQkFDUEMsSUFBWixFQUFrQjs7Ozs7U0FHWEMsSUFBTCxHQUFZL0IsU0FBUytCLElBQXJCO1NBQ0tDLE9BQUwsR0FBZWhDLFNBQVNpQyxhQUFULENBQXVCLEtBQXZCLENBQWY7U0FDS0MsTUFBTDtTQUNLQyxNQUFMOzs7U0FHS0MsTUFBTCxHQUFjLEtBQWQ7U0FDS0MsS0FBTCxHQUFjLEtBQWQ7U0FDS0MsTUFBTCxHQUFjLEtBQWQ7U0FDS0MsS0FBTCxHQUFjLEtBQWQ7U0FDS0MsbUJBQUwsR0FBMkIsSUFBM0I7OztTQUdLQyxjQUFMO1NBQ0tDLFVBQUw7U0FDS0MsU0FBTDtTQUNLQyxLQUFMOztTQUVLQyxZQUFMO1NBQ0tDLE9BQUw7U0FDS0MsVUFBTDs7U0FFS3ZDLEtBQUwsR0FBYUgsZ0JBQWdCLEtBQUsyQixPQUFyQixDQUFiO1NBQ0tnQixjQUFMLEdBQXNCN0IsV0FBVyxLQUFLWCxLQUFMLENBQVdNLGNBQXRCLEVBQXNDLEtBQUtOLEtBQUwsQ0FBV1EsYUFBakQsQ0FBdEI7O1NBRUtpQyxLQUFMLENBQVduQixJQUFYOzs7OzsyQkFHTUEsTUFBTTtVQUNSLENBQUNBLElBQUwsRUFBVyxPQUFPLElBQVA7O1dBRU4sSUFBSUYsR0FBVCxJQUFnQkUsSUFBaEIsRUFBc0I7YUFDZm9CLE9BQUwsQ0FBYXRCLEdBQWIsSUFBb0JFLEtBQUtGLEdBQUwsQ0FBcEI7OztXQUdHdUIsU0FBTCxDQUFlLEtBQUtuQixPQUFwQixFQUE2Qjt5QkFDVixLQUFLa0IsT0FBTCxDQUFhRSxPQURIO29CQUVmLGFBQ1YsS0FBS0YsT0FBTCxDQUFhRyxrQkFESCxHQUN3QixHQUR4QixHQUVWLEtBQUtILE9BQUwsQ0FBYUk7T0FKakI7O2FBT08sSUFBUDs7Ozt5QkFHSWhELElBQUlpRCxJQUFJO1VBQ1IsS0FBS25CLE1BQUwsSUFBZSxLQUFLQyxLQUFwQixJQUE2QixLQUFLRSxLQUF0QyxFQUE2Qzs7V0FFeENMLE1BQUwsR0FBYyxPQUFPNUIsRUFBUCxLQUFjLFFBQWQsR0FDVk4sU0FBU3dELGFBQVQsQ0FBdUJsRCxFQUF2QixDQURVLEdBRVZBLEVBRko7O1VBSUksS0FBSzRCLE1BQUwsQ0FBWXVCLE9BQVosS0FBd0IsS0FBNUIsRUFBbUM7OztVQUcvQixLQUFLUCxPQUFMLENBQWFRLFlBQWpCLEVBQStCLEtBQUtSLE9BQUwsQ0FBYVEsWUFBYixDQUEwQixLQUFLeEIsTUFBL0I7O1dBRTFCRSxNQUFMLEdBQWMsSUFBZDtXQUNLQyxLQUFMLEdBQWEsSUFBYjtXQUNLRixNQUFMLEdBQWMsS0FBS0QsTUFBTCxDQUFZeUIsVUFBMUI7O1VBRU1DLE1BQU0sSUFBSUMsS0FBSixFQUFaO1VBQ0lDLE1BQUosR0FBYSxLQUFLQyxVQUFMLEVBQWI7VUFDSUMsR0FBSixHQUFVLEtBQUs5QixNQUFMLENBQVkrQixZQUFaLENBQXlCLEtBQXpCLENBQVY7O1dBRUtDLGNBQUw7O2VBRVNDLGdCQUFULENBQTBCLFFBQTFCLEVBQW9DLEtBQUtDLGFBQXpDO2VBQ1NELGdCQUFULENBQTBCLFNBQTFCLEVBQXFDLEtBQUtFLGNBQTFDOztXQUVLbkMsTUFBTCxDQUFZaUMsZ0JBQVosQ0FBNkIsS0FBSzNELEtBQUwsQ0FBV08sYUFBeEMsRUFBd0QsU0FBU3VELEtBQVQsR0FBa0I7YUFDbkVwQyxNQUFMLENBQVlxQyxtQkFBWixDQUFnQyxLQUFLL0QsS0FBTCxDQUFXTyxhQUEzQyxFQUEwRHVELEtBQTFEO1lBQ0ksS0FBS3BCLE9BQUwsQ0FBYXNCLFVBQWpCLEVBQTZCLEtBQUtDLGlCQUFMOzthQUV4QnBDLEtBQUwsR0FBYSxLQUFiO2FBQ0trQixNQUFNLEtBQUtMLE9BQUwsQ0FBYXdCLE1BQXhCO1lBQ0luQixFQUFKLEVBQVFBLEdBQUcsS0FBS3JCLE1BQVI7T0FONkMsQ0FPcER5QyxJQVBvRCxDQU8vQyxJQVArQyxDQUF2RDs7YUFTTyxJQUFQOzs7OzBCQUdLcEIsSUFBSTtVQUNMLENBQUMsS0FBS25CLE1BQU4sSUFBZ0IsS0FBS0MsS0FBckIsSUFBOEIsS0FBS0UsS0FBdkMsRUFBOEM7V0FDekNGLEtBQUwsR0FBYSxJQUFiOzs7VUFHSSxLQUFLYSxPQUFMLENBQWEwQixhQUFqQixFQUFnQyxLQUFLMUIsT0FBTCxDQUFhMEIsYUFBYixDQUEyQixLQUFLMUMsTUFBaEM7O1dBRTNCMkMsY0FBTDs7V0FFSzNDLE1BQUwsQ0FBWWhDLEtBQVosQ0FBa0J1QixTQUFsQixHQUE4QixFQUE5Qjs7ZUFFUzhDLG1CQUFULENBQTZCLFFBQTdCLEVBQXVDLEtBQUtILGFBQTVDO2VBQ1NHLG1CQUFULENBQTZCLFNBQTdCLEVBQXdDLEtBQUtGLGNBQTdDOztXQUVLbkMsTUFBTCxDQUFZaUMsZ0JBQVosQ0FBNkIsS0FBSzNELEtBQUwsQ0FBV08sYUFBeEMsRUFBd0QsU0FBU3VELEtBQVQsR0FBa0I7YUFDbkVwQyxNQUFMLENBQVlxQyxtQkFBWixDQUFnQyxLQUFLL0QsS0FBTCxDQUFXTyxhQUEzQyxFQUEwRHVELEtBQTFEO1lBQ0ksS0FBS3BCLE9BQUwsQ0FBYXNCLFVBQWpCLEVBQTZCLEtBQUtNLG9CQUFMOzthQUV4QjNCLFNBQUwsQ0FBZSxLQUFLakIsTUFBcEIsRUFBNEIsS0FBS08sY0FBakM7YUFDS04sTUFBTCxDQUFZNEMsV0FBWixDQUF3QixLQUFLL0MsT0FBN0I7YUFDS0ksTUFBTCxHQUFjLEtBQWQ7YUFDS0MsS0FBTCxHQUFhLEtBQWI7YUFDS0UsS0FBTCxHQUFhLEtBQWI7OztZQUdJLEtBQUtMLE1BQUwsQ0FBWThDLFlBQVosQ0FBeUIsZUFBekIsQ0FBSixFQUErQztlQUN4QzlDLE1BQUwsQ0FBWStDLFlBQVosQ0FBeUIsS0FBekIsRUFBZ0MsS0FBS3BDLFlBQXJDOzs7YUFHRyxPQUFPVSxFQUFQLEtBQWMsVUFBZCxHQUNEQSxFQURDLEdBRUQsS0FBS0wsT0FBTCxDQUFhZ0MsT0FGakI7WUFHSTNCLEVBQUosRUFBUUEsR0FBRyxLQUFLckIsTUFBUjtPQWxCNkMsQ0FtQnBEeUMsSUFuQm9ELENBbUIvQyxJQW5CK0MsQ0FBdkQ7O2FBcUJPLElBQVA7Ozs7eUJBR0lRLEdBQUdDLEdBQUdDLE9BQU85QixJQUFJO1VBQ2pCLENBQUMsS0FBS25CLE1BQU4sSUFBZ0IsS0FBS0MsS0FBekIsRUFBZ0M7V0FDM0JFLEtBQUwsR0FBYSxJQUFiOzs7VUFHSSxLQUFLVyxPQUFMLENBQWFvQyxZQUFqQixFQUErQixLQUFLcEMsT0FBTCxDQUFhb0MsWUFBYixDQUEwQixLQUFLcEQsTUFBL0I7O1VBRXpCcUQsS0FBS0osSUFBSUssT0FBT0MsVUFBUCxHQUFvQixDQUFuQztVQUNNQyxLQUFLTixJQUFJSSxPQUFPRyxXQUFQLEdBQXFCLENBQXBDO1VBQ01DLGVBQWUsS0FBSzFELE1BQUwsQ0FBWWhDLEtBQVosQ0FBa0J1QixTQUF2QztVQUNNQSxZQUFZbUUsYUFDWDFFLE9BRFcsQ0FFVixxQkFGVSxFQUdWLGtCQUFrQixLQUFLeUIsU0FBTCxDQUFld0MsQ0FBZixHQUFtQkksRUFBckMsSUFBMkMsS0FBM0MsSUFBb0QsS0FBSzVDLFNBQUwsQ0FBZXlDLENBQWYsR0FBbUJNLEVBQXZFLElBQTZFLFFBSG5FLEVBSVh4RSxPQUpXLENBS1YscUJBTFUsRUFNVixZQUFZLEtBQUswQixLQUFMLEdBQWEsS0FBS00sT0FBTCxDQUFhMkMsVUFBdEMsSUFBb0QsR0FOMUMsQ0FBbEI7O1dBUUsxQyxTQUFMLENBQWUsS0FBS2pCLE1BQXBCLEVBQTRCO2dCQUNsQm5DLFNBQVMsVUFEUztvQkFFZCxLQUFLUyxLQUFMLENBQVdTLGdCQUFYLEdBQThCLEdBQTlCLElBQ1ZvRSxRQUNFLEtBQUtuQyxPQUFMLENBQWFHLGtCQUFiLEdBQWtDLEdBQWxDLEdBQXdDLEtBQUtILE9BQUwsQ0FBYUksd0JBRHZELEdBRUUsTUFIUSxDQUZjO21CQU9mN0I7T0FQYjs7V0FVS1MsTUFBTCxDQUFZaUMsZ0JBQVosQ0FBNkIsS0FBSzNELEtBQUwsQ0FBV08sYUFBeEMsRUFBd0QsU0FBU3VELEtBQVQsR0FBa0I7YUFDbkVwQyxNQUFMLENBQVlxQyxtQkFBWixDQUFnQyxLQUFLL0QsS0FBTCxDQUFXTyxhQUEzQyxFQUEwRHVELEtBQTFEOzthQUVLLE9BQU9mLEVBQVAsS0FBYyxVQUFkLEdBQ0RBLEVBREMsR0FFRCxLQUFLTCxPQUFMLENBQWE0QyxNQUZqQjtZQUdJdkMsRUFBSixFQUFRQSxHQUFHLEtBQUtyQixNQUFSO09BTjZDLENBT3BEeUMsSUFQb0QsQ0FPL0MsSUFQK0MsQ0FBdkQ7Ozs7NEJBVU9wQixJQUFJO1VBQ1AsQ0FBQyxLQUFLbkIsTUFBTixJQUFnQixLQUFLQyxLQUFyQixJQUE4QixDQUFDLEtBQUtFLEtBQXhDLEVBQStDOzs7VUFHM0MsS0FBS1csT0FBTCxDQUFhNkMsZUFBakIsRUFBa0MsS0FBSzdDLE9BQUwsQ0FBYTZDLGVBQWIsQ0FBNkIsS0FBSzdELE1BQWxDOztXQUU3QmlCLFNBQUwsQ0FBZSxLQUFLakIsTUFBcEIsRUFBNEIsS0FBS1EsVUFBakM7O1dBRUtSLE1BQUwsQ0FBWWlDLGdCQUFaLENBQTZCLEtBQUszRCxLQUFMLENBQVdPLGFBQXhDLEVBQXdELFNBQVN1RCxLQUFULEdBQWtCO2FBQ25FcEMsTUFBTCxDQUFZcUMsbUJBQVosQ0FBZ0MsS0FBSy9ELEtBQUwsQ0FBV08sYUFBM0MsRUFBMER1RCxLQUExRDthQUNLL0IsS0FBTCxHQUFhLEtBQWI7O2FBRUssT0FBT2dCLEVBQVAsS0FBYyxVQUFkLEdBQ0RBLEVBREMsR0FFRCxLQUFLTCxPQUFMLENBQWE4QyxTQUZqQjtZQUdJekMsRUFBSixFQUFRQSxHQUFHLEtBQUtyQixNQUFSO09BUDZDLENBUXBEeUMsSUFSb0QsQ0FRL0MsSUFSK0MsQ0FBdkQ7O2FBVU8sSUFBUDs7OzsyQkFHTXJFLElBQUk7OztVQUNOLE9BQU9BLEVBQVAsS0FBYyxRQUFsQixFQUE0QjtZQUNwQjJGLE1BQU1qRyxTQUFTa0csZ0JBQVQsQ0FBMEI1RixFQUExQixDQUFaO1lBQ0k2RixJQUFJRixJQUFJRyxNQUFaOztlQUVPRCxHQUFQLEVBQVk7ZUFDTEUsTUFBTCxDQUFZSixJQUFJRSxDQUFKLENBQVo7OztlQUdLLElBQVA7OztTQUdDakcsS0FBSCxDQUFTb0csTUFBVCxHQUFrQnZHLFNBQVMsU0FBM0I7O1NBRUdvRSxnQkFBSCxDQUFvQixPQUFwQixFQUE2QixVQUFDb0MsQ0FBRCxFQUFPO1VBQ2hDQyxjQUFGOztZQUVJLE1BQUtwRSxNQUFULEVBQWlCLE1BQUtxRSxLQUFMLEdBQWpCLEtBQ0ssTUFBS0MsSUFBTCxDQUFVcEcsRUFBVjtPQUpQOzthQU9PLElBQVA7Ozs7MEJBR0t3QixNQUFNOztXQUVOb0IsT0FBTCxHQUFlLEVBQWY7YUFDT3lELE1BQVAsQ0FBYyxLQUFLekQsT0FBbkIsRUFBNEI5QyxRQUE1QjtXQUNLd0csTUFBTCxDQUFZOUUsSUFBWjs7O1dBR0txQixTQUFMLENBQWUsS0FBS25CLE9BQXBCLEVBQTZCO2dCQUNuQixHQURtQjtvQkFFZixLQUFLa0IsT0FBTCxDQUFhRSxPQUZFO2tCQUdqQixPQUhpQjthQUl0QixDQUpzQjtjQUtyQixDQUxxQjtlQU1wQixDQU5vQjtnQkFPbkIsQ0FQbUI7aUJBUWxCLENBUmtCO29CQVNmLGFBQ1YsS0FBS0YsT0FBTCxDQUFhRyxrQkFESCxHQUN3QixHQUR4QixHQUVWLEtBQUtILE9BQUwsQ0FBYUk7T0FYakI7O1dBY0t0QixPQUFMLENBQWFtQyxnQkFBYixDQUE4QixPQUE5QixFQUF1QyxLQUFLc0MsS0FBNUM7O1dBRUtyQyxhQUFMLEdBQXFCLEtBQUtBLGFBQUwsQ0FBbUJPLElBQW5CLENBQXdCLElBQXhCLENBQXJCO1dBQ0tOLGNBQUwsR0FBc0IsS0FBS0EsY0FBTCxDQUFvQk0sSUFBcEIsQ0FBeUIsSUFBekIsQ0FBdEI7O1VBRUksS0FBS3pCLE9BQUwsQ0FBYXNCLFVBQWpCLEVBQTZCO2FBQ3RCcUMsZ0JBQUwsR0FBd0IsS0FBS0EsZ0JBQUwsQ0FBc0JsQyxJQUF0QixDQUEyQixJQUEzQixDQUF4QjthQUNLbUMsZ0JBQUwsR0FBd0IsS0FBS0EsZ0JBQUwsQ0FBc0JuQyxJQUF0QixDQUEyQixJQUEzQixDQUF4QjthQUNLb0MsY0FBTCxHQUFzQixLQUFLQSxjQUFMLENBQW9CcEMsSUFBcEIsQ0FBeUIsSUFBekIsQ0FBdEI7YUFDS3FDLGlCQUFMLEdBQXlCLEtBQUtBLGlCQUFMLENBQXVCckMsSUFBdkIsQ0FBNEIsSUFBNUIsQ0FBekI7YUFDS3NDLGdCQUFMLEdBQXdCLEtBQUtBLGdCQUFMLENBQXNCdEMsSUFBdEIsQ0FBMkIsSUFBM0IsQ0FBeEI7YUFDS3VDLGVBQUwsR0FBdUIsS0FBS0EsZUFBTCxDQUFxQnZDLElBQXJCLENBQTBCLElBQTFCLENBQXZCOzs7OztpQ0FJVTtXQUNQN0IsT0FBTCxHQUFlLEtBQUtaLE1BQUwsQ0FBWWlGLHFCQUFaLEVBQWY7OztVQUdJLEtBQUtqRixNQUFMLENBQVk4QyxZQUFaLENBQXlCLGVBQXpCLENBQUosRUFBK0M7YUFDeENuQyxZQUFMLEdBQW9CLEtBQUtYLE1BQUwsQ0FBWStCLFlBQVosQ0FBeUIsS0FBekIsQ0FBcEI7O2FBRUtkLFNBQUwsQ0FBZSxLQUFLakIsTUFBcEIsRUFBNEI7aUJBQ25CLEtBQUtZLE9BQUwsQ0FBYXNFLEtBQWIsR0FBcUIsSUFERjtrQkFFbEIsS0FBS3RFLE9BQUwsQ0FBYXVFLE1BQWIsR0FBc0I7U0FGaEM7O2FBS0tuRixNQUFMLENBQVkrQyxZQUFaLENBQXlCLEtBQXpCLEVBQWdDLEtBQUsvQyxNQUFMLENBQVkrQixZQUFaLENBQXlCLGVBQXpCLENBQWhDOzs7O1dBSUcvQixNQUFMLENBQVlvRixXQUFaOztXQUVLNUUsVUFBTCxHQUFrQjtrQkFDTixVQURNO2dCQUVSLEdBRlE7Z0JBR1IzQyxVQUFVLEtBQUttRCxPQUFMLENBQWFzQixVQUFiLEdBQTBCLE1BQTFCLEdBQW1DLFVBQTdDLENBSFE7b0JBSUosS0FBS2hFLEtBQUwsQ0FBV1MsZ0JBQVgsR0FBOEIsR0FBOUIsR0FDVixLQUFLaUMsT0FBTCxDQUFhRyxrQkFESCxHQUN3QixHQUR4QixHQUVWLEtBQUtILE9BQUwsQ0FBYUksd0JBTkM7bUJBT0wsS0FBS2lFLG1CQUFMO09BUGI7OztXQVdLOUUsY0FBTCxHQUFzQixLQUFLVSxTQUFMLENBQWUsS0FBS2pCLE1BQXBCLEVBQTRCLEtBQUtRLFVBQWpDLEVBQTZDLElBQTdDLENBQXRCOzs7O3FDQUdnQjs7O1dBQ1hQLE1BQUwsQ0FBWXFGLFdBQVosQ0FBd0IsS0FBS3hGLE9BQTdCOztpQkFFVyxZQUFNO2VBQ1ZBLE9BQUwsQ0FBYTlCLEtBQWIsQ0FBbUJ1SCxPQUFuQixHQUE2QixPQUFLdkUsT0FBTCxDQUFhd0UsU0FBMUM7T0FERixFQUVHLEVBRkg7Ozs7cUNBS2dCO1dBQ1gxRixPQUFMLENBQWE5QixLQUFiLENBQW1CdUgsT0FBbkIsR0FBNkIsQ0FBN0I7Ozs7OEJBR1NuSCxJQUFJZSxRQUFRQyxVQUFVO2FBQ3hCLEtBQUswQixjQUFMLENBQW9CMUMsRUFBcEIsRUFBd0JlLE1BQXhCLEVBQWdDQyxRQUFoQyxDQUFQOzs7OzBDQUdxQjtVQUNmcUcsZUFBZSxLQUFLN0UsT0FBTCxDQUFhc0UsS0FBYixHQUFxQixDQUExQztVQUNNUSxnQkFBZ0IsS0FBSzlFLE9BQUwsQ0FBYXVFLE1BQWIsR0FBc0IsQ0FBNUM7O1VBRU1RLFlBQVk7V0FDYixLQUFLL0UsT0FBTCxDQUFhZ0YsSUFBYixHQUFvQkgsWUFEUDtXQUViLEtBQUs3RSxPQUFMLENBQWFpRixHQUFiLEdBQW1CSDtPQUZ4Qjs7VUFLTUksZUFBZTtXQUNoQnhDLE9BQU9DLFVBQVAsR0FBb0IsQ0FESjtXQUVoQkQsT0FBT0csV0FBUCxHQUFxQjtPQUYxQjs7O1VBTU1zQyxnQ0FBZ0M7V0FDakNELGFBQWE3QyxDQUFiLEdBQWlCd0MsWUFEZ0I7V0FFakNLLGFBQWE1QyxDQUFiLEdBQWlCd0M7T0FGdEI7O1VBS01NLG9CQUFvQkQsOEJBQThCOUMsQ0FBOUIsR0FBa0N3QyxZQUE1RDtVQUNNUSxrQkFBa0JGLDhCQUE4QjdDLENBQTlCLEdBQWtDd0MsYUFBMUQ7OztXQUdLakYsU0FBTCxHQUFpQjtXQUNacUYsYUFBYTdDLENBQWIsR0FBaUIwQyxVQUFVMUMsQ0FEZjtXQUVaNkMsYUFBYTVDLENBQWIsR0FBaUJ5QyxVQUFVekM7T0FGaEM7Ozs7V0FPS3hDLEtBQUwsR0FBYSxLQUFLTSxPQUFMLENBQWFrRixTQUFiLEdBQXlCQyxLQUFLQyxHQUFMLENBQVNKLGlCQUFULEVBQTRCQyxlQUE1QixDQUF0Qzs7VUFFTTFHLFlBQ0YsaUJBQWlCLEtBQUtrQixTQUFMLENBQWV3QyxDQUFoQyxHQUFvQyxLQUFwQyxHQUE0QyxLQUFLeEMsU0FBTCxDQUFleUMsQ0FBM0QsR0FBK0QsU0FBL0QsR0FDQSxRQURBLEdBQ1csS0FBS3hDLEtBRGhCLEdBQ3dCLEdBRjVCOzthQUlPbkIsU0FBUDs7Ozt3Q0FHbUI7V0FDZFMsTUFBTCxDQUFZaUMsZ0JBQVosQ0FBNkIsV0FBN0IsRUFBMEMsS0FBSzBDLGdCQUEvQztXQUNLM0UsTUFBTCxDQUFZaUMsZ0JBQVosQ0FBNkIsV0FBN0IsRUFBMEMsS0FBSzJDLGdCQUEvQztXQUNLNUUsTUFBTCxDQUFZaUMsZ0JBQVosQ0FBNkIsU0FBN0IsRUFBd0MsS0FBSzRDLGNBQTdDO1dBQ0s3RSxNQUFMLENBQVlpQyxnQkFBWixDQUE2QixZQUE3QixFQUEyQyxLQUFLNkMsaUJBQWhEO1dBQ0s5RSxNQUFMLENBQVlpQyxnQkFBWixDQUE2QixXQUE3QixFQUEwQyxLQUFLOEMsZ0JBQS9DO1dBQ0svRSxNQUFMLENBQVlpQyxnQkFBWixDQUE2QixVQUE3QixFQUF5QyxLQUFLK0MsZUFBOUM7Ozs7MkNBR3NCO1dBQ2pCaEYsTUFBTCxDQUFZcUMsbUJBQVosQ0FBZ0MsV0FBaEMsRUFBNkMsS0FBS3NDLGdCQUFsRDtXQUNLM0UsTUFBTCxDQUFZcUMsbUJBQVosQ0FBZ0MsV0FBaEMsRUFBNkMsS0FBS3VDLGdCQUFsRDtXQUNLNUUsTUFBTCxDQUFZcUMsbUJBQVosQ0FBZ0MsU0FBaEMsRUFBMkMsS0FBS3dDLGNBQWhEO1dBQ0s3RSxNQUFMLENBQVlxQyxtQkFBWixDQUFnQyxZQUFoQyxFQUE4QyxLQUFLeUMsaUJBQW5EO1dBQ0s5RSxNQUFMLENBQVlxQyxtQkFBWixDQUFnQyxXQUFoQyxFQUE2QyxLQUFLMEMsZ0JBQWxEO1dBQ0svRSxNQUFMLENBQVlxQyxtQkFBWixDQUFnQyxVQUFoQyxFQUE0QyxLQUFLMkMsZUFBakQ7Ozs7Ozs7b0NBS2U7VUFDVHFCLFlBQVkvQyxPQUFPZ0QsV0FBUCxJQUNoQixDQUFDeEksU0FBU0MsZUFBVCxJQUE0QixLQUFLOEIsSUFBTCxDQUFVNEIsVUFBdEMsSUFBb0QsS0FBSzVCLElBQTFELEVBQWdFd0csU0FEbEU7O1VBR0ksS0FBSy9GLG1CQUFMLEtBQTZCLElBQWpDLEVBQXVDLEtBQUtBLG1CQUFMLEdBQTJCK0YsU0FBM0I7O1VBRWpDRSxTQUFTLEtBQUtqRyxtQkFBTCxHQUEyQitGLFNBQTFDOztVQUVJRixLQUFLSyxHQUFMLENBQVNELE1BQVQsS0FBb0IsS0FBS3ZGLE9BQUwsQ0FBYXlGLGVBQXJDLEVBQXNEO2FBQy9DbkcsbUJBQUwsR0FBMkIsSUFBM0I7YUFDS2lFLEtBQUw7Ozs7O21DQUlZRixHQUFHO1VBQ1hxQyxPQUFPckMsRUFBRTNFLEdBQUYsSUFBUzJFLEVBQUVxQyxJQUF4QjtVQUNJQSxTQUFTLFFBQVQsSUFBcUJyQyxFQUFFc0MsT0FBRixLQUFjLEVBQXZDLEVBQTJDLEtBQUtwQyxLQUFMOzs7O3FDQUczQkYsR0FBRzs7O1FBQ2pCQyxjQUFGOztXQUVLekQsVUFBTCxHQUFrQitGLFdBQVcsWUFBTTtlQUM1QnhHLE1BQUwsR0FBYyxJQUFkO2VBQ0t5RyxJQUFMLENBQVV4QyxFQUFFeUMsT0FBWixFQUFxQnpDLEVBQUUwQyxPQUF2QixFQUFnQyxJQUFoQztPQUZnQixFQUdmOUksVUFIZSxDQUFsQjs7OztxQ0FNZ0JvRyxHQUFHO1VBQ2YsS0FBS2pFLE1BQVQsRUFBaUIsS0FBS3lHLElBQUwsQ0FBVXhDLEVBQUV5QyxPQUFaLEVBQXFCekMsRUFBRTBDLE9BQXZCOzs7O3FDQUdEO21CQUNILEtBQUtsRyxVQUFsQjtXQUNLVCxNQUFMLEdBQWMsS0FBZDtXQUNLNEcsT0FBTDs7OztzQ0FHaUIzQyxHQUFHOzs7UUFDbEJDLGNBQUY7O1dBRUt6RCxVQUFMLEdBQWtCK0YsV0FBVyxZQUFNO2VBQzVCeEcsTUFBTCxHQUFjLElBQWQ7WUFDTTZHLFFBQVE1QyxFQUFFNkMsT0FBRixDQUFVLENBQVYsQ0FBZDtlQUNLTCxJQUFMLENBQVVJLE1BQU1ILE9BQWhCLEVBQXlCRyxNQUFNRixPQUEvQixFQUF3QyxJQUF4QztPQUhnQixFQUlmOUksVUFKZSxDQUFsQjs7OztxQ0FPZ0JvRyxHQUFHO1VBQ2YsS0FBS2pFLE1BQVQsRUFBaUI7WUFDVDZHLFFBQVE1QyxFQUFFNkMsT0FBRixDQUFVLENBQVYsQ0FBZDthQUNLTCxJQUFMLENBQVVJLE1BQU1ILE9BQWhCLEVBQXlCRyxNQUFNRixPQUEvQjs7Ozs7c0NBSWU7bUJBQ0osS0FBS2xHLFVBQWxCO1dBQ0tULE1BQUwsR0FBYyxLQUFkO1VBQ0ksS0FBS0MsS0FBVCxFQUFnQixLQUFLMkcsT0FBTCxHQUFoQixLQUNLLEtBQUt6QyxLQUFMOzs7Ozs7QUN6WlR6RyxTQUFTbUUsZ0JBQVQsQ0FBMEIsa0JBQTFCLEVBQThDLFlBQU07OztNQUc5Q3RDLFNBQUosR0FBY3dFLE1BQWQsQ0FBcUJqRyxTQUFTaUosUUFBOUI7Q0FIRjs7QUFNQSxBQUFJQyxBQUFKLEFBQTBCOztXQUVmQyxLQUFULENBQ0UseUJBQXlCLENBQUNDLFNBQVNDLElBQVQsSUFBaUIsV0FBbEIsRUFBK0JDLEtBQS9CLENBQXFDLEdBQXJDLEVBQTBDLENBQTFDLENBQXpCLEdBQ0Esb0NBREEsR0FDdUMsU0FGekM7Q0FNRjs7OzsifQ==
