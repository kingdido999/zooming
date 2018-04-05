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
   * Zoomable elements by default. It can be a css selector or an element.
   * @type {string|Element}
   */
  defaultZoomable: 'img[data-action="zoom"]',

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
    this.listen(this.options.defaultZoomable);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9vbWluZy5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyIsIi4uL3NyYy9vcHRpb25zLmpzIiwiLi4vc3JjL2hhbmRsZXIuanMiLCIuLi9zcmMvb3ZlcmxheS5qcyIsIi4uL3NyYy90YXJnZXQuanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IHdlYmtpdFByZWZpeCA9ICdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGVcbiAgPyAnLXdlYmtpdC0nXG4gIDogJydcblxuZXhwb3J0IGNvbnN0IGN1cnNvciA9IHtcbiAgZGVmYXVsdDogJ2F1dG8nLFxuICB6b29tSW46IGAke3dlYmtpdFByZWZpeH16b29tLWluYCxcbiAgem9vbU91dDogYCR7d2Via2l0UHJlZml4fXpvb20tb3V0YCxcbiAgZ3JhYjogYCR7d2Via2l0UHJlZml4fWdyYWJgLFxuICBtb3ZlOiAnbW92ZSdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RlbiAoZWwsIGV2ZW50LCBoYW5kbGVyLCBhZGQgPSB0cnVlKSB7XG4gIGNvbnN0IG9wdGlvbnMgPSB7IHBhc3NpdmU6IGZhbHNlIH1cblxuICBpZiAoYWRkKSB7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgaGFuZGxlciwgb3B0aW9ucylcbiAgfSBlbHNlIHtcbiAgICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyLCBvcHRpb25zKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkSW1hZ2UgKHNyYywgY2IpIHtcbiAgaWYgKHNyYykge1xuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpXG5cbiAgICBpbWcub25sb2FkID0gZnVuY3Rpb24gb25JbWFnZUxvYWQgKCkge1xuICAgICAgaWYgKGNiKSBjYihpbWcpXG4gICAgfVxuXG4gICAgaW1nLnNyYyA9IHNyY1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPcmlnaW5hbFNvdXJjZSAoZWwpIHtcbiAgaWYgKGVsLmRhdGFzZXQub3JpZ2luYWwpIHtcbiAgICByZXR1cm4gZWwuZGF0YXNldC5vcmlnaW5hbFxuICB9IGVsc2UgaWYgKGVsLnBhcmVudE5vZGUudGFnTmFtZSA9PT0gJ0EnKSB7XG4gICAgcmV0dXJuIGVsLnBhcmVudE5vZGUuZ2V0QXR0cmlidXRlKCdocmVmJylcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRTdHlsZSAoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgY2hlY2tUcmFucyhzdHlsZXMpXG5cbiAgbGV0IHMgPSBlbC5zdHlsZVxuICBsZXQgb3JpZ2luYWwgPSB7fVxuXG4gIGZvciAobGV0IGtleSBpbiBzdHlsZXMpIHtcbiAgICBpZiAocmVtZW1iZXIpIHtcbiAgICAgIG9yaWdpbmFsW2tleV0gPSBzW2tleV0gfHwgJydcbiAgICB9XG5cbiAgICBzW2tleV0gPSBzdHlsZXNba2V5XVxuICB9XG5cbiAgcmV0dXJuIG9yaWdpbmFsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kQWxsIChfdGhpcywgdGhhdCkge1xuICBjb25zdCBtZXRob2RzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoT2JqZWN0LmdldFByb3RvdHlwZU9mKF90aGlzKSlcbiAgbWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIGJpbmRPbmUgKG1ldGhvZCkge1xuICAgIF90aGlzW21ldGhvZF0gPSBfdGhpc1ttZXRob2RdLmJpbmQodGhhdClcbiAgfSlcbn1cblxuY29uc3QgdHJhbnMgPSBzbmlmZlRyYW5zaXRpb24oZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXG5leHBvcnQgY29uc3QgdHJhbnNmb3JtQ3NzUHJvcCA9IHRyYW5zLnRyYW5zZm9ybUNzc1Byb3BcbmV4cG9ydCBjb25zdCB0cmFuc0VuZEV2ZW50ID0gdHJhbnMudHJhbnNFbmRFdmVudFxuXG5mdW5jdGlvbiBjaGVja1RyYW5zIChzdHlsZXMpIHtcbiAgY29uc3QgeyB0cmFuc2l0aW9uUHJvcCwgdHJhbnNmb3JtUHJvcCB9ID0gdHJhbnNcblxuICBpZiAoc3R5bGVzLnRyYW5zaXRpb24pIHtcbiAgICBjb25zdCB2YWx1ZSA9IHN0eWxlcy50cmFuc2l0aW9uXG4gICAgZGVsZXRlIHN0eWxlcy50cmFuc2l0aW9uXG4gICAgc3R5bGVzW3RyYW5zaXRpb25Qcm9wXSA9IHZhbHVlXG4gIH1cblxuICBpZiAoc3R5bGVzLnRyYW5zZm9ybSkge1xuICAgIGNvbnN0IHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNmb3JtXG4gICAgc3R5bGVzW3RyYW5zZm9ybVByb3BdID0gdmFsdWVcbiAgfVxufVxuXG5mdW5jdGlvbiBzbmlmZlRyYW5zaXRpb24gKGVsKSB7XG4gIGxldCByZXMgPSB7fVxuICBjb25zdCB0cmFucyA9IFsnd2Via2l0VHJhbnNpdGlvbicsICd0cmFuc2l0aW9uJywgJ21velRyYW5zaXRpb24nXVxuICBjb25zdCB0Zm9ybSA9IFsnd2Via2l0VHJhbnNmb3JtJywgJ3RyYW5zZm9ybScsICdtb3pUcmFuc2Zvcm0nXVxuICBjb25zdCBlbmQgPSB7XG4gICAgdHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnLFxuICAgIG1velRyYW5zaXRpb246ICd0cmFuc2l0aW9uZW5kJyxcbiAgICB3ZWJraXRUcmFuc2l0aW9uOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgfVxuXG4gIHRyYW5zLnNvbWUoZnVuY3Rpb24gaGFzVHJhbnNpdGlvbiAocHJvcCkge1xuICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXMudHJhbnNpdGlvblByb3AgPSBwcm9wXG4gICAgICByZXMudHJhbnNFbmRFdmVudCA9IGVuZFtwcm9wXVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgdGZvcm0uc29tZShmdW5jdGlvbiBoYXNUcmFuc2Zvcm0gKHByb3ApIHtcbiAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzLnRyYW5zZm9ybVByb3AgPSBwcm9wXG4gICAgICByZXMudHJhbnNmb3JtQ3NzUHJvcCA9IHByb3AucmVwbGFjZSgvKC4qKVRyYW5zZm9ybS8sICctJDEtdHJhbnNmb3JtJylcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXNcbn1cbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLyoqXG4gICAqIFpvb21hYmxlIGVsZW1lbnRzIGJ5IGRlZmF1bHQuIEl0IGNhbiBiZSBhIGNzcyBzZWxlY3RvciBvciBhbiBlbGVtZW50LlxuICAgKiBAdHlwZSB7c3RyaW5nfEVsZW1lbnR9XG4gICAqL1xuICBkZWZhdWx0Wm9vbWFibGU6ICdpbWdbZGF0YS1hY3Rpb249XCJ6b29tXCJdJyxcblxuICAvKipcbiAgICogVG8gYmUgYWJsZSB0byBncmFiIGFuZCBkcmFnIHRoZSBpbWFnZSBmb3IgZXh0cmEgem9vbS1pbi5cbiAgICogQHR5cGUge2Jvb2xlYW59XG4gICAqL1xuICBlbmFibGVHcmFiOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBQcmVsb2FkIHpvb21hYmxlIGltYWdlcy5cbiAgICogQHR5cGUge2Jvb2xlYW59XG4gICAqL1xuICBwcmVsb2FkSW1hZ2U6IGZhbHNlLFxuXG4gIC8qKlxuICAgKiBDbG9zZSB0aGUgem9vbWVkIGltYWdlIHdoZW4gYnJvd3NlciB3aW5kb3cgaXMgcmVzaXplZC5cbiAgICogQHR5cGUge2Jvb2xlYW59XG4gICAqL1xuICBjbG9zZU9uV2luZG93UmVzaXplOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBUcmFuc2l0aW9uIGR1cmF0aW9uIGluIHNlY29uZHMuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB0cmFuc2l0aW9uRHVyYXRpb246IDAuNCxcblxuICAvKipcbiAgICogVHJhbnNpdGlvbiB0aW1pbmcgZnVuY3Rpb24uXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb246ICdjdWJpYy1iZXppZXIoMC40LCAwLCAwLCAxKScsXG5cbiAgLyoqXG4gICAqIE92ZXJsYXkgYmFja2dyb3VuZCBjb2xvci5cbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIGJnQ29sb3I6ICdyZ2IoMjU1LCAyNTUsIDI1NSknLFxuXG4gIC8qKlxuICAgKiBPdmVybGF5IGJhY2tncm91bmQgb3BhY2l0eS5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIGJnT3BhY2l0eTogMSxcblxuICAvKipcbiAgICogVGhlIGJhc2Ugc2NhbGUgZmFjdG9yIGZvciB6b29taW5nLiBCeSBkZWZhdWx0IHNjYWxlIHRvIGZpdCB0aGUgd2luZG93LlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgc2NhbGVCYXNlOiAxLjAsXG5cbiAgLyoqXG4gICAqIFRoZSBhZGRpdGlvbmFsIHNjYWxlIGZhY3RvciB3aGVuIGdyYWJiaW5nIHRoZSBpbWFnZS5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHNjYWxlRXh0cmE6IDAuNSxcblxuICAvKipcbiAgICogSG93IG11Y2ggc2Nyb2xsaW5nIGl0IHRha2VzIGJlZm9yZSBjbG9zaW5nIG91dC5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHNjcm9sbFRocmVzaG9sZDogNDAsXG5cbiAgLyoqXG4gICAqIFRoZSB6LWluZGV4IHRoYXQgdGhlIG92ZXJsYXkgd2lsbCBiZSBhZGRlZCB3aXRoLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgekluZGV4OiA5OTgsXG5cbiAgLyoqXG4gICAqIFNjYWxlICh6b29tIGluKSB0byBnaXZlbiB3aWR0aCBhbmQgaGVpZ2h0LiBJZ25vcmUgc2NhbGVCYXNlIGlmIHNldC5cbiAgICogQWx0ZXJuYXRpdmVseSwgcHJvdmlkZSBhIHBlcmNlbnRhZ2UgdmFsdWUgcmVsYXRpdmUgdG8gdGhlIG9yaWdpbmFsIGltYWdlIHNpemUuXG4gICAqIEB0eXBlIHtPYmplY3R8U3RyaW5nfVxuICAgKiBAZXhhbXBsZVxuICAgKiBjdXN0b21TaXplOiB7IHdpZHRoOiA4MDAsIGhlaWdodDogNDAwIH1cbiAgICogY3VzdG9tU2l6ZTogMTAwJVxuICAgKi9cbiAgY3VzdG9tU2l6ZTogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgb3BlbmVkIGFuZFxuICAgKiB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25PcGVuOiBudWxsLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiBjbG9zZWQuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQ2xvc2U6IG51bGwsXG5cbiAgLyoqXG4gICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiBncmFiYmVkLlxuICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICovXG4gIG9uR3JhYjogbnVsbCxcblxuICAvKipcbiAgICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIG1vdmVkLlxuICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICovXG4gIG9uTW92ZTogbnVsbCxcblxuICAvKipcbiAgICogU2FtZSBhcyBhYm92ZSwgZXhjZXB0IGZpcmVkIHdoZW4gcmVsZWFzZWQuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uUmVsZWFzZTogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBvcGVuLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZU9wZW46IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgY2xvc2UuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlQ2xvc2U6IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgZ3JhYi5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVHcmFiOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIHJlbGVhc2UuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlUmVsZWFzZTogbnVsbFxufVxuIiwiaW1wb3J0IHsgYmluZEFsbCB9IGZyb20gJy4vdXRpbHMnXG5cbmNvbnN0IFBSRVNTX0RFTEFZID0gMjAwXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdChpbnN0YW5jZSkge1xuICAgIGJpbmRBbGwodGhpcywgaW5zdGFuY2UpXG4gIH0sXG5cbiAgY2xpY2soZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgaWYgKGlzUHJlc3NpbmdNZXRhS2V5KGUpKSB7XG4gICAgICByZXR1cm4gd2luZG93Lm9wZW4oXG4gICAgICAgIHRoaXMudGFyZ2V0LnNyY09yaWdpbmFsIHx8IGUuY3VycmVudFRhcmdldC5zcmMsXG4gICAgICAgICdfYmxhbmsnXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLnNob3duKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yZWxlYXNlKClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vcGVuKGUuY3VycmVudFRhcmdldClcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc2Nyb2xsKCkge1xuICAgIGNvbnN0IGVsID1cbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCB8fCBkb2N1bWVudC5ib2R5LnBhcmVudE5vZGUgfHwgZG9jdW1lbnQuYm9keVxuICAgIGNvbnN0IHNjcm9sbExlZnQgPSB3aW5kb3cucGFnZVhPZmZzZXQgfHwgZWwuc2Nyb2xsTGVmdFxuICAgIGNvbnN0IHNjcm9sbFRvcCA9IHdpbmRvdy5wYWdlWU9mZnNldCB8fCBlbC5zY3JvbGxUb3BcblxuICAgIGlmICh0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSB7XG4gICAgICAgIHg6IHNjcm9sbExlZnQsXG4gICAgICAgIHk6IHNjcm9sbFRvcFxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uLnggLSBzY3JvbGxMZWZ0XG4gICAgY29uc3QgZGVsdGFZID0gdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24ueSAtIHNjcm9sbFRvcFxuICAgIGNvbnN0IHRocmVzaG9sZCA9IHRoaXMub3B0aW9ucy5zY3JvbGxUaHJlc2hvbGRcblxuICAgIGlmIChNYXRoLmFicyhkZWx0YVkpID49IHRocmVzaG9sZCB8fCBNYXRoLmFicyhkZWx0YVgpID49IHRocmVzaG9sZCkge1xuICAgICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9XG4gIH0sXG5cbiAga2V5ZG93bihlKSB7XG4gICAgaWYgKGlzRXNjYXBlKGUpKSB7XG4gICAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgICB0aGlzLmNsb3NlKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVsZWFzZSh0aGlzLmNsb3NlKVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBtb3VzZWRvd24oZSkge1xuICAgIGlmICghaXNMZWZ0QnV0dG9uKGUpIHx8IGlzUHJlc3NpbmdNZXRhS2V5KGUpKSByZXR1cm5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGVcblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoXG4gICAgICBmdW5jdGlvbiBncmFiT25Nb3VzZURvd24oKSB7XG4gICAgICAgIHRoaXMuZ3JhYihjbGllbnRYLCBjbGllbnRZKVxuICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgUFJFU1NfREVMQVlcbiAgICApXG4gIH0sXG5cbiAgbW91c2Vtb3ZlKGUpIHtcbiAgICBpZiAodGhpcy5yZWxlYXNlZCkgcmV0dXJuXG4gICAgdGhpcy5tb3ZlKGUuY2xpZW50WCwgZS5jbGllbnRZKVxuICB9LFxuXG4gIG1vdXNldXAoZSkge1xuICAgIGlmICghaXNMZWZ0QnV0dG9uKGUpIHx8IGlzUHJlc3NpbmdNZXRhS2V5KGUpKSByZXR1cm5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuXG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlbGVhc2UoKVxuICAgIH1cbiAgfSxcblxuICB0b3VjaHN0YXJ0KGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGUudG91Y2hlc1swXVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dChcbiAgICAgIGZ1bmN0aW9uIGdyYWJPblRvdWNoU3RhcnQoKSB7XG4gICAgICAgIHRoaXMuZ3JhYihjbGllbnRYLCBjbGllbnRZKVxuICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgUFJFU1NfREVMQVlcbiAgICApXG4gIH0sXG5cbiAgdG91Y2htb3ZlKGUpIHtcbiAgICBpZiAodGhpcy5yZWxlYXNlZCkgcmV0dXJuXG5cbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGUudG91Y2hlc1swXVxuICAgIHRoaXMubW92ZShjbGllbnRYLCBjbGllbnRZKVxuICB9LFxuXG4gIHRvdWNoZW5kKGUpIHtcbiAgICBpZiAoaXNUb3VjaGluZyhlKSkgcmV0dXJuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucHJlc3NUaW1lcilcblxuICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZWxlYXNlKClcbiAgICB9XG4gIH0sXG5cbiAgY2xpY2tPdmVybGF5KCkge1xuICAgIHRoaXMuY2xvc2UoKVxuICB9LFxuXG4gIHJlc2l6ZVdpbmRvdygpIHtcbiAgICB0aGlzLmNsb3NlKClcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0xlZnRCdXR0b24oZSkge1xuICByZXR1cm4gZS5idXR0b24gPT09IDBcbn1cblxuZnVuY3Rpb24gaXNQcmVzc2luZ01ldGFLZXkoZSkge1xuICByZXR1cm4gZS5tZXRhS2V5IHx8IGUuY3RybEtleVxufVxuXG5mdW5jdGlvbiBpc1RvdWNoaW5nKGUpIHtcbiAgZS50YXJnZXRUb3VjaGVzLmxlbmd0aCA+IDBcbn1cblxuZnVuY3Rpb24gaXNFc2NhcGUoZSkge1xuICBjb25zdCBjb2RlID0gZS5rZXkgfHwgZS5jb2RlXG4gIHJldHVybiBjb2RlID09PSAnRXNjYXBlJyB8fCBlLmtleUNvZGUgPT09IDI3XG59XG4iLCJpbXBvcnQgeyBsaXN0ZW4sIHNldFN0eWxlIH0gZnJvbSAnLi91dGlscydcblxuZXhwb3J0IGRlZmF1bHQge1xuICBpbml0KGluc3RhbmNlKSB7XG4gICAgdGhpcy5lbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG4gICAgdGhpcy5pbnN0YW5jZSA9IGluc3RhbmNlXG4gICAgdGhpcy5wYXJlbnQgPSBkb2N1bWVudC5ib2R5XG5cbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICByaWdodDogMCxcbiAgICAgIGJvdHRvbTogMCxcbiAgICAgIG9wYWNpdHk6IDBcbiAgICB9KVxuXG4gICAgdGhpcy51cGRhdGVTdHlsZShpbnN0YW5jZS5vcHRpb25zKVxuICAgIGxpc3Rlbih0aGlzLmVsLCAnY2xpY2snLCBpbnN0YW5jZS5oYW5kbGVyLmNsaWNrT3ZlcmxheS5iaW5kKGluc3RhbmNlKSlcbiAgfSxcblxuICB1cGRhdGVTdHlsZShvcHRpb25zKSB7XG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgekluZGV4OiBvcHRpb25zLnpJbmRleCxcbiAgICAgIGJhY2tncm91bmRDb2xvcjogb3B0aW9ucy5iZ0NvbG9yLFxuICAgICAgdHJhbnNpdGlvbjogYG9wYWNpdHlcbiAgICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25EdXJhdGlvbn1zXG4gICAgICAgICR7b3B0aW9ucy50cmFuc2l0aW9uVGltaW5nRnVuY3Rpb259YFxuICAgIH0pXG4gIH0sXG5cbiAgaW5zZXJ0KCkge1xuICAgIHRoaXMucGFyZW50LmFwcGVuZENoaWxkKHRoaXMuZWwpXG4gIH0sXG5cbiAgcmVtb3ZlKCkge1xuICAgIHRoaXMucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuZWwpXG4gIH0sXG5cbiAgZmFkZUluKCkge1xuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcbiAgICB0aGlzLmVsLnN0eWxlLm9wYWNpdHkgPSB0aGlzLmluc3RhbmNlLm9wdGlvbnMuYmdPcGFjaXR5XG4gIH0sXG5cbiAgZmFkZU91dCgpIHtcbiAgICB0aGlzLmVsLnN0eWxlLm9wYWNpdHkgPSAwXG4gIH1cbn1cbiIsImltcG9ydCB7IGN1cnNvciwgc2V0U3R5bGUsIGdldE9yaWdpbmFsU291cmNlLCB0cmFuc2Zvcm1Dc3NQcm9wIH0gZnJvbSAnLi91dGlscydcblxuLy8gVHJhbnNsYXRlIHotYXhpcyB0byBmaXggQ1NTIGdyaWQgZGlzcGxheSBpc3N1ZSBpbiBDaHJvbWU6XG4vLyBodHRwczovL2dpdGh1Yi5jb20va2luZ2RpZG85OTkvem9vbWluZy9pc3N1ZXMvNDJcbmNvbnN0IFRSQU5TTEFURV9aID0gMFxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQoZWwsIGluc3RhbmNlKSB7XG4gICAgdGhpcy5lbCA9IGVsXG4gICAgdGhpcy5pbnN0YW5jZSA9IGluc3RhbmNlXG4gICAgdGhpcy5zcmNUaHVtYm5haWwgPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnc3JjJylcbiAgICB0aGlzLnNyY3NldCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdzcmNzZXQnKVxuICAgIHRoaXMuc3JjT3JpZ2luYWwgPSBnZXRPcmlnaW5hbFNvdXJjZSh0aGlzLmVsKVxuICAgIHRoaXMucmVjdCA9IHRoaXMuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgICB0aGlzLnRyYW5zbGF0ZSA9IG51bGxcbiAgICB0aGlzLnNjYWxlID0gbnVsbFxuICAgIHRoaXMuc3R5bGVPcGVuID0gbnVsbFxuICAgIHRoaXMuc3R5bGVDbG9zZSA9IG51bGxcbiAgfSxcblxuICB6b29tSW4oKSB7XG4gICAgY29uc3Qge1xuICAgICAgekluZGV4LFxuICAgICAgZW5hYmxlR3JhYixcbiAgICAgIHRyYW5zaXRpb25EdXJhdGlvbixcbiAgICAgIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxuICAgIH0gPSB0aGlzLmluc3RhbmNlLm9wdGlvbnNcbiAgICB0aGlzLnRyYW5zbGF0ZSA9IHRoaXMuY2FsY3VsYXRlVHJhbnNsYXRlKClcbiAgICB0aGlzLnNjYWxlID0gdGhpcy5jYWxjdWxhdGVTY2FsZSgpXG5cbiAgICB0aGlzLnN0eWxlT3BlbiA9IHtcbiAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgekluZGV4OiB6SW5kZXggKyAxLFxuICAgICAgY3Vyc29yOiBlbmFibGVHcmFiID8gY3Vyc29yLmdyYWIgOiBjdXJzb3Iuem9vbU91dCxcbiAgICAgIHRyYW5zaXRpb246IGAke3RyYW5zZm9ybUNzc1Byb3B9XG4gICAgICAgICR7dHJhbnNpdGlvbkR1cmF0aW9ufXNcbiAgICAgICAgJHt0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb259YCxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZTNkKCR7dGhpcy50cmFuc2xhdGUueH1weCwgJHtcbiAgICAgICAgdGhpcy50cmFuc2xhdGUueVxuICAgICAgICB9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54fSwke3RoaXMuc2NhbGUueX0pYCxcbiAgICAgIGhlaWdodDogYCR7dGhpcy5yZWN0LmhlaWdodH1weGAsXG4gICAgICB3aWR0aDogYCR7dGhpcy5yZWN0LndpZHRofXB4YFxuICAgIH1cblxuICAgIC8vIEZvcmNlIGxheW91dCB1cGRhdGVcbiAgICB0aGlzLmVsLm9mZnNldFdpZHRoXG5cbiAgICAvLyBUcmlnZ2VyIHRyYW5zaXRpb25cbiAgICB0aGlzLnN0eWxlQ2xvc2UgPSBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlT3BlbiwgdHJ1ZSlcbiAgfSxcblxuICB6b29tT3V0KCkge1xuICAgIC8vIEZvcmNlIGxheW91dCB1cGRhdGVcbiAgICB0aGlzLmVsLm9mZnNldFdpZHRoXG5cbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7IHRyYW5zZm9ybTogJ25vbmUnIH0pXG4gIH0sXG5cbiAgZ3JhYih4LCB5LCBzY2FsZUV4dHJhKSB7XG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcbiAgICBjb25zdCBbZHgsIGR5XSA9IFt3aW5kb3dDZW50ZXIueCAtIHgsIHdpbmRvd0NlbnRlci55IC0geV1cblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIGN1cnNvcjogY3Vyc29yLm1vdmUsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUzZChcbiAgICAgICAgJHt0aGlzLnRyYW5zbGF0ZS54ICsgZHh9cHgsICR7dGhpcy50cmFuc2xhdGUueSArXG4gICAgICAgIGR5fXB4LCAke1RSQU5TTEFURV9afXB4KVxuICAgICAgICBzY2FsZSgke3RoaXMuc2NhbGUueCArIHNjYWxlRXh0cmF9LCR7dGhpcy5zY2FsZS55ICsgc2NhbGVFeHRyYX0pYFxuICAgIH0pXG4gIH0sXG5cbiAgbW92ZSh4LCB5LCBzY2FsZUV4dHJhKSB7XG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcbiAgICBjb25zdCBbZHgsIGR5XSA9IFt3aW5kb3dDZW50ZXIueCAtIHgsIHdpbmRvd0NlbnRlci55IC0geV1cblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybUNzc1Byb3AsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUzZChcbiAgICAgICAgJHt0aGlzLnRyYW5zbGF0ZS54ICsgZHh9cHgsICR7dGhpcy50cmFuc2xhdGUueSArXG4gICAgICAgIGR5fXB4LCAke1RSQU5TTEFURV9afXB4KVxuICAgICAgICBzY2FsZSgke3RoaXMuc2NhbGUueCArIHNjYWxlRXh0cmF9LCR7dGhpcy5zY2FsZS55ICsgc2NhbGVFeHRyYX0pYFxuICAgIH0pXG4gIH0sXG5cbiAgcmVzdG9yZUNsb3NlU3R5bGUoKSB7XG4gICAgc2V0U3R5bGUodGhpcy5lbCwgdGhpcy5zdHlsZUNsb3NlKVxuICB9LFxuXG4gIHJlc3RvcmVPcGVuU3R5bGUoKSB7XG4gICAgc2V0U3R5bGUodGhpcy5lbCwgdGhpcy5zdHlsZU9wZW4pXG4gIH0sXG5cbiAgdXBncmFkZVNvdXJjZSgpIHtcbiAgICBpZiAodGhpcy5zcmNPcmlnaW5hbCkge1xuICAgICAgY29uc3QgcGFyZW50Tm9kZSA9IHRoaXMuZWwucGFyZW50Tm9kZVxuXG4gICAgICBpZiAodGhpcy5zcmNzZXQpIHtcbiAgICAgICAgdGhpcy5lbC5yZW1vdmVBdHRyaWJ1dGUoJ3NyY3NldCcpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRlbXAgPSB0aGlzLmVsLmNsb25lTm9kZShmYWxzZSlcblxuICAgICAgLy8gRm9yY2UgY29tcHV0ZSB0aGUgaGktcmVzIGltYWdlIGluIERPTSB0byBwcmV2ZW50XG4gICAgICAvLyBpbWFnZSBmbGlja2VyaW5nIHdoaWxlIHVwZGF0aW5nIHNyY1xuICAgICAgdGVtcC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjT3JpZ2luYWwpXG4gICAgICB0ZW1wLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJ1xuICAgICAgdGVtcC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbidcbiAgICAgIHBhcmVudE5vZGUuYXBwZW5kQ2hpbGQodGVtcClcblxuICAgICAgLy8gQWRkIGRlbGF5IHRvIHByZXZlbnQgRmlyZWZveCBmcm9tIGZsaWNrZXJpbmdcbiAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgIGZ1bmN0aW9uIHVwZGF0ZVNyYygpIHtcbiAgICAgICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNPcmlnaW5hbClcbiAgICAgICAgICBwYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRlbXApXG4gICAgICAgIH0uYmluZCh0aGlzKSxcbiAgICAgICAgNTBcbiAgICAgIClcbiAgICB9XG4gIH0sXG5cbiAgZG93bmdyYWRlU291cmNlKCkge1xuICAgIGlmICh0aGlzLnNyY09yaWdpbmFsKSB7XG4gICAgICBpZiAodGhpcy5zcmNzZXQpIHtcbiAgICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3NyY3NldCcsIHRoaXMuc3Jjc2V0KVxuICAgICAgfVxuICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjVGh1bWJuYWlsKVxuICAgIH1cbiAgfSxcblxuICBjYWxjdWxhdGVUcmFuc2xhdGUoKSB7XG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcbiAgICBjb25zdCB0YXJnZXRDZW50ZXIgPSB7XG4gICAgICB4OiB0aGlzLnJlY3QubGVmdCArIHRoaXMucmVjdC53aWR0aCAvIDIsXG4gICAgICB5OiB0aGlzLnJlY3QudG9wICsgdGhpcy5yZWN0LmhlaWdodCAvIDJcbiAgICB9XG5cbiAgICAvLyBUaGUgdmVjdG9yIHRvIHRyYW5zbGF0ZSBpbWFnZSB0byB0aGUgd2luZG93IGNlbnRlclxuICAgIHJldHVybiB7XG4gICAgICB4OiB3aW5kb3dDZW50ZXIueCAtIHRhcmdldENlbnRlci54LFxuICAgICAgeTogd2luZG93Q2VudGVyLnkgLSB0YXJnZXRDZW50ZXIueVxuICAgIH1cbiAgfSxcblxuICBjYWxjdWxhdGVTY2FsZSgpIHtcbiAgICBjb25zdCB7IHpvb21pbmdIZWlnaHQsIHpvb21pbmdXaWR0aCB9ID0gdGhpcy5lbC5kYXRhc2V0XG4gICAgY29uc3QgeyBjdXN0b21TaXplLCBzY2FsZUJhc2UgfSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9uc1xuXG4gICAgaWYgKCFjdXN0b21TaXplICYmIHpvb21pbmdIZWlnaHQgJiYgem9vbWluZ1dpZHRoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiB6b29taW5nV2lkdGggLyB0aGlzLnJlY3Qud2lkdGgsXG4gICAgICAgIHk6IHpvb21pbmdIZWlnaHQgLyB0aGlzLnJlY3QuaGVpZ2h0XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjdXN0b21TaXplICYmIHR5cGVvZiBjdXN0b21TaXplID09PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogY3VzdG9tU2l6ZS53aWR0aCAvIHRoaXMucmVjdC53aWR0aCxcbiAgICAgICAgeTogY3VzdG9tU2l6ZS5oZWlnaHQgLyB0aGlzLnJlY3QuaGVpZ2h0XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRhcmdldEhhbGZXaWR0aCA9IHRoaXMucmVjdC53aWR0aCAvIDJcbiAgICAgIGNvbnN0IHRhcmdldEhhbGZIZWlnaHQgPSB0aGlzLnJlY3QuaGVpZ2h0IC8gMlxuICAgICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcblxuICAgICAgLy8gVGhlIGRpc3RhbmNlIGJldHdlZW4gdGFyZ2V0IGVkZ2UgYW5kIHdpbmRvdyBlZGdlXG4gICAgICBjb25zdCB0YXJnZXRFZGdlVG9XaW5kb3dFZGdlID0ge1xuICAgICAgICB4OiB3aW5kb3dDZW50ZXIueCAtIHRhcmdldEhhbGZXaWR0aCxcbiAgICAgICAgeTogd2luZG93Q2VudGVyLnkgLSB0YXJnZXRIYWxmSGVpZ2h0XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNjYWxlSG9yaXpvbnRhbGx5ID0gdGFyZ2V0RWRnZVRvV2luZG93RWRnZS54IC8gdGFyZ2V0SGFsZldpZHRoXG4gICAgICBjb25zdCBzY2FsZVZlcnRpY2FsbHkgPSB0YXJnZXRFZGdlVG9XaW5kb3dFZGdlLnkgLyB0YXJnZXRIYWxmSGVpZ2h0XG5cbiAgICAgIC8vIFRoZSBhZGRpdGlvbmFsIHNjYWxlIGlzIGJhc2VkIG9uIHRoZSBzbWFsbGVyIHZhbHVlIG9mXG4gICAgICAvLyBzY2FsaW5nIGhvcml6b250YWxseSBhbmQgc2NhbGluZyB2ZXJ0aWNhbGx5XG4gICAgICBjb25zdCBzY2FsZSA9IHNjYWxlQmFzZSArIE1hdGgubWluKHNjYWxlSG9yaXpvbnRhbGx5LCBzY2FsZVZlcnRpY2FsbHkpXG5cbiAgICAgIGlmIChjdXN0b21TaXplICYmIHR5cGVvZiBjdXN0b21TaXplID09PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBVc2Ugem9vbWluZ1dpZHRoIGFuZCB6b29taW5nSGVpZ2h0IGlmIGF2YWlsYWJsZVxuICAgICAgICBjb25zdCBuYXR1cmFsV2lkdGggPSB6b29taW5nV2lkdGggfHwgdGhpcy5lbC5uYXR1cmFsV2lkdGhcbiAgICAgICAgY29uc3QgbmF0dXJhbEhlaWdodCA9IHpvb21pbmdIZWlnaHQgfHwgdGhpcy5lbC5uYXR1cmFsSGVpZ2h0XG4gICAgICAgIGNvbnN0IG1heFpvb21pbmdXaWR0aCA9XG4gICAgICAgICAgcGFyc2VGbG9hdChjdXN0b21TaXplKSAqIG5hdHVyYWxXaWR0aCAvICgxMDAgKiB0aGlzLnJlY3Qud2lkdGgpXG4gICAgICAgIGNvbnN0IG1heFpvb21pbmdIZWlnaHQgPVxuICAgICAgICAgIHBhcnNlRmxvYXQoY3VzdG9tU2l6ZSkgKiBuYXR1cmFsSGVpZ2h0IC8gKDEwMCAqIHRoaXMucmVjdC5oZWlnaHQpXG5cbiAgICAgICAgLy8gT25seSBzY2FsZSBpbWFnZSB1cCB0byB0aGUgc3BlY2lmaWVkIGN1c3RvbVNpemUgcGVyY2VudGFnZVxuICAgICAgICBpZiAoc2NhbGUgPiBtYXhab29taW5nV2lkdGggfHwgc2NhbGUgPiBtYXhab29taW5nSGVpZ2h0KSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IG1heFpvb21pbmdXaWR0aCxcbiAgICAgICAgICAgIHk6IG1heFpvb21pbmdIZWlnaHRcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogc2NhbGUsXG4gICAgICAgIHk6IHNjYWxlXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldFdpbmRvd0NlbnRlcigpIHtcbiAgY29uc3QgZG9jRWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcbiAgY29uc3Qgd2luZG93V2lkdGggPSBNYXRoLm1pbihkb2NFbC5jbGllbnRXaWR0aCwgd2luZG93LmlubmVyV2lkdGgpXG4gIGNvbnN0IHdpbmRvd0hlaWdodCA9IE1hdGgubWluKGRvY0VsLmNsaWVudEhlaWdodCwgd2luZG93LmlubmVySGVpZ2h0KVxuXG4gIHJldHVybiB7XG4gICAgeDogd2luZG93V2lkdGggLyAyLFxuICAgIHk6IHdpbmRvd0hlaWdodCAvIDJcbiAgfVxufVxuIiwiaW1wb3J0IHtcbiAgY3Vyc29yLFxuICBsaXN0ZW4sXG4gIGxvYWRJbWFnZSxcbiAgdHJhbnNFbmRFdmVudCxcbiAgZ2V0T3JpZ2luYWxTb3VyY2Vcbn0gZnJvbSAnLi91dGlscydcbmltcG9ydCBERUZBVUxUX09QVElPTlMgZnJvbSAnLi9vcHRpb25zJ1xuXG5pbXBvcnQgaGFuZGxlciBmcm9tICcuL2hhbmRsZXInXG5pbXBvcnQgb3ZlcmxheSBmcm9tICcuL292ZXJsYXknXG5pbXBvcnQgdGFyZ2V0IGZyb20gJy4vdGFyZ2V0J1xuXG4vKipcbiAqIFpvb21pbmcgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFpvb21pbmcge1xuICAvKipcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBVcGRhdGUgZGVmYXVsdCBvcHRpb25zIGlmIHByb3ZpZGVkLlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHRoaXMudGFyZ2V0ID0gT2JqZWN0LmNyZWF0ZSh0YXJnZXQpXG4gICAgdGhpcy5vdmVybGF5ID0gT2JqZWN0LmNyZWF0ZShvdmVybGF5KVxuICAgIHRoaXMuaGFuZGxlciA9IE9iamVjdC5jcmVhdGUoaGFuZGxlcilcbiAgICB0aGlzLmJvZHkgPSBkb2N1bWVudC5ib2R5XG5cbiAgICB0aGlzLnNob3duID0gZmFsc2VcbiAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgIHRoaXMucmVsZWFzZWQgPSB0cnVlXG4gICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gbnVsbFxuXG4gICAgdGhpcy5vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9PUFRJT05TLCBvcHRpb25zKVxuICAgIHRoaXMub3ZlcmxheS5pbml0KHRoaXMpXG4gICAgdGhpcy5oYW5kbGVyLmluaXQodGhpcylcbiAgICB0aGlzLmxpc3Rlbih0aGlzLm9wdGlvbnMuZGVmYXVsdFpvb21hYmxlKVxuICB9XG5cbiAgLyoqXG4gICAqIE1ha2UgZWxlbWVudChzKSB6b29tYWJsZS5cbiAgICogQHBhcmFtICB7c3RyaW5nfEVsZW1lbnR9IGVsIEEgY3NzIHNlbGVjdG9yIG9yIGFuIEVsZW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBsaXN0ZW4oZWwpIHtcbiAgICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbClcbiAgICAgIGxldCBpID0gZWxzLmxlbmd0aFxuXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMubGlzdGVuKGVsc1tpXSlcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVsLnRhZ05hbWUgPT09ICdJTUcnKSB7XG4gICAgICBlbC5zdHlsZS5jdXJzb3IgPSBjdXJzb3Iuem9vbUluXG4gICAgICBsaXN0ZW4oZWwsICdjbGljaycsIHRoaXMuaGFuZGxlci5jbGljaylcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5wcmVsb2FkSW1hZ2UpIHtcbiAgICAgICAgbG9hZEltYWdlKGdldE9yaWdpbmFsU291cmNlKGVsKSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBvcHRpb25zIG9yIHJldHVybiBjdXJyZW50IG9wdGlvbnMgaWYgbm8gYXJndW1lbnQgaXMgcHJvdmlkZWQuXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyBBbiBPYmplY3QgdGhhdCBjb250YWlucyB0aGlzLm9wdGlvbnMuXG4gICAqIEByZXR1cm4ge3RoaXN8dGhpcy5vcHRpb25zfVxuICAgKi9cbiAgY29uZmlnKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucykge1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLm9wdGlvbnMsIG9wdGlvbnMpXG4gICAgICB0aGlzLm92ZXJsYXkudXBkYXRlU3R5bGUodGhpcy5vcHRpb25zKVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMub3B0aW9uc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPcGVuICh6b29tIGluKSB0aGUgRWxlbWVudC5cbiAgICogQHBhcmFtICB7RWxlbWVudH0gZWwgVGhlIEVsZW1lbnQgdG8gb3Blbi5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25PcGVuXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbFxuICAgKiBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBvcGVuZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldFxuICAgKiB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgb3BlbihlbCwgY2IgPSB0aGlzLm9wdGlvbnMub25PcGVuKSB7XG4gICAgaWYgKHRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKSA6IGVsXG5cbiAgICBpZiAodGFyZ2V0LnRhZ05hbWUgIT09ICdJTUcnKSByZXR1cm5cblxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKSB7XG4gICAgICB0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKHRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5pbml0KHRhcmdldCwgdGhpcylcblxuICAgIGlmICghdGhpcy5vcHRpb25zLnByZWxvYWRJbWFnZSkge1xuICAgICAgbG9hZEltYWdlKHRoaXMudGFyZ2V0LnNyY09yaWdpbmFsKVxuICAgIH1cblxuICAgIHRoaXMuc2hvd24gPSB0cnVlXG4gICAgdGhpcy5sb2NrID0gdHJ1ZVxuXG4gICAgdGhpcy50YXJnZXQuem9vbUluKClcbiAgICB0aGlzLm92ZXJsYXkuaW5zZXJ0KClcbiAgICB0aGlzLm92ZXJsYXkuZmFkZUluKClcblxuICAgIGxpc3Rlbihkb2N1bWVudCwgJ3Njcm9sbCcsIHRoaXMuaGFuZGxlci5zY3JvbGwpXG4gICAgbGlzdGVuKGRvY3VtZW50LCAna2V5ZG93bicsIHRoaXMuaGFuZGxlci5rZXlkb3duKVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uV2luZG93UmVzaXplKSB7XG4gICAgICBsaXN0ZW4od2luZG93LCAncmVzaXplJywgdGhpcy5oYW5kbGVyLnJlc2l6ZVdpbmRvdylcbiAgICB9XG5cbiAgICBjb25zdCBvbk9wZW5FbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk9wZW5FbmQsIGZhbHNlKVxuICAgICAgdGhpcy5sb2NrID0gZmFsc2VcbiAgICAgIHRoaXMudGFyZ2V0LnVwZ3JhZGVTb3VyY2UoKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHtcbiAgICAgICAgdG9nZ2xlR3JhYkxpc3RlbmVycyhkb2N1bWVudCwgdGhpcy5oYW5kbGVyLCB0cnVlKVxuICAgICAgfVxuXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk9wZW5FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3NlICh6b29tIG91dCkgdGhlIEVsZW1lbnQgY3VycmVudGx5IG9wZW5lZC5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25DbG9zZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGxcbiAgICogYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgY2xvc2VkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbCBnZXRcbiAgICogdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGNsb3NlKGNiID0gdGhpcy5vcHRpb25zLm9uQ2xvc2UpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZUNsb3NlKHRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLmxvY2sgPSB0cnVlXG4gICAgdGhpcy5ib2R5LnN0eWxlLmN1cnNvciA9IGN1cnNvci5kZWZhdWx0XG4gICAgdGhpcy5vdmVybGF5LmZhZGVPdXQoKVxuICAgIHRoaXMudGFyZ2V0Lnpvb21PdXQoKVxuXG4gICAgbGlzdGVuKGRvY3VtZW50LCAnc2Nyb2xsJywgdGhpcy5oYW5kbGVyLnNjcm9sbCwgZmFsc2UpXG4gICAgbGlzdGVuKGRvY3VtZW50LCAna2V5ZG93bicsIHRoaXMuaGFuZGxlci5rZXlkb3duLCBmYWxzZSlcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbldpbmRvd1Jlc2l6ZSkge1xuICAgICAgbGlzdGVuKHdpbmRvdywgJ3Jlc2l6ZScsIHRoaXMuaGFuZGxlci5yZXNpemVXaW5kb3csIGZhbHNlKVxuICAgIH1cblxuICAgIGNvbnN0IG9uQ2xvc2VFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbkNsb3NlRW5kLCBmYWxzZSlcblxuICAgICAgdGhpcy5zaG93biA9IGZhbHNlXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuXG4gICAgICB0aGlzLnRhcmdldC5kb3duZ3JhZGVTb3VyY2UoKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHtcbiAgICAgICAgdG9nZ2xlR3JhYkxpc3RlbmVycyhkb2N1bWVudCwgdGhpcy5oYW5kbGVyLCBmYWxzZSlcbiAgICAgIH1cblxuICAgICAgdGhpcy50YXJnZXQucmVzdG9yZUNsb3NlU3R5bGUoKVxuICAgICAgdGhpcy5vdmVybGF5LnJlbW92ZSgpXG5cbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uQ2xvc2VFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEdyYWIgdGhlIEVsZW1lbnQgY3VycmVudGx5IG9wZW5lZCBnaXZlbiBhIHBvc2l0aW9uIGFuZCBhcHBseSBleHRyYSB6b29tLWluLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeCBUaGUgWC1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHkgVGhlIFktYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICBzY2FsZUV4dHJhIEV4dHJhIHpvb20taW4gdG8gYXBwbHkuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uR3JhYl0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgZ3JhYmJlZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0XG4gICAqIHdpbGwgZ2V0IHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBncmFiKHgsIHksIHNjYWxlRXh0cmEgPSB0aGlzLm9wdGlvbnMuc2NhbGVFeHRyYSwgY2IgPSB0aGlzLm9wdGlvbnMub25HcmFiKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMucmVsZWFzZWQgPSBmYWxzZVxuICAgIHRoaXMudGFyZ2V0LmdyYWIoeCwgeSwgc2NhbGVFeHRyYSlcblxuICAgIGNvbnN0IG9uR3JhYkVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uR3JhYkVuZCwgZmFsc2UpXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbkdyYWJFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIE1vdmUgdGhlIEVsZW1lbnQgY3VycmVudGx5IGdyYWJiZWQgZ2l2ZW4gYSBwb3NpdGlvbiBhbmQgYXBwbHkgZXh0cmEgem9vbS1pbi5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHggVGhlIFgtYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB5IFRoZSBZLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgc2NhbGVFeHRyYSBFeHRyYSB6b29tLWluIHRvIGFwcGx5LlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbk1vdmVdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG1vdmVkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbFxuICAgKiBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIG1vdmUoeCwgeSwgc2NhbGVFeHRyYSA9IHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhLCBjYiA9IHRoaXMub3B0aW9ucy5vbk1vdmUpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIHRoaXMucmVsZWFzZWQgPSBmYWxzZVxuICAgIHRoaXMuYm9keS5zdHlsZS5jdXJzb3IgPSBjdXJzb3IubW92ZVxuICAgIHRoaXMudGFyZ2V0Lm1vdmUoeCwgeSwgc2NhbGVFeHRyYSlcblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBjb25zdCBvbk1vdmVFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk1vdmVFbmQsIGZhbHNlKVxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25Nb3ZlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWxlYXNlIHRoZSBFbGVtZW50IGN1cnJlbnRseSBncmFiYmVkLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vblJlbGVhc2VdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIHJlbGVhc2VkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXRcbiAgICogd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIHJlbGVhc2UoY2IgPSB0aGlzLm9wdGlvbnMub25SZWxlYXNlKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMubG9jayA9IHRydWVcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLmRlZmF1bHRcbiAgICB0aGlzLnRhcmdldC5yZXN0b3JlT3BlblN0eWxlKClcblxuICAgIGNvbnN0IG9uUmVsZWFzZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uUmVsZWFzZUVuZCwgZmFsc2UpXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgICAgdGhpcy5yZWxlYXNlZCA9IHRydWVcblxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25SZWxlYXNlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVHcmFiTGlzdGVuZXJzKGVsLCBoYW5kbGVyLCBhZGQpIHtcbiAgY29uc3QgdHlwZXMgPSBbXG4gICAgJ21vdXNlZG93bicsXG4gICAgJ21vdXNlbW92ZScsXG4gICAgJ21vdXNldXAnLFxuICAgICd0b3VjaHN0YXJ0JyxcbiAgICAndG91Y2htb3ZlJyxcbiAgICAndG91Y2hlbmQnXG4gIF1cblxuICB0eXBlcy5mb3JFYWNoKGZ1bmN0aW9uIHRvZ2dsZUxpc3RlbmVyKHR5cGUpIHtcbiAgICBsaXN0ZW4oZWwsIHR5cGUsIGhhbmRsZXJbdHlwZV0sIGFkZClcbiAgfSlcbn1cbiJdLCJuYW1lcyI6WyJ3ZWJraXRQcmVmaXgiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsInN0eWxlIiwiY3Vyc29yIiwibGlzdGVuIiwiZWwiLCJldmVudCIsImhhbmRsZXIiLCJhZGQiLCJvcHRpb25zIiwicGFzc2l2ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwibG9hZEltYWdlIiwic3JjIiwiY2IiLCJpbWciLCJJbWFnZSIsIm9ubG9hZCIsIm9uSW1hZ2VMb2FkIiwiZ2V0T3JpZ2luYWxTb3VyY2UiLCJkYXRhc2V0Iiwib3JpZ2luYWwiLCJwYXJlbnROb2RlIiwidGFnTmFtZSIsImdldEF0dHJpYnV0ZSIsInNldFN0eWxlIiwic3R5bGVzIiwicmVtZW1iZXIiLCJzIiwia2V5IiwiYmluZEFsbCIsIl90aGlzIiwidGhhdCIsIm1ldGhvZHMiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eU5hbWVzIiwiZ2V0UHJvdG90eXBlT2YiLCJmb3JFYWNoIiwiYmluZE9uZSIsIm1ldGhvZCIsImJpbmQiLCJ0cmFucyIsInNuaWZmVHJhbnNpdGlvbiIsImNyZWF0ZUVsZW1lbnQiLCJ0cmFuc2Zvcm1Dc3NQcm9wIiwidHJhbnNFbmRFdmVudCIsImNoZWNrVHJhbnMiLCJ0cmFuc2l0aW9uUHJvcCIsInRyYW5zZm9ybVByb3AiLCJ0cmFuc2l0aW9uIiwidmFsdWUiLCJ0cmFuc2Zvcm0iLCJyZXMiLCJ0Zm9ybSIsImVuZCIsInNvbWUiLCJoYXNUcmFuc2l0aW9uIiwicHJvcCIsInVuZGVmaW5lZCIsImhhc1RyYW5zZm9ybSIsInJlcGxhY2UiLCJQUkVTU19ERUxBWSIsImluc3RhbmNlIiwiZSIsInByZXZlbnREZWZhdWx0IiwiaXNQcmVzc2luZ01ldGFLZXkiLCJ3aW5kb3ciLCJvcGVuIiwidGFyZ2V0Iiwic3JjT3JpZ2luYWwiLCJjdXJyZW50VGFyZ2V0Iiwic2hvd24iLCJyZWxlYXNlZCIsImNsb3NlIiwicmVsZWFzZSIsImJvZHkiLCJzY3JvbGxMZWZ0IiwicGFnZVhPZmZzZXQiLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImxhc3RTY3JvbGxQb3NpdGlvbiIsImRlbHRhWCIsIngiLCJkZWx0YVkiLCJ5IiwidGhyZXNob2xkIiwic2Nyb2xsVGhyZXNob2xkIiwiTWF0aCIsImFicyIsImlzRXNjYXBlIiwiaXNMZWZ0QnV0dG9uIiwiY2xpZW50WCIsImNsaWVudFkiLCJwcmVzc1RpbWVyIiwic2V0VGltZW91dCIsImdyYWJPbk1vdXNlRG93biIsImdyYWIiLCJtb3ZlIiwidG91Y2hlcyIsImdyYWJPblRvdWNoU3RhcnQiLCJpc1RvdWNoaW5nIiwiYnV0dG9uIiwibWV0YUtleSIsImN0cmxLZXkiLCJ0YXJnZXRUb3VjaGVzIiwibGVuZ3RoIiwiY29kZSIsImtleUNvZGUiLCJwYXJlbnQiLCJ1cGRhdGVTdHlsZSIsImNsaWNrT3ZlcmxheSIsInpJbmRleCIsImJnQ29sb3IiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJ0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24iLCJhcHBlbmRDaGlsZCIsInJlbW92ZUNoaWxkIiwib2Zmc2V0V2lkdGgiLCJvcGFjaXR5IiwiYmdPcGFjaXR5IiwiVFJBTlNMQVRFX1oiLCJzcmNUaHVtYm5haWwiLCJzcmNzZXQiLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwidHJhbnNsYXRlIiwic2NhbGUiLCJzdHlsZU9wZW4iLCJzdHlsZUNsb3NlIiwiZW5hYmxlR3JhYiIsImNhbGN1bGF0ZVRyYW5zbGF0ZSIsImNhbGN1bGF0ZVNjYWxlIiwiem9vbU91dCIsImhlaWdodCIsIndpZHRoIiwic2NhbGVFeHRyYSIsIndpbmRvd0NlbnRlciIsImdldFdpbmRvd0NlbnRlciIsImR4IiwiZHkiLCJyZW1vdmVBdHRyaWJ1dGUiLCJ0ZW1wIiwiY2xvbmVOb2RlIiwic2V0QXR0cmlidXRlIiwicG9zaXRpb24iLCJ2aXNpYmlsaXR5IiwidXBkYXRlU3JjIiwidGFyZ2V0Q2VudGVyIiwibGVmdCIsInRvcCIsInpvb21pbmdIZWlnaHQiLCJ6b29taW5nV2lkdGgiLCJjdXN0b21TaXplIiwic2NhbGVCYXNlIiwidGFyZ2V0SGFsZldpZHRoIiwidGFyZ2V0SGFsZkhlaWdodCIsInRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsIm1pbiIsIm5hdHVyYWxXaWR0aCIsIm5hdHVyYWxIZWlnaHQiLCJtYXhab29taW5nV2lkdGgiLCJwYXJzZUZsb2F0IiwibWF4Wm9vbWluZ0hlaWdodCIsImRvY0VsIiwid2luZG93V2lkdGgiLCJjbGllbnRXaWR0aCIsImlubmVyV2lkdGgiLCJ3aW5kb3dIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJpbm5lckhlaWdodCIsIlpvb21pbmciLCJjcmVhdGUiLCJvdmVybGF5IiwibG9jayIsImJhYmVsSGVscGVycy5leHRlbmRzIiwiREVGQVVMVF9PUFRJT05TIiwiaW5pdCIsImRlZmF1bHRab29tYWJsZSIsImVscyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwiem9vbUluIiwiY2xpY2siLCJwcmVsb2FkSW1hZ2UiLCJvbk9wZW4iLCJxdWVyeVNlbGVjdG9yIiwib25CZWZvcmVPcGVuIiwiaW5zZXJ0IiwiZmFkZUluIiwic2Nyb2xsIiwia2V5ZG93biIsImNsb3NlT25XaW5kb3dSZXNpemUiLCJyZXNpemVXaW5kb3ciLCJvbk9wZW5FbmQiLCJ1cGdyYWRlU291cmNlIiwib25DbG9zZSIsIm9uQmVmb3JlQ2xvc2UiLCJkZWZhdWx0IiwiZmFkZU91dCIsIm9uQ2xvc2VFbmQiLCJkb3duZ3JhZGVTb3VyY2UiLCJyZXN0b3JlQ2xvc2VTdHlsZSIsInJlbW92ZSIsIm9uR3JhYiIsIm9uQmVmb3JlR3JhYiIsIm9uR3JhYkVuZCIsIm9uTW92ZSIsIm9uTW92ZUVuZCIsIm9uUmVsZWFzZSIsIm9uQmVmb3JlUmVsZWFzZSIsInJlc3RvcmVPcGVuU3R5bGUiLCJvblJlbGVhc2VFbmQiLCJ0b2dnbGVHcmFiTGlzdGVuZXJzIiwidHlwZXMiLCJ0b2dnbGVMaXN0ZW5lciIsInR5cGUiXSwibWFwcGluZ3MiOiJBQUFPLElBQU1BLGVBQWUsc0JBQXNCQyxTQUFTQyxlQUFULENBQXlCQyxLQUEvQyxHQUN4QixVQUR3QixHQUV4QixFQUZHOztBQUlQLEFBQU8sSUFBTUMsU0FBUztXQUNYLE1BRFc7VUFFVEosWUFBWCxZQUZvQjtXQUdSQSxZQUFaLGFBSG9CO1FBSVhBLFlBQVQsU0FKb0I7UUFLZDtDQUxEOztBQVFQLEFBQU8sU0FBU0ssTUFBVCxDQUFpQkMsRUFBakIsRUFBcUJDLEtBQXJCLEVBQTRCQyxPQUE1QixFQUFpRDtNQUFaQyxHQUFZLHVFQUFOLElBQU07O01BQ2hEQyxVQUFVLEVBQUVDLFNBQVMsS0FBWCxFQUFoQjs7TUFFSUYsR0FBSixFQUFTO09BQ0pHLGdCQUFILENBQW9CTCxLQUFwQixFQUEyQkMsT0FBM0IsRUFBb0NFLE9BQXBDO0dBREYsTUFFTztPQUNGRyxtQkFBSCxDQUF1Qk4sS0FBdkIsRUFBOEJDLE9BQTlCLEVBQXVDRSxPQUF2Qzs7OztBQUlKLEFBQU8sU0FBU0ksU0FBVCxDQUFvQkMsR0FBcEIsRUFBeUJDLEVBQXpC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
