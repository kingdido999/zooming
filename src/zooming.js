+function() {

  // webkit prefix helper
  var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''

  // elements
  var overlay = document.createElement('div'),
      target,
      parent,
      placeholder

  // state
  var shown = false,
      lock  = false,
      originalStyles

  var options = {
    scaleBase: 1.0,
    scrollThreshold: 40,
    bgColor: '#fff',
    transitionDuration: '.3s'
  }

  // compatibility stuff
  var trans = sniffTransition(),
      transitionProp = trans.transition,
      transformProp = trans.transform,
      transformCssProp = transformProp.replace(/(.*)Transform/, '-$1-transform'),
      transEndEvent = trans.transEnd

  setStyle(overlay, {
    'z-index': 233,
    'background': options.bgColor,
    'position': 'fixed',
    'top': 0,
    'left': 0,
    'right': 0,
    'bottom': 0,
    'filter': 'alpha(opacity=0)',
    'opacity': 0,
    '-webkit-transition': 'opacity ' + options.transitionDuration,
         '-o-transition': 'opacity ' + options.transitionDuration,
            'transition': 'opacity ' + options.transitionDuration
  })

  var api = {

    open: function (el, cb) {
      if (shown || lock) return

      target = typeof el === 'string'
        ? document.querySelector(el)
        : el

      shown = true
      lock = true
      parent = target.parentNode


    },

    close: function (cb) {
      if (!shown || lock) return
      lock = true
    },

    listen: function listen(el) {
      if (typeof el === 'string') {
        var els = document.querySelectorAll(el),
          i = els.length
        while (i--) {
          listen(els[i])
        }
        return
      }

      setStyle(el, {
        cursor: prefix + 'zoom-in'
      })

      el.addEventListener('click', function(e) {
        e.stopPropagation()

        if (shown) {
          api.close()
        } else {
          api.open(el)
        }
      })

      return this
    }
  }

  function setStyle (el, styles, remember) {
    checkTrans(styles)
    var s = el.style,
        original = {}
    for (var key in styles) {
      if (remember) {
          original[key] = s[key] || ''
      }
      s[key] = styles[key]
    }
    return original
  }

  function sniffTransition () {
    var ret   = {},
        trans = ['webkitTransition', 'transition', 'mozTransition'],
        tform = ['webkitTransform', 'transform', 'mozTransform'],
        end   = {
            'transition'       : 'transitionend',
            'mozTransition'    : 'transitionend',
            'webkitTransition' : 'webkitTransitionEnd'
        }
    trans.some(function (prop) {
      if (overlay.style[prop] !== undefined) {
        ret.transition = prop
        ret.transEnd = end[prop]
        return true
      }
    })
    tform.some(function (prop) {
      if (overlay.style[prop] !== undefined) {
        ret.transform = prop
        return true
      }
    })
    return ret
  }

  function checkTrans (styles) {
    var value
    if (styles.transition) {
      value = styles.transition
      delete styles.transition
      styles[transitionProp] = value
    }
    if (styles.transform) {
      value = styles.transform
      delete styles.transform
      styles[transformProp] = value
    }
  }

  overlay.addEventListener('click', api.close)

  // umd expose
  if (typeof exports == "object") {
    module.exports = api
  } else if (typeof define == "function" && define.amd) {
    define(function(){ return api })
  } else {
    this.Zooming = api
  }
}()
