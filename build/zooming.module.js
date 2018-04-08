var webkitPrefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : '';

var cursor = {
  default: 'auto',
  zoomIn: webkitPrefix + 'zoom-in',
  zoomOut: webkitPrefix + 'zoom-out',
  grab: webkitPrefix + 'grab',
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
  checkTrans(styles);

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

var trans = sniffTransition(document.createElement('div'));
var transformCssProp = trans.transformCssProp;
var transEndEvent = trans.transEndEvent;

function checkTrans(styles) {
  var transitionProp = trans.transitionProp,
      transformProp = trans.transformProp;


  if (styles.transition) {
    var value = styles.transition;
    delete styles.transition;
    styles[transitionProp] = value;
  }

  if (styles.transform) {
    var _value = styles.transform;
    delete styles.transform;
    styles[transformProp] = _value;
  }
}

function sniffTransition(el) {
  var res = {};
  var trans = ['webkitTransition', 'transition', 'mozTransition'];
  var tform = ['webkitTransform', 'transform', 'mozTransform'];
  var end = {
    transition: 'transitionend',
    mozTransition: 'transitionend',
    webkitTransition: 'webkitTransitionEnd'
  };

  trans.some(function hasTransition(prop) {
    if (el.style[prop] !== undefined) {
      res.transitionProp = prop;
      res.transEndEvent = end[prop];
      return true;
    }
  });

  tform.some(function hasTransform(prop) {
    if (el.style[prop] !== undefined) {
      res.transformProp = prop;
      res.transformCssProp = prop.replace(/(.*)Transform/, '-$1-transform');
      return true;
    }
  });

  return res;
}

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
  onOpen: null,

  /**
   * Same as above, except fired when closed.
   * @type {Function}
   */
  onClose: null,

  /**
   * Same as above, except fired when grabbed.
   * @type {Function}
   */
  onGrab: null,

  /**
   * Same as above, except fired when moved.
   * @type {Function}
   */
  onMove: null,

  /**
   * Same as above, except fired when released.
   * @type {Function}
   */
  onRelease: null,

  /**
   * A callback function that will be called before open.
   * @type {Function}
   */
  onBeforeOpen: null,

  /**
   * A callback function that will be called before close.
   * @type {Function}
   */
  onBeforeClose: null,

  /**
   * A callback function that will be called before grab.
   * @type {Function}
   */
  onBeforeGrab: null,

  /**
   * A callback function that will be called before release.
   * @type {Function}
   */
  onBeforeRelease: null
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
      transition: transformCssProp + '\n        ' + transitionDuration + 's\n        ' + transitionTimingFunction,
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
      transition: transformCssProp,
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

      if (this.options.onBeforeOpen) {
        this.options.onBeforeOpen(target$$1);
      }

      this.target.init(target$$1, this);

      if (!this.options.preloadImage) {
        loadImage(this.target.srcOriginal);
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
        listen(target$$1, transEndEvent, onOpenEnd, false);
        _this.lock = false;
        _this.target.upgradeSource();

        if (_this.options.enableGrab) {
          toggleGrabListeners(document, _this.handler, true);
        }

        if (cb) cb(target$$1);
      };

      listen(target$$1, transEndEvent, onOpenEnd);

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

      if (this.options.onBeforeClose) {
        this.options.onBeforeClose(target$$1);
      }

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
        listen(target$$1, transEndEvent, onCloseEnd, false);

        _this2.shown = false;
        _this2.lock = false;

        _this2.target.downgradeSource();

        if (_this2.options.enableGrab) {
          toggleGrabListeners(document, _this2.handler, false);
        }

        _this2.target.restoreCloseStyle();
        _this2.overlay.remove();

        if (cb) cb(target$$1);
      };

      listen(target$$1, transEndEvent, onCloseEnd);

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

      if (this.options.onBeforeGrab) {
        this.options.onBeforeGrab(target$$1);
      }

      this.released = false;
      this.target.grab(x, y, scaleExtra);

      var onGrabEnd = function onGrabEnd() {
        listen(target$$1, transEndEvent, onGrabEnd, false);
        if (cb) cb(target$$1);
      };

      listen(target$$1, transEndEvent, onGrabEnd);

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
        listen(target$$1, transEndEvent, onMoveEnd, false);
        if (cb) cb(target$$1);
      };

      listen(target$$1, transEndEvent, onMoveEnd);

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

      if (this.options.onBeforeRelease) {
        this.options.onBeforeRelease(target$$1);
      }

      this.lock = true;
      this.body.style.cursor = cursor.default;
      this.target.restoreOpenStyle();

      var onReleaseEnd = function onReleaseEnd() {
        listen(target$$1, transEndEvent, onReleaseEnd, false);
        _this3.lock = false;
        _this3.released = true;

        if (cb) cb(target$$1);
      };

      listen(target$$1, transEndEvent, onReleaseEnd);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9vbWluZy5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyIsIi4uL3NyYy9vcHRpb25zLmpzIiwiLi4vc3JjL2hhbmRsZXIuanMiLCIuLi9zcmMvb3ZlcmxheS5qcyIsIi4uL3NyYy90YXJnZXQuanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IHdlYmtpdFByZWZpeCA9ICdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGVcbiAgPyAnLXdlYmtpdC0nXG4gIDogJydcblxuZXhwb3J0IGNvbnN0IGN1cnNvciA9IHtcbiAgZGVmYXVsdDogJ2F1dG8nLFxuICB6b29tSW46IGAke3dlYmtpdFByZWZpeH16b29tLWluYCxcbiAgem9vbU91dDogYCR7d2Via2l0UHJlZml4fXpvb20tb3V0YCxcbiAgZ3JhYjogYCR7d2Via2l0UHJlZml4fWdyYWJgLFxuICBtb3ZlOiAnbW92ZSdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RlbiAoZWwsIGV2ZW50LCBoYW5kbGVyLCBhZGQgPSB0cnVlKSB7XG4gIGNvbnN0IG9wdGlvbnMgPSB7IHBhc3NpdmU6IGZhbHNlIH1cblxuICBpZiAoYWRkKSB7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgaGFuZGxlciwgb3B0aW9ucylcbiAgfSBlbHNlIHtcbiAgICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyLCBvcHRpb25zKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkSW1hZ2UgKHNyYywgY2IpIHtcbiAgaWYgKHNyYykge1xuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpXG5cbiAgICBpbWcub25sb2FkID0gZnVuY3Rpb24gb25JbWFnZUxvYWQgKCkge1xuICAgICAgaWYgKGNiKSBjYihpbWcpXG4gICAgfVxuXG4gICAgaW1nLnNyYyA9IHNyY1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPcmlnaW5hbFNvdXJjZSAoZWwpIHtcbiAgaWYgKGVsLmRhdGFzZXQub3JpZ2luYWwpIHtcbiAgICByZXR1cm4gZWwuZGF0YXNldC5vcmlnaW5hbFxuICB9IGVsc2UgaWYgKGVsLnBhcmVudE5vZGUudGFnTmFtZSA9PT0gJ0EnKSB7XG4gICAgcmV0dXJuIGVsLnBhcmVudE5vZGUuZ2V0QXR0cmlidXRlKCdocmVmJylcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRTdHlsZSAoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgY2hlY2tUcmFucyhzdHlsZXMpXG5cbiAgbGV0IHMgPSBlbC5zdHlsZVxuICBsZXQgb3JpZ2luYWwgPSB7fVxuXG4gIGZvciAobGV0IGtleSBpbiBzdHlsZXMpIHtcbiAgICBpZiAocmVtZW1iZXIpIHtcbiAgICAgIG9yaWdpbmFsW2tleV0gPSBzW2tleV0gfHwgJydcbiAgICB9XG5cbiAgICBzW2tleV0gPSBzdHlsZXNba2V5XVxuICB9XG5cbiAgcmV0dXJuIG9yaWdpbmFsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kQWxsIChfdGhpcywgdGhhdCkge1xuICBjb25zdCBtZXRob2RzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoT2JqZWN0LmdldFByb3RvdHlwZU9mKF90aGlzKSlcbiAgbWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIGJpbmRPbmUgKG1ldGhvZCkge1xuICAgIF90aGlzW21ldGhvZF0gPSBfdGhpc1ttZXRob2RdLmJpbmQodGhhdClcbiAgfSlcbn1cblxuY29uc3QgdHJhbnMgPSBzbmlmZlRyYW5zaXRpb24oZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXG5leHBvcnQgY29uc3QgdHJhbnNmb3JtQ3NzUHJvcCA9IHRyYW5zLnRyYW5zZm9ybUNzc1Byb3BcbmV4cG9ydCBjb25zdCB0cmFuc0VuZEV2ZW50ID0gdHJhbnMudHJhbnNFbmRFdmVudFxuXG5mdW5jdGlvbiBjaGVja1RyYW5zIChzdHlsZXMpIHtcbiAgY29uc3QgeyB0cmFuc2l0aW9uUHJvcCwgdHJhbnNmb3JtUHJvcCB9ID0gdHJhbnNcblxuICBpZiAoc3R5bGVzLnRyYW5zaXRpb24pIHtcbiAgICBjb25zdCB2YWx1ZSA9IHN0eWxlcy50cmFuc2l0aW9uXG4gICAgZGVsZXRlIHN0eWxlcy50cmFuc2l0aW9uXG4gICAgc3R5bGVzW3RyYW5zaXRpb25Qcm9wXSA9IHZhbHVlXG4gIH1cblxuICBpZiAoc3R5bGVzLnRyYW5zZm9ybSkge1xuICAgIGNvbnN0IHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNmb3JtXG4gICAgc3R5bGVzW3RyYW5zZm9ybVByb3BdID0gdmFsdWVcbiAgfVxufVxuXG5mdW5jdGlvbiBzbmlmZlRyYW5zaXRpb24gKGVsKSB7XG4gIGxldCByZXMgPSB7fVxuICBjb25zdCB0cmFucyA9IFsnd2Via2l0VHJhbnNpdGlvbicsICd0cmFuc2l0aW9uJywgJ21velRyYW5zaXRpb24nXVxuICBjb25zdCB0Zm9ybSA9IFsnd2Via2l0VHJhbnNmb3JtJywgJ3RyYW5zZm9ybScsICdtb3pUcmFuc2Zvcm0nXVxuICBjb25zdCBlbmQgPSB7XG4gICAgdHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnLFxuICAgIG1velRyYW5zaXRpb246ICd0cmFuc2l0aW9uZW5kJyxcbiAgICB3ZWJraXRUcmFuc2l0aW9uOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgfVxuXG4gIHRyYW5zLnNvbWUoZnVuY3Rpb24gaGFzVHJhbnNpdGlvbiAocHJvcCkge1xuICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXMudHJhbnNpdGlvblByb3AgPSBwcm9wXG4gICAgICByZXMudHJhbnNFbmRFdmVudCA9IGVuZFtwcm9wXVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgdGZvcm0uc29tZShmdW5jdGlvbiBoYXNUcmFuc2Zvcm0gKHByb3ApIHtcbiAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzLnRyYW5zZm9ybVByb3AgPSBwcm9wXG4gICAgICByZXMudHJhbnNmb3JtQ3NzUHJvcCA9IHByb3AucmVwbGFjZSgvKC4qKVRyYW5zZm9ybS8sICctJDEtdHJhbnNmb3JtJylcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXNcbn1cbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLyoqXG4gICAqIFRvIGJlIGFibGUgdG8gZ3JhYiBhbmQgZHJhZyB0aGUgaW1hZ2UgZm9yIGV4dHJhIHpvb20taW4uXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgZW5hYmxlR3JhYjogdHJ1ZSxcblxuICAvKipcbiAgICogUHJlbG9hZCB6b29tYWJsZSBpbWFnZXMuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgcHJlbG9hZEltYWdlOiBmYWxzZSxcblxuICAvKipcbiAgICogQ2xvc2UgdGhlIHpvb21lZCBpbWFnZSB3aGVuIGJyb3dzZXIgd2luZG93IGlzIHJlc2l6ZWQuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgY2xvc2VPbldpbmRvd1Jlc2l6ZTogdHJ1ZSxcblxuICAvKipcbiAgICogVHJhbnNpdGlvbiBkdXJhdGlvbiBpbiBzZWNvbmRzLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgdHJhbnNpdGlvbkR1cmF0aW9uOiAwLjQsXG5cbiAgLyoqXG4gICAqIFRyYW5zaXRpb24gdGltaW5nIGZ1bmN0aW9uLlxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uOiAnY3ViaWMtYmV6aWVyKDAuNCwgMCwgMCwgMSknLFxuXG4gIC8qKlxuICAgKiBPdmVybGF5IGJhY2tncm91bmQgY29sb3IuXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICBiZ0NvbG9yOiAncmdiKDI1NSwgMjU1LCAyNTUpJyxcblxuICAvKipcbiAgICogT3ZlcmxheSBiYWNrZ3JvdW5kIG9wYWNpdHkuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBiZ09wYWNpdHk6IDEsXG5cbiAgLyoqXG4gICAqIFRoZSBiYXNlIHNjYWxlIGZhY3RvciBmb3Igem9vbWluZy4gQnkgZGVmYXVsdCBzY2FsZSB0byBmaXQgdGhlIHdpbmRvdy5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHNjYWxlQmFzZTogMS4wLFxuXG4gIC8qKlxuICAgKiBUaGUgYWRkaXRpb25hbCBzY2FsZSBmYWN0b3Igd2hlbiBncmFiYmluZyB0aGUgaW1hZ2UuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY2FsZUV4dHJhOiAwLjUsXG5cbiAgLyoqXG4gICAqIEhvdyBtdWNoIHNjcm9sbGluZyBpdCB0YWtlcyBiZWZvcmUgY2xvc2luZyBvdXQuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY3JvbGxUaHJlc2hvbGQ6IDQwLFxuXG4gIC8qKlxuICAgKiBUaGUgei1pbmRleCB0aGF0IHRoZSBvdmVybGF5IHdpbGwgYmUgYWRkZWQgd2l0aC5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHpJbmRleDogOTk4LFxuXG4gIC8qKlxuICAgKiBTY2FsZSAoem9vbSBpbikgdG8gZ2l2ZW4gd2lkdGggYW5kIGhlaWdodC4gSWdub3JlIHNjYWxlQmFzZSBpZiBzZXQuXG4gICAqIEFsdGVybmF0aXZlbHksIHByb3ZpZGUgYSBwZXJjZW50YWdlIHZhbHVlIHJlbGF0aXZlIHRvIHRoZSBvcmlnaW5hbCBpbWFnZSBzaXplLlxuICAgKiBAdHlwZSB7T2JqZWN0fFN0cmluZ31cbiAgICogQGV4YW1wbGVcbiAgICogY3VzdG9tU2l6ZTogeyB3aWR0aDogODAwLCBoZWlnaHQ6IDQwMCB9XG4gICAqIGN1c3RvbVNpemU6IDEwMCVcbiAgICovXG4gIGN1c3RvbVNpemU6IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG9wZW5lZCBhbmRcbiAgICogdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0IHdpbGwgZ2V0IHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uT3BlbjogbnVsbCxcblxuICAvKipcbiAgICogU2FtZSBhcyBhYm92ZSwgZXhjZXB0IGZpcmVkIHdoZW4gY2xvc2VkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkNsb3NlOiBudWxsLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiBncmFiYmVkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkdyYWI6IG51bGwsXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIG1vdmVkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbk1vdmU6IG51bGwsXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIHJlbGVhc2VkLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvblJlbGVhc2U6IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgb3Blbi5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVPcGVuOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIGNsb3NlLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZUNsb3NlOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIGdyYWIuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlR3JhYjogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSByZWxlYXNlLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZVJlbGVhc2U6IG51bGxcbn1cbiIsImltcG9ydCB7IGJpbmRBbGwgfSBmcm9tICcuL3V0aWxzJ1xuXG5jb25zdCBQUkVTU19ERUxBWSA9IDIwMFxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQoaW5zdGFuY2UpIHtcbiAgICBiaW5kQWxsKHRoaXMsIGluc3RhbmNlKVxuICB9LFxuXG4gIGNsaWNrKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgIGlmIChpc1ByZXNzaW5nTWV0YUtleShlKSkge1xuICAgICAgcmV0dXJuIHdpbmRvdy5vcGVuKFxuICAgICAgICB0aGlzLnRhcmdldC5zcmNPcmlnaW5hbCB8fCBlLmN1cnJlbnRUYXJnZXQuc3JjLFxuICAgICAgICAnX2JsYW5rJ1xuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodGhpcy5zaG93bikge1xuICAgICAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgICAgIHRoaXMuY2xvc2UoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmVsZWFzZSgpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub3BlbihlLmN1cnJlbnRUYXJnZXQpXG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHNjcm9sbCgpIHtcbiAgICBjb25zdCBlbCA9XG4gICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgfHwgZG9jdW1lbnQuYm9keS5wYXJlbnROb2RlIHx8IGRvY3VtZW50LmJvZHlcbiAgICBjb25zdCBzY3JvbGxMZWZ0ID0gd2luZG93LnBhZ2VYT2Zmc2V0IHx8IGVsLnNjcm9sbExlZnRcbiAgICBjb25zdCBzY3JvbGxUb3AgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHwgZWwuc2Nyb2xsVG9wXG5cbiAgICBpZiAodGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPT09IG51bGwpIHtcbiAgICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0ge1xuICAgICAgICB4OiBzY3JvbGxMZWZ0LFxuICAgICAgICB5OiBzY3JvbGxUb3BcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBkZWx0YVggPSB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbi54IC0gc2Nyb2xsTGVmdFxuICAgIGNvbnN0IGRlbHRhWSA9IHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uLnkgLSBzY3JvbGxUb3BcbiAgICBjb25zdCB0aHJlc2hvbGQgPSB0aGlzLm9wdGlvbnMuc2Nyb2xsVGhyZXNob2xkXG5cbiAgICBpZiAoTWF0aC5hYnMoZGVsdGFZKSA+PSB0aHJlc2hvbGQgfHwgTWF0aC5hYnMoZGVsdGFYKSA+PSB0aHJlc2hvbGQpIHtcbiAgICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfVxuICB9LFxuXG4gIGtleWRvd24oZSkge1xuICAgIGlmIChpc0VzY2FwZShlKSkge1xuICAgICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgICAgdGhpcy5jbG9zZSgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlbGVhc2UodGhpcy5jbG9zZSlcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgbW91c2Vkb3duKGUpIHtcbiAgICBpZiAoIWlzTGVmdEJ1dHRvbihlKSB8fCBpc1ByZXNzaW5nTWV0YUtleShlKSkgcmV0dXJuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgY29uc3QgeyBjbGllbnRYLCBjbGllbnRZIH0gPSBlXG5cbiAgICB0aGlzLnByZXNzVGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgZnVuY3Rpb24gZ3JhYk9uTW91c2VEb3duKCkge1xuICAgICAgICB0aGlzLmdyYWIoY2xpZW50WCwgY2xpZW50WSlcbiAgICAgIH0uYmluZCh0aGlzKSxcbiAgICAgIFBSRVNTX0RFTEFZXG4gICAgKVxuICB9LFxuXG4gIG1vdXNlbW92ZShlKSB7XG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHJldHVyblxuICAgIHRoaXMubW92ZShlLmNsaWVudFgsIGUuY2xpZW50WSlcbiAgfSxcblxuICBtb3VzZXVwKGUpIHtcbiAgICBpZiAoIWlzTGVmdEJ1dHRvbihlKSB8fCBpc1ByZXNzaW5nTWV0YUtleShlKSkgcmV0dXJuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucHJlc3NUaW1lcilcblxuICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZWxlYXNlKClcbiAgICB9XG4gIH0sXG5cbiAgdG91Y2hzdGFydChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgY29uc3QgeyBjbGllbnRYLCBjbGllbnRZIH0gPSBlLnRvdWNoZXNbMF1cblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoXG4gICAgICBmdW5jdGlvbiBncmFiT25Ub3VjaFN0YXJ0KCkge1xuICAgICAgICB0aGlzLmdyYWIoY2xpZW50WCwgY2xpZW50WSlcbiAgICAgIH0uYmluZCh0aGlzKSxcbiAgICAgIFBSRVNTX0RFTEFZXG4gICAgKVxuICB9LFxuXG4gIHRvdWNobW92ZShlKSB7XG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHJldHVyblxuXG4gICAgY29uc3QgeyBjbGllbnRYLCBjbGllbnRZIH0gPSBlLnRvdWNoZXNbMF1cbiAgICB0aGlzLm1vdmUoY2xpZW50WCwgY2xpZW50WSlcbiAgfSxcblxuICB0b3VjaGVuZChlKSB7XG4gICAgaWYgKGlzVG91Y2hpbmcoZSkpIHJldHVyblxuICAgIGNsZWFyVGltZW91dCh0aGlzLnByZXNzVGltZXIpXG5cbiAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVsZWFzZSgpXG4gICAgfVxuICB9LFxuXG4gIGNsaWNrT3ZlcmxheSgpIHtcbiAgICB0aGlzLmNsb3NlKClcbiAgfSxcblxuICByZXNpemVXaW5kb3coKSB7XG4gICAgdGhpcy5jbG9zZSgpXG4gIH1cbn1cblxuZnVuY3Rpb24gaXNMZWZ0QnV0dG9uKGUpIHtcbiAgcmV0dXJuIGUuYnV0dG9uID09PSAwXG59XG5cbmZ1bmN0aW9uIGlzUHJlc3NpbmdNZXRhS2V5KGUpIHtcbiAgcmV0dXJuIGUubWV0YUtleSB8fCBlLmN0cmxLZXlcbn1cblxuZnVuY3Rpb24gaXNUb3VjaGluZyhlKSB7XG4gIGUudGFyZ2V0VG91Y2hlcy5sZW5ndGggPiAwXG59XG5cbmZ1bmN0aW9uIGlzRXNjYXBlKGUpIHtcbiAgY29uc3QgY29kZSA9IGUua2V5IHx8IGUuY29kZVxuICByZXR1cm4gY29kZSA9PT0gJ0VzY2FwZScgfHwgZS5rZXlDb2RlID09PSAyN1xufVxuIiwiaW1wb3J0IHsgbGlzdGVuLCBzZXRTdHlsZSB9IGZyb20gJy4vdXRpbHMnXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdChpbnN0YW5jZSkge1xuICAgIHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgIHRoaXMuaW5zdGFuY2UgPSBpbnN0YW5jZVxuICAgIHRoaXMucGFyZW50ID0gZG9jdW1lbnQuYm9keVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICB0b3A6IDAsXG4gICAgICBsZWZ0OiAwLFxuICAgICAgcmlnaHQ6IDAsXG4gICAgICBib3R0b206IDAsXG4gICAgICBvcGFjaXR5OiAwXG4gICAgfSlcblxuICAgIHRoaXMudXBkYXRlU3R5bGUoaW5zdGFuY2Uub3B0aW9ucylcbiAgICBsaXN0ZW4odGhpcy5lbCwgJ2NsaWNrJywgaW5zdGFuY2UuaGFuZGxlci5jbGlja092ZXJsYXkuYmluZChpbnN0YW5jZSkpXG4gIH0sXG5cbiAgdXBkYXRlU3R5bGUob3B0aW9ucykge1xuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHpJbmRleDogb3B0aW9ucy56SW5kZXgsXG4gICAgICBiYWNrZ3JvdW5kQ29sb3I6IG9wdGlvbnMuYmdDb2xvcixcbiAgICAgIHRyYW5zaXRpb246IGBvcGFjaXR5XG4gICAgICAgICR7b3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb259c1xuICAgICAgICAke29wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9ufWBcbiAgICB9KVxuICB9LFxuXG4gIGluc2VydCgpIHtcbiAgICB0aGlzLnBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLmVsKVxuICB9LFxuXG4gIHJlbW92ZSgpIHtcbiAgICB0aGlzLnBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLmVsKVxuICB9LFxuXG4gIGZhZGVJbigpIHtcbiAgICB0aGlzLmVsLm9mZnNldFdpZHRoXG4gICAgdGhpcy5lbC5zdHlsZS5vcGFjaXR5ID0gdGhpcy5pbnN0YW5jZS5vcHRpb25zLmJnT3BhY2l0eVxuICB9LFxuXG4gIGZhZGVPdXQoKSB7XG4gICAgdGhpcy5lbC5zdHlsZS5vcGFjaXR5ID0gMFxuICB9XG59XG4iLCJpbXBvcnQgeyBjdXJzb3IsIHNldFN0eWxlLCBnZXRPcmlnaW5hbFNvdXJjZSwgdHJhbnNmb3JtQ3NzUHJvcCB9IGZyb20gJy4vdXRpbHMnXG5cbi8vIFRyYW5zbGF0ZSB6LWF4aXMgdG8gZml4IENTUyBncmlkIGRpc3BsYXkgaXNzdWUgaW4gQ2hyb21lOlxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2tpbmdkaWRvOTk5L3pvb21pbmcvaXNzdWVzLzQyXG5jb25zdCBUUkFOU0xBVEVfWiA9IDBcblxuZXhwb3J0IGRlZmF1bHQge1xuICBpbml0KGVsLCBpbnN0YW5jZSkge1xuICAgIHRoaXMuZWwgPSBlbFxuICAgIHRoaXMuaW5zdGFuY2UgPSBpbnN0YW5jZVxuICAgIHRoaXMuc3JjVGh1bWJuYWlsID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG4gICAgdGhpcy5zcmNzZXQgPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnc3Jjc2V0JylcbiAgICB0aGlzLnNyY09yaWdpbmFsID0gZ2V0T3JpZ2luYWxTb3VyY2UodGhpcy5lbClcbiAgICB0aGlzLnJlY3QgPSB0aGlzLmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG4gICAgdGhpcy50cmFuc2xhdGUgPSBudWxsXG4gICAgdGhpcy5zY2FsZSA9IG51bGxcbiAgICB0aGlzLnN0eWxlT3BlbiA9IG51bGxcbiAgICB0aGlzLnN0eWxlQ2xvc2UgPSBudWxsXG4gIH0sXG5cbiAgem9vbUluKCkge1xuICAgIGNvbnN0IHtcbiAgICAgIHpJbmRleCxcbiAgICAgIGVuYWJsZUdyYWIsXG4gICAgICB0cmFuc2l0aW9uRHVyYXRpb24sXG4gICAgICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb25cbiAgICB9ID0gdGhpcy5pbnN0YW5jZS5vcHRpb25zXG4gICAgdGhpcy50cmFuc2xhdGUgPSB0aGlzLmNhbGN1bGF0ZVRyYW5zbGF0ZSgpXG4gICAgdGhpcy5zY2FsZSA9IHRoaXMuY2FsY3VsYXRlU2NhbGUoKVxuXG4gICAgdGhpcy5zdHlsZU9wZW4gPSB7XG4gICAgICBwb3NpdGlvbjogJ3JlbGF0aXZlJyxcbiAgICAgIHpJbmRleDogekluZGV4ICsgMSxcbiAgICAgIGN1cnNvcjogZW5hYmxlR3JhYiA/IGN1cnNvci5ncmFiIDogY3Vyc29yLnpvb21PdXQsXG4gICAgICB0cmFuc2l0aW9uOiBgJHt0cmFuc2Zvcm1Dc3NQcm9wfVxuICAgICAgICAke3RyYW5zaXRpb25EdXJhdGlvbn1zXG4gICAgICAgICR7dHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9ufWAsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUzZCgke3RoaXMudHJhbnNsYXRlLnh9cHgsICR7XG4gICAgICAgIHRoaXMudHJhbnNsYXRlLnlcbiAgICAgICAgfXB4LCAke1RSQU5TTEFURV9afXB4KVxuICAgICAgICBzY2FsZSgke3RoaXMuc2NhbGUueH0sJHt0aGlzLnNjYWxlLnl9KWAsXG4gICAgICBoZWlnaHQ6IGAke3RoaXMucmVjdC5oZWlnaHR9cHhgLFxuICAgICAgd2lkdGg6IGAke3RoaXMucmVjdC53aWR0aH1weGBcbiAgICB9XG5cbiAgICAvLyBGb3JjZSBsYXlvdXQgdXBkYXRlXG4gICAgdGhpcy5lbC5vZmZzZXRXaWR0aFxuXG4gICAgLy8gVHJpZ2dlciB0cmFuc2l0aW9uXG4gICAgdGhpcy5zdHlsZUNsb3NlID0gc2V0U3R5bGUodGhpcy5lbCwgdGhpcy5zdHlsZU9wZW4sIHRydWUpXG4gIH0sXG5cbiAgem9vbU91dCgpIHtcbiAgICAvLyBGb3JjZSBsYXlvdXQgdXBkYXRlXG4gICAgdGhpcy5lbC5vZmZzZXRXaWR0aFxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwgeyB0cmFuc2Zvcm06ICdub25lJyB9KVxuICB9LFxuXG4gIGdyYWIoeCwgeSwgc2NhbGVFeHRyYSkge1xuICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG4gICAgY29uc3QgW2R4LCBkeV0gPSBbd2luZG93Q2VudGVyLnggLSB4LCB3aW5kb3dDZW50ZXIueSAtIHldXG5cbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICBjdXJzb3I6IGN1cnNvci5tb3ZlLFxuICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoXG4gICAgICAgICR7dGhpcy50cmFuc2xhdGUueCArIGR4fXB4LCAke3RoaXMudHJhbnNsYXRlLnkgK1xuICAgICAgICBkeX1weCwgJHtUUkFOU0xBVEVfWn1weClcbiAgICAgICAgc2NhbGUoJHt0aGlzLnNjYWxlLnggKyBzY2FsZUV4dHJhfSwke3RoaXMuc2NhbGUueSArIHNjYWxlRXh0cmF9KWBcbiAgICB9KVxuICB9LFxuXG4gIG1vdmUoeCwgeSwgc2NhbGVFeHRyYSkge1xuICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG4gICAgY29uc3QgW2R4LCBkeV0gPSBbd2luZG93Q2VudGVyLnggLSB4LCB3aW5kb3dDZW50ZXIueSAtIHldXG5cbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm1Dc3NQcm9wLFxuICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoXG4gICAgICAgICR7dGhpcy50cmFuc2xhdGUueCArIGR4fXB4LCAke3RoaXMudHJhbnNsYXRlLnkgK1xuICAgICAgICBkeX1weCwgJHtUUkFOU0xBVEVfWn1weClcbiAgICAgICAgc2NhbGUoJHt0aGlzLnNjYWxlLnggKyBzY2FsZUV4dHJhfSwke3RoaXMuc2NhbGUueSArIHNjYWxlRXh0cmF9KWBcbiAgICB9KVxuICB9LFxuXG4gIHJlc3RvcmVDbG9zZVN0eWxlKCkge1xuICAgIHNldFN0eWxlKHRoaXMuZWwsIHRoaXMuc3R5bGVDbG9zZSlcbiAgfSxcblxuICByZXN0b3JlT3BlblN0eWxlKCkge1xuICAgIHNldFN0eWxlKHRoaXMuZWwsIHRoaXMuc3R5bGVPcGVuKVxuICB9LFxuXG4gIHVwZ3JhZGVTb3VyY2UoKSB7XG4gICAgaWYgKHRoaXMuc3JjT3JpZ2luYWwpIHtcbiAgICAgIGNvbnN0IHBhcmVudE5vZGUgPSB0aGlzLmVsLnBhcmVudE5vZGVcblxuICAgICAgaWYgKHRoaXMuc3Jjc2V0KSB7XG4gICAgICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKCdzcmNzZXQnKVxuICAgICAgfVxuXG4gICAgICBjb25zdCB0ZW1wID0gdGhpcy5lbC5jbG9uZU5vZGUoZmFsc2UpXG5cbiAgICAgIC8vIEZvcmNlIGNvbXB1dGUgdGhlIGhpLXJlcyBpbWFnZSBpbiBET00gdG8gcHJldmVudFxuICAgICAgLy8gaW1hZ2UgZmxpY2tlcmluZyB3aGlsZSB1cGRhdGluZyBzcmNcbiAgICAgIHRlbXAuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnNyY09yaWdpbmFsKVxuICAgICAgdGVtcC5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCdcbiAgICAgIHRlbXAuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nXG4gICAgICBwYXJlbnROb2RlLmFwcGVuZENoaWxkKHRlbXApXG5cbiAgICAgIC8vIEFkZCBkZWxheSB0byBwcmV2ZW50IEZpcmVmb3ggZnJvbSBmbGlja2VyaW5nXG4gICAgICBzZXRUaW1lb3V0KFxuICAgICAgICBmdW5jdGlvbiB1cGRhdGVTcmMoKSB7XG4gICAgICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjT3JpZ2luYWwpXG4gICAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0ZW1wKVxuICAgICAgICB9LmJpbmQodGhpcyksXG4gICAgICAgIDUwXG4gICAgICApXG4gICAgfVxuICB9LFxuXG4gIGRvd25ncmFkZVNvdXJjZSgpIHtcbiAgICBpZiAodGhpcy5zcmNPcmlnaW5hbCkge1xuICAgICAgaWYgKHRoaXMuc3Jjc2V0KSB7XG4gICAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCdzcmNzZXQnLCB0aGlzLnNyY3NldClcbiAgICAgIH1cbiAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnNyY1RodW1ibmFpbClcbiAgICB9XG4gIH0sXG5cbiAgY2FsY3VsYXRlVHJhbnNsYXRlKCkge1xuICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG4gICAgY29uc3QgdGFyZ2V0Q2VudGVyID0ge1xuICAgICAgeDogdGhpcy5yZWN0LmxlZnQgKyB0aGlzLnJlY3Qud2lkdGggLyAyLFxuICAgICAgeTogdGhpcy5yZWN0LnRvcCArIHRoaXMucmVjdC5oZWlnaHQgLyAyXG4gICAgfVxuXG4gICAgLy8gVGhlIHZlY3RvciB0byB0cmFuc2xhdGUgaW1hZ2UgdG8gdGhlIHdpbmRvdyBjZW50ZXJcbiAgICByZXR1cm4ge1xuICAgICAgeDogd2luZG93Q2VudGVyLnggLSB0YXJnZXRDZW50ZXIueCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gdGFyZ2V0Q2VudGVyLnlcbiAgICB9XG4gIH0sXG5cbiAgY2FsY3VsYXRlU2NhbGUoKSB7XG4gICAgY29uc3QgeyB6b29taW5nSGVpZ2h0LCB6b29taW5nV2lkdGggfSA9IHRoaXMuZWwuZGF0YXNldFxuICAgIGNvbnN0IHsgY3VzdG9tU2l6ZSwgc2NhbGVCYXNlIH0gPSB0aGlzLmluc3RhbmNlLm9wdGlvbnNcblxuICAgIGlmICghY3VzdG9tU2l6ZSAmJiB6b29taW5nSGVpZ2h0ICYmIHpvb21pbmdXaWR0aCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogem9vbWluZ1dpZHRoIC8gdGhpcy5yZWN0LndpZHRoLFxuICAgICAgICB5OiB6b29taW5nSGVpZ2h0IC8gdGhpcy5yZWN0LmhlaWdodFxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY3VzdG9tU2l6ZSAmJiB0eXBlb2YgY3VzdG9tU2l6ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IGN1c3RvbVNpemUud2lkdGggLyB0aGlzLnJlY3Qud2lkdGgsXG4gICAgICAgIHk6IGN1c3RvbVNpemUuaGVpZ2h0IC8gdGhpcy5yZWN0LmhlaWdodFxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0YXJnZXRIYWxmV2lkdGggPSB0aGlzLnJlY3Qud2lkdGggLyAyXG4gICAgICBjb25zdCB0YXJnZXRIYWxmSGVpZ2h0ID0gdGhpcy5yZWN0LmhlaWdodCAvIDJcbiAgICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG5cbiAgICAgIC8vIFRoZSBkaXN0YW5jZSBiZXR3ZWVuIHRhcmdldCBlZGdlIGFuZCB3aW5kb3cgZWRnZVxuICAgICAgY29uc3QgdGFyZ2V0RWRnZVRvV2luZG93RWRnZSA9IHtcbiAgICAgICAgeDogd2luZG93Q2VudGVyLnggLSB0YXJnZXRIYWxmV2lkdGgsXG4gICAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gdGFyZ2V0SGFsZkhlaWdodFxuICAgICAgfVxuXG4gICAgICBjb25zdCBzY2FsZUhvcml6b250YWxseSA9IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UueCAvIHRhcmdldEhhbGZXaWR0aFxuICAgICAgY29uc3Qgc2NhbGVWZXJ0aWNhbGx5ID0gdGFyZ2V0RWRnZVRvV2luZG93RWRnZS55IC8gdGFyZ2V0SGFsZkhlaWdodFxuXG4gICAgICAvLyBUaGUgYWRkaXRpb25hbCBzY2FsZSBpcyBiYXNlZCBvbiB0aGUgc21hbGxlciB2YWx1ZSBvZlxuICAgICAgLy8gc2NhbGluZyBob3Jpem9udGFsbHkgYW5kIHNjYWxpbmcgdmVydGljYWxseVxuICAgICAgY29uc3Qgc2NhbGUgPSBzY2FsZUJhc2UgKyBNYXRoLm1pbihzY2FsZUhvcml6b250YWxseSwgc2NhbGVWZXJ0aWNhbGx5KVxuXG4gICAgICBpZiAoY3VzdG9tU2l6ZSAmJiB0eXBlb2YgY3VzdG9tU2l6ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVXNlIHpvb21pbmdXaWR0aCBhbmQgem9vbWluZ0hlaWdodCBpZiBhdmFpbGFibGVcbiAgICAgICAgY29uc3QgbmF0dXJhbFdpZHRoID0gem9vbWluZ1dpZHRoIHx8IHRoaXMuZWwubmF0dXJhbFdpZHRoXG4gICAgICAgIGNvbnN0IG5hdHVyYWxIZWlnaHQgPSB6b29taW5nSGVpZ2h0IHx8IHRoaXMuZWwubmF0dXJhbEhlaWdodFxuICAgICAgICBjb25zdCBtYXhab29taW5nV2lkdGggPVxuICAgICAgICAgIHBhcnNlRmxvYXQoY3VzdG9tU2l6ZSkgKiBuYXR1cmFsV2lkdGggLyAoMTAwICogdGhpcy5yZWN0LndpZHRoKVxuICAgICAgICBjb25zdCBtYXhab29taW5nSGVpZ2h0ID1cbiAgICAgICAgICBwYXJzZUZsb2F0KGN1c3RvbVNpemUpICogbmF0dXJhbEhlaWdodCAvICgxMDAgKiB0aGlzLnJlY3QuaGVpZ2h0KVxuXG4gICAgICAgIC8vIE9ubHkgc2NhbGUgaW1hZ2UgdXAgdG8gdGhlIHNwZWNpZmllZCBjdXN0b21TaXplIHBlcmNlbnRhZ2VcbiAgICAgICAgaWYgKHNjYWxlID4gbWF4Wm9vbWluZ1dpZHRoIHx8IHNjYWxlID4gbWF4Wm9vbWluZ0hlaWdodCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiBtYXhab29taW5nV2lkdGgsXG4gICAgICAgICAgICB5OiBtYXhab29taW5nSGVpZ2h0XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IHNjYWxlLFxuICAgICAgICB5OiBzY2FsZVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRXaW5kb3dDZW50ZXIoKSB7XG4gIGNvbnN0IGRvY0VsID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XG4gIGNvbnN0IHdpbmRvd1dpZHRoID0gTWF0aC5taW4oZG9jRWwuY2xpZW50V2lkdGgsIHdpbmRvdy5pbm5lcldpZHRoKVxuICBjb25zdCB3aW5kb3dIZWlnaHQgPSBNYXRoLm1pbihkb2NFbC5jbGllbnRIZWlnaHQsIHdpbmRvdy5pbm5lckhlaWdodClcblxuICByZXR1cm4ge1xuICAgIHg6IHdpbmRvd1dpZHRoIC8gMixcbiAgICB5OiB3aW5kb3dIZWlnaHQgLyAyXG4gIH1cbn1cbiIsImltcG9ydCB7XG4gIGN1cnNvcixcbiAgbGlzdGVuLFxuICBsb2FkSW1hZ2UsXG4gIHRyYW5zRW5kRXZlbnQsXG4gIGdldE9yaWdpbmFsU291cmNlXG59IGZyb20gJy4vdXRpbHMnXG5pbXBvcnQgREVGQVVMVF9PUFRJT05TIGZyb20gJy4vb3B0aW9ucydcblxuaW1wb3J0IGhhbmRsZXIgZnJvbSAnLi9oYW5kbGVyJ1xuaW1wb3J0IG92ZXJsYXkgZnJvbSAnLi9vdmVybGF5J1xuaW1wb3J0IHRhcmdldCBmcm9tICcuL3RhcmdldCdcblxuLyoqXG4gKiBab29taW5nIGluc3RhbmNlLlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBab29taW5nIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gVXBkYXRlIGRlZmF1bHQgb3B0aW9ucyBpZiBwcm92aWRlZC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICB0aGlzLnRhcmdldCA9IE9iamVjdC5jcmVhdGUodGFyZ2V0KVxuICAgIHRoaXMub3ZlcmxheSA9IE9iamVjdC5jcmVhdGUob3ZlcmxheSlcbiAgICB0aGlzLmhhbmRsZXIgPSBPYmplY3QuY3JlYXRlKGhhbmRsZXIpXG4gICAgdGhpcy5ib2R5ID0gZG9jdW1lbnQuYm9keVxuXG4gICAgdGhpcy5zaG93biA9IGZhbHNlXG4gICAgdGhpcy5sb2NrID0gZmFsc2VcbiAgICB0aGlzLnJlbGVhc2VkID0gdHJ1ZVxuICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuICAgIHRoaXMucHJlc3NUaW1lciA9IG51bGxcblxuICAgIHRoaXMub3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfT1BUSU9OUywgb3B0aW9ucylcbiAgICB0aGlzLm92ZXJsYXkuaW5pdCh0aGlzKVxuICAgIHRoaXMuaGFuZGxlci5pbml0KHRoaXMpXG4gIH1cblxuICAvKipcbiAgICogTWFrZSBlbGVtZW50KHMpIHpvb21hYmxlLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd8RWxlbWVudH0gZWwgQSBjc3Mgc2VsZWN0b3Igb3IgYW4gRWxlbWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGxpc3RlbihlbCkge1xuICAgIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGVsKVxuICAgICAgbGV0IGkgPSBlbHMubGVuZ3RoXG5cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5saXN0ZW4oZWxzW2ldKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWwudGFnTmFtZSA9PT0gJ0lNRycpIHtcbiAgICAgIGVsLnN0eWxlLmN1cnNvciA9IGN1cnNvci56b29tSW5cbiAgICAgIGxpc3RlbihlbCwgJ2NsaWNrJywgdGhpcy5oYW5kbGVyLmNsaWNrKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnByZWxvYWRJbWFnZSkge1xuICAgICAgICBsb2FkSW1hZ2UoZ2V0T3JpZ2luYWxTb3VyY2UoZWwpKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG9wdGlvbnMgb3IgcmV0dXJuIGN1cnJlbnQgb3B0aW9ucyBpZiBubyBhcmd1bWVudCBpcyBwcm92aWRlZC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zIEFuIE9iamVjdCB0aGF0IGNvbnRhaW5zIHRoaXMub3B0aW9ucy5cbiAgICogQHJldHVybiB7dGhpc3x0aGlzLm9wdGlvbnN9XG4gICAqL1xuICBjb25maWcob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMub3B0aW9ucywgb3B0aW9ucylcbiAgICAgIHRoaXMub3ZlcmxheS51cGRhdGVTdHlsZSh0aGlzLm9wdGlvbnMpXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9wZW4gKHpvb20gaW4pIHRoZSBFbGVtZW50LlxuICAgKiBAcGFyYW0gIHtFbGVtZW50fSBlbCBUaGUgRWxlbWVudCB0byBvcGVuLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbk9wZW5dIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsXG4gICAqIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG9wZW5lZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0IHdpbGwgZ2V0XG4gICAqIHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBvcGVuKGVsLCBjYiA9IHRoaXMub3B0aW9ucy5vbk9wZW4pIHtcbiAgICBpZiAodGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdHlwZW9mIGVsID09PSAnc3RyaW5nJyA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpIDogZWxcblxuICAgIGlmICh0YXJnZXQudGFnTmFtZSAhPT0gJ0lNRycpIHJldHVyblxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4pIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4odGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMudGFyZ2V0LmluaXQodGFyZ2V0LCB0aGlzKVxuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMucHJlbG9hZEltYWdlKSB7XG4gICAgICBsb2FkSW1hZ2UodGhpcy50YXJnZXQuc3JjT3JpZ2luYWwpXG4gICAgfVxuXG4gICAgdGhpcy5zaG93biA9IHRydWVcbiAgICB0aGlzLmxvY2sgPSB0cnVlXG5cbiAgICB0aGlzLnRhcmdldC56b29tSW4oKVxuICAgIHRoaXMub3ZlcmxheS5pbnNlcnQoKVxuICAgIHRoaXMub3ZlcmxheS5mYWRlSW4oKVxuXG4gICAgbGlzdGVuKGRvY3VtZW50LCAnc2Nyb2xsJywgdGhpcy5oYW5kbGVyLnNjcm9sbClcbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5oYW5kbGVyLmtleWRvd24pXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25XaW5kb3dSZXNpemUpIHtcbiAgICAgIGxpc3Rlbih3aW5kb3csICdyZXNpemUnLCB0aGlzLmhhbmRsZXIucmVzaXplV2luZG93KVxuICAgIH1cblxuICAgIGNvbnN0IG9uT3BlbkVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uT3BlbkVuZCwgZmFsc2UpXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgICAgdGhpcy50YXJnZXQudXBncmFkZVNvdXJjZSgpXG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgICB0b2dnbGVHcmFiTGlzdGVuZXJzKGRvY3VtZW50LCB0aGlzLmhhbmRsZXIsIHRydWUpXG4gICAgICB9XG5cbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uT3BlbkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ2xvc2UgKHpvb20gb3V0KSB0aGUgRWxlbWVudCBjdXJyZW50bHkgb3BlbmVkLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbkNsb3NlXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbFxuICAgKiBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBjbG9zZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldFxuICAgKiB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgY2xvc2UoY2IgPSB0aGlzLm9wdGlvbnMub25DbG9zZSkge1xuICAgIGlmICghdGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQuZWxcblxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVDbG9zZSkge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMubG9jayA9IHRydWVcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLmRlZmF1bHRcbiAgICB0aGlzLm92ZXJsYXkuZmFkZU91dCgpXG4gICAgdGhpcy50YXJnZXQuem9vbU91dCgpXG5cbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdzY3JvbGwnLCB0aGlzLmhhbmRsZXIuc2Nyb2xsLCBmYWxzZSlcbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5oYW5kbGVyLmtleWRvd24sIGZhbHNlKVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uV2luZG93UmVzaXplKSB7XG4gICAgICBsaXN0ZW4od2luZG93LCAncmVzaXplJywgdGhpcy5oYW5kbGVyLnJlc2l6ZVdpbmRvdywgZmFsc2UpXG4gICAgfVxuXG4gICAgY29uc3Qgb25DbG9zZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uQ2xvc2VFbmQsIGZhbHNlKVxuXG4gICAgICB0aGlzLnNob3duID0gZmFsc2VcbiAgICAgIHRoaXMubG9jayA9IGZhbHNlXG5cbiAgICAgIHRoaXMudGFyZ2V0LmRvd25ncmFkZVNvdXJjZSgpXG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgICB0b2dnbGVHcmFiTGlzdGVuZXJzKGRvY3VtZW50LCB0aGlzLmhhbmRsZXIsIGZhbHNlKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnRhcmdldC5yZXN0b3JlQ2xvc2VTdHlsZSgpXG4gICAgICB0aGlzLm92ZXJsYXkucmVtb3ZlKClcblxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25DbG9zZUVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogR3JhYiB0aGUgRWxlbWVudCBjdXJyZW50bHkgb3BlbmVkIGdpdmVuIGEgcG9zaXRpb24gYW5kIGFwcGx5IGV4dHJhIHpvb20taW4uXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB4IFRoZSBYLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeSBUaGUgWS1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHNjYWxlRXh0cmEgRXh0cmEgem9vbS1pbiB0byBhcHBseS5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25HcmFiXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXRcbiAgICogd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBncmFiYmVkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXRcbiAgICogd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGdyYWIoeCwgeSwgc2NhbGVFeHRyYSA9IHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhLCBjYiA9IHRoaXMub3B0aW9ucy5vbkdyYWIpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYikge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYih0YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy5yZWxlYXNlZCA9IGZhbHNlXG4gICAgdGhpcy50YXJnZXQuZ3JhYih4LCB5LCBzY2FsZUV4dHJhKVxuXG4gICAgY29uc3Qgb25HcmFiRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25HcmFiRW5kLCBmYWxzZSlcbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uR3JhYkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogTW92ZSB0aGUgRWxlbWVudCBjdXJyZW50bHkgZ3JhYmJlZCBnaXZlbiBhIHBvc2l0aW9uIGFuZCBhcHBseSBleHRyYSB6b29tLWluLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeCBUaGUgWC1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHkgVGhlIFktYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICBzY2FsZUV4dHJhIEV4dHJhIHpvb20taW4gdG8gYXBwbHkuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uTW92ZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgbW92ZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsXG4gICAqIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgbW92ZSh4LCB5LCBzY2FsZUV4dHJhID0gdGhpcy5vcHRpb25zLnNjYWxlRXh0cmEsIGNiID0gdGhpcy5vcHRpb25zLm9uTW92ZSkge1xuICAgIGlmICghdGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgdGhpcy5yZWxlYXNlZCA9IGZhbHNlXG4gICAgdGhpcy5ib2R5LnN0eWxlLmN1cnNvciA9IGN1cnNvci5tb3ZlXG4gICAgdGhpcy50YXJnZXQubW92ZSh4LCB5LCBzY2FsZUV4dHJhKVxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQuZWxcblxuICAgIGNvbnN0IG9uTW92ZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uTW92ZUVuZCwgZmFsc2UpXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk1vdmVFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbGVhc2UgdGhlIEVsZW1lbnQgY3VycmVudGx5IGdyYWJiZWQuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uUmVsZWFzZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgcmVsZWFzZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdFxuICAgKiB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgcmVsZWFzZShjYiA9IHRoaXMub3B0aW9ucy5vblJlbGVhc2UpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSkge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSh0YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy5sb2NrID0gdHJ1ZVxuICAgIHRoaXMuYm9keS5zdHlsZS5jdXJzb3IgPSBjdXJzb3IuZGVmYXVsdFxuICAgIHRoaXMudGFyZ2V0LnJlc3RvcmVPcGVuU3R5bGUoKVxuXG4gICAgY29uc3Qgb25SZWxlYXNlRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25SZWxlYXNlRW5kLCBmYWxzZSlcbiAgICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgICB0aGlzLnJlbGVhc2VkID0gdHJ1ZVxuXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvblJlbGVhc2VFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUdyYWJMaXN0ZW5lcnMoZWwsIGhhbmRsZXIsIGFkZCkge1xuICBjb25zdCB0eXBlcyA9IFtcbiAgICAnbW91c2Vkb3duJyxcbiAgICAnbW91c2Vtb3ZlJyxcbiAgICAnbW91c2V1cCcsXG4gICAgJ3RvdWNoc3RhcnQnLFxuICAgICd0b3VjaG1vdmUnLFxuICAgICd0b3VjaGVuZCdcbiAgXVxuXG4gIHR5cGVzLmZvckVhY2goZnVuY3Rpb24gdG9nZ2xlTGlzdGVuZXIodHlwZSkge1xuICAgIGxpc3RlbihlbCwgdHlwZSwgaGFuZGxlclt0eXBlXSwgYWRkKVxuICB9KVxufVxuIl0sIm5hbWVzIjpbIndlYmtpdFByZWZpeCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50Iiwic3R5bGUiLCJjdXJzb3IiLCJsaXN0ZW4iLCJlbCIsImV2ZW50IiwiaGFuZGxlciIsImFkZCIsIm9wdGlvbnMiLCJwYXNzaXZlIiwiYWRkRXZlbnRMaXN0ZW5lciIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJsb2FkSW1hZ2UiLCJzcmMiLCJjYiIsImltZyIsIkltYWdlIiwib25sb2FkIiwib25JbWFnZUxvYWQiLCJnZXRPcmlnaW5hbFNvdXJjZSIsImRhdGFzZXQiLCJvcmlnaW5hbCIsInBhcmVudE5vZGUiLCJ0YWdOYW1lIiwiZ2V0QXR0cmlidXRlIiwic2V0U3R5bGUiLCJzdHlsZXMiLCJyZW1lbWJlciIsInMiLCJrZXkiLCJiaW5kQWxsIiwiX3RoaXMiLCJ0aGF0IiwibWV0aG9kcyIsIk9iamVjdCIsImdldE93blByb3BlcnR5TmFtZXMiLCJnZXRQcm90b3R5cGVPZiIsImZvckVhY2giLCJiaW5kT25lIiwibWV0aG9kIiwiYmluZCIsInRyYW5zIiwic25pZmZUcmFuc2l0aW9uIiwiY3JlYXRlRWxlbWVudCIsInRyYW5zZm9ybUNzc1Byb3AiLCJ0cmFuc0VuZEV2ZW50IiwiY2hlY2tUcmFucyIsInRyYW5zaXRpb25Qcm9wIiwidHJhbnNmb3JtUHJvcCIsInRyYW5zaXRpb24iLCJ2YWx1ZSIsInRyYW5zZm9ybSIsInJlcyIsInRmb3JtIiwiZW5kIiwic29tZSIsImhhc1RyYW5zaXRpb24iLCJwcm9wIiwidW5kZWZpbmVkIiwiaGFzVHJhbnNmb3JtIiwicmVwbGFjZSIsIlBSRVNTX0RFTEFZIiwiaW5zdGFuY2UiLCJlIiwicHJldmVudERlZmF1bHQiLCJpc1ByZXNzaW5nTWV0YUtleSIsIndpbmRvdyIsIm9wZW4iLCJ0YXJnZXQiLCJzcmNPcmlnaW5hbCIsImN1cnJlbnRUYXJnZXQiLCJzaG93biIsInJlbGVhc2VkIiwiY2xvc2UiLCJyZWxlYXNlIiwiYm9keSIsInNjcm9sbExlZnQiLCJwYWdlWE9mZnNldCIsInNjcm9sbFRvcCIsInBhZ2VZT2Zmc2V0IiwibGFzdFNjcm9sbFBvc2l0aW9uIiwiZGVsdGFYIiwieCIsImRlbHRhWSIsInkiLCJ0aHJlc2hvbGQiLCJzY3JvbGxUaHJlc2hvbGQiLCJNYXRoIiwiYWJzIiwiaXNFc2NhcGUiLCJpc0xlZnRCdXR0b24iLCJjbGllbnRYIiwiY2xpZW50WSIsInByZXNzVGltZXIiLCJzZXRUaW1lb3V0IiwiZ3JhYk9uTW91c2VEb3duIiwiZ3JhYiIsIm1vdmUiLCJ0b3VjaGVzIiwiZ3JhYk9uVG91Y2hTdGFydCIsImlzVG91Y2hpbmciLCJidXR0b24iLCJtZXRhS2V5IiwiY3RybEtleSIsInRhcmdldFRvdWNoZXMiLCJsZW5ndGgiLCJjb2RlIiwia2V5Q29kZSIsInBhcmVudCIsInVwZGF0ZVN0eWxlIiwiY2xpY2tPdmVybGF5IiwiekluZGV4IiwiYmdDb2xvciIsInRyYW5zaXRpb25EdXJhdGlvbiIsInRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbiIsImFwcGVuZENoaWxkIiwicmVtb3ZlQ2hpbGQiLCJvZmZzZXRXaWR0aCIsIm9wYWNpdHkiLCJiZ09wYWNpdHkiLCJUUkFOU0xBVEVfWiIsInNyY1RodW1ibmFpbCIsInNyY3NldCIsInJlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJ0cmFuc2xhdGUiLCJzY2FsZSIsInN0eWxlT3BlbiIsInN0eWxlQ2xvc2UiLCJlbmFibGVHcmFiIiwiY2FsY3VsYXRlVHJhbnNsYXRlIiwiY2FsY3VsYXRlU2NhbGUiLCJ6b29tT3V0IiwiaGVpZ2h0Iiwid2lkdGgiLCJzY2FsZUV4dHJhIiwid2luZG93Q2VudGVyIiwiZ2V0V2luZG93Q2VudGVyIiwiZHgiLCJkeSIsInJlbW92ZUF0dHJpYnV0ZSIsInRlbXAiLCJjbG9uZU5vZGUiLCJzZXRBdHRyaWJ1dGUiLCJwb3NpdGlvbiIsInZpc2liaWxpdHkiLCJ1cGRhdGVTcmMiLCJ0YXJnZXRDZW50ZXIiLCJsZWZ0IiwidG9wIiwiem9vbWluZ0hlaWdodCIsInpvb21pbmdXaWR0aCIsImN1c3RvbVNpemUiLCJzY2FsZUJhc2UiLCJ0YXJnZXRIYWxmV2lkdGgiLCJ0YXJnZXRIYWxmSGVpZ2h0IiwidGFyZ2V0RWRnZVRvV2luZG93RWRnZSIsInNjYWxlSG9yaXpvbnRhbGx5Iiwic2NhbGVWZXJ0aWNhbGx5IiwibWluIiwibmF0dXJhbFdpZHRoIiwibmF0dXJhbEhlaWdodCIsIm1heFpvb21pbmdXaWR0aCIsInBhcnNlRmxvYXQiLCJtYXhab29taW5nSGVpZ2h0IiwiZG9jRWwiLCJ3aW5kb3dXaWR0aCIsImNsaWVudFdpZHRoIiwiaW5uZXJXaWR0aCIsIndpbmRvd0hlaWdodCIsImNsaWVudEhlaWdodCIsImlubmVySGVpZ2h0IiwiWm9vbWluZyIsImNyZWF0ZSIsIm92ZXJsYXkiLCJsb2NrIiwiYmFiZWxIZWxwZXJzLmV4dGVuZHMiLCJERUZBVUxUX09QVElPTlMiLCJpbml0IiwiZWxzIiwicXVlcnlTZWxlY3RvckFsbCIsImkiLCJ6b29tSW4iLCJjbGljayIsInByZWxvYWRJbWFnZSIsIm9uT3BlbiIsInF1ZXJ5U2VsZWN0b3IiLCJvbkJlZm9yZU9wZW4iLCJpbnNlcnQiLCJmYWRlSW4iLCJzY3JvbGwiLCJrZXlkb3duIiwiY2xvc2VPbldpbmRvd1Jlc2l6ZSIsInJlc2l6ZVdpbmRvdyIsIm9uT3BlbkVuZCIsInVwZ3JhZGVTb3VyY2UiLCJvbkNsb3NlIiwib25CZWZvcmVDbG9zZSIsImRlZmF1bHQiLCJmYWRlT3V0Iiwib25DbG9zZUVuZCIsImRvd25ncmFkZVNvdXJjZSIsInJlc3RvcmVDbG9zZVN0eWxlIiwicmVtb3ZlIiwib25HcmFiIiwib25CZWZvcmVHcmFiIiwib25HcmFiRW5kIiwib25Nb3ZlIiwib25Nb3ZlRW5kIiwib25SZWxlYXNlIiwib25CZWZvcmVSZWxlYXNlIiwicmVzdG9yZU9wZW5TdHlsZSIsIm9uUmVsZWFzZUVuZCIsInRvZ2dsZUdyYWJMaXN0ZW5lcnMiLCJ0eXBlcyIsInRvZ2dsZUxpc3RlbmVyIiwidHlwZSJdLCJtYXBwaW5ncyI6IkFBQU8sSUFBTUEsZUFBZSxzQkFBc0JDLFNBQVNDLGVBQVQsQ0FBeUJDLEtBQS9DLEdBQ3hCLFVBRHdCLEdBRXhCLEVBRkc7O0FBSVAsQUFBTyxJQUFNQyxTQUFTO1dBQ1gsTUFEVztVQUVUSixZQUFYLFlBRm9CO1dBR1JBLFlBQVosYUFIb0I7UUFJWEEsWUFBVCxTQUpvQjtRQUtkO0NBTEQ7O0FBUVAsQUFBTyxTQUFTSyxNQUFULENBQWlCQyxFQUFqQixFQUFxQkMsS0FBckIsRUFBNEJDLE9BQTVCLEVBQWlEO01BQVpDLEdBQVksdUVBQU4sSUFBTTs7TUFDaERDLFVBQVUsRUFBRUMsU0FBUyxLQUFYLEVBQWhCOztNQUVJRixHQUFKLEVBQVM7T0FDSkcsZ0JBQUgsQ0FBb0JMLEtBQXBCLEVBQTJCQyxPQUEzQixFQUFvQ0UsT0FBcEM7R0FERixNQUVPO09BQ0ZHLG1CQUFILENBQXVCTixLQUF2QixFQUE4QkMsT0FBOUIsRUFBdUNFLE9BQXZDOzs7O0FBSUosQUFBTyxTQUFTSSxTQUFULENBQW9CQyxHQUFwQixFQUF5QkMsRUFBekIsRUFBNkI7TUFDOUJELEdBQUosRUFBUztRQUNERSxNQUFNLElBQUlDLEtBQUosRUFBWjs7UUFFSUMsTUFBSixHQUFhLFNBQVNDLFdBQVQsR0FBd0I7VUFDL0JKLEVBQUosRUFBUUEsR0FBR0MsR0FBSDtLQURWOztRQUlJRixHQUFKLEdBQVVBLEdBQVY7Ozs7QUFJSixBQUFPLFNBQVNNLGlCQUFULENBQTRCZixFQUE1QixFQUFnQztNQUNqQ0EsR0FBR2dCLE9BQUgsQ0FBV0MsUUFBZixFQUF5QjtXQUNoQmpCLEdBQUdnQixPQUFI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
