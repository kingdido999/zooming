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

    if (this.options.enableGrab) {
      this.mousedownHandler = this.mousedownHandler.bind(this);
      this.mousemoveHandler = this.mousemoveHandler.bind(this);
      this.mouseupHandler = this.mouseupHandler.bind(this);
      this.touchstartHandler = this.touchstartHandler.bind(this);
      this.touchmoveHandler = this.touchmoveHandler.bind(this);
      this.touchendHandler = this.touchendHandler.bind(this);
    }
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
          cursor: prefix + (_this.options.enableGrab ? 'grab' : 'zoom-out'),
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

        if (_this.options.enableGrab) {
          _this.target.addEventListener('mousedown', _this.mousedownHandler);
          _this.target.addEventListener('mousemove', _this.mousemoveHandler);
          _this.target.addEventListener('mouseup', _this.mouseupHandler);
          _this.target.addEventListener('touchstart', _this.touchstartHandler);
          _this.target.addEventListener('touchmove', _this.touchmoveHandler);
          _this.target.addEventListener('touchend', _this.touchendHandler);
        }

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

        if (_this2.options.enableGrab) {
          _this2.target.removeEventListener('mousedown', _this2.mousedownHandler);
          _this2.target.removeEventListener('mousemove', _this2.mousemoveHandler);
          _this2.target.removeEventListener('mouseup', _this2.mouseupHandler);
          _this2.target.removeEventListener('touchstart', _this2.touchstartHandler);
          _this2.target.removeEventListener('touchmove', _this2.touchmoveHandler);
          _this2.target.removeEventListener('touchend', _this2.touchendHandler);
        }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyB3ZWJraXQgcHJlZml4XG5jb25zdCBwcmVmaXggPSAnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlID8gJy13ZWJraXQtJyA6ICcnXG5jb25zdCBwcmVzc0RlbGF5ID0gMjAwXG5cbmNvbnN0IGRlZmF1bHRzID0ge1xuICB6b29tYWJsZTogJ2ltZ1tkYXRhLWFjdGlvbj1cInpvb21cIl0nLFxuICBlbmFibGVHcmFiOiB0cnVlLFxuICB0cmFuc2l0aW9uRHVyYXRpb246ICcuNHMnLFxuICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb246ICdjdWJpYy1iZXppZXIoLjQsMCwwLDEpJyxcbiAgYmdDb2xvcjogJyNmZmYnLFxuICBiZ09wYWNpdHk6IDEsXG4gIHNjYWxlQmFzZTogMS4wLFxuICBzY2FsZUV4dHJhOiAwLjUsXG4gIHNjcm9sbFRocmVzaG9sZDogNDAsXG4gIG9uT3BlbjogbnVsbCxcbiAgb25DbG9zZTogbnVsbCxcbiAgb25HcmFiOiBudWxsLFxuICBvblJlbGVhc2U6IG51bGwsXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcbiAgb25CZWZvcmVHcmFiOiBudWxsLFxuICBvbkJlZm9yZVJlbGVhc2U6IG51bGxcbn1cblxuY29uc3Qgc25pZmZUcmFuc2l0aW9uID0gKGVsKSA9PiB7XG4gIGxldCByZXQgICAgID0ge31cbiAgY29uc3QgdHJhbnMgPSBbJ3dlYmtpdFRyYW5zaXRpb24nLCAndHJhbnNpdGlvbicsICdtb3pUcmFuc2l0aW9uJ11cbiAgY29uc3QgdGZvcm0gPSBbJ3dlYmtpdFRyYW5zZm9ybScsICd0cmFuc2Zvcm0nLCAnbW96VHJhbnNmb3JtJ11cbiAgY29uc3QgZW5kICAgPSB7XG4gICAgJ3RyYW5zaXRpb24nICAgICAgIDogJ3RyYW5zaXRpb25lbmQnLFxuICAgICdtb3pUcmFuc2l0aW9uJyAgICA6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAnd2Via2l0VHJhbnNpdGlvbicgOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgfVxuXG4gIHRyYW5zLnNvbWUoKHByb3ApID0+IHtcbiAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0LnRyYW5zaXRpb24gPSBwcm9wXG4gICAgICByZXQudHJhbnNFbmQgPSBlbmRbcHJvcF1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHRmb3JtLnNvbWUoKHByb3ApID0+IHtcbiAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0LnRyYW5zZm9ybSA9IHByb3BcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXRcbn1cblxuY29uc3QgY2hlY2tUcmFucyA9ICh0cmFuc2l0aW9uUHJvcCwgdHJhbnNmb3JtUHJvcCkgPT4ge1xuICByZXR1cm4gZnVuY3Rpb24gc2V0U3R5bGUoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgICBsZXQgdmFsdWVcbiAgICBpZiAoc3R5bGVzLnRyYW5zaXRpb24pIHtcbiAgICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zaXRpb25cbiAgICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNpdGlvblxuICAgICAgc3R5bGVzW3RyYW5zaXRpb25Qcm9wXSA9IHZhbHVlXG4gICAgfVxuICAgIGlmIChzdHlsZXMudHJhbnNmb3JtKSB7XG4gICAgICB2YWx1ZSA9IHN0eWxlcy50cmFuc2Zvcm1cbiAgICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNmb3JtXG4gICAgICBzdHlsZXNbdHJhbnNmb3JtUHJvcF0gPSB2YWx1ZVxuICAgIH1cblxuICAgIGxldCBzID0gZWwuc3R5bGVcbiAgICBsZXQgb3JpZ2luYWwgPSB7fVxuXG4gICAgZm9yICh2YXIga2V5IGluIHN0eWxlcykge1xuICAgICAgaWYgKHJlbWVtYmVyKSBvcmlnaW5hbFtrZXldID0gc1trZXldIHx8ICcnXG4gICAgICBzW2tleV0gPSBzdHlsZXNba2V5XVxuICAgIH1cblxuICAgIHJldHVybiBvcmlnaW5hbFxuICB9XG59XG5cbmV4cG9ydCB7IHByZWZpeCwgcHJlc3NEZWxheSwgZGVmYXVsdHMsIHNuaWZmVHJhbnNpdGlvbiwgY2hlY2tUcmFucyB9XG4iLCJpbXBvcnQgeyBwcmVmaXgsIHByZXNzRGVsYXksIGRlZmF1bHRzLCBzbmlmZlRyYW5zaXRpb24sIGNoZWNrVHJhbnMgfSBmcm9tICcuL2hlbHBlcnMnXG5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIGNvbnN0cnVjdG9yKG9wdHMpIHtcbiAgICAvLyBlbGVtZW50c1xuICAgIHRoaXMuYm9keSA9IGRvY3VtZW50LmJvZHlcbiAgICB0aGlzLm92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgIHRoaXMudGFyZ2V0XG4gICAgdGhpcy5wYXJlbnRcblxuICAgIC8vIHN0YXRlXG4gICAgdGhpcy5fc2hvd24gPSBmYWxzZVxuICAgIHRoaXMuX2xvY2sgID0gZmFsc2VcbiAgICB0aGlzLl9wcmVzcyA9IGZhbHNlXG4gICAgdGhpcy5fZ3JhYiA9IGZhbHNlXG5cbiAgICAvLyBzdHlsZVxuICAgIHRoaXMub3JpZ2luYWxTdHlsZXNcbiAgICB0aGlzLm9wZW5TdHlsZXNcbiAgICB0aGlzLnRyYW5zbGF0ZVxuICAgIHRoaXMuc2NhbGVcblxuICAgIHRoaXMuc3JjVGh1bWJuYWlsXG4gICAgdGhpcy5pbWdSZWN0XG4gICAgdGhpcy5wcmVzc1RpbWVyXG4gICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG5cbiAgICAvLyBjb21wYXRpYmlsaXR5IHN0dWZmXG4gICAgY29uc3QgdHJhbnMgPSBzbmlmZlRyYW5zaXRpb24odGhpcy5vdmVybGF5KVxuICAgIHRoaXMudHJhbnNpdGlvblByb3AgPSB0cmFucy50cmFuc2l0aW9uXG4gICAgdGhpcy50cmFuc2Zvcm1Qcm9wID0gdHJhbnMudHJhbnNmb3JtXG4gICAgdGhpcy50cmFuc2Zvcm1Dc3NQcm9wID0gdGhpcy50cmFuc2Zvcm1Qcm9wLnJlcGxhY2UoLyguKilUcmFuc2Zvcm0vLCAnLSQxLXRyYW5zZm9ybScpXG4gICAgdGhpcy50cmFuc0VuZEV2ZW50ID0gdHJhbnMudHJhbnNFbmRcbiAgICB0aGlzLnNldFN0eWxlSGVscGVyID0gY2hlY2tUcmFucyh0aGlzLnRyYW5zaXRpb25Qcm9wLCB0aGlzLnRyYW5zZm9ybVByb3ApXG5cbiAgICB0aGlzLm9wdGlvbnMgPSB7fVxuICAgIE9iamVjdC5hc3NpZ24odGhpcy5vcHRpb25zLCBkZWZhdWx0cylcbiAgICB0aGlzLmNvbmZpZyhvcHRzKVxuXG4gICAgdGhpcy5zZXRTdHlsZSh0aGlzLm92ZXJsYXksIHtcbiAgICAgIHpJbmRleDogOTk4LFxuICAgICAgYmFja2dyb3VuZDogdGhpcy5vcHRpb25zLmJnQ29sb3IsXG4gICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICByaWdodDogMCxcbiAgICAgIGJvdHRvbTogMCxcbiAgICAgIG9wYWNpdHk6IDAsXG4gICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAnICtcbiAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb25cbiAgICB9KVxuXG4gICAgdGhpcy5vdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5jbG9zZSlcblxuICAgIHRoaXMuc2Nyb2xsSGFuZGxlciA9IHRoaXMuc2Nyb2xsSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5rZXlkb3duSGFuZGxlciA9IHRoaXMua2V5ZG93bkhhbmRsZXIuYmluZCh0aGlzKVxuICAgIFxuICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgdGhpcy5tb3VzZWRvd25IYW5kbGVyID0gdGhpcy5tb3VzZWRvd25IYW5kbGVyLmJpbmQodGhpcylcbiAgICAgIHRoaXMubW91c2Vtb3ZlSGFuZGxlciA9IHRoaXMubW91c2Vtb3ZlSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgICB0aGlzLm1vdXNldXBIYW5kbGVyID0gdGhpcy5tb3VzZXVwSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgICB0aGlzLnRvdWNoc3RhcnRIYW5kbGVyID0gdGhpcy50b3VjaHN0YXJ0SGFuZGxlci5iaW5kKHRoaXMpXG4gICAgICB0aGlzLnRvdWNobW92ZUhhbmRsZXIgPSB0aGlzLnRvdWNobW92ZUhhbmRsZXIuYmluZCh0aGlzKVxuICAgICAgdGhpcy50b3VjaGVuZEhhbmRsZXIgPSB0aGlzLnRvdWNoZW5kSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgfVxuICB9XG5cbiAgY29uZmlnIChvcHRzKSB7XG4gICAgaWYgKCFvcHRzKSByZXR1cm4gdGhpc1xuXG4gICAgZm9yIChsZXQga2V5IGluIG9wdHMpIHtcbiAgICAgIHRoaXMub3B0aW9uc1trZXldID0gb3B0c1trZXldXG4gICAgfVxuXG4gICAgdGhpcy5zZXRTdHlsZSh0aGlzLm92ZXJsYXksIHtcbiAgICAgIGJhY2tncm91bmRDb2xvcjogdGhpcy5vcHRpb25zLmJnQ29sb3IsXG4gICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAnICtcbiAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb25cbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIG9wZW4gKGVsLCBjYikge1xuICAgIGlmICh0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrIHx8IHRoaXMuX2dyYWIpIHJldHVyblxuXG4gICAgdGhpcy50YXJnZXQgPSB0eXBlb2YgZWwgPT09ICdzdHJpbmcnXG4gICAgICA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpXG4gICAgICA6IGVsXG5cbiAgICBpZiAodGhpcy50YXJnZXQudGFnTmFtZSAhPT0gJ0lNRycpIHJldHVyblxuXG4gICAgLy8gb25CZWZvcmVPcGVuIGV2ZW50XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4pIHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4odGhpcy50YXJnZXQpXG5cbiAgICB0aGlzLl9zaG93biA9IHRydWVcbiAgICB0aGlzLl9sb2NrID0gdHJ1ZVxuICAgIHRoaXMucGFyZW50ID0gdGhpcy50YXJnZXQucGFyZW50Tm9kZVxuXG4gICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpXG5cbiAgICBpbWcub25sb2FkID0gKCkgPT4ge1xuICAgICAgdGhpcy5pbWdSZWN0ID0gdGhpcy50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcblxuICAgICAgLy8gdXBncmFkZSBzb3VyY2UgaWYgcG9zc2libGVcbiAgICAgIGlmICh0aGlzLnRhcmdldC5oYXNBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSkge1xuICAgICAgICB0aGlzLnNyY1RodW1ibmFpbCA9IHRoaXMudGFyZ2V0LmdldEF0dHJpYnV0ZSgnc3JjJylcblxuICAgICAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB7XG4gICAgICAgICAgd2lkdGg6IHRoaXMuaW1nUmVjdC53aWR0aCArICdweCcsXG4gICAgICAgICAgaGVpZ2h0OiB0aGlzLmltZ1JlY3QuaGVpZ2h0ICsgJ3B4J1xuICAgICAgICB9KVxuXG4gICAgICAgIHRoaXMudGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsJykpXG4gICAgICB9XG5cbiAgICAgIC8vIGZvcmNlIGxheW91dCB1cGRhdGVcbiAgICAgIHRoaXMudGFyZ2V0Lm9mZnNldFdpZHRoXG5cbiAgICAgIHRoaXMub3BlblN0eWxlcyA9IHtcbiAgICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgICAgIHpJbmRleDogOTk5LFxuICAgICAgICBjdXJzb3I6IHByZWZpeCArICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYiA/ICdncmFiJyA6ICd6b29tLW91dCcpLFxuICAgICAgICB0cmFuc2l0aW9uOiB0aGlzLnRyYW5zZm9ybUNzc1Byb3AgKyAnICcgK1xuICAgICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24sXG4gICAgICAgIHRyYW5zZm9ybTogdGhpcy5jYWxjdWxhdGVUcmFuc2Zvcm0oKVxuICAgICAgfVxuXG4gICAgICAvLyB0cmlnZ2VyIHRyYW5zaXRpb25cbiAgICAgIHRoaXMub3JpZ2luYWxTdHlsZXMgPSB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9wZW5TdHlsZXMsIHRydWUpXG4gICAgfVxuXG4gICAgaW1nLnNyYyA9IHRoaXMudGFyZ2V0LmdldEF0dHJpYnV0ZSgnc3JjJylcblxuICAgIC8vIGluc2VydCBvdmVybGF5XG4gICAgdGhpcy5wYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5vdmVybGF5KVxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5vdmVybGF5LnN0eWxlLm9wYWNpdHkgPSB0aGlzLm9wdGlvbnMuYmdPcGFjaXR5XG4gICAgfSwgMzApXG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCB0aGlzLnNjcm9sbEhhbmRsZXIpXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMua2V5ZG93bkhhbmRsZXIpXG5cbiAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lbmFibGVHcmFiKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMubW91c2Vkb3duSGFuZGxlcilcbiAgICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5tb3VzZW1vdmVIYW5kbGVyKVxuICAgICAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5tb3VzZXVwSGFuZGxlcilcbiAgICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMudG91Y2hzdGFydEhhbmRsZXIpXG4gICAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMudG91Y2htb3ZlSGFuZGxlcilcbiAgICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0aGlzLnRvdWNoZW5kSGFuZGxlcilcbiAgICAgIH1cblxuICAgICAgdGhpcy5fbG9jayA9IGZhbHNlXG4gICAgICBjYiA9IGNiIHx8IHRoaXMub3B0aW9ucy5vbk9wZW5cbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGNsb3NlIChjYikge1xuICAgIGlmICghdGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jayB8fCB0aGlzLl9ncmFiKSByZXR1cm5cbiAgICB0aGlzLl9sb2NrID0gdHJ1ZVxuXG4gICAgLy8gb25CZWZvcmVDbG9zZSBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVDbG9zZSkgdGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UodGhpcy50YXJnZXQpXG5cbiAgICAvLyByZW1vdmUgb3ZlcmxheVxuICAgIHRoaXMub3ZlcmxheS5zdHlsZS5vcGFjaXR5ID0gMFxuXG4gICAgdGhpcy50YXJnZXQuc3R5bGUudHJhbnNmb3JtID0gJydcblxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIHRoaXMuc2Nyb2xsSGFuZGxlcilcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5rZXlkb3duSGFuZGxlcilcblxuICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHtcbiAgICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5tb3VzZWRvd25IYW5kbGVyKVxuICAgICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLm1vdXNlbW92ZUhhbmRsZXIpXG4gICAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLm1vdXNldXBIYW5kbGVyKVxuICAgICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy50b3VjaHN0YXJ0SGFuZGxlcilcbiAgICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy50b3VjaG1vdmVIYW5kbGVyKVxuICAgICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMudG91Y2hlbmRIYW5kbGVyKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9yaWdpbmFsU3R5bGVzKVxuICAgICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5vdmVybGF5KVxuICAgICAgdGhpcy5fc2hvd24gPSBmYWxzZVxuICAgICAgdGhpcy5fbG9jayA9IGZhbHNlXG4gICAgICB0aGlzLl9ncmFiID0gZmFsc2VcblxuICAgICAgLy8gZG93bmdyYWRlIHNvdXJjZSBpZiBwb3NzaWJsZVxuICAgICAgaWYgKHRoaXMudGFyZ2V0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbCcpKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNUaHVtYm5haWwpXG4gICAgICB9XG5cbiAgICAgIGNiID0gdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nXG4gICAgICAgID8gY2JcbiAgICAgICAgOiB0aGlzLm9wdGlvbnMub25DbG9zZVxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgZ3JhYiAoeCwgeSwgc3RhcnQsIGNiKSB7XG4gICAgaWYgKCF0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrKSByZXR1cm5cbiAgICB0aGlzLl9ncmFiID0gdHJ1ZVxuXG4gICAgLy8gb25CZWZvcmVHcmFiIGV2ZW50XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIpIHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIodGhpcy50YXJnZXQpXG5cbiAgICBjb25zdCBkeCA9IHggLSB3aW5kb3cuaW5uZXJXaWR0aCAvIDJcbiAgICBjb25zdCBkeSA9IHkgLSB3aW5kb3cuaW5uZXJIZWlnaHQgLyAyXG4gICAgY29uc3Qgb2xkVHJhbnNmb3JtID0gdGhpcy50YXJnZXQuc3R5bGUudHJhbnNmb3JtXG4gICAgY29uc3QgdHJhbnNmb3JtID0gb2xkVHJhbnNmb3JtXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAvdHJhbnNsYXRlM2RcXCguKj9cXCkvaSxcbiAgICAgICAgICAgICd0cmFuc2xhdGUzZCgnICsgKHRoaXMudHJhbnNsYXRlLnggKyBkeCkgKyAncHgsJyArICh0aGlzLnRyYW5zbGF0ZS55ICsgZHkpICsgJ3B4LCAwKScpXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAvc2NhbGVcXChbMC05fFxcLl0qXFwpL2ksXG4gICAgICAgICAgICAnc2NhbGUoJyArICh0aGlzLnNjYWxlICsgdGhpcy5vcHRpb25zLnNjYWxlRXh0cmEpICsgJyknKVxuXG4gICAgdGhpcy5zZXRTdHlsZSh0aGlzLnRhcmdldCwge1xuICAgICAgY3Vyc29yOiBwcmVmaXggKyAnZ3JhYmJpbmcnLFxuICAgICAgdHJhbnNpdGlvbjogdGhpcy50cmFuc2Zvcm1Dc3NQcm9wICsgJyAnICsgKFxuICAgICAgICBzdGFydFxuICAgICAgICA/IHRoaXMub3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgKyB0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgICAgIDogJ2Vhc2UnXG4gICAgICApLFxuICAgICAgdHJhbnNmb3JtOiB0cmFuc2Zvcm1cbiAgICB9KVxuXG4gICAgY29uc3Qgb25FbmQgPSAoKSA9PiB7XG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICBjYiA9IGNiIHx8IHRoaXMub3B0aW9ucy5vbkdyYWJcbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICB9XG5cbiAgcmVsZWFzZSAoY2IpIHtcbiAgICBpZiAoIXRoaXMuX3Nob3duIHx8IHRoaXMuX2xvY2sgfHwgIXRoaXMuX2dyYWIpIHJldHVyblxuXG4gICAgLy8gb25CZWZvcmVSZWxlYXNlIGV2ZW50XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UpIHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UodGhpcy50YXJnZXQpXG5cbiAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9wZW5TdHlsZXMpXG5cbiAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIHRoaXMuX2dyYWIgPSBmYWxzZVxuXG4gICAgICBjYiA9IHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICA/IGNiXG4gICAgICAgIDogdGhpcy5vcHRpb25zLm9uUmVsZWFzZVxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgbGlzdGVuIChlbCkge1xuICAgIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGVsKVxuICAgICAgbGV0IGkgPSBlbHMubGVuZ3RoXG5cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5saXN0ZW4oZWxzW2ldKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGVsLnN0eWxlLmN1cnNvciA9IHByZWZpeCArICd6b29tLWluJ1xuXG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIGlmICh0aGlzLl9zaG93bikgdGhpcy5jbG9zZSgpXG4gICAgICBlbHNlIHRoaXMub3BlbihlbClcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHNldFN0eWxlIChlbCwgc3R5bGVzLCByZW1lbWJlcikge1xuICAgIHJldHVybiB0aGlzLnNldFN0eWxlSGVscGVyKGVsLCBzdHlsZXMsIHJlbWVtYmVyKVxuICB9XG5cbiAgY2FsY3VsYXRlVHJhbnNmb3JtICgpIHtcbiAgICBjb25zdCBpbWdIYWxmV2lkdGggPSB0aGlzLmltZ1JlY3Qud2lkdGggLyAyXG4gICAgY29uc3QgaW1nSGFsZkhlaWdodCA9IHRoaXMuaW1nUmVjdC5oZWlnaHQgLyAyXG5cbiAgICBjb25zdCBpbWdDZW50ZXIgPSB7XG4gICAgICB4OiB0aGlzLmltZ1JlY3QubGVmdCArIGltZ0hhbGZXaWR0aCxcbiAgICAgIHk6IHRoaXMuaW1nUmVjdC50b3AgKyBpbWdIYWxmSGVpZ2h0XG4gICAgfVxuXG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0ge1xuICAgICAgeDogd2luZG93LmlubmVyV2lkdGggLyAyLFxuICAgICAgeTogd2luZG93LmlubmVySGVpZ2h0IC8gMlxuICAgIH1cblxuICAgIC8vIFRoZSBkaXN0YW5jZSBiZXR3ZWVuIGltYWdlIGVkZ2UgYW5kIHdpbmRvdyBlZGdlXG4gICAgY29uc3QgZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UgPSB7XG4gICAgICB4OiB3aW5kb3dDZW50ZXIueCAtIGltZ0hhbGZXaWR0aCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gaW1nSGFsZkhlaWdodFxuICAgIH1cblxuICAgIGNvbnN0IHNjYWxlSG9yaXpvbnRhbGx5ID0gZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UueCAvIGltZ0hhbGZXaWR0aFxuICAgIGNvbnN0IHNjYWxlVmVydGljYWxseSA9IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlLnkgLyBpbWdIYWxmSGVpZ2h0XG5cbiAgICAvLyBUaGUgdmVjdG9yIHRvIHRyYW5zbGF0ZSBpbWFnZSB0byB0aGUgd2luZG93IGNlbnRlclxuICAgIHRoaXMudHJhbnNsYXRlID0ge1xuICAgICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdDZW50ZXIueCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gaW1nQ2VudGVyLnlcbiAgICB9XG5cbiAgICAvLyBUaGUgYWRkaXRpb25hbCBzY2FsZSBpcyBiYXNlZCBvbiB0aGUgc21hbGxlciB2YWx1ZSBvZlxuICAgIC8vIHNjYWxpbmcgaG9yaXpvbnRhbGx5IGFuZCBzY2FsaW5nIHZlcnRpY2FsbHlcbiAgICB0aGlzLnNjYWxlID0gdGhpcy5vcHRpb25zLnNjYWxlQmFzZSArIE1hdGgubWluKHNjYWxlSG9yaXpvbnRhbGx5LCBzY2FsZVZlcnRpY2FsbHkpXG5cbiAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlM2QoJyArIHRoaXMudHJhbnNsYXRlLnggKyAncHgsJyArIHRoaXMudHJhbnNsYXRlLnkgKyAncHgsIDApICcgK1xuICAgICAgICAnc2NhbGUoJyArIHRoaXMuc2NhbGUgKyAnKSdcblxuICAgIHJldHVybiB0cmFuc2Zvcm1cbiAgfVxuXG4gIC8vIGxpc3RlbmVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIHNjcm9sbEhhbmRsZXIgKCkge1xuICAgIHZhciBzY3JvbGxUb3AgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHxcbiAgICAgIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgfHwgdGhpcy5ib2R5LnBhcmVudE5vZGUgfHwgdGhpcy5ib2R5KS5zY3JvbGxUb3BcblxuICAgIGlmICh0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9PT0gbnVsbCkgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBzY3JvbGxUb3BcblxuICAgIHZhciBkZWx0YVkgPSB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiAtIHNjcm9sbFRvcFxuXG4gICAgaWYgKE1hdGguYWJzKGRlbHRhWSkgPj0gdGhpcy5vcHRpb25zLnNjcm9sbFRocmVzaG9sZCkge1xuICAgICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9XG4gIH1cblxuICBrZXlkb3duSGFuZGxlciAoZSkge1xuICAgIHZhciBjb2RlID0gZS5rZXkgfHwgZS5jb2RlXG4gICAgaWYgKGNvZGUgPT09ICdFc2NhcGUnIHx8IGUua2V5Q29kZSA9PT0gMjcpIHRoaXMuY2xvc2UoKVxuICB9XG5cbiAgbW91c2Vkb3duSGFuZGxlciAoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLl9wcmVzcyA9IHRydWVcbiAgICAgIHRoaXMuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSwgdHJ1ZSlcbiAgICB9LCBwcmVzc0RlbGF5KVxuICB9XG5cbiAgbW91c2Vtb3ZlSGFuZGxlciAoZSkge1xuICAgIGlmICh0aGlzLl9wcmVzcykgdGhpcy5ncmFiKGUuY2xpZW50WCwgZS5jbGllbnRZKVxuICB9XG5cbiAgbW91c2V1cEhhbmRsZXIgKCkge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnByZXNzVGltZXIpXG4gICAgdGhpcy5fcHJlc3MgPSBmYWxzZVxuICAgIHRoaXMucmVsZWFzZSgpXG4gIH1cblxuICB0b3VjaHN0YXJ0SGFuZGxlciAoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLl9wcmVzcyA9IHRydWVcbiAgICAgIHZhciB0b3VjaCA9IGUudG91Y2hlc1swXVxuICAgICAgdGhpcy5ncmFiKHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFksIHRydWUpXG4gICAgfSwgcHJlc3NEZWxheSlcbiAgfVxuXG4gIHRvdWNobW92ZUhhbmRsZXIgKGUpIHtcbiAgICBpZiAodGhpcy5fcHJlc3MpIHtcbiAgICAgIHZhciB0b3VjaCA9IGUudG91Y2hlc1swXVxuICAgICAgdGhpcy5ncmFiKHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFkpXG4gICAgfVxuICB9XG5cbiAgdG91Y2hlbmRIYW5kbGVyICgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuICAgIHRoaXMuX3ByZXNzID0gZmFsc2VcbiAgICBpZiAodGhpcy5fZ3JhYikgdGhpcy5yZWxlYXNlKClcbiAgICBlbHNlIHRoaXMuY2xvc2UoKVxuICB9XG59XG4iLCJpbXBvcnQgeyBkZWZhdWx0cyB9IGZyb20gJy4vaGVscGVycydcbmltcG9ydCBab29taW5nIGZyb20gJy4vem9vbWluZydcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcblxuICAvLyBsaXN0ZW4gdG8gem9vbWFibGUgZWxlbWVudHMgYnkgZGVmYXVsdFxuICBuZXcgWm9vbWluZygpLmxpc3RlbihkZWZhdWx0cy56b29tYWJsZSlcbn0pXG5cbmlmIChFTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAvLyBFbmFibGUgTGl2ZVJlbG9hZFxuICBkb2N1bWVudC53cml0ZShcbiAgICAnPHNjcmlwdCBzcmM9XCJodHRwOi8vJyArIChsb2NhdGlvbi5ob3N0IHx8ICdsb2NhbGhvc3QnKS5zcGxpdCgnOicpWzBdICtcbiAgICAnOjM1NzI5L2xpdmVyZWxvYWQuanM/c25pcHZlcj0xXCI+PC8nICsgJ3NjcmlwdD4nXG4gIClcbn1cblxuZXhwb3J0IGRlZmF1bHQgWm9vbWluZ1xuIl0sIm5hbWVzIjpbInByZWZpeCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50Iiwic3R5bGUiLCJwcmVzc0RlbGF5IiwiZGVmYXVsdHMiLCJzbmlmZlRyYW5zaXRpb24iLCJlbCIsInJldCIsInRyYW5zIiwidGZvcm0iLCJlbmQiLCJzb21lIiwicHJvcCIsInVuZGVmaW5lZCIsInRyYW5zaXRpb24iLCJ0cmFuc0VuZCIsInRyYW5zZm9ybSIsImNoZWNrVHJhbnMiLCJ0cmFuc2l0aW9uUHJvcCIsInRyYW5zZm9ybVByb3AiLCJzZXRTdHlsZSIsInN0eWxlcyIsInJlbWVtYmVyIiwidmFsdWUiLCJzIiwib3JpZ2luYWwiLCJrZXkiLCJab29taW5nIiwib3B0cyIsImJvZHkiLCJvdmVybGF5IiwiY3JlYXRlRWxlbWVudCIsInRhcmdldCIsInBhcmVudCIsIl9zaG93biIsIl9sb2NrIiwiX3ByZXNzIiwiX2dyYWIiLCJvcmlnaW5hbFN0eWxlcyIsIm9wZW5TdHlsZXMiLCJ0cmFuc2xhdGUiLCJzY2FsZSIsInNyY1RodW1ibmFpbCIsImltZ1JlY3QiLCJwcmVzc1RpbWVyIiwibGFzdFNjcm9sbFBvc2l0aW9uIiwidHJhbnNmb3JtQ3NzUHJvcCIsInJlcGxhY2UiLCJ0cmFuc0VuZEV2ZW50Iiwic2V0U3R5bGVIZWxwZXIiLCJvcHRpb25zIiwiYXNzaWduIiwiY29uZmlnIiwiYmdDb2xvciIsInRyYW5zaXRpb25EdXJhdGlvbiIsInRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbiIsImFkZEV2ZW50TGlzdGVuZXIiLCJjbG9zZSIsInNjcm9sbEhhbmRsZXIiLCJiaW5kIiwia2V5ZG93bkhhbmRsZXIiLCJlbmFibGVHcmFiIiwibW91c2Vkb3duSGFuZGxlciIsIm1vdXNlbW92ZUhhbmRsZXIiLCJtb3VzZXVwSGFuZGxlciIsInRvdWNoc3RhcnRIYW5kbGVyIiwidG91Y2htb3ZlSGFuZGxlciIsInRvdWNoZW5kSGFuZGxlciIsImNiIiwicXVlcnlTZWxlY3RvciIsInRhZ05hbWUiLCJvbkJlZm9yZU9wZW4iLCJwYXJlbnROb2RlIiwiaW1nIiwiSW1hZ2UiLCJvbmxvYWQiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJoYXNBdHRyaWJ1dGUiLCJnZXRBdHRyaWJ1dGUiLCJ3aWR0aCIsImhlaWdodCIsInNldEF0dHJpYnV0ZSIsIm9mZnNldFdpZHRoIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwic3JjIiwiYXBwZW5kQ2hpbGQiLCJvcGFjaXR5IiwiYmdPcGFjaXR5Iiwib25FbmQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwib25PcGVuIiwib25CZWZvcmVDbG9zZSIsInJlbW92ZUNoaWxkIiwib25DbG9zZSIsIngiLCJ5Iiwic3RhcnQiLCJvbkJlZm9yZUdyYWIiLCJkeCIsIndpbmRvdyIsImlubmVyV2lkdGgiLCJkeSIsImlubmVySGVpZ2h0Iiwib2xkVHJhbnNmb3JtIiwic2NhbGVFeHRyYSIsIm9uR3JhYiIsIm9uQmVmb3JlUmVsZWFzZSIsIm9uUmVsZWFzZSIsImVscyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwibGVuZ3RoIiwibGlzdGVuIiwiY3Vyc29yIiwiZSIsInByZXZlbnREZWZhdWx0Iiwib3BlbiIsImltZ0hhbGZXaWR0aCIsImltZ0hhbGZIZWlnaHQiLCJpbWdDZW50ZXIiLCJsZWZ0IiwidG9wIiwid2luZG93Q2VudGVyIiwiZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsInNjYWxlQmFzZSIsIk1hdGgiLCJtaW4iLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImRlbHRhWSIsImFicyIsInNjcm9sbFRocmVzaG9sZCIsImNvZGUiLCJrZXlDb2RlIiwic2V0VGltZW91dCIsImdyYWIiLCJjbGllbnRYIiwiY2xpZW50WSIsInJlbGVhc2UiLCJ0b3VjaCIsInRvdWNoZXMiLCJ6b29tYWJsZSIsIkVOViIsIndyaXRlIiwibG9jYXRpb24iLCJob3N0Iiwic3BsaXQiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBO0FBQ0EsSUFBTUEsU0FBUyxzQkFBc0JDLFNBQVNDLGVBQVQsQ0FBeUJDLEtBQS9DLEdBQXVELFVBQXZELEdBQW9FLEVBQW5GO0FBQ0EsSUFBTUMsYUFBYSxHQUFuQjs7QUFFQSxJQUFNQyxXQUFXO1lBQ0wseUJBREs7Y0FFSCxJQUZHO3NCQUdLLEtBSEw7NEJBSVcsd0JBSlg7V0FLTixNQUxNO2FBTUosQ0FOSTthQU9KLEdBUEk7Y0FRSCxHQVJHO21CQVNFLEVBVEY7VUFVUCxJQVZPO1dBV04sSUFYTTtVQVlQLElBWk87YUFhSixJQWJJO2dCQWNELElBZEM7aUJBZUEsSUFmQTtnQkFnQkQsSUFo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
