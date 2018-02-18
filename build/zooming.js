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
   * @type {Object}
   * @example
   * customSize: { width: 800, height: 400 }
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

// Translate z-axis to fix CSS grid display issue in Chrome:
// https://github.com/kingdido999/zooming/issues/42
var TRANSLATE_Z = 0;

var target = {
  init: function init(el, instance) {
    this.el = el;
    this.instance = instance;
    this.srcThumbnail = this.el.getAttribute('src');
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


    if (zoomingHeight && zoomingWidth) {
      return {
        x: zoomingWidth / this.rect.width,
        y: zoomingHeight / this.rect.height
      };
    } else if (customSize) {
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

    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
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
        Object.assign(this.options, options);
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

listen(document, 'DOMContentLoaded', function initZooming() {
  new Zooming();
});

return Zooming;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9vbWluZy5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3V0aWxzLmpzIiwiLi4vc3JjL29wdGlvbnMuanMiLCIuLi9zcmMvbW9kdWxlcy9oYW5kbGVyLmpzIiwiLi4vc3JjL21vZHVsZXMvb3ZlcmxheS5qcyIsIi4uL3NyYy9tb2R1bGVzL3RhcmdldC5qcyIsIi4uL3NyYy9tb2R1bGVzL3pvb21pbmcuanMiLCIuLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IHdlYmtpdFByZWZpeCA9ICdXZWJraXRBcHBlYXJhbmNlJyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGVcbiAgPyAnLXdlYmtpdC0nXG4gIDogJydcblxuZXhwb3J0IGNvbnN0IGN1cnNvciA9IHtcbiAgZGVmYXVsdDogJ2F1dG8nLFxuICB6b29tSW46IGAke3dlYmtpdFByZWZpeH16b29tLWluYCxcbiAgem9vbU91dDogYCR7d2Via2l0UHJlZml4fXpvb20tb3V0YCxcbiAgZ3JhYjogYCR7d2Via2l0UHJlZml4fWdyYWJgLFxuICBtb3ZlOiAnbW92ZSdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpc3RlbiAoZWwsIGV2ZW50LCBoYW5kbGVyLCBhZGQgPSB0cnVlKSB7XG4gIGNvbnN0IG9wdGlvbnMgPSB7IHBhc3NpdmU6IGZhbHNlIH1cblxuICBpZiAoYWRkKSB7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgaGFuZGxlciwgb3B0aW9ucylcbiAgfSBlbHNlIHtcbiAgICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyLCBvcHRpb25zKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkSW1hZ2UgKHNyYywgY2IpIHtcbiAgaWYgKHNyYykge1xuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpXG5cbiAgICBpbWcub25sb2FkID0gZnVuY3Rpb24gb25JbWFnZUxvYWQgKCkge1xuICAgICAgaWYgKGNiKSBjYihpbWcpXG4gICAgfVxuXG4gICAgaW1nLnNyYyA9IHNyY1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRPcmlnaW5hbFNvdXJjZSAoZWwpIHtcbiAgaWYgKGVsLmRhdGFzZXQub3JpZ2luYWwpIHtcbiAgICByZXR1cm4gZWwuZGF0YXNldC5vcmlnaW5hbFxuICB9IGVsc2UgaWYgKGVsLnBhcmVudE5vZGUudGFnTmFtZSA9PT0gJ0EnKSB7XG4gICAgcmV0dXJuIGVsLnBhcmVudE5vZGUuZ2V0QXR0cmlidXRlKCdocmVmJylcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRTdHlsZSAoZWwsIHN0eWxlcywgcmVtZW1iZXIpIHtcbiAgY2hlY2tUcmFucyhzdHlsZXMpXG5cbiAgbGV0IHMgPSBlbC5zdHlsZVxuICBsZXQgb3JpZ2luYWwgPSB7fVxuXG4gIGZvciAobGV0IGtleSBpbiBzdHlsZXMpIHtcbiAgICBpZiAocmVtZW1iZXIpIHtcbiAgICAgIG9yaWdpbmFsW2tleV0gPSBzW2tleV0gfHwgJydcbiAgICB9XG5cbiAgICBzW2tleV0gPSBzdHlsZXNba2V5XVxuICB9XG5cbiAgcmV0dXJuIG9yaWdpbmFsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kQWxsIChfdGhpcywgdGhhdCkge1xuICBjb25zdCBtZXRob2RzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoT2JqZWN0LmdldFByb3RvdHlwZU9mKF90aGlzKSlcbiAgbWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIGJpbmRPbmUgKG1ldGhvZCkge1xuICAgIF90aGlzW21ldGhvZF0gPSBfdGhpc1ttZXRob2RdLmJpbmQodGhhdClcbiAgfSlcbn1cblxuY29uc3QgdHJhbnMgPSBzbmlmZlRyYW5zaXRpb24oZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXG5leHBvcnQgY29uc3QgdHJhbnNmb3JtQ3NzUHJvcCA9IHRyYW5zLnRyYW5zZm9ybUNzc1Byb3BcbmV4cG9ydCBjb25zdCB0cmFuc0VuZEV2ZW50ID0gdHJhbnMudHJhbnNFbmRFdmVudFxuXG5mdW5jdGlvbiBjaGVja1RyYW5zIChzdHlsZXMpIHtcbiAgY29uc3QgeyB0cmFuc2l0aW9uUHJvcCwgdHJhbnNmb3JtUHJvcCB9ID0gdHJhbnNcblxuICBpZiAoc3R5bGVzLnRyYW5zaXRpb24pIHtcbiAgICBjb25zdCB2YWx1ZSA9IHN0eWxlcy50cmFuc2l0aW9uXG4gICAgZGVsZXRlIHN0eWxlcy50cmFuc2l0aW9uXG4gICAgc3R5bGVzW3RyYW5zaXRpb25Qcm9wXSA9IHZhbHVlXG4gIH1cblxuICBpZiAoc3R5bGVzLnRyYW5zZm9ybSkge1xuICAgIGNvbnN0IHZhbHVlID0gc3R5bGVzLnRyYW5zZm9ybVxuICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNmb3JtXG4gICAgc3R5bGVzW3RyYW5zZm9ybVByb3BdID0gdmFsdWVcbiAgfVxufVxuXG5mdW5jdGlvbiBzbmlmZlRyYW5zaXRpb24gKGVsKSB7XG4gIGxldCByZXMgPSB7fVxuICBjb25zdCB0cmFucyA9IFsnd2Via2l0VHJhbnNpdGlvbicsICd0cmFuc2l0aW9uJywgJ21velRyYW5zaXRpb24nXVxuICBjb25zdCB0Zm9ybSA9IFsnd2Via2l0VHJhbnNmb3JtJywgJ3RyYW5zZm9ybScsICdtb3pUcmFuc2Zvcm0nXVxuICBjb25zdCBlbmQgPSB7XG4gICAgdHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnLFxuICAgIG1velRyYW5zaXRpb246ICd0cmFuc2l0aW9uZW5kJyxcbiAgICB3ZWJraXRUcmFuc2l0aW9uOiAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgfVxuXG4gIHRyYW5zLnNvbWUoZnVuY3Rpb24gaGFzVHJhbnNpdGlvbiAocHJvcCkge1xuICAgIGlmIChlbC5zdHlsZVtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXMudHJhbnNpdGlvblByb3AgPSBwcm9wXG4gICAgICByZXMudHJhbnNFbmRFdmVudCA9IGVuZFtwcm9wXVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH0pXG5cbiAgdGZvcm0uc29tZShmdW5jdGlvbiBoYXNUcmFuc2Zvcm0gKHByb3ApIHtcbiAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzLnRyYW5zZm9ybVByb3AgPSBwcm9wXG4gICAgICByZXMudHJhbnNmb3JtQ3NzUHJvcCA9IHByb3AucmVwbGFjZSgvKC4qKVRyYW5zZm9ybS8sICctJDEtdHJhbnNmb3JtJylcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXNcbn1cbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLyoqXG4gICAqIFpvb21hYmxlIGVsZW1lbnRzIGJ5IGRlZmF1bHQuIEl0IGNhbiBiZSBhIGNzcyBzZWxlY3RvciBvciBhbiBlbGVtZW50LlxuICAgKiBAdHlwZSB7c3RyaW5nfEVsZW1lbnR9XG4gICAqL1xuICBkZWZhdWx0Wm9vbWFibGU6ICdpbWdbZGF0YS1hY3Rpb249XCJ6b29tXCJdJyxcblxuICAvKipcbiAgICogVG8gYmUgYWJsZSB0byBncmFiIGFuZCBkcmFnIHRoZSBpbWFnZSBmb3IgZXh0cmEgem9vbS1pbi5cbiAgICogQHR5cGUge2Jvb2xlYW59XG4gICAqL1xuICBlbmFibGVHcmFiOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBQcmVsb2FkIHpvb21hYmxlIGltYWdlcy5cbiAgICogQHR5cGUge2Jvb2xlYW59XG4gICAqL1xuICBwcmVsb2FkSW1hZ2U6IGZhbHNlLFxuXG4gIC8qKlxuICAgKiBDbG9zZSB0aGUgem9vbWVkIGltYWdlIHdoZW4gYnJvd3NlciB3aW5kb3cgaXMgcmVzaXplZC5cbiAgICogQHR5cGUge2Jvb2xlYW59XG4gICAqL1xuICBjbG9zZU9uV2luZG93UmVzaXplOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBUcmFuc2l0aW9uIGR1cmF0aW9uIGluIHNlY29uZHMuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICB0cmFuc2l0aW9uRHVyYXRpb246IDAuNCxcblxuICAvKipcbiAgICogVHJhbnNpdGlvbiB0aW1pbmcgZnVuY3Rpb24uXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICB0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb246ICdjdWJpYy1iZXppZXIoMC40LCAwLCAwLCAxKScsXG5cbiAgLyoqXG4gICAqIE92ZXJsYXkgYmFja2dyb3VuZCBjb2xvci5cbiAgICogQHR5cGUge3N0cmluZ31cbiAgICovXG4gIGJnQ29sb3I6ICdyZ2IoMjU1LCAyNTUsIDI1NSknLFxuXG4gIC8qKlxuICAgKiBPdmVybGF5IGJhY2tncm91bmQgb3BhY2l0eS5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIGJnT3BhY2l0eTogMSxcblxuICAvKipcbiAgICogVGhlIGJhc2Ugc2NhbGUgZmFjdG9yIGZvciB6b29taW5nLiBCeSBkZWZhdWx0IHNjYWxlIHRvIGZpdCB0aGUgd2luZG93LlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgc2NhbGVCYXNlOiAxLjAsXG5cbiAgLyoqXG4gICAqIFRoZSBhZGRpdGlvbmFsIHNjYWxlIGZhY3RvciB3aGVuIGdyYWJiaW5nIHRoZSBpbWFnZS5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHNjYWxlRXh0cmE6IDAuNSxcblxuICAvKipcbiAgICogSG93IG11Y2ggc2Nyb2xsaW5nIGl0IHRha2VzIGJlZm9yZSBjbG9zaW5nIG91dC5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHNjcm9sbFRocmVzaG9sZDogNDAsXG5cbiAgLyoqXG4gICAqIFRoZSB6LWluZGV4IHRoYXQgdGhlIG92ZXJsYXkgd2lsbCBiZSBhZGRlZCB3aXRoLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgekluZGV4OiA5OTgsXG5cbiAgLyoqXG4gICAqIFNjYWxlICh6b29tIGluKSB0byBnaXZlbiB3aWR0aCBhbmQgaGVpZ2h0LiBJZ25vcmUgc2NhbGVCYXNlIGlmIHNldC5cbiAgICogQHR5cGUge09iamVjdH1cbiAgICogQGV4YW1wbGVcbiAgICogY3VzdG9tU2l6ZTogeyB3aWR0aDogODAwLCBoZWlnaHQ6IDQwMCB9XG4gICAqL1xuICBjdXN0b21TaXplOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBvcGVuZWQgYW5kXG4gICAqIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbk9wZW46IG51bGwsXG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIGNsb3NlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25DbG9zZTogbnVsbCxcblxuICAvKipcbiAgICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIGdyYWJiZWQuXG4gICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgKi9cbiAgb25HcmFiOiBudWxsLFxuXG4gIC8qKlxuICAgICogU2FtZSBhcyBhYm92ZSwgZXhjZXB0IGZpcmVkIHdoZW4gbW92ZWQuXG4gICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgKi9cbiAgb25Nb3ZlOiBudWxsLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiByZWxlYXNlZC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25SZWxlYXNlOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIG9wZW4uXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlT3BlbjogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBjbG9zZS5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVDbG9zZTogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBncmFiLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZUdyYWI6IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgcmVsZWFzZS5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVSZWxlYXNlOiBudWxsXG59XG4iLCJpbXBvcnQgeyBiaW5kQWxsIH0gZnJvbSAnLi4vdXRpbHMnXG5cbmNvbnN0IFBSRVNTX0RFTEFZID0gMjAwXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdChpbnN0YW5jZSkge1xuICAgIGJpbmRBbGwodGhpcywgaW5zdGFuY2UpXG4gIH0sXG5cbiAgY2xpY2soZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgaWYgKGlzUHJlc3NpbmdNZXRhS2V5KGUpKSB7XG4gICAgICByZXR1cm4gd2luZG93Lm9wZW4oXG4gICAgICAgIHRoaXMudGFyZ2V0LnNyY09yaWdpbmFsIHx8IGUuY3VycmVudFRhcmdldC5zcmMsXG4gICAgICAgICdfYmxhbmsnXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLnNob3duKSB7XG4gICAgICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yZWxlYXNlKClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vcGVuKGUuY3VycmVudFRhcmdldClcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc2Nyb2xsKCkge1xuICAgIGNvbnN0IGVsID1cbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCB8fCBkb2N1bWVudC5ib2R5LnBhcmVudE5vZGUgfHwgZG9jdW1lbnQuYm9keVxuICAgIGNvbnN0IHNjcm9sbExlZnQgPSB3aW5kb3cucGFnZVhPZmZzZXQgfHwgZWwuc2Nyb2xsTGVmdFxuICAgIGNvbnN0IHNjcm9sbFRvcCA9IHdpbmRvdy5wYWdlWU9mZnNldCB8fCBlbC5zY3JvbGxUb3BcblxuICAgIGlmICh0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSB7XG4gICAgICAgIHg6IHNjcm9sbExlZnQsXG4gICAgICAgIHk6IHNjcm9sbFRvcFxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGRlbHRhWCA9IHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uLnggLSBzY3JvbGxMZWZ0XG4gICAgY29uc3QgZGVsdGFZID0gdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24ueSAtIHNjcm9sbFRvcFxuICAgIGNvbnN0IHRocmVzaG9sZCA9IHRoaXMub3B0aW9ucy5zY3JvbGxUaHJlc2hvbGRcblxuICAgIGlmIChNYXRoLmFicyhkZWx0YVkpID49IHRocmVzaG9sZCB8fCBNYXRoLmFicyhkZWx0YVgpID49IHRocmVzaG9sZCkge1xuICAgICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9XG4gIH0sXG5cbiAga2V5ZG93bihlKSB7XG4gICAgaWYgKGlzRXNjYXBlKGUpKSB7XG4gICAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgICB0aGlzLmNsb3NlKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucmVsZWFzZSh0aGlzLmNsb3NlKVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBtb3VzZWRvd24oZSkge1xuICAgIGlmICghaXNMZWZ0QnV0dG9uKGUpIHx8IGlzUHJlc3NpbmdNZXRhS2V5KGUpKSByZXR1cm5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGVcblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoXG4gICAgICBmdW5jdGlvbiBncmFiT25Nb3VzZURvd24oKSB7XG4gICAgICAgIHRoaXMuZ3JhYihjbGllbnRYLCBjbGllbnRZKVxuICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgUFJFU1NfREVMQVlcbiAgICApXG4gIH0sXG5cbiAgbW91c2Vtb3ZlKGUpIHtcbiAgICBpZiAodGhpcy5yZWxlYXNlZCkgcmV0dXJuXG4gICAgdGhpcy5tb3ZlKGUuY2xpZW50WCwgZS5jbGllbnRZKVxuICB9LFxuXG4gIG1vdXNldXAoZSkge1xuICAgIGlmICghaXNMZWZ0QnV0dG9uKGUpIHx8IGlzUHJlc3NpbmdNZXRhS2V5KGUpKSByZXR1cm5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5wcmVzc1RpbWVyKVxuXG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlbGVhc2UoKVxuICAgIH1cbiAgfSxcblxuICB0b3VjaHN0YXJ0KGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGUudG91Y2hlc1swXVxuXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gc2V0VGltZW91dChcbiAgICAgIGZ1bmN0aW9uIGdyYWJPblRvdWNoU3RhcnQoKSB7XG4gICAgICAgIHRoaXMuZ3JhYihjbGllbnRYLCBjbGllbnRZKVxuICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgUFJFU1NfREVMQVlcbiAgICApXG4gIH0sXG5cbiAgdG91Y2htb3ZlKGUpIHtcbiAgICBpZiAodGhpcy5yZWxlYXNlZCkgcmV0dXJuXG5cbiAgICBjb25zdCB7IGNsaWVudFgsIGNsaWVudFkgfSA9IGUudG91Y2hlc1swXVxuICAgIHRoaXMubW92ZShjbGllbnRYLCBjbGllbnRZKVxuICB9LFxuXG4gIHRvdWNoZW5kKGUpIHtcbiAgICBpZiAoaXNUb3VjaGluZyhlKSkgcmV0dXJuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucHJlc3NUaW1lcilcblxuICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZWxlYXNlKClcbiAgICB9XG4gIH0sXG5cbiAgY2xpY2tPdmVybGF5KCkge1xuICAgIHRoaXMuY2xvc2UoKVxuICB9LFxuXG4gIHJlc2l6ZVdpbmRvdygpIHtcbiAgICB0aGlzLmNsb3NlKClcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0xlZnRCdXR0b24oZSkge1xuICByZXR1cm4gZS5idXR0b24gPT09IDBcbn1cblxuZnVuY3Rpb24gaXNQcmVzc2luZ01ldGFLZXkoZSkge1xuICByZXR1cm4gZS5tZXRhS2V5IHx8IGUuY3RybEtleVxufVxuXG5mdW5jdGlvbiBpc1RvdWNoaW5nKGUpIHtcbiAgZS50YXJnZXRUb3VjaGVzLmxlbmd0aCA+IDBcbn1cblxuZnVuY3Rpb24gaXNFc2NhcGUoZSkge1xuICBjb25zdCBjb2RlID0gZS5rZXkgfHwgZS5jb2RlXG4gIHJldHVybiBjb2RlID09PSAnRXNjYXBlJyB8fCBlLmtleUNvZGUgPT09IDI3XG59XG4iLCJpbXBvcnQgeyBsaXN0ZW4sIHNldFN0eWxlIH0gZnJvbSAnLi4vdXRpbHMnXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdChpbnN0YW5jZSkge1xuICAgIHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgIHRoaXMuaW5zdGFuY2UgPSBpbnN0YW5jZVxuICAgIHRoaXMucGFyZW50ID0gZG9jdW1lbnQuYm9keVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICB0b3A6IDAsXG4gICAgICBsZWZ0OiAwLFxuICAgICAgcmlnaHQ6IDAsXG4gICAgICBib3R0b206IDAsXG4gICAgICBvcGFjaXR5OiAwXG4gICAgfSlcblxuICAgIHRoaXMudXBkYXRlU3R5bGUoaW5zdGFuY2Uub3B0aW9ucylcbiAgICBsaXN0ZW4odGhpcy5lbCwgJ2NsaWNrJywgaW5zdGFuY2UuaGFuZGxlci5jbGlja092ZXJsYXkuYmluZChpbnN0YW5jZSkpXG4gIH0sXG5cbiAgdXBkYXRlU3R5bGUob3B0aW9ucykge1xuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHpJbmRleDogb3B0aW9ucy56SW5kZXgsXG4gICAgICBiYWNrZ3JvdW5kQ29sb3I6IG9wdGlvbnMuYmdDb2xvcixcbiAgICAgIHRyYW5zaXRpb246IGBvcGFjaXR5XG4gICAgICAgICR7b3B0aW9ucy50cmFuc2l0aW9uRHVyYXRpb259c1xuICAgICAgICAke29wdGlvbnMudHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9ufWBcbiAgICB9KVxuICB9LFxuXG4gIGluc2VydCgpIHtcbiAgICB0aGlzLnBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLmVsKVxuICB9LFxuXG4gIHJlbW92ZSgpIHtcbiAgICB0aGlzLnBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLmVsKVxuICB9LFxuXG4gIGZhZGVJbigpIHtcbiAgICB0aGlzLmVsLm9mZnNldFdpZHRoXG4gICAgdGhpcy5lbC5zdHlsZS5vcGFjaXR5ID0gdGhpcy5pbnN0YW5jZS5vcHRpb25zLmJnT3BhY2l0eVxuICB9LFxuXG4gIGZhZGVPdXQoKSB7XG4gICAgdGhpcy5lbC5zdHlsZS5vcGFjaXR5ID0gMFxuICB9XG59XG4iLCJpbXBvcnQgeyBjdXJzb3IsIHNldFN0eWxlLCBnZXRPcmlnaW5hbFNvdXJjZSwgdHJhbnNmb3JtQ3NzUHJvcCB9IGZyb20gJy4uL3V0aWxzJ1xuXG4vLyBUcmFuc2xhdGUgei1heGlzIHRvIGZpeCBDU1MgZ3JpZCBkaXNwbGF5IGlzc3VlIGluIENocm9tZTpcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9raW5nZGlkbzk5OS96b29taW5nL2lzc3Vlcy80MlxuY29uc3QgVFJBTlNMQVRFX1ogPSAwXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgaW5pdCAoZWwsIGluc3RhbmNlKSB7XG4gICAgdGhpcy5lbCA9IGVsXG4gICAgdGhpcy5pbnN0YW5jZSA9IGluc3RhbmNlXG4gICAgdGhpcy5zcmNUaHVtYm5haWwgPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnc3JjJylcbiAgICB0aGlzLnNyY09yaWdpbmFsID0gZ2V0T3JpZ2luYWxTb3VyY2UodGhpcy5lbClcbiAgICB0aGlzLnJlY3QgPSB0aGlzLmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG4gICAgdGhpcy50cmFuc2xhdGUgPSBudWxsXG4gICAgdGhpcy5zY2FsZSA9IG51bGxcbiAgICB0aGlzLnN0eWxlT3BlbiA9IG51bGxcbiAgICB0aGlzLnN0eWxlQ2xvc2UgPSBudWxsXG4gIH0sXG5cbiAgem9vbUluICgpIHtcbiAgICBjb25zdCB7XG4gICAgICB6SW5kZXgsXG4gICAgICBlbmFibGVHcmFiLFxuICAgICAgdHJhbnNpdGlvbkR1cmF0aW9uLFxuICAgICAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uXG4gICAgfSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9uc1xuICAgIHRoaXMudHJhbnNsYXRlID0gdGhpcy5jYWxjdWxhdGVUcmFuc2xhdGUoKVxuICAgIHRoaXMuc2NhbGUgPSB0aGlzLmNhbGN1bGF0ZVNjYWxlKClcblxuICAgIHRoaXMuc3R5bGVPcGVuID0ge1xuICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgICB6SW5kZXg6IHpJbmRleCArIDEsXG4gICAgICBjdXJzb3I6IGVuYWJsZUdyYWIgPyBjdXJzb3IuZ3JhYiA6IGN1cnNvci56b29tT3V0LFxuICAgICAgdHJhbnNpdGlvbjogYCR7dHJhbnNmb3JtQ3NzUHJvcH1cbiAgICAgICAgJHt0cmFuc2l0aW9uRHVyYXRpb259c1xuICAgICAgICAke3RyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gLFxuICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoJHt0aGlzLnRyYW5zbGF0ZS54fXB4LCAke3RoaXMudHJhbnNsYXRlLnl9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54fSwke3RoaXMuc2NhbGUueX0pYCxcbiAgICAgIGhlaWdodDogYCR7dGhpcy5yZWN0LmhlaWdodH1weGAsXG4gICAgICB3aWR0aDogYCR7dGhpcy5yZWN0LndpZHRofXB4YFxuICAgIH1cblxuICAgIC8vIEZvcmNlIGxheW91dCB1cGRhdGVcbiAgICB0aGlzLmVsLm9mZnNldFdpZHRoXG5cbiAgICAvLyBUcmlnZ2VyIHRyYW5zaXRpb25cbiAgICB0aGlzLnN0eWxlQ2xvc2UgPSBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlT3BlbiwgdHJ1ZSlcbiAgfSxcblxuICB6b29tT3V0ICgpIHtcbiAgICAvLyBGb3JjZSBsYXlvdXQgdXBkYXRlXG4gICAgdGhpcy5lbC5vZmZzZXRXaWR0aFxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwgeyB0cmFuc2Zvcm06ICdub25lJyB9KVxuICB9LFxuXG4gIGdyYWIgKHgsIHksIHNjYWxlRXh0cmEpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IFtkeCwgZHldID0gW3dpbmRvd0NlbnRlci54IC0geCwgd2luZG93Q2VudGVyLnkgLSB5XVxuXG4gICAgc2V0U3R5bGUodGhpcy5lbCwge1xuICAgICAgY3Vyc29yOiBjdXJzb3IubW92ZSxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZTNkKFxuICAgICAgICAke3RoaXMudHJhbnNsYXRlLnggKyBkeH1weCwgJHt0aGlzLnRyYW5zbGF0ZS55ICsgZHl9cHgsICR7VFJBTlNMQVRFX1p9cHgpXG4gICAgICAgIHNjYWxlKCR7dGhpcy5zY2FsZS54ICsgc2NhbGVFeHRyYX0sJHt0aGlzLnNjYWxlLnkgKyBzY2FsZUV4dHJhfSlgXG4gICAgfSlcbiAgfSxcblxuICBtb3ZlICh4LCB5LCBzY2FsZUV4dHJhKSB7XG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcbiAgICBjb25zdCBbZHgsIGR5XSA9IFt3aW5kb3dDZW50ZXIueCAtIHgsIHdpbmRvd0NlbnRlci55IC0geV1cblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHRyYW5zaXRpb246IHRyYW5zZm9ybUNzc1Byb3AsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUzZChcbiAgICAgICAgJHt0aGlzLnRyYW5zbGF0ZS54ICsgZHh9cHgsICR7dGhpcy50cmFuc2xhdGUueSArIGR5fXB4LCAke1RSQU5TTEFURV9afXB4KVxuICAgICAgICBzY2FsZSgke3RoaXMuc2NhbGUueCArIHNjYWxlRXh0cmF9LCR7dGhpcy5zY2FsZS55ICsgc2NhbGVFeHRyYX0pYFxuICAgIH0pXG4gIH0sXG5cbiAgcmVzdG9yZUNsb3NlU3R5bGUgKCkge1xuICAgIHNldFN0eWxlKHRoaXMuZWwsIHRoaXMuc3R5bGVDbG9zZSlcbiAgfSxcblxuICByZXN0b3JlT3BlblN0eWxlICgpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlT3BlbilcbiAgfSxcblxuICB1cGdyYWRlU291cmNlICgpIHtcbiAgICBpZiAodGhpcy5zcmNPcmlnaW5hbCkge1xuICAgICAgY29uc3QgcGFyZW50Tm9kZSA9IHRoaXMuZWwucGFyZW50Tm9kZVxuICAgICAgY29uc3QgdGVtcCA9IHRoaXMuZWwuY2xvbmVOb2RlKGZhbHNlKVxuXG4gICAgICAvLyBGb3JjZSBjb21wdXRlIHRoZSBoaS1yZXMgaW1hZ2UgaW4gRE9NIHRvIHByZXZlbnRcbiAgICAgIC8vIGltYWdlIGZsaWNrZXJpbmcgd2hpbGUgdXBkYXRpbmcgc3JjXG4gICAgICB0ZW1wLnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNPcmlnaW5hbClcbiAgICAgIHRlbXAuc3R5bGUucG9zaXRpb24gPSAnZml4ZWQnXG4gICAgICB0ZW1wLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJ1xuICAgICAgcGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0ZW1wKVxuXG4gICAgICAvLyBBZGQgZGVsYXkgdG8gcHJldmVudCBGaXJlZm94IGZyb20gZmxpY2tlcmluZ1xuICAgICAgc2V0VGltZW91dChcbiAgICAgICAgZnVuY3Rpb24gdXBkYXRlU3JjICgpIHtcbiAgICAgICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSgnc3JjJywgdGhpcy5zcmNPcmlnaW5hbClcbiAgICAgICAgICBwYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRlbXApXG4gICAgICAgIH0uYmluZCh0aGlzKSxcbiAgICAgICAgNTBcbiAgICAgIClcbiAgICB9XG4gIH0sXG5cbiAgZG93bmdyYWRlU291cmNlICgpIHtcbiAgICBpZiAodGhpcy5zcmNPcmlnaW5hbCkge1xuICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjVGh1bWJuYWlsKVxuICAgIH1cbiAgfSxcblxuICBjYWxjdWxhdGVUcmFuc2xhdGUgKCkge1xuICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG4gICAgY29uc3QgdGFyZ2V0Q2VudGVyID0ge1xuICAgICAgeDogdGhpcy5yZWN0LmxlZnQgKyB0aGlzLnJlY3Qud2lkdGggLyAyLFxuICAgICAgeTogdGhpcy5yZWN0LnRvcCArIHRoaXMucmVjdC5oZWlnaHQgLyAyXG4gICAgfVxuXG4gICAgLy8gVGhlIHZlY3RvciB0byB0cmFuc2xhdGUgaW1hZ2UgdG8gdGhlIHdpbmRvdyBjZW50ZXJcbiAgICByZXR1cm4ge1xuICAgICAgeDogd2luZG93Q2VudGVyLnggLSB0YXJnZXRDZW50ZXIueCxcbiAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gdGFyZ2V0Q2VudGVyLnlcbiAgICB9XG4gIH0sXG5cbiAgY2FsY3VsYXRlU2NhbGUgKCkge1xuICAgIGNvbnN0IHsgem9vbWluZ0hlaWdodCwgem9vbWluZ1dpZHRoIH0gPSB0aGlzLmVsLmRhdGFzZXRcbiAgICBjb25zdCB7IGN1c3RvbVNpemUsIHNjYWxlQmFzZSB9ID0gdGhpcy5pbnN0YW5jZS5vcHRpb25zXG5cbiAgICBpZiAoem9vbWluZ0hlaWdodCAmJiB6b29taW5nV2lkdGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IHpvb21pbmdXaWR0aCAvIHRoaXMucmVjdC53aWR0aCxcbiAgICAgICAgeTogem9vbWluZ0hlaWdodCAvIHRoaXMucmVjdC5oZWlnaHRcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGN1c3RvbVNpemUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IGN1c3RvbVNpemUud2lkdGggLyB0aGlzLnJlY3Qud2lkdGgsXG4gICAgICAgIHk6IGN1c3RvbVNpemUuaGVpZ2h0IC8gdGhpcy5yZWN0LmhlaWdodFxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0YXJnZXRIYWxmV2lkdGggPSB0aGlzLnJlY3Qud2lkdGggLyAyXG4gICAgICBjb25zdCB0YXJnZXRIYWxmSGVpZ2h0ID0gdGhpcy5yZWN0LmhlaWdodCAvIDJcbiAgICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG5cbiAgICAgIC8vIFRoZSBkaXN0YW5jZSBiZXR3ZWVuIHRhcmdldCBlZGdlIGFuZCB3aW5kb3cgZWRnZVxuICAgICAgY29uc3QgdGFyZ2V0RWRnZVRvV2luZG93RWRnZSA9IHtcbiAgICAgICAgeDogd2luZG93Q2VudGVyLnggLSB0YXJnZXRIYWxmV2lkdGgsXG4gICAgICAgIHk6IHdpbmRvd0NlbnRlci55IC0gdGFyZ2V0SGFsZkhlaWdodFxuICAgICAgfVxuXG4gICAgICBjb25zdCBzY2FsZUhvcml6b250YWxseSA9IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UueCAvIHRhcmdldEhhbGZXaWR0aFxuICAgICAgY29uc3Qgc2NhbGVWZXJ0aWNhbGx5ID0gdGFyZ2V0RWRnZVRvV2luZG93RWRnZS55IC8gdGFyZ2V0SGFsZkhlaWdodFxuXG4gICAgICAvLyBUaGUgYWRkaXRpb25hbCBzY2FsZSBpcyBiYXNlZCBvbiB0aGUgc21hbGxlciB2YWx1ZSBvZlxuICAgICAgLy8gc2NhbGluZyBob3Jpem9udGFsbHkgYW5kIHNjYWxpbmcgdmVydGljYWxseVxuICAgICAgY29uc3Qgc2NhbGUgPSBzY2FsZUJhc2UgKyBNYXRoLm1pbihzY2FsZUhvcml6b250YWxseSwgc2NhbGVWZXJ0aWNhbGx5KVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiBzY2FsZSxcbiAgICAgICAgeTogc2NhbGVcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0V2luZG93Q2VudGVyICgpIHtcbiAgY29uc3QgZG9jRWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcbiAgY29uc3Qgd2luZG93V2lkdGggPSBNYXRoLm1pbihkb2NFbC5jbGllbnRXaWR0aCwgd2luZG93LmlubmVyV2lkdGgpXG4gIGNvbnN0IHdpbmRvd0hlaWdodCA9IE1hdGgubWluKGRvY0VsLmNsaWVudEhlaWdodCwgd2luZG93LmlubmVySGVpZ2h0KVxuXG4gIHJldHVybiB7XG4gICAgeDogd2luZG93V2lkdGggLyAyLFxuICAgIHk6IHdpbmRvd0hlaWdodCAvIDJcbiAgfVxufVxuIiwiaW1wb3J0IHtcbiAgY3Vyc29yLFxuICBsaXN0ZW4sXG4gIGxvYWRJbWFnZSxcbiAgdHJhbnNFbmRFdmVudCxcbiAgZ2V0T3JpZ2luYWxTb3VyY2Vcbn0gZnJvbSAnLi4vdXRpbHMnXG5pbXBvcnQgREVGQVVMVF9PUFRJT05TIGZyb20gJy4uL29wdGlvbnMnXG5cbmltcG9ydCBoYW5kbGVyIGZyb20gJy4vaGFuZGxlcidcbmltcG9ydCBvdmVybGF5IGZyb20gJy4vb3ZlcmxheSdcbmltcG9ydCB0YXJnZXQgZnJvbSAnLi90YXJnZXQnXG5cbi8qKlxuICogWm9vbWluZyBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWm9vbWluZyB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFVwZGF0ZSBkZWZhdWx0IG9wdGlvbnMgaWYgcHJvdmlkZWQuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy50YXJnZXQgPSBPYmplY3QuY3JlYXRlKHRhcmdldClcbiAgICB0aGlzLm92ZXJsYXkgPSBPYmplY3QuY3JlYXRlKG92ZXJsYXkpXG4gICAgdGhpcy5oYW5kbGVyID0gT2JqZWN0LmNyZWF0ZShoYW5kbGVyKVxuICAgIHRoaXMuYm9keSA9IGRvY3VtZW50LmJvZHlcblxuICAgIHRoaXMuc2hvd24gPSBmYWxzZVxuICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgdGhpcy5yZWxlYXNlZCA9IHRydWVcbiAgICB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbiA9IG51bGxcbiAgICB0aGlzLnByZXNzVGltZXIgPSBudWxsXG5cbiAgICB0aGlzLm9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX09QVElPTlMsIG9wdGlvbnMpXG4gICAgdGhpcy5vdmVybGF5LmluaXQodGhpcylcbiAgICB0aGlzLmhhbmRsZXIuaW5pdCh0aGlzKVxuICAgIHRoaXMubGlzdGVuKHRoaXMub3B0aW9ucy5kZWZhdWx0Wm9vbWFibGUpXG4gIH1cblxuICAvKipcbiAgICogTWFrZSBlbGVtZW50KHMpIHpvb21hYmxlLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd8RWxlbWVudH0gZWwgQSBjc3Mgc2VsZWN0b3Igb3IgYW4gRWxlbWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGxpc3RlbihlbCkge1xuICAgIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCBlbHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGVsKVxuICAgICAgbGV0IGkgPSBlbHMubGVuZ3RoXG5cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5saXN0ZW4oZWxzW2ldKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWwudGFnTmFtZSA9PT0gJ0lNRycpIHtcbiAgICAgIGVsLnN0eWxlLmN1cnNvciA9IGN1cnNvci56b29tSW5cbiAgICAgIGxpc3RlbihlbCwgJ2NsaWNrJywgdGhpcy5oYW5kbGVyLmNsaWNrKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnByZWxvYWRJbWFnZSkge1xuICAgICAgICBsb2FkSW1hZ2UoZ2V0T3JpZ2luYWxTb3VyY2UoZWwpKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIG9wdGlvbnMgb3IgcmV0dXJuIGN1cnJlbnQgb3B0aW9ucyBpZiBubyBhcmd1bWVudCBpcyBwcm92aWRlZC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zIEFuIE9iamVjdCB0aGF0IGNvbnRhaW5zIHRoaXMub3B0aW9ucy5cbiAgICogQHJldHVybiB7dGhpc3x0aGlzLm9wdGlvbnN9XG4gICAqL1xuICBjb25maWcob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMub3B0aW9ucywgb3B0aW9ucylcbiAgICAgIHRoaXMub3ZlcmxheS51cGRhdGVTdHlsZSh0aGlzLm9wdGlvbnMpXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE9wZW4gKHpvb20gaW4pIHRoZSBFbGVtZW50LlxuICAgKiBAcGFyYW0gIHtFbGVtZW50fSBlbCBUaGUgRWxlbWVudCB0byBvcGVuLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbk9wZW5dIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsXG4gICAqIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG9wZW5lZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0IHdpbGwgZ2V0XG4gICAqIHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBvcGVuKGVsLCBjYiA9IHRoaXMub3B0aW9ucy5vbk9wZW4pIHtcbiAgICBpZiAodGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdHlwZW9mIGVsID09PSAnc3RyaW5nJyA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpIDogZWxcblxuICAgIGlmICh0YXJnZXQudGFnTmFtZSAhPT0gJ0lNRycpIHJldHVyblxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4pIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZU9wZW4odGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMudGFyZ2V0LmluaXQodGFyZ2V0LCB0aGlzKVxuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMucHJlbG9hZEltYWdlKSB7XG4gICAgICBsb2FkSW1hZ2UodGhpcy50YXJnZXQuc3JjT3JpZ2luYWwpXG4gICAgfVxuXG4gICAgdGhpcy5zaG93biA9IHRydWVcbiAgICB0aGlzLmxvY2sgPSB0cnVlXG5cbiAgICB0aGlzLnRhcmdldC56b29tSW4oKVxuICAgIHRoaXMub3ZlcmxheS5pbnNlcnQoKVxuICAgIHRoaXMub3ZlcmxheS5mYWRlSW4oKVxuXG4gICAgbGlzdGVuKGRvY3VtZW50LCAnc2Nyb2xsJywgdGhpcy5oYW5kbGVyLnNjcm9sbClcbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5oYW5kbGVyLmtleWRvd24pXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmNsb3NlT25XaW5kb3dSZXNpemUpIHtcbiAgICAgIGxpc3Rlbih3aW5kb3csICdyZXNpemUnLCB0aGlzLmhhbmRsZXIucmVzaXplV2luZG93KVxuICAgIH1cblxuICAgIGNvbnN0IG9uT3BlbkVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uT3BlbkVuZCwgZmFsc2UpXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgICAgdGhpcy50YXJnZXQudXBncmFkZVNvdXJjZSgpXG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgICB0b2dnbGVHcmFiTGlzdGVuZXJzKGRvY3VtZW50LCB0aGlzLmhhbmRsZXIsIHRydWUpXG4gICAgICB9XG5cbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uT3BlbkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogQ2xvc2UgKHpvb20gb3V0KSB0aGUgRWxlbWVudCBjdXJyZW50bHkgb3BlbmVkLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbkNsb3NlXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbFxuICAgKiBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBjbG9zZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldFxuICAgKiB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgY2xvc2UoY2IgPSB0aGlzLm9wdGlvbnMub25DbG9zZSkge1xuICAgIGlmICghdGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQuZWxcblxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVDbG9zZSkge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMubG9jayA9IHRydWVcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLmRlZmF1bHRcbiAgICB0aGlzLm92ZXJsYXkuZmFkZU91dCgpXG4gICAgdGhpcy50YXJnZXQuem9vbU91dCgpXG5cbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdzY3JvbGwnLCB0aGlzLmhhbmRsZXIuc2Nyb2xsLCBmYWxzZSlcbiAgICBsaXN0ZW4oZG9jdW1lbnQsICdrZXlkb3duJywgdGhpcy5oYW5kbGVyLmtleWRvd24sIGZhbHNlKVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uV2luZG93UmVzaXplKSB7XG4gICAgICBsaXN0ZW4od2luZG93LCAncmVzaXplJywgdGhpcy5oYW5kbGVyLnJlc2l6ZVdpbmRvdywgZmFsc2UpXG4gICAgfVxuXG4gICAgY29uc3Qgb25DbG9zZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uQ2xvc2VFbmQsIGZhbHNlKVxuXG4gICAgICB0aGlzLnNob3duID0gZmFsc2VcbiAgICAgIHRoaXMubG9jayA9IGZhbHNlXG5cbiAgICAgIHRoaXMudGFyZ2V0LmRvd25ncmFkZVNvdXJjZSgpXG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlR3JhYikge1xuICAgICAgICB0b2dnbGVHcmFiTGlzdGVuZXJzKGRvY3VtZW50LCB0aGlzLmhhbmRsZXIsIGZhbHNlKVxuICAgICAgfVxuXG4gICAgICB0aGlzLnRhcmdldC5yZXN0b3JlQ2xvc2VTdHlsZSgpXG4gICAgICB0aGlzLm92ZXJsYXkucmVtb3ZlKClcblxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25DbG9zZUVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogR3JhYiB0aGUgRWxlbWVudCBjdXJyZW50bHkgb3BlbmVkIGdpdmVuIGEgcG9zaXRpb24gYW5kIGFwcGx5IGV4dHJhIHpvb20taW4uXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB4IFRoZSBYLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeSBUaGUgWS1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHNjYWxlRXh0cmEgRXh0cmEgem9vbS1pbiB0byBhcHBseS5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25HcmFiXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXRcbiAgICogd2lsbCBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBncmFiYmVkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXRcbiAgICogd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGdyYWIoeCwgeSwgc2NhbGVFeHRyYSA9IHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhLCBjYiA9IHRoaXMub3B0aW9ucy5vbkdyYWIpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYikge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlR3JhYih0YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy5yZWxlYXNlZCA9IGZhbHNlXG4gICAgdGhpcy50YXJnZXQuZ3JhYih4LCB5LCBzY2FsZUV4dHJhKVxuXG4gICAgY29uc3Qgb25HcmFiRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25HcmFiRW5kLCBmYWxzZSlcbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uR3JhYkVuZClcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKipcbiAgICogTW92ZSB0aGUgRWxlbWVudCBjdXJyZW50bHkgZ3JhYmJlZCBnaXZlbiBhIHBvc2l0aW9uIGFuZCBhcHBseSBleHRyYSB6b29tLWluLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeCBUaGUgWC1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHkgVGhlIFktYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICBzY2FsZUV4dHJhIEV4dHJhIHpvb20taW4gdG8gYXBwbHkuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uTW92ZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgbW92ZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsXG4gICAqIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgbW92ZSh4LCB5LCBzY2FsZUV4dHJhID0gdGhpcy5vcHRpb25zLnNjYWxlRXh0cmEsIGNiID0gdGhpcy5vcHRpb25zLm9uTW92ZSkge1xuICAgIGlmICghdGhpcy5zaG93biB8fCB0aGlzLmxvY2spIHJldHVyblxuXG4gICAgdGhpcy5yZWxlYXNlZCA9IGZhbHNlXG4gICAgdGhpcy5ib2R5LnN0eWxlLmN1cnNvciA9IGN1cnNvci5tb3ZlXG4gICAgdGhpcy50YXJnZXQubW92ZSh4LCB5LCBzY2FsZUV4dHJhKVxuXG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy50YXJnZXQuZWxcblxuICAgIGNvbnN0IG9uTW92ZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uTW92ZUVuZCwgZmFsc2UpXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk1vdmVFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbGVhc2UgdGhlIEVsZW1lbnQgY3VycmVudGx5IGdyYWJiZWQuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uUmVsZWFzZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgcmVsZWFzZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdFxuICAgKiB3aWxsIGdldCB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgcmVsZWFzZShjYiA9IHRoaXMub3B0aW9ucy5vblJlbGVhc2UpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSkge1xuICAgICAgdGhpcy5vcHRpb25zLm9uQmVmb3JlUmVsZWFzZSh0YXJnZXQpXG4gICAgfVxuXG4gICAgdGhpcy5sb2NrID0gdHJ1ZVxuICAgIHRoaXMuYm9keS5zdHlsZS5jdXJzb3IgPSBjdXJzb3IuZGVmYXVsdFxuICAgIHRoaXMudGFyZ2V0LnJlc3RvcmVPcGVuU3R5bGUoKVxuXG4gICAgY29uc3Qgb25SZWxlYXNlRW5kID0gKCkgPT4ge1xuICAgICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25SZWxlYXNlRW5kLCBmYWxzZSlcbiAgICAgIHRoaXMubG9jayA9IGZhbHNlXG4gICAgICB0aGlzLnJlbGVhc2VkID0gdHJ1ZVxuXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvblJlbGVhc2VFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUdyYWJMaXN0ZW5lcnMoZWwsIGhhbmRsZXIsIGFkZCkge1xuICBjb25zdCB0eXBlcyA9IFtcbiAgICAnbW91c2Vkb3duJyxcbiAgICAnbW91c2Vtb3ZlJyxcbiAgICAnbW91c2V1cCcsXG4gICAgJ3RvdWNoc3RhcnQnLFxuICAgICd0b3VjaG1vdmUnLFxuICAgICd0b3VjaGVuZCdcbiAgXVxuXG4gIHR5cGVzLmZvckVhY2goZnVuY3Rpb24gdG9nZ2xlTGlzdGVuZXIodHlwZSkge1xuICAgIGxpc3RlbihlbCwgdHlwZSwgaGFuZGxlclt0eXBlXSwgYWRkKVxuICB9KVxufVxuIiwiaW1wb3J0IHsgbGlzdGVuIH0gZnJvbSAnLi91dGlscydcbmltcG9ydCBab29taW5nIGZyb20gJy4vbW9kdWxlcy96b29taW5nJ1xuXG5saXN0ZW4oZG9jdW1lbnQsICdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24gaW5pdFpvb21pbmcoKSB7XG4gIG5ldyBab29taW5nKClcbn0pXG5cbmV4cG9ydCBkZWZhdWx0IFpvb21pbmdcbiJdLCJuYW1lcyI6WyJ3ZWJraXRQcmVmaXgiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsInN0eWxlIiwiY3Vyc29yIiwibGlzdGVuIiwiZWwiLCJldmVudCIsImhhbmRsZXIiLCJhZGQiLCJvcHRpb25zIiwicGFzc2l2ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwibG9hZEltYWdlIiwic3JjIiwiY2IiLCJpbWciLCJJbWFnZSIsIm9ubG9hZCIsIm9uSW1hZ2VMb2FkIiwiZ2V0T3JpZ2luYWxTb3VyY2UiLCJkYXRhc2V0Iiwib3JpZ2luYWwiLCJwYXJlbnROb2RlIiwidGFnTmFtZSIsImdldEF0dHJpYnV0ZSIsInNldFN0eWxlIiwic3R5bGVzIiwicmVtZW1iZXIiLCJzIiwia2V5IiwiYmluZEFsbCIsIl90aGlzIiwidGhhdCIsIm1ldGhvZHMiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eU5hbWVzIiwiZ2V0UHJvdG90eXBlT2YiLCJmb3JFYWNoIiwiYmluZE9uZSIsIm1ldGhvZCIsImJpbmQiLCJ0cmFucyIsInNuaWZmVHJhbnNpdGlvbiIsImNyZWF0ZUVsZW1lbnQiLCJ0cmFuc2Zvcm1Dc3NQcm9wIiwidHJhbnNFbmRFdmVudCIsImNoZWNrVHJhbnMiLCJ0cmFuc2l0aW9uUHJvcCIsInRyYW5zZm9ybVByb3AiLCJ0cmFuc2l0aW9uIiwidmFsdWUiLCJ0cmFuc2Zvcm0iLCJyZXMiLCJ0Zm9ybSIsImVuZCIsInNvbWUiLCJoYXNUcmFuc2l0aW9uIiwicHJvcCIsInVuZGVmaW5lZCIsImhhc1RyYW5zZm9ybSIsInJlcGxhY2UiLCJQUkVTU19ERUxBWSIsImluc3RhbmNlIiwiZSIsInByZXZlbnREZWZhdWx0IiwiaXNQcmVzc2luZ01ldGFLZXkiLCJ3aW5kb3ciLCJvcGVuIiwidGFyZ2V0Iiwic3JjT3JpZ2luYWwiLCJjdXJyZW50VGFyZ2V0Iiwic2hvd24iLCJyZWxlYXNlZCIsImNsb3NlIiwicmVsZWFzZSIsImJvZHkiLCJzY3JvbGxMZWZ0IiwicGFnZVhPZmZzZXQiLCJzY3JvbGxUb3AiLCJwYWdlWU9mZnNldCIsImxhc3RTY3JvbGxQb3NpdGlvbiIsImRlbHRhWCIsIngiLCJkZWx0YVkiLCJ5IiwidGhyZXNob2xkIiwic2Nyb2xsVGhyZXNob2xkIiwiTWF0aCIsImFicyIsImlzRXNjYXBlIiwiaXNMZWZ0QnV0dG9uIiwiY2xpZW50WCIsImNsaWVudFkiLCJwcmVzc1RpbWVyIiwic2V0VGltZW91dCIsImdyYWJPbk1vdXNlRG93biIsImdyYWIiLCJtb3ZlIiwidG91Y2hlcyIsImdyYWJPblRvdWNoU3RhcnQiLCJpc1RvdWNoaW5nIiwiYnV0dG9uIiwibWV0YUtleSIsImN0cmxLZXkiLCJ0YXJnZXRUb3VjaGVzIiwibGVuZ3RoIiwiY29kZSIsImtleUNvZGUiLCJwYXJlbnQiLCJ1cGRhdGVTdHlsZSIsImNsaWNrT3ZlcmxheSIsInpJbmRleCIsImJnQ29sb3IiLCJ0cmFuc2l0aW9uRHVyYXRpb24iLCJ0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb24iLCJhcHBlbmRDaGlsZCIsInJlbW92ZUNoaWxkIiwib2Zmc2V0V2lkdGgiLCJvcGFjaXR5IiwiYmdPcGFjaXR5IiwiVFJBTlNMQVRFX1oiLCJzcmNUaHVtYm5haWwiLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwidHJhbnNsYXRlIiwic2NhbGUiLCJzdHlsZU9wZW4iLCJzdHlsZUNsb3NlIiwiZW5hYmxlR3JhYiIsImNhbGN1bGF0ZVRyYW5zbGF0ZSIsImNhbGN1bGF0ZVNjYWxlIiwiem9vbU91dCIsImhlaWdodCIsIndpZHRoIiwic2NhbGVFeHRyYSIsIndpbmRvd0NlbnRlciIsImdldFdpbmRvd0NlbnRlciIsImR4IiwiZHkiLCJ0ZW1wIiwiY2xvbmVOb2RlIiwic2V0QXR0cmlidXRlIiwicG9zaXRpb24iLCJ2aXNpYmlsaXR5IiwidXBkYXRlU3JjIiwidGFyZ2V0Q2VudGVyIiwibGVmdCIsInRvcCIsInpvb21pbmdIZWlnaHQiLCJ6b29taW5nV2lkdGgiLCJjdXN0b21TaXplIiwic2NhbGVCYXNlIiwidGFyZ2V0SGFsZldpZHRoIiwidGFyZ2V0SGFsZkhlaWdodCIsInRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UiLCJzY2FsZUhvcml6b250YWxseSIsInNjYWxlVmVydGljYWxseSIsIm1pbiIsImRvY0VsIiwid2luZG93V2lkdGgiLCJjbGllbnRXaWR0aCIsImlubmVyV2lkdGgiLCJ3aW5kb3dIZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJpbm5lckhlaWdodCIsIlpvb21pbmciLCJjcmVhdGUiLCJvdmVybGF5IiwibG9jayIsImFzc2lnbiIsIkRFRkFVTFRfT1BUSU9OUyIsImluaXQiLCJkZWZhdWx0Wm9vbWFibGUiLCJlbHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiaSIsInpvb21JbiIsImNsaWNrIiwicHJlbG9hZEltYWdlIiwib25PcGVuIiwicXVlcnlTZWxlY3RvciIsIm9uQmVmb3JlT3BlbiIsImluc2VydCIsImZhZGVJbiIsInNjcm9sbCIsImtleWRvd24iLCJjbG9zZU9uV2luZG93UmVzaXplIiwicmVzaXplV2luZG93Iiwib25PcGVuRW5kIiwidXBncmFkZVNvdXJjZSIsIm9uQ2xvc2UiLCJvbkJlZm9yZUNsb3NlIiwiZGVmYXVsdCIsImZhZGVPdXQiLCJvbkNsb3NlRW5kIiwiZG93bmdyYWRlU291cmNlIiwicmVzdG9yZUNsb3NlU3R5bGUiLCJyZW1vdmUiLCJvbkdyYWIiLCJvbkJlZm9yZUdyYWIiLCJvbkdyYWJFbmQiLCJvbk1vdmUiLCJvbk1vdmVFbmQiLCJvblJlbGVhc2UiLCJvbkJlZm9yZVJlbGVhc2UiLCJyZXN0b3JlT3BlblN0eWxlIiwib25SZWxlYXNlRW5kIiwidG9nZ2xlR3JhYkxpc3RlbmVycyIsInR5cGVzIiwidG9nZ2xlTGlzdGVuZXIiLCJ0eXBlIiwiaW5pdFpvb21pbmciXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFPLElBQU1BLGVBQWUsc0JBQXNCQyxTQUFTQyxlQUFULENBQXlCQyxLQUEvQyxHQUN4QixVQUR3QixHQUV4QixFQUZHOztBQUlQLEFBQU8sSUFBTUMsU0FBUztXQUNYLE1BRFc7VUFFVEosWUFBWCxZQUZvQjtXQUdSQSxZQUFaLGFBSG9CO1FBSVhBLFlBQVQsU0FKb0I7UUFLZDtDQUxEOztBQVFQLEFBQU8sU0FBU0ssTUFBVCxDQUFpQkMsRUFBakIsRUFBcUJDLEtBQXJCLEVBQTRCQyxPQUE1QixFQUFpRDtNQUFaQyxHQUFZLHVFQUFOLElBQU07O01BQ2hEQyxVQUFVLEVBQUVDLFNBQVMsS0FBWCxFQUFoQjs7TUFFSUYsR0FBSixFQUFTO09BQ0pHLGdCQUFILENBQW9CTCxLQUFwQixFQUEyQkMsT0FBM0IsRUFBb0NFLE9BQXBDO0dBREYsTUFFTztPQUNGRyxtQkFBSCxDQUF1Qk4sS0FBdkIsRUFBOEJDLE9BQTlCLEVBQXVDRSxPQUF2Qzs7OztBQUlKLEFBQU8sU0FBU0ksU0FBVCxDQUFvQkMsR0FBcEIsRUFBeUJDLEVBQXpCLEVBQTZCO01BQzlCRCxHQUFKLEVBQVM7UUFDREUsTUFBTSxJQUFJQyxLQUFKLEVBQVo7O1FBRUlDLE1BQUosR0FBYSxTQUFTQyxXQUFULEdBQXdCO1VBQy9CSixFQUFKLEVBQVFBLEdBQUdD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
