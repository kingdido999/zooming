import { half, getWindowCenter } from './_helpers'

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

const calculateTranslate = (rect) => {
  const windowCenter = getWindowCenter()
  const targetCenter = {
    x: rect.left + half(rect.width),
    y: rect.top + half(rect.height)
  }

  // The vector to translate image to the window center
  return {
    x: windowCenter.x - targetCenter.x,
    y: windowCenter.y - targetCenter.y
  }
}

const calculateScale = (rect, scaleBase) => {
  const windowCenter = getWindowCenter()
  const targetHalfWidth = half(rect.width)
  const targetHalfHeight = half(rect.height)

  // The distance between target edge and window edge
  const targetEdgeToWindowEdge = {
    x: windowCenter.x - targetHalfWidth,
    y: windowCenter.y - targetHalfHeight
  }

  const scaleHorizontally = targetEdgeToWindowEdge.x / targetHalfWidth
  const scaleVertically = targetEdgeToWindowEdge.y / targetHalfHeight

  // The additional scale is based on the smaller value of
  // scaling horizontally and scaling vertically
  return scaleBase + Math.min(scaleHorizontally, scaleVertically)
}

export {
  sniffTransition,
  checkTrans,
  calculateTranslate,
  calculateScale
}
