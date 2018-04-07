(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Zooming = factory());
}(this, (function () { 'use strict';

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

return Zooming;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9vbWluZy5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3V0aWxzLmpzIiwiLi4vc3JjL29wdGlvbnMuanMiLCIuLi9zcmMvaGFuZGxlci5qcyIsIi4uL3NyYy9vdmVybGF5LmpzIiwiLi4vc3JjL3RhcmdldC5qcyIsIi4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3Qgd2Via2l0UHJlZml4ID0gJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZVxuICA/ICctd2Via2l0LSdcbiAgOiAnJ1xuXG5leHBvcnQgY29uc3QgY3Vyc29yID0ge1xuICBkZWZhdWx0OiAnYXV0bycsXG4gIHpvb21JbjogYCR7d2Via2l0UHJlZml4fXpvb20taW5gLFxuICB6b29tT3V0OiBgJHt3ZWJraXRQcmVmaXh9em9vbS1vdXRgLFxuICBncmFiOiBgJHt3ZWJraXRQcmVmaXh9Z3JhYmAsXG4gIG1vdmU6ICdtb3ZlJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdGVuIChlbCwgZXZlbnQsIGhhbmRsZXIsIGFkZCA9IHRydWUpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IHsgcGFzc2l2ZTogZmFsc2UgfVxuXG4gIGlmIChhZGQpIHtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyLCBvcHRpb25zKVxuICB9IGVsc2Uge1xuICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRJbWFnZSAoc3JjLCBjYikge1xuICBpZiAoc3JjKSB7XG4gICAgY29uc3QgaW1nID0gbmV3IEltYWdlKClcblxuICAgIGltZy5vbmxvYWQgPSBmdW5jdGlvbiBvbkltYWdlTG9hZCAoKSB7XG4gICAgICBpZiAoY2IpIGNiKGltZylcbiAgICB9XG5cbiAgICBpbWcuc3JjID0gc3JjXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE9yaWdpbmFsU291cmNlIChlbCkge1xuICBpZiAoZWwuZGF0YXNldC5vcmlnaW5hbCkge1xuICAgIHJldHVybiBlbC5kYXRhc2V0Lm9yaWdpbmFsXG4gIH0gZWxzZSBpZiAoZWwucGFyZW50Tm9kZS50YWdOYW1lID09PSAnQScpIHtcbiAgICByZXR1cm4gZWwucGFyZW50Tm9kZS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFN0eWxlIChlbCwgc3R5bGVzLCByZW1lbWJlcikge1xuICBjaGVja1RyYW5zKHN0eWxlcylcblxuICBsZXQgcyA9IGVsLnN0eWxlXG4gIGxldCBvcmlnaW5hbCA9IHt9XG5cbiAgZm9yIChsZXQga2V5IGluIHN0eWxlcykge1xuICAgIGlmIChyZW1lbWJlcikge1xuICAgICAgb3JpZ2luYWxba2V5XSA9IHNba2V5XSB8fCAnJ1xuICAgIH1cblxuICAgIHNba2V5XSA9IHN0eWxlc1trZXldXG4gIH1cblxuICByZXR1cm4gb3JpZ2luYWxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmRBbGwgKF90aGlzLCB0aGF0KSB7XG4gIGNvbnN0IG1ldGhvZHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhPYmplY3QuZ2V0UHJvdG90eXBlT2YoX3RoaXMpKVxuICBtZXRob2RzLmZvckVhY2goZnVuY3Rpb24gYmluZE9uZSAobWV0aG9kKSB7XG4gICAgX3RoaXNbbWV0aG9kXSA9IF90aGlzW21ldGhvZF0uYmluZCh0aGF0KVxuICB9KVxufVxuXG5jb25zdCB0cmFucyA9IHNuaWZmVHJhbnNpdGlvbihkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSlcbmV4cG9ydCBjb25zdCB0cmFuc2Zvcm1Dc3NQcm9wID0gdHJhbnMudHJhbnNmb3JtQ3NzUHJvcFxuZXhwb3J0IGNvbnN0IHRyYW5zRW5kRXZlbnQgPSB0cmFucy50cmFuc0VuZEV2ZW50XG5cbmZ1bmN0aW9uIGNoZWNrVHJhbnMgKHN0eWxlcykge1xuICBjb25zdCB7IHRyYW5zaXRpb25Qcm9wLCB0cmFuc2Zvcm1Qcm9wIH0gPSB0cmFuc1xuXG4gIGlmIChzdHlsZXMudHJhbnNpdGlvbikge1xuICAgIGNvbnN0IHZhbHVlID0gc3R5bGVzLnRyYW5zaXRpb25cbiAgICBkZWxldGUgc3R5bGVzLnRyYW5zaXRpb25cbiAgICBzdHlsZXNbdHJhbnNpdGlvblByb3BdID0gdmFsdWVcbiAgfVxuXG4gIGlmIChzdHlsZXMudHJhbnNmb3JtKSB7XG4gICAgY29uc3QgdmFsdWUgPSBzdHlsZXMudHJhbnNmb3JtXG4gICAgZGVsZXRlIHN0eWxlcy50cmFuc2Zvcm1cbiAgICBzdHlsZXNbdHJhbnNmb3JtUHJvcF0gPSB2YWx1ZVxuICB9XG59XG5cbmZ1bmN0aW9uIHNuaWZmVHJhbnNpdGlvbiAoZWwpIHtcbiAgbGV0IHJlcyA9IHt9XG4gIGNvbnN0IHRyYW5zID0gWyd3ZWJraXRUcmFuc2l0aW9uJywgJ3RyYW5zaXRpb24nLCAnbW96VHJhbnNpdGlvbiddXG4gIGNvbnN0IHRmb3JtID0gWyd3ZWJraXRUcmFuc2Zvcm0nLCAndHJhbnNmb3JtJywgJ21velRyYW5zZm9ybSddXG4gIGNvbnN0IGVuZCA9IHtcbiAgICB0cmFuc2l0aW9uOiAndHJhbnNpdGlvbmVuZCcsXG4gICAgbW96VHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnLFxuICAgIHdlYmtpdFRyYW5zaXRpb246ICd3ZWJraXRUcmFuc2l0aW9uRW5kJ1xuICB9XG5cbiAgdHJhbnMuc29tZShmdW5jdGlvbiBoYXNUcmFuc2l0aW9uIChwcm9wKSB7XG4gICAgaWYgKGVsLnN0eWxlW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlcy50cmFuc2l0aW9uUHJvcCA9IHByb3BcbiAgICAgIHJlcy50cmFuc0VuZEV2ZW50ID0gZW5kW3Byb3BdXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfSlcblxuICB0Zm9ybS5zb21lKGZ1bmN0aW9uIGhhc1RyYW5zZm9ybSAocHJvcCkge1xuICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXMudHJhbnNmb3JtUHJvcCA9IHByb3BcbiAgICAgIHJlcy50cmFuc2Zvcm1Dc3NQcm9wID0gcHJvcC5yZXBsYWNlKC8oLiopVHJhbnNmb3JtLywgJy0kMS10cmFuc2Zvcm0nKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJlc1xufVxuIiwiZXhwb3J0IGRlZmF1bHQge1xuXG4gIC8qKlxuICAgKiBUbyBiZSBhYmxlIHRvIGdyYWIgYW5kIGRyYWcgdGhlIGltYWdlIGZvciBleHRyYSB6b29tLWluLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIGVuYWJsZUdyYWI6IHRydWUsXG5cbiAgLyoqXG4gICAqIFByZWxvYWQgem9vbWFibGUgaW1hZ2VzLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIHByZWxvYWRJbWFnZTogZmFsc2UsXG5cbiAgLyoqXG4gICAqIENsb3NlIHRoZSB6b29tZWQgaW1hZ2Ugd2hlbiBicm93c2VyIHdpbmRvdyBpcyByZXNpemVkLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIGNsb3NlT25XaW5kb3dSZXNpemU6IHRydWUsXG5cbiAgLyoqXG4gICAqIFRyYW5zaXRpb24gZHVyYXRpb24gaW4gc2Vjb25kcy5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRyYW5zaXRpb25EdXJhdGlvbjogMC40LFxuXG4gIC8qKlxuICAgKiBUcmFuc2l0aW9uIHRpbWluZyBmdW5jdGlvbi5cbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbjogJ2N1YmljLWJlemllcigwLjQsIDAsIDAsIDEpJyxcblxuICAvKipcbiAgICogT3ZlcmxheSBiYWNrZ3JvdW5kIGNvbG9yLlxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgYmdDb2xvcjogJ3JnYigyNTUsIDI1NSwgMjU1KScsXG5cbiAgLyoqXG4gICAqIE92ZXJsYXkgYmFja2dyb3VuZCBvcGFjaXR5LlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgYmdPcGFjaXR5OiAxLFxuXG4gIC8qKlxuICAgKiBUaGUgYmFzZSBzY2FsZSBmYWN0b3IgZm9yIHpvb21pbmcuIEJ5IGRlZmF1bHQgc2NhbGUgdG8gZml0IHRoZSB3aW5kb3cuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY2FsZUJhc2U6IDEuMCxcblxuICAvKipcbiAgICogVGhlIGFkZGl0aW9uYWwgc2NhbGUgZmFjdG9yIHdoZW4gZ3JhYmJpbmcgdGhlIGltYWdlLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgc2NhbGVFeHRyYTogMC41LFxuXG4gIC8qKlxuICAgKiBIb3cgbXVjaCBzY3JvbGxpbmcgaXQgdGFrZXMgYmVmb3JlIGNsb3Npbmcgb3V0LlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgc2Nyb2xsVGhyZXNob2xkOiA0MCxcblxuICAvKipcbiAgICogVGhlIHotaW5kZXggdGhhdCB0aGUgb3ZlcmxheSB3aWxsIGJlIGFkZGVkIHdpdGguXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB6SW5kZXg6IDk5OCxcblxuICAvKipcbiAgICogU2NhbGUgKHpvb20gaW4pIHRvIGdpdmVuIHdpZHRoIGFuZCBoZWlnaHQuIElnbm9yZSBzY2FsZUJhc2UgaWYgc2V0LlxuICAgKiBBbHRlcm5hdGl2ZWx5LCBwcm92aWRlIGEgcGVyY2VudGFnZSB2YWx1ZSByZWxhdGl2ZSB0byB0aGUgb3JpZ2luYWwgaW1hZ2Ugc2l6ZS5cbiAgICogQHR5cGUge09iamVjdHxTdHJpbmd9XG4gICAqIEBleGFtcGxlXG4gICAqIGN1c3RvbVNpemU6IHsgd2lkdGg6IDgwMCwgaGVpZ2h0OiA0MDAgfVxuICAgKiBjdXN0b21TaXplOiAxMDAlXG4gICAqL1xuICBjdXN0b21TaXplOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBvcGVuZWQgYW5kXG4gICAqIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbk9wZW46IG51bGwsXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIGNsb3NlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25DbG9zZTogbnVsbCxcblxuICAvKipcbiAgICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIGdyYWJiZWQuXG4gICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgKi9cbiAgb25HcmFiOiBudWxsLFxuXG4gIC8qKlxuICAgICogU2FtZSBhcyBhYm92ZSwgZXhjZXB0IGZpcmVkIHdoZW4gbW92ZWQuXG4gICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgKi9cbiAgb25Nb3ZlOiBudWxsLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiByZWxlYXNlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25SZWxlYXNlOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIG9wZW4uXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBjbG9zZS5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBncmFiLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZUdyYWI6IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgcmVsZWFzZS5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVSZWxlYXNlOiBudWxsXG59XG4iLCJpbXBvcnQgeyBiaW5kQWxsIH0gZnJvbSAnLi91dGlscydcblxuY29uc3QgUFJFU1NfREVMQVkgPSAyMDBcblxuZXhwb3J0IGRlZmF1bHQge1xuICBpbml0KGluc3RhbmNlKSB7XG4gICAgYmluZEFsbCh0aGlzLCBpbnN0YW5jZSlcbiAgfSxcblxuICBjbGljayhlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICBpZiAoaXNQcmVzc2luZ01ldGFLZXkoZSkpIHtcbiAgICAgIHJldHVybiB3aW5kb3cub3BlbihcbiAgICAgICAgdGhpcy50YXJnZXQuc3JjT3JpZ2luYWwgfHwgZS5jdXJyZW50VGFyZ2V0LnNyYyxcbiAgICAgICAgJ19ibGFuaydcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMuc2hvd24pIHtcbiAgICAgICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgICAgICB0aGlzLmNsb3NlKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlbGVhc2UoKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9wZW4oZS5jdXJyZW50VGFyZ2V0KVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzY3JvbGwoKSB7XG4gICAgY29uc3QgZWwgPVxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50IHx8IGRvY3VtZW50LmJvZHkucGFyZW50Tm9kZSB8fCBkb2N1bWVudC5ib2R5XG4gICAgY29uc3Qgc2Nyb2xsTGVmdCA9IHdpbmRvdy5wYWdlWE9mZnNldCB8fCBlbC5zY3JvbGxMZWZ0XG4gICAgY29uc3Qgc2Nyb2xsVG9wID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8IGVsLnNjcm9sbFRvcFxuXG4gICAgaWYgKHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID09PSBudWxsKSB7XG4gICAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IHtcbiAgICAgICAgeDogc2Nyb2xsTGVmdCxcbiAgICAgICAgeTogc2Nyb2xsVG9wXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZGVsdGFYID0gdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24ueCAtIHNjcm9sbExlZnRcbiAgICBjb25zdCBkZWx0YVkgPSB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbi55IC0gc2Nyb2xsVG9wXG4gICAgY29uc3QgdGhyZXNob2xkID0gdGhpcy5vcHRpb25zLnNjcm9sbFRocmVzaG9sZFxuXG4gICAgaWYgKE1hdGguYWJzKGRlbHRhWSkgPj0gdGhyZXNob2xkIHx8IE1hdGguYWJzKGRlbHRhWCkgPj0gdGhyZXNob2xkKSB7XG4gICAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH1cbiAgfSxcblxuICBrZXlkb3duKGUpIHtcbiAgICBpZiAoaXNFc2NhcGUoZSkpIHtcbiAgICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICAgIHRoaXMuY2xvc2UoKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWxlYXNlKHRoaXMuY2xvc2UpXG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIG1vdXNlZG93bihlKSB7XG4gICAgaWYgKCFpc0xlZnRCdXR0b24oZSkgfHwgaXNQcmVzc2luZ01ldGFLZXkoZSkpIHJldHVyblxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dChcbiAgICAgIGZ1bmN0aW9uIGdyYWJPbk1vdXNlRG93bigpIHtcbiAgICAgICAgdGhpcy5ncmFiKGNsaWVudFgsIGNsaWVudFkpXG4gICAgICB9LmJpbmQodGhpcyksXG4gICAgICBQUkVTU19ERUxBWVxuICAgIClcbiAgfSxcblxuICBtb3VzZW1vdmUoZSkge1xuICAgIGlmICh0aGlzLnJlbGVhc2VkKSByZXR1cm5cbiAgICB0aGlzLm1vdmUoZS5jbGllbnRYLCBlLmNsaWVudFkpXG4gIH0sXG5cbiAgbW91c2V1cChlKSB7XG4gICAgaWYgKCFpc0xlZnRCdXR0b24oZSkgfHwgaXNQcmVzc2luZ01ldGFLZXkoZSkpIHJldHVyblxuICAgIGNsZWFyVGltZW91dCh0aGlzLnByZXNzVGltZXIpXG5cbiAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVsZWFzZSgpXG4gICAgfVxuICB9LFxuXG4gIHRvdWNoc3RhcnQoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZS50b3VjaGVzWzBdXG5cbiAgICB0aGlzLnByZXNzVGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgZnVuY3Rpb24gZ3JhYk9uVG91Y2hTdGFydCgpIHtcbiAgICAgICAgdGhpcy5ncmFiKGNsaWVudFgsIGNsaWVudFkpXG4gICAgICB9LmJpbmQodGhpcyksXG4gICAgICBQUkVTU19ERUxBWVxuICAgIClcbiAgfSxcblxuICB0b3VjaG1vdmUoZSkge1xuICAgIGlmICh0aGlzLnJlbGVhc2VkKSByZXR1cm5cblxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZS50b3VjaGVzWzBdXG4gICAgdGhpcy5tb3ZlKGNsaWVudFgsIGNsaWVudFkpXG4gIH0sXG5cbiAgdG91Y2hlbmQoZSkge1xuICAgIGlmIChpc1RvdWNoaW5nKGUpKSByZXR1cm5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuXG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlbGVhc2UoKVxuICAgIH1cbiAgfSxcblxuICBjbGlja092ZXJsYXkoKSB7XG4gICAgdGhpcy5jbG9zZSgpXG4gIH0sXG5cbiAgcmVzaXplV2luZG93KCkge1xuICAgIHRoaXMuY2xvc2UoKVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzTGVmdEJ1dHRvbihlKSB7XG4gIHJldHVybiBlLmJ1dHRvbiA9PT0gMFxufVxuXG5mdW5jdGlvbiBpc1ByZXNzaW5nTWV0YUtleShlKSB7XG4gIHJldHVybiBlLm1ldGFLZXkgfHwgZS5jdHJsS2V5XG59XG5cbmZ1bmN0aW9uIGlzVG91Y2hpbmcoZSkge1xuICBlLnRhcmdldFRvdWNoZXMubGVuZ3RoID4gMFxufVxuXG5mdW5jdGlvbiBpc0VzY2FwZShlKSB7XG4gIGNvbnN0IGNvZGUgPSBlLmtleSB8fCBlLmNvZGVcbiAgcmV0dXJuIGNvZGUgPT09ICdFc2NhcGUnIHx8IGUua2V5Q29kZSA9PT0gMjdcbn1cbiIsImltcG9ydCB7IGxpc3Rlbiwgc2V0U3R5bGUgfSBmcm9tICcuL3V0aWxzJ1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQoaW5zdGFuY2UpIHtcbiAgICB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2VcbiAgICB0aGlzLnBhcmVudCA9IGRvY3VtZW50LmJvZHlcblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgdG9wOiAwLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHJpZ2h0OiAwLFxuICAgICAgYm90dG9tOiAwLFxuICAgICAgb3BhY2l0eTogMFxuICAgIH0pXG5cbiAgICB0aGlzLnVwZGF0ZVN0eWxlKGluc3RhbmNlLm9wdGlvbnMpXG4gICAgbGlzdGVuKHRoaXMuZWwsICdjbGljaycsIGluc3RhbmNlLmhhbmRsZXIuY2xpY2tPdmVybGF5LmJpbmQoaW5zdGFuY2UpKVxuICB9LFxuXG4gIHVwZGF0ZVN0eWxlKG9wdGlvbnMpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICB6SW5kZXg6IG9wdGlvbnMuekluZGV4LFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBvcHRpb25zLmJnQ29sb3IsXG4gICAgICB0cmFuc2l0aW9uOiBgb3BhY2l0eVxuICAgICAgICAke29wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9ufXNcbiAgICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gXG4gICAgfSlcbiAgfSxcblxuICBpbnNlcnQoKSB7XG4gICAgdGhpcy5wYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5lbClcbiAgfSxcblxuICByZW1vdmUoKSB7XG4gICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5lbClcbiAgfSxcblxuICBmYWRlSW4oKSB7XG4gICAgdGhpcy5lbC5vZmZzZXRXaWR0aFxuICAgIHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9ucy5iZ09wYWNpdHlcbiAgfSxcblxuICBmYWRlT3V0KCkge1xuICAgIHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IDBcbiAgfVxufVxuIiwiaW1wb3J0IHsgY3Vyc29yLCBzZXRTdHlsZSwgZ2V0T3JpZ2luYWxTb3VyY2UsIHRyYW5zZm9ybUNzc1Byb3AgfSBmcm9tICcuL3V0aWxzJ1xuXG4vLyBUcmFuc2xhdGUgei1heGlzIHRvIGZpeCBDU1MgZ3JpZCBkaXNwbGF5IGlzc3VlIGluIENocm9tZTpcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9raW5nZGlkbzk5OS96b29taW5nL2lzc3Vlcy80MlxuY29uc3QgVFJBTlNMQVRFX1ogPSAwXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdChlbCwgaW5zdGFuY2UpIHtcbiAgICB0aGlzLmVsID0gZWxcbiAgICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2VcbiAgICB0aGlzLnNyY1RodW1ibmFpbCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdzcmMnKVxuICAgIHRoaXMuc3Jjc2V0ID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ3NyY3NldCcpXG4gICAgdGhpcy5zcmNPcmlnaW5hbCA9IGdldE9yaWdpbmFsU291cmNlKHRoaXMuZWwpXG4gICAgdGhpcy5yZWN0ID0gdGhpcy5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgIHRoaXMudHJhbnNsYXRlID0gbnVsbFxuICAgIHRoaXMuc2NhbGUgPSBudWxsXG4gICAgdGhpcy5zdHlsZU9wZW4gPSBudWxsXG4gICAgdGhpcy5zdHlsZUNsb3NlID0gbnVsbFxuICB9LFxuXG4gIHpvb21JbigpIHtcbiAgICBjb25zdCB7XG4gICAgICB6SW5kZXgsXG4gICAgICBlbmFibGVHcmFiLFxuICAgICAgdHJhbnNpdGlvbkR1cmF0aW9uLFxuICAgICAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgfSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9uc1xuICAgIHRoaXMudHJhbnNsYXRlID0gdGhpcy5jYWxjdWxhdGVUcmFuc2xhdGUoKVxuICAgIHRoaXMuc2NhbGUgPSB0aGlzLmNhbGN1bGF0ZVNjYWxlKClcblxuICAgIHRoaXMuc3R5bGVPcGVuID0ge1xuICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgICB6SW5kZXg6IHpJbmRleCArIDEsXG4gICAgICBjdXJzb3I6IGVuYWJsZUdyYWIgPyBjdXJzb3IuZ3JhYiA6IGN1cnNvci56b29tT3V0LFxuICAgICAgdHJhbnNpdGlvbjogYCR7dHJhbnNmb3JtQ3NzUHJvcH1cbiAgICAgICAgJHt0cmFuc2l0aW9uRHVyYXRpb259c1xuICAgICAgICAke3RyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gLFxuICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoJHt0aGlzLnRyYW5zbGF0ZS54fXB4LCAke1xuICAgICAgICB0aGlzLnRyYW5zbGF0ZS55XG4gICAgICAgIH1weCwgJHtUUkFOU0xBVEVfWn1weClcbiAgICAgICAgc2NhbGUoJHt0aGlzLnNjYWxlLnh9LCR7dGhpcy5zY2FsZS55fSlgLFxuICAgICAgaGVpZ2h0OiBgJHt0aGlzLnJlY3QuaGVpZ2h0fXB4YCxcbiAgICAgIHdpZHRoOiBgJHt0aGlzLnJlY3Qud2lkdGh9cHhgXG4gICAgfVxuXG4gICAgLy8gRm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcblxuICAgIC8vIFRyaWdnZXIgdHJhbnNpdGlvblxuICAgIHRoaXMuc3R5bGVDbG9zZSA9IHNldFN0eWxlKHRoaXMuZWwsIHRoaXMuc3R5bGVPcGVuLCB0cnVlKVxuICB9LFxuXG4gIHpvb21PdXQoKSB7XG4gICAgLy8gRm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHsgdHJhbnNmb3JtOiAnbm9uZScgfSlcbiAgfSxcblxuICBncmFiKHgsIHksIHNjYWxlRXh0cmEpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IFtkeCwgZHldID0gW3dpbmRvd0NlbnRlci54IC0geCwgd2luZG93Q2VudGVyLnkgLSB5XVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgY3Vyc29yOiBjdXJzb3IubW92ZSxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZTNkKFxuICAgICAgICAke3RoaXMudHJhbnNsYXRlLnggKyBkeH1weCwgJHt0aGlzLnRyYW5zbGF0ZS55ICtcbiAgICAgICAgZHl9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54ICsgc2NhbGVFeHRyYX0sJHt0aGlzLnNjYWxlLnkgKyBzY2FsZUV4dHJhfSlgXG4gICAgfSlcbiAgfSxcblxuICBtb3ZlKHgsIHksIHNjYWxlRXh0cmEpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IFtkeCwgZHldID0gW3dpbmRvd0NlbnRlci54IC0geCwgd2luZG93Q2VudGVyLnkgLSB5XVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtQ3NzUHJvcCxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZTNkKFxuICAgICAgICAke3RoaXMudHJhbnNsYXRlLnggKyBkeH1weCwgJHt0aGlzLnRyYW5zbGF0ZS55ICtcbiAgICAgICAgZHl9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54ICsgc2NhbGVFeHRyYX0sJHt0aGlzLnNjYWxlLnkgKyBzY2FsZUV4dHJhfSlgXG4gICAgfSlcbiAgfSxcblxuICByZXN0b3JlQ2xvc2VTdHlsZSgpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlQ2xvc2UpXG4gIH0sXG5cbiAgcmVzdG9yZU9wZW5TdHlsZSgpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlT3BlbilcbiAgfSxcblxuICB1cGdyYWRlU291cmNlKCkge1xuICAgIGlmICh0aGlzLnNyY09yaWdpbmFsKSB7XG4gICAgICBjb25zdCBwYXJlbnROb2RlID0gdGhpcy5lbC5wYXJlbnROb2RlXG5cbiAgICAgIGlmICh0aGlzLnNyY3NldCkge1xuICAgICAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZSgnc3Jjc2V0JylcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGVtcCA9IHRoaXMuZWwuY2xvbmVOb2RlKGZhbHNlKVxuXG4gICAgICAvLyBGb3JjZSBjb21wdXRlIHRoZSBoaS1yZXMgaW1hZ2UgaW4gRE9NIHRvIHByZXZlbnRcbiAgICAgIC8vIGltYWdlIGZsaWNrZXJpbmcgd2hpbGUgdXBkYXRpbmcgc3JjXG4gICAgICB0ZW1wLnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNPcmlnaW5hbClcbiAgICAgIHRlbXAuc3R5bGUucG9zaXRpb24gPSAnZml4ZWQnXG4gICAgICB0ZW1wLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJ1xuICAgICAgcGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0ZW1wKVxuXG4gICAgICAvLyBBZGQgZGVsYXkgdG8gcHJldmVudCBGaXJlZm94IGZyb20gZmxpY2tlcmluZ1xuICAgICAgc2V0VGltZW91dChcbiAgICAgICAgZnVuY3Rpb24gdXBkYXRlU3JjKCkge1xuICAgICAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnNyY09yaWdpbmFsKVxuICAgICAgICAgIHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGVtcClcbiAgICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgICA1MFxuICAgICAgKVxuICAgIH1cbiAgfSxcblxuICBkb3duZ3JhZGVTb3VyY2UoKSB7XG4gICAgaWYgKHRoaXMuc3JjT3JpZ2luYWwpIHtcbiAgICAgIGlmICh0aGlzLnNyY3NldCkge1xuICAgICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSgnc3Jjc2V0JywgdGhpcy5zcmNzZXQpXG4gICAgICB9XG4gICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNUaHVtYm5haWwpXG4gICAgfVxuICB9LFxuXG4gIGNhbGN1bGF0ZVRyYW5zbGF0ZSgpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IHRhcmdldENlbnRlciA9IHtcbiAgICAgIHg6IHRoaXMucmVjdC5sZWZ0ICsgdGhpcy5yZWN0LndpZHRoIC8gMixcbiAgICAgIHk6IHRoaXMucmVjdC50b3AgKyB0aGlzLnJlY3QuaGVpZ2h0IC8gMlxuICAgIH1cblxuICAgIC8vIFRoZSB2ZWN0b3IgdG8gdHJhbnNsYXRlIGltYWdlIHRvIHRoZSB3aW5kb3cgY2VudGVyXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gdGFyZ2V0Q2VudGVyLngsXG4gICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIHRhcmdldENlbnRlci55XG4gICAgfVxuICB9LFxuXG4gIGNhbGN1bGF0ZVNjYWxlKCkge1xuICAgIGNvbnN0IHsgem9vbWluZ0hlaWdodCwgem9vbWluZ1dpZHRoIH0gPSB0aGlzLmVsLmRhdGFzZXRcbiAgICBjb25zdCB7IGN1c3RvbVNpemUsIHNjYWxlQmFzZSB9ID0gdGhpcy5pbnN0YW5jZS5vcHRpb25zXG5cbiAgICBpZiAoIWN1c3RvbVNpemUgJiYgem9vbWluZ0hlaWdodCAmJiB6b29taW5nV2lkdGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IHpvb21pbmdXaWR0aCAvIHRoaXMucmVjdC53aWR0aCxcbiAgICAgICAgeTogem9vbWluZ0hlaWdodCAvIHRoaXMucmVjdC5oZWlnaHRcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGN1c3RvbVNpemUgJiYgdHlwZW9mIGN1c3RvbVNpemUgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiBjdXN0b21TaXplLndpZHRoIC8gdGhpcy5yZWN0LndpZHRoLFxuICAgICAgICB5OiBjdXN0b21TaXplLmhlaWdodCAvIHRoaXMucmVjdC5oZWlnaHRcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGFyZ2V0SGFsZldpZHRoID0gdGhpcy5yZWN0LndpZHRoIC8gMlxuICAgICAgY29uc3QgdGFyZ2V0SGFsZkhlaWdodCA9IHRoaXMucmVjdC5oZWlnaHQgLyAyXG4gICAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuXG4gICAgICAvLyBUaGUgZGlzdGFuY2UgYmV0d2VlbiB0YXJnZXQgZWRnZSBhbmQgd2luZG93IGVkZ2VcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UgPSB7XG4gICAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gdGFyZ2V0SGFsZldpZHRoLFxuICAgICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIHRhcmdldEhhbGZIZWlnaHRcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2NhbGVIb3Jpem9udGFsbHkgPSB0YXJnZXRFZGdlVG9XaW5kb3dFZGdlLnggLyB0YXJnZXRIYWxmV2lkdGhcbiAgICAgIGNvbnN0IHNjYWxlVmVydGljYWxseSA9IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UueSAvIHRhcmdldEhhbGZIZWlnaHRcblxuICAgICAgLy8gVGhlIGFkZGl0aW9uYWwgc2NhbGUgaXMgYmFzZWQgb24gdGhlIHNtYWxsZXIgdmFsdWUgb2ZcbiAgICAgIC8vIHNjYWxpbmcgaG9yaXpvbnRhbGx5IGFuZCBzY2FsaW5nIHZlcnRpY2FsbHlcbiAgICAgIGNvbnN0IHNjYWxlID0gc2NhbGVCYXNlICsgTWF0aC5taW4oc2NhbGVIb3Jpem9udGFsbHksIHNjYWxlVmVydGljYWxseSlcblxuICAgICAgaWYgKGN1c3RvbVNpemUgJiYgdHlwZW9mIGN1c3RvbVNpemUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFVzZSB6b29taW5nV2lkdGggYW5kIHpvb21pbmdIZWlnaHQgaWYgYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IG5hdHVyYWxXaWR0aCA9IHpvb21pbmdXaWR0aCB8fCB0aGlzLmVsLm5hdHVyYWxXaWR0aFxuICAgICAgICBjb25zdCBuYXR1cmFsSGVpZ2h0ID0gem9vbWluZ0hlaWdodCB8fCB0aGlzLmVsLm5hdHVyYWxIZWlnaHRcbiAgICAgICAgY29uc3QgbWF4Wm9vbWluZ1dpZHRoID1cbiAgICAgICAgICBwYXJzZUZsb2F0KGN1c3RvbVNpemUpICogbmF0dXJhbFdpZHRoIC8gKDEwMCAqIHRoaXMucmVjdC53aWR0aClcbiAgICAgICAgY29uc3QgbWF4Wm9vbWluZ0hlaWdodCA9XG4gICAgICAgICAgcGFyc2VGbG9hdChjdXN0b21TaXplKSAqIG5hdHVyYWxIZWlnaHQgLyAoMTAwICogdGhpcy5yZWN0LmhlaWdodClcblxuICAgICAgICAvLyBPbmx5IHNjYWxlIGltYWdlIHVwIHRvIHRoZSBzcGVjaWZpZWQgY3VzdG9tU2l6ZSBwZXJjZW50YWdlXG4gICAgICAgIGlmIChzY2FsZSA+IG1heFpvb21pbmdXaWR0aCB8fCBzY2FsZSA+IG1heFpvb21pbmdIZWlnaHQpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogbWF4Wm9vbWluZ1dpZHRoLFxuICAgICAgICAgICAgeTogbWF4Wm9vbWluZ0hlaWdodFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiBzY2FsZSxcbiAgICAgICAgeTogc2NhbGVcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0V2luZG93Q2VudGVyKCkge1xuICBjb25zdCBkb2NFbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxuICBjb25zdCB3aW5kb3dXaWR0aCA9IE1hdGgubWluKGRvY0VsLmNsaWVudFdpZHRoLCB3aW5kb3cuaW5uZXJXaWR0aClcbiAgY29uc3Qgd2luZG93SGVpZ2h0ID0gTWF0aC5taW4oZG9jRWwuY2xpZW50SGVpZ2h0LCB3aW5kb3cuaW5uZXJIZWlnaHQpXG5cbiAgcmV0dXJuIHtcbiAgICB4OiB3aW5kb3dXaWR0aCAvIDIsXG4gICAgeTogd2luZG93SGVpZ2h0IC8gMlxuICB9XG59XG4iLCJpbXBvcnQge1xuICBjdXJzb3IsXG4gIGxpc3RlbixcbiAgbG9hZEltYWdlLFxuICB0cmFuc0VuZEV2ZW50LFxuICBnZXRPcmlnaW5hbFNvdXJjZVxufSBmcm9tICcuL3V0aWxzJ1xuaW1wb3J0IERFRkFVTFRfT1BUSU9OUyBmcm9tICcuL29wdGlvbnMnXG5cbmltcG9ydCBoYW5kbGVyIGZyb20gJy4vaGFuZGxlcidcbmltcG9ydCBvdmVybGF5IGZyb20gJy4vb3ZlcmxheSdcbmltcG9ydCB0YXJnZXQgZnJvbSAnLi90YXJnZXQnXG5cbi8qKlxuICogWm9vbWluZyBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFVwZGF0ZSBkZWZhdWx0IG9wdGlvbnMgaWYgcHJvdmlkZWQuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy50YXJnZXQgPSBPYmplY3QuY3JlYXRlKHRhcmdldClcbiAgICB0aGlzLm92ZXJsYXkgPSBPYmplY3QuY3JlYXRlKG92ZXJsYXkpXG4gICAgdGhpcy5oYW5kbGVyID0gT2JqZWN0LmNyZWF0ZShoYW5kbGVyKVxuICAgIHRoaXMuYm9keSA9IGRvY3VtZW50LmJvZHlcblxuICAgIHRoaXMuc2hvd24gPSBmYWxzZVxuICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgdGhpcy5yZWxlYXNlZCA9IHRydWVcbiAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcbiAgICB0aGlzLnByZXNzVGltZXIgPSBudWxsXG5cbiAgICB0aGlzLm9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX09QVElPTlMsIG9wdGlvbnMpXG4gICAgdGhpcy5vdmVybGF5LmluaXQodGhpcylcbiAgICB0aGlzLmhhbmRsZXIuaW5pdCh0aGlzKVxuICB9XG5cbiAgLyoqXG4gICAqIE1ha2UgZWxlbWVudChzKSB6b29tYWJsZS5cbiAgICogQHBhcmFtICB7c3RyaW5nfEVsZW1lbnR9IGVsIEEgY3NzIHNlbGVjdG9yIG9yIGFuIEVsZW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBsaXN0ZW4oZWwpIHtcbiAgICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbClcbiAgICAgIGxldCBpID0gZWxzLmxlbmd0aFxuXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMubGlzdGVuKGVsc1tpXSlcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVsLnRhZ05hbWUgPT09ICdJTUcnKSB7XG4gICAgICBlbC5zdHlsZS5jdXJzb3IgPSBjdXJzb3Iuem9vbUluXG4gICAgICBsaXN0ZW4oZWwsICdjbGljaycsIHRoaXMuaGFuZGxlci5jbGljaylcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5wcmVsb2FkSW1hZ2UpIHtcbiAgICAgICAgbG9hZEltYWdlKGdldE9yaWdpbmFsU291cmNlKGVsKSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBvcHRpb25zIG9yIHJldHVybiBjdXJyZW50IG9wdGlvbnMgaWYgbm8gYXJndW1lbnQgaXMgcHJvdmlkZWQuXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyBBbiBPYmplY3QgdGhhdCBjb250YWlucyB0aGlzLm9wdGlvbnMuXG4gICAqIEByZXR1cm4ge3RoaXN8dGhpcy5vcHRpb25zfVxuICAgKi9cbiAgY29uZmlnKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucykge1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLm9wdGlvbnMsIG9wdGlvbnMpXG4gICAgICB0aGlzLm92ZXJsYXkudXBkYXRlU3R5bGUodGhpcy5vcHRpb25zKVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMub3B0aW9uc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPcGVuICh6b29tIGluKSB0aGUgRWxlbWVudC5cbiAgICogQHBhcmFtICB7RWxlbWVudH0gZWwgVGhlIEVsZW1lbnQgdG8gb3Blbi5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25PcGVuXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbFxuICAgKiBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBvcGVuZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldFxuICAgKiB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgb3BlbihlbCwgY2IgPSB0aGlzLm9wdGlvbnMub25PcGVuKSB7XG4gICAgaWYgKHRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKSA6IGVsXG5cbiAgICBpZiAodGFyZ2V0LnRhZ05hbWUgIT09ICdJTUcnKSByZXR1cm5cblxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKSB7XG4gICAgICB0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKHRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5pbml0KHRhcmdldCwgdGhpcylcblxuICAgIGlmICghdGhpcy5vcHRpb25zLnByZWxvYWRJbWFnZSkge1xuICAgICAgbG9hZEltYWdlKHRoaXMudGFyZ2V0LnNyY09yaWdpbmFsKVxuICAgIH1cblxuICAgIHRoaXMuc2hvd24gPSB0cnVlXG4gICAgdGhpcy5sb2NrID0gdHJ1ZVxuXG4gICAgdGhpcy50YXJnZXQuem9vbUluKClcbiAgICB0aGlzLm92ZXJsYXkuaW5zZXJ0KClcbiAgICB0aGlzLm92ZXJsYXkuZmFkZUluKClcblxuICAgIGxpc3Rlbihkb2N1bWVudCwgJ3Njcm9sbCcsIHRoaXMuaGFuZGxlci5zY3JvbGwpXG4gICAgbGlzdGVuKGRvY3VtZW50LCAna2V5ZG93bicsIHRoaXMuaGFuZGxlci5rZXlkb3duKVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uV2luZG93UmVzaXplKSB7XG4gICAgICBsaXN0ZW4od2luZG93LCAncmVzaXplJywgdGhpcy5oYW5kbGVyLnJlc2l6ZVdpbmRvdylcbiAgICB9XG5cbiAgICBjb25zdCBvbk9wZW5FbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk9wZW5FbmQsIGZhbHNlKVxuICAgICAgdGhpcy5sb2NrID0gZmFsc2VcbiAgICAgIHRoaXMudGFyZ2V0LnVwZ3JhZGVTb3VyY2UoKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHtcbiAgICAgICAgdG9nZ2xlR3JhYkxpc3RlbmVycyhkb2N1bWVudCwgdGhpcy5oYW5kbGVyLCB0cnVlKVxuICAgICAgfVxuXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk9wZW5FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3NlICh6b29tIG91dCkgdGhlIEVsZW1lbnQgY3VycmVudGx5IG9wZW5lZC5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25DbG9zZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGxcbiAgICogYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgY2xvc2VkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbCBnZXRcbiAgICogdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGNsb3NlKGNiID0gdGhpcy5vcHRpb25zLm9uQ2xvc2UpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZUNsb3NlKHRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLmxvY2sgPSB0cnVlXG4gICAgdGhpcy5ib2R5LnN0eWxlLmN1cnNvciA9IGN1cnNvci5kZWZhdWx0XG4gICAgdGhpcy5vdmVybGF5LmZhZGVPdXQoKVxuICAgIHRoaXMudGFyZ2V0Lnpvb21PdXQoKVxuXG4gICAgbGlzdGVuKGRvY3VtZW50LCAnc2Nyb2xsJywgdGhpcy5oYW5kbGVyLnNjcm9sbCwgZmFsc2UpXG4gICAgbGlzdGVuKGRvY3VtZW50LCAna2V5ZG93bicsIHRoaXMuaGFuZGxlci5rZXlkb3duLCBmYWxzZSlcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbldpbmRvd1Jlc2l6ZSkge1xuICAgICAgbGlzdGVuKHdpbmRvdywgJ3Jlc2l6ZScsIHRoaXMuaGFuZGxlci5yZXNpemVXaW5kb3csIGZhbHNlKVxuICAgIH1cblxuICAgIGNvbnN0IG9uQ2xvc2VFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbkNsb3NlRW5kLCBmYWxzZSlcblxuICAgICAgdGhpcy5zaG93biA9IGZhbHNlXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuXG4gICAgICB0aGlzLnRhcmdldC5kb3duZ3JhZGVTb3VyY2UoKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHtcbiAgICAgICAgdG9nZ2xlR3JhYkxpc3RlbmVycyhkb2N1bWVudCwgdGhpcy5oYW5kbGVyLCBmYWxzZSlcbiAgICAgIH1cblxuICAgICAgdGhpcy50YXJnZXQucmVzdG9yZUNsb3NlU3R5bGUoKVxuICAgICAgdGhpcy5vdmVybGF5LnJlbW92ZSgpXG5cbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uQ2xvc2VFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEdyYWIgdGhlIEVsZW1lbnQgY3VycmVudGx5IG9wZW5lZCBnaXZlbiBhIHBvc2l0aW9uIGFuZCBhcHBseSBleHRyYSB6b29tLWluLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeCBUaGUgWC1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHkgVGhlIFktYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICBzY2FsZUV4dHJhIEV4dHJhIHpvb20taW4gdG8gYXBwbHkuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uR3JhYl0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgZ3JhYmJlZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0XG4gICAqIHdpbGwgZ2V0IHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBncmFiKHgsIHksIHNjYWxlRXh0cmEgPSB0aGlzLm9wdGlvbnMuc2NhbGVFeHRyYSwgY2IgPSB0aGlzLm9wdGlvbnMub25HcmFiKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMucmVsZWFzZWQgPSBmYWxzZVxuICAgIHRoaXMudGFyZ2V0LmdyYWIoeCwgeSwgc2NhbGVFeHRyYSlcblxuICAgIGNvbnN0IG9uR3JhYkVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uR3JhYkVuZCwgZmFsc2UpXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbkdyYWJFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIE1vdmUgdGhlIEVsZW1lbnQgY3VycmVudGx5IGdyYWJiZWQgZ2l2ZW4gYSBwb3NpdGlvbiBhbmQgYXBwbHkgZXh0cmEgem9vbS1pbi5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHggVGhlIFgtYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB5IFRoZSBZLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgc2NhbGVFeHRyYSBFeHRyYSB6b29tLWluIHRvIGFwcGx5LlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbk1vdmVdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG1vdmVkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbFxuICAgKiBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIG1vdmUoeCwgeSwgc2NhbGVFeHRyYSA9IHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhLCBjYiA9IHRoaXMub3B0aW9ucy5vbk1vdmUpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIHRoaXMucmVsZWFzZWQgPSBmYWxzZVxuICAgIHRoaXMuYm9keS5zdHlsZS5jdXJzb3IgPSBjdXJzb3IubW92ZVxuICAgIHRoaXMudGFyZ2V0Lm1vdmUoeCwgeSwgc2NhbGVFeHRyYSlcblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBjb25zdCBvbk1vdmVFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk1vdmVFbmQsIGZhbHNlKVxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25Nb3ZlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWxlYXNlIHRoZSBFbGVtZW50IGN1cnJlbnRseSBncmFiYmVkLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vblJlbGVhc2VdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIHJlbGVhc2VkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXRcbiAgICogd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIHJlbGVhc2UoY2IgPSB0aGlzLm9wdGlvbnMub25SZWxlYXNlKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMubG9jayA9IHRydWVcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLmRlZmF1bHRcbiAgICB0aGlzLnRhcmdldC5yZXN0b3JlT3BlblN0eWxlKClcblxuICAgIGNvbnN0IG9uUmVsZWFzZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uUmVsZWFzZUVuZCwgZmFsc2UpXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgICAgdGhpcy5yZWxlYXNlZCA9IHRydWVcblxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25SZWxlYXNlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVHcmFiTGlzdGVuZXJzKGVsLCBoYW5kbGVyLCBhZGQpIHtcbiAgY29uc3QgdHlwZXMgPSBbXG4gICAgJ21vdXNlZG93bicsXG4gICAgJ21vdXNlbW92ZScsXG4gICAgJ21vdXNldXAnLFxuICAgICd0b3VjaHN0YXJ0JyxcbiAgICAndG91Y2htb3ZlJyxcbiAgICAndG91Y2hlbmQnXG4gIF1cblxuICB0eXBlcy5mb3JFYWNoKGZ1bmN0aW9uIHRvZ2dsZUxpc3RlbmVyKHR5cGUpIHtcbiAgICBsaXN0ZW4oZWwsIHR5cGUsIGhhbmRsZXJbdHlwZV0sIGFkZClcbiAgfSlcbn1cbiJdLCJuYW1lcyI6WyJ3ZWJraXRQcmVmaXgiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsInN0eWxlIiwiY3Vyc29yIiwibGlzdGVuIiwiZWwiLCJldmVudCIsImhhbmRsZXIiLCJhZGQiLCJvcHRpb25zIiwicGFzc2l2ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwibG9hZEltYWdlIiwic3JjIiwiY2IiLCJpbWciLCJJbWFnZSIsIm9ubG9hZCIsIm9uSW1hZ2VMb2FkIiwiZ2V0T3JpZ2luYWxTb3VyY2UiLCJkYXRhc2V0Iiwib3JpZ2luYWwiLCJwYXJlbnROb2RlIiwidGFnTmFtZSIsImdldEF0dHJpYnV0ZSIsInNldFN0eWxlIiwic3R5bGVzIiwicmVtZW1iZXIiLCJzIiwia2V5IiwiYmluZEFsbCIsIl90aGlzIiwidGhhdCIsIm1ldGhvZHMiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eU5hbWVzIiwiZ2V0UHJvdG90eXBlT2YiLCJmb3JFYWNoIiwiYmluZE9uZSIsIm1ldGhvZCIsImJpbmQiLCJ0cmFucyIsInNuaWZmVHJhbnNpdGlvbiIsImNyZWF0ZUVsZW1lbnQiLCJ0cmFuc2Zvcm1Dc3NQcm9wIiwidHJhbnNFbmRFdmVudCIsImNoZWNrVHJhbnMiLCJ0cmFuc2l0aW9uUHJvcCIsInRyYW5zZm9ybVByb3AiLCJ0cmFuc2l0aW9uIiwidmFsdWUiLCJ0cmFuc2Zvcm0iLCJyZXMiLCJ0Zm9ybSIsImVuZCIsInNvbWUiLCJoYXNUcmFuc2l0aW9uIiwicHJvcCIsInVuZGVmaW5lZCIsImhhc1RyYW5zZm9ybSIsInJlcGxhY2UiLCJQUkVTU19ERUxBWSIsImluc3RhbmNlIiwiZSIsInByZXZlbnREZWZhdWx0IiwiaXNQcmVzc2luZ01ldGFLZXkiLCJ3aW5kb3ciLCJvcGVuIiwidGFyZ2V0Iiwic3JjT3JpZ2luYWwiLCJjdXJyZW50VGFyZ2V0Iiwic2hvd24iLCJyZWxlYXNlZCIsImNsb3NlIiwicmVsZWFzZSIsImJvZHkiLCJzY3JvbGxMZWZ0IiwicGFnZVhPZmZzZXQiLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImxhc3RTY3JvbGxQb3NpdGlvbiIsImRlbHRhWCIsIngiLCJkZWx0YVkiLCJ5IiwidGhyZXNob2xkIiwic2Nyb2xsVGhyZXNob2xkIiwiTWF0aCIsImFicyIsImlzRXNjYXBlIiwiaXNMZWZ0QnV0dG9uIiwiY2xpZW50WCIsImNsaWVudFkiLCJwcmVzc1RpbWVyIiwic2V0VGltZW91dCIsImdyYWJPbk1vdXNlRG93biIsImdyYWIiLCJtb3ZlIiwidG91Y2hlcyIsImdyYWJPblRvdWNoU3RhcnQiLCJpc1RvdWNoaW5nIiwiYnV0dG9uIiwibWV0YUtleSIsImN0cmxLZXkiLCJ0YXJnZXRUb3VjaGVzIiwibGVuZ3RoIiwiY29kZSIsImtleUNvZGUiLCJwYXJlbnQiLCJ1cGRhdGVTdHlsZSIsImNsaWNrT3ZlcmxheSIsInpJbmRleCIsImJnQ29sb3IiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJ0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24iLCJhcHBlbmRDaGlsZCIsInJlbW92ZUNoaWxkIiwib2Zmc2V0V2lkdGgiLCJvcGFjaXR5IiwiYmdPcGFjaXR5IiwiVFJBTlNMQVRFX1oiLCJzcmNUaHVtYm5haWwiLCJzcmNzZXQiLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwidHJhbnNsYXRlIiwic2NhbGUiLCJzdHlsZU9wZW4iLCJzdHlsZUNsb3NlIiwiZW5hYmxlR3JhYiIsImNhbGN1bGF0ZVRyYW5zbGF0ZSIsImNhbGN1bGF0ZVNjYWxlIiwiem9vbU91dCIsImhlaWdodCIsIndpZHRoIiwic2NhbGVFeHRyYSIsIndpbmRvd0NlbnRlciIsImdldFdpbmRvd0NlbnRlciIsImR4IiwiZHkiLCJyZW1vdmVBdHRyaWJ1dGUiLCJ0ZW1wIiwiY2xvbmVOb2RlIiwic2V0QXR0cmlidXRlIiwicG9zaXRpb24iLCJ2aXNpYmlsaXR5IiwidXBkYXRlU3JjIiwidGFyZ2V0Q2VudGVyIiwibGVmdCIsInRvcCIsInpvb21pbmdIZWlnaHQiLCJ6b29taW5nV2lkdGgiLCJjdXN0b21TaXplIiwic2NhbGVCYXNlIiwidGFyZ2V0SGFsZldpZHRoIiwidGFyZ2V0SGFsZkhlaWdodCIsInRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsIm1pbiIsIm5hdHVyYWxXaWR0aCIsIm5hdHVyYWxIZWlnaHQiLCJtYXhab29taW5nV2lkdGgiLCJwYXJzZUZsb2F0IiwibWF4Wm9vbWluZ0hlaWdodCIsImRvY0VsIiwid2luZG93V2lkdGgiLCJjbGllbnRXaWR0aCIsImlubmVyV2lkdGgiLCJ3aW5kb3dIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJpbm5lckhlaWdodCIsIlpvb21pbmciLCJjcmVhdGUiLCJvdmVybGF5IiwibG9jayIsImJhYmVsSGVscGVycy5leHRlbmRzIiwiREVGQVVMVF9PUFRJT05TIiwiaW5pdCIsImVscyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwiem9vbUluIiwiY2xpY2siLCJwcmVsb2FkSW1hZ2UiLCJvbk9wZW4iLCJxdWVyeVNlbGVjdG9yIiwib25CZWZvcmVPcGVuIiwiaW5zZXJ0IiwiZmFkZUluIiwic2Nyb2xsIiwia2V5ZG93biIsImNsb3NlT25XaW5kb3dSZXNpemUiLCJyZXNpemVXaW5kb3ciLCJvbk9wZW5FbmQiLCJ1cGdyYWRlU291cmNlIiwib25DbG9zZSIsIm9uQmVmb3JlQ2xvc2UiLCJkZWZhdWx0IiwiZmFkZU91dCIsIm9uQ2xvc2VFbmQiLCJkb3duZ3JhZGVTb3VyY2UiLCJyZXN0b3JlQ2xvc2VTdHlsZSIsInJlbW92ZSIsIm9uR3JhYiIsIm9uQmVmb3JlR3JhYiIsIm9uR3JhYkVuZCIsIm9uTW92ZSIsIm9uTW92ZUVuZCIsIm9uUmVsZWFzZSIsIm9uQmVmb3JlUmVsZWFzZSIsInJlc3RvcmVPcGVuU3R5bGUiLCJvblJlbGVhc2VFbmQiLCJ0b2dnbGVHcmFiTGlzdGVuZXJzIiwidHlwZXMiLCJ0b2dnbGVMaXN0ZW5lciIsInR5cGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFPLElBQU1BLGVBQWUsc0JBQXNCQyxTQUFTQyxlQUFULENBQXlCQyxLQUEvQyxHQUN4QixVQUR3QixHQUV4QixFQUZHOztBQUlQLEFBQU8sSUFBTUMsU0FBUztXQUNYLE1BRFc7VUFFVEosWUFBWCxZQUZvQjtXQUdSQSxZQUFaLGFBSG9CO1FBSVhBLFlBQVQsU0FKb0I7UUFLZDtDQUxEOztBQVFQLEFBQU8sU0FBU0ssTUFBVCxDQUFpQkMsRUFBakIsRUFBcUJDLEtBQXJCLEVBQTRCQyxPQUE1QixFQUFpRDtNQUFaQyxHQUFZLHVFQUFOLElBQU07O01BQ2hEQyxVQUFVLEVBQUVDLFNBQVMsS0FBWCxFQUFoQjs7TUFFSUYsR0FBSixFQUFTO09BQ0pHLGdCQUFILENBQW9CTCxLQUFwQixFQUEyQkMsT0FBM0IsRUFBb0NFLE9BQXBDO0dBREYsTUFFTztPQUNGRyxtQkFBSCxDQUF1Qk4sS0FBdkIsRUFBOEJDLE9BQTlCLEVBQXVDRSxPQUF2Qzs7OztBQUlKLEFBQU8sU0FBU0ksU0FBVCxDQUFvQkMsR0FBcEIsRUFBeUJDLEVBQXpCLEVBQTZCO01BQzlCRCxHQUFKLEVBQVM7UUFDREUsTUFBTSxJQUFJQyxLQUFKLEVBQVo7O1FBRUlDLE1BQUosR0FBYSxTQUFTQyxXQUFULEdBQXdCO1VBQy9CSixFQUFKLEVBQVFBLEdBQUdDLEdBQUg7S0FEVjs7UUFJSUYsR0FBSixHQUFVQSxHQUFWOzs7O0FBSUosQUFBTyxTQUFTTSxpQkFBVCxDQUE0QmYsRUFBNUIsRUFBZ0M7TUFDakNBLEdBQUdnQixPQUFILENBQVdDLFFBQWYsRUFBeUI7V0FDaEJqQixHQUFH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
