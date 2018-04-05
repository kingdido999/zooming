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

return Zooming;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9vbWluZy5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3V0aWxzLmpzIiwiLi4vc3JjL29wdGlvbnMuanMiLCIuLi9zcmMvaGFuZGxlci5qcyIsIi4uL3NyYy9vdmVybGF5LmpzIiwiLi4vc3JjL3RhcmdldC5qcyIsIi4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3Qgd2Via2l0UHJlZml4ID0gJ1dlYmtpdEFwcGVhcmFuY2UnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZVxuICA/ICctd2Via2l0LSdcbiAgOiAnJ1xuXG5leHBvcnQgY29uc3QgY3Vyc29yID0ge1xuICBkZWZhdWx0OiAnYXV0bycsXG4gIHpvb21JbjogYCR7d2Via2l0UHJlZml4fXpvb20taW5gLFxuICB6b29tT3V0OiBgJHt3ZWJraXRQcmVmaXh9em9vbS1vdXRgLFxuICBncmFiOiBgJHt3ZWJraXRQcmVmaXh9Z3JhYmAsXG4gIG1vdmU6ICdtb3ZlJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGlzdGVuIChlbCwgZXZlbnQsIGhhbmRsZXIsIGFkZCA9IHRydWUpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IHsgcGFzc2l2ZTogZmFsc2UgfVxuXG4gIGlmIChhZGQpIHtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyLCBvcHRpb25zKVxuICB9IGVsc2Uge1xuICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRJbWFnZSAoc3JjLCBjYikge1xuICBpZiAoc3JjKSB7XG4gICAgY29uc3QgaW1nID0gbmV3IEltYWdlKClcblxuICAgIGltZy5vbmxvYWQgPSBmdW5jdGlvbiBvbkltYWdlTG9hZCAoKSB7XG4gICAgICBpZiAoY2IpIGNiKGltZylcbiAgICB9XG5cbiAgICBpbWcuc3JjID0gc3JjXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE9yaWdpbmFsU291cmNlIChlbCkge1xuICBpZiAoZWwuZGF0YXNldC5vcmlnaW5hbCkge1xuICAgIHJldHVybiBlbC5kYXRhc2V0Lm9yaWdpbmFsXG4gIH0gZWxzZSBpZiAoZWwucGFyZW50Tm9kZS50YWdOYW1lID09PSAnQScpIHtcbiAgICByZXR1cm4gZWwucGFyZW50Tm9kZS5nZXRBdHRyaWJ1dGUoJ2hyZWYnKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFN0eWxlIChlbCwgc3R5bGVzLCByZW1lbWJlcikge1xuICBjaGVja1RyYW5zKHN0eWxlcylcblxuICBsZXQgcyA9IGVsLnN0eWxlXG4gIGxldCBvcmlnaW5hbCA9IHt9XG5cbiAgZm9yIChsZXQga2V5IGluIHN0eWxlcykge1xuICAgIGlmIChyZW1lbWJlcikge1xuICAgICAgb3JpZ2luYWxba2V5XSA9IHNba2V5XSB8fCAnJ1xuICAgIH1cblxuICAgIHNba2V5XSA9IHN0eWxlc1trZXldXG4gIH1cblxuICByZXR1cm4gb3JpZ2luYWxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmRBbGwgKF90aGlzLCB0aGF0KSB7XG4gIGNvbnN0IG1ldGhvZHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhPYmplY3QuZ2V0UHJvdG90eXBlT2YoX3RoaXMpKVxuICBtZXRob2RzLmZvckVhY2goZnVuY3Rpb24gYmluZE9uZSAobWV0aG9kKSB7XG4gICAgX3RoaXNbbWV0aG9kXSA9IF90aGlzW21ldGhvZF0uYmluZCh0aGF0KVxuICB9KVxufVxuXG5jb25zdCB0cmFucyA9IHNuaWZmVHJhbnNpdGlvbihkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSlcbmV4cG9ydCBjb25zdCB0cmFuc2Zvcm1Dc3NQcm9wID0gdHJhbnMudHJhbnNmb3JtQ3NzUHJvcFxuZXhwb3J0IGNvbnN0IHRyYW5zRW5kRXZlbnQgPSB0cmFucy50cmFuc0VuZEV2ZW50XG5cbmZ1bmN0aW9uIGNoZWNrVHJhbnMgKHN0eWxlcykge1xuICBjb25zdCB7IHRyYW5zaXRpb25Qcm9wLCB0cmFuc2Zvcm1Qcm9wIH0gPSB0cmFuc1xuXG4gIGlmIChzdHlsZXMudHJhbnNpdGlvbikge1xuICAgIGNvbnN0IHZhbHVlID0gc3R5bGVzLnRyYW5zaXRpb25cbiAgICBkZWxldGUgc3R5bGVzLnRyYW5zaXRpb25cbiAgICBzdHlsZXNbdHJhbnNpdGlvblByb3BdID0gdmFsdWVcbiAgfVxuXG4gIGlmIChzdHlsZXMudHJhbnNmb3JtKSB7XG4gICAgY29uc3QgdmFsdWUgPSBzdHlsZXMudHJhbnNmb3JtXG4gICAgZGVsZXRlIHN0eWxlcy50cmFuc2Zvcm1cbiAgICBzdHlsZXNbdHJhbnNmb3JtUHJvcF0gPSB2YWx1ZVxuICB9XG59XG5cbmZ1bmN0aW9uIHNuaWZmVHJhbnNpdGlvbiAoZWwpIHtcbiAgbGV0IHJlcyA9IHt9XG4gIGNvbnN0IHRyYW5zID0gWyd3ZWJraXRUcmFuc2l0aW9uJywgJ3RyYW5zaXRpb24nLCAnbW96VHJhbnNpdGlvbiddXG4gIGNvbnN0IHRmb3JtID0gWyd3ZWJraXRUcmFuc2Zvcm0nLCAndHJhbnNmb3JtJywgJ21velRyYW5zZm9ybSddXG4gIGNvbnN0IGVuZCA9IHtcbiAgICB0cmFuc2l0aW9uOiAndHJhbnNpdGlvbmVuZCcsXG4gICAgbW96VHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnLFxuICAgIHdlYmtpdFRyYW5zaXRpb246ICd3ZWJraXRUcmFuc2l0aW9uRW5kJ1xuICB9XG5cbiAgdHJhbnMuc29tZShmdW5jdGlvbiBoYXNUcmFuc2l0aW9uIChwcm9wKSB7XG4gICAgaWYgKGVsLnN0eWxlW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlcy50cmFuc2l0aW9uUHJvcCA9IHByb3BcbiAgICAgIHJlcy50cmFuc0VuZEV2ZW50ID0gZW5kW3Byb3BdXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfSlcblxuICB0Zm9ybS5zb21lKGZ1bmN0aW9uIGhhc1RyYW5zZm9ybSAocHJvcCkge1xuICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXMudHJhbnNmb3JtUHJvcCA9IHByb3BcbiAgICAgIHJlcy50cmFuc2Zvcm1Dc3NQcm9wID0gcHJvcC5yZXBsYWNlKC8oLiopVHJhbnNmb3JtLywgJy0kMS10cmFuc2Zvcm0nKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJlc1xufVxuIiwiZXhwb3J0IGRlZmF1bHQge1xuICAvKipcbiAgICogWm9vbWFibGUgZWxlbWVudHMgYnkgZGVmYXVsdC4gSXQgY2FuIGJlIGEgY3NzIHNlbGVjdG9yIG9yIGFuIGVsZW1lbnQuXG4gICAqIEB0eXBlIHtzdHJpbmd8RWxlbWVudH1cbiAgICovXG4gIGRlZmF1bHRab29tYWJsZTogJ2ltZ1tkYXRhLWFjdGlvbj1cInpvb21cIl0nLFxuXG4gIC8qKlxuICAgKiBUbyBiZSBhYmxlIHRvIGdyYWIgYW5kIGRyYWcgdGhlIGltYWdlIGZvciBleHRyYSB6b29tLWluLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIGVuYWJsZUdyYWI6IHRydWUsXG5cbiAgLyoqXG4gICAqIFByZWxvYWQgem9vbWFibGUgaW1hZ2VzLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIHByZWxvYWRJbWFnZTogZmFsc2UsXG5cbiAgLyoqXG4gICAqIENsb3NlIHRoZSB6b29tZWQgaW1hZ2Ugd2hlbiBicm93c2VyIHdpbmRvdyBpcyByZXNpemVkLlxuICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICovXG4gIGNsb3NlT25XaW5kb3dSZXNpemU6IHRydWUsXG5cbiAgLyoqXG4gICAqIFRyYW5zaXRpb24gZHVyYXRpb24gaW4gc2Vjb25kcy5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHRyYW5zaXRpb25EdXJhdGlvbjogMC40LFxuXG4gIC8qKlxuICAgKiBUcmFuc2l0aW9uIHRpbWluZyBmdW5jdGlvbi5cbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbjogJ2N1YmljLWJlemllcigwLjQsIDAsIDAsIDEpJyxcblxuICAvKipcbiAgICogT3ZlcmxheSBiYWNrZ3JvdW5kIGNvbG9yLlxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgYmdDb2xvcjogJ3JnYigyNTUsIDI1NSwgMjU1KScsXG5cbiAgLyoqXG4gICAqIE92ZXJsYXkgYmFja2dyb3VuZCBvcGFjaXR5LlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgYmdPcGFjaXR5OiAxLFxuXG4gIC8qKlxuICAgKiBUaGUgYmFzZSBzY2FsZSBmYWN0b3IgZm9yIHpvb21pbmcuIEJ5IGRlZmF1bHQgc2NhbGUgdG8gZml0IHRoZSB3aW5kb3cuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY2FsZUJhc2U6IDEuMCxcblxuICAvKipcbiAgICogVGhlIGFkZGl0aW9uYWwgc2NhbGUgZmFjdG9yIHdoZW4gZ3JhYmJpbmcgdGhlIGltYWdlLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgc2NhbGVFeHRyYTogMC41LFxuXG4gIC8qKlxuICAgKiBIb3cgbXVjaCBzY3JvbGxpbmcgaXQgdGFrZXMgYmVmb3JlIGNsb3Npbmcgb3V0LlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgc2Nyb2xsVGhyZXNob2xkOiA0MCxcblxuICAvKipcbiAgICogVGhlIHotaW5kZXggdGhhdCB0aGUgb3ZlcmxheSB3aWxsIGJlIGFkZGVkIHdpdGguXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB6SW5kZXg6IDk5OCxcblxuICAvKipcbiAgICogU2NhbGUgKHpvb20gaW4pIHRvIGdpdmVuIHdpZHRoIGFuZCBoZWlnaHQuIElnbm9yZSBzY2FsZUJhc2UgaWYgc2V0LlxuICAgKiBBbHRlcm5hdGl2ZWx5LCBwcm92aWRlIGEgcGVyY2VudGFnZSB2YWx1ZSByZWxhdGl2ZSB0byB0aGUgb3JpZ2luYWwgaW1hZ2Ugc2l6ZS5cbiAgICogQHR5cGUge09iamVjdHxTdHJpbmd9XG4gICAqIEBleGFtcGxlXG4gICAqIGN1c3RvbVNpemU6IHsgd2lkdGg6IDgwMCwgaGVpZ2h0OiA0MDAgfVxuICAgKiBjdXN0b21TaXplOiAxMDAlXG4gICAqL1xuICBjdXN0b21TaXplOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBvcGVuZWQgYW5kXG4gICAqIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbk9wZW46IG51bGwsXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIGNsb3NlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25DbG9zZTogbnVsbCxcblxuICAvKipcbiAgICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIGdyYWJiZWQuXG4gICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgKi9cbiAgb25HcmFiOiBudWxsLFxuXG4gIC8qKlxuICAgICogU2FtZSBhcyBhYm92ZSwgZXhjZXB0IGZpcmVkIHdoZW4gbW92ZWQuXG4gICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgKi9cbiAgb25Nb3ZlOiBudWxsLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiByZWxlYXNlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25SZWxlYXNlOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIG9wZW4uXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBjbG9zZS5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBncmFiLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZUdyYWI6IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgcmVsZWFzZS5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVSZWxlYXNlOiBudWxsXG59XG4iLCJpbXBvcnQgeyBiaW5kQWxsIH0gZnJvbSAnLi91dGlscydcblxuY29uc3QgUFJFU1NfREVMQVkgPSAyMDBcblxuZXhwb3J0IGRlZmF1bHQge1xuICBpbml0KGluc3RhbmNlKSB7XG4gICAgYmluZEFsbCh0aGlzLCBpbnN0YW5jZSlcbiAgfSxcblxuICBjbGljayhlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICBpZiAoaXNQcmVzc2luZ01ldGFLZXkoZSkpIHtcbiAgICAgIHJldHVybiB3aW5kb3cub3BlbihcbiAgICAgICAgdGhpcy50YXJnZXQuc3JjT3JpZ2luYWwgfHwgZS5jdXJyZW50VGFyZ2V0LnNyYyxcbiAgICAgICAgJ19ibGFuaydcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMuc2hvd24pIHtcbiAgICAgICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgICAgICB0aGlzLmNsb3NlKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlbGVhc2UoKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9wZW4oZS5jdXJyZW50VGFyZ2V0KVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzY3JvbGwoKSB7XG4gICAgY29uc3QgZWwgPVxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50IHx8IGRvY3VtZW50LmJvZHkucGFyZW50Tm9kZSB8fCBkb2N1bWVudC5ib2R5XG4gICAgY29uc3Qgc2Nyb2xsTGVmdCA9IHdpbmRvdy5wYWdlWE9mZnNldCB8fCBlbC5zY3JvbGxMZWZ0XG4gICAgY29uc3Qgc2Nyb2xsVG9wID0gd2luZG93LnBhZ2VZT2Zmc2V0IHx8IGVsLnNjcm9sbFRvcFxuXG4gICAgaWYgKHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID09PSBudWxsKSB7XG4gICAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IHtcbiAgICAgICAgeDogc2Nyb2xsTGVmdCxcbiAgICAgICAgeTogc2Nyb2xsVG9wXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZGVsdGFYID0gdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24ueCAtIHNjcm9sbExlZnRcbiAgICBjb25zdCBkZWx0YVkgPSB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbi55IC0gc2Nyb2xsVG9wXG4gICAgY29uc3QgdGhyZXNob2xkID0gdGhpcy5vcHRpb25zLnNjcm9sbFRocmVzaG9sZFxuXG4gICAgaWYgKE1hdGguYWJzKGRlbHRhWSkgPj0gdGhyZXNob2xkIHx8IE1hdGguYWJzKGRlbHRhWCkgPj0gdGhyZXNob2xkKSB7XG4gICAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH1cbiAgfSxcblxuICBrZXlkb3duKGUpIHtcbiAgICBpZiAoaXNFc2NhcGUoZSkpIHtcbiAgICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICAgIHRoaXMuY2xvc2UoKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWxlYXNlKHRoaXMuY2xvc2UpXG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIG1vdXNlZG93bihlKSB7XG4gICAgaWYgKCFpc0xlZnRCdXR0b24oZSkgfHwgaXNQcmVzc2luZ01ldGFLZXkoZSkpIHJldHVyblxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dChcbiAgICAgIGZ1bmN0aW9uIGdyYWJPbk1vdXNlRG93bigpIHtcbiAgICAgICAgdGhpcy5ncmFiKGNsaWVudFgsIGNsaWVudFkpXG4gICAgICB9LmJpbmQodGhpcyksXG4gICAgICBQUkVTU19ERUxBWVxuICAgIClcbiAgfSxcblxuICBtb3VzZW1vdmUoZSkge1xuICAgIGlmICh0aGlzLnJlbGVhc2VkKSByZXR1cm5cbiAgICB0aGlzLm1vdmUoZS5jbGllbnRYLCBlLmNsaWVudFkpXG4gIH0sXG5cbiAgbW91c2V1cChlKSB7XG4gICAgaWYgKCFpc0xlZnRCdXR0b24oZSkgfHwgaXNQcmVzc2luZ01ldGFLZXkoZSkpIHJldHVyblxuICAgIGNsZWFyVGltZW91dCh0aGlzLnByZXNzVGltZXIpXG5cbiAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVsZWFzZSgpXG4gICAgfVxuICB9LFxuXG4gIHRvdWNoc3RhcnQoZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZS50b3VjaGVzWzBdXG5cbiAgICB0aGlzLnByZXNzVGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgZnVuY3Rpb24gZ3JhYk9uVG91Y2hTdGFydCgpIHtcbiAgICAgICAgdGhpcy5ncmFiKGNsaWVudFgsIGNsaWVudFkpXG4gICAgICB9LmJpbmQodGhpcyksXG4gICAgICBQUkVTU19ERUxBWVxuICAgIClcbiAgfSxcblxuICB0b3VjaG1vdmUoZSkge1xuICAgIGlmICh0aGlzLnJlbGVhc2VkKSByZXR1cm5cblxuICAgIGNvbnN0IHsgY2xpZW50WCwgY2xpZW50WSB9ID0gZS50b3VjaGVzWzBdXG4gICAgdGhpcy5tb3ZlKGNsaWVudFgsIGNsaWVudFkpXG4gIH0sXG5cbiAgdG91Y2hlbmQoZSkge1xuICAgIGlmIChpc1RvdWNoaW5nKGUpKSByZXR1cm5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuXG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlbGVhc2UoKVxuICAgIH1cbiAgfSxcblxuICBjbGlja092ZXJsYXkoKSB7XG4gICAgdGhpcy5jbG9zZSgpXG4gIH0sXG5cbiAgcmVzaXplV2luZG93KCkge1xuICAgIHRoaXMuY2xvc2UoKVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzTGVmdEJ1dHRvbihlKSB7XG4gIHJldHVybiBlLmJ1dHRvbiA9PT0gMFxufVxuXG5mdW5jdGlvbiBpc1ByZXNzaW5nTWV0YUtleShlKSB7XG4gIHJldHVybiBlLm1ldGFLZXkgfHwgZS5jdHJsS2V5XG59XG5cbmZ1bmN0aW9uIGlzVG91Y2hpbmcoZSkge1xuICBlLnRhcmdldFRvdWNoZXMubGVuZ3RoID4gMFxufVxuXG5mdW5jdGlvbiBpc0VzY2FwZShlKSB7XG4gIGNvbnN0IGNvZGUgPSBlLmtleSB8fCBlLmNvZGVcbiAgcmV0dXJuIGNvZGUgPT09ICdFc2NhcGUnIHx8IGUua2V5Q29kZSA9PT0gMjdcbn1cbiIsImltcG9ydCB7IGxpc3Rlbiwgc2V0U3R5bGUgfSBmcm9tICcuL3V0aWxzJ1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQoaW5zdGFuY2UpIHtcbiAgICB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2VcbiAgICB0aGlzLnBhcmVudCA9IGRvY3VtZW50LmJvZHlcblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgdG9wOiAwLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHJpZ2h0OiAwLFxuICAgICAgYm90dG9tOiAwLFxuICAgICAgb3BhY2l0eTogMFxuICAgIH0pXG5cbiAgICB0aGlzLnVwZGF0ZVN0eWxlKGluc3RhbmNlLm9wdGlvbnMpXG4gICAgbGlzdGVuKHRoaXMuZWwsICdjbGljaycsIGluc3RhbmNlLmhhbmRsZXIuY2xpY2tPdmVybGF5LmJpbmQoaW5zdGFuY2UpKVxuICB9LFxuXG4gIHVwZGF0ZVN0eWxlKG9wdGlvbnMpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICB6SW5kZXg6IG9wdGlvbnMuekluZGV4LFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBvcHRpb25zLmJnQ29sb3IsXG4gICAgICB0cmFuc2l0aW9uOiBgb3BhY2l0eVxuICAgICAgICAke29wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9ufXNcbiAgICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gXG4gICAgfSlcbiAgfSxcblxuICBpbnNlcnQoKSB7XG4gICAgdGhpcy5wYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5lbClcbiAgfSxcblxuICByZW1vdmUoKSB7XG4gICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5lbClcbiAgfSxcblxuICBmYWRlSW4oKSB7XG4gICAgdGhpcy5lbC5vZmZzZXRXaWR0aFxuICAgIHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9ucy5iZ09wYWNpdHlcbiAgfSxcblxuICBmYWRlT3V0KCkge1xuICAgIHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IDBcbiAgfVxufVxuIiwiaW1wb3J0IHsgY3Vyc29yLCBzZXRTdHlsZSwgZ2V0T3JpZ2luYWxTb3VyY2UsIHRyYW5zZm9ybUNzc1Byb3AgfSBmcm9tICcuL3V0aWxzJ1xuXG4vLyBUcmFuc2xhdGUgei1heGlzIHRvIGZpeCBDU1MgZ3JpZCBkaXNwbGF5IGlzc3VlIGluIENocm9tZTpcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9raW5nZGlkbzk5OS96b29taW5nL2lzc3Vlcy80MlxuY29uc3QgVFJBTlNMQVRFX1ogPSAwXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdChlbCwgaW5zdGFuY2UpIHtcbiAgICB0aGlzLmVsID0gZWxcbiAgICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2VcbiAgICB0aGlzLnNyY1RodW1ibmFpbCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdzcmMnKVxuICAgIHRoaXMuc3Jjc2V0ID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ3NyY3NldCcpXG4gICAgdGhpcy5zcmNPcmlnaW5hbCA9IGdldE9yaWdpbmFsU291cmNlKHRoaXMuZWwpXG4gICAgdGhpcy5yZWN0ID0gdGhpcy5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgIHRoaXMudHJhbnNsYXRlID0gbnVsbFxuICAgIHRoaXMuc2NhbGUgPSBudWxsXG4gICAgdGhpcy5zdHlsZU9wZW4gPSBudWxsXG4gICAgdGhpcy5zdHlsZUNsb3NlID0gbnVsbFxuICB9LFxuXG4gIHpvb21JbigpIHtcbiAgICBjb25zdCB7XG4gICAgICB6SW5kZXgsXG4gICAgICBlbmFibGVHcmFiLFxuICAgICAgdHJhbnNpdGlvbkR1cmF0aW9uLFxuICAgICAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgfSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9uc1xuICAgIHRoaXMudHJhbnNsYXRlID0gdGhpcy5jYWxjdWxhdGVUcmFuc2xhdGUoKVxuICAgIHRoaXMuc2NhbGUgPSB0aGlzLmNhbGN1bGF0ZVNjYWxlKClcblxuICAgIHRoaXMuc3R5bGVPcGVuID0ge1xuICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgICB6SW5kZXg6IHpJbmRleCArIDEsXG4gICAgICBjdXJzb3I6IGVuYWJsZUdyYWIgPyBjdXJzb3IuZ3JhYiA6IGN1cnNvci56b29tT3V0LFxuICAgICAgdHJhbnNpdGlvbjogYCR7dHJhbnNmb3JtQ3NzUHJvcH1cbiAgICAgICAgJHt0cmFuc2l0aW9uRHVyYXRpb259c1xuICAgICAgICAke3RyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gLFxuICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoJHt0aGlzLnRyYW5zbGF0ZS54fXB4LCAke1xuICAgICAgICB0aGlzLnRyYW5zbGF0ZS55XG4gICAgICAgIH1weCwgJHtUUkFOU0xBVEVfWn1weClcbiAgICAgICAgc2NhbGUoJHt0aGlzLnNjYWxlLnh9LCR7dGhpcy5zY2FsZS55fSlgLFxuICAgICAgaGVpZ2h0OiBgJHt0aGlzLnJlY3QuaGVpZ2h0fXB4YCxcbiAgICAgIHdpZHRoOiBgJHt0aGlzLnJlY3Qud2lkdGh9cHhgXG4gICAgfVxuXG4gICAgLy8gRm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcblxuICAgIC8vIFRyaWdnZXIgdHJhbnNpdGlvblxuICAgIHRoaXMuc3R5bGVDbG9zZSA9IHNldFN0eWxlKHRoaXMuZWwsIHRoaXMuc3R5bGVPcGVuLCB0cnVlKVxuICB9LFxuXG4gIHpvb21PdXQoKSB7XG4gICAgLy8gRm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHsgdHJhbnNmb3JtOiAnbm9uZScgfSlcbiAgfSxcblxuICBncmFiKHgsIHksIHNjYWxlRXh0cmEpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IFtkeCwgZHldID0gW3dpbmRvd0NlbnRlci54IC0geCwgd2luZG93Q2VudGVyLnkgLSB5XVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgY3Vyc29yOiBjdXJzb3IubW92ZSxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZTNkKFxuICAgICAgICAke3RoaXMudHJhbnNsYXRlLnggKyBkeH1weCwgJHt0aGlzLnRyYW5zbGF0ZS55ICtcbiAgICAgICAgZHl9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54ICsgc2NhbGVFeHRyYX0sJHt0aGlzLnNjYWxlLnkgKyBzY2FsZUV4dHJhfSlgXG4gICAgfSlcbiAgfSxcblxuICBtb3ZlKHgsIHksIHNjYWxlRXh0cmEpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IFtkeCwgZHldID0gW3dpbmRvd0NlbnRlci54IC0geCwgd2luZG93Q2VudGVyLnkgLSB5XVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtQ3NzUHJvcCxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZTNkKFxuICAgICAgICAke3RoaXMudHJhbnNsYXRlLnggKyBkeH1weCwgJHt0aGlzLnRyYW5zbGF0ZS55ICtcbiAgICAgICAgZHl9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54ICsgc2NhbGVFeHRyYX0sJHt0aGlzLnNjYWxlLnkgKyBzY2FsZUV4dHJhfSlgXG4gICAgfSlcbiAgfSxcblxuICByZXN0b3JlQ2xvc2VTdHlsZSgpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlQ2xvc2UpXG4gIH0sXG5cbiAgcmVzdG9yZU9wZW5TdHlsZSgpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlT3BlbilcbiAgfSxcblxuICB1cGdyYWRlU291cmNlKCkge1xuICAgIGlmICh0aGlzLnNyY09yaWdpbmFsKSB7XG4gICAgICBjb25zdCBwYXJlbnROb2RlID0gdGhpcy5lbC5wYXJlbnROb2RlXG5cbiAgICAgIGlmICh0aGlzLnNyY3NldCkge1xuICAgICAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZSgnc3Jjc2V0JylcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGVtcCA9IHRoaXMuZWwuY2xvbmVOb2RlKGZhbHNlKVxuXG4gICAgICAvLyBGb3JjZSBjb21wdXRlIHRoZSBoaS1yZXMgaW1hZ2UgaW4gRE9NIHRvIHByZXZlbnRcbiAgICAgIC8vIGltYWdlIGZsaWNrZXJpbmcgd2hpbGUgdXBkYXRpbmcgc3JjXG4gICAgICB0ZW1wLnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNPcmlnaW5hbClcbiAgICAgIHRlbXAuc3R5bGUucG9zaXRpb24gPSAnZml4ZWQnXG4gICAgICB0ZW1wLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJ1xuICAgICAgcGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0ZW1wKVxuXG4gICAgICAvLyBBZGQgZGVsYXkgdG8gcHJldmVudCBGaXJlZm94IGZyb20gZmxpY2tlcmluZ1xuICAgICAgc2V0VGltZW91dChcbiAgICAgICAgZnVuY3Rpb24gdXBkYXRlU3JjKCkge1xuICAgICAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnNyY09yaWdpbmFsKVxuICAgICAgICAgIHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGVtcClcbiAgICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgICA1MFxuICAgICAgKVxuICAgIH1cbiAgfSxcblxuICBkb3duZ3JhZGVTb3VyY2UoKSB7XG4gICAgaWYgKHRoaXMuc3JjT3JpZ2luYWwpIHtcbiAgICAgIGlmICh0aGlzLnNyY3NldCkge1xuICAgICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSgnc3Jjc2V0JywgdGhpcy5zcmNzZXQpXG4gICAgICB9XG4gICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNUaHVtYm5haWwpXG4gICAgfVxuICB9LFxuXG4gIGNhbGN1bGF0ZVRyYW5zbGF0ZSgpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IHRhcmdldENlbnRlciA9IHtcbiAgICAgIHg6IHRoaXMucmVjdC5sZWZ0ICsgdGhpcy5yZWN0LndpZHRoIC8gMixcbiAgICAgIHk6IHRoaXMucmVjdC50b3AgKyB0aGlzLnJlY3QuaGVpZ2h0IC8gMlxuICAgIH1cblxuICAgIC8vIFRoZSB2ZWN0b3IgdG8gdHJhbnNsYXRlIGltYWdlIHRvIHRoZSB3aW5kb3cgY2VudGVyXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gdGFyZ2V0Q2VudGVyLngsXG4gICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIHRhcmdldENlbnRlci55XG4gICAgfVxuICB9LFxuXG4gIGNhbGN1bGF0ZVNjYWxlKCkge1xuICAgIGNvbnN0IHsgem9vbWluZ0hlaWdodCwgem9vbWluZ1dpZHRoIH0gPSB0aGlzLmVsLmRhdGFzZXRcbiAgICBjb25zdCB7IGN1c3RvbVNpemUsIHNjYWxlQmFzZSB9ID0gdGhpcy5pbnN0YW5jZS5vcHRpb25zXG5cbiAgICBpZiAoIWN1c3RvbVNpemUgJiYgem9vbWluZ0hlaWdodCAmJiB6b29taW5nV2lkdGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IHpvb21pbmdXaWR0aCAvIHRoaXMucmVjdC53aWR0aCxcbiAgICAgICAgeTogem9vbWluZ0hlaWdodCAvIHRoaXMucmVjdC5oZWlnaHRcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGN1c3RvbVNpemUgJiYgdHlwZW9mIGN1c3RvbVNpemUgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiBjdXN0b21TaXplLndpZHRoIC8gdGhpcy5yZWN0LndpZHRoLFxuICAgICAgICB5OiBjdXN0b21TaXplLmhlaWdodCAvIHRoaXMucmVjdC5oZWlnaHRcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGFyZ2V0SGFsZldpZHRoID0gdGhpcy5yZWN0LndpZHRoIC8gMlxuICAgICAgY29uc3QgdGFyZ2V0SGFsZkhlaWdodCA9IHRoaXMucmVjdC5oZWlnaHQgLyAyXG4gICAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuXG4gICAgICAvLyBUaGUgZGlzdGFuY2UgYmV0d2VlbiB0YXJnZXQgZWRnZSBhbmQgd2luZG93IGVkZ2VcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UgPSB7XG4gICAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gdGFyZ2V0SGFsZldpZHRoLFxuICAgICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIHRhcmdldEhhbGZIZWlnaHRcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2NhbGVIb3Jpem9udGFsbHkgPSB0YXJnZXRFZGdlVG9XaW5kb3dFZGdlLnggLyB0YXJnZXRIYWxmV2lkdGhcbiAgICAgIGNvbnN0IHNjYWxlVmVydGljYWxseSA9IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UueSAvIHRhcmdldEhhbGZIZWlnaHRcblxuICAgICAgLy8gVGhlIGFkZGl0aW9uYWwgc2NhbGUgaXMgYmFzZWQgb24gdGhlIHNtYWxsZXIgdmFsdWUgb2ZcbiAgICAgIC8vIHNjYWxpbmcgaG9yaXpvbnRhbGx5IGFuZCBzY2FsaW5nIHZlcnRpY2FsbHlcbiAgICAgIGNvbnN0IHNjYWxlID0gc2NhbGVCYXNlICsgTWF0aC5taW4oc2NhbGVIb3Jpem9udGFsbHksIHNjYWxlVmVydGljYWxseSlcblxuICAgICAgaWYgKGN1c3RvbVNpemUgJiYgdHlwZW9mIGN1c3RvbVNpemUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFVzZSB6b29taW5nV2lkdGggYW5kIHpvb21pbmdIZWlnaHQgaWYgYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IG5hdHVyYWxXaWR0aCA9IHpvb21pbmdXaWR0aCB8fCB0aGlzLmVsLm5hdHVyYWxXaWR0aFxuICAgICAgICBjb25zdCBuYXR1cmFsSGVpZ2h0ID0gem9vbWluZ0hlaWdodCB8fCB0aGlzLmVsLm5hdHVyYWxIZWlnaHRcbiAgICAgICAgY29uc3QgbWF4Wm9vbWluZ1dpZHRoID1cbiAgICAgICAgICBwYXJzZUZsb2F0KGN1c3RvbVNpemUpICogbmF0dXJhbFdpZHRoIC8gKDEwMCAqIHRoaXMucmVjdC53aWR0aClcbiAgICAgICAgY29uc3QgbWF4Wm9vbWluZ0hlaWdodCA9XG4gICAgICAgICAgcGFyc2VGbG9hdChjdXN0b21TaXplKSAqIG5hdHVyYWxIZWlnaHQgLyAoMTAwICogdGhpcy5yZWN0LmhlaWdodClcblxuICAgICAgICAvLyBPbmx5IHNjYWxlIGltYWdlIHVwIHRvIHRoZSBzcGVjaWZpZWQgY3VzdG9tU2l6ZSBwZXJjZW50YWdlXG4gICAgICAgIGlmIChzY2FsZSA+IG1heFpvb21pbmdXaWR0aCB8fCBzY2FsZSA+IG1heFpvb21pbmdIZWlnaHQpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogbWF4Wm9vbWluZ1dpZHRoLFxuICAgICAgICAgICAgeTogbWF4Wm9vbWluZ0hlaWdodFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiBzY2FsZSxcbiAgICAgICAgeTogc2NhbGVcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0V2luZG93Q2VudGVyKCkge1xuICBjb25zdCBkb2NFbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxuICBjb25zdCB3aW5kb3dXaWR0aCA9IE1hdGgubWluKGRvY0VsLmNsaWVudFdpZHRoLCB3aW5kb3cuaW5uZXJXaWR0aClcbiAgY29uc3Qgd2luZG93SGVpZ2h0ID0gTWF0aC5taW4oZG9jRWwuY2xpZW50SGVpZ2h0LCB3aW5kb3cuaW5uZXJIZWlnaHQpXG5cbiAgcmV0dXJuIHtcbiAgICB4OiB3aW5kb3dXaWR0aCAvIDIsXG4gICAgeTogd2luZG93SGVpZ2h0IC8gMlxuICB9XG59XG4iLCJpbXBvcnQge1xuICBjdXJzb3IsXG4gIGxpc3RlbixcbiAgbG9hZEltYWdlLFxuICB0cmFuc0VuZEV2ZW50LFxuICBnZXRPcmlnaW5hbFNvdXJjZVxufSBmcm9tICcuL3V0aWxzJ1xuaW1wb3J0IERFRkFVTFRfT1BUSU9OUyBmcm9tICcuL29wdGlvbnMnXG5cbmltcG9ydCBoYW5kbGVyIGZyb20gJy4vaGFuZGxlcidcbmltcG9ydCBvdmVybGF5IGZyb20gJy4vb3ZlcmxheSdcbmltcG9ydCB0YXJnZXQgZnJvbSAnLi90YXJnZXQnXG5cbi8qKlxuICogWm9vbWluZyBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFVwZGF0ZSBkZWZhdWx0IG9wdGlvbnMgaWYgcHJvdmlkZWQuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy50YXJnZXQgPSBPYmplY3QuY3JlYXRlKHRhcmdldClcbiAgICB0aGlzLm92ZXJsYXkgPSBPYmplY3QuY3JlYXRlKG92ZXJsYXkpXG4gICAgdGhpcy5oYW5kbGVyID0gT2JqZWN0LmNyZWF0ZShoYW5kbGVyKVxuICAgIHRoaXMuYm9keSA9IGRvY3VtZW50LmJvZHlcblxuICAgIHRoaXMuc2hvd24gPSBmYWxzZVxuICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgdGhpcy5yZWxlYXNlZCA9IHRydWVcbiAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcbiAgICB0aGlzLnByZXNzVGltZXIgPSBudWxsXG5cbiAgICB0aGlzLm9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX09QVElPTlMsIG9wdGlvbnMpXG4gICAgdGhpcy5vdmVybGF5LmluaXQodGhpcylcbiAgICB0aGlzLmhhbmRsZXIuaW5pdCh0aGlzKVxuICAgIHRoaXMubGlzdGVuKHRoaXMub3B0aW9ucy5kZWZhdWx0Wm9vbWFibGUpXG4gIH1cblxuICAvKipcbiAgICogTWFrZSBlbGVtZW50KHMpIHpvb21hYmxlLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd8RWxlbWVudH0gZWwgQSBjc3Mgc2VsZWN0b3Igb3IgYW4gRWxlbWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGxpc3RlbihlbCkge1xuICAgIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGVsKVxuICAgICAgbGV0IGkgPSBlbHMubGVuZ3RoXG5cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5saXN0ZW4oZWxzW2ldKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWwudGFnTmFtZSA9PT0gJ0lNRycpIHtcbiAgICAgIGVsLnN0eWxlLmN1cnNvciA9IGN1cnNvci56b29tSW5cbiAgICAgIGxpc3RlbihlbCwgJ2NsaWNrJywgdGhpcy5oYW5kbGVyLmNsaWNrKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnByZWxvYWRJbWFnZSkge1xuICAgICAgICBsb2FkSW1hZ2UoZ2V0T3JpZ2luYWxTb3VyY2UoZWwpKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG9wdGlvbnMgb3IgcmV0dXJuIGN1cnJlbnQgb3B0aW9ucyBpZiBubyBhcmd1bWVudCBpcyBwcm92aWRlZC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zIEFuIE9iamVjdCB0aGF0IGNvbnRhaW5zIHRoaXMub3B0aW9ucy5cbiAgICogQHJldHVybiB7dGhpc3x0aGlzLm9wdGlvbnN9XG4gICAqL1xuICBjb25maWcob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMub3B0aW9ucywgb3B0aW9ucylcbiAgICAgIHRoaXMub3ZlcmxheS51cGRhdGVTdHlsZSh0aGlzLm9wdGlvbnMpXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9wZW4gKHpvb20gaW4pIHRoZSBFbGVtZW50LlxuICAgKiBAcGFyYW0gIHtFbGVtZW50fSBlbCBUaGUgRWxlbWVudCB0byBvcGVuLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbk9wZW5dIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsXG4gICAqIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG9wZW5lZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0IHdpbGwgZ2V0XG4gICAqIHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBvcGVuKGVsLCBjYiA9IHRoaXMub3B0aW9ucy5vbk9wZW4pIHtcbiAgICBpZiAodGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdHlwZW9mIGVsID09PSAnc3RyaW5nJyA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpIDogZWxcblxuICAgIGlmICh0YXJnZXQudGFnTmFtZSAhPT0gJ0lNRycpIHJldHVyblxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4pIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4odGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMudGFyZ2V0LmluaXQodGFyZ2V0LCB0aGlzKVxuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMucHJlbG9hZEltYWdlKSB7XG4gICAgICBsb2FkSW1hZ2UodGhpcy50YXJnZXQuc3JjT3JpZ2luYWwpXG4gICAgfVxuXG4gICAgdGhpcy5zaG93biA9IHRydWVcbiAgICB0aGlzLmxvY2sgPSB0cnVlXG5cbiAgICB0aGlzLnRhcmdldC56b29tSW4oKVxuICAgIHRoaXMub3ZlcmxheS5pbnNlcnQoKVxuICAgIHRoaXMub3ZlcmxheS5mYWRlSW4oKVxuXG4gICAgbGlzdGVuKGRvY3VtZW50LCAnc2Nyb2xsJywgdGhpcy5oYW5kbGVyLnNjcm9sbClcbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5oYW5kbGVyLmtleWRvd24pXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25XaW5kb3dSZXNpemUpIHtcbiAgICAgIGxpc3Rlbih3aW5kb3csICdyZXNpemUnLCB0aGlzLmhhbmRsZXIucmVzaXplV2luZG93KVxuICAgIH1cblxuICAgIGNvbnN0IG9uT3BlbkVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uT3BlbkVuZCwgZmFsc2UpXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgICAgdGhpcy50YXJnZXQudXBncmFkZVNvdXJjZSgpXG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgICB0b2dnbGVHcmFiTGlzdGVuZXJzKGRvY3VtZW50LCB0aGlzLmhhbmRsZXIsIHRydWUpXG4gICAgICB9XG5cbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uT3BlbkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ2xvc2UgKHpvb20gb3V0KSB0aGUgRWxlbWVudCBjdXJyZW50bHkgb3BlbmVkLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbkNsb3NlXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbFxuICAgKiBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBjbG9zZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldFxuICAgKiB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgY2xvc2UoY2IgPSB0aGlzLm9wdGlvbnMub25DbG9zZSkge1xuICAgIGlmICghdGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQuZWxcblxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVDbG9zZSkge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMubG9jayA9IHRydWVcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLmRlZmF1bHRcbiAgICB0aGlzLm92ZXJsYXkuZmFkZU91dCgpXG4gICAgdGhpcy50YXJnZXQuem9vbU91dCgpXG5cbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdzY3JvbGwnLCB0aGlzLmhhbmRsZXIuc2Nyb2xsLCBmYWxzZSlcbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5oYW5kbGVyLmtleWRvd24sIGZhbHNlKVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uV2luZG93UmVzaXplKSB7XG4gICAgICBsaXN0ZW4od2luZG93LCAncmVzaXplJywgdGhpcy5oYW5kbGVyLnJlc2l6ZVdpbmRvdywgZmFsc2UpXG4gICAgfVxuXG4gICAgY29uc3Qgb25DbG9zZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uQ2xvc2VFbmQsIGZhbHNlKVxuXG4gICAgICB0aGlzLnNob3duID0gZmFsc2VcbiAgICAgIHRoaXMubG9jayA9IGZhbHNlXG5cbiAgICAgIHRoaXMudGFyZ2V0LmRvd25ncmFkZVNvdXJjZSgpXG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgICB0b2dnbGVHcmFiTGlzdGVuZXJzKGRvY3VtZW50LCB0aGlzLmhhbmRsZXIsIGZhbHNlKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnRhcmdldC5yZXN0b3JlQ2xvc2VTdHlsZSgpXG4gICAgICB0aGlzLm92ZXJsYXkucmVtb3ZlKClcblxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25DbG9zZUVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogR3JhYiB0aGUgRWxlbWVudCBjdXJyZW50bHkgb3BlbmVkIGdpdmVuIGEgcG9zaXRpb24gYW5kIGFwcGx5IGV4dHJhIHpvb20taW4uXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB4IFRoZSBYLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeSBUaGUgWS1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHNjYWxlRXh0cmEgRXh0cmEgem9vbS1pbiB0byBhcHBseS5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25HcmFiXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXRcbiAgICogd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBncmFiYmVkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXRcbiAgICogd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGdyYWIoeCwgeSwgc2NhbGVFeHRyYSA9IHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhLCBjYiA9IHRoaXMub3B0aW9ucy5vbkdyYWIpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYikge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYih0YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy5yZWxlYXNlZCA9IGZhbHNlXG4gICAgdGhpcy50YXJnZXQuZ3JhYih4LCB5LCBzY2FsZUV4dHJhKVxuXG4gICAgY29uc3Qgb25HcmFiRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25HcmFiRW5kLCBmYWxzZSlcbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uR3JhYkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogTW92ZSB0aGUgRWxlbWVudCBjdXJyZW50bHkgZ3JhYmJlZCBnaXZlbiBhIHBvc2l0aW9uIGFuZCBhcHBseSBleHRyYSB6b29tLWluLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeCBUaGUgWC1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHkgVGhlIFktYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICBzY2FsZUV4dHJhIEV4dHJhIHpvb20taW4gdG8gYXBwbHkuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uTW92ZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgbW92ZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsXG4gICAqIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgbW92ZSh4LCB5LCBzY2FsZUV4dHJhID0gdGhpcy5vcHRpb25zLnNjYWxlRXh0cmEsIGNiID0gdGhpcy5vcHRpb25zLm9uTW92ZSkge1xuICAgIGlmICghdGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgdGhpcy5yZWxlYXNlZCA9IGZhbHNlXG4gICAgdGhpcy5ib2R5LnN0eWxlLmN1cnNvciA9IGN1cnNvci5tb3ZlXG4gICAgdGhpcy50YXJnZXQubW92ZSh4LCB5LCBzY2FsZUV4dHJhKVxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQuZWxcblxuICAgIGNvbnN0IG9uTW92ZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uTW92ZUVuZCwgZmFsc2UpXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk1vdmVFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbGVhc2UgdGhlIEVsZW1lbnQgY3VycmVudGx5IGdyYWJiZWQuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uUmVsZWFzZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgcmVsZWFzZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdFxuICAgKiB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgcmVsZWFzZShjYiA9IHRoaXMub3B0aW9ucy5vblJlbGVhc2UpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSkge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSh0YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy5sb2NrID0gdHJ1ZVxuICAgIHRoaXMuYm9keS5zdHlsZS5jdXJzb3IgPSBjdXJzb3IuZGVmYXVsdFxuICAgIHRoaXMudGFyZ2V0LnJlc3RvcmVPcGVuU3R5bGUoKVxuXG4gICAgY29uc3Qgb25SZWxlYXNlRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25SZWxlYXNlRW5kLCBmYWxzZSlcbiAgICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgICB0aGlzLnJlbGVhc2VkID0gdHJ1ZVxuXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvblJlbGVhc2VFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUdyYWJMaXN0ZW5lcnMoZWwsIGhhbmRsZXIsIGFkZCkge1xuICBjb25zdCB0eXBlcyA9IFtcbiAgICAnbW91c2Vkb3duJyxcbiAgICAnbW91c2Vtb3ZlJyxcbiAgICAnbW91c2V1cCcsXG4gICAgJ3RvdWNoc3RhcnQnLFxuICAgICd0b3VjaG1vdmUnLFxuICAgICd0b3VjaGVuZCdcbiAgXVxuXG4gIHR5cGVzLmZvckVhY2goZnVuY3Rpb24gdG9nZ2xlTGlzdGVuZXIodHlwZSkge1xuICAgIGxpc3RlbihlbCwgdHlwZSwgaGFuZGxlclt0eXBlXSwgYWRkKVxuICB9KVxufVxuIl0sIm5hbWVzIjpbIndlYmtpdFByZWZpeCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50Iiwic3R5bGUiLCJjdXJzb3IiLCJsaXN0ZW4iLCJlbCIsImV2ZW50IiwiaGFuZGxlciIsImFkZCIsIm9wdGlvbnMiLCJwYXNzaXZlIiwiYWRkRXZlbnRMaXN0ZW5lciIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJsb2FkSW1hZ2UiLCJzcmMiLCJjYiIsImltZyIsIkltYWdlIiwib25sb2FkIiwib25JbWFnZUxvYWQiLCJnZXRPcmlnaW5hbFNvdXJjZSIsImRhdGFzZXQiLCJvcmlnaW5hbCIsInBhcmVudE5vZGUiLCJ0YWdOYW1lIiwiZ2V0QXR0cmlidXRlIiwic2V0U3R5bGUiLCJzdHlsZXMiLCJyZW1lbWJlciIsInMiLCJrZXkiLCJiaW5kQWxsIiwiX3RoaXMiLCJ0aGF0IiwibWV0aG9kcyIsIk9iamVjdCIsImdldE93blByb3BlcnR5TmFtZXMiLCJnZXRQcm90b3R5cGVPZiIsImZvckVhY2giLCJiaW5kT25lIiwibWV0aG9kIiwiYmluZCIsInRyYW5zIiwic25pZmZUcmFuc2l0aW9uIiwiY3JlYXRlRWxlbWVudCIsInRyYW5zZm9ybUNzc1Byb3AiLCJ0cmFuc0VuZEV2ZW50IiwiY2hlY2tUcmFucyIsInRyYW5zaXRpb25Qcm9wIiwidHJhbnNmb3JtUHJvcCIsInRyYW5zaXRpb24iLCJ2YWx1ZSIsInRyYW5zZm9ybSIsInJlcyIsInRmb3JtIiwiZW5kIiwic29tZSIsImhhc1RyYW5zaXRpb24iLCJwcm9wIiwidW5kZWZpbmVkIiwiaGFzVHJhbnNmb3JtIiwicmVwbGFjZSIsIlBSRVNTX0RFTEFZIiwiaW5zdGFuY2UiLCJlIiwicHJldmVudERlZmF1bHQiLCJpc1ByZXNzaW5nTWV0YUtleSIsIndpbmRvdyIsIm9wZW4iLCJ0YXJnZXQiLCJzcmNPcmlnaW5hbCIsImN1cnJlbnRUYXJnZXQiLCJzaG93biIsInJlbGVhc2VkIiwiY2xvc2UiLCJyZWxlYXNlIiwiYm9keSIsInNjcm9sbExlZnQiLCJwYWdlWE9mZnNldCIsInNjcm9sbFRvcCIsInBhZ2VZT2Zmc2V0IiwibGFzdFNjcm9sbFBvc2l0aW9uIiwiZGVsdGFYIiwieCIsImRlbHRhWSIsInkiLCJ0aHJlc2hvbGQiLCJzY3JvbGxUaHJlc2hvbGQiLCJNYXRoIiwiYWJzIiwiaXNFc2NhcGUiLCJpc0xlZnRCdXR0b24iLCJjbGllbnRYIiwiY2xpZW50WSIsInByZXNzVGltZXIiLCJzZXRUaW1lb3V0IiwiZ3JhYk9uTW91c2VEb3duIiwiZ3JhYiIsIm1vdmUiLCJ0b3VjaGVzIiwiZ3JhYk9uVG91Y2hTdGFydCIsImlzVG91Y2hpbmciLCJidXR0b24iLCJtZXRhS2V5IiwiY3RybEtleSIsInRhcmdldFRvdWNoZXMiLCJsZW5ndGgiLCJjb2RlIiwia2V5Q29kZSIsInBhcmVudCIsInVwZGF0ZVN0eWxlIiwiY2xpY2tPdmVybGF5IiwiekluZGV4IiwiYmdDb2xvciIsInRyYW5zaXRpb25EdXJhdGlvbiIsInRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbiIsImFwcGVuZENoaWxkIiwicmVtb3ZlQ2hpbGQiLCJvZmZzZXRXaWR0aCIsIm9wYWNpdHkiLCJiZ09wYWNpdHkiLCJUUkFOU0xBVEVfWiIsInNyY1RodW1ibmFpbCIsInNyY3NldCIsInJlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJ0cmFuc2xhdGUiLCJzY2FsZSIsInN0eWxlT3BlbiIsInN0eWxlQ2xvc2UiLCJlbmFibGVHcmFiIiwiY2FsY3VsYXRlVHJhbnNsYXRlIiwiY2FsY3VsYXRlU2NhbGUiLCJ6b29tT3V0IiwiaGVpZ2h0Iiwid2lkdGgiLCJzY2FsZUV4dHJhIiwid2luZG93Q2VudGVyIiwiZ2V0V2luZG93Q2VudGVyIiwiZHgiLCJkeSIsInJlbW92ZUF0dHJpYnV0ZSIsInRlbXAiLCJjbG9uZU5vZGUiLCJzZXRBdHRyaWJ1dGUiLCJwb3NpdGlvbiIsInZpc2liaWxpdHkiLCJ1cGRhdGVTcmMiLCJ0YXJnZXRDZW50ZXIiLCJsZWZ0IiwidG9wIiwiem9vbWluZ0hlaWdodCIsInpvb21pbmdXaWR0aCIsImN1c3RvbVNpemUiLCJzY2FsZUJhc2UiLCJ0YXJnZXRIYWxmV2lkdGgiLCJ0YXJnZXRIYWxmSGVpZ2h0IiwidGFyZ2V0RWRnZVRvV2luZG93RWRnZSIsInNjYWxlSG9yaXpvbnRhbGx5Iiwic2NhbGVWZXJ0aWNhbGx5IiwibWluIiwibmF0dXJhbFdpZHRoIiwibmF0dXJhbEhlaWdodCIsIm1heFpvb21pbmdXaWR0aCIsInBhcnNlRmxvYXQiLCJtYXhab29taW5nSGVpZ2h0IiwiZG9jRWwiLCJ3aW5kb3dXaWR0aCIsImNsaWVudFdpZHRoIiwiaW5uZXJXaWR0aCIsIndpbmRvd0hlaWdodCIsImNsaWVudEhlaWdodCIsImlubmVySGVpZ2h0IiwiWm9vbWluZyIsImNyZWF0ZSIsIm92ZXJsYXkiLCJsb2NrIiwiYmFiZWxIZWxwZXJzLmV4dGVuZHMiLCJERUZBVUxUX09QVElPTlMiLCJpbml0IiwiZGVmYXVsdFpvb21hYmxlIiwiZWxzIiwicXVlcnlTZWxlY3RvckFsbCIsImkiLCJ6b29tSW4iLCJjbGljayIsInByZWxvYWRJbWFnZSIsIm9uT3BlbiIsInF1ZXJ5U2VsZWN0b3IiLCJvbkJlZm9yZU9wZW4iLCJpbnNlcnQiLCJmYWRlSW4iLCJzY3JvbGwiLCJrZXlkb3duIiwiY2xvc2VPbldpbmRvd1Jlc2l6ZSIsInJlc2l6ZVdpbmRvdyIsIm9uT3BlbkVuZCIsInVwZ3JhZGVTb3VyY2UiLCJvbkNsb3NlIiwib25CZWZvcmVDbG9zZSIsImRlZmF1bHQiLCJmYWRlT3V0Iiwib25DbG9zZUVuZCIsImRvd25ncmFkZVNvdXJjZSIsInJlc3RvcmVDbG9zZVN0eWxlIiwicmVtb3ZlIiwib25HcmFiIiwib25CZWZvcmVHcmFiIiwib25HcmFiRW5kIiwib25Nb3ZlIiwib25Nb3ZlRW5kIiwib25SZWxlYXNlIiwib25CZWZvcmVSZWxlYXNlIiwicmVzdG9yZU9wZW5TdHlsZSIsIm9uUmVsZWFzZUVuZCIsInRvZ2dsZUdyYWJMaXN0ZW5lcnMiLCJ0eXBlcyIsInRvZ2dsZUxpc3RlbmVyIiwidHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQU8sSUFBTUEsZUFBZSxzQkFBc0JDLFNBQVNDLGVBQVQsQ0FBeUJDLEtBQS9DLEdBQ3hCLFVBRHdCLEdBRXhCLEVBRkc7O0FBSVAsQUFBTyxJQUFNQyxTQUFTO1dBQ1gsTUFEVztVQUVUSixZQUFYLFlBRm9CO1dBR1JBLFlBQVosYUFIb0I7UUFJWEEsWUFBVCxTQUpvQjtRQUtkO0NBTEQ7O0FBUVAsQUFBTyxTQUFTSyxNQUFULENBQWlCQyxFQUFqQixFQUFxQkMsS0FBckIsRUFBNEJDLE9BQTVCLEVBQWlEO01BQVpDLEdBQVksdUVBQU4sSUFBTTs7TUFDaERDLFVBQVUsRUFBRUMsU0FBUyxLQUFYLEVBQWhCOztNQUVJRixHQUFKLEVBQVM7T0FDSkcsZ0JBQUgsQ0FBb0JMLEtBQXBCLEVBQTJCQyxPQUEzQixFQUFvQ0UsT0FBcEM7R0FERixNQUVPO09BQ0ZHLG1CQUFILENBQXVCTixLQUF2QixFQUE4QkMsT0FBOUIsRUFBdUNFLE9BQXZDOzs7O0FBSUosQUFBTyxTQUFTSSxTQUFULENBQW9CQyxHQUFwQixFQUF5QkMsRUFBekIs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
