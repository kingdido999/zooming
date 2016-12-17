const body = document.body
const webkitPrefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''

const divide = (denominator) => {
  return (numerator) => {
    return numerator / denominator
  }
}

const half = divide(2)

const preloadImage = (url) => (new Image()).src = url

const scrollTop = () => {
  return window.pageYOffset ||
    (document.documentElement || body.parentNode || body).scrollTop
}

const getWindowCenter = () => {
  return {
    x: half(window.innerWidth),
    y: half(window.innerHeight)
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

export {
  webkitPrefix,
  half,
  preloadImage,
  scrollTop,
  getWindowCenter,
  toggleListeners,
  sniffTransition,
  checkTrans
}
