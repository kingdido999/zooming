import { prefix, options, sniffTransition, checkTrans, toggleListeners, preloadImage } from './helpers'

// elements
const body    = document.body
const overlay = document.createElement('div')
let target, parent

// state
let shown = false       // image is open
let lock  = false       // image is in transform
let released = true     // mouse/finger is not pressing down
let multitouch = false
let lastScrollPosition = null
let translate, scale, srcThumbnail, pressTimer, dynamicScaleExtra

// style
const style = {
  close: null,
  open: null
}

const trans = sniffTransition(overlay)
const transformCssProp = trans.transformCssProp
const transEndEvent = trans.transEndEvent
const setStyleHelper = checkTrans(trans.transitionProp, trans.transformProp)

const PRESS_DELAY = 200
const TOUCH_SCALE_FACTOR = 2
const GRAB_EVENT_TYPES = [
  'mousedown', 'mousemove', 'mouseup',
  'touchstart', 'touchmove', 'touchend'
]

// helpers ---------------------------------------------------------------------

const setStyle = (el, styles, remember) => {
  return setStyleHelper(el, styles, remember)
}

const calculateTransform = () => {
  const imgRect = target.getBoundingClientRect()
  const [imgHalfWidth, imgHalfHeight] = [imgRect.width / 2, imgRect.height / 2]

  const imgCenter = {
    x: imgRect.left + imgHalfWidth,
    y: imgRect.top + imgHalfHeight
  }

  const windowCenter = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  }

  // The distance between image edge and window edge
  const distFromImageEdgeToWindowEdge = {
    x: windowCenter.x - imgHalfWidth,
    y: windowCenter.y - imgHalfHeight
  }

  const scaleHorizontally = distFromImageEdgeToWindowEdge.x / imgHalfWidth
  const scaleVertically = distFromImageEdgeToWindowEdge.y / imgHalfHeight

  // The vector to translate image to the window center
  translate = {
    x: windowCenter.x - imgCenter.x,
    y: windowCenter.y - imgCenter.y
  }

  // The additional scale is based on the smaller value of
  // scaling horizontally and scaling vertically
  scale = options.scaleBase + Math.min(scaleHorizontally, scaleVertically)

  return `translate(${translate.x}px, ${translate.y}px) scale(${scale})`
}

const processTouches = (touches, cb) => {
  const total = touches.length

  multitouch = total > 1

  let i = touches.length
  let [xs, ys] = [0, 0]

  // keep track of the min and max of touch positions
  let minX = touches[0].clientX
  let minY = touches[0].clientY
  let maxX = touches[0].clientX
  let maxY = touches[0].clientY

  while (i--) {
    const t = touches[i]
    const x = t.clientX
    const y = t.clientY
    xs += x
    ys += y

    if (multitouch) {
      if (x < minX) minX = x
      else if (x > maxX) maxX = x

      if (y < minY) minY = y
      else if (y > maxY) maxY = y
    }
  }

  if (multitouch) {
    // change scaleExtra dynamically
    const [distX, distY] = [maxX - minX, maxY - minY]
    if (distX > distY) dynamicScaleExtra = (distX / window.innerWidth) * TOUCH_SCALE_FACTOR
    else dynamicScaleExtra = (distY / window.innerHeight) * TOUCH_SCALE_FACTOR
  }

  cb(xs/touches.length, ys/touches.length)
}

const eventHandler = {

  scroll: function () {
    const scrollTop = window.pageYOffset ||
      (document.documentElement || body.parentNode || body).scrollTop

    if (lastScrollPosition === null) lastScrollPosition = scrollTop

    const deltaY = lastScrollPosition - scrollTop

    if (Math.abs(deltaY) >= options.scrollThreshold) {
      lastScrollPosition = null
      api.close()
    }
  },

  keydown: function (e) {
    const code = e.key || e.code
    if (code === 'Escape' || e.keyCode === 27) api.close()
  },

  mousedown: function (e) {
    e.preventDefault()

    pressTimer = setTimeout(function () {
      api.grab(e.clientX, e.clientY, true)
    }, PRESS_DELAY)
  },

  mousemove: function (e) {
    if (!released) api.grab(e.clientX, e.clientY)
  },

  mouseup: function () {
    clearTimeout(pressTimer)
    api.release()
  },

  touchstart: function (e) {
    e.preventDefault()

    pressTimer = setTimeout(() => {
      processTouches(e.touches, (x, y) => api.grab(x, y, true))
    }, PRESS_DELAY)
  },

  touchmove: function (e) {
    if (!released) {
      processTouches(e.touches, (x, y) => api.grab(x, y))
    }
  },

  touchend: function (e) {
    if (e.targetTouches.length === 0) {
      clearTimeout(pressTimer)
      if (released) api.close()
      else api.release()
    }
  }
}

