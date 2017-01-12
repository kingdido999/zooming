import { half } from './_math'
import { checkTrans } from './_trans'
import { body, docElm, webkitPrefix } from './_dom'

export const cursor = {
  default: 'auto',
  zoomIn: `${webkitPrefix}zoom-in`,
  zoomOut: `${webkitPrefix}zoom-out`,
  grab: `${webkitPrefix}grab`,
  move: 'move'
}

export function toggleListener (el, type, handler, add) {
  if (add) {
    el.addEventListener(type, handler[type])
  } else {
    el.removeEventListener(type, handler[type])
  }
}

export function getWindowCenter () {
  const docWidth = docElm.clientWidth || body.clientWidth
  const docHeight = docElm.clientHeight || body.clientHeight

  return {
    x: half(docWidth),
    y: half(docHeight)
  }
}

export function toggleGrabListeners (el, handler, add) {
  ['mousedown', 'mousemove', 'mouseup','touchstart', 'touchmove', 'touchend']
  .forEach(type => {
    toggleListener(el, type, handler, add)
  })
}

export function setStyle (el, styles, remember) {
  checkTrans(styles)

  let s = el.style
  let original = {}

  for (let key in styles) {
    if (remember) original[key] = s[key] || ''
    s[key] = styles[key]
  }

  return original
}

export function bindAll (_this, that) {
  const methods = (
    Object.getOwnPropertyNames(
      Object.getPrototypeOf(_this)
    )
  )

  methods.forEach(method => {
    _this[method] = _this[method].bind(that)
  })
}

export function isOverflowHidden (el) {
  return getComputedStyle(el).overflow === 'hidden'
}
