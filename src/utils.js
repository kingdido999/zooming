export const webkitPrefix = 'WebkitAppearance' in document.documentElement.style
  ? '-webkit-'
  : ''

export const cursor = {
  default: 'auto',
  zoomIn: `${webkitPrefix}zoom-in`,
  zoomOut: `${webkitPrefix}zoom-out`,
  grab: `${webkitPrefix}grab`,
  move: 'move'
}

export function listen (el, event, handler, add = true) {
  const options = { passive: false }

  if (add) {
    el.addEventListener(event, handler, options)
  } else {
    el.removeEventListener(event, handler, options)
  }
}

export function loadImage (src, cb) {
  if (src) {
    const img = new Image()

    img.onload = function onImageLoad () {
      if (cb) cb(img)
    }

    img.src = src
  }
}

export function getOriginalSource (el) {
  if (el.dataset.original) {
    return el.dataset.original
  } else if (el.parentNode.tagName === 'A') {
    return el.parentNode.getAttribute('href')
  } else {
    return null
  }
}

export function setStyle (el, styles, remember) {
  checkTrans(styles)

  let s = el.style
  let original = {}

  for (let key in styles) {
    if (remember) {
      original[key] = s[key] || ''
    }

    s[key] = styles[key]
  }

  return original
}

export function bindAll (_this, that) {
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(_this))
  methods.forEach(function bindOne (method) {
    _this[method] = _this[method].bind(that)
  })
}

const trans = sniffTransition(document.createElement('div'))
export const transformCssProp = trans.transformCssProp
export const transEndEvent = trans.transEndEvent

function checkTrans (styles) {
  const { transitionProp, transformProp } = trans

  if (styles.transition) {
    const value = styles.transition
    delete styles.transition
    styles[transitionProp] = value
  }

  if (styles.transform) {
    const value = styles.transform
    delete styles.transform
    styles[transformProp] = value
  }
}

function sniffTransition (el) {
  let res = {}
  const trans = ['webkitTransition', 'transition', 'mozTransition']
  const tform = ['webkitTransform', 'transform', 'mozTransform']
  const end = {
    transition: 'transitionend',
    mozTransition: 'transitionend',
    webkitTransition: 'webkitTransitionEnd'
  }

  trans.some(function hasTransition (prop) {
    if (el.style[prop] !== undefined) {
      res.transitionProp = prop
      res.transEndEvent = end[prop]
      return true
    }
  })

  tform.some(function hasTransform (prop) {
    if (el.style[prop] !== undefined) {
      res.transformProp = prop
      res.transformCssProp = prop.replace(/(.*)Transform/, '-$1-transform')
      return true
    }
  })

  return res
}
