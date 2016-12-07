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
      ret.transition = prop;
      ret.transEnd = end[prop];
      return true;
    }
  });

  tform.some(function (prop) {
    if (el.style[prop] !== undefined) {
      ret.transform = prop;
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

    // style
    this.originalStyles;
    this.openStyles;
    this.translate;
    this.scale;

    this.srcThumbnail;
    this.imgRect;
    this.pressTimer;
    this.lastScrollPosition = null;

    // compatibility stuff
    var trans = sniffTransition(this.overlay);
    this.transitionProp = trans.transition;
    this.transformProp = trans.transform;
    this.transformCssProp = this.transformProp.replace(/(.*)Transform/, '-$1-transform');
    this.transEndEvent = trans.transEnd;
    this.setStyleHelper = checkTrans(this.transitionProp, this.transformProp);

    this.options = {};
    Object.assign(this.options, defaults);
    this.config(opts);

    this.setStyle(this.overlay, {
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
    this.mousedownHandler = this.mousedownHandler.bind(this);
    this.mousemoveHandler = this.mousemoveHandler.bind(this);
    this.mouseupHandler = this.mouseupHandler.bind(this);
    this.touchstartHandler = this.touchstartHandler.bind(this);
    this.touchmoveHandler = this.touchmoveHandler.bind(this);
    this.touchendHandler = this.touchendHandler.bind(this);
  }

  createClass(Zooming, [{
    key: 'config',
    value: function config(opts) {
      if (!opts) return this;

      for (var key in opts) {
        this.options[key] = opts[key];
      }

      this.setStyle(this.overlay, {
        backgroundColor: this.options.bgColor,
        transition: 'opacity ' + this.options.transitionDuration + ' ' + this.options.transitionTimingFunction
      });

      return this;
    }
  }, {
    key: 'open',
    value: function open(el, cb) {
      var _this = this;

      if (this._shown || this._lock || this._grab) return;

      this.target = typeof el === 'string' ? document.querySelector(el) : el;

      if (this.target.tagName !== 'IMG') return;

      // onBeforeOpen event
      if (this.options.onBeforeOpen) this.options.onBeforeOpen(this.target);

      this._shown = true;
      this._lock = true;
      this.parent = this.target.parentNode;

      var img = new Image();

      img.onload = function () {
        _this.imgRect = _this.target.getBoundingClientRect();

        // upgrade source if possible
        if (_this.target.hasAttribute('data-original')) {
          _this.srcThumbnail = _this.target.getAttribute('src');

          _this.setStyle(_this.target, {
            width: _this.imgRect.width + 'px',
            height: _this.imgRect.height + 'px'
          });

          _this.target.setAttribute('src', _this.target.getAttribute('data-original'));
        }

        // force layout update
        _this.target.offsetWidth;

        _this.openStyles = {
          position: 'relative',
          zIndex: 999,
          cursor: prefix + 'grab',
          transition: _this.transformCssProp + ' ' + _this.options.transitionDuration + ' ' + _this.options.transitionTimingFunction,
          transform: _this.calculateTransform()
        };

        // trigger transition
        _this.originalStyles = _this.setStyle(_this.target, _this.openStyles, true);
      };

      img.src = this.target.getAttribute('src');

      // insert overlay
      this.parent.appendChild(this.overlay);
      setTimeout(function () {
        _this.overlay.style.opacity = _this.options.bgOpacity;
      }, 30);

      document.addEventListener('scroll', this.scrollHandler);
      document.addEventListener('keydown', this.keydownHandler);

      var onEnd = function onEnd() {
        _this.target.removeEventListener(_this.transEndEvent, onEnd);
        _this.target.addEventListener('mousedown', _this.mousedownHandler);
        _this.target.addEventListener('mousemove', _this.mousemoveHandler);
        _this.target.addEventListener('mouseup', _this.mouseupHandler);
        _this.target.addEventListener('touchstart', _this.touchstartHandler);
        _this.target.addEventListener('touchmove', _this.touchmoveHandler);
        _this.target.addEventListener('touchend', _this.touchendHandler);

        _this._lock = false;
        cb = cb || _this.options.onOpen;
        if (cb) cb(_this.target);
      };

      this.target.addEventListener(this.transEndEvent, onEnd);

      return this;
    }
  }, {
    key: 'close',
    value: function close(cb) {
      var _this2 = this;

      if (!this._shown || this._lock || this._grab) return;
      this._lock = true;

      // onBeforeClose event
      if (this.options.onBeforeClose) this.options.onBeforeClose(this.target);

      // remove overlay
      this.overlay.style.opacity = 0;

      this.target.style.transform = '';

      document.removeEventListener('scroll', this.scrollHandler);
      document.removeEventListener('keydown', this.keydownHandler);

      var onEnd = function onEnd() {
        _this2.target.removeEventListener(_this2.transEndEvent, onEnd);
        _this2.target.removeEventListener('mousedown', _this2.mousedownHandler);
        _this2.target.removeEventListener('mousemove', _this2.mousemoveHandler);
        _this2.target.removeEventListener('mouseup', _this2.mouseupHandler);
        _this2.target.removeEventListener('touchstart', _this2.touchstartHandler);
        _this2.target.removeEventListener('touchmove', _this2.touchmoveHandler);
        _this2.target.removeEventListener('touchend', _this2.touchendHandler);

        _this2.setStyle(_this2.target, _this2.originalStyles);
        _this2.parent.removeChild(_this2.overlay);
        _this2._shown = false;
        _this2._lock = false;
        _this2._grab = false;

        // downgrade source if possible
        if (_this2.target.hasAttribute('data-original')) {
          _this2.target.setAttribute('src', _this2.srcThumbnail);
        }

        cb = typeof cb === 'function' ? cb : _this2.options.onClose;
        if (cb) cb(_this2.target);
      };

      this.target.addEventListener(this.transEndEvent, onEnd);

      return this;
    }
  }, {
    key: 'grab',
    value: function grab(x, y, start, cb) {
      var _this3 = this;

      if (!this._shown || this._lock) return;
      this._grab = true;

      // onBeforeGrab event
      if (this.options.onBeforeGrab) this.options.onBeforeGrab(this.target);

      var dx = x - window.innerWidth / 2;
      var dy = y - window.innerHeight / 2;
      var oldTransform = this.target.style.transform;
      var transform = oldTransform.replace(/translate3d\(.*?\)/i, 'translate3d(' + (this.translate.x + dx) + 'px,' + (this.translate.y + dy) + 'px, 0)').replace(/scale\([0-9|\.]*\)/i, 'scale(' + (this.scale + this.options.scaleExtra) + ')');

      this.setStyle(this.target, {
        cursor: prefix + 'grabbing',
        transition: this.transformCssProp + ' ' + (start ? this.options.transitionDuration + ' ' + this.options.transitionTimingFunction : 'ease'),
        transform: transform
      });

      var onEnd = function onEnd() {
        _this3.target.removeEventListener(_this3.transEndEvent, onEnd);
        cb = cb || _this3.options.onGrab;
        if (cb) cb(_this3.target);
      };

      this.target.addEventListener(this.transEndEvent, onEnd);
    }
  }, {
    key: 'release',
    value: function release(cb) {
      var _this4 = this;

      if (!this._shown || this._lock || !this._grab) return;

      // onBeforeRelease event
      if (this.options.onBeforeRelease) this.options.onBeforeRelease(this.target);

      this.setStyle(this.target, this.openStyles);

      var onEnd = function onEnd() {
        _this4.target.removeEventListener(_this4.transEndEvent, onEnd);
        _this4._grab = false;

        cb = typeof cb === 'function' ? cb : _this4.options.onRelease;
        if (cb) cb(_this4.target);
      };

      this.target.addEventListener(this.transEndEvent, onEnd);

      return this;
    }
  }, {
    key: 'listen',
    value: function listen(el) {
      var _this5 = this;

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

        if (_this5._shown) _this5.close();else _this5.open(el);
      });

      return this;
    }
  }, {
    key: 'setStyle',
    value: function setStyle(el, styles, remember) {
      return this.setStyleHelper(el, styles, remember);
    }
  }, {
    key: 'calculateTransform',
    value: function calculateTransform() {
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

    // listeners -----------------------------------------------------------------

  }, {
    key: 'scrollHandler',
    value: function scrollHandler() {
      var scrollTop = window.pageYOffset || (document.documentElement || this.body.parentNode || this.body).scrollTop;

      if (this.lastScrollPosition === null) this.lastScrollPosition = scrollTop;

      var deltaY = this.lastScrollPosition - scrollTop;

      if (Math.abs(deltaY) >= this.options.scrollThreshold) {
        this.lastScrollPosition = null;
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
      var _this6 = this;

      e.preventDefault();

      this.pressTimer = setTimeout(function () {
        _this6._press = true;
        _this6.grab(e.clientX, e.clientY, true);
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
      var _this7 = this;

      e.preventDefault();

      this.pressTimer = setTimeout(function () {
        _this7._press = true;
        var touch = e.touches[0];
        _this7.grab(touch.clientX, touch.clientY, true);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyB3ZWJraXQgcHJlZml4XG5jb25zdCBwcmVmaXggPSAnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlID8gJy13ZWJraXQtJyA6ICcnXG5jb25zdCBwcmVzc0RlbGF5ID0gMjAwXG5cbmNvbnN0IGRlZmF1bHRzID0ge1xuICB6b29tYWJsZTogJ2ltZ1tkYXRhLWFjdGlvbj1cInpvb21cIl0nLFxuICB0cmFuc2l0aW9uRHVyYXRpb246ICcuNHMnLFxuICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb246ICdjdWJpYy1iZXppZXIoLjQsMCwwLDEpJyxcbiAgYmdDb2xvcjogJyNmZmYnLFxuICBiZ09wYWNpdHk6IDEsXG4gIHNjYWxlQmFzZTogMS4wLFxuICBzY2FsZUV4dHJhOiAwLjUsXG4gIHNjcm9sbFRocmVzaG9sZDogNDAsXG4gIG9uT3BlbjogbnVsbCxcbiAgb25DbG9zZTogbnVsbCxcbiAgb25HcmFiOiBudWxsLFxuICBvblJlbGVhc2U6IG51bGwsXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcbiAgb25CZWZvcmVHcmFiOiBudWxsLFxuICBvbkJlZm9yZVJlbGVhc2U6IG51bGxcbn1cblxuY29uc3Qgc25pZmZUcmFuc2l0aW9uID0gKGVsKSA9PiB7XG4gIGxldCByZXQgICAgID0ge31cbiAgY29uc3QgdHJhbnMgPSBbJ3dlYmtpdFRyYW5zaXRpb24nLCAndHJhbnNpdGlvbicsICdtb3pUcmFuc2l0aW9uJ11cbiAgY29uc3QgdGZvcm0gPSBbJ3dlYmtpdFRyYW5zZm9ybScsICd0cmFuc2Zvcm0nLCAnbW96VHJhbnNmb3JtJ11cbiAgY29uc3QgZW5kICAgPSB7XG4gICAgJ3RyYW5zaXRpb24nICAgICAgIDogJ3RyYW5zaXRpb25lbmQnLFxuICAgICdtb3pUcmFuc2l0aW9uJyAgICA6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAnd2Via2l0VHJhbnNpdGlvbicgOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgfVxuXG4gIHRyYW5zLnNvbWUoKHByb3ApID0+IHtcbiAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0LnRyYW5zaXRpb24gPSBwcm9wXG4gICAgICByZXQudHJhbnNFbmQgPSBlbmRbcHJvcF1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHRmb3JtLnNvbWUoKHByb3ApID0+IHtcbiAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0LnRyYW5zZm9ybSA9IHByb3BcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXRcbn1cblxuY29uc3QgY2hlY2tUcmFucyA9ICh0cmFuc2l0aW9uUHJvcCwgdHJhbnNmb3JtUHJvcCkgPT4ge1xuICByZXR1cm4gZnVuY3Rpb24gc2V0U3R5bGUoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgICBsZXQgdmFsdWVcbiAgICBpZiAoc3R5bGVzLnRyYW5zaXRpb24pIHtcbiAgICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zaXRpb25cbiAgICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNpdGlvblxuICAgICAgc3R5bGVzW3RyYW5zaXRpb25Qcm9wXSA9IHZhbHVlXG4gICAgfVxuICAgIGlmIChzdHlsZXMudHJhbnNmb3JtKSB7XG4gICAgICB2YWx1ZSA9IHN0eWxlcy50cmFuc2Zvcm1cbiAgICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNmb3JtXG4gICAgICBzdHlsZXNbdHJhbnNmb3JtUHJvcF0gPSB2YWx1ZVxuICAgIH1cblxuICAgIGxldCBzID0gZWwuc3R5bGVcbiAgICBsZXQgb3JpZ2luYWwgPSB7fVxuXG4gICAgZm9yICh2YXIga2V5IGluIHN0eWxlcykge1xuICAgICAgaWYgKHJlbWVtYmVyKSBvcmlnaW5hbFtrZXldID0gc1trZXldIHx8ICcnXG4gICAgICBzW2tleV0gPSBzdHlsZXNba2V5XVxuICAgIH1cblxuICAgIHJldHVybiBvcmlnaW5hbFxuICB9XG59XG5cbmV4cG9ydCB7IHByZWZpeCwgcHJlc3NEZWxheSwgZGVmYXVsdHMsIHNuaWZmVHJhbnNpdGlvbiwgY2hlY2tUcmFucyB9XG4iLCJpbXBvcnQgeyBwcmVmaXgsIHByZXNzRGVsYXksIGRlZmF1bHRzLCBzbmlmZlRyYW5zaXRpb24sIGNoZWNrVHJhbnMgfSBmcm9tICcuL2hlbHBlcnMnXG5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIGNvbnN0cnVjdG9yKG9wdHMpIHtcbiAgICAvLyBlbGVtZW50c1xuICAgIHRoaXMuYm9keSA9IGRvY3VtZW50LmJvZHlcbiAgICB0aGlzLm92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgIHRoaXMudGFyZ2V0XG4gICAgdGhpcy5wYXJlbnRcblxuICAgIC8vIHN0YXRlXG4gICAgdGhpcy5fc2hvd24gPSBmYWxzZVxuICAgIHRoaXMuX2xvY2sgID0gZmFsc2VcbiAgICB0aGlzLl9wcmVzcyA9IGZhbHNlXG4gICAgdGhpcy5fZ3JhYiA9IGZhbHNlXG5cbiAgICAvLyBzdHlsZVxuICAgIHRoaXMub3JpZ2luYWxTdHlsZXNcbiAgICB0aGlzLm9wZW5TdHlsZXNcbiAgICB0aGlzLnRyYW5zbGF0ZVxuICAgIHRoaXMuc2NhbGVcblxuICAgIHRoaXMuc3JjVGh1bWJuYWlsXG4gICAgdGhpcy5pbWdSZWN0XG4gICAgdGhpcy5wcmVzc1RpbWVyXG4gICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG5cbiAgICAvLyBjb21wYXRpYmlsaXR5IHN0dWZmXG4gICAgY29uc3QgdHJhbnMgPSBzbmlmZlRyYW5zaXRpb24odGhpcy5vdmVybGF5KVxuICAgIHRoaXMudHJhbnNpdGlvblByb3AgPSB0cmFucy50cmFuc2l0aW9uXG4gICAgdGhpcy50cmFuc2Zvcm1Qcm9wID0gdHJhbnMudHJhbnNmb3JtXG4gICAgdGhpcy50cmFuc2Zvcm1Dc3NQcm9wID0gdGhpcy50cmFuc2Zvcm1Qcm9wLnJlcGxhY2UoLyguKilUcmFuc2Zvcm0vLCAnLSQxLXRyYW5zZm9ybScpXG4gICAgdGhpcy50cmFuc0VuZEV2ZW50ID0gdHJhbnMudHJhbnNFbmRcbiAgICB0aGlzLnNldFN0eWxlSGVscGVyID0gY2hlY2tUcmFucyh0aGlzLnRyYW5zaXRpb25Qcm9wLCB0aGlzLnRyYW5zZm9ybVByb3ApXG5cbiAgICB0aGlzLm9wdGlvbnMgPSB7fVxuICAgIE9iamVjdC5hc3NpZ24odGhpcy5vcHRpb25zLCBkZWZhdWx0cylcbiAgICB0aGlzLmNvbmZpZyhvcHRzKVxuXG4gICAgdGhpcy5zZXRTdHlsZSh0aGlzLm92ZXJsYXksIHtcbiAgICAgIHpJbmRleDogOTk4LFxuICAgICAgYmFja2dyb3VuZDogdGhpcy5vcHRpb25zLmJnQ29sb3IsXG4gICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICByaWdodDogMCxcbiAgICAgIGJvdHRvbTogMCxcbiAgICAgIG9wYWNpdHk6IDAsXG4gICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAnICtcbiAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb25cbiAgICB9KVxuXG4gICAgdGhpcy5vdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5jbG9zZSlcblxuICAgIHRoaXMuc2Nyb2xsSGFuZGxlciA9IHRoaXMuc2Nyb2xsSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5rZXlkb3duSGFuZGxlciA9IHRoaXMua2V5ZG93bkhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMubW91c2Vkb3duSGFuZGxlciA9IHRoaXMubW91c2Vkb3duSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5tb3VzZW1vdmVIYW5kbGVyID0gdGhpcy5tb3VzZW1vdmVIYW5kbGVyLmJpbmQodGhpcylcbiAgICB0aGlzLm1vdXNldXBIYW5kbGVyID0gdGhpcy5tb3VzZXVwSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy50b3VjaHN0YXJ0SGFuZGxlciA9IHRoaXMudG91Y2hzdGFydEhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMudG91Y2htb3ZlSGFuZGxlciA9IHRoaXMudG91Y2htb3ZlSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy50b3VjaGVuZEhhbmRsZXIgPSB0aGlzLnRvdWNoZW5kSGFuZGxlci5iaW5kKHRoaXMpXG4gIH1cblxuICBjb25maWcgKG9wdHMpIHtcbiAgICBpZiAoIW9wdHMpIHJldHVybiB0aGlzXG5cbiAgICBmb3IgKGxldCBrZXkgaW4gb3B0cykge1xuICAgICAgdGhpcy5vcHRpb25zW2tleV0gPSBvcHRzW2tleV1cbiAgICB9XG5cbiAgICB0aGlzLnNldFN0eWxlKHRoaXMub3ZlcmxheSwge1xuICAgICAgYmFja2dyb3VuZENvbG9yOiB0aGlzLm9wdGlvbnMuYmdDb2xvcixcbiAgICAgIHRyYW5zaXRpb246ICdvcGFjaXR5ICcgK1xuICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9uICsgJyAnICtcbiAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxuICAgIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgb3BlbiAoZWwsIGNiKSB7XG4gICAgaWYgKHRoaXMuX3Nob3duIHx8IHRoaXMuX2xvY2sgfHwgdGhpcy5fZ3JhYikgcmV0dXJuXG5cbiAgICB0aGlzLnRhcmdldCA9IHR5cGVvZiBlbCA9PT0gJ3N0cmluZydcbiAgICAgID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbClcbiAgICAgIDogZWxcblxuICAgIGlmICh0aGlzLnRhcmdldC50YWdOYW1lICE9PSAnSU1HJykgcmV0dXJuXG5cbiAgICAvLyBvbkJlZm9yZU9wZW4gZXZlbnRcbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlT3BlbikgdGhpcy5vcHRpb25zLm9uQmVmb3JlT3Blbih0aGlzLnRhcmdldClcblxuICAgIHRoaXMuX3Nob3duID0gdHJ1ZVxuICAgIHRoaXMuX2xvY2sgPSB0cnVlXG4gICAgdGhpcy5wYXJlbnQgPSB0aGlzLnRhcmdldC5wYXJlbnROb2RlXG5cbiAgICB2YXIgaW1nID0gbmV3IEltYWdlKClcblxuICAgIGltZy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICB0aGlzLmltZ1JlY3QgPSB0aGlzLnRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuXG4gICAgICAvLyB1cGdyYWRlIHNvdXJjZSBpZiBwb3NzaWJsZVxuICAgICAgaWYgKHRoaXMudGFyZ2V0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbCcpKSB7XG4gICAgICAgIHRoaXMuc3JjVGh1bWJuYWlsID0gdGhpcy50YXJnZXQuZ2V0QXR0cmlidXRlKCdzcmMnKVxuXG4gICAgICAgIHRoaXMuc2V0U3R5bGUodGhpcy50YXJnZXQsIHtcbiAgICAgICAgICB3aWR0aDogdGhpcy5pbWdSZWN0LndpZHRoICsgJ3B4JyxcbiAgICAgICAgICBoZWlnaHQ6IHRoaXMuaW1nUmVjdC5oZWlnaHQgKyAncHgnXG4gICAgICAgIH0pXG5cbiAgICAgICAgdGhpcy50YXJnZXQuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSlcbiAgICAgIH1cblxuICAgICAgLy8gZm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgICAgdGhpcy50YXJnZXQub2Zmc2V0V2lkdGhcblxuICAgICAgdGhpcy5vcGVuU3R5bGVzID0ge1xuICAgICAgICBwb3NpdGlvbjogJ3JlbGF0aXZlJyxcbiAgICAgICAgekluZGV4OiA5OTksXG4gICAgICAgIGN1cnNvcjogcHJlZml4ICsgJ2dyYWInLFxuICAgICAgICB0cmFuc2l0aW9uOiB0aGlzLnRyYW5zZm9ybUNzc1Byb3AgKyAnICcgK1xuICAgICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24sXG4gICAgICAgIHRyYW5zZm9ybTogdGhpcy5jYWxjdWxhdGVUcmFuc2Zvcm0oKVxuICAgICAgfVxuXG4gICAgICAvLyB0cmlnZ2VyIHRyYW5zaXRpb25cbiAgICAgIHRoaXMub3JpZ2luYWxTdHlsZXMgPSB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9wZW5TdHlsZXMsIHRydWUpXG4gICAgfVxuXG4gICAgaW1nLnNyYyA9IHRoaXMudGFyZ2V0LmdldEF0dHJpYnV0ZSgnc3JjJylcblxuICAgIC8vIGluc2VydCBvdmVybGF5XG4gICAgdGhpcy5wYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5vdmVybGF5KVxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5vdmVybGF5LnN0eWxlLm9wYWNpdHkgPSB0aGlzLm9wdGlvbnMuYmdPcGFjaXR5XG4gICAgfSwgMzApXG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCB0aGlzLnNjcm9sbEhhbmRsZXIpXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMua2V5ZG93bkhhbmRsZXIpXG5cbiAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMubW91c2Vkb3duSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMubW91c2Vtb3ZlSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLm1vdXNldXBIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMudG91Y2hzdGFydEhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLnRvdWNobW92ZUhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMudG91Y2hlbmRIYW5kbGVyKVxuXG4gICAgICB0aGlzLl9sb2NrID0gZmFsc2VcbiAgICAgIGNiID0gY2IgfHwgdGhpcy5vcHRpb25zLm9uT3BlblxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgY2xvc2UgKGNiKSB7XG4gICAgaWYgKCF0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrIHx8IHRoaXMuX2dyYWIpIHJldHVyblxuICAgIHRoaXMuX2xvY2sgPSB0cnVlXG5cbiAgICAvLyBvbkJlZm9yZUNsb3NlIGV2ZW50XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZUNsb3NlKSB0aGlzLm9wdGlvbnMub25CZWZvcmVDbG9zZSh0aGlzLnRhcmdldClcblxuICAgIC8vIHJlbW92ZSBvdmVybGF5XG4gICAgdGhpcy5vdmVybGF5LnN0eWxlLm9wYWNpdHkgPSAwXG5cbiAgICB0aGlzLnRhcmdldC5zdHlsZS50cmFuc2Zvcm0gPSAnJ1xuXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgdGhpcy5zY3JvbGxIYW5kbGVyKVxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLmtleWRvd25IYW5kbGVyKVxuXG4gICAgY29uc3Qgb25FbmQgPSAoKSA9PiB7XG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLm1vdXNlZG93bkhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLm1vdXNlbW92ZUhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5tb3VzZXVwSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0aGlzLnRvdWNoc3RhcnRIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy50b3VjaG1vdmVIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0aGlzLnRvdWNoZW5kSGFuZGxlcilcblxuICAgICAgdGhpcy5zZXRTdHlsZSh0aGlzLnRhcmdldCwgdGhpcy5vcmlnaW5hbFN0eWxlcylcbiAgICAgIHRoaXMucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMub3ZlcmxheSlcbiAgICAgIHRoaXMuX3Nob3duID0gZmFsc2VcbiAgICAgIHRoaXMuX2xvY2sgPSBmYWxzZVxuICAgICAgdGhpcy5fZ3JhYiA9IGZhbHNlXG5cbiAgICAgIC8vIGRvd25ncmFkZSBzb3VyY2UgaWYgcG9zc2libGVcbiAgICAgIGlmICh0aGlzLnRhcmdldC5oYXNBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSkge1xuICAgICAgICB0aGlzLnRhcmdldC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjVGh1bWJuYWlsKVxuICAgICAgfVxuXG4gICAgICBjYiA9IHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICA/IGNiXG4gICAgICAgIDogdGhpcy5vcHRpb25zLm9uQ2xvc2VcbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGdyYWIgKHgsIHksIHN0YXJ0LCBjYikge1xuICAgIGlmICghdGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jaykgcmV0dXJuXG4gICAgdGhpcy5fZ3JhYiA9IHRydWVcblxuICAgIC8vIG9uQmVmb3JlR3JhYiBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVHcmFiKSB0aGlzLm9wdGlvbnMub25CZWZvcmVHcmFiKHRoaXMudGFyZ2V0KVxuXG4gICAgY29uc3QgZHggPSB4IC0gd2luZG93LmlubmVyV2lkdGggLyAyXG4gICAgY29uc3QgZHkgPSB5IC0gd2luZG93LmlubmVySGVpZ2h0IC8gMlxuICAgIGNvbnN0IG9sZFRyYW5zZm9ybSA9IHRoaXMudGFyZ2V0LnN0eWxlLnRyYW5zZm9ybVxuICAgIGNvbnN0IHRyYW5zZm9ybSA9IG9sZFRyYW5zZm9ybVxuICAgICAgICAgIC5yZXBsYWNlKFxuICAgICAgICAgICAgL3RyYW5zbGF0ZTNkXFwoLio/XFwpL2ksXG4gICAgICAgICAgICAndHJhbnNsYXRlM2QoJyArICh0aGlzLnRyYW5zbGF0ZS54ICsgZHgpICsgJ3B4LCcgKyAodGhpcy50cmFuc2xhdGUueSArIGR5KSArICdweCwgMCknKVxuICAgICAgICAgIC5yZXBsYWNlKFxuICAgICAgICAgICAgL3NjYWxlXFwoWzAtOXxcXC5dKlxcKS9pLFxuICAgICAgICAgICAgJ3NjYWxlKCcgKyAodGhpcy5zY2FsZSArIHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhKSArICcpJylcblxuICAgIHRoaXMuc2V0U3R5bGUodGhpcy50YXJnZXQsIHtcbiAgICAgIGN1cnNvcjogcHJlZml4ICsgJ2dyYWJiaW5nJyxcbiAgICAgIHRyYW5zaXRpb246IHRoaXMudHJhbnNmb3JtQ3NzUHJvcCArICcgJyArIChcbiAgICAgICAgc3RhcnRcbiAgICAgICAgPyB0aGlzLm9wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9uICsgJyAnICsgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxuICAgICAgICA6ICdlYXNlJ1xuICAgICAgKSxcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNmb3JtXG4gICAgfSlcblxuICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICAgICAgY2IgPSBjYiB8fCB0aGlzLm9wdGlvbnMub25HcmFiXG4gICAgICBpZiAoY2IpIGNiKHRoaXMudGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgfVxuXG4gIHJlbGVhc2UgKGNiKSB7XG4gICAgaWYgKCF0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrIHx8ICF0aGlzLl9ncmFiKSByZXR1cm5cblxuICAgIC8vIG9uQmVmb3JlUmVsZWFzZSBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVSZWxlYXNlKSB0aGlzLm9wdGlvbnMub25CZWZvcmVSZWxlYXNlKHRoaXMudGFyZ2V0KVxuXG4gICAgdGhpcy5zZXRTdHlsZSh0aGlzLnRhcmdldCwgdGhpcy5vcGVuU3R5bGVzKVxuXG4gICAgY29uc3Qgb25FbmQgPSAoKSA9PiB7XG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICB0aGlzLl9ncmFiID0gZmFsc2VcblxuICAgICAgY2IgPSB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbidcbiAgICAgICAgPyBjYlxuICAgICAgICA6IHRoaXMub3B0aW9ucy5vblJlbGVhc2VcbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGxpc3RlbiAoZWwpIHtcbiAgICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbClcbiAgICAgIGxldCBpID0gZWxzLmxlbmd0aFxuXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMubGlzdGVuKGVsc1tpXSlcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICBlbC5zdHlsZS5jdXJzb3IgPSBwcmVmaXggKyAnem9vbS1pbidcblxuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgICBpZiAodGhpcy5fc2hvd24pIHRoaXMuY2xvc2UoKVxuICAgICAgZWxzZSB0aGlzLm9wZW4oZWwpXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBzZXRTdHlsZSAoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5zZXRTdHlsZUhlbHBlcihlbCwgc3R5bGVzLCByZW1lbWJlcilcbiAgfVxuXG4gIGNhbGN1bGF0ZVRyYW5zZm9ybSAoKSB7XG4gICAgY29uc3QgaW1nSGFsZldpZHRoID0gdGhpcy5pbWdSZWN0LndpZHRoIC8gMlxuICAgIGNvbnN0IGltZ0hhbGZIZWlnaHQgPSB0aGlzLmltZ1JlY3QuaGVpZ2h0IC8gMlxuXG4gICAgY29uc3QgaW1nQ2VudGVyID0ge1xuICAgICAgeDogdGhpcy5pbWdSZWN0LmxlZnQgKyBpbWdIYWxmV2lkdGgsXG4gICAgICB5OiB0aGlzLmltZ1JlY3QudG9wICsgaW1nSGFsZkhlaWdodFxuICAgIH1cblxuICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IHtcbiAgICAgIHg6IHdpbmRvdy5pbm5lcldpZHRoIC8gMixcbiAgICAgIHk6IHdpbmRvdy5pbm5lckhlaWdodCAvIDJcbiAgICB9XG5cbiAgICAvLyBUaGUgZGlzdGFuY2UgYmV0d2VlbiBpbWFnZSBlZGdlIGFuZCB3aW5kb3cgZWRnZVxuICAgIGNvbnN0IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlID0ge1xuICAgICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdIYWxmV2lkdGgsXG4gICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIGltZ0hhbGZIZWlnaHRcbiAgICB9XG5cbiAgICBjb25zdCBzY2FsZUhvcml6b250YWxseSA9IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlLnggLyBpbWdIYWxmV2lkdGhcbiAgICBjb25zdCBzY2FsZVZlcnRpY2FsbHkgPSBkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZS55IC8gaW1nSGFsZkhlaWdodFxuXG4gICAgLy8gVGhlIHZlY3RvciB0byB0cmFuc2xhdGUgaW1hZ2UgdG8gdGhlIHdpbmRvdyBjZW50ZXJcbiAgICB0aGlzLnRyYW5zbGF0ZSA9IHtcbiAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gaW1nQ2VudGVyLngsXG4gICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIGltZ0NlbnRlci55XG4gICAgfVxuXG4gICAgLy8gVGhlIGFkZGl0aW9uYWwgc2NhbGUgaXMgYmFzZWQgb24gdGhlIHNtYWxsZXIgdmFsdWUgb2ZcbiAgICAvLyBzY2FsaW5nIGhvcml6b250YWxseSBhbmQgc2NhbGluZyB2ZXJ0aWNhbGx5XG4gICAgdGhpcy5zY2FsZSA9IHRoaXMub3B0aW9ucy5zY2FsZUJhc2UgKyBNYXRoLm1pbihzY2FsZUhvcml6b250YWxseSwgc2NhbGVWZXJ0aWNhbGx5KVxuXG4gICAgY29uc3QgdHJhbnNmb3JtID1cbiAgICAgICAgJ3RyYW5zbGF0ZTNkKCcgKyB0aGlzLnRyYW5zbGF0ZS54ICsgJ3B4LCcgKyB0aGlzLnRyYW5zbGF0ZS55ICsgJ3B4LCAwKSAnICtcbiAgICAgICAgJ3NjYWxlKCcgKyB0aGlzLnNjYWxlICsgJyknXG5cbiAgICByZXR1cm4gdHJhbnNmb3JtXG4gIH1cblxuICAvLyBsaXN0ZW5lcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICBzY3JvbGxIYW5kbGVyICgpIHtcbiAgICB2YXIgc2Nyb2xsVG9wID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8XG4gICAgICAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50IHx8IHRoaXMuYm9keS5wYXJlbnROb2RlIHx8IHRoaXMuYm9keSkuc2Nyb2xsVG9wXG5cbiAgICBpZiAodGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPT09IG51bGwpIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gc2Nyb2xsVG9wXG5cbiAgICB2YXIgZGVsdGFZID0gdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gLSBzY3JvbGxUb3BcblxuICAgIGlmIChNYXRoLmFicyhkZWx0YVkpID49IHRoaXMub3B0aW9ucy5zY3JvbGxUaHJlc2hvbGQpIHtcbiAgICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfVxuICB9XG5cbiAga2V5ZG93bkhhbmRsZXIgKGUpIHtcbiAgICB2YXIgY29kZSA9IGUua2V5IHx8IGUuY29kZVxuICAgIGlmIChjb2RlID09PSAnRXNjYXBlJyB8fCBlLmtleUNvZGUgPT09IDI3KSB0aGlzLmNsb3NlKClcbiAgfVxuXG4gIG1vdXNlZG93bkhhbmRsZXIgKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5fcHJlc3MgPSB0cnVlXG4gICAgICB0aGlzLmdyYWIoZS5jbGllbnRYLCBlLmNsaWVudFksIHRydWUpXG4gICAgfSwgcHJlc3NEZWxheSlcbiAgfVxuXG4gIG1vdXNlbW92ZUhhbmRsZXIgKGUpIHtcbiAgICBpZiAodGhpcy5fcHJlc3MpIHRoaXMuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSlcbiAgfVxuXG4gIG1vdXNldXBIYW5kbGVyICgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuICAgIHRoaXMuX3ByZXNzID0gZmFsc2VcbiAgICB0aGlzLnJlbGVhc2UoKVxuICB9XG5cbiAgdG91Y2hzdGFydEhhbmRsZXIgKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5fcHJlc3MgPSB0cnVlXG4gICAgICB2YXIgdG91Y2ggPSBlLnRvdWNoZXNbMF1cbiAgICAgIHRoaXMuZ3JhYih0b3VjaC5jbGllbnRYLCB0b3VjaC5jbGllbnRZLCB0cnVlKVxuICAgIH0sIHByZXNzRGVsYXkpXG4gIH1cblxuICB0b3VjaG1vdmVIYW5kbGVyIChlKSB7XG4gICAgaWYgKHRoaXMuX3ByZXNzKSB7XG4gICAgICB2YXIgdG91Y2ggPSBlLnRvdWNoZXNbMF1cbiAgICAgIHRoaXMuZ3JhYih0b3VjaC5jbGllbnRYLCB0b3VjaC5jbGllbnRZKVxuICAgIH1cbiAgfVxuXG4gIHRvdWNoZW5kSGFuZGxlciAoKSB7XG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucHJlc3NUaW1lcilcbiAgICB0aGlzLl9wcmVzcyA9IGZhbHNlXG4gICAgaWYgKHRoaXMuX2dyYWIpIHRoaXMucmVsZWFzZSgpXG4gICAgZWxzZSB0aGlzLmNsb3NlKClcbiAgfVxufVxuIiwiaW1wb3J0IHsgZGVmYXVsdHMgfSBmcm9tICcuL2hlbHBlcnMnXG5pbXBvcnQgWm9vbWluZyBmcm9tICcuL3pvb21pbmcnXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiB7XG5cbiAgLy8gbGlzdGVuIHRvIHpvb21hYmxlIGVsZW1lbnRzIGJ5IGRlZmF1bHRcbiAgbmV3IFpvb21pbmcoKS5saXN0ZW4oZGVmYXVsdHMuem9vbWFibGUpXG59KVxuXG5pZiAoRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgLy8gRW5hYmxlIExpdmVSZWxvYWRcbiAgZG9jdW1lbnQud3JpdGUoXG4gICAgJzxzY3JpcHQgc3JjPVwiaHR0cDovLycgKyAobG9jYXRpb24uaG9zdCB8fCAnbG9jYWxob3N0Jykuc3BsaXQoJzonKVswXSArXG4gICAgJzozNTcyOS9saXZlcmVsb2FkLmpzP3NuaXB2ZXI9MVwiPjwvJyArICdzY3JpcHQ+J1xuICApXG59XG5cbmV4cG9ydCBkZWZhdWx0IFpvb21pbmdcbiJdLCJuYW1lcyI6WyJwcmVmaXgiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsInN0eWxlIiwicHJlc3NEZWxheSIsImRlZmF1bHRzIiwic25pZmZUcmFuc2l0aW9uIiwiZWwiLCJyZXQiLCJ0cmFucyIsInRmb3JtIiwiZW5kIiwic29tZSIsInByb3AiLCJ1bmRlZmluZWQiLCJ0cmFuc2l0aW9uIiwidHJhbnNFbmQiLCJ0cmFuc2Zvcm0iLCJjaGVja1RyYW5zIiwidHJhbnNpdGlvblByb3AiLCJ0cmFuc2Zvcm1Qcm9wIiwic2V0U3R5bGUiLCJzdHlsZXMiLCJyZW1lbWJlciIsInZhbHVlIiwicyIsIm9yaWdpbmFsIiwia2V5IiwiWm9vbWluZyIsIm9wdHMiLCJib2R5Iiwib3ZlcmxheSIsImNyZWF0ZUVsZW1lbnQiLCJ0YXJnZXQiLCJwYXJlbnQiLCJfc2hvd24iLCJfbG9jayIsIl9wcmVzcyIsIl9ncmFiIiwib3JpZ2luYWxTdHlsZXMiLCJvcGVuU3R5bGVzIiwidHJhbnNsYXRlIiwic2NhbGUiLCJzcmNUaHVtYm5haWwiLCJpbWdSZWN0IiwicHJlc3NUaW1lciIsImxhc3RTY3JvbGxQb3NpdGlvbiIsInRyYW5zZm9ybUNzc1Byb3AiLCJyZXBsYWNlIiwidHJhbnNFbmRFdmVudCIsInNldFN0eWxlSGVscGVyIiwib3B0aW9ucyIsImFzc2lnbiIsImNvbmZpZyIsImJnQ29sb3IiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJ0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24iLCJhZGRFdmVudExpc3RlbmVyIiwiY2xvc2UiLCJzY3JvbGxIYW5kbGVyIiwiYmluZCIsImtleWRvd25IYW5kbGVyIiwibW91c2Vkb3duSGFuZGxlciIsIm1vdXNlbW92ZUhhbmRsZXIiLCJtb3VzZXVwSGFuZGxlciIsInRvdWNoc3RhcnRIYW5kbGVyIiwidG91Y2htb3ZlSGFuZGxlciIsInRvdWNoZW5kSGFuZGxlciIsImNiIiwicXVlcnlTZWxlY3RvciIsInRhZ05hbWUiLCJvbkJlZm9yZU9wZW4iLCJwYXJlbnROb2RlIiwiaW1nIiwiSW1hZ2UiLCJvbmxvYWQiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJoYXNBdHRyaWJ1dGUiLCJnZXRBdHRyaWJ1dGUiLCJ3aWR0aCIsImhlaWdodCIsInNldEF0dHJpYnV0ZSIsIm9mZnNldFdpZHRoIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwic3JjIiwiYXBwZW5kQ2hpbGQiLCJvcGFjaXR5IiwiYmdPcGFjaXR5Iiwib25FbmQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwib25PcGVuIiwib25CZWZvcmVDbG9zZSIsInJlbW92ZUNoaWxkIiwib25DbG9zZSIsIngiLCJ5Iiwic3RhcnQiLCJvbkJlZm9yZUdyYWIiLCJkeCIsIndpbmRvdyIsImlubmVyV2lkdGgiLCJkeSIsImlubmVySGVpZ2h0Iiwib2xkVHJhbnNmb3JtIiwic2NhbGVFeHRyYSIsIm9uR3JhYiIsIm9uQmVmb3JlUmVsZWFzZSIsIm9uUmVsZWFzZSIsImVscyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwibGVuZ3RoIiwibGlzdGVuIiwiY3Vyc29yIiwiZSIsInByZXZlbnREZWZhdWx0Iiwib3BlbiIsImltZ0hhbGZXaWR0aCIsImltZ0hhbGZIZWlnaHQiLCJpbWdDZW50ZXIiLCJsZWZ0IiwidG9wIiwid2luZG93Q2VudGVyIiwiZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsInNjYWxlQmFzZSIsIk1hdGgiLCJtaW4iLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImRlbHRhWSIsImFicyIsInNjcm9sbFRocmVzaG9sZCIsImNvZGUiLCJrZXlDb2RlIiwic2V0VGltZW91dCIsImdyYWIiLCJjbGllbnRYIiwiY2xpZW50WSIsInJlbGVhc2UiLCJ0b3VjaCIsInRvdWNoZXMiLCJ6b29tYWJsZSIsIkVOViIsIndyaXRlIiwibG9jYXRpb24iLCJob3N0Iiwic3BsaXQiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBO0FBQ0EsSUFBTUEsU0FBUyxzQkFBc0JDLFNBQVNDLGVBQVQsQ0FBeUJDLEtBQS9DLEdBQXVELFVBQXZELEdBQW9FLEVBQW5GO0FBQ0EsSUFBTUMsYUFBYSxHQUFuQjs7QUFFQSxJQUFNQyxXQUFXO1lBQ0wseUJBREs7c0JBRUssS0FGTDs0QkFHVyx3QkFIWDtXQUlOLE1BSk07YUFLSixDQUxJO2FBTUosR0FOSTtjQU9ILEdBUEc7bUJBUUUsRUFSRjtVQVNQLElBVE87V0FVTixJQVZNO1VBV1AsSUFYTzthQVlKLElBWkk7Z0JBYUQsSUFiQztpQkFjQSxJQWRBO2dCQWVELElBZkM7bUJBZ0JFO0NBaEJuQjs7QUFtQkEsSUFBTUMsa0JBQWtCLFNBQWxCQSxlQUFrQixDQUFDQyxFQUFELEVBQVE7TUFDMUJDLE1BQVUsRUFBZDtNQUNNQyxRQUFRLENBQUMsa0JBQUQsRUFBcUIsWUFBckIsRUFBbUMsZUFBbkMsQ0FBZDtNQUNNQyxRQUFRLENBQUMsaUJBQUQsRUFBb0IsV0FBcEIsRUFBaUMsY0FBakMsQ0FBZDtNQUNNQyxNQUFRO2tCQUNTLGVBRFQ7cUJBRVMsZUFGVDt3QkFHUztHQUh2Qjs7UUFNTUMsSUFBTixDQUFXLFVBQUNDLElBQUQsRUFBVTtRQUNmTixH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
