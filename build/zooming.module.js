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

export default Zooming;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9vbWluZy5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyIsIi4uL3NyYy9vcHRpb25zLmpzIiwiLi4vc3JjL2hhbmRsZXIuanMiLCIuLi9zcmMvb3ZlcmxheS5qcyIsIi4uL3NyYy90YXJnZXQuanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IGN1cnNvciA9IHtcbiAgZGVmYXVsdDogJ2F1dG8nLFxuICB6b29tSW46ICd6b29tLWluJyxcbiAgem9vbU91dDogJ3pvb20tb3V0JyxcbiAgZ3JhYjogJ2dyYWInLFxuICBtb3ZlOiAnbW92ZSdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RlbihlbCwgZXZlbnQsIGhhbmRsZXIsIGFkZCA9IHRydWUpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IHsgcGFzc2l2ZTogZmFsc2UgfVxuXG4gIGlmIChhZGQpIHtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyLCBvcHRpb25zKVxuICB9IGVsc2Uge1xuICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRJbWFnZShzcmMsIGNiKSB7XG4gIGlmIChzcmMpIHtcbiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKVxuXG4gICAgaW1nLm9ubG9hZCA9IGZ1bmN0aW9uIG9uSW1hZ2VMb2FkKCkge1xuICAgICAgaWYgKGNiKSBjYihpbWcpXG4gICAgfVxuXG4gICAgaW1nLnNyYyA9IHNyY1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPcmlnaW5hbFNvdXJjZShlbCkge1xuICBpZiAoZWwuZGF0YXNldC5vcmlnaW5hbCkge1xuICAgIHJldHVybiBlbC5kYXRhc2V0Lm9yaWdpbmFsXG4gIH0gZWxzZSBpZiAoZWwucGFyZW50Tm9kZS50YWdOYW1lID09PSAnQScpIHtcbiAgICByZXR1cm4gZWwucGFyZW50Tm9kZS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFN0eWxlKGVsLCBzdHlsZXMsIHJlbWVtYmVyKSB7XG4gIGlmIChzdHlsZXMudHJhbnNpdGlvbikge1xuICAgIGNvbnN0IHZhbHVlID0gc3R5bGVzLnRyYW5zaXRpb25cbiAgICBkZWxldGUgc3R5bGVzLnRyYW5zaXRpb25cbiAgICBzdHlsZXMudHJhbnNpdGlvbiA9IHZhbHVlXG4gIH1cblxuICBpZiAoc3R5bGVzLnRyYW5zZm9ybSkge1xuICAgIGNvbnN0IHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNmb3JtXG4gICAgc3R5bGVzLnRyYW5zZm9ybSA9IHZhbHVlXG4gIH1cblxuICBsZXQgcyA9IGVsLnN0eWxlXG4gIGxldCBvcmlnaW5hbCA9IHt9XG5cbiAgZm9yIChsZXQga2V5IGluIHN0eWxlcykge1xuICAgIGlmIChyZW1lbWJlcikge1xuICAgICAgb3JpZ2luYWxba2V5XSA9IHNba2V5XSB8fCAnJ1xuICAgIH1cblxuICAgIHNba2V5XSA9IHN0eWxlc1trZXldXG4gIH1cblxuICByZXR1cm4gb3JpZ2luYWxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmRBbGwoX3RoaXMsIHRoYXQpIHtcbiAgY29uc3QgbWV0aG9kcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKE9iamVjdC5nZXRQcm90b3R5cGVPZihfdGhpcykpXG4gIG1ldGhvZHMuZm9yRWFjaChmdW5jdGlvbiBiaW5kT25lKG1ldGhvZCkge1xuICAgIF90aGlzW21ldGhvZF0gPSBfdGhpc1ttZXRob2RdLmJpbmQodGhhdClcbiAgfSlcbn1cbiIsImNvbnN0IG5vb3AgPSAoKSA9PiB7fVxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIC8qKlxuICAgKiBUbyBiZSBhYmxlIHRvIGdyYWIgYW5kIGRyYWcgdGhlIGltYWdlIGZvciBleHRyYSB6b29tLWluLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIGVuYWJsZUdyYWI6IHRydWUsXG5cbiAgLyoqXG4gICAqIFByZWxvYWQgem9vbWFibGUgaW1hZ2VzLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIHByZWxvYWRJbWFnZTogZmFsc2UsXG5cbiAgLyoqXG4gICAqIENsb3NlIHRoZSB6b29tZWQgaW1hZ2Ugd2hlbiBicm93c2VyIHdpbmRvdyBpcyByZXNpemVkLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIGNsb3NlT25XaW5kb3dSZXNpemU6IHRydWUsXG5cbiAgLyoqXG4gICAqIFRyYW5zaXRpb24gZHVyYXRpb24gaW4gc2Vjb25kcy5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRyYW5zaXRpb25EdXJhdGlvbjogMC40LFxuXG4gIC8qKlxuICAgKiBUcmFuc2l0aW9uIHRpbWluZyBmdW5jdGlvbi5cbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbjogJ2N1YmljLWJlemllcigwLjQsIDAsIDAsIDEpJyxcblxuICAvKipcbiAgICogT3ZlcmxheSBiYWNrZ3JvdW5kIGNvbG9yLlxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgYmdDb2xvcjogJ3JnYigyNTUsIDI1NSwgMjU1KScsXG5cbiAgLyoqXG4gICAqIE92ZXJsYXkgYmFja2dyb3VuZCBvcGFjaXR5LlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgYmdPcGFjaXR5OiAxLFxuXG4gIC8qKlxuICAgKiBUaGUgYmFzZSBzY2FsZSBmYWN0b3IgZm9yIHpvb21pbmcuIEJ5IGRlZmF1bHQgc2NhbGUgdG8gZml0IHRoZSB3aW5kb3cuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY2FsZUJhc2U6IDEuMCxcblxuICAvKipcbiAgICogVGhlIGFkZGl0aW9uYWwgc2NhbGUgZmFjdG9yIHdoZW4gZ3JhYmJpbmcgdGhlIGltYWdlLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgc2NhbGVFeHRyYTogMC41LFxuXG4gIC8qKlxuICAgKiBIb3cgbXVjaCBzY3JvbGxpbmcgaXQgdGFrZXMgYmVmb3JlIGNsb3Npbmcgb3V0LlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgc2Nyb2xsVGhyZXNob2xkOiA0MCxcblxuICAvKipcbiAgICogVGhlIHotaW5kZXggdGhhdCB0aGUgb3ZlcmxheSB3aWxsIGJlIGFkZGVkIHdpdGguXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB6SW5kZXg6IDk5OCxcblxuICAvKipcbiAgICogU2NhbGUgKHpvb20gaW4pIHRvIGdpdmVuIHdpZHRoIGFuZCBoZWlnaHQuIElnbm9yZSBzY2FsZUJhc2UgaWYgc2V0LlxuICAgKiBBbHRlcm5hdGl2ZWx5LCBwcm92aWRlIGEgcGVyY2VudGFnZSB2YWx1ZSByZWxhdGl2ZSB0byB0aGUgb3JpZ2luYWwgaW1hZ2Ugc2l6ZS5cbiAgICogQHR5cGUge09iamVjdHxTdHJpbmd9XG4gICAqIEBleGFtcGxlXG4gICAqIGN1c3RvbVNpemU6IHsgd2lkdGg6IDgwMCwgaGVpZ2h0OiA0MDAgfVxuICAgKiBjdXN0b21TaXplOiAxMDAlXG4gICAqL1xuICBjdXN0b21TaXplOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBvcGVuZWQgYW5kXG4gICAqIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbk9wZW46IG5vb3AsXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIGNsb3NlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25DbG9zZTogbm9vcCxcblxuICAvKipcbiAgICogU2FtZSBhcyBhYm92ZSwgZXhjZXB0IGZpcmVkIHdoZW4gZ3JhYmJlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25HcmFiOiBub29wLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiBtb3ZlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25Nb3ZlOiBub29wLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiByZWxlYXNlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25SZWxlYXNlOiBub29wLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIG9wZW4uXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlT3Blbjogbm9vcCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBjbG9zZS5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVDbG9zZTogbm9vcCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBncmFiLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZUdyYWI6IG5vb3AsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgcmVsZWFzZS5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVSZWxlYXNlOiBub29wLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgaGktcmVzIGltYWdlIGlzIGxvYWRpbmcuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uSW1hZ2VMb2FkaW5nOiBub29wLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgaGktcmVzIGltYWdlIGlzIGxvYWRlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25JbWFnZUxvYWRlZDogbm9vcFxufVxuIiwiaW1wb3J0IHsgYmluZEFsbCB9IGZyb20gJy4vdXRpbHMnXG5cbmNvbnN0IFBSRVNTX0RFTEFZID0gMjAwXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdChpbnN0YW5jZSkge1xuICAgIGJpbmRBbGwodGhpcywgaW5zdGFuY2UpXG4gIH0sXG5cbiAgY2xpY2soZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgaWYgKGlzUHJlc3NpbmdNZXRhS2V5KGUpKSB7XG4gICAgICByZXR1cm4gd2luZG93Lm9wZW4oXG4gICAgICAgIHRoaXMudGFyZ2V0LnNyY09yaWdpbmFsIHx8IGUuY3VycmVudFRhcmdldC5zcmMsXG4gICAgICAgICdfYmxhbmsnXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLnNob3duKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yZWxlYXNlKClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vcGVuKGUuY3VycmVudFRhcmdldClcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc2Nyb2xsKCkge1xuICAgIGNvbnN0IGVsID1cbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCB8fCBkb2N1bWVudC5ib2R5LnBhcmVudE5vZGUgfHwgZG9jdW1lbnQuYm9keVxuICAgIGNvbnN0IHNjcm9sbExlZnQgPSB3aW5kb3cucGFnZVhPZmZzZXQgfHwgZWwuc2Nyb2xsTGVmdFxuICAgIGNvbnN0IHNjcm9sbFRvcCA9IHdpbmRvdy5wYWdlWU9mZnNldCB8fCBlbC5zY3JvbGxUb3BcblxuICAgIGlmICh0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSB7XG4gICAgICAgIHg6IHNjcm9sbExlZnQsXG4gICAgICAgIHk6IHNjcm9sbFRvcFxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uLnggLSBzY3JvbGxMZWZ0XG4gICAgY29uc3QgZGVsdGFZID0gdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24ueSAtIHNjcm9sbFRvcFxuICAgIGNvbnN0IHRocmVzaG9sZCA9IHRoaXMub3B0aW9ucy5zY3JvbGxUaHJlc2hvbGRcblxuICAgIGlmIChNYXRoLmFicyhkZWx0YVkpID49IHRocmVzaG9sZCB8fCBNYXRoLmFicyhkZWx0YVgpID49IHRocmVzaG9sZCkge1xuICAgICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9XG4gIH0sXG5cbiAga2V5ZG93bihlKSB7XG4gICAgaWYgKGlzRXNjYXBlKGUpKSB7XG4gICAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgICB0aGlzLmNsb3NlKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVsZWFzZSh0aGlzLmNsb3NlKVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBtb3VzZWRvd24oZSkge1xuICAgIGlmICghaXNMZWZ0QnV0dG9uKGUpIHx8IGlzUHJlc3NpbmdNZXRhS2V5KGUpKSByZXR1cm5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGVcblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoXG4gICAgICBmdW5jdGlvbiBncmFiT25Nb3VzZURvd24oKSB7XG4gICAgICAgIHRoaXMuZ3JhYihjbGllbnRYLCBjbGllbnRZKVxuICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgUFJFU1NfREVMQVlcbiAgICApXG4gIH0sXG5cbiAgbW91c2Vtb3ZlKGUpIHtcbiAgICBpZiAodGhpcy5yZWxlYXNlZCkgcmV0dXJuXG4gICAgdGhpcy5tb3ZlKGUuY2xpZW50WCwgZS5jbGllbnRZKVxuICB9LFxuXG4gIG1vdXNldXAoZSkge1xuICAgIGlmICghaXNMZWZ0QnV0dG9uKGUpIHx8IGlzUHJlc3NpbmdNZXRhS2V5KGUpKSByZXR1cm5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuXG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlbGVhc2UoKVxuICAgIH1cbiAgfSxcblxuICB0b3VjaHN0YXJ0KGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGUudG91Y2hlc1swXVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dChcbiAgICAgIGZ1bmN0aW9uIGdyYWJPblRvdWNoU3RhcnQoKSB7XG4gICAgICAgIHRoaXMuZ3JhYihjbGllbnRYLCBjbGllbnRZKVxuICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgUFJFU1NfREVMQVlcbiAgICApXG4gIH0sXG5cbiAgdG91Y2htb3ZlKGUpIHtcbiAgICBpZiAodGhpcy5yZWxlYXNlZCkgcmV0dXJuXG5cbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGUudG91Y2hlc1swXVxuICAgIHRoaXMubW92ZShjbGllbnRYLCBjbGllbnRZKVxuICB9LFxuXG4gIHRvdWNoZW5kKGUpIHtcbiAgICBpZiAoaXNUb3VjaGluZyhlKSkgcmV0dXJuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucHJlc3NUaW1lcilcblxuICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZWxlYXNlKClcbiAgICB9XG4gIH0sXG5cbiAgY2xpY2tPdmVybGF5KCkge1xuICAgIHRoaXMuY2xvc2UoKVxuICB9LFxuXG4gIHJlc2l6ZVdpbmRvdygpIHtcbiAgICB0aGlzLmNsb3NlKClcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0xlZnRCdXR0b24oZSkge1xuICByZXR1cm4gZS5idXR0b24gPT09IDBcbn1cblxuZnVuY3Rpb24gaXNQcmVzc2luZ01ldGFLZXkoZSkge1xuICByZXR1cm4gZS5tZXRhS2V5IHx8IGUuY3RybEtleVxufVxuXG5mdW5jdGlvbiBpc1RvdWNoaW5nKGUpIHtcbiAgZS50YXJnZXRUb3VjaGVzLmxlbmd0aCA+IDBcbn1cblxuZnVuY3Rpb24gaXNFc2NhcGUoZSkge1xuICBjb25zdCBjb2RlID0gZS5rZXkgfHwgZS5jb2RlXG4gIHJldHVybiBjb2RlID09PSAnRXNjYXBlJyB8fCBlLmtleUNvZGUgPT09IDI3XG59XG4iLCJpbXBvcnQgeyBsaXN0ZW4sIHNldFN0eWxlIH0gZnJvbSAnLi91dGlscydcblxuZXhwb3J0IGRlZmF1bHQge1xuICBpbml0KGluc3RhbmNlKSB7XG4gICAgdGhpcy5lbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG4gICAgdGhpcy5pbnN0YW5jZSA9IGluc3RhbmNlXG4gICAgdGhpcy5wYXJlbnQgPSBkb2N1bWVudC5ib2R5XG5cbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICByaWdodDogMCxcbiAgICAgIGJvdHRvbTogMCxcbiAgICAgIG9wYWNpdHk6IDBcbiAgICB9KVxuXG4gICAgdGhpcy51cGRhdGVTdHlsZShpbnN0YW5jZS5vcHRpb25zKVxuICAgIGxpc3Rlbih0aGlzLmVsLCAnY2xpY2snLCBpbnN0YW5jZS5oYW5kbGVyLmNsaWNrT3ZlcmxheS5iaW5kKGluc3RhbmNlKSlcbiAgfSxcblxuICB1cGRhdGVTdHlsZShvcHRpb25zKSB7XG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgekluZGV4OiBvcHRpb25zLnpJbmRleCxcbiAgICAgIGJhY2tncm91bmRDb2xvcjogb3B0aW9ucy5iZ0NvbG9yLFxuICAgICAgdHJhbnNpdGlvbjogYG9wYWNpdHlcbiAgICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbn1zXG4gICAgICAgICR7b3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb259YFxuICAgIH0pXG4gIH0sXG5cbiAgaW5zZXJ0KCkge1xuICAgIHRoaXMucGFyZW50LmFwcGVuZENoaWxkKHRoaXMuZWwpXG4gIH0sXG5cbiAgcmVtb3ZlKCkge1xuICAgIHRoaXMucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuZWwpXG4gIH0sXG5cbiAgZmFkZUluKCkge1xuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcbiAgICB0aGlzLmVsLnN0eWxlLm9wYWNpdHkgPSB0aGlzLmluc3RhbmNlLm9wdGlvbnMuYmdPcGFjaXR5XG4gIH0sXG5cbiAgZmFkZU91dCgpIHtcbiAgICB0aGlzLmVsLnN0eWxlLm9wYWNpdHkgPSAwXG4gIH1cbn1cbiIsImltcG9ydCB7IGN1cnNvciwgc2V0U3R5bGUsIGdldE9yaWdpbmFsU291cmNlIH0gZnJvbSAnLi91dGlscydcblxuLy8gVHJhbnNsYXRlIHotYXhpcyB0byBmaXggQ1NTIGdyaWQgZGlzcGxheSBpc3N1ZSBpbiBDaHJvbWU6XG4vLyBodHRwczovL2dpdGh1Yi5jb20va2luZ2RpZG85OTkvem9vbWluZy9pc3N1ZXMvNDJcbmNvbnN0IFRSQU5TTEFURV9aID0gMFxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQoZWwsIGluc3RhbmNlKSB7XG4gICAgdGhpcy5lbCA9IGVsXG4gICAgdGhpcy5pbnN0YW5jZSA9IGluc3RhbmNlXG4gICAgdGhpcy5zcmNUaHVtYm5haWwgPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnc3JjJylcbiAgICB0aGlzLnNyY3NldCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdzcmNzZXQnKVxuICAgIHRoaXMuc3JjT3JpZ2luYWwgPSBnZXRPcmlnaW5hbFNvdXJjZSh0aGlzLmVsKVxuICAgIHRoaXMucmVjdCA9IHRoaXMuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgICB0aGlzLnRyYW5zbGF0ZSA9IG51bGxcbiAgICB0aGlzLnNjYWxlID0gbnVsbFxuICAgIHRoaXMuc3R5bGVPcGVuID0gbnVsbFxuICAgIHRoaXMuc3R5bGVDbG9zZSA9IG51bGxcbiAgfSxcblxuICB6b29tSW4oKSB7XG4gICAgY29uc3Qge1xuICAgICAgekluZGV4LFxuICAgICAgZW5hYmxlR3JhYixcbiAgICAgIHRyYW5zaXRpb25EdXJhdGlvbixcbiAgICAgIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxuICAgIH0gPSB0aGlzLmluc3RhbmNlLm9wdGlvbnNcbiAgICB0aGlzLnRyYW5zbGF0ZSA9IHRoaXMuY2FsY3VsYXRlVHJhbnNsYXRlKClcbiAgICB0aGlzLnNjYWxlID0gdGhpcy5jYWxjdWxhdGVTY2FsZSgpXG5cbiAgICB0aGlzLnN0eWxlT3BlbiA9IHtcbiAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgekluZGV4OiB6SW5kZXggKyAxLFxuICAgICAgY3Vyc29yOiBlbmFibGVHcmFiID8gY3Vyc29yLmdyYWIgOiBjdXJzb3Iuem9vbU91dCxcbiAgICAgIHRyYW5zaXRpb246IGB0cmFuc2Zvcm1cbiAgICAgICAgJHt0cmFuc2l0aW9uRHVyYXRpb259c1xuICAgICAgICAke3RyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gLFxuICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoJHt0aGlzLnRyYW5zbGF0ZS54fXB4LCAke1xuICAgICAgICB0aGlzLnRyYW5zbGF0ZS55XG4gICAgICB9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54fSwke3RoaXMuc2NhbGUueX0pYCxcbiAgICAgIGhlaWdodDogYCR7dGhpcy5yZWN0LmhlaWdodH1weGAsXG4gICAgICB3aWR0aDogYCR7dGhpcy5yZWN0LndpZHRofXB4YFxuICAgIH1cblxuICAgIC8vIEZvcmNlIGxheW91dCB1cGRhdGVcbiAgICB0aGlzLmVsLm9mZnNldFdpZHRoXG5cbiAgICAvLyBUcmlnZ2VyIHRyYW5zaXRpb25cbiAgICB0aGlzLnN0eWxlQ2xvc2UgPSBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlT3BlbiwgdHJ1ZSlcbiAgfSxcblxuICB6b29tT3V0KCkge1xuICAgIC8vIEZvcmNlIGxheW91dCB1cGRhdGVcbiAgICB0aGlzLmVsLm9mZnNldFdpZHRoXG5cbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7IHRyYW5zZm9ybTogJ25vbmUnIH0pXG4gIH0sXG5cbiAgZ3JhYih4LCB5LCBzY2FsZUV4dHJhKSB7XG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcbiAgICBjb25zdCBbZHgsIGR5XSA9IFt3aW5kb3dDZW50ZXIueCAtIHgsIHdpbmRvd0NlbnRlci55IC0geV1cblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIGN1cnNvcjogY3Vyc29yLm1vdmUsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUzZChcbiAgICAgICAgJHt0aGlzLnRyYW5zbGF0ZS54ICsgZHh9cHgsICR7dGhpcy50cmFuc2xhdGUueSArXG4gICAgICAgIGR5fXB4LCAke1RSQU5TTEFURV9afXB4KVxuICAgICAgICBzY2FsZSgke3RoaXMuc2NhbGUueCArIHNjYWxlRXh0cmF9LCR7dGhpcy5zY2FsZS55ICsgc2NhbGVFeHRyYX0pYFxuICAgIH0pXG4gIH0sXG5cbiAgbW92ZSh4LCB5LCBzY2FsZUV4dHJhKSB7XG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcbiAgICBjb25zdCBbZHgsIGR5XSA9IFt3aW5kb3dDZW50ZXIueCAtIHgsIHdpbmRvd0NlbnRlci55IC0geV1cblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHRyYW5zaXRpb246ICd0cmFuc2Zvcm0nLFxuICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoXG4gICAgICAgICR7dGhpcy50cmFuc2xhdGUueCArIGR4fXB4LCAke3RoaXMudHJhbnNsYXRlLnkgK1xuICAgICAgICBkeX1weCwgJHtUUkFOU0xBVEVfWn1weClcbiAgICAgICAgc2NhbGUoJHt0aGlzLnNjYWxlLnggKyBzY2FsZUV4dHJhfSwke3RoaXMuc2NhbGUueSArIHNjYWxlRXh0cmF9KWBcbiAgICB9KVxuICB9LFxuXG4gIHJlc3RvcmVDbG9zZVN0eWxlKCkge1xuICAgIHNldFN0eWxlKHRoaXMuZWwsIHRoaXMuc3R5bGVDbG9zZSlcbiAgfSxcblxuICByZXN0b3JlT3BlblN0eWxlKCkge1xuICAgIHNldFN0eWxlKHRoaXMuZWwsIHRoaXMuc3R5bGVPcGVuKVxuICB9LFxuXG4gIHVwZ3JhZGVTb3VyY2UoKSB7XG4gICAgaWYgKHRoaXMuc3JjT3JpZ2luYWwpIHtcbiAgICAgIGNvbnN0IHBhcmVudE5vZGUgPSB0aGlzLmVsLnBhcmVudE5vZGVcblxuICAgICAgaWYgKHRoaXMuc3Jjc2V0KSB7XG4gICAgICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKCdzcmNzZXQnKVxuICAgICAgfVxuXG4gICAgICBjb25zdCB0ZW1wID0gdGhpcy5lbC5jbG9uZU5vZGUoZmFsc2UpXG5cbiAgICAgIC8vIEZvcmNlIGNvbXB1dGUgdGhlIGhpLXJlcyBpbWFnZSBpbiBET00gdG8gcHJldmVudFxuICAgICAgLy8gaW1hZ2UgZmxpY2tlcmluZyB3aGlsZSB1cGRhdGluZyBzcmNcbiAgICAgIHRlbXAuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnNyY09yaWdpbmFsKVxuICAgICAgdGVtcC5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCdcbiAgICAgIHRlbXAuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nXG4gICAgICBwYXJlbnROb2RlLmFwcGVuZENoaWxkKHRlbXApXG5cbiAgICAgIC8vIEFkZCBkZWxheSB0byBwcmV2ZW50IEZpcmVmb3ggZnJvbSBmbGlja2VyaW5nXG4gICAgICBzZXRUaW1lb3V0KFxuICAgICAgICBmdW5jdGlvbiB1cGRhdGVTcmMoKSB7XG4gICAgICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjT3JpZ2luYWwpXG4gICAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0ZW1wKVxuICAgICAgICB9LmJpbmQodGhpcyksXG4gICAgICAgIDUwXG4gICAgICApXG4gICAgfVxuICB9LFxuXG4gIGRvd25ncmFkZVNvdXJjZSgpIHtcbiAgICBpZiAodGhpcy5zcmNPcmlnaW5hbCkge1xuICAgICAgaWYgKHRoaXMuc3Jjc2V0KSB7XG4gICAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCdzcmNzZXQnLCB0aGlzLnNyY3NldClcbiAgICAgIH1cbiAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnNyY1RodW1ibmFpbClcbiAgICB9XG4gIH0sXG5cbiAgY2FsY3VsYXRlVHJhbnNsYXRlKCkge1xuICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG4gICAgY29uc3QgdGFyZ2V0Q2VudGVyID0ge1xuICAgICAgeDogdGhpcy5yZWN0LmxlZnQgKyB0aGlzLnJlY3Qud2lkdGggLyAyLFxuICAgICAgeTogdGhpcy5yZWN0LnRvcCArIHRoaXMucmVjdC5oZWlnaHQgLyAyXG4gICAgfVxuXG4gICAgLy8gVGhlIHZlY3RvciB0byB0cmFuc2xhdGUgaW1hZ2UgdG8gdGhlIHdpbmRvdyBjZW50ZXJcbiAgICByZXR1cm4ge1xuICAgICAgeDogd2luZG93Q2VudGVyLnggLSB0YXJnZXRDZW50ZXIueCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gdGFyZ2V0Q2VudGVyLnlcbiAgICB9XG4gIH0sXG5cbiAgY2FsY3VsYXRlU2NhbGUoKSB7XG4gICAgY29uc3QgeyB6b29taW5nSGVpZ2h0LCB6b29taW5nV2lkdGggfSA9IHRoaXMuZWwuZGF0YXNldFxuICAgIGNvbnN0IHsgY3VzdG9tU2l6ZSwgc2NhbGVCYXNlIH0gPSB0aGlzLmluc3RhbmNlLm9wdGlvbnNcblxuICAgIGlmICghY3VzdG9tU2l6ZSAmJiB6b29taW5nSGVpZ2h0ICYmIHpvb21pbmdXaWR0aCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogem9vbWluZ1dpZHRoIC8gdGhpcy5yZWN0LndpZHRoLFxuICAgICAgICB5OiB6b29taW5nSGVpZ2h0IC8gdGhpcy5yZWN0LmhlaWdodFxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY3VzdG9tU2l6ZSAmJiB0eXBlb2YgY3VzdG9tU2l6ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IGN1c3RvbVNpemUud2lkdGggLyB0aGlzLnJlY3Qud2lkdGgsXG4gICAgICAgIHk6IGN1c3RvbVNpemUuaGVpZ2h0IC8gdGhpcy5yZWN0LmhlaWdodFxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0YXJnZXRIYWxmV2lkdGggPSB0aGlzLnJlY3Qud2lkdGggLyAyXG4gICAgICBjb25zdCB0YXJnZXRIYWxmSGVpZ2h0ID0gdGhpcy5yZWN0LmhlaWdodCAvIDJcbiAgICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG5cbiAgICAgIC8vIFRoZSBkaXN0YW5jZSBiZXR3ZWVuIHRhcmdldCBlZGdlIGFuZCB3aW5kb3cgZWRnZVxuICAgICAgY29uc3QgdGFyZ2V0RWRnZVRvV2luZG93RWRnZSA9IHtcbiAgICAgICAgeDogd2luZG93Q2VudGVyLnggLSB0YXJnZXRIYWxmV2lkdGgsXG4gICAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gdGFyZ2V0SGFsZkhlaWdodFxuICAgICAgfVxuXG4gICAgICBjb25zdCBzY2FsZUhvcml6b250YWxseSA9IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UueCAvIHRhcmdldEhhbGZXaWR0aFxuICAgICAgY29uc3Qgc2NhbGVWZXJ0aWNhbGx5ID0gdGFyZ2V0RWRnZVRvV2luZG93RWRnZS55IC8gdGFyZ2V0SGFsZkhlaWdodFxuXG4gICAgICAvLyBUaGUgYWRkaXRpb25hbCBzY2FsZSBpcyBiYXNlZCBvbiB0aGUgc21hbGxlciB2YWx1ZSBvZlxuICAgICAgLy8gc2NhbGluZyBob3Jpem9udGFsbHkgYW5kIHNjYWxpbmcgdmVydGljYWxseVxuICAgICAgY29uc3Qgc2NhbGUgPSBzY2FsZUJhc2UgKyBNYXRoLm1pbihzY2FsZUhvcml6b250YWxseSwgc2NhbGVWZXJ0aWNhbGx5KVxuXG4gICAgICBpZiAoY3VzdG9tU2l6ZSAmJiB0eXBlb2YgY3VzdG9tU2l6ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVXNlIHpvb21pbmdXaWR0aCBhbmQgem9vbWluZ0hlaWdodCBpZiBhdmFpbGFibGVcbiAgICAgICAgY29uc3QgbmF0dXJhbFdpZHRoID0gem9vbWluZ1dpZHRoIHx8IHRoaXMuZWwubmF0dXJhbFdpZHRoXG4gICAgICAgIGNvbnN0IG5hdHVyYWxIZWlnaHQgPSB6b29taW5nSGVpZ2h0IHx8IHRoaXMuZWwubmF0dXJhbEhlaWdodFxuICAgICAgICBjb25zdCBtYXhab29taW5nV2lkdGggPVxuICAgICAgICAgIHBhcnNlRmxvYXQoY3VzdG9tU2l6ZSkgKiBuYXR1cmFsV2lkdGggLyAoMTAwICogdGhpcy5yZWN0LndpZHRoKVxuICAgICAgICBjb25zdCBtYXhab29taW5nSGVpZ2h0ID1cbiAgICAgICAgICBwYXJzZUZsb2F0KGN1c3RvbVNpemUpICogbmF0dXJhbEhlaWdodCAvICgxMDAgKiB0aGlzLnJlY3QuaGVpZ2h0KVxuXG4gICAgICAgIC8vIE9ubHkgc2NhbGUgaW1hZ2UgdXAgdG8gdGhlIHNwZWNpZmllZCBjdXN0b21TaXplIHBlcmNlbnRhZ2VcbiAgICAgICAgaWYgKHNjYWxlID4gbWF4Wm9vbWluZ1dpZHRoIHx8IHNjYWxlID4gbWF4Wm9vbWluZ0hlaWdodCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiBtYXhab29taW5nV2lkdGgsXG4gICAgICAgICAgICB5OiBtYXhab29taW5nSGVpZ2h0XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IHNjYWxlLFxuICAgICAgICB5OiBzY2FsZVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRXaW5kb3dDZW50ZXIoKSB7XG4gIGNvbnN0IGRvY0VsID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XG4gIGNvbnN0IHdpbmRvd1dpZHRoID0gTWF0aC5taW4oZG9jRWwuY2xpZW50V2lkdGgsIHdpbmRvdy5pbm5lcldpZHRoKVxuICBjb25zdCB3aW5kb3dIZWlnaHQgPSBNYXRoLm1pbihkb2NFbC5jbGllbnRIZWlnaHQsIHdpbmRvdy5pbm5lckhlaWdodClcblxuICByZXR1cm4ge1xuICAgIHg6IHdpbmRvd1dpZHRoIC8gMixcbiAgICB5OiB3aW5kb3dIZWlnaHQgLyAyXG4gIH1cbn1cbiIsImltcG9ydCB7IGN1cnNvciwgbGlzdGVuLCBsb2FkSW1hZ2UsIGdldE9yaWdpbmFsU291cmNlIH0gZnJvbSAnLi91dGlscydcbmltcG9ydCBERUZBVUxUX09QVElPTlMgZnJvbSAnLi9vcHRpb25zJ1xuXG5pbXBvcnQgaGFuZGxlciBmcm9tICcuL2hhbmRsZXInXG5pbXBvcnQgb3ZlcmxheSBmcm9tICcuL292ZXJsYXknXG5pbXBvcnQgdGFyZ2V0IGZyb20gJy4vdGFyZ2V0J1xuXG4vKipcbiAqIFpvb21pbmcgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFpvb21pbmcge1xuICAvKipcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBVcGRhdGUgZGVmYXVsdCBvcHRpb25zIGlmIHByb3ZpZGVkLlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHRoaXMudGFyZ2V0ID0gT2JqZWN0LmNyZWF0ZSh0YXJnZXQpXG4gICAgdGhpcy5vdmVybGF5ID0gT2JqZWN0LmNyZWF0ZShvdmVybGF5KVxuICAgIHRoaXMuaGFuZGxlciA9IE9iamVjdC5jcmVhdGUoaGFuZGxlcilcbiAgICB0aGlzLmJvZHkgPSBkb2N1bWVudC5ib2R5XG5cbiAgICB0aGlzLnNob3duID0gZmFsc2VcbiAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgIHRoaXMucmVsZWFzZWQgPSB0cnVlXG4gICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gbnVsbFxuXG4gICAgdGhpcy5vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9PUFRJT05TLCBvcHRpb25zKVxuICAgIHRoaXMub3ZlcmxheS5pbml0KHRoaXMpXG4gICAgdGhpcy5oYW5kbGVyLmluaXQodGhpcylcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlIGVsZW1lbnQocykgem9vbWFibGUuXG4gICAqIEBwYXJhbSAge3N0cmluZ3xFbGVtZW50fSBlbCBBIGNzcyBzZWxlY3RvciBvciBhbiBFbGVtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgbGlzdGVuKGVsKSB7XG4gICAgaWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IGVscyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoZWwpXG4gICAgICBsZXQgaSA9IGVscy5sZW5ndGhcblxuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLmxpc3RlbihlbHNbaV0pXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlbC50YWdOYW1lID09PSAnSU1HJykge1xuICAgICAgZWwuc3R5bGUuY3Vyc29yID0gY3Vyc29yLnpvb21JblxuICAgICAgbGlzdGVuKGVsLCAnY2xpY2snLCB0aGlzLmhhbmRsZXIuY2xpY2spXG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMucHJlbG9hZEltYWdlKSB7XG4gICAgICAgIGxvYWRJbWFnZShnZXRPcmlnaW5hbFNvdXJjZShlbCkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgb3B0aW9ucyBvciByZXR1cm4gY3VycmVudCBvcHRpb25zIGlmIG5vIGFyZ3VtZW50IGlzIHByb3ZpZGVkLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnMgQW4gT2JqZWN0IHRoYXQgY29udGFpbnMgdGhpcy5vcHRpb25zLlxuICAgKiBAcmV0dXJuIHt0aGlzfHRoaXMub3B0aW9uc31cbiAgICovXG4gIGNvbmZpZyhvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5vcHRpb25zLCBvcHRpb25zKVxuICAgICAgdGhpcy5vdmVybGF5LnVwZGF0ZVN0eWxlKHRoaXMub3B0aW9ucylcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLm9wdGlvbnNcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogT3BlbiAoem9vbSBpbikgdGhlIEVsZW1lbnQuXG4gICAqIEBwYXJhbSAge0VsZW1lbnR9IGVsIFRoZSBFbGVtZW50IHRvIG9wZW4uXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uT3Blbl0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGxcbiAgICogYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgb3BlbmVkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbCBnZXRcbiAgICogdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIG9wZW4oZWwsIGNiID0gdGhpcy5vcHRpb25zLm9uT3Blbikge1xuICAgIGlmICh0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0eXBlb2YgZWwgPT09ICdzdHJpbmcnID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbCkgOiBlbFxuXG4gICAgaWYgKHRhcmdldC50YWdOYW1lICE9PSAnSU1HJykgcmV0dXJuXG5cbiAgICB0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKHRhcmdldClcblxuICAgIHRoaXMudGFyZ2V0LmluaXQodGFyZ2V0LCB0aGlzKVxuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMucHJlbG9hZEltYWdlKSB7XG4gICAgICBjb25zdCB7IHNyY09yaWdpbmFsIH0gPSB0aGlzLnRhcmdldFxuXG4gICAgICBpZiAoc3JjT3JpZ2luYWwgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLm9wdGlvbnMub25JbWFnZUxvYWRpbmcodGFyZ2V0KVxuICAgICAgICBsb2FkSW1hZ2Uoc3JjT3JpZ2luYWwsIHRoaXMub3B0aW9ucy5vbkltYWdlTG9hZGVkKVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2hvd24gPSB0cnVlXG4gICAgdGhpcy5sb2NrID0gdHJ1ZVxuXG4gICAgdGhpcy50YXJnZXQuem9vbUluKClcbiAgICB0aGlzLm92ZXJsYXkuaW5zZXJ0KClcbiAgICB0aGlzLm92ZXJsYXkuZmFkZUluKClcblxuICAgIGxpc3Rlbihkb2N1bWVudCwgJ3Njcm9sbCcsIHRoaXMuaGFuZGxlci5zY3JvbGwpXG4gICAgbGlzdGVuKGRvY3VtZW50LCAna2V5ZG93bicsIHRoaXMuaGFuZGxlci5rZXlkb3duKVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uV2luZG93UmVzaXplKSB7XG4gICAgICBsaXN0ZW4od2luZG93LCAncmVzaXplJywgdGhpcy5oYW5kbGVyLnJlc2l6ZVdpbmRvdylcbiAgICB9XG5cbiAgICBjb25zdCBvbk9wZW5FbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCAndHJhbnNpdGlvbmVuZCcsIG9uT3BlbkVuZCwgZmFsc2UpXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgICAgdGhpcy50YXJnZXQudXBncmFkZVNvdXJjZSgpXG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgICB0b2dnbGVHcmFiTGlzdGVuZXJzKGRvY3VtZW50LCB0aGlzLmhhbmRsZXIsIHRydWUpXG4gICAgICB9XG5cbiAgICAgIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCAndHJhbnNpdGlvbmVuZCcsIG9uT3BlbkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ2xvc2UgKHpvb20gb3V0KSB0aGUgRWxlbWVudCBjdXJyZW50bHkgb3BlbmVkLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbkNsb3NlXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbFxuICAgKiBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBjbG9zZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldFxuICAgKiB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgY2xvc2UoY2IgPSB0aGlzLm9wdGlvbnMub25DbG9zZSkge1xuICAgIGlmICghdGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQuZWxcblxuICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZUNsb3NlKHRhcmdldClcblxuICAgIHRoaXMubG9jayA9IHRydWVcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLmRlZmF1bHRcbiAgICB0aGlzLm92ZXJsYXkuZmFkZU91dCgpXG4gICAgdGhpcy50YXJnZXQuem9vbU91dCgpXG5cbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdzY3JvbGwnLCB0aGlzLmhhbmRsZXIuc2Nyb2xsLCBmYWxzZSlcbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5oYW5kbGVyLmtleWRvd24sIGZhbHNlKVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uV2luZG93UmVzaXplKSB7XG4gICAgICBsaXN0ZW4od2luZG93LCAncmVzaXplJywgdGhpcy5oYW5kbGVyLnJlc2l6ZVdpbmRvdywgZmFsc2UpXG4gICAgfVxuXG4gICAgY29uc3Qgb25DbG9zZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsICd0cmFuc2l0aW9uZW5kJywgb25DbG9zZUVuZCwgZmFsc2UpXG5cbiAgICAgIHRoaXMuc2hvd24gPSBmYWxzZVxuICAgICAgdGhpcy5sb2NrID0gZmFsc2VcblxuICAgICAgdGhpcy50YXJnZXQuZG93bmdyYWRlU291cmNlKClcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5lbmFibGVHcmFiKSB7XG4gICAgICAgIHRvZ2dsZUdyYWJMaXN0ZW5lcnMoZG9jdW1lbnQsIHRoaXMuaGFuZGxlciwgZmFsc2UpXG4gICAgICB9XG5cbiAgICAgIHRoaXMudGFyZ2V0LnJlc3RvcmVDbG9zZVN0eWxlKClcbiAgICAgIHRoaXMub3ZlcmxheS5yZW1vdmUoKVxuXG4gICAgICBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgJ3RyYW5zaXRpb25lbmQnLCBvbkNsb3NlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBHcmFiIHRoZSBFbGVtZW50IGN1cnJlbnRseSBvcGVuZWQgZ2l2ZW4gYSBwb3NpdGlvbiBhbmQgYXBwbHkgZXh0cmEgem9vbS1pbi5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHggVGhlIFgtYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB5IFRoZSBZLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgc2NhbGVFeHRyYSBFeHRyYSB6b29tLWluIHRvIGFwcGx5LlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbkdyYWJdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIGdyYWJiZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdFxuICAgKiB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgZ3JhYih4LCB5LCBzY2FsZUV4dHJhID0gdGhpcy5vcHRpb25zLnNjYWxlRXh0cmEsIGNiID0gdGhpcy5vcHRpb25zLm9uR3JhYikge1xuICAgIGlmICghdGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQuZWxcblxuICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIodGFyZ2V0KVxuXG4gICAgdGhpcy5yZWxlYXNlZCA9IGZhbHNlXG4gICAgdGhpcy50YXJnZXQuZ3JhYih4LCB5LCBzY2FsZUV4dHJhKVxuXG4gICAgY29uc3Qgb25HcmFiRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgJ3RyYW5zaXRpb25lbmQnLCBvbkdyYWJFbmQsIGZhbHNlKVxuICAgICAgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsICd0cmFuc2l0aW9uZW5kJywgb25HcmFiRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlIHRoZSBFbGVtZW50IGN1cnJlbnRseSBncmFiYmVkIGdpdmVuIGEgcG9zaXRpb24gYW5kIGFwcGx5IGV4dHJhIHpvb20taW4uXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB4IFRoZSBYLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeSBUaGUgWS1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHNjYWxlRXh0cmEgRXh0cmEgem9vbS1pbiB0byBhcHBseS5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25Nb3ZlXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXRcbiAgICogd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBtb3ZlZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0IHdpbGxcbiAgICogZ2V0IHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBtb3ZlKHgsIHksIHNjYWxlRXh0cmEgPSB0aGlzLm9wdGlvbnMuc2NhbGVFeHRyYSwgY2IgPSB0aGlzLm9wdGlvbnMub25Nb3ZlKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICB0aGlzLnJlbGVhc2VkID0gZmFsc2VcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLm1vdmVcbiAgICB0aGlzLnRhcmdldC5tb3ZlKHgsIHksIHNjYWxlRXh0cmEpXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgY29uc3Qgb25Nb3ZlRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgJ3RyYW5zaXRpb25lbmQnLCBvbk1vdmVFbmQsIGZhbHNlKVxuICAgICAgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsICd0cmFuc2l0aW9uZW5kJywgb25Nb3ZlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWxlYXNlIHRoZSBFbGVtZW50IGN1cnJlbnRseSBncmFiYmVkLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vblJlbGVhc2VdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIHJlbGVhc2VkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXRcbiAgICogd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIHJlbGVhc2UoY2IgPSB0aGlzLm9wdGlvbnMub25SZWxlYXNlKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSh0YXJnZXQpXG5cbiAgICB0aGlzLmxvY2sgPSB0cnVlXG4gICAgdGhpcy5ib2R5LnN0eWxlLmN1cnNvciA9IGN1cnNvci5kZWZhdWx0XG4gICAgdGhpcy50YXJnZXQucmVzdG9yZU9wZW5TdHlsZSgpXG5cbiAgICBjb25zdCBvblJlbGVhc2VFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCAndHJhbnNpdGlvbmVuZCcsIG9uUmVsZWFzZUVuZCwgZmFsc2UpXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgICAgdGhpcy5yZWxlYXNlZCA9IHRydWVcbiAgICAgIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCAndHJhbnNpdGlvbmVuZCcsIG9uUmVsZWFzZUVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cbn1cblxuZnVuY3Rpb24gdG9nZ2xlR3JhYkxpc3RlbmVycyhlbCwgaGFuZGxlciwgYWRkKSB7XG4gIGNvbnN0IHR5cGVzID0gW1xuICAgICdtb3VzZWRvd24nLFxuICAgICdtb3VzZW1vdmUnLFxuICAgICdtb3VzZXVwJyxcbiAgICAndG91Y2hzdGFydCcsXG4gICAgJ3RvdWNobW92ZScsXG4gICAgJ3RvdWNoZW5kJ1xuICBdXG5cbiAgdHlwZXMuZm9yRWFjaChmdW5jdGlvbiB0b2dnbGVMaXN0ZW5lcih0eXBlKSB7XG4gICAgbGlzdGVuKGVsLCB0eXBlLCBoYW5kbGVyW3R5cGVdLCBhZGQpXG4gIH0pXG59XG4iXSwibmFtZXMiOlsiY3Vyc29yIiwibGlzdGVuIiwiZWwiLCJldmVudCIsImhhbmRsZXIiLCJhZGQiLCJvcHRpb25zIiwicGFzc2l2ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwibG9hZEltYWdlIiwic3JjIiwiY2IiLCJpbWciLCJJbWFnZSIsIm9ubG9hZCIsIm9uSW1hZ2VMb2FkIiwiZ2V0T3JpZ2luYWxTb3VyY2UiLCJkYXRhc2V0Iiwib3JpZ2luYWwiLCJwYXJlbnROb2RlIiwidGFnTmFtZSIsImdldEF0dHJpYnV0ZSIsInNldFN0eWxlIiwic3R5bGVzIiwicmVtZW1iZXIiLCJ0cmFuc2l0aW9uIiwidmFsdWUiLCJ0cmFuc2Zvcm0iLCJzIiwic3R5bGUiLCJrZXkiLCJiaW5kQWxsIiwiX3RoaXMiLCJ0aGF0IiwibWV0aG9kcyIsIk9iamVjdCIsImdldE93blByb3BlcnR5TmFtZXMiLCJnZXRQcm90b3R5cGVPZiIsImZvckVhY2giLCJiaW5kT25lIiwibWV0aG9kIiwiYmluZCIsIm5vb3AiLCJQUkVTU19ERUxBWSIsImluc3RhbmNlIiwiZSIsInByZXZlbnREZWZhdWx0IiwiaXNQcmVzc2luZ01ldGFLZXkiLCJ3aW5kb3ciLCJvcGVuIiwidGFyZ2V0Iiwic3JjT3JpZ2luYWwiLCJjdXJyZW50VGFyZ2V0Iiwic2hvd24iLCJyZWxlYXNlZCIsImNsb3NlIiwicmVsZWFzZSIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50IiwiYm9keSIsInNjcm9sbExlZnQiLCJwYWdlWE9mZnNldCIsInNjcm9sbFRvcCIsInBhZ2VZT2Zmc2V0IiwibGFzdFNjcm9sbFBvc2l0aW9uIiwiZGVsdGFYIiwieCIsImRlbHRhWSIsInkiLCJ0aHJlc2hvbGQiLCJzY3JvbGxUaHJlc2hvbGQiLCJNYXRoIiwiYWJzIiwiaXNFc2NhcGUiLCJpc0xlZnRCdXR0b24iLCJjbGllbnRYIiwiY2xpZW50WSIsInByZXNzVGltZXIiLCJzZXRUaW1lb3V0IiwiZ3JhYk9uTW91c2VEb3duIiwiZ3JhYiIsIm1vdmUiLCJ0b3VjaGVzIiwiZ3JhYk9uVG91Y2hTdGFydCIsImlzVG91Y2hpbmciLCJidXR0b24iLCJtZXRhS2V5IiwiY3RybEtleSIsInRhcmdldFRvdWNoZXMiLCJsZW5ndGgiLCJjb2RlIiwia2V5Q29kZSIsImNyZWF0ZUVsZW1lbnQiLCJwYXJlbnQiLCJ1cGRhdGVTdHlsZSIsImNsaWNrT3ZlcmxheSIsInpJbmRleCIsImJnQ29sb3IiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJ0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24iLCJhcHBlbmRDaGlsZCIsInJlbW92ZUNoaWxkIiwib2Zmc2V0V2lkdGgiLCJvcGFjaXR5IiwiYmdPcGFjaXR5IiwiVFJBTlNMQVRFX1oiLCJzcmNUaHVtYm5haWwiLCJzcmNzZXQiLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwidHJhbnNsYXRlIiwic2NhbGUiLCJzdHlsZU9wZW4iLCJzdHlsZUNsb3NlIiwiZW5hYmxlR3JhYiIsImNhbGN1bGF0ZVRyYW5zbGF0ZSIsImNhbGN1bGF0ZVNjYWxlIiwiem9vbU91dCIsImhlaWdodCIsIndpZHRoIiwic2NhbGVFeHRyYSIsIndpbmRvd0NlbnRlciIsImdldFdpbmRvd0NlbnRlciIsImR4IiwiZHkiLCJyZW1vdmVBdHRyaWJ1dGUiLCJ0ZW1wIiwiY2xvbmVOb2RlIiwic2V0QXR0cmlidXRlIiwicG9zaXRpb24iLCJ2aXNpYmlsaXR5IiwidXBkYXRlU3JjIiwidGFyZ2V0Q2VudGVyIiwibGVmdCIsInRvcCIsInpvb21pbmdIZWlnaHQiLCJ6b29taW5nV2lkdGgiLCJjdXN0b21TaXplIiwic2NhbGVCYXNlIiwidGFyZ2V0SGFsZldpZHRoIiwidGFyZ2V0SGFsZkhlaWdodCIsInRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsIm1pbiIsIm5hdHVyYWxXaWR0aCIsIm5hdHVyYWxIZWlnaHQiLCJtYXhab29taW5nV2lkdGgiLCJwYXJzZUZsb2F0IiwibWF4Wm9vbWluZ0hlaWdodCIsImRvY0VsIiwid2luZG93V2lkdGgiLCJjbGllbnRXaWR0aCIsImlubmVyV2lkdGgiLCJ3aW5kb3dIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJpbm5lckhlaWdodCIsIlpvb21pbmciLCJjcmVhdGUiLCJvdmVybGF5IiwibG9jayIsImJhYmVsSGVscGVycy5leHRlbmRzIiwiREVGQVVMVF9PUFRJT05TIiwiaW5pdCIsImVscyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwiem9vbUluIiwiY2xpY2siLCJwcmVsb2FkSW1hZ2UiLCJvbk9wZW4iLCJxdWVyeVNlbGVjdG9yIiwib25CZWZvcmVPcGVuIiwib25JbWFnZUxvYWRpbmciLCJvbkltYWdlTG9hZGVkIiwiaW5zZXJ0IiwiZmFkZUluIiwic2Nyb2xsIiwia2V5ZG93biIsImNsb3NlT25XaW5kb3dSZXNpemUiLCJyZXNpemVXaW5kb3ciLCJvbk9wZW5FbmQiLCJ1cGdyYWRlU291cmNlIiwib25DbG9zZSIsIm9uQmVmb3JlQ2xvc2UiLCJkZWZhdWx0IiwiZmFkZU91dCIsIm9uQ2xvc2VFbmQiLCJkb3duZ3JhZGVTb3VyY2UiLCJyZXN0b3JlQ2xvc2VTdHlsZSIsInJlbW92ZSIsIm9uR3JhYiIsIm9uQmVmb3JlR3JhYiIsIm9uR3JhYkVuZCIsIm9uTW92ZSIsIm9uTW92ZUVuZCIsIm9uUmVsZWFzZSIsIm9uQmVmb3JlUmVsZWFzZSIsInJlc3RvcmVPcGVuU3R5bGUiLCJvblJlbGVhc2VFbmQiLCJ0b2dnbGVHcmFiTGlzdGVuZXJzIiwidHlwZXMiLCJ0b2dnbGVMaXN0ZW5lciIsInR5cGUiXSwibWFwcGluZ3MiOiJBQUFPLElBQU1BLFNBQVM7V0FDWCxNQURXO1VBRVosU0FGWTtXQUdYLFVBSFc7UUFJZCxNQUpjO1FBS2Q7Q0FMRDs7QUFRUCxBQUFPLFNBQVNDLE1BQVQsQ0FBZ0JDLEVBQWhCLEVBQW9CQyxLQUFwQixFQUEyQkMsT0FBM0IsRUFBZ0Q7TUFBWkMsR0FBWSx1RUFBTixJQUFNOztNQUMvQ0MsVUFBVSxFQUFFQyxTQUFTLEtBQVgsRUFBaEI7O01BRUlGLEdBQUosRUFBUztPQUNKRyxnQkFBSCxDQUFvQkwsS0FBcEIsRUFBMkJDLE9BQTNCLEVBQW9DRSxPQUFwQztHQURGLE1BRU87T0FDRkcsbUJBQUgsQ0FBdUJOLEtBQXZCLEVBQThCQyxPQUE5QixFQUF1Q0UsT0FBdkM7Ozs7QUFJSixBQUFPLFNBQVNJLFNBQVQsQ0FBbUJDLEdBQW5CLEVBQXdCQyxFQUF4QixFQUE0QjtNQUM3QkQsR0FBSixFQUFTO1FBQ0RFLE1BQU0sSUFBSUMsS0FBSixFQUFaOztRQUVJQyxNQUFKLEdBQWEsU0FBU0MsV0FBVCxHQUF1QjtVQUM5QkosRUFBSixFQUFRQSxHQUFHQyxHQUFIO0tBRFY7O1FBSUlGLEdBQUosR0FBVUEsR0FBVjs7OztBQUlKLEFBQU8sU0FBU00saUJBQVQsQ0FBMkJmLEVBQTNCLEVBQStCO01BQ2hDQSxHQUFHZ0IsT0FBSCxDQUFXQyxRQUFmLEVBQXlCO1dBQ2hCakIsR0FBR2dCLE9BQUgsQ0FBV0MsUUFBbEI7R0FERixNQUVPLElBQUlqQixHQUFHa0IsVUFBSCxDQUFjQyxPQUFkLEtBQTBCLEdBQTlCLEVBQW1DO1dBQ2pDbkIsR0FBR2tCLFVBQUgsQ0FBY0UsWUFBZCxDQUEyQixNQUEzQixDQUFQO0dBREssTUFFQTtXQUNFLElBQVA7Ozs7QUFJSixBQUFPLFNBQVNDLFFBQVQsQ0FBa0JyQixFQUFsQixFQUFzQnNCLE1BQXRCLEVBQThCQyxRQUE5QixFQUF3QztNQUN6Q0QsT0FBT0UsVUFBWCxFQUF1QjtRQUNmQyxRQUFRSCxPQUFPRSxVQUFyQjtXQUNPRixPQUFPRSxVQUFkO1dBQ09BLFVBQVAsR0FBb0JDLEtBQXBCOzs7TUFHRUgsT0FBT0ksU0FBWCxFQUFzQjtRQUNkRCxTQUFRSCxPQUFPSSxTQUFyQjtXQUNPSixPQUFPSSxTQUFkO1dBQ09BLFNBQVAsR0FBbUJELE1BQW5COzs7TUFHRUUsSUFBSTNCLEdBQUc0QixLQUFYO01BQ0lYLFdBQVcsRUFBZjs7T0FFSyxJQUFJWSxHQUFULElBQWdCUCxNQUFoQixFQUF3QjtRQUNsQkMsUUFBSixFQUFjO2VBQ0hNLEdBQVQsSUFBZ0JGLEVBQUVFLEdBQUYsS0FBVSxFQUExQjs7O01BR0FBLEdBQUYsSUFBU1AsT0FBT08sR0FBUCxDQUFUOzs7U0FHS1osUUFBUDs7O0FBR0YsQUFBTyxTQUFTYSxPQUFULENBQWlCQyxLQUFqQixFQUF3QkMsSUFBeEIsRUFBOEI7TUFDN0JDLFVBQVVDLE9BQU9DLG1CQUFQLENBQTJCRCxPQUFPRSxjQUFQLENBQXNCTCxLQUF0QixDQUEzQixDQUFoQjtVQUNRTSxPQUFSLENBQWdCLFNBQVNDLE9BQVQsQ0FBaUJDLE1BQWpCLEVBQXlCO1VBQ2pDQSxNQUFOLElBQWdCUixNQUFNUSxNQUFOLEVBQWNDLElBQWQsQ0FBbUJSLElBQW5CLENBQWhCO0dBREY7OztBQ3JFRixJQUFNUyxPQUFPLFNBQVBBLElBQU8sR0FBTSxFQUFuQjs7QUFFQSxzQkFBZTs7Ozs7Y0FLRCxJQUxDOzs7Ozs7Z0JBV0MsS0FYRDs7Ozs7O3VCQWlCUSxJQWpCUjs7Ozs7O3NCQXVCTyxHQXZCUDs7Ozs7OzRCQTZCYSw0QkE3QmI7Ozs7OztXQW1DSixvQkFuQ0k7Ozs7OzthQXlDRixDQXpDRTs7Ozs7O2FBK0NGLEdBL0NFOzs7Ozs7Y0FxREQsR0FyREM7Ozs7OzttQkEyREksRUEzREo7Ozs7OztVQWlFTCxHQWpFSzs7Ozs7Ozs7OztjQTJFRCxJQTNFQzs7Ozs7OztVQWtGTEEsSUFsRks7Ozs7OztXQXdGSkEsSUF4Rkk7Ozs7OztVQThGTEEsSUE5Rks7Ozs7OztVQW9HTEEsSUFwR0s7Ozs7OzthQTBHRkEsSUExR0U7Ozs7OztnQkFnSENBLElBaEhEOzs7Ozs7aUJBc0hFQSxJQXRIRjs7Ozs7O2dCQTRIQ0EsSUE1SEQ7Ozs7OzttQkFrSUlBLElBbElKOzs7Ozs7a0JBd0lHQSxJQXhJSDs7Ozs7O2lCQThJRUE7Q0E5SWpCOztBQ0FBLElBQU1DLGNBQWMsR0FBcEI7O0FBRUEsY0FBZTtNQUFBLGdCQUNSQyxRQURRLEVBQ0U7WUFDTCxJQUFSLEVBQWNBLFFBQWQ7R0FGVztPQUFBLGlCQUtQQyxDQUxPLEVBS0o7TUFDTEMsY0FBRjs7UUFFSUMsa0JBQWtCRixDQUFsQixDQUFKLEVBQTBCO2FBQ2pCRyxPQUFPQyxJQUFQLENBQ0wsS0FBS0MsTUFBTCxDQUFZQyxXQUFaLElBQTJCTixFQUFFTyxhQUFGLENBQWdCMUMsR0FEdEMsRUFFTCxRQUZLLENBQVA7S0FERixNQUtPO1VBQ0QsS0FBSzJDLEtBQVQsRUFBZ0I7WUFDVixLQUFLQyxRQUFULEVBQW1CO2VBQ1pDLEtBQUw7U0FERixNQUVPO2VBQ0FDLE9BQUw7O09BSkosTUFNTzthQUNBUCxJQUFMLENBQVVKLEVBQUVPLGFBQVo7OztHQXJCTztRQUFBLG9CQTBCSjtRQUNEbkQsS0FDSndELFNBQVNDLGVBQVQsSUFBNEJELFNBQVNFLElBQVQsQ0FBY3hDLFVBQTFDLElBQXdEc0MsU0FBU0UsSUFEbkU7UUFFTUMsYUFBYVosT0FBT2EsV0FBUCxJQUFzQjVELEdBQUcyRCxVQUE1QztRQUNNRSxZQUFZZCxPQUFPZSxXQUFQLElBQXNCOUQsR0FBRzZELFNBQTNDOztRQUVJLEtBQUtFLGtCQUFMLEtBQTRCLElBQWhDLEVBQXNDO1dBQy9CQSxrQkFBTCxHQUEwQjtXQUNyQkosVUFEcUI7V0FFckJFO09BRkw7OztRQU1JRyxTQUFTLEtBQUtELGtCQUFMLENBQXdCRSxDQUF4QixHQUE0Qk4sVUFBM0M7UUFDTU8sU0FBUyxLQUFLSCxrQkFBTCxDQUF3QkksQ0FBeEIsR0FBNEJOLFNBQTNDO1FBQ01PLFlBQVksS0FBS2hFLE9BQUwsQ0FBYWlFLGVBQS9COztRQUVJQyxLQUFLQyxHQUFMLENBQVNMLE1BQVQsS0FBb0JFLFNBQXBCLElBQWlDRSxLQUFLQyxHQUFMLENBQVNQLE1BQVQsS0FBb0JJLFNBQXpELEVBQW9FO1dBQzdETCxrQkFBTCxHQUEwQixJQUExQjtXQUNLVCxLQUFMOztHQTdDUztTQUFBLG1CQWlETFYsQ0FqREssRUFpREY7UUFDTDRCLFNBQVM1QixDQUFULENBQUosRUFBaUI7VUFDWCxLQUFLUyxRQUFULEVBQW1CO2FBQ1pDLEtBQUw7T0FERixNQUVPO2FBQ0FDLE9BQUwsQ0FBYSxLQUFLRCxLQUFsQjs7O0dBdERPO1dBQUEscUJBMkRIVixDQTNERyxFQTJEQTtRQUNQLENBQUM2QixhQUFhN0IsQ0FBYixDQUFELElBQW9CRSxrQkFBa0JGLENBQWxCLENBQXhCLEVBQThDO01BQzVDQyxjQUFGO1FBQ1E2QixPQUhHLEdBR2tCOUIsQ0FIbEIsQ0FHSDhCLE9BSEc7UUFHTUMsT0FITixHQUdrQi9CLENBSGxCLENBR00rQixPQUhOOzs7U0FLTkMsVUFBTCxHQUFrQkMsV0FDaEIsU0FBU0MsZUFBVCxHQUEyQjtXQUNwQkMsSUFBTCxDQUFVTCxPQUFWLEVBQW1CQyxPQUFuQjtLQURGLENBRUVuQyxJQUZGLENBRU8sSUFGUCxDQURnQixFQUloQkUsV0FKZ0IsQ0FBbEI7R0FoRVc7V0FBQSxxQkF3RUhFLENBeEVHLEVBd0VBO1FBQ1AsS0FBS1MsUUFBVCxFQUFtQjtTQUNkMkIsSUFBTCxDQUFVcEMsRUFBRThCLE9BQVosRUFBcUI5QixFQUFFK0IsT0FBdkI7R0ExRVc7U0FBQSxtQkE2RUwvQixDQTdFSyxFQTZFRjtRQUNMLENBQUM2QixhQUFhN0IsQ0FBYixDQUFELElBQW9CRSxrQkFBa0JGLENBQWxCLENBQXhCLEVBQThDO2lCQUNqQyxLQUFLZ0MsVUFBbEI7O1FBRUksS0FBS3ZCLFFBQVQsRUFBbUI7V0FDWkMsS0FBTDtLQURGLE1BRU87V0FDQUMsT0FBTDs7R0FwRlM7WUFBQSxzQkF3RkZYLENBeEZFLEVBd0ZDO01BQ1ZDLGNBQUY7c0JBQzZCRCxFQUFFcUMsT0FBRixDQUFVLENBQVYsQ0FGakI7UUFFSlAsT0FGSSxlQUVKQSxPQUZJO1FBRUtDLE9BRkwsZUFFS0EsT0FGTDs7O1NBSVBDLFVBQUwsR0FBa0JDLFdBQ2hCLFNBQVNLLGdCQUFULEdBQTRCO1dBQ3JCSCxJQUFMLENBQVVMLE9BQVYsRUFBbUJDLE9BQW5CO0tBREYsQ0FFRW5DLElBRkYsQ0FFTyxJQUZQLENBRGdCLEVBSWhCRSxXQUpnQixDQUFsQjtHQTVGVztXQUFBLHFCQW9HSEUsQ0FwR0csRUFvR0E7UUFDUCxLQUFLUyxRQUFULEVBQW1COzt1QkFFVVQsRUFBRXFDLE9BQUYsQ0FBVSxDQUFWLENBSGxCO1FBR0hQLE9BSEcsZ0JBR0hBLE9BSEc7UUFHTUMsT0FITixnQkFHTUEsT0FITjs7U0FJTkssSUFBTCxDQUFVTixPQUFWLEVBQW1CQyxPQUFuQjtHQXhHVztVQUFBLG9CQTJHSi9CLENBM0dJLEVBMkdEO1FBQ051QyxXQUFXdkMsQ0FBWCxDQUFKLEVBQW1CO2lCQUNOLEtBQUtnQyxVQUFsQjs7UUFFSSxLQUFLdkIsUUFBVCxFQUFtQjtXQUNaQyxLQUFMO0tBREYsTUFFTztXQUNBQyxPQUFMOztHQWxIUztjQUFBLDBCQXNIRTtTQUNSRCxLQUFMO0dBdkhXO2NBQUEsMEJBMEhFO1NBQ1JBLEtBQUw7O0NBM0hKOztBQStIQSxTQUFTbUIsWUFBVCxDQUFzQjdCLENBQXRCLEVBQXlCO1NBQ2hCQSxFQUFFd0MsTUFBRixLQUFhLENBQXBCOzs7QUFHRixTQUFTdEMsaUJBQVQsQ0FBMkJGLENBQTNCLEVBQThCO1NBQ3JCQSxFQUFFeUMsT0FBRixJQUFhekMsRUFBRTBDLE9BQXRCOzs7QUFHRixTQUFTSCxVQUFULENBQW9CdkMsQ0FBcEIsRUFBdUI7SUFDbkIyQyxhQUFGLENBQWdCQyxNQUFoQixHQUF5QixDQUF6Qjs7O0FBR0YsU0FBU2hCLFFBQVQsQ0FBa0I1QixDQUFsQixFQUFxQjtNQUNiNkMsT0FBTzdDLEVBQUVmLEdBQUYsSUFBU2UsRUFBRTZDLElBQXhCO1NBQ09BLFNBQVMsUUFBVCxJQUFxQjdDLEVBQUU4QyxPQUFGLEtBQWMsRUFBMUM7OztBQy9JRixjQUFlO01BQUEsZ0JBQ1IvQyxRQURRLEVBQ0U7U0FDUjNDLEVBQUwsR0FBVXdELFNBQVNtQyxhQUFULENBQXVCLEtBQXZCLENBQVY7U0FDS2hELFFBQUwsR0FBZ0JBLFFBQWhCO1NBQ0tpRCxNQUFMLEdBQWNwQyxTQUFTRSxJQUF2Qjs7YUFFUyxLQUFLMUQsRUFBZCxFQUFrQjtnQkFDTixPQURNO1dBRVgsQ0FGVztZQUdWLENBSFU7YUFJVCxDQUpTO2NBS1IsQ0FMUTtlQU1QO0tBTlg7O1NBU0s2RixXQUFMLENBQWlCbEQsU0FBU3ZDLE9BQTFCO1dBQ08sS0FBS0osRUFBWixFQUFnQixPQUFoQixFQUF5QjJDLFNBQVN6QyxPQUFULENBQWlCNEYsWUFBakIsQ0FBOEJ0RCxJQUE5QixDQUFtQ0csUUFBbkMsQ0FBekI7R0FoQlc7YUFBQSx1QkFtQkR2QyxPQW5CQyxFQW1CUTthQUNWLEtBQUtKLEVBQWQsRUFBa0I7Y0FDUkksUUFBUTJGLE1BREE7dUJBRUMzRixRQUFRNEYsT0FGVDt3Q0FJWjVGLFFBQVE2RixrQkFEWixtQkFFSTdGLFFBQVE4RjtLQUxkO0dBcEJXO1FBQUEsb0JBNkJKO1NBQ0ZOLE1BQUwsQ0FBWU8sV0FBWixDQUF3QixLQUFLbkcsRUFBN0I7R0E5Qlc7UUFBQSxvQkFpQ0o7U0FDRjRGLE1BQUwsQ0FBWVEsV0FBWixDQUF3QixLQUFLcEcsRUFBN0I7R0FsQ1c7UUFBQSxvQkFxQ0o7U0FDRkEsRUFBTCxDQUFRcUcsV0FBUjtTQUNLckcsRUFBTCxDQUFRNEIsS0FBUixDQUFjMEUsT0FBZCxHQUF3QixLQUFLM0QsUUFBTCxDQUFjdkMsT0FBZCxDQUFzQm1HLFNBQTlDO0dBdkNXO1NBQUEscUJBMENIO1NBQ0h2RyxFQUFMLENBQVE0QixLQUFSLENBQWMwRSxPQUFkLEdBQXdCLENBQXhCOztDQTNDSjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0FBOztBQUVBLElBQU1FLGNBQWMsQ0FBcEI7O0FBRUEsYUFBZTtNQUFBLGdCQUNSeEcsRUFEUSxFQUNKMkMsUUFESSxFQUNNO1NBQ1ozQyxFQUFMLEdBQVVBLEVBQVY7U0FDSzJDLFFBQUwsR0FBZ0JBLFFBQWhCO1NBQ0s4RCxZQUFMLEdBQW9CLEtBQUt6RyxFQUFMLENBQVFvQixZQUFSLENBQXFCLEtBQXJCLENBQXBCO1NBQ0tzRixNQUFMLEdBQWMsS0FBSzFHLEVBQUwsQ0FBUW9CLFlBQVIsQ0FBcUIsUUFBckIsQ0FBZDtTQUNLOEIsV0FBTCxHQUFtQm5DLGtCQUFrQixLQUFLZixFQUF2QixDQUFuQjtTQUNLMkcsSUFBTCxHQUFZLEtBQUszRyxFQUFMLENBQVE0RyxxQkFBUixFQUFaO1NBQ0tDLFNBQUwsR0FBaUIsSUFBakI7U0FDS0MsS0FBTCxHQUFhLElBQWI7U0FDS0MsU0FBTCxHQUFpQixJQUFqQjtTQUNLQyxVQUFMLEdBQWtCLElBQWxCO0dBWFc7UUFBQSxvQkFjSjs0QkFNSCxLQUFLckUsUUFBTCxDQUFjdkMsT0FOWDtRQUVMMkYsTUFGSyxxQkFFTEEsTUFGSztRQUdMa0IsVUFISyxxQkFHTEEsVUFISztRQUlMaEIsa0JBSksscUJBSUxBLGtCQUpLO1FBS0xDLHdCQUxLLHFCQUtMQSx3QkFMSzs7U0FPRlcsU0FBTCxHQUFpQixLQUFLSyxrQkFBTCxFQUFqQjtTQUNLSixLQUFMLEdBQWEsS0FBS0ssY0FBTCxFQUFiOztTQUVLSixTQUFMLEdBQWlCO2dCQUNMLFVBREs7Y0FFUGhCLFNBQVMsQ0FGRjtjQUdQa0IsYUFBYW5ILE9BQU9pRixJQUFwQixHQUEyQmpGLE9BQU9zSCxPQUgzQjswQ0FLWG5CLGtCQURKLG1CQUVJQyx3QkFOVztrQ0FPVyxLQUFLVyxTQUFMLENBQWU1QyxDQUF6QyxZQUNFLEtBQUs0QyxTQUFMLENBQWUxQyxDQURqQixZQUVPcUMsV0FGUCwyQkFHVSxLQUFLTSxLQUFMLENBQVc3QyxDQUhyQixTQUcwQixLQUFLNkMsS0FBTCxDQUFXM0MsQ0FIckMsTUFQZTtjQVdKLEtBQUt3QyxJQUFMLENBQVVVLE1BQXJCLE9BWGU7YUFZTCxLQUFLVixJQUFMLENBQVVXLEtBQXBCOzs7S0FaRixDQWdCQSxLQUFLdEgsRUFBTCxDQUFRcUcsV0FBUjs7O1NBR0tXLFVBQUwsR0FBa0IzRixTQUFTLEtBQUtyQixFQUFkLEVBQWtCLEtBQUsrRyxTQUF2QixFQUFrQyxJQUFsQyxDQUFsQjtHQTNDVztTQUFBLHFCQThDSDs7U0FFSC9HLEVBQUwsQ0FBUXFHLFdBQVI7O2FBRVMsS0FBS3JHLEVBQWQsRUFBa0IsRUFBRTBCLFdBQVcsTUFBYixFQUFsQjtHQWxEVztNQUFBLGdCQXFEUnVDLENBckRRLEVBcURMRSxDQXJESyxFQXFERm9ELFVBckRFLEVBcURVO1FBQ2ZDLGVBQWVDLGlCQUFyQjtRQUNPQyxFQUZjLEdBRUhGLGFBQWF2RCxDQUFiLEdBQWlCQSxDQUZkO1FBRVYwRCxFQUZVLEdBRWlCSCxhQUFhckQsQ0FBYixHQUFpQkEsQ0FGbEM7OzthQUlaLEtBQUtuRSxFQUFkLEVBQWtCO2NBQ1JGLE9BQU9rRixJQURDOzZDQUdaLEtBQUs2QixTQUFMLENBQWU1QyxDQUFmLEdBQW1CeUQsRUFEdkIsY0FDZ0MsS0FBS2IsU0FBTCxDQUFlMUMsQ0FBZixHQUM5QndELEVBRkYsYUFFV25CLFdBRlgsNEJBR1UsS0FBS00sS0FBTCxDQUFXN0MsQ0FBWCxHQUFlc0QsVUFIekIsV0FHdUMsS0FBS1QsS0FBTCxDQUFXM0MsQ0FBWCxHQUFlb0QsVUFIdEQ7S0FGRjtHQXpEVztNQUFBLGdCQWtFUnRELENBbEVRLEVBa0VMRSxDQWxFSyxFQWtFRm9ELFVBbEVFLEVBa0VVO1FBQ2ZDLGVBQWVDLGlCQUFyQjtRQUNPQyxFQUZjLEdBRUhGLGFBQWF2RCxDQUFiLEdBQWlCQSxDQUZkO1FBRVYwRCxFQUZVLEdBRWlCSCxhQUFhckQsQ0FBYixHQUFpQkEsQ0FGbEM7OzthQUlaLEtBQUtuRSxFQUFkLEVBQWtCO2tCQUNKLFdBREk7NkNBR1osS0FBSzZHLFNBQUwsQ0FBZTVDLENBQWYsR0FBbUJ5RCxFQUR2QixjQUNnQyxLQUFLYixTQUFMLENBQWUxQyxDQUFmLEdBQzlCd0QsRUFGRixhQUVXbkIsV0FGWCw0QkFHVSxLQUFLTSxLQUFMLENBQVc3QyxDQUFYLEdBQWVzRCxVQUh6QixXQUd1QyxLQUFLVCxLQUFMLENBQVczQyxDQUFYLEdBQWVvRCxVQUh0RDtLQUZGO0dBdEVXO21CQUFBLCtCQStFTzthQUNULEtBQUt2SCxFQUFkLEVBQWtCLEtBQUtnSCxVQUF2QjtHQWhGVztrQkFBQSw4QkFtRk07YUFDUixLQUFLaEgsRUFBZCxFQUFrQixLQUFLK0csU0FBdkI7R0FwRlc7ZUFBQSwyQkF1Rkc7UUFDVixLQUFLN0QsV0FBVCxFQUFzQjtVQUNkaEMsYUFBYSxLQUFLbEIsRUFBTCxDQUFRa0IsVUFBM0I7O1VBRUksS0FBS3dGLE1BQVQsRUFBaUI7YUFDVjFHLEVBQUwsQ0FBUTRILGVBQVIsQ0FBd0IsUUFBeEI7OztVQUdJQyxPQUFPLEtBQUs3SCxFQUFMLENBQVE4SCxTQUFSLENBQWtCLEtBQWxCLENBQWI7Ozs7V0FJS0MsWUFBTCxDQUFrQixLQUFsQixFQUF5QixLQUFLN0UsV0FBOUI7V0FDS3RCLEtBQUwsQ0FBV29HLFFBQVgsR0FBc0IsT0FBdEI7V0FDS3BHLEtBQUwsQ0FBV3FHLFVBQVgsR0FBd0IsUUFBeEI7aUJBQ1c5QixXQUFYLENBQXVCMEIsSUFBdkI7OztpQkFJRSxTQUFTSyxTQUFULEdBQXFCO2FBQ2RsSSxFQUFMLENBQVErSCxZQUFSLENBQXFCLEtBQXJCLEVBQTRCLEtBQUs3RSxXQUFqQzttQkFDV2tELFdBQVgsQ0FBdUJ5QixJQUF2QjtPQUZGLENBR0VyRixJQUhGLENBR08sSUFIUCxDQURGLEVBS0UsRUFMRjs7R0F6R1M7aUJBQUEsNkJBbUhLO1FBQ1osS0FBS1UsV0FBVCxFQUFzQjtVQUNoQixLQUFLd0QsTUFBVCxFQUFpQjthQUNWMUcsRUFBTCxDQUFRK0gsWUFBUixDQUFxQixRQUFyQixFQUErQixLQUFLckIsTUFBcEM7O1dBRUcxRyxFQUFMLENBQVErSCxZQUFSLENBQXFCLEtBQXJCLEVBQTRCLEtBQUt0QixZQUFqQzs7R0F4SFM7b0JBQUEsZ0NBNEhRO1FBQ2JlLGVBQWVDLGlCQUFyQjtRQUNNVSxlQUFlO1NBQ2hCLEtBQUt4QixJQUFMLENBQVV5QixJQUFWLEdBQWlCLEtBQUt6QixJQUFMLENBQVVXLEtBQVYsR0FBa0IsQ0FEbkI7U0FFaEIsS0FBS1gsSUFBTCxDQUFVMEIsR0FBVixHQUFnQixLQUFLMUIsSUFBTCxDQUFVVSxNQUFWLEdBQW1COzs7S0FGeEMsQ0FNQSxPQUFPO1NBQ0ZHLGFBQWF2RCxDQUFiLEdBQWlCa0UsYUFBYWxFLENBRDVCO1NBRUZ1RCxhQUFhckQsQ0FBYixHQUFpQmdFLGFBQWFoRTtLQUZuQztHQXBJVztnQkFBQSw0QkEwSUk7c0JBQ3lCLEtBQUtuRSxFQUFMLENBQVFnQixPQURqQztRQUNQc0gsYUFETyxlQUNQQSxhQURPO1FBQ1FDLFlBRFIsZUFDUUEsWUFEUjs2QkFFbUIsS0FBSzVGLFFBQUwsQ0FBY3ZDLE9BRmpDO1FBRVBvSSxVQUZPLHNCQUVQQSxVQUZPO1FBRUtDLFNBRkwsc0JBRUtBLFNBRkw7OztRQUlYLENBQUNELFVBQUQsSUFBZUYsYUFBZixJQUFnQ0MsWUFBcEMsRUFBa0Q7YUFDekM7V0FDRkEsZUFBZSxLQUFLNUIsSUFBTCxDQUFVVyxLQUR2QjtXQUVGZ0IsZ0JBQWdCLEtBQUszQixJQUFMLENBQVVVO09BRi9CO0tBREYsTUFLTyxJQUFJbUIsY0FBYyxRQUFPQSxVQUFQLHlDQUFPQSxVQUFQLE9BQXNCLFFBQXhDLEVBQWtEO2FBQ2hEO1dBQ0ZBLFdBQVdsQixLQUFYLEdBQW1CLEtBQUtYLElBQUwsQ0FBVVcsS0FEM0I7V0FFRmtCLFdBQVduQixNQUFYLEdBQW9CLEtBQUtWLElBQUwsQ0FBVVU7T0FGbkM7S0FESyxNQUtBO1VBQ0NxQixrQkFBa0IsS0FBSy9CLElBQUwsQ0FBVVcsS0FBVixHQUFrQixDQUExQztVQUNNcUIsbUJBQW1CLEtBQUtoQyxJQUFMLENBQVVVLE1BQVYsR0FBbUIsQ0FBNUM7VUFDTUcsZUFBZUMsaUJBQXJCOzs7VUFHTW1CLHlCQUF5QjtXQUMxQnBCLGFBQWF2RCxDQUFiLEdBQWlCeUUsZUFEUztXQUUxQmxCLGFBQWFyRCxDQUFiLEdBQWlCd0U7T0FGdEI7O1VBS01FLG9CQUFvQkQsdUJBQXVCM0UsQ0FBdkIsR0FBMkJ5RSxlQUFyRDtVQUNNSSxrQkFBa0JGLHVCQUF1QnpFLENBQXZCLEdBQTJCd0UsZ0JBQW5EOzs7O1VBSU03QixRQUFRMkIsWUFBWW5FLEtBQUt5RSxHQUFMLENBQVNGLGlCQUFULEVBQTRCQyxlQUE1QixDQUExQjs7VUFFSU4sY0FBYyxPQUFPQSxVQUFQLEtBQXNCLFFBQXhDLEVBQWtEOztZQUUxQ1EsZUFBZVQsZ0JBQWdCLEtBQUt2SSxFQUFMLENBQVFnSixZQUE3QztZQUNNQyxnQkFBZ0JYLGlCQUFpQixLQUFLdEksRUFBTCxDQUFRaUosYUFBL0M7WUFDTUMsa0JBQ0pDLFdBQVdYLFVBQVgsSUFBeUJRLFlBQXpCLElBQXlDLE1BQU0sS0FBS3JDLElBQUwsQ0FBVVcsS0FBekQsQ0FERjtZQUVNOEIsbUJBQ0pELFdBQVdYLFVBQVgsSUFBeUJTLGFBQXpCLElBQTBDLE1BQU0sS0FBS3RDLElBQUwsQ0FBVVUsTUFBMUQsQ0FERjs7O1lBSUlQLFFBQVFvQyxlQUFSLElBQTJCcEMsUUFBUXNDLGdCQUF2QyxFQUF5RDtpQkFDaEQ7ZUFDRkYsZUFERTtlQUVGRTtXQUZMOzs7O2FBT0c7V0FDRnRDLEtBREU7V0FFRkE7T0FGTDs7O0NBNUxOOztBQW9NQSxTQUFTVyxlQUFULEdBQTJCO01BQ25CNEIsUUFBUTdGLFNBQVNDLGVBQXZCO01BQ002RixjQUFjaEYsS0FBS3lFLEdBQUwsQ0FBU00sTUFBTUUsV0FBZixFQUE0QnhHLE9BQU95RyxVQUFuQyxDQUFwQjtNQUNNQyxlQUFlbkYsS0FBS3lFLEdBQUwsQ0FBU00sTUFBTUssWUFBZixFQUE2QjNHLE9BQU80RyxXQUFwQyxDQUFyQjs7U0FFTztPQUNGTCxjQUFjLENBRFo7T0FFRkcsZUFBZTtHQUZwQjs7O0FDeE1GOzs7O0lBR3FCRzs7OzttQkFJUHhKLE9BQVosRUFBcUI7OztTQUNkNkMsTUFBTCxHQUFjZixPQUFPMkgsTUFBUCxDQUFjNUcsTUFBZCxDQUFkO1NBQ0s2RyxPQUFMLEdBQWU1SCxPQUFPMkgsTUFBUCxDQUFjQyxPQUFkLENBQWY7U0FDSzVKLE9BQUwsR0FBZWdDLE9BQU8ySCxNQUFQLENBQWMzSixPQUFkLENBQWY7U0FDS3dELElBQUwsR0FBWUYsU0FBU0UsSUFBckI7O1NBRUtOLEtBQUwsR0FBYSxLQUFiO1NBQ0syRyxJQUFMLEdBQVksS0FBWjtTQUNLMUcsUUFBTCxHQUFnQixJQUFoQjtTQUNLVSxrQkFBTCxHQUEwQixJQUExQjtTQUNLYSxVQUFMLEdBQWtCLElBQWxCOztTQUVLeEUsT0FBTCxHQUFlNEosU0FBYyxFQUFkLEVBQWtCQyxlQUFsQixFQUFtQzdKLE9BQW5DLENBQWY7U0FDSzBKLE9BQUwsQ0FBYUksSUFBYixDQUFrQixJQUFsQjtTQUNLaEssT0FBTCxDQUFhZ0ssSUFBYixDQUFrQixJQUFsQjs7Ozs7Ozs7Ozs7OzhCQVFLbEssSUFBSTtVQUNMLE9BQU9BLEVBQVAsS0FBYyxRQUFsQixFQUE0QjtZQUNwQm1LLE1BQU0zRyxTQUFTNEcsZ0JBQVQsQ0FBMEJwSyxFQUExQixDQUFaO1lBQ0lxSyxJQUFJRixJQUFJM0UsTUFBWjs7ZUFFTzZFLEdBQVAsRUFBWTtlQUNMdEssTUFBTCxDQUFZb0ssSUFBSUUsQ0FBSixDQUFaOztPQUxKLE1BT08sSUFBSXJLLEdBQUdtQixPQUFILEtBQWUsS0FBbkIsRUFBMEI7V0FDNUJTLEtBQUgsQ0FBUzlCLE1BQVQsR0FBa0JBLE9BQU93SyxNQUF6QjtlQUNPdEssRUFBUCxFQUFXLE9BQVgsRUFBb0IsS0FBS0UsT0FBTCxDQUFhcUssS0FBakM7O1lBRUksS0FBS25LLE9BQUwsQ0FBYW9LLFlBQWpCLEVBQStCO29CQUNuQnpKLGtCQUFrQmYsRUFBbEIsQ0FBVjs7OzthQUlHLElBQVA7Ozs7Ozs7Ozs7OzJCQVFLSSxTQUFTO1VBQ1ZBLE9BQUosRUFBYTtpQkFDRyxLQUFLQSxPQUFuQixFQUE0QkEsT0FBNUI7YUFDSzBKLE9BQUwsQ0FBYWpFLFdBQWIsQ0FBeUIsS0FBS3pGLE9BQTlCO2VBQ08sSUFBUDtPQUhGLE1BSU87ZUFDRSxLQUFLQSxPQUFaOzs7Ozs7Ozs7Ozs7Ozs7eUJBWUNKLElBQThCOzs7VUFBMUJVLEVBQTBCLHVFQUFyQixLQUFLTixPQUFMLENBQWFxSyxNQUFROztVQUM3QixLQUFLckgsS0FBTCxJQUFjLEtBQUsyRyxJQUF2QixFQUE2Qjs7VUFFdkI5RyxZQUFTLE9BQU9qRCxFQUFQLEtBQWMsUUFBZCxHQUF5QndELFNBQVNrSCxhQUFULENBQXVCMUssRUFBdkIsQ0FBekIsR0FBc0RBLEVBQXJFOztVQUVJaUQsVUFBTzlCLE9BQVAsS0FBbUIsS0FBdkIsRUFBOEI7O1dBRXpCZixPQUFMLENBQWF1SyxZQUFiLENBQTBCMUgsU0FBMUI7O1dBRUtBLE1BQUwsQ0FBWWlILElBQVosQ0FBaUJqSCxTQUFqQixFQUF5QixJQUF6Qjs7VUFFSSxDQUFDLEtBQUs3QyxPQUFMLENBQWFvSyxZQUFsQixFQUFnQztZQUN0QnRILFdBRHNCLEdBQ04sS0FBS0QsTUFEQyxDQUN0QkMsV0FEc0I7OztZQUcxQkEsZUFBZSxJQUFuQixFQUF5QjtlQUNsQjlDLE9BQUwsQ0FBYXdLLGNBQWIsQ0FBNEIzSCxTQUE1QjtvQkFDVUMsV0FBVixFQUF1QixLQUFLOUMsT0FBTCxDQUFheUssYUFBcEM7Ozs7V0FJQ3pILEtBQUwsR0FBYSxJQUFiO1dBQ0syRyxJQUFMLEdBQVksSUFBWjs7V0FFSzlHLE1BQUwsQ0FBWXFILE1BQVo7V0FDS1IsT0FBTCxDQUFhZ0IsTUFBYjtXQUNLaEIsT0FBTCxDQUFhaUIsTUFBYjs7YUFFT3ZILFFBQVAsRUFBaUIsUUFBakIsRUFBMkIsS0FBS3RELE9BQUwsQ0FBYThLLE1BQXhDO2FBQ094SCxRQUFQLEVBQWlCLFNBQWpCLEVBQTRCLEtBQUt0RCxPQUFMLENBQWErSyxPQUF6Qzs7VUFFSSxLQUFLN0ssT0FBTCxDQUFhOEssbUJBQWpCLEVBQXNDO2VBQzdCbkksTUFBUCxFQUFlLFFBQWYsRUFBeUIsS0FBSzdDLE9BQUwsQ0FBYWlMLFlBQXRDOzs7VUFHSUMsWUFBWSxTQUFaQSxTQUFZLEdBQU07ZUFDZm5JLFNBQVAsRUFBZSxlQUFmLEVBQWdDbUksU0FBaEMsRUFBMkMsS0FBM0M7Y0FDS3JCLElBQUwsR0FBWSxLQUFaO2NBQ0s5RyxNQUFMLENBQVlvSSxhQUFaOztZQUVJLE1BQUtqTCxPQUFMLENBQWE2RyxVQUFqQixFQUE2Qjs4QkFDUHpELFFBQXBCLEVBQThCLE1BQUt0RCxPQUFuQyxFQUE0QyxJQUE1Qzs7O1dBR0MrQyxTQUFIO09BVEY7O2FBWU9BLFNBQVAsRUFBZSxlQUFmLEVBQWdDbUksU0FBaEM7O2FBRU8sSUFBUDs7Ozs7Ozs7Ozs7Ozs0QkFVK0I7OztVQUEzQjFLLEVBQTJCLHVFQUF0QixLQUFLTixPQUFMLENBQWFrTCxPQUFTOztVQUMzQixDQUFDLEtBQUtsSSxLQUFOLElBQWUsS0FBSzJHLElBQXhCLEVBQThCOztVQUV4QjlHLFlBQVMsS0FBS0EsTUFBTCxDQUFZakQsRUFBM0I7O1dBRUtJLE9BQUwsQ0FBYW1MLGFBQWIsQ0FBMkJ0SSxTQUEzQjs7V0FFSzhHLElBQUwsR0FBWSxJQUFaO1dBQ0tyRyxJQUFMLENBQVU5QixLQUFWLENBQWdCOUIsTUFBaEIsR0FBeUJBLE9BQU8wTCxPQUFoQztXQUNLMUIsT0FBTCxDQUFhMkIsT0FBYjtXQUNLeEksTUFBTCxDQUFZbUUsT0FBWjs7YUFFTzVELFFBQVAsRUFBaUIsUUFBakIsRUFBMkIsS0FBS3RELE9BQUwsQ0FBYThLLE1BQXhDLEVBQWdELEtBQWhEO2FBQ094SCxRQUFQLEVBQWlCLFNBQWpCLEVBQTRCLEtBQUt0RCxPQUFMLENBQWErSyxPQUF6QyxFQUFrRCxLQUFsRDs7VUFFSSxLQUFLN0ssT0FBTCxDQUFhOEssbUJBQWpCLEVBQXNDO2VBQzdCbkksTUFBUCxFQUFlLFFBQWYsRUFBeUIsS0FBSzdDLE9BQUwsQ0FBYWlMLFlBQXRDLEVBQW9ELEtBQXBEOzs7VUFHSU8sYUFBYSxTQUFiQSxVQUFhLEdBQU07ZUFDaEJ6SSxTQUFQLEVBQWUsZUFBZixFQUFnQ3lJLFVBQWhDLEVBQTRDLEtBQTVDOztlQUVLdEksS0FBTCxHQUFhLEtBQWI7ZUFDSzJHLElBQUwsR0FBWSxLQUFaOztlQUVLOUcsTUFBTCxDQUFZMEksZUFBWjs7WUFFSSxPQUFLdkwsT0FBTCxDQUFhNkcsVUFBakIsRUFBNkI7OEJBQ1B6RCxRQUFwQixFQUE4QixPQUFLdEQsT0FBbkMsRUFBNEMsS0FBNUM7OztlQUdHK0MsTUFBTCxDQUFZMkksaUJBQVo7ZUFDSzlCLE9BQUwsQ0FBYStCLE1BQWI7O1dBRUc1SSxTQUFIO09BZkY7O2FBa0JPQSxTQUFQLEVBQWUsZUFBZixFQUFnQ3lJLFVBQWhDOzthQUVPLElBQVA7Ozs7Ozs7Ozs7Ozs7Ozs7eUJBYUd6SCxHQUFHRSxHQUFtRTtVQUFoRW9ELFVBQWdFLHVFQUFuRCxLQUFLbkgsT0FBTCxDQUFhbUgsVUFBc0M7VUFBMUI3RyxFQUEwQix1RUFBckIsS0FBS04sT0FBTCxDQUFhMEwsTUFBUTs7VUFDckUsQ0FBQyxLQUFLMUksS0FBTixJQUFlLEtBQUsyRyxJQUF4QixFQUE4Qjs7VUFFeEI5RyxZQUFTLEtBQUtBLE1BQUwsQ0FBWWpELEVBQTNCOztXQUVLSSxPQUFMLENBQWEyTCxZQUFiLENBQTBCOUksU0FBMUI7O1dBRUtJLFFBQUwsR0FBZ0IsS0FBaEI7V0FDS0osTUFBTCxDQUFZOEIsSUFBWixDQUFpQmQsQ0FBakIsRUFBb0JFLENBQXBCLEVBQXVCb0QsVUFBdkI7O1VBRU15RSxZQUFZLFNBQVpBLFNBQVksR0FBTTtlQUNmL0ksU0FBUCxFQUFlLGVBQWYsRUFBZ0MrSSxTQUFoQyxFQUEyQyxLQUEzQztXQUNHL0ksU0FBSDtPQUZGOzthQUtPQSxTQUFQLEVBQWUsZUFBZixFQUFnQytJLFNBQWhDOzthQUVPLElBQVA7Ozs7Ozs7Ozs7Ozs7Ozs7eUJBYUcvSCxHQUFHRSxHQUFtRTtVQUFoRW9ELFVBQWdFLHVFQUFuRCxLQUFLbkgsT0FBTCxDQUFhbUgsVUFBc0M7VUFBMUI3RyxFQUEwQix1RUFBckIsS0FBS04sT0FBTCxDQUFhNkwsTUFBUTs7VUFDckUsQ0FBQyxLQUFLN0ksS0FBTixJQUFlLEtBQUsyRyxJQUF4QixFQUE4Qjs7V0FFekIxRyxRQUFMLEdBQWdCLEtBQWhCO1dBQ0tLLElBQUwsQ0FBVTlCLEtBQVYsQ0FBZ0I5QixNQUFoQixHQUF5QkEsT0FBT2tGLElBQWhDO1dBQ0svQixNQUFMLENBQVkrQixJQUFaLENBQWlCZixDQUFqQixFQUFvQkUsQ0FBcEIsRUFBdUJvRCxVQUF2Qjs7VUFFTXRFLFlBQVMsS0FBS0EsTUFBTCxDQUFZakQsRUFBM0I7O1VBRU1rTSxZQUFZLFNBQVpBLFNBQVksR0FBTTtlQUNmakosU0FBUCxFQUFlLGVBQWYsRUFBZ0NpSixTQUFoQyxFQUEyQyxLQUEzQztXQUNHakosU0FBSDtPQUZGOzthQUtPQSxTQUFQLEVBQWUsZUFBZixFQUFnQ2lKLFNBQWhDOzthQUVPLElBQVA7Ozs7Ozs7Ozs7Ozs7OEJBVW1DOzs7VUFBN0J4TCxFQUE2Qix1RUFBeEIsS0FBS04sT0FBTCxDQUFhK0wsU0FBVzs7VUFDL0IsQ0FBQyxLQUFLL0ksS0FBTixJQUFlLEtBQUsyRyxJQUF4QixFQUE4Qjs7VUFFeEI5RyxZQUFTLEtBQUtBLE1BQUwsQ0FBWWpELEVBQTNCOztXQUVLSSxPQUFMLENBQWFnTSxlQUFiLENBQTZCbkosU0FBN0I7O1dBRUs4RyxJQUFMLEdBQVksSUFBWjtXQUNLckcsSUFBTCxDQUFVOUIsS0FBVixDQUFnQjlCLE1BQWhCLEdBQXlCQSxPQUFPMEwsT0FBaEM7V0FDS3ZJLE1BQUwsQ0FBWW9KLGdCQUFaOztVQUVNQyxlQUFlLFNBQWZBLFlBQWUsR0FBTTtlQUNsQnJKLFNBQVAsRUFBZSxlQUFmLEVBQWdDcUosWUFBaEMsRUFBOEMsS0FBOUM7ZUFDS3ZDLElBQUwsR0FBWSxLQUFaO2VBQ0sxRyxRQUFMLEdBQWdCLElBQWhCO1dBQ0dKLFNBQUg7T0FKRjs7YUFPT0EsU0FBUCxFQUFlLGVBQWYsRUFBZ0NxSixZQUFoQzs7YUFFTyxJQUFQOzs7Ozs7O0FBSUosU0FBU0MsbUJBQVQsQ0FBNkJ2TSxFQUE3QixFQUFpQ0UsVUFBakMsRUFBMENDLEdBQTFDLEVBQStDO01BQ3ZDcU0sUUFBUSxDQUNaLFdBRFksRUFFWixXQUZZLEVBR1osU0FIWSxFQUlaLFlBSlksRUFLWixXQUxZLEVBTVosVUFOWSxDQUFkOztRQVNNbkssT0FBTixDQUFjLFNBQVNvSyxjQUFULENBQXdCQyxJQUF4QixFQUE4QjtXQUNuQzFNLEVBQVAsRUFBVzBNLElBQVgsRUFBaUJ4TSxXQUFRd00sSUFBUixDQUFqQixFQUFnQ3ZNLEdBQWhDO0dBREY7Ozs7OyJ9
