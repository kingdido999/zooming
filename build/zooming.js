(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Zooming = factory());
}(this, (function () { 'use strict';

var body = document.body;
var docElm = document.documentElement;
var webkitPrefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : '';

var divide = function divide(denominator) {
  return function (numerator) {
    return numerator / denominator;
  };
};

var half = divide(2);

var loadImage = function loadImage(url, cb) {
  var img = new Image();
  img.onload = function () {
    if (cb) cb(img);
  };
  img.src = url;
};

var scrollTop = function scrollTop() {
  return window.pageYOffset || (docElm || body.parentNode || body).scrollTop;
};

var getWindowCenter = function getWindowCenter() {
  var docWidth = docElm.clientWidth || body.clientWidth;
  var docHeight = docElm.clientHeight || body.clientHeight;

  return {
    x: half(docWidth),
    y: half(docHeight)
  };
};

var toggleListeners = function toggleListeners(el, types, handler) {
  var add = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

  types.forEach(function (t) {
    if (add) {
      el.addEventListener(t, handler[t]);
    } else {
      el.removeEventListener(t, handler[t]);
    }
  });
};

var sniffTransition = function sniffTransition(el) {
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
      ret.transitionProp = prop;
      ret.transEndEvent = end[prop];
      return true;
    }
  });

  tform.some(function (prop) {
    if (el.style[prop] !== undefined) {
      ret.transformProp = prop;
      ret.transformCssProp = prop.replace(/(.*)Transform/, '-$1-transform');
      return true;
    }
  });

  return ret;
};

var trans = sniffTransition(document.createElement('div'));
var transitionProp = trans.transitionProp;
var transformProp = trans.transformProp;
var transformCssProp = trans.transformCssProp;
var transEndEvent = trans.transEndEvent;

var setStyle = function setStyle(el, styles, remember) {
  var value = void 0;
  if (styles.transition) {
    value = styles.transition;
    delete styles.transition;
    styles[transitionProp] = value;
  }
  if (styles.transform) {
    value = styles.transform;
    delete styles.transform;
    styles[transformProp] = value;
  }

  var s = el.style;
  var original = {};

  for (var key in styles) {
    if (remember) original[key] = s[key] || '';
    s[key] = styles[key];
  }

  return original;
};

var cursor = {
  default: 'auto',
  zoomIn: webkitPrefix + 'zoom-in',
  zoomOut: webkitPrefix + 'zoom-out',
  grab: webkitPrefix + 'grab',
  move: 'move'
};

function Target(el, instance) {
  this.el = el;
  this.instance = instance;
  this.body = document.body;
  this.translate = null;
  this.scale = null;
  this.srcThumbnail = null;
  this.style = {
    open: null,
    close: null
  };
}