// init ------------------------------------------------------------------------

setStyle(overlay, {
  zIndex: 998,
  background: options.bgColor,
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  opacity: 0,
  transition: `opacity
    ${options.transitionDuration}s
    ${options.transitionTimingFunction}`
})

overlay.addEventListener('click', () => api.close())
document.addEventListener('DOMContentLoaded', () => api.listen(options.defaultZoomable))

// API -------------------------------------------------------------------------

const api = {

  listen: (el) => {
    if (typeof el === 'string') {
      let els = document.querySelectorAll(el), i = els.length

      while (i--) {
        api.listen(els[i])
      }

      return this
    }

    if (el.tagName !== 'IMG') return

    el.style.cursor = `${prefix}zoom-in`

    el.addEventListener('click', (e) => {
      e.preventDefault()

      if (shown && released) api.close()
      else api.open(el)
    })

    if (options.preloadImage && el.hasAttribute('data-original')) {
      preloadImage(el.getAttribute('data-original'))
    }

    return this
  },

  config: (opts) => {
    if (!opts) return options

    for (let key in opts) {
      options[key] = opts[key]
    }

    setStyle(overlay, {
      backgroundColor: options.bgColor,
      transition: `opacity
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`
    })

    return this
  },

  open: (el, cb = options.onOpen) => {
    if (shown || lock) return

    target = typeof el === 'string'
      ? document.querySelector(el)
      : el

    if (target.tagName !== 'IMG') return

    // onBeforeOpen event
    if (options.onBeforeOpen) options.onBeforeOpen(target)

    shown = true
    lock = true
    parent = target.parentNode

    // force layout update
    target.offsetWidth

    style.open = {
      position: 'relative',
      zIndex: 999,
      cursor: `${prefix}${options.enableGrab ? 'grab' : 'zoom-out'}`,
      transition: `${transformCssProp}
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`,
      transform: calculateTransform()
    }

    // trigger transition
    style.close = setStyle(target, style.open, true)

    parent.appendChild(overlay)
    setTimeout(() => overlay.style.opacity = options.bgOpacity, 30)

    document.addEventListener('scroll', eventHandler['scroll'])
    document.addEventListener('keydown', eventHandler['keydown'])

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      if (options.enableGrab) toggleListeners(target, GRAB_EVENT_TYPES, eventHandler, true)

      lock = false

      // upgrade source if possible
      if (target.hasAttribute('data-original')) {
        srcThumbnail = target.getAttribute('src')
        target.setAttribute('src', target.getAttribute('data-original'))
      }

      if (cb) cb(target)
    })

    return this
  },

  close: (cb = options.onClose) => {
    if (!shown || lock) return
    lock = true

    // onBeforeClose event
    if (options.onBeforeClose) options.onBeforeClose(target)

    // force layout update
    target.offsetWidth

    overlay.style.opacity = 0
    setStyle(target, { transform: 'none' })

    document.removeEventListener('scroll', eventHandler['scroll'])
    document.removeEventListener('keydown', eventHandler['keydown'])

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      if (options.enableGrab) toggleListeners(target, GRAB_EVENT_TYPES, eventHandler, false)

      shown = false
      lock = false

      // downgrade source if possible
      if (target.hasAttribute('data-original')) {
        target.setAttribute('src', srcThumbnail)
      }

      setStyle(target, style.close)
      parent.removeChild(overlay)

      if (cb) cb(target)
    })

    return this
  },

  grab: (x, y, start, cb = options.onGrab) => {
    if (!shown || lock) return
    released = false

    // onBeforeGrab event
    if (options.onBeforeGrab) options.onBeforeGrab(target)

    const [dx, dy] = [window.innerWidth / 2 - x, window.innerHeight / 2 - y]
    const scaleExtra = multitouch ? dynamicScaleExtra : options.scaleExtra
    const transform = target.style.transform
      .replace(/translate\(.*?\)/i, `translate(${translate.x + dx}px, ${translate.y + dy}px)`)
      .replace(/scale\([0-9|\.]*\)/i, `scale(${scale + scaleExtra})`)

    setStyle(target, {
      cursor: 'move',
      transition: `${transformCssProp} ${start
        ? options.transitionDuration + 's ' + options.transitionTimingFunction
        : 'ease'}`,
      transform: transform
    })

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)
      if (cb) cb(target)
    })
  },

  release: (cb = options.onRelease) => {
    if (!shown || lock) return

    // onBeforeRelease event
    if (options.onBeforeRelease) options.onBeforeRelease(target)

    setStyle(target, style.open)

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      released = true

      if (cb) cb(target)
    })

    return this
  }
}

export default api
