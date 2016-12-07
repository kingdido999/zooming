(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Zooming = factory());
}(this, (function () { 'use strict';

// webkit prefix helper
var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : '';
var pressDelay = 200;

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
    var trans = this.sniffTransition(this.overlay);
    this.transitionProp = trans.transition;
    this.transformProp = trans.transform;
    this.transformCssProp = this.transformProp.replace(/(.*)Transform/, '-$1-transform');
    this.transEndEvent = trans.transEnd;

    this.options = {};
    Object.assign(this.options, options);

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

    // helpers -------------------------------------------------------------------

  }, {
    key: 'setStyle',
    value: function setStyle(el, styles, remember) {
      this.checkTrans(styles);
      var s = el.style;
      var original = {};

      for (var key in styles) {
        if (remember) original[key] = s[key] || '';
        s[key] = styles[key];
      }

      return original;
    }
  }, {
    key: 'sniffTransition',
    value: function sniffTransition(el) {
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
    }
  }, {
    key: 'checkTrans',
    value: function checkTrans(styles) {
      var value;
      if (styles.transition) {
        value = styles.transition;
        delete styles.transition;
        styles[this.transitionProp] = value;
      }
      if (styles.transform) {
        value = styles.transform;
        delete styles.transform;
        styles[this.transformProp] = value;
      }
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
  new Zooming$1().listen(options.defaultZoomable);
});

{
  // Enable LiveReload
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1"></' + 'script>');
}

return Zooming$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9oZWxwZXJzLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyB3ZWJraXQgcHJlZml4IGhlbHBlclxuY29uc3QgcHJlZml4ID0gJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSA/ICctd2Via2l0LScgOiAnJ1xuY29uc3QgcHJlc3NEZWxheSA9IDIwMFxuXG5jb25zdCBvcHRpb25zID0ge1xuICBkZWZhdWx0Wm9vbWFibGU6ICdpbWdbZGF0YS1hY3Rpb249XCJ6b29tXCJdJyxcbiAgdHJhbnNpdGlvbkR1cmF0aW9uOiAnLjRzJyxcbiAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uOiAnY3ViaWMtYmV6aWVyKC40LDAsMCwxKScsXG4gIGJnQ29sb3I6ICcjZmZmJyxcbiAgYmdPcGFjaXR5OiAxLFxuICBzY2FsZUJhc2U6IDEuMCxcbiAgc2NhbGVFeHRyYTogMC41LFxuICBzY3JvbGxUaHJlc2hvbGQ6IDQwLFxuICBvbk9wZW46IG51bGwsXG4gIG9uQ2xvc2U6IG51bGwsXG4gIG9uR3JhYjogbnVsbCxcbiAgb25SZWxlYXNlOiBudWxsLFxuICBvbkJlZm9yZU9wZW46IG51bGwsXG4gIG9uQmVmb3JlQ2xvc2U6IG51bGwsXG4gIG9uQmVmb3JlR3JhYjogbnVsbCxcbiAgb25CZWZvcmVSZWxlYXNlOiBudWxsXG59XG5cbmV4cG9ydCB7IHByZWZpeCwgcHJlc3NEZWxheSwgb3B0aW9ucyB9XG4iLCJpbXBvcnQgeyBwcmVmaXgsIHByZXNzRGVsYXksIG9wdGlvbnMgfSBmcm9tICcuL2hlbHBlcnMnXG5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIGNvbnN0cnVjdG9yKG9wdHMpIHtcbiAgICAvLyBlbGVtZW50c1xuICAgIHRoaXMuYm9keSA9IGRvY3VtZW50LmJvZHlcbiAgICB0aGlzLm92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuXG4gICAgdGhpcy50YXJnZXRcbiAgICB0aGlzLnBhcmVudFxuXG4gICAgLy8gc3RhdGVcbiAgICB0aGlzLl9zaG93biA9IGZhbHNlXG4gICAgdGhpcy5fbG9jayAgPSBmYWxzZVxuICAgIHRoaXMuX3ByZXNzID0gZmFsc2VcbiAgICB0aGlzLl9ncmFiID0gZmFsc2VcblxuICAgIC8vIHN0eWxlXG4gICAgdGhpcy5vcmlnaW5hbFN0eWxlc1xuICAgIHRoaXMub3BlblN0eWxlc1xuICAgIHRoaXMudHJhbnNsYXRlXG4gICAgdGhpcy5zY2FsZVxuXG4gICAgdGhpcy5zcmNUaHVtYm5haWxcbiAgICB0aGlzLmltZ1JlY3RcbiAgICB0aGlzLnByZXNzVGltZXJcbiAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcblxuICAgIC8vIGNvbXBhdGliaWxpdHkgc3R1ZmZcbiAgICBjb25zdCB0cmFucyA9IHRoaXMuc25pZmZUcmFuc2l0aW9uKHRoaXMub3ZlcmxheSlcbiAgICB0aGlzLnRyYW5zaXRpb25Qcm9wID0gdHJhbnMudHJhbnNpdGlvblxuICAgIHRoaXMudHJhbnNmb3JtUHJvcCA9IHRyYW5zLnRyYW5zZm9ybVxuICAgIHRoaXMudHJhbnNmb3JtQ3NzUHJvcCA9IHRoaXMudHJhbnNmb3JtUHJvcC5yZXBsYWNlKC8oLiopVHJhbnNmb3JtLywgJy0kMS10cmFuc2Zvcm0nKVxuICAgIHRoaXMudHJhbnNFbmRFdmVudCA9IHRyYW5zLnRyYW5zRW5kXG5cbiAgICB0aGlzLm9wdGlvbnMgPSB7fVxuICAgIE9iamVjdC5hc3NpZ24odGhpcy5vcHRpb25zLCBvcHRpb25zKVxuXG4gICAgdGhpcy5jb25maWcob3B0cylcblxuICAgIHRoaXMuc2V0U3R5bGUodGhpcy5vdmVybGF5LCB7XG4gICAgICB6SW5kZXg6IDk5OCxcbiAgICAgIGJhY2tncm91bmQ6IHRoaXMub3B0aW9ucy5iZ0NvbG9yLFxuICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICB0b3A6IDAsXG4gICAgICBsZWZ0OiAwLFxuICAgICAgcmlnaHQ6IDAsXG4gICAgICBib3R0b206IDAsXG4gICAgICBvcGFjaXR5OiAwLFxuICAgICAgdHJhbnNpdGlvbjogJ29wYWNpdHkgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgfSlcblxuICAgIHRoaXMub3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuY2xvc2UpXG5cbiAgICB0aGlzLnNjcm9sbEhhbmRsZXIgPSB0aGlzLnNjcm9sbEhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMua2V5ZG93bkhhbmRsZXIgPSB0aGlzLmtleWRvd25IYW5kbGVyLmJpbmQodGhpcylcbiAgICB0aGlzLm1vdXNlZG93bkhhbmRsZXIgPSB0aGlzLm1vdXNlZG93bkhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMubW91c2Vtb3ZlSGFuZGxlciA9IHRoaXMubW91c2Vtb3ZlSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5tb3VzZXVwSGFuZGxlciA9IHRoaXMubW91c2V1cEhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMudG91Y2hzdGFydEhhbmRsZXIgPSB0aGlzLnRvdWNoc3RhcnRIYW5kbGVyLmJpbmQodGhpcylcbiAgICB0aGlzLnRvdWNobW92ZUhhbmRsZXIgPSB0aGlzLnRvdWNobW92ZUhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMudG91Y2hlbmRIYW5kbGVyID0gdGhpcy50b3VjaGVuZEhhbmRsZXIuYmluZCh0aGlzKVxuICB9XG5cbiAgY29uZmlnIChvcHRzKSB7XG4gICAgaWYgKCFvcHRzKSByZXR1cm4gdGhpc1xuXG4gICAgZm9yIChsZXQga2V5IGluIG9wdHMpIHtcbiAgICAgIHRoaXMub3B0aW9uc1trZXldID0gb3B0c1trZXldXG4gICAgfVxuXG4gICAgdGhpcy5zZXRTdHlsZSh0aGlzLm92ZXJsYXksIHtcbiAgICAgIGJhY2tncm91bmRDb2xvcjogdGhpcy5vcHRpb25zLmJnQ29sb3IsXG4gICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAnICtcbiAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb25cbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIG9wZW4gKGVsLCBjYikge1xuICAgIGlmICh0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrIHx8IHRoaXMuX2dyYWIpIHJldHVyblxuXG4gICAgdGhpcy50YXJnZXQgPSB0eXBlb2YgZWwgPT09ICdzdHJpbmcnXG4gICAgICA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpXG4gICAgICA6IGVsXG5cbiAgICBpZiAodGhpcy50YXJnZXQudGFnTmFtZSAhPT0gJ0lNRycpIHJldHVyblxuXG4gICAgLy8gb25CZWZvcmVPcGVuIGV2ZW50XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4pIHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4odGhpcy50YXJnZXQpXG5cbiAgICB0aGlzLl9zaG93biA9IHRydWVcbiAgICB0aGlzLl9sb2NrID0gdHJ1ZVxuICAgIHRoaXMucGFyZW50ID0gdGhpcy50YXJnZXQucGFyZW50Tm9kZVxuXG4gICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpXG5cbiAgICBpbWcub25sb2FkID0gKCkgPT4ge1xuICAgICAgdGhpcy5pbWdSZWN0ID0gdGhpcy50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcblxuICAgICAgLy8gdXBncmFkZSBzb3VyY2UgaWYgcG9zc2libGVcbiAgICAgIGlmICh0aGlzLnRhcmdldC5oYXNBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwnKSkge1xuICAgICAgICB0aGlzLnNyY1RodW1ibmFpbCA9IHRoaXMudGFyZ2V0LmdldEF0dHJpYnV0ZSgnc3JjJylcblxuICAgICAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB7XG4gICAgICAgICAgd2lkdGg6IHRoaXMuaW1nUmVjdC53aWR0aCArICdweCcsXG4gICAgICAgICAgaGVpZ2h0OiB0aGlzLmltZ1JlY3QuaGVpZ2h0ICsgJ3B4J1xuICAgICAgICB9KVxuXG4gICAgICAgIHRoaXMudGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsJykpXG4gICAgICB9XG5cbiAgICAgIC8vIGZvcmNlIGxheW91dCB1cGRhdGVcbiAgICAgIHRoaXMudGFyZ2V0Lm9mZnNldFdpZHRoXG5cbiAgICAgIHRoaXMub3BlblN0eWxlcyA9IHtcbiAgICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgICAgIHpJbmRleDogOTk5LFxuICAgICAgICBjdXJzb3I6IHByZWZpeCArICdncmFiJyxcbiAgICAgICAgdHJhbnNpdGlvbjogdGhpcy50cmFuc2Zvcm1Dc3NQcm9wICsgJyAnICtcbiAgICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9uICsgJyAnICtcbiAgICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uLFxuICAgICAgICB0cmFuc2Zvcm06IHRoaXMuY2FsY3VsYXRlVHJhbnNmb3JtKClcbiAgICAgIH1cblxuICAgICAgLy8gdHJpZ2dlciB0cmFuc2l0aW9uXG4gICAgICB0aGlzLm9yaWdpbmFsU3R5bGVzID0gdGhpcy5zZXRTdHlsZSh0aGlzLnRhcmdldCwgdGhpcy5vcGVuU3R5bGVzLCB0cnVlKVxuICAgIH1cblxuICAgIGltZy5zcmMgPSB0aGlzLnRhcmdldC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG5cbiAgICAvLyBpbnNlcnQgb3ZlcmxheVxuICAgIHRoaXMucGFyZW50LmFwcGVuZENoaWxkKHRoaXMub3ZlcmxheSlcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMub3ZlcmxheS5zdHlsZS5vcGFjaXR5ID0gdGhpcy5vcHRpb25zLmJnT3BhY2l0eVxuICAgIH0sIDMwKVxuXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgdGhpcy5zY3JvbGxIYW5kbGVyKVxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLmtleWRvd25IYW5kbGVyKVxuXG4gICAgY29uc3Qgb25FbmQgPSAoKSA9PiB7XG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLm1vdXNlZG93bkhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLm1vdXNlbW92ZUhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5tb3VzZXVwSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0aGlzLnRvdWNoc3RhcnRIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy50b3VjaG1vdmVIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0aGlzLnRvdWNoZW5kSGFuZGxlcilcblxuICAgICAgdGhpcy5fbG9jayA9IGZhbHNlXG4gICAgICBjYiA9IGNiIHx8IHRoaXMub3B0aW9ucy5vbk9wZW5cbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGNsb3NlIChjYikge1xuICAgIGlmICghdGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jayB8fCB0aGlzLl9ncmFiKSByZXR1cm5cbiAgICB0aGlzLl9sb2NrID0gdHJ1ZVxuXG4gICAgLy8gb25CZWZvcmVDbG9zZSBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVDbG9zZSkgdGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UodGhpcy50YXJnZXQpXG5cbiAgICAvLyByZW1vdmUgb3ZlcmxheVxuICAgIHRoaXMub3ZlcmxheS5zdHlsZS5vcGFjaXR5ID0gMFxuXG4gICAgdGhpcy50YXJnZXQuc3R5bGUudHJhbnNmb3JtID0gJydcblxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIHRoaXMuc2Nyb2xsSGFuZGxlcilcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5rZXlkb3duSGFuZGxlcilcblxuICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5tb3VzZWRvd25IYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5tb3VzZW1vdmVIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMubW91c2V1cEhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy50b3VjaHN0YXJ0SGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMudG91Y2htb3ZlSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy50b3VjaGVuZEhhbmRsZXIpXG5cbiAgICAgIHRoaXMuc2V0U3R5bGUodGhpcy50YXJnZXQsIHRoaXMub3JpZ2luYWxTdHlsZXMpXG4gICAgICB0aGlzLnBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLm92ZXJsYXkpXG4gICAgICB0aGlzLl9zaG93biA9IGZhbHNlXG4gICAgICB0aGlzLl9sb2NrID0gZmFsc2VcbiAgICAgIHRoaXMuX2dyYWIgPSBmYWxzZVxuXG4gICAgICAvLyBkb3duZ3JhZGUgc291cmNlIGlmIHBvc3NpYmxlXG4gICAgICBpZiAodGhpcy50YXJnZXQuaGFzQXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsJykpIHtcbiAgICAgICAgdGhpcy50YXJnZXQuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnNyY1RodW1ibmFpbClcbiAgICAgIH1cblxuICAgICAgY2IgPSB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbidcbiAgICAgICAgPyBjYlxuICAgICAgICA6IHRoaXMub3B0aW9ucy5vbkNsb3NlXG4gICAgICBpZiAoY2IpIGNiKHRoaXMudGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBncmFiICh4LCB5LCBzdGFydCwgY2IpIHtcbiAgICBpZiAoIXRoaXMuX3Nob3duIHx8IHRoaXMuX2xvY2spIHJldHVyblxuICAgIHRoaXMuX2dyYWIgPSB0cnVlXG5cbiAgICAvLyBvbkJlZm9yZUdyYWIgZXZlbnRcbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYikgdGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYih0aGlzLnRhcmdldClcblxuICAgIGNvbnN0IGR4ID0geCAtIHdpbmRvdy5pbm5lcldpZHRoIC8gMlxuICAgIGNvbnN0IGR5ID0geSAtIHdpbmRvdy5pbm5lckhlaWdodCAvIDJcbiAgICBjb25zdCBvbGRUcmFuc2Zvcm0gPSB0aGlzLnRhcmdldC5zdHlsZS50cmFuc2Zvcm1cbiAgICBjb25zdCB0cmFuc2Zvcm0gPSBvbGRUcmFuc2Zvcm1cbiAgICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAgIC90cmFuc2xhdGUzZFxcKC4qP1xcKS9pLFxuICAgICAgICAgICAgJ3RyYW5zbGF0ZTNkKCcgKyAodGhpcy50cmFuc2xhdGUueCArIGR4KSArICdweCwnICsgKHRoaXMudHJhbnNsYXRlLnkgKyBkeSkgKyAncHgsIDApJylcbiAgICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAgIC9zY2FsZVxcKFswLTl8XFwuXSpcXCkvaSxcbiAgICAgICAgICAgICdzY2FsZSgnICsgKHRoaXMuc2NhbGUgKyB0aGlzLm9wdGlvbnMuc2NhbGVFeHRyYSkgKyAnKScpXG5cbiAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB7XG4gICAgICBjdXJzb3I6IHByZWZpeCArICdncmFiYmluZycsXG4gICAgICB0cmFuc2l0aW9uOiB0aGlzLnRyYW5zZm9ybUNzc1Byb3AgKyAnICcgKyAoXG4gICAgICAgIHN0YXJ0XG4gICAgICAgID8gdGhpcy5vcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb25cbiAgICAgICAgOiAnZWFzZSdcbiAgICAgICksXG4gICAgICB0cmFuc2Zvcm06IHRyYW5zZm9ybVxuICAgIH0pXG5cbiAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIGNiID0gY2IgfHwgdGhpcy5vcHRpb25zLm9uR3JhYlxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG4gIH1cblxuICByZWxlYXNlIChjYikge1xuICAgIGlmICghdGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jayB8fCAhdGhpcy5fZ3JhYikgcmV0dXJuXG5cbiAgICAvLyBvbkJlZm9yZVJlbGVhc2UgZXZlbnRcbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSkgdGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSh0aGlzLnRhcmdldClcblxuICAgIHRoaXMuc2V0U3R5bGUodGhpcy50YXJnZXQsIHRoaXMub3BlblN0eWxlcylcblxuICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICAgICAgdGhpcy5fZ3JhYiA9IGZhbHNlXG5cbiAgICAgIGNiID0gdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nXG4gICAgICAgID8gY2JcbiAgICAgICAgOiB0aGlzLm9wdGlvbnMub25SZWxlYXNlXG4gICAgICBpZiAoY2IpIGNiKHRoaXMudGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBsaXN0ZW4gKGVsKSB7XG4gICAgaWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IGVscyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoZWwpXG4gICAgICBsZXQgaSA9IGVscy5sZW5ndGhcblxuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLmxpc3RlbihlbHNbaV0pXG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgZWwuc3R5bGUuY3Vyc29yID0gcHJlZml4ICsgJ3pvb20taW4nXG5cbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgICAgaWYgKHRoaXMuX3Nob3duKSB0aGlzLmNsb3NlKClcbiAgICAgIGVsc2UgdGhpcy5vcGVuKGVsKVxuICAgIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLy8gaGVscGVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgc2V0U3R5bGUgKGVsLCBzdHlsZXMsIHJlbWVtYmVyKSB7XG4gICAgdGhpcy5jaGVja1RyYW5zKHN0eWxlcylcbiAgICBsZXQgcyA9IGVsLnN0eWxlXG4gICAgbGV0IG9yaWdpbmFsID0ge31cblxuICAgIGZvciAodmFyIGtleSBpbiBzdHlsZXMpIHtcbiAgICAgIGlmIChyZW1lbWJlcikgb3JpZ2luYWxba2V5XSA9IHNba2V5XSB8fCAnJ1xuICAgICAgc1trZXldID0gc3R5bGVzW2tleV1cbiAgICB9XG5cbiAgICByZXR1cm4gb3JpZ2luYWxcbiAgfVxuXG4gIHNuaWZmVHJhbnNpdGlvbiAoZWwpIHtcbiAgICBsZXQgcmV0ICAgPSB7fVxuICAgIGNvbnN0IHRyYW5zID0gWyd3ZWJraXRUcmFuc2l0aW9uJywgJ3RyYW5zaXRpb24nLCAnbW96VHJhbnNpdGlvbiddXG4gICAgY29uc3QgdGZvcm0gPSBbJ3dlYmtpdFRyYW5zZm9ybScsICd0cmFuc2Zvcm0nLCAnbW96VHJhbnNmb3JtJ11cbiAgICBjb25zdCBlbmQgICA9IHtcbiAgICAgICd0cmFuc2l0aW9uJyAgICAgICA6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAgICdtb3pUcmFuc2l0aW9uJyAgICA6ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAgICd3ZWJraXRUcmFuc2l0aW9uJyA6ICd3ZWJraXRUcmFuc2l0aW9uRW5kJ1xuICAgIH1cblxuICAgIHRyYW5zLnNvbWUoKHByb3ApID0+IHtcbiAgICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldC50cmFuc2l0aW9uID0gcHJvcFxuICAgICAgICByZXQudHJhbnNFbmQgPSBlbmRbcHJvcF1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgdGZvcm0uc29tZSgocHJvcCkgPT4ge1xuICAgICAgaWYgKGVsLnN0eWxlW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0LnRyYW5zZm9ybSA9IHByb3BcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIHJldFxuICB9XG5cbiAgY2hlY2tUcmFucyAoc3R5bGVzKSB7XG4gICAgdmFyIHZhbHVlXG4gICAgaWYgKHN0eWxlcy50cmFuc2l0aW9uKSB7XG4gICAgICB2YWx1ZSA9IHN0eWxlcy50cmFuc2l0aW9uXG4gICAgICBkZWxldGUgc3R5bGVzLnRyYW5zaXRpb25cbiAgICAgIHN0eWxlc1t0aGlzLnRyYW5zaXRpb25Qcm9wXSA9IHZhbHVlXG4gICAgfVxuICAgIGlmIChzdHlsZXMudHJhbnNmb3JtKSB7XG4gICAgICB2YWx1ZSA9IHN0eWxlcy50cmFuc2Zvcm1cbiAgICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNmb3JtXG4gICAgICBzdHlsZXNbdGhpcy50cmFuc2Zvcm1Qcm9wXSA9IHZhbHVlXG4gICAgfVxuICB9XG5cbiAgY2FsY3VsYXRlVHJhbnNmb3JtICgpIHtcbiAgICBjb25zdCBpbWdIYWxmV2lkdGggPSB0aGlzLmltZ1JlY3Qud2lkdGggLyAyXG4gICAgY29uc3QgaW1nSGFsZkhlaWdodCA9IHRoaXMuaW1nUmVjdC5oZWlnaHQgLyAyXG5cbiAgICBjb25zdCBpbWdDZW50ZXIgPSB7XG4gICAgICB4OiB0aGlzLmltZ1JlY3QubGVmdCArIGltZ0hhbGZXaWR0aCxcbiAgICAgIHk6IHRoaXMuaW1nUmVjdC50b3AgKyBpbWdIYWxmSGVpZ2h0XG4gICAgfVxuXG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0ge1xuICAgICAgeDogd2luZG93LmlubmVyV2lkdGggLyAyLFxuICAgICAgeTogd2luZG93LmlubmVySGVpZ2h0IC8gMlxuICAgIH1cblxuICAgIC8vIFRoZSBkaXN0YW5jZSBiZXR3ZWVuIGltYWdlIGVkZ2UgYW5kIHdpbmRvdyBlZGdlXG4gICAgY29uc3QgZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UgPSB7XG4gICAgICB4OiB3aW5kb3dDZW50ZXIueCAtIGltZ0hhbGZXaWR0aCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gaW1nSGFsZkhlaWdodFxuICAgIH1cblxuICAgIGNvbnN0IHNjYWxlSG9yaXpvbnRhbGx5ID0gZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UueCAvIGltZ0hhbGZXaWR0aFxuICAgIGNvbnN0IHNjYWxlVmVydGljYWxseSA9IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlLnkgLyBpbWdIYWxmSGVpZ2h0XG5cbiAgICAvLyBUaGUgdmVjdG9yIHRvIHRyYW5zbGF0ZSBpbWFnZSB0byB0aGUgd2luZG93IGNlbnRlclxuICAgIHRoaXMudHJhbnNsYXRlID0ge1xuICAgICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdDZW50ZXIueCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gaW1nQ2VudGVyLnlcbiAgICB9XG5cbiAgICAvLyBUaGUgYWRkaXRpb25hbCBzY2FsZSBpcyBiYXNlZCBvbiB0aGUgc21hbGxlciB2YWx1ZSBvZlxuICAgIC8vIHNjYWxpbmcgaG9yaXpvbnRhbGx5IGFuZCBzY2FsaW5nIHZlcnRpY2FsbHlcbiAgICB0aGlzLnNjYWxlID0gdGhpcy5vcHRpb25zLnNjYWxlQmFzZSArIE1hdGgubWluKHNjYWxlSG9yaXpvbnRhbGx5LCBzY2FsZVZlcnRpY2FsbHkpXG5cbiAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlM2QoJyArIHRoaXMudHJhbnNsYXRlLnggKyAncHgsJyArIHRoaXMudHJhbnNsYXRlLnkgKyAncHgsIDApICcgK1xuICAgICAgICAnc2NhbGUoJyArIHRoaXMuc2NhbGUgKyAnKSdcblxuICAgIHJldHVybiB0cmFuc2Zvcm1cbiAgfVxuXG4gIC8vIGxpc3RlbmVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIHNjcm9sbEhhbmRsZXIgKCkge1xuICAgIHZhciBzY3JvbGxUb3AgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHxcbiAgICAgIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgfHwgdGhpcy5ib2R5LnBhcmVudE5vZGUgfHwgdGhpcy5ib2R5KS5zY3JvbGxUb3BcblxuICAgIGlmICh0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9PT0gbnVsbCkgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBzY3JvbGxUb3BcblxuICAgIHZhciBkZWx0YVkgPSB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiAtIHNjcm9sbFRvcFxuXG4gICAgaWYgKE1hdGguYWJzKGRlbHRhWSkgPj0gdGhpcy5vcHRpb25zLnNjcm9sbFRocmVzaG9sZCkge1xuICAgICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9XG4gIH1cblxuICBrZXlkb3duSGFuZGxlciAoZSkge1xuICAgIHZhciBjb2RlID0gZS5rZXkgfHwgZS5jb2RlXG4gICAgaWYgKGNvZGUgPT09ICdFc2NhcGUnIHx8IGUua2V5Q29kZSA9PT0gMjcpIHRoaXMuY2xvc2UoKVxuICB9XG5cbiAgbW91c2Vkb3duSGFuZGxlciAoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLl9wcmVzcyA9IHRydWVcbiAgICAgIHRoaXMuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSwgdHJ1ZSlcbiAgICB9LCBwcmVzc0RlbGF5KVxuICB9XG5cbiAgbW91c2Vtb3ZlSGFuZGxlciAoZSkge1xuICAgIGlmICh0aGlzLl9wcmVzcykgdGhpcy5ncmFiKGUuY2xpZW50WCwgZS5jbGllbnRZKVxuICB9XG5cbiAgbW91c2V1cEhhbmRsZXIgKCkge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnByZXNzVGltZXIpXG4gICAgdGhpcy5fcHJlc3MgPSBmYWxzZVxuICAgIHRoaXMucmVsZWFzZSgpXG4gIH1cblxuICB0b3VjaHN0YXJ0SGFuZGxlciAoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLl9wcmVzcyA9IHRydWVcbiAgICAgIHZhciB0b3VjaCA9IGUudG91Y2hlc1swXVxuICAgICAgdGhpcy5ncmFiKHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFksIHRydWUpXG4gICAgfSwgcHJlc3NEZWxheSlcbiAgfVxuXG4gIHRvdWNobW92ZUhhbmRsZXIgKGUpIHtcbiAgICBpZiAodGhpcy5fcHJlc3MpIHtcbiAgICAgIHZhciB0b3VjaCA9IGUudG91Y2hlc1swXVxuICAgICAgdGhpcy5ncmFiKHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFkpXG4gICAgfVxuICB9XG5cbiAgdG91Y2hlbmRIYW5kbGVyICgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuICAgIHRoaXMuX3ByZXNzID0gZmFsc2VcbiAgICBpZiAodGhpcy5fZ3JhYikgdGhpcy5yZWxlYXNlKClcbiAgICBlbHNlIHRoaXMuY2xvc2UoKVxuICB9XG59XG4iLCJpbXBvcnQgeyBvcHRpb25zIH0gZnJvbSAnLi9oZWxwZXJzJ1xuaW1wb3J0IFpvb21pbmcgZnJvbSAnLi96b29taW5nJ1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xuXG4gIC8vIGxpc3RlbiB0byB6b29tYWJsZSBlbGVtZW50cyBieSBkZWZhdWx0XG4gIG5ldyBab29taW5nKCkubGlzdGVuKG9wdGlvbnMuZGVmYXVsdFpvb21hYmxlKVxufSlcblxuaWYgKEVOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIC8vIEVuYWJsZSBMaXZlUmVsb2FkXG4gIGRvY3VtZW50LndyaXRlKFxuICAgICc8c2NyaXB0IHNyYz1cImh0dHA6Ly8nICsgKGxvY2F0aW9uLmhvc3QgfHwgJ2xvY2FsaG9zdCcpLnNwbGl0KCc6JylbMF0gK1xuICAgICc6MzU3MjkvbGl2ZXJlbG9hZC5qcz9zbmlwdmVyPTFcIj48LycgKyAnc2NyaXB0PidcbiAgKVxufVxuXG5leHBvcnQgZGVmYXVsdCBab29taW5nXG4iXSwibmFtZXMiOlsicHJlZml4IiwiZG9jdW1lbnQiLCJkb2N1bWVudEVsZW1lbnQiLCJzdHlsZSIsInByZXNzRGVsYXkiLCJvcHRpb25zIiwiWm9vbWluZyIsIm9wdHMiLCJib2R5Iiwib3ZlcmxheSIsImNyZWF0ZUVsZW1lbnQiLCJ0YXJnZXQiLCJwYXJlbnQiLCJfc2hvd24iLCJfbG9jayIsIl9wcmVzcyIsIl9ncmFiIiwib3JpZ2luYWxTdHlsZXMiLCJvcGVuU3R5bGVzIiwidHJhbnNsYXRlIiwic2NhbGUiLCJzcmNUaHVtYm5haWwiLCJpbWdSZWN0IiwicHJlc3NUaW1lciIsImxhc3RTY3JvbGxQb3NpdGlvbiIsInRyYW5zIiwic25pZmZUcmFuc2l0aW9uIiwidHJhbnNpdGlvblByb3AiLCJ0cmFuc2l0aW9uIiwidHJhbnNmb3JtUHJvcCIsInRyYW5zZm9ybSIsInRyYW5zZm9ybUNzc1Byb3AiLCJyZXBsYWNlIiwidHJhbnNFbmRFdmVudCIsInRyYW5zRW5kIiwiYXNzaWduIiwiY29uZmlnIiwic2V0U3R5bGUiLCJiZ0NvbG9yIiwidHJhbnNpdGlvbkR1cmF0aW9uIiwidHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uIiwiYWRkRXZlbnRMaXN0ZW5lciIsImNsb3NlIiwic2Nyb2xsSGFuZGxlciIsImJpbmQiLCJrZXlkb3duSGFuZGxlciIsIm1vdXNlZG93bkhhbmRsZXIiLCJtb3VzZW1vdmVIYW5kbGVyIiwibW91c2V1cEhhbmRsZXIiLCJ0b3VjaHN0YXJ0SGFuZGxlciIsInRvdWNobW92ZUhhbmRsZXIiLCJ0b3VjaGVuZEhhbmRsZXIiLCJrZXkiLCJlbCIsImNiIiwicXVlcnlTZWxlY3RvciIsInRhZ05hbWUiLCJvbkJlZm9yZU9wZW4iLCJwYXJlbnROb2RlIiwiaW1nIiwiSW1hZ2UiLCJvbmxvYWQiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJoYXNBdHRyaWJ1dGUiLCJnZXRBdHRyaWJ1dGUiLCJ3aWR0aCIsImhlaWdodCIsInNldEF0dHJpYnV0ZSIsIm9mZnNldFdpZHRoIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwic3JjIiwiYXBwZW5kQ2hpbGQiLCJvcGFjaXR5IiwiYmdPcGFjaXR5Iiwib25FbmQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwib25PcGVuIiwib25CZWZvcmVDbG9zZSIsInJlbW92ZUNoaWxkIiwib25DbG9zZSIsIngiLCJ5Iiwic3RhcnQiLCJvbkJlZm9yZUdyYWIiLCJkeCIsIndpbmRvdyIsImlubmVyV2lkdGgiLCJkeSIsImlubmVySGVpZ2h0Iiwib2xkVHJhbnNmb3JtIiwic2NhbGVFeHRyYSIsIm9uR3JhYiIsIm9uQmVmb3JlUmVsZWFzZSIsIm9uUmVsZWFzZSIsImVscyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwibGVuZ3RoIiwibGlzdGVuIiwiY3Vyc29yIiwiZSIsInByZXZlbnREZWZhdWx0Iiwib3BlbiIsInN0eWxlcyIsInJlbWVtYmVyIiwiY2hlY2tUcmFucyIsInMiLCJvcmlnaW5hbCIsInJldCIsInRmb3JtIiwiZW5kIiwic29tZSIsInByb3AiLCJ1bmRlZmluZWQiLCJ2YWx1ZSIsImltZ0hhbGZXaWR0aCIsImltZ0hhbGZIZWlnaHQiLCJpbWdDZW50ZXIiLCJsZWZ0IiwidG9wIiwid2luZG93Q2VudGVyIiwiZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsInNjYWxlQmFzZSIsIk1hdGgiLCJtaW4iLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImRlbHRhWSIsImFicyIsInNjcm9sbFRocmVzaG9sZCIsImNvZGUiLCJrZXlDb2RlIiwic2V0VGltZW91dCIsImdyYWIiLCJjbGllbnRYIiwiY2xpZW50WSIsInJlbGVhc2UiLCJ0b3VjaCIsInRvdWNoZXMiLCJkZWZhdWx0Wm9vbWFibGUiLCJFTlYiLCJ3cml0ZSIsImxvY2F0aW9uIiwiaG9zdCIsInNwbGl0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTtBQUNBLElBQU1BLFNBQVMsc0JBQXNCQyxTQUFTQyxlQUFULENBQXlCQyxLQUEvQyxHQUF1RCxVQUF2RCxHQUFvRSxFQUFuRjtBQUNBLElBQU1DLGFBQWEsR0FBbkI7O0FBRUEsSUFBTUMsVUFBVTttQkFDRyx5QkFESDtzQkFFTSxLQUZOOzRCQUdZLHdCQUhaO1dBSUwsTUFKSzthQUtILENBTEc7YUFNSCxHQU5HO2NBT0YsR0FQRTttQkFRRyxFQVJIO1VBU04sSUFUTTtXQVVMLElBVks7VUFXTixJQVhNO2FBWUgsSUFaRztnQkFhQSxJQWJBO2lCQWNDLElBZEQ7Z0JBZUEsSUFmQTttQkFnQkc7Q0FoQm5CLENBbUJBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQ3BCcUJDO21CQUNQQyxJQUFaLEVBQWtCOzs7O1NBRVhDLElBQUwsR0FBWVAsU0FBU08sSUFBckI7U0FDS0MsT0FBTCxHQUFlUixTQUFTUyxhQUFULENBQXVCLEtBQXZCLENBQWY7O1NBRUtDLE1BQUw7U0FDS0MsTUFBTDs7O1NBR0tDLE1BQUwsR0FBYyxLQUFkO1NBQ0tDLEtBQUwsR0FBYyxLQUFkO1NBQ0tDLE1BQUwsR0FBYyxLQUFkO1NBQ0tDLEtBQUwsR0FBYSxLQUFiOzs7U0FHS0MsY0FBTDtTQUNLQyxVQUFMO1NBQ0tDLFNBQUw7U0FDS0MsS0FBTDs7U0FFS0MsWUFBTDtT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