Target.prototype = {

  open: function open() {
    var options = this.instance.options;

    // load hi-res image if preloadImage option is disabled
    if (!options.preloadImage && this.el.hasAttribute('data-original')) {
      loadImage(this.el.getAttribute('data-original'));
    }

    var rect = this.el.getBoundingClientRect();
    this.translate = calculateTranslate(rect);
    this.scale = calculateScale(rect, options.scaleBase, options.customSize);

    // force layout update
    this.el.offsetWidth;

    this.style.open = {
      position: 'relative',
      zIndex: 999,
      cursor: options.enableGrab ? cursor.grab : cursor.zoomOut,
      transition: transformCssProp + '\n        ' + options.transitionDuration + 's\n        ' + options.transitionTimingFunction,
      transform: 'translate(' + this.translate.x + 'px, ' + this.translate.y + 'px)\n        scale(' + this.scale.x + ',' + this.scale.y + ')'
    };

    // trigger transition
    this.style.close = setStyle(this.el, this.style.open, true);
  },

  close: function close() {
    // force layout update
    this.el.offsetWidth;

    setStyle(this.el, { transform: 'none' });
  },

  grab: function grab(x, y, scaleExtra) {
    var windowCenter = getWindowCenter();
    var dx = windowCenter.x - x,
        dy = windowCenter.y - y;


    setStyle(this.el, {
      cursor: cursor.move,
      transform: 'translate(\n        ' + (this.translate.x + dx) + 'px, ' + (this.translate.y + dy) + 'px)\n        scale(' + (this.scale.x + scaleExtra) + ',' + (this.scale.y + scaleExtra) + ')'
    });
  },

  move: function move(x, y, scaleExtra) {
    var windowCenter = getWindowCenter();
    var dx = windowCenter.x - x,
        dy = windowCenter.y - y;


    setStyle(this.el, {
      transition: transformCssProp,
      transform: 'translate(\n        ' + (this.translate.x + dx) + 'px, ' + (this.translate.y + dy) + 'px)\n        scale(' + (this.scale.x + scaleExtra) + ',' + (this.scale.y + scaleExtra) + ')'
    });
  },

  restoreCloseStyle: function restoreCloseStyle() {
    setStyle(this.el, this.style.close);
  },

  restoreOpenStyle: function restoreOpenStyle() {
    setStyle(this.el, this.style.open);
  },

  upgradeSource: function upgradeSource() {
    var _this = this;

    this.srcThumbnail = this.el.getAttribute('src');
    var dataOriginal = this.el.getAttribute('data-original');
    var temp = this.el.cloneNode(false);

    // force compute the hi-res image in DOM to prevent
    // image flickering while updating src
    temp.setAttribute('src', dataOriginal);
    temp.style.position = 'fixed';
    temp.style.visibility = 'hidden';
    this.body.appendChild(temp);

    setTimeout(function () {
      _this.el.setAttribute('src', dataOriginal);
      _this.body.removeChild(temp);
    }, 10);
  },

  downgradeSource: function downgradeSource() {
    this.el.setAttribute('src', this.srcThumbnail);
  }
};

function calculateTranslate(rect) {
  var windowCenter = getWindowCenter();
  var targetCenter = {
    x: rect.left + half(rect.width),
    y: rect.top + half(rect.height)
  };

  // The vector to translate image to the window center
  return {
    x: windowCenter.x - targetCenter.x,
    y: windowCenter.y - targetCenter.y
  };
}

