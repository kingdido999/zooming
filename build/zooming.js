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

var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : '';

var Zooming$1 = function () {
  function Zooming(opts) {
    classCallCheck(this, Zooming);


    this.opts = opts;

    // elements
    this.body = document.body;
    this.overlay = document.createElement('div');

    this.target;
    this.parent;

    // state
    this._shown = false;
    this._lock = false;
    this.press = false;
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

    this.pressDelay = 200;

    // compatibility stuff
    var trans = this.sniffTransition(this.overlay);
    this.transitionProp = trans.transition;
    this.transformProp = trans.transform;
    this.transformCssProp = this.transformProp.replace(/(.*)Transform/, '-$1-transform');
    this.transEndEvent = trans.transEnd;

    this.config(this.opts);

    this.setStyle(this.overlay, {
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
      if (!opts) return options;

      for (var key in opts) {
        options[key] = opts[key];
      }

      this.setStyle(this.overlay, {
        backgroundColor: options.bgColor,
        transition: 'opacity ' + options.transitionDuration + ' ' + options.transitionTimingFunction
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
      if (options.onBeforeOpen) options.onBeforeOpen(this.target);

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
          transition: _this.transformCssProp + ' ' + options.transitionDuration + ' ' + options.transitionTimingFunction,
          transform: _this.calculateTransform()
        };

        // trigger transition
        _this.originalStyles = _this.setStyle(_this.target, _this.openStyles, true);
      };

      img.src = this.target.getAttribute('src');

      // insert overlay
      this.parent.appendChild(this.overlay);
      setTimeout(function () {
        _this.overlay.style.opacity = options.bgOpacity;
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
        cb = cb || options.onOpen;
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
      if (options.onBeforeClose) options.onBeforeClose(this.target);

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

        cb = typeof cb === 'function' ? cb : options.onClose;
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
      if (options.onBeforeGrab) options.onBeforeGrab(this.target);

      var dx = x - window.innerWidth / 2;
      var dy = y - window.innerHeight / 2;
      var oldTransform = this.target.style.transform;
      var transform = oldTransform.replace(/translate3d\(.*?\)/i, 'translate3d(' + (this.translate.x + dx) + 'px,' + (this.translate.y + dy) + 'px, 0)').replace(/scale\([0-9|\.]*\)/i, 'scale(' + (this.scale + options.scaleExtra) + ')');

      this.setStyle(this.target, {
        cursor: prefix + 'grabbing',
        transition: this.transformCssProp + ' ' + (start ? options.transitionDuration + ' ' + options.transitionTimingFunction : 'ease'),
        transform: transform
      });

      var onEnd = function onEnd() {
        _this3.target.removeEventListener(_this3.transEndEvent, onEnd);
        cb = cb || options.onGrab;
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
      if (options.onBeforeRelease) options.onBeforeRelease(this.target);

      this.setStyle(this.target, this.openStyles);

      var onEnd = function onEnd() {
        _this4.target.removeEventListener(_this4.transEndEvent, onEnd);
        _this4._grab = false;

        cb = typeof cb === 'function' ? cb : options.onRelease;
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
      this.scale = options.scaleBase + Math.min(scaleHorizontally, scaleVertically);

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

      if (Math.abs(deltaY) >= options.scrollThreshold) {
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
        _this6.press = true;
        _this6.grab(e.clientX, e.clientY, true);
      }, this.pressDelay);
    }
  }, {
    key: 'mousemoveHandler',
    value: function mousemoveHandler(e) {
      if (this.press) this.grab(e.clientX, e.clientY);
    }
  }, {
    key: 'mouseupHandler',
    value: function mouseupHandler() {
      clearTimeout(this.pressTimer);
      this.press = false;
      this.release();
    }
  }, {
    key: 'touchstartHandler',
    value: function touchstartHandler(e) {
      var _this7 = this;

      e.preventDefault();

      this.pressTimer = setTimeout(function () {
        _this7.press = true;
        var touch = e.touches[0];
        _this7.grab(touch.clientX, touch.clientY, true);
      }, this.pressDelay);
    }
  }, {
    key: 'touchmoveHandler',
    value: function touchmoveHandler(e) {
      if (this.press) {
        var touch = e.touches[0];
        this.grab(touch.clientX, touch.clientY);
      }
    }
  }, {
    key: 'touchendHandler',
    value: function touchendHandler() {
      clearTimeout(this.pressTimer);
      this.press = false;
      if (this._grab) this.release();else this.close();
    }
  }]);
  return Zooming;
}();

document.addEventListener('DOMContentLoaded', function () {
  new Zooming$1(options).listen(options.defaultZoomable);
});

{
  // Enable LiveReload
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1"></' + 'script>');
}

return Zooming$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9vcHRpb25zLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3Qgb3B0aW9ucyA9IHtcbiAgZGVmYXVsdFpvb21hYmxlOiAnaW1nW2RhdGEtYWN0aW9uPVwiem9vbVwiXScsXG4gIHRyYW5zaXRpb25EdXJhdGlvbjogJy40cycsXG4gIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbjogJ2N1YmljLWJlemllciguNCwwLDAsMSknLFxuICBiZ0NvbG9yOiAnI2ZmZicsXG4gIGJnT3BhY2l0eTogMSxcbiAgc2NhbGVCYXNlOiAxLjAsXG4gIHNjYWxlRXh0cmE6IDAuNSxcbiAgc2Nyb2xsVGhyZXNob2xkOiA0MCxcbiAgb25PcGVuOiBudWxsLFxuICBvbkNsb3NlOiBudWxsLFxuICBvbkdyYWI6IG51bGwsXG4gIG9uUmVsZWFzZTogbnVsbCxcbiAgb25CZWZvcmVPcGVuOiBudWxsLFxuICBvbkJlZm9yZUNsb3NlOiBudWxsLFxuICBvbkJlZm9yZUdyYWI6IG51bGwsXG4gIG9uQmVmb3JlUmVsZWFzZTogbnVsbFxufVxuIiwiaW1wb3J0IHsgb3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucydcblxuLy8gd2Via2l0IHByZWZpeCBoZWxwZXJcbmNvbnN0IHByZWZpeCA9ICdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUgPyAnLXdlYmtpdC0nIDogJydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIGNvbnN0cnVjdG9yKG9wdHMpIHtcblxuICAgIHRoaXMub3B0cyA9IG9wdHNcblxuICAgIC8vIGVsZW1lbnRzXG4gICAgdGhpcy5ib2R5ID0gZG9jdW1lbnQuYm9keVxuICAgIHRoaXMub3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5cbiAgICB0aGlzLnRhcmdldFxuICAgIHRoaXMucGFyZW50XG5cbiAgICAvLyBzdGF0ZVxuICAgIHRoaXMuX3Nob3duID0gZmFsc2VcbiAgICB0aGlzLl9sb2NrICA9IGZhbHNlXG4gICAgdGhpcy5wcmVzcyA9IGZhbHNlXG4gICAgdGhpcy5fZ3JhYiA9IGZhbHNlXG5cbiAgICAvLyBzdHlsZVxuICAgIHRoaXMub3JpZ2luYWxTdHlsZXNcbiAgICB0aGlzLm9wZW5TdHlsZXNcbiAgICB0aGlzLnRyYW5zbGF0ZVxuICAgIHRoaXMuc2NhbGVcblxuICAgIHRoaXMuc3JjVGh1bWJuYWlsXG4gICAgdGhpcy5pbWdSZWN0XG4gICAgdGhpcy5wcmVzc1RpbWVyXG4gICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG5cbiAgICB0aGlzLnByZXNzRGVsYXkgPSAyMDBcblxuICAgIC8vIGNvbXBhdGliaWxpdHkgc3R1ZmZcbiAgICBjb25zdCB0cmFucyA9IHRoaXMuc25pZmZUcmFuc2l0aW9uKHRoaXMub3ZlcmxheSlcbiAgICB0aGlzLnRyYW5zaXRpb25Qcm9wID0gdHJhbnMudHJhbnNpdGlvblxuICAgIHRoaXMudHJhbnNmb3JtUHJvcCA9IHRyYW5zLnRyYW5zZm9ybVxuICAgIHRoaXMudHJhbnNmb3JtQ3NzUHJvcCA9IHRoaXMudHJhbnNmb3JtUHJvcC5yZXBsYWNlKC8oLiopVHJhbnNmb3JtLywgJy0kMS10cmFuc2Zvcm0nKVxuICAgIHRoaXMudHJhbnNFbmRFdmVudCA9IHRyYW5zLnRyYW5zRW5kXG5cbiAgICB0aGlzLmNvbmZpZyh0aGlzLm9wdHMpXG5cbiAgICB0aGlzLnNldFN0eWxlKHRoaXMub3ZlcmxheSwge1xuICAgICAgekluZGV4OiA5OTgsXG4gICAgICBiYWNrZ3JvdW5kOiBvcHRpb25zLmJnQ29sb3IsXG4gICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICByaWdodDogMCxcbiAgICAgIGJvdHRvbTogMCxcbiAgICAgIG9wYWNpdHk6IDAsXG4gICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAnICtcbiAgICAgICAgb3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICBvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxuICAgIH0pXG5cbiAgICB0aGlzLm92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmNsb3NlKVxuXG4gICAgdGhpcy5zY3JvbGxIYW5kbGVyID0gdGhpcy5zY3JvbGxIYW5kbGVyLmJpbmQodGhpcylcbiAgICB0aGlzLmtleWRvd25IYW5kbGVyID0gdGhpcy5rZXlkb3duSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5tb3VzZWRvd25IYW5kbGVyID0gdGhpcy5tb3VzZWRvd25IYW5kbGVyLmJpbmQodGhpcylcbiAgICB0aGlzLm1vdXNlbW92ZUhhbmRsZXIgPSB0aGlzLm1vdXNlbW92ZUhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMubW91c2V1cEhhbmRsZXIgPSB0aGlzLm1vdXNldXBIYW5kbGVyLmJpbmQodGhpcylcbiAgICB0aGlzLnRvdWNoc3RhcnRIYW5kbGVyID0gdGhpcy50b3VjaHN0YXJ0SGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy50b3VjaG1vdmVIYW5kbGVyID0gdGhpcy50b3VjaG1vdmVIYW5kbGVyLmJpbmQodGhpcylcbiAgICB0aGlzLnRvdWNoZW5kSGFuZGxlciA9IHRoaXMudG91Y2hlbmRIYW5kbGVyLmJpbmQodGhpcylcbiAgfVxuXG4gIGNvbmZpZyAob3B0cykge1xuICAgIGlmICghb3B0cykgcmV0dXJuIG9wdGlvbnNcblxuICAgIGZvciAodmFyIGtleSBpbiBvcHRzKSB7XG4gICAgICBvcHRpb25zW2tleV0gPSBvcHRzW2tleV1cbiAgICB9XG5cbiAgICB0aGlzLnNldFN0eWxlKHRoaXMub3ZlcmxheSwge1xuICAgICAgYmFja2dyb3VuZENvbG9yOiBvcHRpb25zLmJnQ29sb3IsXG4gICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAnICtcbiAgICAgICAgb3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICBvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxuICAgIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgb3BlbiAoZWwsIGNiKSB7XG4gICAgaWYgKHRoaXMuX3Nob3duIHx8IHRoaXMuX2xvY2sgfHwgdGhpcy5fZ3JhYikgcmV0dXJuXG5cbiAgICB0aGlzLnRhcmdldCA9IHR5cGVvZiBlbCA9PT0gJ3N0cmluZydcbiAgICAgID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbClcbiAgICAgIDogZWxcblxuICAgIGlmICh0aGlzLnRhcmdldC50YWdOYW1lICE9PSAnSU1HJykgcmV0dXJuXG5cbiAgICAvLyBvbkJlZm9yZU9wZW4gZXZlbnRcbiAgICBpZiAob3B0aW9ucy5vbkJlZm9yZU9wZW4pIG9wdGlvbnMub25CZWZvcmVPcGVuKHRoaXMudGFyZ2V0KVxuXG4gICAgdGhpcy5fc2hvd24gPSB0cnVlXG4gICAgdGhpcy5fbG9jayA9IHRydWVcbiAgICB0aGlzLnBhcmVudCA9IHRoaXMudGFyZ2V0LnBhcmVudE5vZGVcblxuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKVxuXG4gICAgaW1nLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgIHRoaXMuaW1nUmVjdCA9IHRoaXMudGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cbiAgICAgIC8vIHVwZ3JhZGUgc291cmNlIGlmIHBvc3NpYmxlXG4gICAgICBpZiAodGhpcy50YXJnZXQuaGFzQXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsJykpIHtcbiAgICAgICAgdGhpcy5zcmNUaHVtYm5haWwgPSB0aGlzLnRhcmdldC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG5cbiAgICAgICAgdGhpcy5zZXRTdHlsZSh0aGlzLnRhcmdldCwge1xuICAgICAgICAgIHdpZHRoOiB0aGlzLmltZ1JlY3Qud2lkdGggKyAncHgnLFxuICAgICAgICAgIGhlaWdodDogdGhpcy5pbWdSZWN0LmhlaWdodCArICdweCdcbiAgICAgICAgfSlcblxuICAgICAgICB0aGlzLnRhcmdldC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMudGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbCcpKVxuICAgICAgfVxuXG4gICAgICAvLyBmb3JjZSBsYXlvdXQgdXBkYXRlXG4gICAgICB0aGlzLnRhcmdldC5vZmZzZXRXaWR0aFxuXG4gICAgICB0aGlzLm9wZW5TdHlsZXMgPSB7XG4gICAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgICB6SW5kZXg6IDk5OSxcbiAgICAgICAgY3Vyc29yOiBwcmVmaXggKyAnZ3JhYicsXG4gICAgICAgIHRyYW5zaXRpb246IHRoaXMudHJhbnNmb3JtQ3NzUHJvcCArICcgJyArXG4gICAgICAgICAgb3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgK1xuICAgICAgICAgIG9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uLFxuICAgICAgICB0cmFuc2Zvcm06IHRoaXMuY2FsY3VsYXRlVHJhbnNmb3JtKClcbiAgICAgIH1cblxuICAgICAgLy8gdHJpZ2dlciB0cmFuc2l0aW9uXG4gICAgICB0aGlzLm9yaWdpbmFsU3R5bGVzID0gdGhpcy5zZXRTdHlsZSh0aGlzLnRhcmdldCwgdGhpcy5vcGVuU3R5bGVzLCB0cnVlKVxuICAgIH1cblxuICAgIGltZy5zcmMgPSB0aGlzLnRhcmdldC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG5cbiAgICAvLyBpbnNlcnQgb3ZlcmxheVxuICAgIHRoaXMucGFyZW50LmFwcGVuZENoaWxkKHRoaXMub3ZlcmxheSlcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMub3ZlcmxheS5zdHlsZS5vcGFjaXR5ID0gb3B0aW9ucy5iZ09wYWNpdHlcbiAgICB9LCAzMClcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIHRoaXMuc2Nyb2xsSGFuZGxlcilcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5rZXlkb3duSGFuZGxlcilcblxuICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5tb3VzZWRvd25IYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5tb3VzZW1vdmVIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMubW91c2V1cEhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy50b3VjaHN0YXJ0SGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMudG91Y2htb3ZlSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy50b3VjaGVuZEhhbmRsZXIpXG5cbiAgICAgIHRoaXMuX2xvY2sgPSBmYWxzZVxuICAgICAgY2IgPSBjYiB8fCBvcHRpb25zLm9uT3BlblxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgY2xvc2UgKGNiKSB7XG4gICAgaWYgKCF0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrIHx8IHRoaXMuX2dyYWIpIHJldHVyblxuICAgIHRoaXMuX2xvY2sgPSB0cnVlXG5cbiAgICAvLyBvbkJlZm9yZUNsb3NlIGV2ZW50XG4gICAgaWYgKG9wdGlvbnMub25CZWZvcmVDbG9zZSkgb3B0aW9ucy5vbkJlZm9yZUNsb3NlKHRoaXMudGFyZ2V0KVxuXG4gICAgLy8gcmVtb3ZlIG92ZXJsYXlcbiAgICB0aGlzLm92ZXJsYXkuc3R5bGUub3BhY2l0eSA9IDBcblxuICAgIHRoaXMudGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICcnXG5cbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdzY3JvbGwnLCB0aGlzLnNjcm9sbEhhbmRsZXIpXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMua2V5ZG93bkhhbmRsZXIpXG5cbiAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMubW91c2Vkb3duSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMubW91c2Vtb3ZlSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLm1vdXNldXBIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMudG91Y2hzdGFydEhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLnRvdWNobW92ZUhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMudG91Y2hlbmRIYW5kbGVyKVxuXG4gICAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9yaWdpbmFsU3R5bGVzKVxuICAgICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5vdmVybGF5KVxuICAgICAgdGhpcy5fc2hvd24gPSBmYWxzZVxuICAgICAgdGhpcy5fbG9jayA9IGZhbHNlXG4gICAgICB0aGlzLl9ncmFiID0gZmFsc2VcblxuICAgICAgLy8gZG93bmdyYWRlIHNvdXJjZSBpZiBwb3NzaWJsZVxuICAgICAgaWYgKHRoaXMudGFyZ2V0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbCcpKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNUaHVtYm5haWwpXG4gICAgICB9XG5cbiAgICAgIGNiID0gdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nXG4gICAgICAgID8gY2JcbiAgICAgICAgOiBvcHRpb25zLm9uQ2xvc2VcbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGdyYWIgKHgsIHksIHN0YXJ0LCBjYikge1xuICAgIGlmICghdGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jaykgcmV0dXJuXG4gICAgdGhpcy5fZ3JhYiA9IHRydWVcblxuICAgIC8vIG9uQmVmb3JlR3JhYiBldmVudFxuICAgIGlmIChvcHRpb25zLm9uQmVmb3JlR3JhYikgb3B0aW9ucy5vbkJlZm9yZUdyYWIodGhpcy50YXJnZXQpXG5cbiAgICBjb25zdCBkeCA9IHggLSB3aW5kb3cuaW5uZXJXaWR0aCAvIDJcbiAgICBjb25zdCBkeSA9IHkgLSB3aW5kb3cuaW5uZXJIZWlnaHQgLyAyXG4gICAgY29uc3Qgb2xkVHJhbnNmb3JtID0gdGhpcy50YXJnZXQuc3R5bGUudHJhbnNmb3JtXG4gICAgY29uc3QgdHJhbnNmb3JtID0gb2xkVHJhbnNmb3JtXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAvdHJhbnNsYXRlM2RcXCguKj9cXCkvaSxcbiAgICAgICAgICAgICd0cmFuc2xhdGUzZCgnICsgKHRoaXMudHJhbnNsYXRlLnggKyBkeCkgKyAncHgsJyArICh0aGlzLnRyYW5zbGF0ZS55ICsgZHkpICsgJ3B4LCAwKScpXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAvc2NhbGVcXChbMC05fFxcLl0qXFwpL2ksXG4gICAgICAgICAgICAnc2NhbGUoJyArICh0aGlzLnNjYWxlICsgb3B0aW9ucy5zY2FsZUV4dHJhKSArICcpJylcblxuICAgIHRoaXMuc2V0U3R5bGUodGhpcy50YXJnZXQsIHtcbiAgICAgIGN1cnNvcjogcHJlZml4ICsgJ2dyYWJiaW5nJyxcbiAgICAgIHRyYW5zaXRpb246IHRoaXMudHJhbnNmb3JtQ3NzUHJvcCArICcgJyArIChcbiAgICAgICAgc3RhcnRcbiAgICAgICAgPyBvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArIG9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgICAgIDogJ2Vhc2UnXG4gICAgICApLFxuICAgICAgdHJhbnNmb3JtOiB0cmFuc2Zvcm1cbiAgICB9KVxuXG4gICAgY29uc3Qgb25FbmQgPSAoKSA9PiB7XG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICBjYiA9IGNiIHx8IG9wdGlvbnMub25HcmFiXG4gICAgICBpZiAoY2IpIGNiKHRoaXMudGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgfVxuXG4gIHJlbGVhc2UgKGNiKSB7XG4gICAgaWYgKCF0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrIHx8ICF0aGlzLl9ncmFiKSByZXR1cm5cblxuICAgIC8vIG9uQmVmb3JlUmVsZWFzZSBldmVudFxuICAgIGlmIChvcHRpb25zLm9uQmVmb3JlUmVsZWFzZSkgb3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UodGhpcy50YXJnZXQpXG5cbiAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9wZW5TdHlsZXMpXG5cbiAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIHRoaXMuX2dyYWIgPSBmYWxzZVxuXG4gICAgICBjYiA9IHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICA/IGNiXG4gICAgICAgIDogb3B0aW9ucy5vblJlbGVhc2VcbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGxpc3RlbiAoZWwpIHtcbiAgICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbClcbiAgICAgIGxldCBpID0gZWxzLmxlbmd0aFxuXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMubGlzdGVuKGVsc1tpXSlcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICBlbC5zdHlsZS5jdXJzb3IgPSBwcmVmaXggKyAnem9vbS1pbidcblxuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgICBpZiAodGhpcy5fc2hvd24pIHRoaXMuY2xvc2UoKVxuICAgICAgZWxzZSB0aGlzLm9wZW4oZWwpXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvLyBoZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICBzZXRTdHlsZSAoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgICB0aGlzLmNoZWNrVHJhbnMoc3R5bGVzKVxuICAgIGxldCBzID0gZWwuc3R5bGVcbiAgICBsZXQgb3JpZ2luYWwgPSB7fVxuXG4gICAgZm9yICh2YXIga2V5IGluIHN0eWxlcykge1xuICAgICAgaWYgKHJlbWVtYmVyKSBvcmlnaW5hbFtrZXldID0gc1trZXldIHx8ICcnXG4gICAgICBzW2tleV0gPSBzdHlsZXNba2V5XVxuICAgIH1cblxuICAgIHJldHVybiBvcmlnaW5hbFxuICB9XG5cbiAgc25pZmZUcmFuc2l0aW9uIChlbCkge1xuICAgIGxldCByZXQgICA9IHt9XG4gICAgY29uc3QgdHJhbnMgPSBbJ3dlYmtpdFRyYW5zaXRpb24nLCAndHJhbnNpdGlvbicsICdtb3pUcmFuc2l0aW9uJ11cbiAgICBjb25zdCB0Zm9ybSA9IFsnd2Via2l0VHJhbnNmb3JtJywgJ3RyYW5zZm9ybScsICdtb3pUcmFuc2Zvcm0nXVxuICAgIGNvbnN0IGVuZCAgID0ge1xuICAgICAgJ3RyYW5zaXRpb24nICAgICAgIDogJ3RyYW5zaXRpb25lbmQnLFxuICAgICAgJ21velRyYW5zaXRpb24nICAgIDogJ3RyYW5zaXRpb25lbmQnLFxuICAgICAgJ3dlYmtpdFRyYW5zaXRpb24nIDogJ3dlYmtpdFRyYW5zaXRpb25FbmQnXG4gICAgfVxuXG4gICAgdHJhbnMuc29tZSgocHJvcCkgPT4ge1xuICAgICAgaWYgKGVsLnN0eWxlW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0LnRyYW5zaXRpb24gPSBwcm9wXG4gICAgICAgIHJldC50cmFuc0VuZCA9IGVuZFtwcm9wXVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIH0pXG5cbiAgICB0Zm9ybS5zb21lKChwcm9wKSA9PiB7XG4gICAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXQudHJhbnNmb3JtID0gcHJvcFxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIH0pXG5cbiAgICByZXR1cm4gcmV0XG4gIH1cblxuICBjaGVja1RyYW5zIChzdHlsZXMpIHtcbiAgICB2YXIgdmFsdWVcbiAgICBpZiAoc3R5bGVzLnRyYW5zaXRpb24pIHtcbiAgICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zaXRpb25cbiAgICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNpdGlvblxuICAgICAgc3R5bGVzW3RoaXMudHJhbnNpdGlvblByb3BdID0gdmFsdWVcbiAgICB9XG4gICAgaWYgKHN0eWxlcy50cmFuc2Zvcm0pIHtcbiAgICAgIHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgICAgZGVsZXRlIHN0eWxlcy50cmFuc2Zvcm1cbiAgICAgIHN0eWxlc1t0aGlzLnRyYW5zZm9ybVByb3BdID0gdmFsdWVcbiAgICB9XG4gIH1cblxuICBjYWxjdWxhdGVUcmFuc2Zvcm0gKCkge1xuICAgIGNvbnN0IGltZ0hhbGZXaWR0aCA9IHRoaXMuaW1nUmVjdC53aWR0aCAvIDJcbiAgICBjb25zdCBpbWdIYWxmSGVpZ2h0ID0gdGhpcy5pbWdSZWN0LmhlaWdodCAvIDJcblxuICAgIGNvbnN0IGltZ0NlbnRlciA9IHtcbiAgICAgIHg6IHRoaXMuaW1nUmVjdC5sZWZ0ICsgaW1nSGFsZldpZHRoLFxuICAgICAgeTogdGhpcy5pbWdSZWN0LnRvcCArIGltZ0hhbGZIZWlnaHRcbiAgICB9XG5cbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSB7XG4gICAgICB4OiB3aW5kb3cuaW5uZXJXaWR0aCAvIDIsXG4gICAgICB5OiB3aW5kb3cuaW5uZXJIZWlnaHQgLyAyXG4gICAgfVxuXG4gICAgLy8gVGhlIGRpc3RhbmNlIGJldHdlZW4gaW1hZ2UgZWRnZSBhbmQgd2luZG93IGVkZ2VcbiAgICBjb25zdCBkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZSA9IHtcbiAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gaW1nSGFsZldpZHRoLFxuICAgICAgeTogd2luZG93Q2VudGVyLnkgLSBpbWdIYWxmSGVpZ2h0XG4gICAgfVxuXG4gICAgY29uc3Qgc2NhbGVIb3Jpem9udGFsbHkgPSBkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZS54IC8gaW1nSGFsZldpZHRoXG4gICAgY29uc3Qgc2NhbGVWZXJ0aWNhbGx5ID0gZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UueSAvIGltZ0hhbGZIZWlnaHRcblxuICAgIC8vIFRoZSB2ZWN0b3IgdG8gdHJhbnNsYXRlIGltYWdlIHRvIHRoZSB3aW5kb3cgY2VudGVyXG4gICAgdGhpcy50cmFuc2xhdGUgPSB7XG4gICAgICB4OiB3aW5kb3dDZW50ZXIueCAtIGltZ0NlbnRlci54LFxuICAgICAgeTogd2luZG93Q2VudGVyLnkgLSBpbWdDZW50ZXIueVxuICAgIH1cblxuICAgIC8vIFRoZSBhZGRpdGlvbmFsIHNjYWxlIGlzIGJhc2VkIG9uIHRoZSBzbWFsbGVyIHZhbHVlIG9mXG4gICAgLy8gc2NhbGluZyBob3Jpem9udGFsbHkgYW5kIHNjYWxpbmcgdmVydGljYWxseVxuICAgIHRoaXMuc2NhbGUgPSBvcHRpb25zLnNjYWxlQmFzZSArIE1hdGgubWluKHNjYWxlSG9yaXpvbnRhbGx5LCBzY2FsZVZlcnRpY2FsbHkpXG5cbiAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlM2QoJyArIHRoaXMudHJhbnNsYXRlLnggKyAncHgsJyArIHRoaXMudHJhbnNsYXRlLnkgKyAncHgsIDApICcgK1xuICAgICAgICAnc2NhbGUoJyArIHRoaXMuc2NhbGUgKyAnKSdcblxuICAgIHJldHVybiB0cmFuc2Zvcm1cbiAgfVxuXG4gIC8vIGxpc3RlbmVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIHNjcm9sbEhhbmRsZXIgKCkge1xuICAgIHZhciBzY3JvbGxUb3AgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHxcbiAgICAgIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgfHwgdGhpcy5ib2R5LnBhcmVudE5vZGUgfHwgdGhpcy5ib2R5KS5zY3JvbGxUb3BcblxuICAgIGlmICh0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9PT0gbnVsbCkgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBzY3JvbGxUb3BcblxuICAgIHZhciBkZWx0YVkgPSB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiAtIHNjcm9sbFRvcFxuXG4gICAgaWYgKE1hdGguYWJzKGRlbHRhWSkgPj0gb3B0aW9ucy5zY3JvbGxUaHJlc2hvbGQpIHtcbiAgICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfVxuICB9XG5cbiAga2V5ZG93bkhhbmRsZXIgKGUpIHtcbiAgICB2YXIgY29kZSA9IGUua2V5IHx8IGUuY29kZVxuICAgIGlmIChjb2RlID09PSAnRXNjYXBlJyB8fCBlLmtleUNvZGUgPT09IDI3KSB0aGlzLmNsb3NlKClcbiAgfVxuXG4gIG1vdXNlZG93bkhhbmRsZXIgKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5wcmVzcyA9IHRydWVcbiAgICAgIHRoaXMuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSwgdHJ1ZSlcbiAgICB9LCB0aGlzLnByZXNzRGVsYXkpXG4gIH1cblxuICBtb3VzZW1vdmVIYW5kbGVyIChlKSB7XG4gICAgaWYgKHRoaXMucHJlc3MpIHRoaXMuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSlcbiAgfVxuXG4gIG1vdXNldXBIYW5kbGVyICgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuICAgIHRoaXMucHJlc3MgPSBmYWxzZVxuICAgIHRoaXMucmVsZWFzZSgpXG4gIH1cblxuICB0b3VjaHN0YXJ0SGFuZGxlciAoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnByZXNzID0gdHJ1ZVxuICAgICAgdmFyIHRvdWNoID0gZS50b3VjaGVzWzBdXG4gICAgICB0aGlzLmdyYWIodG91Y2guY2xpZW50WCwgdG91Y2guY2xpZW50WSwgdHJ1ZSlcbiAgICB9LCB0aGlzLnByZXNzRGVsYXkpXG4gIH1cblxuICB0b3VjaG1vdmVIYW5kbGVyIChlKSB7XG4gICAgaWYgKHRoaXMucHJlc3MpIHtcbiAgICAgIHZhciB0b3VjaCA9IGUudG91Y2hlc1swXVxuICAgICAgdGhpcy5ncmFiKHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFkpXG4gICAgfVxuICB9XG5cbiAgdG91Y2hlbmRIYW5kbGVyICgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuICAgIHRoaXMucHJlc3MgPSBmYWxzZVxuICAgIGlmICh0aGlzLl9ncmFiKSB0aGlzLnJlbGVhc2UoKVxuICAgIGVsc2UgdGhpcy5jbG9zZSgpXG4gIH1cbn1cbiIsImltcG9ydCB7IG9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnXG5pbXBvcnQgWm9vbWluZyBmcm9tICcuL3pvb21pbmcnXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiB7XG4gIG5ldyBab29taW5nKG9wdGlvbnMpLmxpc3RlbihvcHRpb25zLmRlZmF1bHRab29tYWJsZSlcbn0pXG5cbmlmIChFTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAvLyBFbmFibGUgTGl2ZVJlbG9hZFxuICBkb2N1bWVudC53cml0ZShcbiAgICAnPHNjcmlwdCBzcmM9XCJodHRwOi8vJyArIChsb2NhdGlvbi5ob3N0IHx8ICdsb2NhbGhvc3QnKS5zcGxpdCgnOicpWzBdICtcbiAgICAnOjM1NzI5L2xpdmVyZWxvYWQuanM/c25pcHZlcj0xXCI+PC8nICsgJ3NjcmlwdD4nXG4gIClcbn1cblxuZXhwb3J0IGRlZmF1bHQgWm9vbWluZ1xuIl0sIm5hbWVzIjpbIm9wdGlvbnMiLCJwcmVmaXgiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsInN0eWxlIiwiWm9vbWluZyIsIm9wdHMiLCJib2R5Iiwib3ZlcmxheSIsImNyZWF0ZUVsZW1lbnQiLCJ0YXJnZXQiLCJwYXJlbnQiLCJfc2hvd24iLCJfbG9jayIsInByZXNzIiwiX2dyYWIiLCJvcmlnaW5hbFN0eWxlcyIsIm9wZW5TdHlsZXMiLCJ0cmFuc2xhdGUiLCJzY2FsZSIsInNyY1RodW1ibmFpbCIsImltZ1JlY3QiLCJwcmVzc1RpbWVyIiwibGFzdFNjcm9sbFBvc2l0aW9uIiwicHJlc3NEZWxheSIsInRyYW5zIiwic25pZmZUcmFuc2l0aW9uIiwidHJhbnNpdGlvblByb3AiLCJ0cmFuc2l0aW9uIiwidHJhbnNmb3JtUHJvcCIsInRyYW5zZm9ybSIsInRyYW5zZm9ybUNzc1Byb3AiLCJyZXBsYWNlIiwidHJhbnNFbmRFdmVudCIsInRyYW5zRW5kIiwiY29uZmlnIiwic2V0U3R5bGUiLCJiZ0NvbG9yIiwidHJhbnNpdGlvbkR1cmF0aW9uIiwidHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uIiwiYWRkRXZlbnRMaXN0ZW5lciIsImNsb3NlIiwic2Nyb2xsSGFuZGxlciIsImJpbmQiLCJrZXlkb3duSGFuZGxlciIsIm1vdXNlZG93bkhhbmRsZXIiLCJtb3VzZW1vdmVIYW5kbGVyIiwibW91c2V1cEhhbmRsZXIiLCJ0b3VjaHN0YXJ0SGFuZGxlciIsInRvdWNobW92ZUhhbmRsZXIiLCJ0b3VjaGVuZEhhbmRsZXIiLCJrZXkiLCJlbCIsImNiIiwicXVlcnlTZWxlY3RvciIsInRhZ05hbWUiLCJvbkJlZm9yZU9wZW4iLCJwYXJlbnROb2RlIiwiaW1nIiwiSW1hZ2UiLCJvbmxvYWQiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJoYXNBdHRyaWJ1dGUiLCJnZXRBdHRyaWJ1dGUiLCJ3aWR0aCIsImhlaWdodCIsInNldEF0dHJpYnV0ZSIsIm9mZnNldFdpZHRoIiwiY2FsY3VsYXRlVHJhbnNmb3JtIiwic3JjIiwiYXBwZW5kQ2hpbGQiLCJvcGFjaXR5IiwiYmdPcGFjaXR5Iiwib25FbmQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwib25PcGVuIiwib25CZWZvcmVDbG9zZSIsInJlbW92ZUNoaWxkIiwib25DbG9zZSIsIngiLCJ5Iiwic3RhcnQiLCJvbkJlZm9yZUdyYWIiLCJkeCIsIndpbmRvdyIsImlubmVyV2lkdGgiLCJkeSIsImlubmVySGVpZ2h0Iiwib2xkVHJhbnNmb3JtIiwic2NhbGVFeHRyYSIsIm9uR3JhYiIsIm9uQmVmb3JlUmVsZWFzZSIsIm9uUmVsZWFzZSIsImVscyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwibGVuZ3RoIiwibGlzdGVuIiwiY3Vyc29yIiwiZSIsInByZXZlbnREZWZhdWx0Iiwib3BlbiIsInN0eWxlcyIsInJlbWVtYmVyIiwiY2hlY2tUcmFucyIsInMiLCJvcmlnaW5hbCIsInJldCIsInRmb3JtIiwiZW5kIiwic29tZSIsInByb3AiLCJ1bmRlZmluZWQiLCJ2YWx1ZSIsImltZ0hhbGZXaWR0aCIsImltZ0hhbGZIZWlnaHQiLCJpbWdDZW50ZXIiLCJsZWZ0IiwidG9wIiwid2luZG93Q2VudGVyIiwiZGlzdEZyb21JbWFnZUVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsInNjYWxlQmFzZSIsIk1hdGgiLCJtaW4iLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImRlbHRhWSIsImFicyIsInNjcm9sbFRocmVzaG9sZCIsImNvZGUiLCJrZXlDb2RlIiwic2V0VGltZW91dCIsImdyYWIiLCJjbGllbnRYIiwiY2xpZW50WSIsInJlbGVhc2UiLCJ0b3VjaCIsInRvdWNoZXMiLCJkZWZhdWx0Wm9vbWFibGUiLCJFTlYiLCJ3cml0ZSIsImxvY2F0aW9uIiwiaG9zdCIsInNwbGl0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBTyxJQUFNQSxVQUFVO21CQUNKLHlCQURJ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
