// webkit prefix
const prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''
const PRESS_DELAY = 200
const TOUCH_SCALE_FACTOR = 2

const options = {
  defaultZoomable: 'img[data-action="zoom"]',
  enableGrab: true,
  transitionDuration: 0.4,
  transitionTimingFunction: 'cubic-bezier(.4,0,0,1)',
  bgColor: '#fff',
  bgOpacity: 1,
  scaleBase: 1.0,
  scaleExtra: 0.5,
  scrollThreshold: 40,
  onOpen: null,
  onClose: null,
  onGrab: null,
  onRelease: null,
  onBeforeOpen: null,
  onBeforeClose: null,
  onBeforeGrab: null,
  onBeforeRelease: null
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

const checkTrans = (transitionProp, transformProp) => {
  return function setStyle(el, styles, remember) {
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
}

const updateSrc = (el, src) => {
  const oldSrc = el.getAttribute('src')
  const img = new Image()
  img.onload = () => el.setAttribute('src', src)
  img.src = src

  return oldSrc
}

export {
  prefix,
  PRESS_DELAY,
  TOUCH_SCALE_FACTOR,
  options,
  sniffTransition,
  checkTrans,
  updateSrc
}