function calculateScale(rect, scaleBase, customSize) {
  if (customSize) {
    return {
      x: customSize.width / rect.width,
      y: customSize.height / rect.height
    };
  } else {
    var targetHalfWidth = half(rect.width);
    var targetHalfHeight = half(rect.height);
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

function Overlay(el, instance) {
  this.el = el;
  this.instance = instance;
  this.parent = null;
}

Overlay.prototype = {
  init: function init() {
    var options = this.instance.options;

    setStyle(this.el, {
      zIndex: 998,
      backgroundColor: options.bgColor,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0,
      transition: 'opacity\n        ' + options.transitionDuration + 's\n        ' + options.transitionTimingFunction
    });

    this.el.addEventListener('click', this.instance.close());
  },

  updateStyle: function updateStyle() {
    var options = this.instance.options;

    setStyle(this.el, {
      backgroundColor: options.bgColor,
      transition: 'opacity\n        ' + options.transitionDuration + 's\n        ' + options.transitionTimingFunction
    });
  },

  setParent: function setParent(parent) {
    this.parent = parent;
  },

  insert: function insert() {
    this.parent.appendChild(this.el);
  },

  remove: function remove() {
    this.parent.removeChild(this.el);
  },

  show: function show() {
    var _this = this;

    setTimeout(function () {
      return _this.el.style.opacity = _this.instance.options.bgOpacity;
    }, 30);
  },

  hide: function hide() {
    this.el.style.opacity = 0;
  }
};

/**
 * A list of options.
 *
 * @type {Object}
 * @example
 * // Default options
 * var options = {
 *   defaultZoomable: 'img[data-action="zoom"]',
 *   enableGrab: true,
 *   preloadImage: true,
 *   transitionDuration: 0.4,
 *   transitionTimingFunction: 'cubic-bezier(0.4, 0, 0, 1)',
 *   bgColor: 'rgb(255, 255, 255)',
 *   bgOpacity: 1,
 *   scaleBase: 1.0,
 *   scaleExtra: 0.5,
 *   scrollThreshold: 40,
 *   customSize: null,
 *   onOpen: null,
 *   onClose: null,
 *   onRelease: null,
 *   onBeforeOpen: null,
 *   onBeforeClose: null,
 *   onBeforeGrab: null,
 *   onBeforeMove: null,
 *   onBeforeRelease: null
 * }
 */
var OPTIONS = {
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
   * Preload images with attribute "data-original".
   * @type {boolean}
   */
  preloadImage: true,

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
   * The extra scale factor when grabbing the image.
   * @type {number}
   */
  scaleExtra: 0.5,

  /**
   * How much scrolling it takes before closing out.
   * @type {number}
   */
  scrollThreshold: 40,

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
   * A callback function that will be called before move.
   * @type {Function}
   */
  onBeforeMove: null,

  /**
   * A callback function that will be called before release.
   * @type {Function}
   */
  onBeforeRelease: null
};

var PRESS_DELAY = 200;
var EVENT_TYPES_GRAB = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend'];
var TOUCH_SCALE_FACTOR = 2;

function EventHandler(instance) {

  var handler = {

    click: function click(e) {
      e.preventDefault();

      if (instance.shown) {
        if (instance.released) instance.close();else instance.release();
      } else {
        instance.open(e.currentTarget);
      }
    },

    scroll: function scroll() {
      var st = scrollTop();

      if (instance.lastScrollPosition === null) {
        instance.lastScrollPosition = st;
      }

      var deltaY = instance.lastScrollPosition - st;

      if (Math.abs(deltaY) >= instance.options.scrollThreshold) {
        instance.lastScrollPosition = null;
        instance.close();
      }
    },

    keydown: function keydown(e) {
      var code = e.key || e.code;
      if (code === 'Escape' || e.keyCode === 27) {
        if (instance.released) instance.close();else instance.release(function () {
          return instance.close();
        });
      }
    },

    mousedown: function mousedown(e) {
      if (e.button !== 0) return;
      e.preventDefault();

      instance.pressTimer = setTimeout(function () {
        instance.grab(e.clientX, e.clientY);
      }, PRESS_DELAY);
    },

    mousemove: function mousemove(e) {
      if (instance.released) return;
      instance.move(e.clientX, e.clientY);
    },

    mouseup: function mouseup(e) {
      if (e.button !== 0) return;
      clearTimeout(instance.pressTimer);

      if (instance.released) instance.close();else instance.release();
    },

    touchstart: function touchstart(e) {
      e.preventDefault();

      instance.pressTimer = setTimeout(function () {
        processTouches(e.touches, instance.options.scaleExtra, function (x, y, scaleExtra) {
          instance.grab(x, y, scaleExtra);
        });
      }, PRESS_DELAY);
    },

    touchmove: function touchmove(e) {
      if (instance.released) return;

      processTouches(e.touches, instance.options.scaleExtra, function (x, y, scaleExtra) {
        instance.move(x, y, scaleExtra);
      });
    },

    touchend: function touchend(e) {
      if (e.targetTouches.length > 0) return;
      clearTimeout(instance.pressTimer);

      if (instance.released) instance.close();else instance.release();
    }
  };

  for (var fn in handler) {
    handler[fn] = handler[fn].bind(instance);
  }

  return handler;
}

function processTouches(touches, currScaleExtra, cb) {
  var total = touches.length;
  var firstTouch = touches[0];
  var multitouch = total > 1;

  var scaleExtra = currScaleExtra;
  var i = touches.length;
  var xs = 0,
      ys = 0;

  // keep track of the min and max of touch positions

  var min = { x: firstTouch.clientX, y: firstTouch.clientY };
  var max = { x: firstTouch.clientX, y: firstTouch.clientY };

  while (i--) {
    var t = touches[i];
    var _ref = [t.clientX, t.clientY],
        x = _ref[0],
        y = _ref[1];

    xs += x;
    ys += y;

    if (!multitouch) continue;

    if (x < min.x) {
      min.x = x;
    } else if (x > max.x) {
      max.x = x;
    }

    if (y < min.y) {
      min.y = y;
    } else if (y > max.y) {
      max.y = y;
    }
  }

  if (multitouch) {
    // change scaleExtra dynamically
    var distX = max.x - min.x,
        distY = max.y - min.y;


    if (distX > distY) {
      scaleExtra = distX / window.innerWidth * TOUCH_SCALE_FACTOR;
    } else {
      scaleExtra = distY / window.innerHeight * TOUCH_SCALE_FACTOR;
    }
  }

  cb(xs / total, ys / total, scaleExtra);
}

/**
 * Zooming instance.
 * @param {Object} [options] Update default options if provided.
 */
function Zooming$1(options) {
  // elements
  this.body = document.body;
  this.overlay = new Overlay(document.createElement('div'), this);
  this.target = null;

  // state
  this.shown = false; // target is open
  this.lock = false; // target is in transform
  this.released = true; // mouse/finger is not pressing down
  this.lastScrollPosition = null;
  this.pressTimer = null;

  this.options = Object.assign({}, OPTIONS);
  if (options) this.config(options);

  this.eventHandler = new EventHandler(this);
  this.overlay.init();
}

Zooming$1.prototype = {

  /**
   * Make element(s) zoomable.
   * @param  {string|Element} el A css selector or an Element.
   * @return {this}
   */
  listen: function listen(el) {
    if (typeof el === 'string') {
      var els = document.querySelectorAll(el),
          i = els.length;

      while (i--) {
        this.listen(els[i]);
      }

      return this;
    }

    if (el.tagName !== 'IMG') return;

    el.style.cursor = cursor.zoomIn;
    el.addEventListener('click', this.eventHandler.click);

    if (this.options.preloadImage && el.hasAttribute('data-original')) {
      loadImage(el.getAttribute('data-original'));
    }

    return this;
  },

  /**
   * Open (zoom in) the Element.
   * @param  {Element} el The Element to open.
   * @param  {Function} [cb=this.options.onOpen] A callback function that will
   * be called when a target is opened and transition has ended. It will get
   * the target element as the argument.
   * @return {this}
   */
  open: function open(el) {
    var _this = this;

    var cb = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.options.onOpen;

    if (this.shown || this.lock) return;

    var target = typeof el === 'string' ? document.querySelector(el) : el;

    if (target.tagName !== 'IMG') return;

    this.target = new Target(target, this);

    // onBeforeOpen event
    if (this.options.onBeforeOpen) this.options.onBeforeOpen(target);

    this.shown = true;
    this.lock = true;

    this.target.open();
    this.overlay.setParent(target.parentNode);
    this.overlay.insert();
    this.overlay.show();

    document.addEventListener('scroll', this.eventHandler.scroll);
    document.addEventListener('keydown', this.eventHandler.keydown);

    var onEnd = function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);

      _this.lock = false;

      if (_this.options.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, _this.eventHandler, true);
      }

      if (target.hasAttribute('data-original')) {
        _this.target.upgradeSource();
      }

      if (cb) cb(target);
    };

    target.addEventListener(transEndEvent, onEnd);

    return this;
  },

  /**
   * Close (zoom out) the Element currently opened.
   * @param  {Function} [cb=this.options.onClose] A callback function that will
   * be called when a target is closed and transition has ended. It will get
   * the target element as the argument.
   * @return {this}
   */
  close: function close() {
    var _this2 = this;

    var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.options.onClose;

    if (!this.shown || this.lock) return;

    var target = this.target.el;

    // onBeforeClose event
    if (this.options.onBeforeClose) this.options.onBeforeClose(target);

    this.lock = true;

    this.body.style.cursor = cursor.default;
    this.overlay.hide();
    this.target.close();

    document.removeEventListener('scroll', this.eventHandler.scroll);
    document.removeEventListener('keydown', this.eventHandler.keydown);

    var onEnd = function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);

      _this2.shown = false;
      _this2.lock = false;

      if (_this2.options.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, _this2.eventHandler, false);
      }

      if (target.hasAttribute('data-original')) {
        _this2.target.downgradeSource();
      }

      _this2.target.restoreCloseStyle();
      _this2.overlay.remove();

      if (cb) cb(target);
    };

    target.addEventListener(transEndEvent, onEnd);

    return this;
  },

  /**
   * Grab the Element currently opened given a position and apply extra zoom-in.
   * @param  {number}   x The X-axis of where the press happened.
   * @param  {number}   y The Y-axis of where the press happened.
   * @param  {number}   scaleExtra Extra zoom-in to apply.
   * @param  {Function} [cb=this.options.scaleExtra] A callback function that
   * will be called when a target is grabbed and transition has ended. It
   * will get the target element as the argument.
   * @return {this}
   */
  grab: function grab(x, y) {
    var scaleExtra = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.options.scaleExtra;
    var cb = arguments[3];

    if (!this.shown || this.lock) return;

    var target = this.target.el;

    // onBeforeGrab event
    if (this.options.onBeforeGrab) this.options.onBeforeGrab(target);

    this.released = false;
    this.target.grab(x, y, scaleExtra);

    var onEnd = function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);
      if (cb) cb(target);
    };

    target.addEventListener(transEndEvent, onEnd);
  },

  /**
   * Move the Element currently grabbed given a position and apply extra zoom-in.
   * @param  {number}   x The X-axis of where the press happened.
   * @param  {number}   y The Y-axis of where the press happened.
   * @param  {number}   scaleExtra Extra zoom-in to apply.
   * @param  {Function} [cb=this.options.scaleExtra] A callback function that
   * will be called when a target is moved and transition has ended. It will
   * get the target element as the argument.
   * @return {this}
   */
  move: function move(x, y) {
    var scaleExtra = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.options.scaleExtra;
    var cb = arguments[3];

    if (!this.shown || this.lock) return;

    var target = this.target.el;

    // onBeforeMove event
    if (this.options.onBeforeMove) this.options.onBeforeMove(target);

    this.released = false;

    this.target.move(x, y, scaleExtra);
    this.body.style.cursor = cursor.move;

    var onEnd = function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);
      if (cb) cb(target);
    };

    target.addEventListener(transEndEvent, onEnd);
  },

  /**
   * Release the Element currently grabbed.
   * @param  {Function} [cb=this.options.onRelease] A callback function that
   * will be called when a target is released and transition has ended. It
   * will get the target element as the argument.
   * @return {this}
   */
  release: function release() {
    var _this3 = this;

    var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.options.onRelease;

    if (!this.shown || this.lock) return;

    var target = this.target.el;

    // onBeforeRelease event
    if (this.options.onBeforeRelease) this.options.onBeforeRelease(target);

    this.lock = true;

    this.target.restoreOpenStyle();
    this.body.style.cursor = cursor.default;

    var onEnd = function onEnd() {
      target.removeEventListener(transEndEvent, onEnd);

      _this3.lock = false;
      _this3.released = true;

      if (cb) cb(target);
    };

    target.addEventListener(transEndEvent, onEnd);

    return this;
  },

  /**
   * Update options.
   * @param  {Object} options An Object that contains this.options.
   * @return {this}
   */
  config: function config(options) {
    if (!options) return this.options;

    for (var key in options) {
      this.options[key] = options[key];
    }

    this.overlay.updateStyle();

    return this;
  }
};

document.addEventListener('DOMContentLoaded', function () {
  new Zooming$1().listen(OPTIONS.defaultZoomable);
});

return Zooming$1;

})));
//# sourceMappingURL=zooming.js.map
