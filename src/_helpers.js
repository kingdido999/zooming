const body = document.body
const docElm = document.documentElement
const webkitPrefix = 'WebkitAppearance' in document.documentElement.style
  ? '-webkit-'
  : ''

const divide = (denominator) => {
  return (numerator) => {
    return numerator / denominator
  }
}

const half = divide(2)

const loadImage = (url, cb) => {
  const img = new Image()
  img.onload = () => {
    if (cb) cb(img)
  }
  img.src = url
}

const scrollTop = () => {
  return window.pageYOffset ||
    (docElm || body.parentNode || body).scrollTop
}

const getWindowCenter = () => {
  const docWidth = docElm.clientWidth || body.clientWidth
  const docHeight = docElm.clientHeight || body.clientHeight

  return {
    x: half(docWidth),
    y: half(docHeight)
  }
}

const toggleListeners = (el, types, handler, add = true) => {
  types.forEach(t => {
    if (add) {
      el.addEventListener(t, handler[t])
    } else {
      el.removeEventListener(t, handler[t])
    }
  })
}

const sniffTransition = (el) => {
  let ret     = {}
  const trans = ['webkitTransition', 'transition', 'mozTransition']
  const tform = ['webkitTransform', 'transform', 'mozTransform']
  const end   = {
    'transition'       : 'transitionend',
    'mozTransition'    : 'transitionend',
    'webkitTransition' : 'webkitTransitionEnd'
  }

  trans.some(prop => {
    if (el.style[prop] !== undefined) {
      ret.transitionProp = prop
      ret.transEndEvent = end[prop]
      return true
    }
  })

  tform.some(prop => {
    if (el.style[prop] !== undefined) {
      ret.transformProp = prop
      ret.transformCssProp = prop.replace(/(.*)Transform/, '-$1-transform')
      return true
    }
  })

  return ret
}

const trans = sniffTransition(document.createElement('div'))
const transitionProp = trans.transitionProp
const transformProp = trans.transformProp
const transformCssProp = trans.transformCssProp
const transEndEvent = trans.transEndEvent

const setStyle = (el, styles, remember) => {
  let value
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

  let s = el.style
  let original = {}

  for (let key in styles) {
    if (remember) original[key] = s[key] || ''
    s[key] = styles[key]
  }

  return original
}

const cursor = {
  default: 'auto',
  zoomIn: `${webkitPrefix}zoom-in`,
  zoomOut: `${webkitPrefix}zoom-out`,
  grab: `${webkitPrefix}grab`,
  move: 'move'
}

const bind = (_this, that) => {
  const methods = (
    Object.getOwnPropertyNames(
      Object.getPrototypeOf(_this)
    )
  )

  methods.forEach(m => {
    _this[m] = _this[m].bind(that)
  })
}

export {
  webkitPrefix,
  half,
  loadImage,
  scrollTop,
  getWindowCenter,
  toggleListeners,
  transformCssProp,
  transEndEvent,
  setStyle,
  cursor,
  bind
}
