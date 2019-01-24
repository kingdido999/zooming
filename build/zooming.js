(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Zooming = factory());
}(this, function () { 'use strict';

  var cursor = {
    default: 'auto',
    zoomIn: 'zoom-in',
    zoomOut: 'zoom-out',
    grab: 'grab',
    move: 'move'
  };

  function listen(el, event, handler) {
    var add = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

    var options = { passive: false };

    if (add) {
      el.addEventListener(event, handler, options);
    } else {
      el.removeEventListener(event, handler, options);
    }
  }

  function loadImage(src, cb) {
    if (src) {
      var img = new Image();

      img.onload = function onImageLoad() {
        if (cb) cb(img);
      };

      img.src = src;
    }
  }

  function getOriginalSource(el) {
    if (el.dataset.original) {
      return el.dataset.original;
    } else if (el.parentNode.tagName === 'A') {
      return el.parentNode.getAttribute('href');
    } else {
      return null;
    }
  }

  function setStyle(el, styles, remember) {
    if (styles.transition) {
      var value = styles.transition;
      delete styles.transition;
      styles.transition = value;
    }

    if (styles.transform) {
      var _value = styles.transform;
      delete styles.transform;
      styles.transform = _value;
    }

    var s = el.style;
    var original = {};

    for (var key in styles) {
      if (remember) {
        original[key] = s[key] || '';
      }

      s[key] = styles[key];
    }

    return original;
  }

  function bindAll(_this, that) {
    var methods = Object.getOwnPropertyNames(Object.getPrototypeOf(_this));
    methods.forEach(function bindOne(method) {
      _this[method] = _this[method].bind(that);
    });
  }

  var noop = function noop() {};

  var DEFAULT_OPTIONS = {
    /**
     * To be able to grab and drag the image for extra zoom-in.
     * @type {boolean}
     */
    enableGrab: true,

    /**
     * Preload zoomable images.
     * @type {boolean}
     */
    preloadImage: false,

    /**
     * Close the zoomed image when browser window is resized.
     * @type {boolean}
     */
    closeOnWindowResize: true,

    /**
     * Transition duration in seconds.
     * @type {number}
     */
    transitionDuration: 0.4,

    /**
     * Transition timing function.
     * @type {string}
     */
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0, 1)',

    /**
     * Overlay background color.
     * @type {string}
     */
    bgColor: 'rgb(255, 255, 255)',

    /**
     * Overlay background opacity.
     * @type {number}
     */
    bgOpacity: 1,

    /**
     * The base scale factor for zooming. By default scale to fit the window.
     * @type {number}
     */
    scaleBase: 1.0,

    /**
     * The additional scale factor when grabbing the image.
     * @type {number}
     */
    scaleExtra: 0.5,

    /**
     * How much scrolling it takes before closing out.
     * @type {number}
     */
    scrollThreshold: 40,

    /**
     * The z-index that the overlay will be added with.
     * @type {number}
     */
    zIndex: 998,

    /**
     * Scale (zoom in) to given width and height. Ignore scaleBase if set.
     * Alternatively, provide a percentage value relative to the original image size.
     * @type {Object|String}
     * @example
     * customSize: { width: 800, height: 400 }
     * customSize: 100%
     */
    customSize: null,

    /**
     * A callback function that will be called when a target is opened and
     * transition has ended. It will get the target element as the argument.
     * @type {Function}
     */
    onOpen: noop,

    /**
     * Same as above, except fired when closed.
     * @type {Function}
     */
    onClose: noop,

    /**
     * Same as above, except fired when grabbed.
     * @type {Function}
     */
    onGrab: noop,

    /**
     * Same as above, except fired when moved.
     * @type {Function}
     */
    onMove: noop,

    /**
     * Same as above, except fired when released.
     * @type {Function}
     */
    onRelease: noop,

    /**
     * A callback function that will be called before open.
     * @type {Function}
     */
    onBeforeOpen: noop,

    /**
     * A callback function that will be called before close.
     * @type {Function}
     */
    onBeforeClose: noop,

    /**
     * A callback function that will be called before grab.
     * @type {Function}
     */
    onBeforeGrab: noop,

    /**
     * A callback function that will be called before release.
     * @type {Function}
     */
    onBeforeRelease: noop,

    /**
     * A callback function that will be called when the hi-res image is loading.
     * @type {Function}
     */
    onImageLoading: noop,

    /**
     * A callback function that will be called when the hi-res image is loaded.
     * @type {Function}
     */
    onImageLoaded: noop
  };

  var PRESS_DELAY = 200;

  var handler = {
    init: function init(instance) {
      bindAll(this, instance);
    },
    click: function click(e) {
      e.preventDefault();

      if (isPressingMetaKey(e)) {
        return window.open(this.target.srcOriginal || e.currentTarget.src, '_blank');
      } else {
        if (this.shown) {
          if (this.released) {
            this.close();
          } else {
            this.release();
          }
        } else {
          this.open(e.currentTarget);
        }
      }
    },
    scroll: function scroll() {
      var el = document.documentElement || document.body.parentNode || document.body;
      var scrollLeft = window.pageXOffset || el.scrollLeft;
      var scrollTop = window.pageYOffset || el.scrollTop;

      if (this.lastScrollPosition === null) {
        this.lastScrollPosition = {
          x: scrollLeft,
          y: scrollTop
        };
      }

      var deltaX = this.lastScrollPosition.x - scrollLeft;
      var deltaY = this.lastScrollPosition.y - scrollTop;
      var threshold = this.options.scrollThreshold;

      if (Math.abs(deltaY) >= threshold || Math.abs(deltaX) >= threshold) {
        this.lastScrollPosition = null;
        this.close();
      }
    },
    keydown: function keydown(e) {
      if (isEscape(e)) {
        if (this.released) {
          this.close();
        } else {
          this.release(this.close);
        }
      }
    },
    mousedown: function mousedown(e) {
      if (!isLeftButton(e) || isPressingMetaKey(e)) return;
      e.preventDefault();
      var clientX = e.clientX,
          clientY = e.clientY;


      this.pressTimer = setTimeout(function grabOnMouseDown() {
        this.grab(clientX, clientY);
      }.bind(this), PRESS_DELAY);
    },
    mousemove: function mousemove(e) {
      if (this.released) return;
      this.move(e.clientX, e.clientY);
    },
    mouseup: function mouseup(e) {
      if (!isLeftButton(e) || isPressingMetaKey(e)) return;
      clearTimeout(this.pressTimer);

      if (this.released) {
        this.close();
      } else {
        this.release();
      }
    },
    touchstart: function touchstart(e) {
      e.preventDefault();
      var _e$touches$ = e.touches[0],
          clientX = _e$touches$.clientX,
          clientY = _e$touches$.clientY;


      this.pressTimer = setTimeout(function grabOnTouchStart() {
        this.grab(clientX, clientY);
      }.bind(this), PRESS_DELAY);
    },
    touchmove: function touchmove(e) {
      if (this.released) return;

      var _e$touches$2 = e.touches[0],
          clientX = _e$touches$2.clientX,
          clientY = _e$touches$2.clientY;

      this.move(clientX, clientY);
    },
    touchend: function touchend(e) {
      if (isTouching(e)) return;
      clearTimeout(this.pressTimer);

      if (this.released) {
        this.close();
      } else {
        this.release();
      }
    },
    clickOverlay: function clickOverlay() {
      this.close();
    },
    resizeWindow: function resizeWindow() {
      this.close();
    }
  };

  function isLeftButton(e) {
    return e.button === 0;
  }

  function isPressingMetaKey(e) {
    return e.metaKey || e.ctrlKey;
  }

  function isTouching(e) {
    e.targetTouches.length > 0;
  }

  function isEscape(e) {
    var code = e.key || e.code;
    return code === 'Escape' || e.keyCode === 27;
  }

  var overlay = {
    init: function init(instance) {
      this.el = document.createElement('div');
      this.instance = instance;
      this.parent = document.body;

      setStyle(this.el, {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0
      });

      this.updateStyle(instance.options);
      listen(this.el, 'click', instance.handler.clickOverlay.bind(instance));
    },
    updateStyle: function updateStyle(options) {
      setStyle(this.el, {
        zIndex: options.zIndex,
        backgroundColor: options.bgColor,
        transition: 'opacity\n        ' + options.transitionDuration + 's\n        ' + options.transitionTimingFunction
      });
    },
    insert: function insert() {
      this.parent.appendChild(this.el);
    },
    remove: function remove() {
      this.parent.removeChild(this.el);
    },
    fadeIn: function fadeIn() {
      this.el.offsetWidth;
      this.el.style.opacity = this.instance.options.bgOpacity;
    },
    fadeOut: function fadeOut() {
      this.el.style.opacity = 0;
    }
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
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

  var _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  // Translate z-axis to fix CSS grid display issue in Chrome:
  // https://github.com/kingdido999/zooming/issues/42
  var TRANSLATE_Z = 0;

  var target = {
    init: function init(el, instance) {
      this.el = el;
      this.instance = instance;
      this.srcThumbnail = this.el.getAttribute('src');
      this.srcset = this.el.getAttribute('srcset');
      this.srcOriginal = getOriginalSource(this.el);
      this.rect = this.el.getBoundingClientRect();
      this.translate = null;
      this.scale = null;
      this.styleOpen = null;
      this.styleClose = null;
    },
    zoomIn: function zoomIn() {
      var _instance$options = this.instance.options,
          zIndex = _instance$options.zIndex,
          enableGrab = _instance$options.enableGrab,
          transitionDuration = _instance$options.transitionDuration,
          transitionTimingFunction = _instance$options.transitionTimingFunction;

      this.translate = this.calculateTranslate();
      this.scale = this.calculateScale();

      this.styleOpen = {
        position: 'relative',
        zIndex: zIndex + 1,
        cursor: enableGrab ? cursor.grab : cursor.zoomOut,
        transition: 'transform\n        ' + transitionDuration + 's\n        ' + transitionTimingFunction,
        transform: 'translate3d(' + this.translate.x + 'px, ' + this.translate.y + 'px, ' + TRANSLATE_Z + 'px)\n        scale(' + this.scale.x + ',' + this.scale.y + ')',
        height: this.rect.height + 'px',
        width: this.rect.width + 'px'

        // Force layout update
      };this.el.offsetWidth;

      // Trigger transition
      this.styleClose = setStyle(this.el, this.styleOpen, true);
    },
    zoomOut: function zoomOut() {
      // Force layout update
      this.el.offsetWidth;

      setStyle(this.el, { transform: 'none' });
    },
    grab: function grab(x, y, scaleExtra) {
      var windowCenter = getWindowCenter();
      var dx = windowCenter.x - x,
          dy = windowCenter.y - y;


      setStyle(this.el, {
        cursor: cursor.move,
        transform: 'translate3d(\n        ' + (this.translate.x + dx) + 'px, ' + (this.translate.y + dy) + 'px, ' + TRANSLATE_Z + 'px)\n        scale(' + (this.scale.x + scaleExtra) + ',' + (this.scale.y + scaleExtra) + ')'
      });
    },
    move: function move(x, y, scaleExtra) {
      var windowCenter = getWindowCenter();
      var dx = windowCenter.x - x,
          dy = windowCenter.y - y;


      setStyle(this.el, {
        transition: 'transform',
        transform: 'translate3d(\n        ' + (this.translate.x + dx) + 'px, ' + (this.translate.y + dy) + 'px, ' + TRANSLATE_Z + 'px)\n        scale(' + (this.scale.x + scaleExtra) + ',' + (this.scale.y + scaleExtra) + ')'
      });
    },
    restoreCloseStyle: function restoreCloseStyle() {
      setStyle(this.el, this.styleClose);
    },
    restoreOpenStyle: function restoreOpenStyle() {
      setStyle(this.el, this.styleOpen);
    },
    upgradeSource: function upgradeSource() {
      if (this.srcOriginal) {
        var parentNode = this.el.parentNode;

        if (this.srcset) {
          this.el.removeAttribute('srcset');
        }

        var temp = this.el.cloneNode(false);

        // Force compute the hi-res image in DOM to prevent
        // image flickering while updating src
        temp.setAttribute('src', this.srcOriginal);
        temp.style.position = 'fixed';
        temp.style.visibility = 'hidden';
        parentNode.appendChild(temp);

        // Add delay to prevent Firefox from flickering
        setTimeout(function updateSrc() {
          this.el.setAttribute('src', this.srcOriginal);
          parentNode.removeChild(temp);
        }.bind(this), 50);
      }
    },
    downgradeSource: function downgradeSource() {
      if (this.srcOriginal) {
        if (this.srcset) {
          this.el.setAttribute('srcset', this.srcset);
        }
        this.el.setAttribute('src', this.srcThumbnail);
      }
    },
    calculateTranslate: function calculateTranslate() {
      var windowCenter = getWindowCenter();
      var targetCenter = {
        x: this.rect.left + this.rect.width / 2,
        y: this.rect.top + this.rect.height / 2

        // The vector to translate image to the window center
      };return {
        x: windowCenter.x - targetCenter.x,
        y: windowCenter.y - targetCenter.y
      };
    },
    calculateScale: function calculateScale() {
      var _el$dataset = this.el.dataset,
          zoomingHeight = _el$dataset.zoomingHeight,
          zoomingWidth = _el$dataset.zoomingWidth;
      var _instance$options2 = this.instance.options,
          customSize = _instance$options2.customSize,
          scaleBase = _instance$options2.scaleBase;


      if (!customSize && zoomingHeight && zoomingWidth) {
        return {
          x: zoomingWidth / this.rect.width,
          y: zoomingHeight / this.rect.height
        };
      } else if (customSize && (typeof customSize === 'undefined' ? 'undefined' : _typeof(customSize)) === 'object') {
        return {
          x: customSize.width / this.rect.width,
          y: customSize.height / this.rect.height
        };
      } else {
        var targetHalfWidth = this.rect.width / 2;
        var targetHalfHeight = this.rect.height / 2;
        var windowCenter = getWindowCenter();

        // The distance between target edge and window edge
        var targetEdgeToWindowEdge = {
          x: windowCenter.x - targetHalfWidth,
          y: windowCenter.y - targetHalfHeight
        };

        var scaleHorizontally = targetEdgeToWindowEdge.x / targetHalfWidth;
        var scaleVertically = targetEdgeToWindowEdge.y / targetHalfHeight;

        // The additional scale is based on the smaller value of
        // scaling horizontally and scaling vertically
        var scale = scaleBase + Math.min(scaleHorizontally, scaleVertically);

        if (customSize && typeof customSize === 'string') {
          // Use zoomingWidth and zoomingHeight if available
          var naturalWidth = zoomingWidth || this.el.naturalWidth;
          var naturalHeight = zoomingHeight || this.el.naturalHeight;
          var maxZoomingWidth = parseFloat(customSize) * naturalWidth / (100 * this.rect.width);
          var maxZoomingHeight = parseFloat(customSize) * naturalHeight / (100 * this.rect.height);

          // Only scale image up to the specified customSize percentage
          if (scale > maxZoomingWidth || scale > maxZoomingHeight) {
            return {
              x: maxZoomingWidth,
              y: maxZoomingHeight
            };
          }
        }

        return {
          x: scale,
          y: scale
        };
      }
    }
  };

  function getWindowCenter() {
    var docEl = document.documentElement;
    var windowWidth = Math.min(docEl.clientWidth, window.innerWidth);
    var windowHeight = Math.min(docEl.clientHeight, window.innerHeight);

    return {
      x: windowWidth / 2,
      y: windowHeight / 2
    };
  }

  /**
   * Zooming instance.
   */

  var Zooming = function () {
    /**
     * @param {Object} [options] Update default options if provided.
     */
    function Zooming(options) {
      classCallCheck(this, Zooming);

      this.target = Object.create(target);
      this.overlay = Object.create(overlay);
      this.handler = Object.create(handler);
      this.body = document.body;

      this.shown = false;
      this.lock = false;
      this.released = true;
      this.lastScrollPosition = null;
      this.pressTimer = null;

      this.options = _extends({}, DEFAULT_OPTIONS, options);
      this.overlay.init(this);
      this.handler.init(this);
    }

    /**
     * Make element(s) zoomable.
     * @param  {string|Element} el A css selector or an Element.
     * @return {this}
     */


    createClass(Zooming, [{
      key: 'listen',
      value: function listen$$1(el) {
        if (typeof el === 'string') {
          var els = document.querySelectorAll(el);
          var i = els.length;

          while (i--) {
            this.listen(els[i]);
          }
        } else if (el.tagName === 'IMG') {
          el.style.cursor = cursor.zoomIn;
          listen(el, 'click', this.handler.click);

          if (this.options.preloadImage) {
            loadImage(getOriginalSource(el));
          }
        }

        return this;
      }

      /**
       * Update options or return current options if no argument is provided.
       * @param  {Object} options An Object that contains this.options.
       * @return {this|this.options}
       */

    }, {
      key: 'config',
      value: function config(options) {
        if (options) {
          _extends(this.options, options);
          this.overlay.updateStyle(this.options);
          return this;
        } else {
          return this.options;
        }
      }

      /**
       * Open (zoom in) the Element.
       * @param  {Element} el The Element to open.
       * @param  {Function} [cb=this.options.onOpen] A callback function that will
       * be called when a target is opened and transition has ended. It will get
       * the target element as the argument.
       * @return {this}
       */

    }, {
      key: 'open',
      value: function open(el) {
        var _this = this;

        var cb = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.options.onOpen;

        if (this.shown || this.lock) return;

        var target$$1 = typeof el === 'string' ? document.querySelector(el) : el;

        if (target$$1.tagName !== 'IMG') return;

        this.options.onBeforeOpen(target$$1);

        this.target.init(target$$1, this);

        if (!this.options.preloadImage) {
          var srcOriginal = this.target.srcOriginal;


          if (srcOriginal != null) {
            this.options.onImageLoading(target$$1);
            loadImage(srcOriginal, this.options.onImageLoaded);
          }
        }

        this.shown = true;
        this.lock = true;

        this.target.zoomIn();
        this.overlay.insert();
        this.overlay.fadeIn();

        listen(document, 'scroll', this.handler.scroll);
        listen(document, 'keydown', this.handler.keydown);

        if (this.options.closeOnWindowResize) {
          listen(window, 'resize', this.handler.resizeWindow);
        }

        var onOpenEnd = function onOpenEnd() {
          listen(target$$1, 'transitionend', onOpenEnd, false);
          _this.lock = false;
          _this.target.upgradeSource();

          if (_this.options.enableGrab) {
            toggleGrabListeners(document, _this.handler, true);
          }

          cb(target$$1);
        };

        listen(target$$1, 'transitionend', onOpenEnd);

        return this;
      }

      /**
       * Close (zoom out) the Element currently opened.
       * @param  {Function} [cb=this.options.onClose] A callback function that will
       * be called when a target is closed and transition has ended. It will get
       * the target element as the argument.
       * @return {this}
       */

    }, {
      key: 'close',
      value: function close() {
        var _this2 = this;

        var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.options.onClose;

        if (!this.shown || this.lock) return;

        var target$$1 = this.target.el;

        this.options.onBeforeClose(target$$1);

        this.lock = true;
        this.body.style.cursor = cursor.default;
        this.overlay.fadeOut();
        this.target.zoomOut();

        listen(document, 'scroll', this.handler.scroll, false);
        listen(document, 'keydown', this.handler.keydown, false);

        if (this.options.closeOnWindowResize) {
          listen(window, 'resize', this.handler.resizeWindow, false);
        }

        var onCloseEnd = function onCloseEnd() {
          listen(target$$1, 'transitionend', onCloseEnd, false);

          _this2.shown = false;
          _this2.lock = false;

          _this2.target.downgradeSource();

          if (_this2.options.enableGrab) {
            toggleGrabListeners(document, _this2.handler, false);
          }

          _this2.target.restoreCloseStyle();
          _this2.overlay.remove();

          cb(target$$1);
        };

        listen(target$$1, 'transitionend', onCloseEnd);

        return this;
      }

      /**
       * Grab the Element currently opened given a position and apply extra zoom-in.
       * @param  {number}   x The X-axis of where the press happened.
       * @param  {number}   y The Y-axis of where the press happened.
       * @param  {number}   scaleExtra Extra zoom-in to apply.
       * @param  {Function} [cb=this.options.onGrab] A callback function that
       * will be called when a target is grabbed and transition has ended. It
       * will get the target element as the argument.
       * @return {this}
       */

    }, {
      key: 'grab',
      value: function grab(x, y) {
        var scaleExtra = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.options.scaleExtra;
        var cb = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : this.options.onGrab;

        if (!this.shown || this.lock) return;

        var target$$1 = this.target.el;

        this.options.onBeforeGrab(target$$1);

        this.released = false;
        this.target.grab(x, y, scaleExtra);

        var onGrabEnd = function onGrabEnd() {
          listen(target$$1, 'transitionend', onGrabEnd, false);
          cb(target$$1);
        };

        listen(target$$1, 'transitionend', onGrabEnd);

        return this;
      }

      /**
       * Move the Element currently grabbed given a position and apply extra zoom-in.
       * @param  {number}   x The X-axis of where the press happened.
       * @param  {number}   y The Y-axis of where the press happened.
       * @param  {number}   scaleExtra Extra zoom-in to apply.
       * @param  {Function} [cb=this.options.onMove] A callback function that
       * will be called when a target is moved and transition has ended. It will
       * get the target element as the argument.
       * @return {this}
       */

    }, {
      key: 'move',
      value: function move(x, y) {
        var scaleExtra = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.options.scaleExtra;
        var cb = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : this.options.onMove;

        if (!this.shown || this.lock) return;

        this.released = false;
        this.body.style.cursor = cursor.move;
        this.target.move(x, y, scaleExtra);

        var target$$1 = this.target.el;

        var onMoveEnd = function onMoveEnd() {
          listen(target$$1, 'transitionend', onMoveEnd, false);
          cb(target$$1);
        };

        listen(target$$1, 'transitionend', onMoveEnd);

        return this;
      }

      /**
       * Release the Element currently grabbed.
       * @param  {Function} [cb=this.options.onRelease] A callback function that
       * will be called when a target is released and transition has ended. It
       * will get the target element as the argument.
       * @return {this}
       */

    }, {
      key: 'release',
      value: function release() {
        var _this3 = this;

        var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.options.onRelease;

        if (!this.shown || this.lock) return;

        var target$$1 = this.target.el;

        this.options.onBeforeRelease(target$$1);

        this.lock = true;
        this.body.style.cursor = cursor.default;
        this.target.restoreOpenStyle();

        var onReleaseEnd = function onReleaseEnd() {
          listen(target$$1, 'transitionend', onReleaseEnd, false);
          _this3.lock = false;
          _this3.released = true;
          cb(target$$1);
        };

        listen(target$$1, 'transitionend', onReleaseEnd);

        return this;
      }
    }]);
    return Zooming;
  }();


  function toggleGrabListeners(el, handler$$1, add) {
    var types = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend'];

    types.forEach(function toggleListener(type) {
      listen(el, type, handler$$1[type], add);
    });
  }

  return Zooming;

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9vbWluZy5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3V0aWxzLmpzIiwiLi4vc3JjL29wdGlvbnMuanMiLCIuLi9zcmMvaGFuZGxlci5qcyIsIi4uL3NyYy9vdmVybGF5LmpzIiwiLi4vc3JjL3RhcmdldC5qcyIsIi4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3QgY3Vyc29yID0ge1xuICBkZWZhdWx0OiAnYXV0bycsXG4gIHpvb21JbjogJ3pvb20taW4nLFxuICB6b29tT3V0OiAnem9vbS1vdXQnLFxuICBncmFiOiAnZ3JhYicsXG4gIG1vdmU6ICdtb3ZlJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdGVuKGVsLCBldmVudCwgaGFuZGxlciwgYWRkID0gdHJ1ZSkge1xuICBjb25zdCBvcHRpb25zID0geyBwYXNzaXZlOiBmYWxzZSB9XG5cbiAgaWYgKGFkZCkge1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMpXG4gIH0gZWxzZSB7XG4gICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgaGFuZGxlciwgb3B0aW9ucylcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9hZEltYWdlKHNyYywgY2IpIHtcbiAgaWYgKHNyYykge1xuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpXG5cbiAgICBpbWcub25sb2FkID0gZnVuY3Rpb24gb25JbWFnZUxvYWQoKSB7XG4gICAgICBpZiAoY2IpIGNiKGltZylcbiAgICB9XG5cbiAgICBpbWcuc3JjID0gc3JjXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE9yaWdpbmFsU291cmNlKGVsKSB7XG4gIGlmIChlbC5kYXRhc2V0Lm9yaWdpbmFsKSB7XG4gICAgcmV0dXJuIGVsLmRhdGFzZXQub3JpZ2luYWxcbiAgfSBlbHNlIGlmIChlbC5wYXJlbnROb2RlLnRhZ05hbWUgPT09ICdBJykge1xuICAgIHJldHVybiBlbC5wYXJlbnROb2RlLmdldEF0dHJpYnV0ZSgnaHJlZicpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0U3R5bGUoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgaWYgKHN0eWxlcy50cmFuc2l0aW9uKSB7XG4gICAgY29uc3QgdmFsdWUgPSBzdHlsZXMudHJhbnNpdGlvblxuICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNpdGlvblxuICAgIHN0eWxlcy50cmFuc2l0aW9uID0gdmFsdWVcbiAgfVxuXG4gIGlmIChzdHlsZXMudHJhbnNmb3JtKSB7XG4gICAgY29uc3QgdmFsdWUgPSBzdHlsZXMudHJhbnNmb3JtXG4gICAgZGVsZXRlIHN0eWxlcy50cmFuc2Zvcm1cbiAgICBzdHlsZXMudHJhbnNmb3JtID0gdmFsdWVcbiAgfVxuXG4gIGxldCBzID0gZWwuc3R5bGVcbiAgbGV0IG9yaWdpbmFsID0ge31cblxuICBmb3IgKGxldCBrZXkgaW4gc3R5bGVzKSB7XG4gICAgaWYgKHJlbWVtYmVyKSB7XG4gICAgICBvcmlnaW5hbFtrZXldID0gc1trZXldIHx8ICcnXG4gICAgfVxuXG4gICAgc1trZXldID0gc3R5bGVzW2tleV1cbiAgfVxuXG4gIHJldHVybiBvcmlnaW5hbFxufVxuXG5leHBvcnQgZnVuY3Rpb24gYmluZEFsbChfdGhpcywgdGhhdCkge1xuICBjb25zdCBtZXRob2RzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoT2JqZWN0LmdldFByb3RvdHlwZU9mKF90aGlzKSlcbiAgbWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIGJpbmRPbmUobWV0aG9kKSB7XG4gICAgX3RoaXNbbWV0aG9kXSA9IF90aGlzW21ldGhvZF0uYmluZCh0aGF0KVxuICB9KVxufVxuIiwiY29uc3Qgbm9vcCA9ICgpID0+IHt9XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgLyoqXG4gICAqIFRvIGJlIGFibGUgdG8gZ3JhYiBhbmQgZHJhZyB0aGUgaW1hZ2UgZm9yIGV4dHJhIHpvb20taW4uXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgZW5hYmxlR3JhYjogdHJ1ZSxcblxuICAvKipcbiAgICogUHJlbG9hZCB6b29tYWJsZSBpbWFnZXMuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgcHJlbG9hZEltYWdlOiBmYWxzZSxcblxuICAvKipcbiAgICogQ2xvc2UgdGhlIHpvb21lZCBpbWFnZSB3aGVuIGJyb3dzZXIgd2luZG93IGlzIHJlc2l6ZWQuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgY2xvc2VPbldpbmRvd1Jlc2l6ZTogdHJ1ZSxcblxuICAvKipcbiAgICogVHJhbnNpdGlvbiBkdXJhdGlvbiBpbiBzZWNvbmRzLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgdHJhbnNpdGlvbkR1cmF0aW9uOiAwLjQsXG5cbiAgLyoqXG4gICAqIFRyYW5zaXRpb24gdGltaW5nIGZ1bmN0aW9uLlxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uOiAnY3ViaWMtYmV6aWVyKDAuNCwgMCwgMCwgMSknLFxuXG4gIC8qKlxuICAgKiBPdmVybGF5IGJhY2tncm91bmQgY29sb3IuXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICBiZ0NvbG9yOiAncmdiKDI1NSwgMjU1LCAyNTUpJyxcblxuICAvKipcbiAgICogT3ZlcmxheSBiYWNrZ3JvdW5kIG9wYWNpdHkuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBiZ09wYWNpdHk6IDEsXG5cbiAgLyoqXG4gICAqIFRoZSBiYXNlIHNjYWxlIGZhY3RvciBmb3Igem9vbWluZy4gQnkgZGVmYXVsdCBzY2FsZSB0byBmaXQgdGhlIHdpbmRvdy5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHNjYWxlQmFzZTogMS4wLFxuXG4gIC8qKlxuICAgKiBUaGUgYWRkaXRpb25hbCBzY2FsZSBmYWN0b3Igd2hlbiBncmFiYmluZyB0aGUgaW1hZ2UuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY2FsZUV4dHJhOiAwLjUsXG5cbiAgLyoqXG4gICAqIEhvdyBtdWNoIHNjcm9sbGluZyBpdCB0YWtlcyBiZWZvcmUgY2xvc2luZyBvdXQuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY3JvbGxUaHJlc2hvbGQ6IDQwLFxuXG4gIC8qKlxuICAgKiBUaGUgei1pbmRleCB0aGF0IHRoZSBvdmVybGF5IHdpbGwgYmUgYWRkZWQgd2l0aC5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHpJbmRleDogOTk4LFxuXG4gIC8qKlxuICAgKiBTY2FsZSAoem9vbSBpbikgdG8gZ2l2ZW4gd2lkdGggYW5kIGhlaWdodC4gSWdub3JlIHNjYWxlQmFzZSBpZiBzZXQuXG4gICAqIEFsdGVybmF0aXZlbHksIHByb3ZpZGUgYSBwZXJjZW50YWdlIHZhbHVlIHJlbGF0aXZlIHRvIHRoZSBvcmlnaW5hbCBpbWFnZSBzaXplLlxuICAgKiBAdHlwZSB7T2JqZWN0fFN0cmluZ31cbiAgICogQGV4YW1wbGVcbiAgICogY3VzdG9tU2l6ZTogeyB3aWR0aDogODAwLCBoZWlnaHQ6IDQwMCB9XG4gICAqIGN1c3RvbVNpemU6IDEwMCVcbiAgICovXG4gIGN1c3RvbVNpemU6IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG9wZW5lZCBhbmRcbiAgICogdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0IHdpbGwgZ2V0IHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uT3Blbjogbm9vcCxcblxuICAvKipcbiAgICogU2FtZSBhcyBhYm92ZSwgZXhjZXB0IGZpcmVkIHdoZW4gY2xvc2VkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkNsb3NlOiBub29wLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiBncmFiYmVkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkdyYWI6IG5vb3AsXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIG1vdmVkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbk1vdmU6IG5vb3AsXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIHJlbGVhc2VkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvblJlbGVhc2U6IG5vb3AsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgb3Blbi5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVPcGVuOiBub29wLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIGNsb3NlLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZUNsb3NlOiBub29wLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIGdyYWIuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlR3JhYjogbm9vcCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSByZWxlYXNlLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZVJlbGVhc2U6IG5vb3AsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSBoaS1yZXMgaW1hZ2UgaXMgbG9hZGluZy5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25JbWFnZUxvYWRpbmc6IG5vb3AsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSBoaS1yZXMgaW1hZ2UgaXMgbG9hZGVkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkltYWdlTG9hZGVkOiBub29wXG59XG4iLCJpbXBvcnQgeyBiaW5kQWxsIH0gZnJvbSAnLi91dGlscydcblxuY29uc3QgUFJFU1NfREVMQVkgPSAyMDBcblxuZXhwb3J0IGRlZmF1bHQge1xuICBpbml0KGluc3RhbmNlKSB7XG4gICAgYmluZEFsbCh0aGlzLCBpbnN0YW5jZSlcbiAgfSxcblxuICBjbGljayhlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICBpZiAoaXNQcmVzc2luZ01ldGFLZXkoZSkpIHtcbiAgICAgIHJldHVybiB3aW5kb3cub3BlbihcbiAgICAgICAgdGhpcy50YXJnZXQuc3JjT3JpZ2luYWwgfHwgZS5jdXJyZW50VGFyZ2V0LnNyYyxcbiAgICAgICAgJ19ibGFuaydcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMuc2hvd24pIHtcbiAgICAgICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgICAgICB0aGlzLmNsb3NlKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlbGVhc2UoKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9wZW4oZS5jdXJyZW50VGFyZ2V0KVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzY3JvbGwoKSB7XG4gICAgY29uc3QgZWwgPVxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50IHx8IGRvY3VtZW50LmJvZHkucGFyZW50Tm9kZSB8fCBkb2N1bWVudC5ib2R5XG4gICAgY29uc3Qgc2Nyb2xsTGVmdCA9IHdpbmRvdy5wYWdlWE9mZnNldCB8fCBlbC5zY3JvbGxMZWZ0XG4gICAgY29uc3Qgc2Nyb2xsVG9wID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8IGVsLnNjcm9sbFRvcFxuXG4gICAgaWYgKHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID09PSBudWxsKSB7XG4gICAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IHtcbiAgICAgICAgeDogc2Nyb2xsTGVmdCxcbiAgICAgICAgeTogc2Nyb2xsVG9wXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZGVsdGFYID0gdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24ueCAtIHNjcm9sbExlZnRcbiAgICBjb25zdCBkZWx0YVkgPSB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbi55IC0gc2Nyb2xsVG9wXG4gICAgY29uc3QgdGhyZXNob2xkID0gdGhpcy5vcHRpb25zLnNjcm9sbFRocmVzaG9sZFxuXG4gICAgaWYgKE1hdGguYWJzKGRlbHRhWSkgPj0gdGhyZXNob2xkIHx8IE1hdGguYWJzKGRlbHRhWCkgPj0gdGhyZXNob2xkKSB7XG4gICAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH1cbiAgfSxcblxuICBrZXlkb3duKGUpIHtcbiAgICBpZiAoaXNFc2NhcGUoZSkpIHtcbiAgICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICAgIHRoaXMuY2xvc2UoKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWxlYXNlKHRoaXMuY2xvc2UpXG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIG1vdXNlZG93bihlKSB7XG4gICAgaWYgKCFpc0xlZnRCdXR0b24oZSkgfHwgaXNQcmVzc2luZ01ldGFLZXkoZSkpIHJldHVyblxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dChcbiAgICAgIGZ1bmN0aW9uIGdyYWJPbk1vdXNlRG93bigpIHtcbiAgICAgICAgdGhpcy5ncmFiKGNsaWVudFgsIGNsaWVudFkpXG4gICAgICB9LmJpbmQodGhpcyksXG4gICAgICBQUkVTU19ERUxBWVxuICAgIClcbiAgfSxcblxuICBtb3VzZW1vdmUoZSkge1xuICAgIGlmICh0aGlzLnJlbGVhc2VkKSByZXR1cm5cbiAgICB0aGlzLm1vdmUoZS5jbGllbnRYLCBlLmNsaWVudFkpXG4gIH0sXG5cbiAgbW91c2V1cChlKSB7XG4gICAgaWYgKCFpc0xlZnRCdXR0b24oZSkgfHwgaXNQcmVzc2luZ01ldGFLZXkoZSkpIHJldHVyblxuICAgIGNsZWFyVGltZW91dCh0aGlzLnByZXNzVGltZXIpXG5cbiAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVsZWFzZSgpXG4gICAgfVxuICB9LFxuXG4gIHRvdWNoc3RhcnQoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZS50b3VjaGVzWzBdXG5cbiAgICB0aGlzLnByZXNzVGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgZnVuY3Rpb24gZ3JhYk9uVG91Y2hTdGFydCgpIHtcbiAgICAgICAgdGhpcy5ncmFiKGNsaWVudFgsIGNsaWVudFkpXG4gICAgICB9LmJpbmQodGhpcyksXG4gICAgICBQUkVTU19ERUxBWVxuICAgIClcbiAgfSxcblxuICB0b3VjaG1vdmUoZSkge1xuICAgIGlmICh0aGlzLnJlbGVhc2VkKSByZXR1cm5cblxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZS50b3VjaGVzWzBdXG4gICAgdGhpcy5tb3ZlKGNsaWVudFgsIGNsaWVudFkpXG4gIH0sXG5cbiAgdG91Y2hlbmQoZSkge1xuICAgIGlmIChpc1RvdWNoaW5nKGUpKSByZXR1cm5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuXG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlbGVhc2UoKVxuICAgIH1cbiAgfSxcblxuICBjbGlja092ZXJsYXkoKSB7XG4gICAgdGhpcy5jbG9zZSgpXG4gIH0sXG5cbiAgcmVzaXplV2luZG93KCkge1xuICAgIHRoaXMuY2xvc2UoKVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzTGVmdEJ1dHRvbihlKSB7XG4gIHJldHVybiBlLmJ1dHRvbiA9PT0gMFxufVxuXG5mdW5jdGlvbiBpc1ByZXNzaW5nTWV0YUtleShlKSB7XG4gIHJldHVybiBlLm1ldGFLZXkgfHwgZS5jdHJsS2V5XG59XG5cbmZ1bmN0aW9uIGlzVG91Y2hpbmcoZSkge1xuICBlLnRhcmdldFRvdWNoZXMubGVuZ3RoID4gMFxufVxuXG5mdW5jdGlvbiBpc0VzY2FwZShlKSB7XG4gIGNvbnN0IGNvZGUgPSBlLmtleSB8fCBlLmNvZGVcbiAgcmV0dXJuIGNvZGUgPT09ICdFc2NhcGUnIHx8IGUua2V5Q29kZSA9PT0gMjdcbn1cbiIsImltcG9ydCB7IGxpc3Rlbiwgc2V0U3R5bGUgfSBmcm9tICcuL3V0aWxzJ1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQoaW5zdGFuY2UpIHtcbiAgICB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2VcbiAgICB0aGlzLnBhcmVudCA9IGRvY3VtZW50LmJvZHlcblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgdG9wOiAwLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHJpZ2h0OiAwLFxuICAgICAgYm90dG9tOiAwLFxuICAgICAgb3BhY2l0eTogMFxuICAgIH0pXG5cbiAgICB0aGlzLnVwZGF0ZVN0eWxlKGluc3RhbmNlLm9wdGlvbnMpXG4gICAgbGlzdGVuKHRoaXMuZWwsICdjbGljaycsIGluc3RhbmNlLmhhbmRsZXIuY2xpY2tPdmVybGF5LmJpbmQoaW5zdGFuY2UpKVxuICB9LFxuXG4gIHVwZGF0ZVN0eWxlKG9wdGlvbnMpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICB6SW5kZXg6IG9wdGlvbnMuekluZGV4LFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBvcHRpb25zLmJnQ29sb3IsXG4gICAgICB0cmFuc2l0aW9uOiBgb3BhY2l0eVxuICAgICAgICAke29wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9ufXNcbiAgICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gXG4gICAgfSlcbiAgfSxcblxuICBpbnNlcnQoKSB7XG4gICAgdGhpcy5wYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5lbClcbiAgfSxcblxuICByZW1vdmUoKSB7XG4gICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5lbClcbiAgfSxcblxuICBmYWRlSW4oKSB7XG4gICAgdGhpcy5lbC5vZmZzZXRXaWR0aFxuICAgIHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9ucy5iZ09wYWNpdHlcbiAgfSxcblxuICBmYWRlT3V0KCkge1xuICAgIHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IDBcbiAgfVxufVxuIiwiaW1wb3J0IHsgY3Vyc29yLCBzZXRTdHlsZSwgZ2V0T3JpZ2luYWxTb3VyY2UgfSBmcm9tICcuL3V0aWxzJ1xuXG4vLyBUcmFuc2xhdGUgei1heGlzIHRvIGZpeCBDU1MgZ3JpZCBkaXNwbGF5IGlzc3VlIGluIENocm9tZTpcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9raW5nZGlkbzk5OS96b29taW5nL2lzc3Vlcy80MlxuY29uc3QgVFJBTlNMQVRFX1ogPSAwXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdChlbCwgaW5zdGFuY2UpIHtcbiAgICB0aGlzLmVsID0gZWxcbiAgICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2VcbiAgICB0aGlzLnNyY1RodW1ibmFpbCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdzcmMnKVxuICAgIHRoaXMuc3Jjc2V0ID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ3NyY3NldCcpXG4gICAgdGhpcy5zcmNPcmlnaW5hbCA9IGdldE9yaWdpbmFsU291cmNlKHRoaXMuZWwpXG4gICAgdGhpcy5yZWN0ID0gdGhpcy5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgIHRoaXMudHJhbnNsYXRlID0gbnVsbFxuICAgIHRoaXMuc2NhbGUgPSBudWxsXG4gICAgdGhpcy5zdHlsZU9wZW4gPSBudWxsXG4gICAgdGhpcy5zdHlsZUNsb3NlID0gbnVsbFxuICB9LFxuXG4gIHpvb21JbigpIHtcbiAgICBjb25zdCB7XG4gICAgICB6SW5kZXgsXG4gICAgICBlbmFibGVHcmFiLFxuICAgICAgdHJhbnNpdGlvbkR1cmF0aW9uLFxuICAgICAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgfSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9uc1xuICAgIHRoaXMudHJhbnNsYXRlID0gdGhpcy5jYWxjdWxhdGVUcmFuc2xhdGUoKVxuICAgIHRoaXMuc2NhbGUgPSB0aGlzLmNhbGN1bGF0ZVNjYWxlKClcblxuICAgIHRoaXMuc3R5bGVPcGVuID0ge1xuICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgICB6SW5kZXg6IHpJbmRleCArIDEsXG4gICAgICBjdXJzb3I6IGVuYWJsZUdyYWIgPyBjdXJzb3IuZ3JhYiA6IGN1cnNvci56b29tT3V0LFxuICAgICAgdHJhbnNpdGlvbjogYHRyYW5zZm9ybVxuICAgICAgICAke3RyYW5zaXRpb25EdXJhdGlvbn1zXG4gICAgICAgICR7dHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9ufWAsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUzZCgke3RoaXMudHJhbnNsYXRlLnh9cHgsICR7XG4gICAgICAgIHRoaXMudHJhbnNsYXRlLnlcbiAgICAgIH1weCwgJHtUUkFOU0xBVEVfWn1weClcbiAgICAgICAgc2NhbGUoJHt0aGlzLnNjYWxlLnh9LCR7dGhpcy5zY2FsZS55fSlgLFxuICAgICAgaGVpZ2h0OiBgJHt0aGlzLnJlY3QuaGVpZ2h0fXB4YCxcbiAgICAgIHdpZHRoOiBgJHt0aGlzLnJlY3Qud2lkdGh9cHhgXG4gICAgfVxuXG4gICAgLy8gRm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcblxuICAgIC8vIFRyaWdnZXIgdHJhbnNpdGlvblxuICAgIHRoaXMuc3R5bGVDbG9zZSA9IHNldFN0eWxlKHRoaXMuZWwsIHRoaXMuc3R5bGVPcGVuLCB0cnVlKVxuICB9LFxuXG4gIHpvb21PdXQoKSB7XG4gICAgLy8gRm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHsgdHJhbnNmb3JtOiAnbm9uZScgfSlcbiAgfSxcblxuICBncmFiKHgsIHksIHNjYWxlRXh0cmEpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IFtkeCwgZHldID0gW3dpbmRvd0NlbnRlci54IC0geCwgd2luZG93Q2VudGVyLnkgLSB5XVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgY3Vyc29yOiBjdXJzb3IubW92ZSxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZTNkKFxuICAgICAgICAke3RoaXMudHJhbnNsYXRlLnggKyBkeH1weCwgJHt0aGlzLnRyYW5zbGF0ZS55ICtcbiAgICAgICAgZHl9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54ICsgc2NhbGVFeHRyYX0sJHt0aGlzLnNjYWxlLnkgKyBzY2FsZUV4dHJhfSlgXG4gICAgfSlcbiAgfSxcblxuICBtb3ZlKHgsIHksIHNjYWxlRXh0cmEpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IFtkeCwgZHldID0gW3dpbmRvd0NlbnRlci54IC0geCwgd2luZG93Q2VudGVyLnkgLSB5XVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgdHJhbnNpdGlvbjogJ3RyYW5zZm9ybScsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUzZChcbiAgICAgICAgJHt0aGlzLnRyYW5zbGF0ZS54ICsgZHh9cHgsICR7dGhpcy50cmFuc2xhdGUueSArXG4gICAgICAgIGR5fXB4LCAke1RSQU5TTEFURV9afXB4KVxuICAgICAgICBzY2FsZSgke3RoaXMuc2NhbGUueCArIHNjYWxlRXh0cmF9LCR7dGhpcy5zY2FsZS55ICsgc2NhbGVFeHRyYX0pYFxuICAgIH0pXG4gIH0sXG5cbiAgcmVzdG9yZUNsb3NlU3R5bGUoKSB7XG4gICAgc2V0U3R5bGUodGhpcy5lbCwgdGhpcy5zdHlsZUNsb3NlKVxuICB9LFxuXG4gIHJlc3RvcmVPcGVuU3R5bGUoKSB7XG4gICAgc2V0U3R5bGUodGhpcy5lbCwgdGhpcy5zdHlsZU9wZW4pXG4gIH0sXG5cbiAgdXBncmFkZVNvdXJjZSgpIHtcbiAgICBpZiAodGhpcy5zcmNPcmlnaW5hbCkge1xuICAgICAgY29uc3QgcGFyZW50Tm9kZSA9IHRoaXMuZWwucGFyZW50Tm9kZVxuXG4gICAgICBpZiAodGhpcy5zcmNzZXQpIHtcbiAgICAgICAgdGhpcy5lbC5yZW1vdmVBdHRyaWJ1dGUoJ3NyY3NldCcpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRlbXAgPSB0aGlzLmVsLmNsb25lTm9kZShmYWxzZSlcblxuICAgICAgLy8gRm9yY2UgY29tcHV0ZSB0aGUgaGktcmVzIGltYWdlIGluIERPTSB0byBwcmV2ZW50XG4gICAgICAvLyBpbWFnZSBmbGlja2VyaW5nIHdoaWxlIHVwZGF0aW5nIHNyY1xuICAgICAgdGVtcC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjT3JpZ2luYWwpXG4gICAgICB0ZW1wLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJ1xuICAgICAgdGVtcC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbidcbiAgICAgIHBhcmVudE5vZGUuYXBwZW5kQ2hpbGQodGVtcClcblxuICAgICAgLy8gQWRkIGRlbGF5IHRvIHByZXZlbnQgRmlyZWZveCBmcm9tIGZsaWNrZXJpbmdcbiAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgIGZ1bmN0aW9uIHVwZGF0ZVNyYygpIHtcbiAgICAgICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNPcmlnaW5hbClcbiAgICAgICAgICBwYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRlbXApXG4gICAgICAgIH0uYmluZCh0aGlzKSxcbiAgICAgICAgNTBcbiAgICAgIClcbiAgICB9XG4gIH0sXG5cbiAgZG93bmdyYWRlU291cmNlKCkge1xuICAgIGlmICh0aGlzLnNyY09yaWdpbmFsKSB7XG4gICAgICBpZiAodGhpcy5zcmNzZXQpIHtcbiAgICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3NyY3NldCcsIHRoaXMuc3Jjc2V0KVxuICAgICAgfVxuICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjVGh1bWJuYWlsKVxuICAgIH1cbiAgfSxcblxuICBjYWxjdWxhdGVUcmFuc2xhdGUoKSB7XG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcbiAgICBjb25zdCB0YXJnZXRDZW50ZXIgPSB7XG4gICAgICB4OiB0aGlzLnJlY3QubGVmdCArIHRoaXMucmVjdC53aWR0aCAvIDIsXG4gICAgICB5OiB0aGlzLnJlY3QudG9wICsgdGhpcy5yZWN0LmhlaWdodCAvIDJcbiAgICB9XG5cbiAgICAvLyBUaGUgdmVjdG9yIHRvIHRyYW5zbGF0ZSBpbWFnZSB0byB0aGUgd2luZG93IGNlbnRlclxuICAgIHJldHVybiB7XG4gICAgICB4OiB3aW5kb3dDZW50ZXIueCAtIHRhcmdldENlbnRlci54LFxuICAgICAgeTogd2luZG93Q2VudGVyLnkgLSB0YXJnZXRDZW50ZXIueVxuICAgIH1cbiAgfSxcblxuICBjYWxjdWxhdGVTY2FsZSgpIHtcbiAgICBjb25zdCB7IHpvb21pbmdIZWlnaHQsIHpvb21pbmdXaWR0aCB9ID0gdGhpcy5lbC5kYXRhc2V0XG4gICAgY29uc3QgeyBjdXN0b21TaXplLCBzY2FsZUJhc2UgfSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9uc1xuXG4gICAgaWYgKCFjdXN0b21TaXplICYmIHpvb21pbmdIZWlnaHQgJiYgem9vbWluZ1dpZHRoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiB6b29taW5nV2lkdGggLyB0aGlzLnJlY3Qud2lkdGgsXG4gICAgICAgIHk6IHpvb21pbmdIZWlnaHQgLyB0aGlzLnJlY3QuaGVpZ2h0XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjdXN0b21TaXplICYmIHR5cGVvZiBjdXN0b21TaXplID09PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogY3VzdG9tU2l6ZS53aWR0aCAvIHRoaXMucmVjdC53aWR0aCxcbiAgICAgICAgeTogY3VzdG9tU2l6ZS5oZWlnaHQgLyB0aGlzLnJlY3QuaGVpZ2h0XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRhcmdldEhhbGZXaWR0aCA9IHRoaXMucmVjdC53aWR0aCAvIDJcbiAgICAgIGNvbnN0IHRhcmdldEhhbGZIZWlnaHQgPSB0aGlzLnJlY3QuaGVpZ2h0IC8gMlxuICAgICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcblxuICAgICAgLy8gVGhlIGRpc3RhbmNlIGJldHdlZW4gdGFyZ2V0IGVkZ2UgYW5kIHdpbmRvdyBlZGdlXG4gICAgICBjb25zdCB0YXJnZXRFZGdlVG9XaW5kb3dFZGdlID0ge1xuICAgICAgICB4OiB3aW5kb3dDZW50ZXIueCAtIHRhcmdldEhhbGZXaWR0aCxcbiAgICAgICAgeTogd2luZG93Q2VudGVyLnkgLSB0YXJnZXRIYWxmSGVpZ2h0XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNjYWxlSG9yaXpvbnRhbGx5ID0gdGFyZ2V0RWRnZVRvV2luZG93RWRnZS54IC8gdGFyZ2V0SGFsZldpZHRoXG4gICAgICBjb25zdCBzY2FsZVZlcnRpY2FsbHkgPSB0YXJnZXRFZGdlVG9XaW5kb3dFZGdlLnkgLyB0YXJnZXRIYWxmSGVpZ2h0XG5cbiAgICAgIC8vIFRoZSBhZGRpdGlvbmFsIHNjYWxlIGlzIGJhc2VkIG9uIHRoZSBzbWFsbGVyIHZhbHVlIG9mXG4gICAgICAvLyBzY2FsaW5nIGhvcml6b250YWxseSBhbmQgc2NhbGluZyB2ZXJ0aWNhbGx5XG4gICAgICBjb25zdCBzY2FsZSA9IHNjYWxlQmFzZSArIE1hdGgubWluKHNjYWxlSG9yaXpvbnRhbGx5LCBzY2FsZVZlcnRpY2FsbHkpXG5cbiAgICAgIGlmIChjdXN0b21TaXplICYmIHR5cGVvZiBjdXN0b21TaXplID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBVc2Ugem9vbWluZ1dpZHRoIGFuZCB6b29taW5nSGVpZ2h0IGlmIGF2YWlsYWJsZVxuICAgICAgICBjb25zdCBuYXR1cmFsV2lkdGggPSB6b29taW5nV2lkdGggfHwgdGhpcy5lbC5uYXR1cmFsV2lkdGhcbiAgICAgICAgY29uc3QgbmF0dXJhbEhlaWdodCA9IHpvb21pbmdIZWlnaHQgfHwgdGhpcy5lbC5uYXR1cmFsSGVpZ2h0XG4gICAgICAgIGNvbnN0IG1heFpvb21pbmdXaWR0aCA9XG4gICAgICAgICAgcGFyc2VGbG9hdChjdXN0b21TaXplKSAqIG5hdHVyYWxXaWR0aCAvICgxMDAgKiB0aGlzLnJlY3Qud2lkdGgpXG4gICAgICAgIGNvbnN0IG1heFpvb21pbmdIZWlnaHQgPVxuICAgICAgICAgIHBhcnNlRmxvYXQoY3VzdG9tU2l6ZSkgKiBuYXR1cmFsSGVpZ2h0IC8gKDEwMCAqIHRoaXMucmVjdC5oZWlnaHQpXG5cbiAgICAgICAgLy8gT25seSBzY2FsZSBpbWFnZSB1cCB0byB0aGUgc3BlY2lmaWVkIGN1c3RvbVNpemUgcGVyY2VudGFnZVxuICAgICAgICBpZiAoc2NhbGUgPiBtYXhab29taW5nV2lkdGggfHwgc2NhbGUgPiBtYXhab29taW5nSGVpZ2h0KSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IG1heFpvb21pbmdXaWR0aCxcbiAgICAgICAgICAgIHk6IG1heFpvb21pbmdIZWlnaHRcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogc2NhbGUsXG4gICAgICAgIHk6IHNjYWxlXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldFdpbmRvd0NlbnRlcigpIHtcbiAgY29uc3QgZG9jRWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcbiAgY29uc3Qgd2luZG93V2lkdGggPSBNYXRoLm1pbihkb2NFbC5jbGllbnRXaWR0aCwgd2luZG93LmlubmVyV2lkdGgpXG4gIGNvbnN0IHdpbmRvd0hlaWdodCA9IE1hdGgubWluKGRvY0VsLmNsaWVudEhlaWdodCwgd2luZG93LmlubmVySGVpZ2h0KVxuXG4gIHJldHVybiB7XG4gICAgeDogd2luZG93V2lkdGggLyAyLFxuICAgIHk6IHdpbmRvd0hlaWdodCAvIDJcbiAgfVxufVxuIiwiaW1wb3J0IHsgY3Vyc29yLCBsaXN0ZW4sIGxvYWRJbWFnZSwgZ2V0T3JpZ2luYWxTb3VyY2UgfSBmcm9tICcuL3V0aWxzJ1xuaW1wb3J0IERFRkFVTFRfT1BUSU9OUyBmcm9tICcuL29wdGlvbnMnXG5cbmltcG9ydCBoYW5kbGVyIGZyb20gJy4vaGFuZGxlcidcbmltcG9ydCBvdmVybGF5IGZyb20gJy4vb3ZlcmxheSdcbmltcG9ydCB0YXJnZXQgZnJvbSAnLi90YXJnZXQnXG5cbi8qKlxuICogWm9vbWluZyBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFVwZGF0ZSBkZWZhdWx0IG9wdGlvbnMgaWYgcHJvdmlkZWQuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy50YXJnZXQgPSBPYmplY3QuY3JlYXRlKHRhcmdldClcbiAgICB0aGlzLm92ZXJsYXkgPSBPYmplY3QuY3JlYXRlKG92ZXJsYXkpXG4gICAgdGhpcy5oYW5kbGVyID0gT2JqZWN0LmNyZWF0ZShoYW5kbGVyKVxuICAgIHRoaXMuYm9keSA9IGRvY3VtZW50LmJvZHlcblxuICAgIHRoaXMuc2hvd24gPSBmYWxzZVxuICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgdGhpcy5yZWxlYXNlZCA9IHRydWVcbiAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcbiAgICB0aGlzLnByZXNzVGltZXIgPSBudWxsXG5cbiAgICB0aGlzLm9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX09QVElPTlMsIG9wdGlvbnMpXG4gICAgdGhpcy5vdmVybGF5LmluaXQodGhpcylcbiAgICB0aGlzLmhhbmRsZXIuaW5pdCh0aGlzKVxuICB9XG5cbiAgLyoqXG4gICAqIE1ha2UgZWxlbWVudChzKSB6b29tYWJsZS5cbiAgICogQHBhcmFtICB7c3RyaW5nfEVsZW1lbnR9IGVsIEEgY3NzIHNlbGVjdG9yIG9yIGFuIEVsZW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBsaXN0ZW4oZWwpIHtcbiAgICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbClcbiAgICAgIGxldCBpID0gZWxzLmxlbmd0aFxuXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMubGlzdGVuKGVsc1tpXSlcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVsLnRhZ05hbWUgPT09ICdJTUcnKSB7XG4gICAgICBlbC5zdHlsZS5jdXJzb3IgPSBjdXJzb3Iuem9vbUluXG4gICAgICBsaXN0ZW4oZWwsICdjbGljaycsIHRoaXMuaGFuZGxlci5jbGljaylcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5wcmVsb2FkSW1hZ2UpIHtcbiAgICAgICAgbG9hZEltYWdlKGdldE9yaWdpbmFsU291cmNlKGVsKSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBvcHRpb25zIG9yIHJldHVybiBjdXJyZW50IG9wdGlvbnMgaWYgbm8gYXJndW1lbnQgaXMgcHJvdmlkZWQuXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyBBbiBPYmplY3QgdGhhdCBjb250YWlucyB0aGlzLm9wdGlvbnMuXG4gICAqIEByZXR1cm4ge3RoaXN8dGhpcy5vcHRpb25zfVxuICAgKi9cbiAgY29uZmlnKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucykge1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLm9wdGlvbnMsIG9wdGlvbnMpXG4gICAgICB0aGlzLm92ZXJsYXkudXBkYXRlU3R5bGUodGhpcy5vcHRpb25zKVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMub3B0aW9uc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPcGVuICh6b29tIGluKSB0aGUgRWxlbWVudC5cbiAgICogQHBhcmFtICB7RWxlbWVudH0gZWwgVGhlIEVsZW1lbnQgdG8gb3Blbi5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25PcGVuXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbFxuICAgKiBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBvcGVuZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldFxuICAgKiB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgb3BlbihlbCwgY2IgPSB0aGlzLm9wdGlvbnMub25PcGVuKSB7XG4gICAgaWYgKHRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKSA6IGVsXG5cbiAgICBpZiAodGFyZ2V0LnRhZ05hbWUgIT09ICdJTUcnKSByZXR1cm5cblxuICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4odGFyZ2V0KVxuXG4gICAgdGhpcy50YXJnZXQuaW5pdCh0YXJnZXQsIHRoaXMpXG5cbiAgICBpZiAoIXRoaXMub3B0aW9ucy5wcmVsb2FkSW1hZ2UpIHtcbiAgICAgIGNvbnN0IHsgc3JjT3JpZ2luYWwgfSA9IHRoaXMudGFyZ2V0XG5cbiAgICAgIGlmIChzcmNPcmlnaW5hbCAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5vbkltYWdlTG9hZGluZyh0YXJnZXQpXG4gICAgICAgIGxvYWRJbWFnZShzcmNPcmlnaW5hbCwgdGhpcy5vcHRpb25zLm9uSW1hZ2VMb2FkZWQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5zaG93biA9IHRydWVcbiAgICB0aGlzLmxvY2sgPSB0cnVlXG5cbiAgICB0aGlzLnRhcmdldC56b29tSW4oKVxuICAgIHRoaXMub3ZlcmxheS5pbnNlcnQoKVxuICAgIHRoaXMub3ZlcmxheS5mYWRlSW4oKVxuXG4gICAgbGlzdGVuKGRvY3VtZW50LCAnc2Nyb2xsJywgdGhpcy5oYW5kbGVyLnNjcm9sbClcbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5oYW5kbGVyLmtleWRvd24pXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25XaW5kb3dSZXNpemUpIHtcbiAgICAgIGxpc3Rlbih3aW5kb3csICdyZXNpemUnLCB0aGlzLmhhbmRsZXIucmVzaXplV2luZG93KVxuICAgIH1cblxuICAgIGNvbnN0IG9uT3BlbkVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsICd0cmFuc2l0aW9uZW5kJywgb25PcGVuRW5kLCBmYWxzZSlcbiAgICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgICB0aGlzLnRhcmdldC51cGdyYWRlU291cmNlKClcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lbmFibGVHcmFiKSB7XG4gICAgICAgIHRvZ2dsZUdyYWJMaXN0ZW5lcnMoZG9jdW1lbnQsIHRoaXMuaGFuZGxlciwgdHJ1ZSlcbiAgICAgIH1cblxuICAgICAgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsICd0cmFuc2l0aW9uZW5kJywgb25PcGVuRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZSAoem9vbSBvdXQpIHRoZSBFbGVtZW50IGN1cnJlbnRseSBvcGVuZWQuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uQ2xvc2VdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsXG4gICAqIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIGNsb3NlZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0IHdpbGwgZ2V0XG4gICAqIHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBjbG9zZShjYiA9IHRoaXMub3B0aW9ucy5vbkNsb3NlKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UodGFyZ2V0KVxuXG4gICAgdGhpcy5sb2NrID0gdHJ1ZVxuICAgIHRoaXMuYm9keS5zdHlsZS5jdXJzb3IgPSBjdXJzb3IuZGVmYXVsdFxuICAgIHRoaXMub3ZlcmxheS5mYWRlT3V0KClcbiAgICB0aGlzLnRhcmdldC56b29tT3V0KClcblxuICAgIGxpc3Rlbihkb2N1bWVudCwgJ3Njcm9sbCcsIHRoaXMuaGFuZGxlci5zY3JvbGwsIGZhbHNlKVxuICAgIGxpc3Rlbihkb2N1bWVudCwgJ2tleWRvd24nLCB0aGlzLmhhbmRsZXIua2V5ZG93biwgZmFsc2UpXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25XaW5kb3dSZXNpemUpIHtcbiAgICAgIGxpc3Rlbih3aW5kb3csICdyZXNpemUnLCB0aGlzLmhhbmRsZXIucmVzaXplV2luZG93LCBmYWxzZSlcbiAgICB9XG5cbiAgICBjb25zdCBvbkNsb3NlRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgJ3RyYW5zaXRpb25lbmQnLCBvbkNsb3NlRW5kLCBmYWxzZSlcblxuICAgICAgdGhpcy5zaG93biA9IGZhbHNlXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuXG4gICAgICB0aGlzLnRhcmdldC5kb3duZ3JhZGVTb3VyY2UoKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHtcbiAgICAgICAgdG9nZ2xlR3JhYkxpc3RlbmVycyhkb2N1bWVudCwgdGhpcy5oYW5kbGVyLCBmYWxzZSlcbiAgICAgIH1cblxuICAgICAgdGhpcy50YXJnZXQucmVzdG9yZUNsb3NlU3R5bGUoKVxuICAgICAgdGhpcy5vdmVybGF5LnJlbW92ZSgpXG5cbiAgICAgIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCAndHJhbnNpdGlvbmVuZCcsIG9uQ2xvc2VFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEdyYWIgdGhlIEVsZW1lbnQgY3VycmVudGx5IG9wZW5lZCBnaXZlbiBhIHBvc2l0aW9uIGFuZCBhcHBseSBleHRyYSB6b29tLWluLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeCBUaGUgWC1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHkgVGhlIFktYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICBzY2FsZUV4dHJhIEV4dHJhIHpvb20taW4gdG8gYXBwbHkuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uR3JhYl0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgZ3JhYmJlZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0XG4gICAqIHdpbGwgZ2V0IHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBncmFiKHgsIHksIHNjYWxlRXh0cmEgPSB0aGlzLm9wdGlvbnMuc2NhbGVFeHRyYSwgY2IgPSB0aGlzLm9wdGlvbnMub25HcmFiKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYih0YXJnZXQpXG5cbiAgICB0aGlzLnJlbGVhc2VkID0gZmFsc2VcbiAgICB0aGlzLnRhcmdldC5ncmFiKHgsIHksIHNjYWxlRXh0cmEpXG5cbiAgICBjb25zdCBvbkdyYWJFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCAndHJhbnNpdGlvbmVuZCcsIG9uR3JhYkVuZCwgZmFsc2UpXG4gICAgICBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgJ3RyYW5zaXRpb25lbmQnLCBvbkdyYWJFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIE1vdmUgdGhlIEVsZW1lbnQgY3VycmVudGx5IGdyYWJiZWQgZ2l2ZW4gYSBwb3NpdGlvbiBhbmQgYXBwbHkgZXh0cmEgem9vbS1pbi5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHggVGhlIFgtYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB5IFRoZSBZLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgc2NhbGVFeHRyYSBFeHRyYSB6b29tLWluIHRvIGFwcGx5LlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbk1vdmVdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG1vdmVkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbFxuICAgKiBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIG1vdmUoeCwgeSwgc2NhbGVFeHRyYSA9IHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhLCBjYiA9IHRoaXMub3B0aW9ucy5vbk1vdmUpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIHRoaXMucmVsZWFzZWQgPSBmYWxzZVxuICAgIHRoaXMuYm9keS5zdHlsZS5jdXJzb3IgPSBjdXJzb3IubW92ZVxuICAgIHRoaXMudGFyZ2V0Lm1vdmUoeCwgeSwgc2NhbGVFeHRyYSlcblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBjb25zdCBvbk1vdmVFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCAndHJhbnNpdGlvbmVuZCcsIG9uTW92ZUVuZCwgZmFsc2UpXG4gICAgICBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgJ3RyYW5zaXRpb25lbmQnLCBvbk1vdmVFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbGVhc2UgdGhlIEVsZW1lbnQgY3VycmVudGx5IGdyYWJiZWQuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uUmVsZWFzZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgcmVsZWFzZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdFxuICAgKiB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgcmVsZWFzZShjYiA9IHRoaXMub3B0aW9ucy5vblJlbGVhc2UpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICB0aGlzLm9wdGlvbnMub25CZWZvcmVSZWxlYXNlKHRhcmdldClcblxuICAgIHRoaXMubG9jayA9IHRydWVcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLmRlZmF1bHRcbiAgICB0aGlzLnRhcmdldC5yZXN0b3JlT3BlblN0eWxlKClcblxuICAgIGNvbnN0IG9uUmVsZWFzZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsICd0cmFuc2l0aW9uZW5kJywgb25SZWxlYXNlRW5kLCBmYWxzZSlcbiAgICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgICB0aGlzLnJlbGVhc2VkID0gdHJ1ZVxuICAgICAgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsICd0cmFuc2l0aW9uZW5kJywgb25SZWxlYXNlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVHcmFiTGlzdGVuZXJzKGVsLCBoYW5kbGVyLCBhZGQpIHtcbiAgY29uc3QgdHlwZXMgPSBbXG4gICAgJ21vdXNlZG93bicsXG4gICAgJ21vdXNlbW92ZScsXG4gICAgJ21vdXNldXAnLFxuICAgICd0b3VjaHN0YXJ0JyxcbiAgICAndG91Y2htb3ZlJyxcbiAgICAndG91Y2hlbmQnXG4gIF1cblxuICB0eXBlcy5mb3JFYWNoKGZ1bmN0aW9uIHRvZ2dsZUxpc3RlbmVyKHR5cGUpIHtcbiAgICBsaXN0ZW4oZWwsIHR5cGUsIGhhbmRsZXJbdHlwZV0sIGFkZClcbiAgfSlcbn1cbiJdLCJuYW1lcyI6WyJjdXJzb3IiLCJkZWZhdWx0Iiwiem9vbUluIiwiem9vbU91dCIsImdyYWIiLCJtb3ZlIiwibGlzdGVuIiwiZWwiLCJldmVudCIsImhhbmRsZXIiLCJhZGQiLCJvcHRpb25zIiwicGFzc2l2ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwibG9hZEltYWdlIiwic3JjIiwiY2IiLCJpbWciLCJJbWFnZSIsIm9ubG9hZCIsIm9uSW1hZ2VMb2FkIiwiZ2V0T3JpZ2luYWxTb3VyY2UiLCJkYXRhc2V0Iiwib3JpZ2luYWwiLCJwYXJlbnROb2RlIiwidGFnTmFtZSIsImdldEF0dHJpYnV0ZSIsInNldFN0eWxlIiwic3R5bGVzIiwicmVtZW1iZXIiLCJ0cmFuc2l0aW9uIiwidmFsdWUiLCJ0cmFuc2Zvcm0iLCJzIiwic3R5bGUiLCJrZXkiLCJiaW5kQWxsIiwiX3RoaXMiLCJ0aGF0IiwibWV0aG9kcyIsIk9iamVjdCIsImdldE93blByb3BlcnR5TmFtZXMiLCJnZXRQcm90b3R5cGVPZiIsImZvckVhY2giLCJiaW5kT25lIiwibWV0aG9kIiwiYmluZCIsIm5vb3AiLCJlbmFibGVHcmFiIiwicHJlbG9hZEltYWdlIiwiY2xvc2VPbldpbmRvd1Jlc2l6ZSIsInRyYW5zaXRpb25EdXJhdGlvbiIsInRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbiIsImJnQ29sb3IiLCJiZ09wYWNpdHkiLCJzY2FsZUJhc2UiLCJzY2FsZUV4dHJhIiwic2Nyb2xsVGhyZXNob2xkIiwiekluZGV4IiwiY3VzdG9tU2l6ZSIsIm9uT3BlbiIsIm9uQ2xvc2UiLCJvbkdyYWIiLCJvbk1vdmUiLCJvblJlbGVhc2UiLCJvbkJlZm9yZU9wZW4iLCJvbkJlZm9yZUNsb3NlIiwib25CZWZvcmVHcmFiIiwib25CZWZvcmVSZWxlYXNlIiwib25JbWFnZUxvYWRpbmciLCJvbkltYWdlTG9hZGVkIiwiUFJFU1NfREVMQVkiLCJpbml0IiwiaW5zdGFuY2UiLCJjbGljayIsImUiLCJwcmV2ZW50RGVmYXVsdCIsImlzUHJlc3NpbmdNZXRhS2V5Iiwid2luZG93Iiwib3BlbiIsInRhcmdldCIsInNyY09yaWdpbmFsIiwiY3VycmVudFRhcmdldCIsInNob3duIiwicmVsZWFzZWQiLCJjbG9zZSIsInJlbGVhc2UiLCJzY3JvbGwiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsImJvZHkiLCJzY3JvbGxMZWZ0IiwicGFnZVhPZmZzZXQiLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImxhc3RTY3JvbGxQb3NpdGlvbiIsIngiLCJ5IiwiZGVsdGFYIiwiZGVsdGFZIiwidGhyZXNob2xkIiwiTWF0aCIsImFicyIsImtleWRvd24iLCJpc0VzY2FwZSIsIm1vdXNlZG93biIsImlzTGVmdEJ1dHRvbiIsImNsaWVudFgiLCJjbGllbnRZIiwicHJlc3NUaW1lciIsInNldFRpbWVvdXQiLCJncmFiT25Nb3VzZURvd24iLCJtb3VzZW1vdmUiLCJtb3VzZXVwIiwiY2xlYXJUaW1lb3V0IiwidG91Y2hzdGFydCIsInRvdWNoZXMiLCJncmFiT25Ub3VjaFN0YXJ0IiwidG91Y2htb3ZlIiwidG91Y2hlbmQiLCJpc1RvdWNoaW5nIiwiY2xpY2tPdmVybGF5IiwicmVzaXplV2luZG93IiwiYnV0dG9uIiwibWV0YUtleSIsImN0cmxLZXkiLCJ0YXJnZXRUb3VjaGVzIiwibGVuZ3RoIiwiY29kZSIsImtleUNvZGUiLCJjcmVhdGVFbGVtZW50IiwicGFyZW50IiwicG9zaXRpb24iLCJ0b3AiLCJsZWZ0IiwicmlnaHQiLCJib3R0b20iLCJvcGFjaXR5IiwidXBkYXRlU3R5bGUiLCJiYWNrZ3JvdW5kQ29sb3IiLCJpbnNlcnQiLCJhcHBlbmRDaGlsZCIsInJlbW92ZSIsInJlbW92ZUNoaWxkIiwiZmFkZUluIiwib2Zmc2V0V2lkdGgiLCJmYWRlT3V0IiwiVFJBTlNMQVRFX1oiLCJzcmNUaHVtYm5haWwiLCJzcmNzZXQiLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwidHJhbnNsYXRlIiwic2NhbGUiLCJzdHlsZU9wZW4iLCJzdHlsZUNsb3NlIiwiY2FsY3VsYXRlVHJhbnNsYXRlIiwiY2FsY3VsYXRlU2NhbGUiLCJoZWlnaHQiLCJ3aWR0aCIsIndpbmRvd0NlbnRlciIsImdldFdpbmRvd0NlbnRlciIsImR4IiwiZHkiLCJyZXN0b3JlQ2xvc2VTdHlsZSIsInJlc3RvcmVPcGVuU3R5bGUiLCJ1cGdyYWRlU291cmNlIiwicmVtb3ZlQXR0cmlidXRlIiwidGVtcCIsImNsb25lTm9kZSIsInNldEF0dHJpYnV0ZSIsInZpc2liaWxpdHkiLCJ1cGRhdGVTcmMiLCJkb3duZ3JhZGVTb3VyY2UiLCJ0YXJnZXRDZW50ZXIiLCJ6b29taW5nSGVpZ2h0Iiwiem9vbWluZ1dpZHRoIiwidGFyZ2V0SGFsZldpZHRoIiwidGFyZ2V0SGFsZkhlaWdodCIsInRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsIm1pbiIsIm5hdHVyYWxXaWR0aCIsIm5hdHVyYWxIZWlnaHQiLCJtYXhab29taW5nV2lkdGgiLCJwYXJzZUZsb2F0IiwibWF4Wm9vbWluZ0hlaWdodCIsImRvY0VsIiwid2luZG93V2lkdGgiLCJjbGllbnRXaWR0aCIsImlubmVyV2lkdGgiLCJ3aW5kb3dIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJpbm5lckhlaWdodCIsIlpvb21pbmciLCJjcmVhdGUiLCJvdmVybGF5IiwibG9jayIsImJhYmVsSGVscGVycy5leHRlbmRzIiwiREVGQVVMVF9PUFRJT05TIiwiZWxzIiwicXVlcnlTZWxlY3RvckFsbCIsImkiLCJxdWVyeVNlbGVjdG9yIiwib25PcGVuRW5kIiwidG9nZ2xlR3JhYkxpc3RlbmVycyIsIm9uQ2xvc2VFbmQiLCJvbkdyYWJFbmQiLCJvbk1vdmVFbmQiLCJvblJlbGVhc2VFbmQiLCJ0eXBlcyIsInRvZ2dsZUxpc3RlbmVyIiwidHlwZSJdLCJtYXBwaW5n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
