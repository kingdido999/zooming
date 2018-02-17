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

export default Zooming;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9vbWluZy5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlscy5qcyIsIi4uL3NyYy9vcHRpb25zLmpzIiwiLi4vc3JjL21vZHVsZXMvaGFuZGxlci5qcyIsIi4uL3NyYy9tb2R1bGVzL292ZXJsYXkuanMiLCIuLi9zcmMvbW9kdWxlcy90YXJnZXQuanMiLCIuLi9zcmMvbW9kdWxlcy96b29taW5nLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCB3ZWJraXRQcmVmaXggPSAnV2Via2l0QXBwZWFyYW5jZScgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlXG4gID8gJy13ZWJraXQtJ1xuICA6ICcnXG5cbmV4cG9ydCBjb25zdCBjdXJzb3IgPSB7XG4gIGRlZmF1bHQ6ICdhdXRvJyxcbiAgem9vbUluOiBgJHt3ZWJraXRQcmVmaXh9em9vbS1pbmAsXG4gIHpvb21PdXQ6IGAke3dlYmtpdFByZWZpeH16b29tLW91dGAsXG4gIGdyYWI6IGAke3dlYmtpdFByZWZpeH1ncmFiYCxcbiAgbW92ZTogJ21vdmUnXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0ZW4gKGVsLCBldmVudCwgaGFuZGxlciwgYWRkID0gdHJ1ZSkge1xuICBjb25zdCBvcHRpb25zID0geyBwYXNzaXZlOiBmYWxzZSB9XG5cbiAgaWYgKGFkZCkge1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMpXG4gIH0gZWxzZSB7XG4gICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgaGFuZGxlciwgb3B0aW9ucylcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9hZEltYWdlIChzcmMsIGNiKSB7XG4gIGlmIChzcmMpIHtcbiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKVxuXG4gICAgaW1nLm9ubG9hZCA9IGZ1bmN0aW9uIG9uSW1hZ2VMb2FkICgpIHtcbiAgICAgIGlmIChjYikgY2IoaW1nKVxuICAgIH1cblxuICAgIGltZy5zcmMgPSBzcmNcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3JpZ2luYWxTb3VyY2UgKGVsKSB7XG4gIGlmIChlbC5kYXRhc2V0Lm9yaWdpbmFsKSB7XG4gICAgcmV0dXJuIGVsLmRhdGFzZXQub3JpZ2luYWxcbiAgfSBlbHNlIGlmIChlbC5wYXJlbnROb2RlLnRhZ05hbWUgPT09ICdBJykge1xuICAgIHJldHVybiBlbC5wYXJlbnROb2RlLmdldEF0dHJpYnV0ZSgnaHJlZicpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0U3R5bGUgKGVsLCBzdHlsZXMsIHJlbWVtYmVyKSB7XG4gIGNoZWNrVHJhbnMoc3R5bGVzKVxuXG4gIGxldCBzID0gZWwuc3R5bGVcbiAgbGV0IG9yaWdpbmFsID0ge31cblxuICBmb3IgKGxldCBrZXkgaW4gc3R5bGVzKSB7XG4gICAgaWYgKHJlbWVtYmVyKSB7XG4gICAgICBvcmlnaW5hbFtrZXldID0gc1trZXldIHx8ICcnXG4gICAgfVxuXG4gICAgc1trZXldID0gc3R5bGVzW2tleV1cbiAgfVxuXG4gIHJldHVybiBvcmlnaW5hbFxufVxuXG5leHBvcnQgZnVuY3Rpb24gYmluZEFsbCAoX3RoaXMsIHRoYXQpIHtcbiAgY29uc3QgbWV0aG9kcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKE9iamVjdC5nZXRQcm90b3R5cGVPZihfdGhpcykpXG4gIG1ldGhvZHMuZm9yRWFjaChmdW5jdGlvbiBiaW5kT25lIChtZXRob2QpIHtcbiAgICBfdGhpc1ttZXRob2RdID0gX3RoaXNbbWV0aG9kXS5iaW5kKHRoYXQpXG4gIH0pXG59XG5cbmNvbnN0IHRyYW5zID0gc25pZmZUcmFuc2l0aW9uKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKVxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybUNzc1Byb3AgPSB0cmFucy50cmFuc2Zvcm1Dc3NQcm9wXG5leHBvcnQgY29uc3QgdHJhbnNFbmRFdmVudCA9IHRyYW5zLnRyYW5zRW5kRXZlbnRcblxuZnVuY3Rpb24gY2hlY2tUcmFucyAoc3R5bGVzKSB7XG4gIGNvbnN0IHsgdHJhbnNpdGlvblByb3AsIHRyYW5zZm9ybVByb3AgfSA9IHRyYW5zXG5cbiAgaWYgKHN0eWxlcy50cmFuc2l0aW9uKSB7XG4gICAgY29uc3QgdmFsdWUgPSBzdHlsZXMudHJhbnNpdGlvblxuICAgIGRlbGV0ZSBzdHlsZXMudHJhbnNpdGlvblxuICAgIHN0eWxlc1t0cmFuc2l0aW9uUHJvcF0gPSB2YWx1ZVxuICB9XG5cbiAgaWYgKHN0eWxlcy50cmFuc2Zvcm0pIHtcbiAgICBjb25zdCB2YWx1ZSA9IHN0eWxlcy50cmFuc2Zvcm1cbiAgICBkZWxldGUgc3R5bGVzLnRyYW5zZm9ybVxuICAgIHN0eWxlc1t0cmFuc2Zvcm1Qcm9wXSA9IHZhbHVlXG4gIH1cbn1cblxuZnVuY3Rpb24gc25pZmZUcmFuc2l0aW9uIChlbCkge1xuICBsZXQgcmVzID0ge31cbiAgY29uc3QgdHJhbnMgPSBbJ3dlYmtpdFRyYW5zaXRpb24nLCAndHJhbnNpdGlvbicsICdtb3pUcmFuc2l0aW9uJ11cbiAgY29uc3QgdGZvcm0gPSBbJ3dlYmtpdFRyYW5zZm9ybScsICd0cmFuc2Zvcm0nLCAnbW96VHJhbnNmb3JtJ11cbiAgY29uc3QgZW5kID0ge1xuICAgIHRyYW5zaXRpb246ICd0cmFuc2l0aW9uZW5kJyxcbiAgICBtb3pUcmFuc2l0aW9uOiAndHJhbnNpdGlvbmVuZCcsXG4gICAgd2Via2l0VHJhbnNpdGlvbjogJ3dlYmtpdFRyYW5zaXRpb25FbmQnXG4gIH1cblxuICB0cmFucy5zb21lKGZ1bmN0aW9uIGhhc1RyYW5zaXRpb24gKHByb3ApIHtcbiAgICBpZiAoZWwuc3R5bGVbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVzLnRyYW5zaXRpb25Qcm9wID0gcHJvcFxuICAgICAgcmVzLnRyYW5zRW5kRXZlbnQgPSBlbmRbcHJvcF1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9KVxuXG4gIHRmb3JtLnNvbWUoZnVuY3Rpb24gaGFzVHJhbnNmb3JtIChwcm9wKSB7XG4gICAgaWYgKGVsLnN0eWxlW3Byb3BdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlcy50cmFuc2Zvcm1Qcm9wID0gcHJvcFxuICAgICAgcmVzLnRyYW5zZm9ybUNzc1Byb3AgPSBwcm9wLnJlcGxhY2UoLyguKilUcmFuc2Zvcm0vLCAnLSQxLXRyYW5zZm9ybScpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gcmVzXG59XG4iLCJleHBvcnQgZGVmYXVsdCB7XG4gIC8qKlxuICAgKiBab29tYWJsZSBlbGVtZW50cyBieSBkZWZhdWx0LiBJdCBjYW4gYmUgYSBjc3Mgc2VsZWN0b3Igb3IgYW4gZWxlbWVudC5cbiAgICogQHR5cGUge3N0cmluZ3xFbGVtZW50fVxuICAgKi9cbiAgZGVmYXVsdFpvb21hYmxlOiAnaW1nW2RhdGEtYWN0aW9uPVwiem9vbVwiXScsXG5cbiAgLyoqXG4gICAqIFRvIGJlIGFibGUgdG8gZ3JhYiBhbmQgZHJhZyB0aGUgaW1hZ2UgZm9yIGV4dHJhIHpvb20taW4uXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgZW5hYmxlR3JhYjogdHJ1ZSxcblxuICAvKipcbiAgICogUHJlbG9hZCB6b29tYWJsZSBpbWFnZXMuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgcHJlbG9hZEltYWdlOiBmYWxzZSxcblxuICAvKipcbiAgICogQ2xvc2UgdGhlIHpvb21lZCBpbWFnZSB3aGVuIGJyb3dzZXIgd2luZG93IGlzIHJlc2l6ZWQuXG4gICAqIEB0eXBlIHtib29sZWFufVxuICAgKi9cbiAgY2xvc2VPbldpbmRvd1Jlc2l6ZTogdHJ1ZSxcblxuICAvKipcbiAgICogVHJhbnNpdGlvbiBkdXJhdGlvbiBpbiBzZWNvbmRzLlxuICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgKi9cbiAgdHJhbnNpdGlvbkR1cmF0aW9uOiAwLjQsXG5cbiAgLyoqXG4gICAqIFRyYW5zaXRpb24gdGltaW5nIGZ1bmN0aW9uLlxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uOiAnY3ViaWMtYmV6aWVyKDAuNCwgMCwgMCwgMSknLFxuXG4gIC8qKlxuICAgKiBPdmVybGF5IGJhY2tncm91bmQgY29sb3IuXG4gICAqIEB0eXBlIHtzdHJpbmd9XG4gICAqL1xuICBiZ0NvbG9yOiAncmdiKDI1NSwgMjU1LCAyNTUpJyxcblxuICAvKipcbiAgICogT3ZlcmxheSBiYWNrZ3JvdW5kIG9wYWNpdHkuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBiZ09wYWNpdHk6IDEsXG5cbiAgLyoqXG4gICAqIFRoZSBiYXNlIHNjYWxlIGZhY3RvciBmb3Igem9vbWluZy4gQnkgZGVmYXVsdCBzY2FsZSB0byBmaXQgdGhlIHdpbmRvdy5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHNjYWxlQmFzZTogMS4wLFxuXG4gIC8qKlxuICAgKiBUaGUgYWRkaXRpb25hbCBzY2FsZSBmYWN0b3Igd2hlbiBncmFiYmluZyB0aGUgaW1hZ2UuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY2FsZUV4dHJhOiAwLjUsXG5cbiAgLyoqXG4gICAqIEhvdyBtdWNoIHNjcm9sbGluZyBpdCB0YWtlcyBiZWZvcmUgY2xvc2luZyBvdXQuXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqL1xuICBzY3JvbGxUaHJlc2hvbGQ6IDQwLFxuXG4gIC8qKlxuICAgKiBUaGUgei1pbmRleCB0aGF0IHRoZSBvdmVybGF5IHdpbGwgYmUgYWRkZWQgd2l0aC5cbiAgICogQHR5cGUge251bWJlcn1cbiAgICovXG4gIHpJbmRleDogOTk4LFxuXG4gIC8qKlxuICAgKiBTY2FsZSAoem9vbSBpbikgdG8gZ2l2ZW4gd2lkdGggYW5kIGhlaWdodC4gSWdub3JlIHNjYWxlQmFzZSBpZiBzZXQuXG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqIEBleGFtcGxlXG4gICAqIGN1c3RvbVNpemU6IHsgd2lkdGg6IDgwMCwgaGVpZ2h0OiA0MDAgfVxuICAgKi9cbiAgY3VzdG9tU2l6ZTogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgb3BlbmVkIGFuZFxuICAgKiB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25PcGVuOiBudWxsLFxuXG4gIC8qKlxuICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiBjbG9zZWQuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQ2xvc2U6IG51bGwsXG5cbiAgLyoqXG4gICAgKiBTYW1lIGFzIGFib3ZlLCBleGNlcHQgZmlyZWQgd2hlbiBncmFiYmVkLlxuICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICovXG4gIG9uR3JhYjogbnVsbCxcblxuICAvKipcbiAgICAqIFNhbWUgYXMgYWJvdmUsIGV4Y2VwdCBmaXJlZCB3aGVuIG1vdmVkLlxuICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICovXG4gIG9uTW92ZTogbnVsbCxcblxuICAvKipcbiAgICogU2FtZSBhcyBhYm92ZSwgZXhjZXB0IGZpcmVkIHdoZW4gcmVsZWFzZWQuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uUmVsZWFzZTogbnVsbCxcblxuICAvKipcbiAgICogQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBvcGVuLlxuICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAqL1xuICBvbkJlZm9yZU9wZW46IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgY2xvc2UuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlQ2xvc2U6IG51bGwsXG5cbiAgLyoqXG4gICAqIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgZ3JhYi5cbiAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgKi9cbiAgb25CZWZvcmVHcmFiOiBudWxsLFxuXG4gIC8qKlxuICAgKiBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIHJlbGVhc2UuXG4gICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICovXG4gIG9uQmVmb3JlUmVsZWFzZTogbnVsbFxufVxuIiwiaW1wb3J0IHsgYmluZEFsbCB9IGZyb20gJy4uL3V0aWxzJ1xuXG5jb25zdCBQUkVTU19ERUxBWSA9IDIwMFxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQoaW5zdGFuY2UpIHtcbiAgICBiaW5kQWxsKHRoaXMsIGluc3RhbmNlKVxuICB9LFxuXG4gIGNsaWNrKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgIGlmIChpc1ByZXNzaW5nTWV0YUtleShlKSkge1xuICAgICAgcmV0dXJuIHdpbmRvdy5vcGVuKFxuICAgICAgICB0aGlzLnRhcmdldC5zcmNPcmlnaW5hbCB8fCBlLmN1cnJlbnRUYXJnZXQuc3JjLFxuICAgICAgICAnX2JsYW5rJ1xuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodGhpcy5zaG93bikge1xuICAgICAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgICAgIHRoaXMuY2xvc2UoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmVsZWFzZSgpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub3BlbihlLmN1cnJlbnRUYXJnZXQpXG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHNjcm9sbCgpIHtcbiAgICBjb25zdCBlbCA9XG4gICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgfHwgZG9jdW1lbnQuYm9keS5wYXJlbnROb2RlIHx8IGRvY3VtZW50LmJvZHlcbiAgICBjb25zdCBzY3JvbGxMZWZ0ID0gd2luZG93LnBhZ2VYT2Zmc2V0IHx8IGVsLnNjcm9sbExlZnRcbiAgICBjb25zdCBzY3JvbGxUb3AgPSB3aW5kb3cucGFnZVlPZmZzZXQgfHwgZWwuc2Nyb2xsVG9wXG5cbiAgICBpZiAodGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPT09IG51bGwpIHtcbiAgICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0ge1xuICAgICAgICB4OiBzY3JvbGxMZWZ0LFxuICAgICAgICB5OiBzY3JvbGxUb3BcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBkZWx0YVggPSB0aGlzLmxhc3RTY3JvbGxQb3NpdGlvbi54IC0gc2Nyb2xsTGVmdFxuICAgIGNvbnN0IGRlbHRhWSA9IHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uLnkgLSBzY3JvbGxUb3BcbiAgICBjb25zdCB0aHJlc2hvbGQgPSB0aGlzLm9wdGlvbnMuc2Nyb2xsVGhyZXNob2xkXG5cbiAgICBpZiAoTWF0aC5hYnMoZGVsdGFZKSA+PSB0aHJlc2hvbGQgfHwgTWF0aC5hYnMoZGVsdGFYKSA+PSB0aHJlc2hvbGQpIHtcbiAgICAgIHRoaXMubGFzdFNjcm9sbFBvc2l0aW9uID0gbnVsbFxuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfVxuICB9LFxuXG4gIGtleWRvd24oZSkge1xuICAgIGlmIChpc0VzY2FwZShlKSkge1xuICAgICAgaWYgKHRoaXMucmVsZWFzZWQpIHtcbiAgICAgICAgdGhpcy5jbG9zZSgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlbGVhc2UodGhpcy5jbG9zZSlcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgbW91c2Vkb3duKGUpIHtcbiAgICBpZiAoIWlzTGVmdEJ1dHRvbihlKSB8fCBpc1ByZXNzaW5nTWV0YUtleShlKSkgcmV0dXJuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgY29uc3QgeyBjbGllbnRYLCBjbGllbnRZIH0gPSBlXG5cbiAgICB0aGlzLnByZXNzVGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgZnVuY3Rpb24gZ3JhYk9uTW91c2VEb3duKCkge1xuICAgICAgICB0aGlzLmdyYWIoY2xpZW50WCwgY2xpZW50WSlcbiAgICAgIH0uYmluZCh0aGlzKSxcbiAgICAgIFBSRVNTX0RFTEFZXG4gICAgKVxuICB9LFxuXG4gIG1vdXNlbW92ZShlKSB7XG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHJldHVyblxuICAgIHRoaXMubW92ZShlLmNsaWVudFgsIGUuY2xpZW50WSlcbiAgfSxcblxuICBtb3VzZXVwKGUpIHtcbiAgICBpZiAoIWlzTGVmdEJ1dHRvbihlKSB8fCBpc1ByZXNzaW5nTWV0YUtleShlKSkgcmV0dXJuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucHJlc3NUaW1lcilcblxuICAgIGlmICh0aGlzLnJlbGVhc2VkKSB7XG4gICAgICB0aGlzLmNsb3NlKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZWxlYXNlKClcbiAgICB9XG4gIH0sXG5cbiAgdG91Y2hzdGFydChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgY29uc3QgeyBjbGllbnRYLCBjbGllbnRZIH0gPSBlLnRvdWNoZXNbMF1cblxuICAgIHRoaXMucHJlc3NUaW1lciA9IHNldFRpbWVvdXQoXG4gICAgICBmdW5jdGlvbiBncmFiT25Ub3VjaFN0YXJ0KCkge1xuICAgICAgICB0aGlzLmdyYWIoY2xpZW50WCwgY2xpZW50WSlcbiAgICAgIH0uYmluZCh0aGlzKSxcbiAgICAgIFBSRVNTX0RFTEFZXG4gICAgKVxuICB9LFxuXG4gIHRvdWNobW92ZShlKSB7XG4gICAgaWYgKHRoaXMucmVsZWFzZWQpIHJldHVyblxuXG4gICAgY29uc3QgeyBjbGllbnRYLCBjbGllbnRZIH0gPSBlLnRvdWNoZXNbMF1cbiAgICB0aGlzLm1vdmUoY2xpZW50WCwgY2xpZW50WSlcbiAgfSxcblxuICB0b3VjaGVuZChlKSB7XG4gICAgaWYgKGlzVG91Y2hpbmcoZSkpIHJldHVyblxuICAgIGNsZWFyVGltZW91dCh0aGlzLnByZXNzVGltZXIpXG5cbiAgICBpZiAodGhpcy5yZWxlYXNlZCkge1xuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVsZWFzZSgpXG4gICAgfVxuICB9LFxuXG4gIGNsaWNrT3ZlcmxheSgpIHtcbiAgICB0aGlzLmNsb3NlKClcbiAgfSxcblxuICByZXNpemVXaW5kb3coKSB7XG4gICAgdGhpcy5jbG9zZSgpXG4gIH1cbn1cblxuZnVuY3Rpb24gaXNMZWZ0QnV0dG9uKGUpIHtcbiAgcmV0dXJuIGUuYnV0dG9uID09PSAwXG59XG5cbmZ1bmN0aW9uIGlzUHJlc3NpbmdNZXRhS2V5KGUpIHtcbiAgcmV0dXJuIGUubWV0YUtleSB8fCBlLmN0cmxLZXlcbn1cblxuZnVuY3Rpb24gaXNUb3VjaGluZyhlKSB7XG4gIGUudGFyZ2V0VG91Y2hlcy5sZW5ndGggPiAwXG59XG5cbmZ1bmN0aW9uIGlzRXNjYXBlKGUpIHtcbiAgY29uc3QgY29kZSA9IGUua2V5IHx8IGUuY29kZVxuICByZXR1cm4gY29kZSA9PT0gJ0VzY2FwZScgfHwgZS5rZXlDb2RlID09PSAyN1xufVxuIiwiaW1wb3J0IHsgbGlzdGVuLCBzZXRTdHlsZSB9IGZyb20gJy4uL3V0aWxzJ1xuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQoaW5zdGFuY2UpIHtcbiAgICB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2VcbiAgICB0aGlzLnBhcmVudCA9IGRvY3VtZW50LmJvZHlcblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgdG9wOiAwLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHJpZ2h0OiAwLFxuICAgICAgYm90dG9tOiAwLFxuICAgICAgb3BhY2l0eTogMFxuICAgIH0pXG5cbiAgICB0aGlzLnVwZGF0ZVN0eWxlKGluc3RhbmNlLm9wdGlvbnMpXG4gICAgbGlzdGVuKHRoaXMuZWwsICdjbGljaycsIGluc3RhbmNlLmhhbmRsZXIuY2xpY2tPdmVybGF5LmJpbmQoaW5zdGFuY2UpKVxuICB9LFxuXG4gIHVwZGF0ZVN0eWxlKG9wdGlvbnMpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICB6SW5kZXg6IG9wdGlvbnMuekluZGV4LFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBvcHRpb25zLmJnQ29sb3IsXG4gICAgICB0cmFuc2l0aW9uOiBgb3BhY2l0eVxuICAgICAgICAke29wdGlvbnMudHJhbnNpdGlvbkR1cmF0aW9ufXNcbiAgICAgICAgJHtvcHRpb25zLnRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbn1gXG4gICAgfSlcbiAgfSxcblxuICBpbnNlcnQoKSB7XG4gICAgdGhpcy5wYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5lbClcbiAgfSxcblxuICByZW1vdmUoKSB7XG4gICAgdGhpcy5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5lbClcbiAgfSxcblxuICBmYWRlSW4oKSB7XG4gICAgdGhpcy5lbC5vZmZzZXRXaWR0aFxuICAgIHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9ucy5iZ09wYWNpdHlcbiAgfSxcblxuICBmYWRlT3V0KCkge1xuICAgIHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IDBcbiAgfVxufVxuIiwiaW1wb3J0IHsgY3Vyc29yLCBzZXRTdHlsZSwgZ2V0T3JpZ2luYWxTb3VyY2UsIHRyYW5zZm9ybUNzc1Byb3AgfSBmcm9tICcuLi91dGlscydcblxuLy8gVHJhbnNsYXRlIHotYXhpcyB0byBmaXggQ1NTIGdyaWQgZGlzcGxheSBpc3N1ZSBpbiBDaHJvbWU6XG4vLyBodHRwczovL2dpdGh1Yi5jb20va2luZ2RpZG85OTkvem9vbWluZy9pc3N1ZXMvNDJcbmNvbnN0IFRSQU5TTEFURV9aID0gMFxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIGluaXQgKGVsLCBpbnN0YW5jZSkge1xuICAgIHRoaXMuZWwgPSBlbFxuICAgIHRoaXMuaW5zdGFuY2UgPSBpbnN0YW5jZVxuICAgIHRoaXMuc3JjVGh1bWJuYWlsID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ3NyYycpXG4gICAgdGhpcy5zcmNPcmlnaW5hbCA9IGdldE9yaWdpbmFsU291cmNlKHRoaXMuZWwpXG4gICAgdGhpcy5yZWN0ID0gdGhpcy5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgIHRoaXMudHJhbnNsYXRlID0gbnVsbFxuICAgIHRoaXMuc2NhbGUgPSBudWxsXG4gICAgdGhpcy5zdHlsZU9wZW4gPSBudWxsXG4gICAgdGhpcy5zdHlsZUNsb3NlID0gbnVsbFxuICB9LFxuXG4gIHpvb21JbiAoKSB7XG4gICAgY29uc3Qge1xuICAgICAgekluZGV4LFxuICAgICAgZW5hYmxlR3JhYixcbiAgICAgIHRyYW5zaXRpb25EdXJhdGlvbixcbiAgICAgIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvblxuICAgIH0gPSB0aGlzLmluc3RhbmNlLm9wdGlvbnNcbiAgICB0aGlzLnRyYW5zbGF0ZSA9IHRoaXMuY2FsY3VsYXRlVHJhbnNsYXRlKClcbiAgICB0aGlzLnNjYWxlID0gdGhpcy5jYWxjdWxhdGVTY2FsZSgpXG5cbiAgICB0aGlzLnN0eWxlT3BlbiA9IHtcbiAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgekluZGV4OiB6SW5kZXggKyAxLFxuICAgICAgY3Vyc29yOiBlbmFibGVHcmFiID8gY3Vyc29yLmdyYWIgOiBjdXJzb3Iuem9vbU91dCxcbiAgICAgIHRyYW5zaXRpb246IGAke3RyYW5zZm9ybUNzc1Byb3B9XG4gICAgICAgICR7dHJhbnNpdGlvbkR1cmF0aW9ufXNcbiAgICAgICAgJHt0cmFuc2l0aW9uVGltaW5nRnVuY3Rpb259YCxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZTNkKCR7dGhpcy50cmFuc2xhdGUueH1weCwgJHt0aGlzLnRyYW5zbGF0ZS55fXB4LCAke1RSQU5TTEFURV9afXB4KVxuICAgICAgICBzY2FsZSgke3RoaXMuc2NhbGUueH0sJHt0aGlzLnNjYWxlLnl9KWAsXG4gICAgICBoZWlnaHQ6IGAke3RoaXMucmVjdC5oZWlnaHR9cHhgLFxuICAgICAgd2lkdGg6IGAke3RoaXMucmVjdC53aWR0aH1weGBcbiAgICB9XG5cbiAgICAvLyBGb3JjZSBsYXlvdXQgdXBkYXRlXG4gICAgdGhpcy5lbC5vZmZzZXRXaWR0aFxuXG4gICAgLy8gVHJpZ2dlciB0cmFuc2l0aW9uXG4gICAgdGhpcy5zdHlsZUNsb3NlID0gc2V0U3R5bGUodGhpcy5lbCwgdGhpcy5zdHlsZU9wZW4sIHRydWUpXG4gIH0sXG5cbiAgem9vbU91dCAoKSB7XG4gICAgLy8gRm9yY2UgbGF5b3V0IHVwZGF0ZVxuICAgIHRoaXMuZWwub2Zmc2V0V2lkdGhcblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHsgdHJhbnNmb3JtOiAnbm9uZScgfSlcbiAgfSxcblxuICBncmFiICh4LCB5LCBzY2FsZUV4dHJhKSB7XG4gICAgY29uc3Qgd2luZG93Q2VudGVyID0gZ2V0V2luZG93Q2VudGVyKClcbiAgICBjb25zdCBbZHgsIGR5XSA9IFt3aW5kb3dDZW50ZXIueCAtIHgsIHdpbmRvd0NlbnRlci55IC0geV1cblxuICAgIHNldFN0eWxlKHRoaXMuZWwsIHtcbiAgICAgIGN1cnNvcjogY3Vyc29yLm1vdmUsXG4gICAgICB0cmFuc2Zvcm06IGB0cmFuc2xhdGUzZChcbiAgICAgICAgJHt0aGlzLnRyYW5zbGF0ZS54ICsgZHh9cHgsICR7dGhpcy50cmFuc2xhdGUueSArIGR5fXB4LCAke1RSQU5TTEFURV9afXB4KVxuICAgICAgICBzY2FsZSgke3RoaXMuc2NhbGUueCArIHNjYWxlRXh0cmF9LCR7dGhpcy5zY2FsZS55ICsgc2NhbGVFeHRyYX0pYFxuICAgIH0pXG4gIH0sXG5cbiAgbW92ZSAoeCwgeSwgc2NhbGVFeHRyYSkge1xuICAgIGNvbnN0IHdpbmRvd0NlbnRlciA9IGdldFdpbmRvd0NlbnRlcigpXG4gICAgY29uc3QgW2R4LCBkeV0gPSBbd2luZG93Q2VudGVyLnggLSB4LCB3aW5kb3dDZW50ZXIueSAtIHldXG5cbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB7XG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm1Dc3NQcm9wLFxuICAgICAgdHJhbnNmb3JtOiBgdHJhbnNsYXRlM2QoXG4gICAgICAgICR7dGhpcy50cmFuc2xhdGUueCArIGR4fXB4LCAke3RoaXMudHJhbnNsYXRlLnkgKyBkeX1weCwgJHtUUkFOU0xBVEVfWn1weClcbiAgICAgICAgc2NhbGUoJHt0aGlzLnNjYWxlLnggKyBzY2FsZUV4dHJhfSwke3RoaXMuc2NhbGUueSArIHNjYWxlRXh0cmF9KWBcbiAgICB9KVxuICB9LFxuXG4gIHJlc3RvcmVDbG9zZVN0eWxlICgpIHtcbiAgICBzZXRTdHlsZSh0aGlzLmVsLCB0aGlzLnN0eWxlQ2xvc2UpXG4gIH0sXG5cbiAgcmVzdG9yZU9wZW5TdHlsZSAoKSB7XG4gICAgc2V0U3R5bGUodGhpcy5lbCwgdGhpcy5zdHlsZU9wZW4pXG4gIH0sXG5cbiAgdXBncmFkZVNvdXJjZSAoKSB7XG4gICAgaWYgKHRoaXMuc3JjT3JpZ2luYWwpIHtcbiAgICAgIGNvbnN0IHBhcmVudE5vZGUgPSB0aGlzLmVsLnBhcmVudE5vZGVcbiAgICAgIGNvbnN0IHRlbXAgPSB0aGlzLmVsLmNsb25lTm9kZShmYWxzZSlcblxuICAgICAgLy8gRm9yY2UgY29tcHV0ZSB0aGUgaGktcmVzIGltYWdlIGluIERPTSB0byBwcmV2ZW50XG4gICAgICAvLyBpbWFnZSBmbGlja2VyaW5nIHdoaWxlIHVwZGF0aW5nIHNyY1xuICAgICAgdGVtcC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjT3JpZ2luYWwpXG4gICAgICB0ZW1wLnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJ1xuICAgICAgdGVtcC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbidcbiAgICAgIHBhcmVudE5vZGUuYXBwZW5kQ2hpbGQodGVtcClcblxuICAgICAgLy8gQWRkIGRlbGF5IHRvIHByZXZlbnQgRmlyZWZveCBmcm9tIGZsaWNrZXJpbmdcbiAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgIGZ1bmN0aW9uIHVwZGF0ZVNyYyAoKSB7XG4gICAgICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGUoJ3NyYycsIHRoaXMuc3JjT3JpZ2luYWwpXG4gICAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0ZW1wKVxuICAgICAgICB9LmJpbmQodGhpcyksXG4gICAgICAgIDUwXG4gICAgICApXG4gICAgfVxuICB9LFxuXG4gIGRvd25ncmFkZVNvdXJjZSAoKSB7XG4gICAgaWYgKHRoaXMuc3JjT3JpZ2luYWwpIHtcbiAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKCdzcmMnLCB0aGlzLnNyY1RodW1ibmFpbClcbiAgICB9XG4gIH0sXG5cbiAgY2FsY3VsYXRlVHJhbnNsYXRlICgpIHtcbiAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuICAgIGNvbnN0IHRhcmdldENlbnRlciA9IHtcbiAgICAgIHg6IHRoaXMucmVjdC5sZWZ0ICsgdGhpcy5yZWN0LndpZHRoIC8gMixcbiAgICAgIHk6IHRoaXMucmVjdC50b3AgKyB0aGlzLnJlY3QuaGVpZ2h0IC8gMlxuICAgIH1cblxuICAgIC8vIFRoZSB2ZWN0b3IgdG8gdHJhbnNsYXRlIGltYWdlIHRvIHRoZSB3aW5kb3cgY2VudGVyXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gdGFyZ2V0Q2VudGVyLngsXG4gICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIHRhcmdldENlbnRlci55XG4gICAgfVxuICB9LFxuXG4gIGNhbGN1bGF0ZVNjYWxlICgpIHtcbiAgICBjb25zdCB7IHpvb21pbmdIZWlnaHQsIHpvb21pbmdXaWR0aCB9ID0gdGhpcy5lbC5kYXRhc2V0XG4gICAgY29uc3QgeyBjdXN0b21TaXplLCBzY2FsZUJhc2UgfSA9IHRoaXMuaW5zdGFuY2Uub3B0aW9uc1xuXG4gICAgaWYgKHpvb21pbmdIZWlnaHQgJiYgem9vbWluZ1dpZHRoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiB6b29taW5nV2lkdGggLyB0aGlzLnJlY3Qud2lkdGgsXG4gICAgICAgIHk6IHpvb21pbmdIZWlnaHQgLyB0aGlzLnJlY3QuaGVpZ2h0XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjdXN0b21TaXplKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiBjdXN0b21TaXplLndpZHRoIC8gdGhpcy5yZWN0LndpZHRoLFxuICAgICAgICB5OiBjdXN0b21TaXplLmhlaWdodCAvIHRoaXMucmVjdC5oZWlnaHRcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGFyZ2V0SGFsZldpZHRoID0gdGhpcy5yZWN0LndpZHRoIC8gMlxuICAgICAgY29uc3QgdGFyZ2V0SGFsZkhlaWdodCA9IHRoaXMucmVjdC5oZWlnaHQgLyAyXG4gICAgICBjb25zdCB3aW5kb3dDZW50ZXIgPSBnZXRXaW5kb3dDZW50ZXIoKVxuXG4gICAgICAvLyBUaGUgZGlzdGFuY2UgYmV0d2VlbiB0YXJnZXQgZWRnZSBhbmQgd2luZG93IGVkZ2VcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UgPSB7XG4gICAgICAgIHg6IHdpbmRvd0NlbnRlci54IC0gdGFyZ2V0SGFsZldpZHRoLFxuICAgICAgICB5OiB3aW5kb3dDZW50ZXIueSAtIHRhcmdldEhhbGZIZWlnaHRcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2NhbGVIb3Jpem9udGFsbHkgPSB0YXJnZXRFZGdlVG9XaW5kb3dFZGdlLnggLyB0YXJnZXRIYWxmV2lkdGhcbiAgICAgIGNvbnN0IHNjYWxlVmVydGljYWxseSA9IHRhcmdldEVkZ2VUb1dpbmRvd0VkZ2UueSAvIHRhcmdldEhhbGZIZWlnaHRcblxuICAgICAgLy8gVGhlIGFkZGl0aW9uYWwgc2NhbGUgaXMgYmFzZWQgb24gdGhlIHNtYWxsZXIgdmFsdWUgb2ZcbiAgICAgIC8vIHNjYWxpbmcgaG9yaXpvbnRhbGx5IGFuZCBzY2FsaW5nIHZlcnRpY2FsbHlcbiAgICAgIGNvbnN0IHNjYWxlID0gc2NhbGVCYXNlICsgTWF0aC5taW4oc2NhbGVIb3Jpem9udGFsbHksIHNjYWxlVmVydGljYWxseSlcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogc2NhbGUsXG4gICAgICAgIHk6IHNjYWxlXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldFdpbmRvd0NlbnRlciAoKSB7XG4gIGNvbnN0IGRvY0VsID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XG4gIGNvbnN0IHdpbmRvd1dpZHRoID0gTWF0aC5taW4oZG9jRWwuY2xpZW50V2lkdGgsIHdpbmRvdy5pbm5lcldpZHRoKVxuICBjb25zdCB3aW5kb3dIZWlnaHQgPSBNYXRoLm1pbihkb2NFbC5jbGllbnRIZWlnaHQsIHdpbmRvdy5pbm5lckhlaWdodClcblxuICByZXR1cm4ge1xuICAgIHg6IHdpbmRvd1dpZHRoIC8gMixcbiAgICB5OiB3aW5kb3dIZWlnaHQgLyAyXG4gIH1cbn1cbiIsImltcG9ydCB7XG4gIGN1cnNvcixcbiAgbGlzdGVuLFxuICBsb2FkSW1hZ2UsXG4gIHRyYW5zRW5kRXZlbnQsXG4gIGdldE9yaWdpbmFsU291cmNlXG59IGZyb20gJy4uL3V0aWxzJ1xuaW1wb3J0IERFRkFVTFRfT1BUSU9OUyBmcm9tICcuLi9vcHRpb25zJ1xuXG5pbXBvcnQgaGFuZGxlciBmcm9tICcuL2hhbmRsZXInXG5pbXBvcnQgb3ZlcmxheSBmcm9tICcuL292ZXJsYXknXG5pbXBvcnQgdGFyZ2V0IGZyb20gJy4vdGFyZ2V0J1xuXG4vKipcbiAqIFpvb21pbmcgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFpvb21pbmcge1xuICAvKipcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBVcGRhdGUgZGVmYXVsdCBvcHRpb25zIGlmIHByb3ZpZGVkLlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHRoaXMudGFyZ2V0ID0gT2JqZWN0LmNyZWF0ZSh0YXJnZXQpXG4gICAgdGhpcy5vdmVybGF5ID0gT2JqZWN0LmNyZWF0ZShvdmVybGF5KVxuICAgIHRoaXMuaGFuZGxlciA9IE9iamVjdC5jcmVhdGUoaGFuZGxlcilcbiAgICB0aGlzLmJvZHkgPSBkb2N1bWVudC5ib2R5XG5cbiAgICB0aGlzLnNob3duID0gZmFsc2VcbiAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgIHRoaXMucmVsZWFzZWQgPSB0cnVlXG4gICAgdGhpcy5sYXN0U2Nyb2xsUG9zaXRpb24gPSBudWxsXG4gICAgdGhpcy5wcmVzc1RpbWVyID0gbnVsbFxuXG4gICAgdGhpcy5vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9PUFRJT05TLCBvcHRpb25zKVxuICAgIHRoaXMub3ZlcmxheS5pbml0KHRoaXMpXG4gICAgdGhpcy5oYW5kbGVyLmluaXQodGhpcylcbiAgICB0aGlzLmxpc3Rlbih0aGlzLm9wdGlvbnMuZGVmYXVsdFpvb21hYmxlKVxuICB9XG5cbiAgLyoqXG4gICAqIE1ha2UgZWxlbWVudChzKSB6b29tYWJsZS5cbiAgICogQHBhcmFtICB7c3RyaW5nfEVsZW1lbnR9IGVsIEEgY3NzIHNlbGVjdG9yIG9yIGFuIEVsZW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBsaXN0ZW4oZWwpIHtcbiAgICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbClcbiAgICAgIGxldCBpID0gZWxzLmxlbmd0aFxuXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHRoaXMubGlzdGVuKGVsc1tpXSlcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVsLnRhZ05hbWUgPT09ICdJTUcnKSB7XG4gICAgICBlbC5zdHlsZS5jdXJzb3IgPSBjdXJzb3Iuem9vbUluXG4gICAgICBsaXN0ZW4oZWwsICdjbGljaycsIHRoaXMuaGFuZGxlci5jbGljaylcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5wcmVsb2FkSW1hZ2UpIHtcbiAgICAgICAgbG9hZEltYWdlKGdldE9yaWdpbmFsU291cmNlKGVsKSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBvcHRpb25zIG9yIHJldHVybiBjdXJyZW50IG9wdGlvbnMgaWYgbm8gYXJndW1lbnQgaXMgcHJvdmlkZWQuXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyBBbiBPYmplY3QgdGhhdCBjb250YWlucyB0aGlzLm9wdGlvbnMuXG4gICAqIEByZXR1cm4ge3RoaXN8dGhpcy5vcHRpb25zfVxuICAgKi9cbiAgY29uZmlnKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucykge1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLm9wdGlvbnMsIG9wdGlvbnMpXG4gICAgICB0aGlzLm92ZXJsYXkudXBkYXRlU3R5bGUodGhpcy5vcHRpb25zKVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMub3B0aW9uc1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPcGVuICh6b29tIGluKSB0aGUgRWxlbWVudC5cbiAgICogQHBhcmFtICB7RWxlbWVudH0gZWwgVGhlIEVsZW1lbnQgdG8gb3Blbi5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25PcGVuXSBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbFxuICAgKiBiZSBjYWxsZWQgd2hlbiBhIHRhcmdldCBpcyBvcGVuZWQgYW5kIHRyYW5zaXRpb24gaGFzIGVuZGVkLiBJdCB3aWxsIGdldFxuICAgKiB0aGUgdGFyZ2V0IGVsZW1lbnQgYXMgdGhlIGFyZ3VtZW50LlxuICAgKiBAcmV0dXJuIHt0aGlzfVxuICAgKi9cbiAgb3BlbihlbCwgY2IgPSB0aGlzLm9wdGlvbnMub25PcGVuKSB7XG4gICAgaWYgKHRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKSA6IGVsXG5cbiAgICBpZiAodGFyZ2V0LnRhZ05hbWUgIT09ICdJTUcnKSByZXR1cm5cblxuICAgIGlmICh0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKSB7XG4gICAgICB0aGlzLm9wdGlvbnMub25CZWZvcmVPcGVuKHRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLnRhcmdldC5pbml0KHRhcmdldCwgdGhpcylcblxuICAgIGlmICghdGhpcy5vcHRpb25zLnByZWxvYWRJbWFnZSkge1xuICAgICAgbG9hZEltYWdlKHRoaXMudGFyZ2V0LnNyY09yaWdpbmFsKVxuICAgIH1cblxuICAgIHRoaXMuc2hvd24gPSB0cnVlXG4gICAgdGhpcy5sb2NrID0gdHJ1ZVxuXG4gICAgdGhpcy50YXJnZXQuem9vbUluKClcbiAgICB0aGlzLm92ZXJsYXkuaW5zZXJ0KClcbiAgICB0aGlzLm92ZXJsYXkuZmFkZUluKClcblxuICAgIGxpc3Rlbihkb2N1bWVudCwgJ3Njcm9sbCcsIHRoaXMuaGFuZGxlci5zY3JvbGwpXG4gICAgbGlzdGVuKGRvY3VtZW50LCAna2V5ZG93bicsIHRoaXMuaGFuZGxlci5rZXlkb3duKVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jbG9zZU9uV2luZG93UmVzaXplKSB7XG4gICAgICBsaXN0ZW4od2luZG93LCAncmVzaXplJywgdGhpcy5oYW5kbGVyLnJlc2l6ZVdpbmRvdylcbiAgICB9XG5cbiAgICBjb25zdCBvbk9wZW5FbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk9wZW5FbmQsIGZhbHNlKVxuICAgICAgdGhpcy5sb2NrID0gZmFsc2VcbiAgICAgIHRoaXMudGFyZ2V0LnVwZ3JhZGVTb3VyY2UoKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHtcbiAgICAgICAgdG9nZ2xlR3JhYkxpc3RlbmVycyhkb2N1bWVudCwgdGhpcy5oYW5kbGVyLCB0cnVlKVxuICAgICAgfVxuXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk9wZW5FbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3NlICh6b29tIG91dCkgdGhlIEVsZW1lbnQgY3VycmVudGx5IG9wZW5lZC5cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYj10aGlzLm9wdGlvbnMub25DbG9zZV0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGxcbiAgICogYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgY2xvc2VkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbCBnZXRcbiAgICogdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIGNsb3NlKGNiID0gdGhpcy5vcHRpb25zLm9uQ2xvc2UpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm9uQmVmb3JlQ2xvc2UpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZUNsb3NlKHRhcmdldClcbiAgICB9XG5cbiAgICB0aGlzLmxvY2sgPSB0cnVlXG4gICAgdGhpcy5ib2R5LnN0eWxlLmN1cnNvciA9IGN1cnNvci5kZWZhdWx0XG4gICAgdGhpcy5vdmVybGF5LmZhZGVPdXQoKVxuICAgIHRoaXMudGFyZ2V0Lnpvb21PdXQoKVxuXG4gICAgbGlzdGVuKGRvY3VtZW50LCAnc2Nyb2xsJywgdGhpcy5oYW5kbGVyLnNjcm9sbCwgZmFsc2UpXG4gICAgbGlzdGVuKGRvY3VtZW50LCAna2V5ZG93bicsIHRoaXMuaGFuZGxlci5rZXlkb3duLCBmYWxzZSlcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuY2xvc2VPbldpbmRvd1Jlc2l6ZSkge1xuICAgICAgbGlzdGVuKHdpbmRvdywgJ3Jlc2l6ZScsIHRoaXMuaGFuZGxlci5yZXNpemVXaW5kb3csIGZhbHNlKVxuICAgIH1cblxuICAgIGNvbnN0IG9uQ2xvc2VFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbkNsb3NlRW5kLCBmYWxzZSlcblxuICAgICAgdGhpcy5zaG93biA9IGZhbHNlXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuXG4gICAgICB0aGlzLnRhcmdldC5kb3duZ3JhZGVTb3VyY2UoKVxuXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZUdyYWIpIHtcbiAgICAgICAgdG9nZ2xlR3JhYkxpc3RlbmVycyhkb2N1bWVudCwgdGhpcy5oYW5kbGVyLCBmYWxzZSlcbiAgICAgIH1cblxuICAgICAgdGhpcy50YXJnZXQucmVzdG9yZUNsb3NlU3R5bGUoKVxuICAgICAgdGhpcy5vdmVybGF5LnJlbW92ZSgpXG5cbiAgICAgIGlmIChjYikgY2IodGFyZ2V0KVxuICAgIH1cblxuICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uQ2xvc2VFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIEdyYWIgdGhlIEVsZW1lbnQgY3VycmVudGx5IG9wZW5lZCBnaXZlbiBhIHBvc2l0aW9uIGFuZCBhcHBseSBleHRyYSB6b29tLWluLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgeCBUaGUgWC1heGlzIG9mIHdoZXJlIHRoZSBwcmVzcyBoYXBwZW5lZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHkgVGhlIFktYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICBzY2FsZUV4dHJhIEV4dHJhIHpvb20taW4gdG8gYXBwbHkuXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBbY2I9dGhpcy5vcHRpb25zLm9uR3JhYl0gQSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0XG4gICAqIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSB0YXJnZXQgaXMgZ3JhYmJlZCBhbmQgdHJhbnNpdGlvbiBoYXMgZW5kZWQuIEl0XG4gICAqIHdpbGwgZ2V0IHRoZSB0YXJnZXQgZWxlbWVudCBhcyB0aGUgYXJndW1lbnQuXG4gICAqIEByZXR1cm4ge3RoaXN9XG4gICAqL1xuICBncmFiKHgsIHksIHNjYWxlRXh0cmEgPSB0aGlzLm9wdGlvbnMuc2NhbGVFeHRyYSwgY2IgPSB0aGlzLm9wdGlvbnMub25HcmFiKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZUdyYWIodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMucmVsZWFzZWQgPSBmYWxzZVxuICAgIHRoaXMudGFyZ2V0LmdyYWIoeCwgeSwgc2NhbGVFeHRyYSlcblxuICAgIGNvbnN0IG9uR3JhYkVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uR3JhYkVuZCwgZmFsc2UpXG4gICAgICBpZiAoY2IpIGNiKHRhcmdldClcbiAgICB9XG5cbiAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbkdyYWJFbmQpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyoqXG4gICAqIE1vdmUgdGhlIEVsZW1lbnQgY3VycmVudGx5IGdyYWJiZWQgZ2l2ZW4gYSBwb3NpdGlvbiBhbmQgYXBwbHkgZXh0cmEgem9vbS1pbi5cbiAgICogQHBhcmFtICB7bnVtYmVyfSAgIHggVGhlIFgtYXhpcyBvZiB3aGVyZSB0aGUgcHJlc3MgaGFwcGVuZWQuXG4gICAqIEBwYXJhbSAge251bWJlcn0gICB5IFRoZSBZLWF4aXMgb2Ygd2hlcmUgdGhlIHByZXNzIGhhcHBlbmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgc2NhbGVFeHRyYSBFeHRyYSB6b29tLWluIHRvIGFwcGx5LlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vbk1vdmVdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIG1vdmVkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXQgd2lsbFxuICAgKiBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIG1vdmUoeCwgeSwgc2NhbGVFeHRyYSA9IHRoaXMub3B0aW9ucy5zY2FsZUV4dHJhLCBjYiA9IHRoaXMub3B0aW9ucy5vbk1vdmUpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24gfHwgdGhpcy5sb2NrKSByZXR1cm5cblxuICAgIHRoaXMucmVsZWFzZWQgPSBmYWxzZVxuICAgIHRoaXMuYm9keS5zdHlsZS5jdXJzb3IgPSBjdXJzb3IubW92ZVxuICAgIHRoaXMudGFyZ2V0Lm1vdmUoeCwgeSwgc2NhbGVFeHRyYSlcblxuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMudGFyZ2V0LmVsXG5cbiAgICBjb25zdCBvbk1vdmVFbmQgPSAoKSA9PiB7XG4gICAgICBsaXN0ZW4odGFyZ2V0LCB0cmFuc0VuZEV2ZW50LCBvbk1vdmVFbmQsIGZhbHNlKVxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25Nb3ZlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWxlYXNlIHRoZSBFbGVtZW50IGN1cnJlbnRseSBncmFiYmVkLlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NiPXRoaXMub3B0aW9ucy5vblJlbGVhc2VdIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgKiB3aWxsIGJlIGNhbGxlZCB3aGVuIGEgdGFyZ2V0IGlzIHJlbGVhc2VkIGFuZCB0cmFuc2l0aW9uIGhhcyBlbmRlZC4gSXRcbiAgICogd2lsbCBnZXQgdGhlIHRhcmdldCBlbGVtZW50IGFzIHRoZSBhcmd1bWVudC5cbiAgICogQHJldHVybiB7dGhpc31cbiAgICovXG4gIHJlbGVhc2UoY2IgPSB0aGlzLm9wdGlvbnMub25SZWxlYXNlKSB7XG4gICAgaWYgKCF0aGlzLnNob3duIHx8IHRoaXMubG9jaykgcmV0dXJuXG5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRhcmdldC5lbFxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkJlZm9yZVJlbGVhc2UodGFyZ2V0KVxuICAgIH1cblxuICAgIHRoaXMubG9jayA9IHRydWVcbiAgICB0aGlzLmJvZHkuc3R5bGUuY3Vyc29yID0gY3Vyc29yLmRlZmF1bHRcbiAgICB0aGlzLnRhcmdldC5yZXN0b3JlT3BlblN0eWxlKClcblxuICAgIGNvbnN0IG9uUmVsZWFzZUVuZCA9ICgpID0+IHtcbiAgICAgIGxpc3Rlbih0YXJnZXQsIHRyYW5zRW5kRXZlbnQsIG9uUmVsZWFzZUVuZCwgZmFsc2UpXG4gICAgICB0aGlzLmxvY2sgPSBmYWxzZVxuICAgICAgdGhpcy5yZWxlYXNlZCA9IHRydWVcblxuICAgICAgaWYgKGNiKSBjYih0YXJnZXQpXG4gICAgfVxuXG4gICAgbGlzdGVuKHRhcmdldCwgdHJhbnNFbmRFdmVudCwgb25SZWxlYXNlRW5kKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVHcmFiTGlzdGVuZXJzKGVsLCBoYW5kbGVyLCBhZGQpIHtcbiAgY29uc3QgdHlwZXMgPSBbXG4gICAgJ21vdXNlZG93bicsXG4gICAgJ21vdXNlbW92ZScsXG4gICAgJ21vdXNldXAnLFxuICAgICd0b3VjaHN0YXJ0JyxcbiAgICAndG91Y2htb3ZlJyxcbiAgICAndG91Y2hlbmQnXG4gIF1cblxuICB0eXBlcy5mb3JFYWNoKGZ1bmN0aW9uIHRvZ2dsZUxpc3RlbmVyKHR5cGUpIHtcbiAgICBsaXN0ZW4oZWwsIHR5cGUsIGhhbmRsZXJbdHlwZV0sIGFkZClcbiAgfSlcbn1cbiIsImltcG9ydCB7IGxpc3RlbiB9IGZyb20gJy4vdXRpbHMnXG5pbXBvcnQgWm9vbWluZyBmcm9tICcuL21vZHVsZXMvem9vbWluZydcblxubGlzdGVuKGRvY3VtZW50LCAnRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uIGluaXRab29taW5nKCkge1xuICBuZXcgWm9vbWluZygpXG59KVxuXG5leHBvcnQgZGVmYXVsdCBab29taW5nXG4iXSwibmFtZXMiOlsid2Via2l0UHJlZml4IiwiZG9jdW1lbnQiLCJkb2N1bWVudEVsZW1lbnQiLCJzdHlsZSIsImN1cnNvciIsImxpc3RlbiIsImVsIiwiZXZlbnQiLCJoYW5kbGVyIiwiYWRkIiwib3B0aW9ucyIsInBhc3NpdmUiLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImxvYWRJbWFnZSIsInNyYyIsImNiIiwiaW1nIiwiSW1hZ2UiLCJvbmxvYWQiLCJvbkltYWdlTG9hZCIsImdldE9yaWdpbmFsU291cmNlIiwiZGF0YXNldCIsIm9yaWdpbmFsIiwicGFyZW50Tm9kZSIsInRhZ05hbWUiLCJnZXRBdHRyaWJ1dGUiLCJzZXRTdHlsZSIsInN0eWxlcyIsInJlbWVtYmVyIiwicyIsImtleSIsImJpbmRBbGwiLCJfdGhpcyIsInRoYXQiLCJtZXRob2RzIiwiT2JqZWN0IiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsImdldFByb3RvdHlwZU9mIiwiZm9yRWFjaCIsImJpbmRPbmUiLCJtZXRob2QiLCJiaW5kIiwidHJhbnMiLCJzbmlmZlRyYW5zaXRpb24iLCJjcmVhdGVFbGVtZW50IiwidHJhbnNmb3JtQ3NzUHJvcCIsInRyYW5zRW5kRXZlbnQiLCJjaGVja1RyYW5zIiwidHJhbnNpdGlvblByb3AiLCJ0cmFuc2Zvcm1Qcm9wIiwidHJhbnNpdGlvbiIsInZhbHVlIiwidHJhbnNmb3JtIiwicmVzIiwidGZvcm0iLCJlbmQiLCJzb21lIiwiaGFzVHJhbnNpdGlvbiIsInByb3AiLCJ1bmRlZmluZWQiLCJoYXNUcmFuc2Zvcm0iLCJyZXBsYWNlIiwiUFJFU1NfREVMQVkiLCJpbnN0YW5jZSIsImUiLCJwcmV2ZW50RGVmYXVsdCIsImlzUHJlc3NpbmdNZXRhS2V5Iiwid2luZG93Iiwib3BlbiIsInRhcmdldCIsInNyY09yaWdpbmFsIiwiY3VycmVudFRhcmdldCIsInNob3duIiwicmVsZWFzZWQiLCJjbG9zZSIsInJlbGVhc2UiLCJib2R5Iiwic2Nyb2xsTGVmdCIsInBhZ2VYT2Zmc2V0Iiwic2Nyb2xsVG9wIiwicGFnZVlPZmZzZXQiLCJsYXN0U2Nyb2xsUG9zaXRpb24iLCJkZWx0YVgiLCJ4IiwiZGVsdGFZIiwieSIsInRocmVzaG9sZCIsInNjcm9sbFRocmVzaG9sZCIsIk1hdGgiLCJhYnMiLCJpc0VzY2FwZSIsImlzTGVmdEJ1dHRvbiIsImNsaWVudFgiLCJjbGllbnRZIiwicHJlc3NUaW1lciIsInNldFRpbWVvdXQiLCJncmFiT25Nb3VzZURvd24iLCJncmFiIiwibW92ZSIsInRvdWNoZXMiLCJncmFiT25Ub3VjaFN0YXJ0IiwiaXNUb3VjaGluZyIsImJ1dHRvbiIsIm1ldGFLZXkiLCJjdHJsS2V5IiwidGFyZ2V0VG91Y2hlcyIsImxlbmd0aCIsImNvZGUiLCJrZXlDb2RlIiwicGFyZW50IiwidXBkYXRlU3R5bGUiLCJjbGlja092ZXJsYXkiLCJ6SW5kZXgiLCJiZ0NvbG9yIiwidHJhbnNpdGlvbkR1cmF0aW9uIiwidHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uIiwiYXBwZW5kQ2hpbGQiLCJyZW1vdmVDaGlsZCIsIm9mZnNldFdpZHRoIiwib3BhY2l0eSIsImJnT3BhY2l0eSIsIlRSQU5TTEFURV9aIiwic3JjVGh1bWJuYWlsIiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsInRyYW5zbGF0ZSIsInNjYWxlIiwic3R5bGVPcGVuIiwic3R5bGVDbG9zZSIsImVuYWJsZUdyYWIiLCJjYWxjdWxhdGVUcmFuc2xhdGUiLCJjYWxjdWxhdGVTY2FsZSIsInpvb21PdXQiLCJoZWlnaHQiLCJ3aWR0aCIsInNjYWxlRXh0cmEiLCJ3aW5kb3dDZW50ZXIiLCJnZXRXaW5kb3dDZW50ZXIiLCJkeCIsImR5IiwidGVtcCIsImNsb25lTm9kZSIsInNldEF0dHJpYnV0ZSIsInBvc2l0aW9uIiwidmlzaWJpbGl0eSIsInVwZGF0ZVNyYyIsInRhcmdldENlbnRlciIsImxlZnQiLCJ0b3AiLCJ6b29taW5nSGVpZ2h0Iiwiem9vbWluZ1dpZHRoIiwiY3VzdG9tU2l6ZSIsInNjYWxlQmFzZSIsInRhcmdldEhhbGZXaWR0aCIsInRhcmdldEhhbGZIZWlnaHQiLCJ0YXJnZXRFZGdlVG9XaW5kb3dFZGdlIiwic2NhbGVIb3Jpem9udGFsbHkiLCJzY2FsZVZlcnRpY2FsbHkiLCJtaW4iLCJkb2NFbCIsIndpbmRvd1dpZHRoIiwiY2xpZW50V2lkdGgiLCJpbm5lcldpZHRoIiwid2luZG93SGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwiaW5uZXJIZWlnaHQiLCJab29taW5nIiwiY3JlYXRlIiwib3ZlcmxheSIsImxvY2siLCJhc3NpZ24iLCJERUZBVUxUX09QVElPTlMiLCJpbml0IiwiZGVmYXVsdFpvb21hYmxlIiwiZWxzIiwicXVlcnlTZWxlY3RvckFsbCIsImkiLCJ6b29tSW4iLCJjbGljayIsInByZWxvYWRJbWFnZSIsIm9uT3BlbiIsInF1ZXJ5U2VsZWN0b3IiLCJvbkJlZm9yZU9wZW4iLCJpbnNlcnQiLCJmYWRlSW4iLCJzY3JvbGwiLCJrZXlkb3duIiwiY2xvc2VPbldpbmRvd1Jlc2l6ZSIsInJlc2l6ZVdpbmRvdyIsIm9uT3BlbkVuZCIsInVwZ3JhZGVTb3VyY2UiLCJvbkNsb3NlIiwib25CZWZvcmVDbG9zZSIsImRlZmF1bHQiLCJmYWRlT3V0Iiwib25DbG9zZUVuZCIsImRvd25ncmFkZVNvdXJjZSIsInJlc3RvcmVDbG9zZVN0eWxlIiwicmVtb3ZlIiwib25HcmFiIiwib25CZWZvcmVHcmFiIiwib25HcmFiRW5kIiwib25Nb3ZlIiwib25Nb3ZlRW5kIiwib25SZWxlYXNlIiwib25CZWZvcmVSZWxlYXNlIiwicmVzdG9yZU9wZW5TdHlsZSIsIm9uUmVsZWFzZUVuZCIsInRvZ2dsZUdyYWJMaXN0ZW5lcnMiLCJ0eXBlcyIsInRvZ2dsZUxpc3RlbmVyIiwidHlwZSIsImluaXRab29taW5nIl0sIm1hcHBpbmdzIjoiQUFBTyxJQUFNQSxlQUFlLHNCQUFzQkMsU0FBU0MsZUFBVCxDQUF5QkMsS0FBL0MsR0FDeEIsVUFEd0IsR0FFeEIsRUFGRzs7QUFJUCxBQUFPLElBQU1DLFNBQVM7V0FDWCxNQURXO1VBRVRKLFlBQVgsWUFGb0I7V0FHUkEsWUFBWixhQUhvQjtRQUlYQSxZQUFULFNBSm9CO1FBS2Q7Q0FMRDs7QUFRUCxBQUFPLFNBQVNLLE1BQVQsQ0FBaUJDLEVBQWpCLEVBQXFCQyxLQUFyQixFQUE0QkMsT0FBNUIsRUFBaUQ7TUFBWkMsR0FBWSx1RUFBTixJQUFNOztNQUNoREMsVUFBVSxFQUFFQyxTQUFTLEtBQVgsRUFBaEI7O01BRUlGLEdBQUosRUFBUztPQUNKRyxnQkFBSCxDQUFvQkwsS0FBcEIsRUFBMkJDLE9BQTNCLEVBQW9DRSxPQUFwQztHQURGLE1BRU87T0FDRkcsbUJBQUgsQ0FBdUJOLEtBQXZCLEVBQThCQyxPQUE5QixFQUF1Q0UsT0FBdkM7Ozs7QUFJSixBQUFPLFNBQVNJLFNBQVQsQ0FBb0JDLEdBQXBCLEVBQXlCQyxFQUF6QixFQUE2QjtNQUM5QkQsR0FBSixFQUFTO1FBQ0RFLE1BQU0sSUFBSUMsS0FBSixFQUFaOztRQUVJQyxNQUFKLEdBQWEsU0FBU0MsV0FBVCxHQUF3QjtVQUMvQkosRUFBSixFQUFRQSxHQUFH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
