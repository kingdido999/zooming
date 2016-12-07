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

// webkit prefix helper
var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : '';

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

    this.options = {};
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
      Object.assign(this.options, options);

      if (!opts) return;

      for (var key in opts) {
        this.options[key] = opts[key];
      }

      this.setStyle(this.overlay, {
        backgroundColor: this.options.bgColor,
        transition: 'opacity ' + this.options.transitionDuration + ' ' + this.options.transitionTimingFunction
      });
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
  new Zooming$1().listen(options.defaultZoomable);
});

{
  // Enable LiveReload
  document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1"></' + 'script>');
}

return Zooming$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL3NyYy9vcHRpb25zLmpzIiwiLi4vc3JjL3pvb21pbmcuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3Qgb3B0aW9ucyA9IHtcbiAgZGVmYXVsdFpvb21hYmxlOiAnaW1nW2RhdGEtYWN0aW9uPVwiem9vbVwiXScsXG4gIHRyYW5zaXRpb25EdXJhdGlvbjogJy40cycsXG4gIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbjogJ2N1YmljLWJlemllciguNCwwLDAsMSknLFxuICBiZ0NvbG9yOiAnI2ZmZicsXG4gIGJnT3BhY2l0eTogMSxcbiAgc2NhbGVCYXNlOiAxLjAsXG4gIHNjYWxlRXh0cmE6IDAuNSxcbiAgc2Nyb2xsVGhyZXNob2xkOiA0MCxcbiAgb25PcGVuOiBudWxsLFxuICBvbkNsb3NlOiBudWxsLFxuICBvbkdyYWI6IG51bGwsXG4gIG9uUmVsZWFzZTogbnVsbCxcbiAgb25CZWZvcmVPcGVuOiBudWxsLFxuICBvbkJlZm9yZUNsb3NlOiBudWxsLFxuICBvbkJlZm9yZUdyYWI6IG51bGwsXG4gIG9uQmVmb3JlUmVsZWFzZTogbnVsbFxufVxuIiwiaW1wb3J0IHsgb3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucydcblxuLy8gd2Via2l0IHByZWZpeCBoZWxwZXJcbmNvbnN0IHByZWZpeCA9ICdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUgPyAnLXdlYmtpdC0nIDogJydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIGNvbnN0cnVjdG9yKG9wdHMpIHtcbiAgICAvLyBlbGVtZW50c1xuICAgIHRoaXMuYm9keSA9IGRvY3VtZW50LmJvZHlcbiAgICB0aGlzLm92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuXG4gICAgdGhpcy50YXJnZXRcbiAgICB0aGlzLnBhcmVudFxuXG4gICAgLy8gc3RhdGVcbiAgICB0aGlzLl9zaG93biA9IGZhbHNlXG4gICAgdGhpcy5fbG9jayAgPSBmYWxzZVxuICAgIHRoaXMucHJlc3MgPSBmYWxzZVxuICAgIHRoaXMuX2dyYWIgPSBmYWxzZVxuXG4gICAgLy8gc3R5bGVcbiAgICB0aGlzLm9yaWdpbmFsU3R5bGVzXG4gICAgdGhpcy5vcGVuU3R5bGVzXG4gICAgdGhpcy50cmFuc2xhdGVcbiAgICB0aGlzLnNjYWxlXG5cbiAgICB0aGlzLnNyY1RodW1ibmFpbFxuICAgIHRoaXMuaW1nUmVjdFxuICAgIHRoaXMucHJlc3NUaW1lclxuICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuXG4gICAgdGhpcy5wcmVzc0RlbGF5ID0gMjAwXG5cbiAgICAvLyBjb21wYXRpYmlsaXR5IHN0dWZmXG4gICAgY29uc3QgdHJhbnMgPSB0aGlzLnNuaWZmVHJhbnNpdGlvbih0aGlzLm92ZXJsYXkpXG4gICAgdGhpcy50cmFuc2l0aW9uUHJvcCA9IHRyYW5zLnRyYW5zaXRpb25cbiAgICB0aGlzLnRyYW5zZm9ybVByb3AgPSB0cmFucy50cmFuc2Zvcm1cbiAgICB0aGlzLnRyYW5zZm9ybUNzc1Byb3AgPSB0aGlzLnRyYW5zZm9ybVByb3AucmVwbGFjZSgvKC4qKVRyYW5zZm9ybS8sICctJDEtdHJhbnNmb3JtJylcbiAgICB0aGlzLnRyYW5zRW5kRXZlbnQgPSB0cmFucy50cmFuc0VuZFxuXG4gICAgdGhpcy5vcHRpb25zID0ge31cbiAgICB0aGlzLmNvbmZpZyhvcHRzKVxuXG4gICAgdGhpcy5zZXRTdHlsZSh0aGlzLm92ZXJsYXksIHtcbiAgICAgIHpJbmRleDogOTk4LFxuICAgICAgYmFja2dyb3VuZDogdGhpcy5vcHRpb25zLmJnQ29sb3IsXG4gICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICByaWdodDogMCxcbiAgICAgIGJvdHRvbTogMCxcbiAgICAgIG9wYWNpdHk6IDAsXG4gICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAnICtcbiAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArXG4gICAgICAgIHRoaXMub3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb25cbiAgICB9KVxuXG4gICAgdGhpcy5vdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5jbG9zZSlcblxuICAgIHRoaXMuc2Nyb2xsSGFuZGxlciA9IHRoaXMuc2Nyb2xsSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5rZXlkb3duSGFuZGxlciA9IHRoaXMua2V5ZG93bkhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMubW91c2Vkb3duSGFuZGxlciA9IHRoaXMubW91c2Vkb3duSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy5tb3VzZW1vdmVIYW5kbGVyID0gdGhpcy5tb3VzZW1vdmVIYW5kbGVyLmJpbmQodGhpcylcbiAgICB0aGlzLm1vdXNldXBIYW5kbGVyID0gdGhpcy5tb3VzZXVwSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy50b3VjaHN0YXJ0SGFuZGxlciA9IHRoaXMudG91Y2hzdGFydEhhbmRsZXIuYmluZCh0aGlzKVxuICAgIHRoaXMudG91Y2htb3ZlSGFuZGxlciA9IHRoaXMudG91Y2htb3ZlSGFuZGxlci5iaW5kKHRoaXMpXG4gICAgdGhpcy50b3VjaGVuZEhhbmRsZXIgPSB0aGlzLnRvdWNoZW5kSGFuZGxlci5iaW5kKHRoaXMpXG4gIH1cblxuICBjb25maWcgKG9wdHMpIHtcbiAgICBPYmplY3QuYXNzaWduKHRoaXMub3B0aW9ucywgb3B0aW9ucylcblxuICAgIGlmICghb3B0cykgcmV0dXJuXG5cbiAgICBmb3IgKGxldCBrZXkgaW4gb3B0cykge1xuICAgICAgdGhpcy5vcHRpb25zW2tleV0gPSBvcHRzW2tleV1cbiAgICB9XG5cbiAgICB0aGlzLnNldFN0eWxlKHRoaXMub3ZlcmxheSwge1xuICAgICAgYmFja2dyb3VuZENvbG9yOiB0aGlzLm9wdGlvbnMuYmdDb2xvcixcbiAgICAgIHRyYW5zaXRpb246ICdvcGFjaXR5ICcgK1xuICAgICAgICB0aGlzLm9wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9uICsgJyAnICtcbiAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxuICAgIH0pXG4gIH1cblxuICBvcGVuIChlbCwgY2IpIHtcbiAgICBpZiAodGhpcy5fc2hvd24gfHwgdGhpcy5fbG9jayB8fCB0aGlzLl9ncmFiKSByZXR1cm5cblxuICAgIHRoaXMudGFyZ2V0ID0gdHlwZW9mIGVsID09PSAnc3RyaW5nJ1xuICAgICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKVxuICAgICAgOiBlbFxuXG4gICAgaWYgKHRoaXMudGFyZ2V0LnRhZ05hbWUgIT09ICdJTUcnKSByZXR1cm5cblxuICAgIC8vIG9uQmVmb3JlT3BlbiBldmVudFxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKSB0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKHRoaXMudGFyZ2V0KVxuXG4gICAgdGhpcy5fc2hvd24gPSB0cnVlXG4gICAgdGhpcy5fbG9jayA9IHRydWVcbiAgICB0aGlzLnBhcmVudCA9IHRoaXMudGFyZ2V0LnBhcmVudE5vZGVcblxuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKVxuXG4gICAgaW1nLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgIHRoaXMuaW1nUmVjdCA9IHRoaXMudGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cbiAgICAgIC8vIHVwZ3JhZGUgc291cmNlIGlmIHBvc3NpYmxlXG4gICAgICBpZiAodGhpcy50YXJnZXQuaGFzQXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsJykpIHtcbiAgICAgICAgdGhpcy5zcmNUaHVtYm5haWwgPSB0aGlzLnRhcmdldC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG5cbiAgICAgICAgdGhpcy5zZXRTdHlsZSh0aGlzLnRhcmdldCwge1xuICAgICAgICAgIHdpZHRoOiB0aGlzLmltZ1JlY3Qud2lkdGggKyAncHgnLFxuICAgICAgICAgIGhlaWdodDogdGhpcy5pbWdSZWN0LmhlaWdodCArICdweCdcbiAgICAgICAgfSlcblxuICAgICAgICB0aGlzLnRhcmdldC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMudGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbCcpKVxuICAgICAgfVxuXG4gICAgICAvLyBmb3JjZSBsYXlvdXQgdXBkYXRlXG4gICAgICB0aGlzLnRhcmdldC5vZmZzZXRXaWR0aFxuXG4gICAgICB0aGlzLm9wZW5TdHlsZXMgPSB7XG4gICAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgICB6SW5kZXg6IDk5OSxcbiAgICAgICAgY3Vyc29yOiBwcmVmaXggKyAnZ3JhYicsXG4gICAgICAgIHRyYW5zaXRpb246IHRoaXMudHJhbnNmb3JtQ3NzUHJvcCArICcgJyArXG4gICAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbiArICcgJyArXG4gICAgICAgICAgdGhpcy5vcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbixcbiAgICAgICAgdHJhbnNmb3JtOiB0aGlzLmNhbGN1bGF0ZVRyYW5zZm9ybSgpXG4gICAgICB9XG5cbiAgICAgIC8vIHRyaWdnZXIgdHJhbnNpdGlvblxuICAgICAgdGhpcy5vcmlnaW5hbFN0eWxlcyA9IHRoaXMuc2V0U3R5bGUodGhpcy50YXJnZXQsIHRoaXMub3BlblN0eWxlcywgdHJ1ZSlcbiAgICB9XG5cbiAgICBpbWcuc3JjID0gdGhpcy50YXJnZXQuZ2V0QXR0cmlidXRlKCdzcmMnKVxuXG4gICAgLy8gaW5zZXJ0IG92ZXJsYXlcbiAgICB0aGlzLnBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLm92ZXJsYXkpXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLm92ZXJsYXkuc3R5bGUub3BhY2l0eSA9IHRoaXMub3B0aW9ucy5iZ09wYWNpdHlcbiAgICB9LCAzMClcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIHRoaXMuc2Nyb2xsSGFuZGxlcilcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5rZXlkb3duSGFuZGxlcilcblxuICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5tb3VzZWRvd25IYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5tb3VzZW1vdmVIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMubW91c2V1cEhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy50b3VjaHN0YXJ0SGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMudG91Y2htb3ZlSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy50b3VjaGVuZEhhbmRsZXIpXG5cbiAgICAgIHRoaXMuX2xvY2sgPSBmYWxzZVxuICAgICAgY2IgPSBjYiB8fCB0aGlzLm9wdGlvbnMub25PcGVuXG4gICAgICBpZiAoY2IpIGNiKHRoaXMudGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMudGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBjbG9zZSAoY2IpIHtcbiAgICBpZiAoIXRoaXMuX3Nob3duIHx8IHRoaXMuX2xvY2sgfHwgdGhpcy5fZ3JhYikgcmV0dXJuXG4gICAgdGhpcy5fbG9jayA9IHRydWVcblxuICAgIC8vIG9uQmVmb3JlQ2xvc2UgZXZlbnRcbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UpIHRoaXMub3B0aW9ucy5vbkJlZm9yZUNsb3NlKHRoaXMudGFyZ2V0KVxuXG4gICAgLy8gcmVtb3ZlIG92ZXJsYXlcbiAgICB0aGlzLm92ZXJsYXkuc3R5bGUub3BhY2l0eSA9IDBcblxuICAgIHRoaXMudGFyZ2V0LnN0eWxlLnRyYW5zZm9ybSA9ICcnXG5cbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdzY3JvbGwnLCB0aGlzLnNjcm9sbEhhbmRsZXIpXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMua2V5ZG93bkhhbmRsZXIpXG5cbiAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMubW91c2Vkb3duSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMubW91c2Vtb3ZlSGFuZGxlcilcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLm1vdXNldXBIYW5kbGVyKVxuICAgICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMudG91Y2hzdGFydEhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLnRvdWNobW92ZUhhbmRsZXIpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMudG91Y2hlbmRIYW5kbGVyKVxuXG4gICAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9yaWdpbmFsU3R5bGVzKVxuICAgICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5vdmVybGF5KVxuICAgICAgdGhpcy5fc2hvd24gPSBmYWxzZVxuICAgICAgdGhpcy5fbG9jayA9IGZhbHNlXG4gICAgICB0aGlzLl9ncmFiID0gZmFsc2VcblxuICAgICAgLy8gZG93bmdyYWRlIHNvdXJjZSBpZiBwb3NzaWJsZVxuICAgICAgaWYgKHRoaXMudGFyZ2V0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1vcmlnaW5hbCcpKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNUaHVtYm5haWwpXG4gICAgICB9XG5cbiAgICAgIGNiID0gdHlwZW9mIGNiID09PSAnZnVuY3Rpb24nXG4gICAgICAgID8gY2JcbiAgICAgICAgOiB0aGlzLm9wdGlvbnMub25DbG9zZVxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgZ3JhYiAoeCwgeSwgc3RhcnQsIGNiKSB7XG4gICAgaWYgKCF0aGlzLl9zaG93biB8fCB0aGlzLl9sb2NrKSByZXR1cm5cbiAgICB0aGlzLl9ncmFiID0gdHJ1ZVxuXG4gICAgLy8gb25CZWZvcmVHcmFiIGV2ZW50XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIpIHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIodGhpcy50YXJnZXQpXG5cbiAgICBjb25zdCBkeCA9IHggLSB3aW5kb3cuaW5uZXJXaWR0aCAvIDJcbiAgICBjb25zdCBkeSA9IHkgLSB3aW5kb3cuaW5uZXJIZWlnaHQgLyAyXG4gICAgY29uc3Qgb2xkVHJhbnNmb3JtID0gdGhpcy50YXJnZXQuc3R5bGUudHJhbnNmb3JtXG4gICAgY29uc3QgdHJhbnNmb3JtID0gb2xkVHJhbnNmb3JtXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAvdHJhbnNsYXRlM2RcXCguKj9cXCkvaSxcbiAgICAgICAgICAgICd0cmFuc2xhdGUzZCgnICsgKHRoaXMudHJhbnNsYXRlLnggKyBkeCkgKyAncHgsJyArICh0aGlzLnRyYW5zbGF0ZS55ICsgZHkpICsgJ3B4LCAwKScpXG4gICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAvc2NhbGVcXChbMC05fFxcLl0qXFwpL2ksXG4gICAgICAgICAgICAnc2NhbGUoJyArICh0aGlzLnNjYWxlICsgdGhpcy5vcHRpb25zLnNjYWxlRXh0cmEpICsgJyknKVxuXG4gICAgdGhpcy5zZXRTdHlsZSh0aGlzLnRhcmdldCwge1xuICAgICAgY3Vyc29yOiBwcmVmaXggKyAnZ3JhYmJpbmcnLFxuICAgICAgdHJhbnNpdGlvbjogdGhpcy50cmFuc2Zvcm1Dc3NQcm9wICsgJyAnICsgKFxuICAgICAgICBzdGFydFxuICAgICAgICA/IHRoaXMub3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb24gKyAnICcgKyB0aGlzLm9wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgICAgIDogJ2Vhc2UnXG4gICAgICApLFxuICAgICAgdHJhbnNmb3JtOiB0cmFuc2Zvcm1cbiAgICB9KVxuXG4gICAgY29uc3Qgb25FbmQgPSAoKSA9PiB7XG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG4gICAgICBjYiA9IGNiIHx8IHRoaXMub3B0aW9ucy5vbkdyYWJcbiAgICAgIGlmIChjYikgY2IodGhpcy50YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy50YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnRyYW5zRW5kRXZlbnQsIG9uRW5kKVxuICB9XG5cbiAgcmVsZWFzZSAoY2IpIHtcbiAgICBpZiAoIXRoaXMuX3Nob3duIHx8IHRoaXMuX2xvY2sgfHwgIXRoaXMuX2dyYWIpIHJldHVyblxuXG4gICAgLy8gb25CZWZvcmVSZWxlYXNlIGV2ZW50XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UpIHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UodGhpcy50YXJnZXQpXG5cbiAgICB0aGlzLnNldFN0eWxlKHRoaXMudGFyZ2V0LCB0aGlzLm9wZW5TdHlsZXMpXG5cbiAgICBjb25zdCBvbkVuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMudGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy50cmFuc0VuZEV2ZW50LCBvbkVuZClcbiAgICAgIHRoaXMuX2dyYWIgPSBmYWxzZVxuXG4gICAgICBjYiA9IHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICA/IGNiXG4gICAgICAgIDogdGhpcy5vcHRpb25zLm9uUmVsZWFzZVxuICAgICAgaWYgKGNiKSBjYih0aGlzLnRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHRoaXMudHJhbnNFbmRFdmVudCwgb25FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgbGlzdGVuIChlbCkge1xuICAgIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGVsKVxuICAgICAgbGV0IGkgPSBlbHMubGVuZ3RoXG5cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5saXN0ZW4oZWxzW2ldKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGVsLnN0eWxlLmN1cnNvciA9IHByZWZpeCArICd6b29tLWluJ1xuXG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIGlmICh0aGlzLl9zaG93bikgdGhpcy5jbG9zZSgpXG4gICAgICBlbHNlIHRoaXMub3BlbihlbClcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8vIGhlbHBlcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIHNldFN0eWxlIChlbCwgc3R5bGVzLCByZW1lbWJlcikge1xuICAgIHRoaXMuY2hlY2tUcmFucyhzdHlsZXMpXG4gICAgbGV0IHMgPSBlbC5zdHlsZVxuICAgIGxldCBvcmlnaW5hbCA9IHt9XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gc3R5bGVzKSB7XG4gICAgICBpZiAocmVtZW1iZXIpIG9yaWdpbmFsW2tleV0gPSBzW2tleV0gfHwgJydcbiAgICAgIHNba2V5XSA9IHN0eWxlc1trZXldXG4gICAgfVxuXG4gICAgcmV0dXJuIG9yaWdpbmFsXG4gIH1cblxuICBzbmlmZlRyYW5zaXRpb24gKGVsKSB7XG4gICAgbGV0IHJldCAgID0ge31cbiAgICBjb25zdCB0cmFucyA9IFsnd2Via2l0VHJhbnNpdGlvbicsICd0cmFuc2l0aW9uJywgJ21velRyYW5zaXRpb24nXVxuICAgIGNvbnN0IHRmb3JtID0gWyd3ZWJraXRUcmFuc2Zvcm0nLCAndHJhbnNmb3JtJywgJ21velRyYW5zZm9ybSddXG4gICAgY29uc3QgZW5kICAgPSB7XG4gICAgICAndHJhbnNpdGlvbicgICAgICAgOiAndHJhbnNpdGlvbmVuZCcsXG4gICAgICAnbW96VHJhbnNpdGlvbicgICAgOiAndHJhbnNpdGlvbmVuZCcsXG4gICAgICAnd2Via2l0VHJhbnNpdGlvbicgOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgICB9XG5cbiAgICB0cmFucy5zb21lKChwcm9wKSA9PiB7XG4gICAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXQudHJhbnNpdGlvbiA9IHByb3BcbiAgICAgICAgcmV0LnRyYW5zRW5kID0gZW5kW3Byb3BdXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfSlcblxuICAgIHRmb3JtLnNvbWUoKHByb3ApID0+IHtcbiAgICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldC50cmFuc2Zvcm0gPSBwcm9wXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiByZXRcbiAgfVxuXG4gIGNoZWNrVHJhbnMgKHN0eWxlcykge1xuICAgIHZhciB2YWx1ZVxuICAgIGlmIChzdHlsZXMudHJhbnNpdGlvbikge1xuICAgICAgdmFsdWUgPSBzdHlsZXMudHJhbnNpdGlvblxuICAgICAgZGVsZXRlIHN0eWxlcy50cmFuc2l0aW9uXG4gICAgICBzdHlsZXNbdGhpcy50cmFuc2l0aW9uUHJvcF0gPSB2YWx1ZVxuICAgIH1cbiAgICBpZiAoc3R5bGVzLnRyYW5zZm9ybSkge1xuICAgICAgdmFsdWUgPSBzdHlsZXMudHJhbnNmb3JtXG4gICAgICBkZWxldGUgc3R5bGVzLnRyYW5zZm9ybVxuICAgICAgc3R5bGVzW3RoaXMudHJhbnNmb3JtUHJvcF0gPSB2YWx1ZVxuICAgIH1cbiAgfVxuXG4gIGNhbGN1bGF0ZVRyYW5zZm9ybSAoKSB7XG4gICAgY29uc3QgaW1nSGFsZldpZHRoID0gdGhpcy5pbWdSZWN0LndpZHRoIC8gMlxuICAgIGNvbnN0IGltZ0hhbGZIZWlnaHQgPSB0aGlzLmltZ1JlY3QuaGVpZ2h0IC8gMlxuXG4gICAgY29uc3QgaW1nQ2VudGVyID0ge1xuICAgICAgeDogdGhpcy5pbWdSZWN0LmxlZnQgKyBpbWdIYWxmV2lkdGgsXG4gICAgICB5OiB0aGlzLmltZ1JlY3QudG9wICsgaW1nSGFsZkhlaWdodFxuICAgIH1cblxuICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IHtcbiAgICAgIHg6IHdpbmRvdy5pbm5lcldpZHRoIC8gMixcbiAgICAgIHk6IHdpbmRvdy5pbm5lckhlaWdodCAvIDJcbiAgICB9XG5cbiAgICAvLyBUaGUgZGlzdGFuY2UgYmV0d2VlbiBpbWFnZSBlZGdlIGFuZCB3aW5kb3cgZWRnZVxuICAgIGNvbnN0IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlID0ge1xuICAgICAgeDogd2luZG93Q2VudGVyLnggLSBpbWdIYWxmV2lkdGgsXG4gICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIGltZ0hhbGZIZWlnaHRcbiAgICB9XG5cbiAgICBjb25zdCBzY2FsZUhvcml6b250YWxseSA9IGRpc3RGcm9tSW1hZ2VFZGdlVG9XaW5kb3dFZGdlLnggLyBpbWdIYWxmV2lkdGhcbiAgICBjb25zdCBzY2FsZVZlcnRpY2FsbHkgPSBkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZS55IC8gaW1nSGFsZkhlaWdodFxuXG4gICAgLy8gVGhlIHZlY3RvciB0byB0cmFuc2xhdGUgaW1hZ2UgdG8gdGhlIHdpbmRvdyBjZW50ZXJcbiAgICB0aGlzLnRyYW5zbGF0ZSA9IHtcbiAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gaW1nQ2VudGVyLngsXG4gICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIGltZ0NlbnRlci55XG4gICAgfVxuXG4gICAgLy8gVGhlIGFkZGl0aW9uYWwgc2NhbGUgaXMgYmFzZWQgb24gdGhlIHNtYWxsZXIgdmFsdWUgb2ZcbiAgICAvLyBzY2FsaW5nIGhvcml6b250YWxseSBhbmQgc2NhbGluZyB2ZXJ0aWNhbGx5XG4gICAgdGhpcy5zY2FsZSA9IHRoaXMub3B0aW9ucy5zY2FsZUJhc2UgKyBNYXRoLm1pbihzY2FsZUhvcml6b250YWxseSwgc2NhbGVWZXJ0aWNhbGx5KVxuXG4gICAgY29uc3QgdHJhbnNmb3JtID1cbiAgICAgICAgJ3RyYW5zbGF0ZTNkKCcgKyB0aGlzLnRyYW5zbGF0ZS54ICsgJ3B4LCcgKyB0aGlzLnRyYW5zbGF0ZS55ICsgJ3B4LCAwKSAnICtcbiAgICAgICAgJ3NjYWxlKCcgKyB0aGlzLnNjYWxlICsgJyknXG5cbiAgICByZXR1cm4gdHJhbnNmb3JtXG4gIH1cblxuICAvLyBsaXN0ZW5lcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICBzY3JvbGxIYW5kbGVyICgpIHtcbiAgICB2YXIgc2Nyb2xsVG9wID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8XG4gICAgICAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50IHx8IHRoaXMuYm9keS5wYXJlbnROb2RlIHx8IHRoaXMuYm9keSkuc2Nyb2xsVG9wXG5cbiAgICBpZiAodGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPT09IG51bGwpIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gc2Nyb2xsVG9wXG5cbiAgICB2YXIgZGVsdGFZID0gdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gLSBzY3JvbGxUb3BcblxuICAgIGlmIChNYXRoLmFicyhkZWx0YVkpID49IHRoaXMub3B0aW9ucy5zY3JvbGxUaHJlc2hvbGQpIHtcbiAgICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfVxuICB9XG5cbiAga2V5ZG93bkhhbmRsZXIgKGUpIHtcbiAgICB2YXIgY29kZSA9IGUua2V5IHx8IGUuY29kZVxuICAgIGlmIChjb2RlID09PSAnRXNjYXBlJyB8fCBlLmtleUNvZGUgPT09IDI3KSB0aGlzLmNsb3NlKClcbiAgfVxuXG4gIG1vdXNlZG93bkhhbmRsZXIgKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5wcmVzcyA9IHRydWVcbiAgICAgIHRoaXMuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSwgdHJ1ZSlcbiAgICB9LCB0aGlzLnByZXNzRGVsYXkpXG4gIH1cblxuICBtb3VzZW1vdmVIYW5kbGVyIChlKSB7XG4gICAgaWYgKHRoaXMucHJlc3MpIHRoaXMuZ3JhYihlLmNsaWVudFgsIGUuY2xpZW50WSlcbiAgfVxuXG4gIG1vdXNldXBIYW5kbGVyICgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuICAgIHRoaXMucHJlc3MgPSBmYWxzZVxuICAgIHRoaXMucmVsZWFzZSgpXG4gIH1cblxuICB0b3VjaHN0YXJ0SGFuZGxlciAoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnByZXNzID0gdHJ1ZVxuICAgICAgdmFyIHRvdWNoID0gZS50b3VjaGVzWzBdXG4gICAgICB0aGlzLmdyYWIodG91Y2guY2xpZW50WCwgdG91Y2guY2xpZW50WSwgdHJ1ZSlcbiAgICB9LCB0aGlzLnByZXNzRGVsYXkpXG4gIH1cblxuICB0b3VjaG1vdmVIYW5kbGVyIChlKSB7XG4gICAgaWYgKHRoaXMucHJlc3MpIHtcbiAgICAgIHZhciB0b3VjaCA9IGUudG91Y2hlc1swXVxuICAgICAgdGhpcy5ncmFiKHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFkpXG4gICAgfVxuICB9XG5cbiAgdG91Y2hlbmRIYW5kbGVyICgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuICAgIHRoaXMucHJlc3MgPSBmYWxzZVxuICAgIGlmICh0aGlzLl9ncmFiKSB0aGlzLnJlbGVhc2UoKVxuICAgIGVsc2UgdGhpcy5jbG9zZSgpXG4gIH1cbn1cbiIsImltcG9ydCB7IG9wdGlvbnMgfSBmcm9tICcuL29wdGlvbnMnXG5pbXBvcnQgWm9vbWluZyBmcm9tICcuL3pvb21pbmcnXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiB7XG4gIG5ldyBab29taW5nKCkubGlzdGVuKG9wdGlvbnMuZGVmYXVsdFpvb21hYmxlKVxufSlcblxuaWYgKEVOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIC8vIEVuYWJsZSBMaXZlUmVsb2FkXG4gIGRvY3VtZW50LndyaXRlKFxuICAgICc8c2NyaXB0IHNyYz1cImh0dHA6Ly8nICsgKGxvY2F0aW9uLmhvc3QgfHwgJ2xvY2FsaG9zdCcpLnNwbGl0KCc6JylbMF0gK1xuICAgICc6MzU3MjkvbGl2ZXJlbG9hZC5qcz9zbmlwdmVyPTFcIj48LycgKyAnc2NyaXB0PidcbiAgKVxufVxuXG5leHBvcnQgZGVmYXVsdCBab29taW5nXG4iXSwibmFtZXMiOlsib3B0aW9ucyIsInByZWZpeCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50Iiwic3R5bGUiLCJab29taW5nIiwib3B0cyIsImJvZHkiLCJvdmVybGF5IiwiY3JlYXRlRWxlbWVudCIsInRhcmdldCIsInBhcmVudCIsIl9zaG93biIsIl9sb2NrIiwicHJlc3MiLCJfZ3JhYiIsIm9yaWdpbmFsU3R5bGVzIiwib3BlblN0eWxlcyIsInRyYW5zbGF0ZSIsInNjYWxlIiwic3JjVGh1bWJuYWlsIiwiaW1nUmVjdCIsInByZXNzVGltZXIiLCJsYXN0U2Nyb2xsUG9zaXRpb24iLCJwcmVzc0RlbGF5IiwidHJhbnMiLCJzbmlmZlRyYW5zaXRpb24iLCJ0cmFuc2l0aW9uUHJvcCIsInRyYW5zaXRpb24iLCJ0cmFuc2Zvcm1Qcm9wIiwidHJhbnNmb3JtIiwidHJhbnNmb3JtQ3NzUHJvcCIsInJlcGxhY2UiLCJ0cmFuc0VuZEV2ZW50IiwidHJhbnNFbmQiLCJjb25maWciLCJzZXRTdHlsZSIsImJnQ29sb3IiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJ0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24iLCJhZGRFdmVudExpc3RlbmVyIiwiY2xvc2UiLCJzY3JvbGxIYW5kbGVyIiwiYmluZCIsImtleWRvd25IYW5kbGVyIiwibW91c2Vkb3duSGFuZGxlciIsIm1vdXNlbW92ZUhhbmRsZXIiLCJtb3VzZXVwSGFuZGxlciIsInRvdWNoc3RhcnRIYW5kbGVyIiwidG91Y2htb3ZlSGFuZGxlciIsInRvdWNoZW5kSGFuZGxlciIsImFzc2lnbiIsImtleSIsImVsIiwiY2IiLCJxdWVyeVNlbGVjdG9yIiwidGFnTmFtZSIsIm9uQmVmb3JlT3BlbiIsInBhcmVudE5vZGUiLCJpbWciLCJJbWFnZSIsIm9ubG9hZCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsImhhc0F0dHJpYnV0ZSIsImdldEF0dHJpYnV0ZSIsIndpZHRoIiwiaGVpZ2h0Iiwic2V0QXR0cmlidXRlIiwib2Zmc2V0V2lkdGgiLCJjYWxjdWxhdGVUcmFuc2Zvcm0iLCJzcmMiLCJhcHBlbmRDaGlsZCIsIm9wYWNpdHkiLCJiZ09wYWNpdHkiLCJvbkVuZCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJvbk9wZW4iLCJvbkJlZm9yZUNsb3NlIiwicmVtb3ZlQ2hpbGQiLCJvbkNsb3NlIiwieCIsInkiLCJzdGFydCIsIm9uQmVmb3JlR3JhYiIsImR4Iiwid2luZG93IiwiaW5uZXJXaWR0aCIsImR5IiwiaW5uZXJIZWlnaHQiLCJvbGRUcmFuc2Zvcm0iLCJzY2FsZUV4dHJhIiwib25HcmFiIiwib25CZWZvcmVSZWxlYXNlIiwib25SZWxlYXNlIiwiZWxzIiwicXVlcnlTZWxlY3RvckFsbCIsImkiLCJsZW5ndGgiLCJsaXN0ZW4iLCJjdXJzb3IiLCJlIiwicHJldmVudERlZmF1bHQiLCJvcGVuIiwic3R5bGVzIiwicmVtZW1iZXIiLCJjaGVja1RyYW5zIiwicyIsIm9yaWdpbmFsIiwicmV0IiwidGZvcm0iLCJlbmQiLCJzb21lIiwicHJvcCIsInVuZGVmaW5lZCIsInZhbHVlIiwiaW1nSGFsZldpZHRoIiwiaW1nSGFsZkhlaWdodCIsImltZ0NlbnRlciIsImxlZnQiLCJ0b3AiLCJ3aW5kb3dDZW50ZXIiLCJkaXN0RnJvbUltYWdlRWRnZVRvV2luZG93RWRnZSIsInNjYWxlSG9yaXpvbnRhbGx5Iiwic2NhbGVWZXJ0aWNhbGx5Iiwic2NhbGVCYXNlIiwiTWF0aCIsIm1pbiIsInNjcm9sbFRvcCIsInBhZ2VZT2Zmc2V0IiwiZGVsdGFZIiwiYWJzIiwic2Nyb2xsVGhyZXNob2xkIiwiY29kZSIsImtleUNvZGUiLCJzZXRUaW1lb3V0IiwiZ3JhYiIsImNsaWVudFgiLCJjbGllbnRZIiwicmVsZWFzZSIsInRvdWNoIiwidG91Y2hlcyIsImRlZmF1bHRab29tYWJsZSIsIkVOViIsIndyaXRlIiwibG9jYXRpb24iLCJob3N0Iiwic3BsaXQiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFPLElBQU1BLFVBQVU7bUJBQ0oseUJBREk7c0JBRUQsS0FGQzs0QkFHSyx3QkFITDtXQUlaLE1BSlk7YUFLVixDQUxVO2FBTVYsR0FOVTtjQU9ULEdBUFM7bUJBUUosRUFSSTtVQVNiLElBVGE7V0FVWixJQVZZO1VBV2IsSUFYYTthQVlWLElBWlU7Z0JBYVAsSUFiTztpQkFjTixJQWRNO2dCQWVQLElBZk87bUJBZ0JKO0NBaEJaOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0VQO0FBQ0EsSUFBTUMsU0FBUyxzQkFBc0JDLFNBQVNDLGVBQVQsQ0FBeUJDLEtBQS9DLEdBQXVELFVBQXZELEdBQW9FLEVBQW5GOztJQUVxQkM7bUJBQ1BDLElBQVosRUFBa0I7Ozs7U0FFWEMsSUFBTCxHQUFZTCxTQUFTSyxJQUFyQjtTQUNLQyxPQUFMLEdBQWVOLFNBQVNPLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBZjs7U0FFS0MsTUFBTDtTQUNLQyxNQUFMOzs7U0FHS0MsTUFBTCxHQUFjLEtBQWQ7U0FDS0MsS0FBTCxHQUFjLEtBQWQ7U0FDS0MsS0FBTCxHQUFhLEtBQWI7U0FDS0MsS0FBTCxHQUFhLEtBQWI7OztTQUdLQyxjQUFMO1NBQ0tDLFVBQUw7U0FDS0MsU0FBTDtTQUNLQyxLQUFMOztTQUVLQyxZQUFMO1NBQ0tDLE9BQUw7U0FDS0MsVUFBTDtTQUNLQyxrQkFBTCxHQUEwQixJQUExQjs7U0FFS0MsVUFBTCxHQUFrQixHQUFsQjs7O1FBR01DLFFBQVEsS0FBS0MsZUFBTCxDQUFxQixLQUFLbEIsT0FBMUIsQ0FBZDtTQUNLbUIsY0FBTCxHQUFzQkYsTUFBTUcsVUFBNUI7U0FD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
