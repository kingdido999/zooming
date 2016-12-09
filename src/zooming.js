import { prefix, pressDelay, options, sniffTransition, checkTrans } from './helpers'

// elements
const body    = document.body
const overlay = document.createElement('div')
let target
let parent

// state
let shown = false
let lock  = false
let press = false
let grab  = false
let lastScrollPosition = null

// style
let originalStyles
let openStyles
let translate
let scale

let srcThumbnail
let imgRect
let pressTimer

const trans = sniffTransition(overlay)
const transformCssProp = trans.transformCssProp
const transEndEvent = trans.transEndEvent
const setStyleHelper = checkTrans(trans.transitionProp, trans.transformProp)
const defaultScaleExtra = options.scaleExtra

// -----------------------------------------------------------------------------

const api = {

  listen: (el) => {
    if (typeof el === 'string') {
      document.querySelectorAll(el).forEach(e => api.listen(e))
      return this
    }

    el.style.cursor = `${prefix}zoom-in`

    el.addEventListener('click', (e) => {
      e.preventDefault()

      if (shown) api.close()
      else api.open(el)
    })

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
        ${options.transitionDuration}
        ${options.transitionTimingFunction}`
    })

    return this
  },

  open: (el, cb = options.onOpen) => {
    if (shown || lock || grab) return

    target = typeof el === 'string'
      ? document.querySelector(el)
      : el

    if (target.tagName !== 'IMG') return

    // onBeforeOpen event
    if (options.onBeforeOpen) options.onBeforeOpen(target)

    shown = true
    lock = true
    parent = target.parentNode

    const img = new Image()
    img.onload = imgOnload()
    img.src = target.getAttribute('src')

    parent.appendChild(overlay)
    setTimeout(() => overlay.style.opacity = options.bgOpacity, 30)

    document.addEventListener('scroll', scrollHandler)
    document.addEventListener('keydown', keydownHandler)

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      if (options.enableGrab) addGrabListeners(target)

      lock = false

      if (cb) cb(target)
    })

    return this
  },

  close: (cb = options.onClose) => {
    if (!shown || lock || grab) return
    lock = true

    // onBeforeClose event
    if (options.onBeforeClose) options.onBeforeClose(target)
    overlay.style.opacity = 0
    target.style.transform = ''

    document.removeEventListener('scroll', scrollHandler)
    document.removeEventListener('keydown', keydownHandler)

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      if (options.enableGrab) removeGrabListeners(target)

      shown = false
      lock = false
      grab = false

      setStyle(target, originalStyles)
      parent.removeChild(overlay)

      // downgrade source if possible
      if (target.hasAttribute('data-original')) target.setAttribute('src', srcThumbnail)

      if (cb) cb(target)
    })

    return this
  },

  grab: function(x, y, start, cb = options.onGrab) {
    if (!shown || lock) return
    grab = true

    // onBeforeGrab event
    if (options.onBeforeGrab) options.onBeforeGrab(target)

    const [dx, dy] = [x - window.innerWidth / 2, y - window.innerHeight / 2]
    const transform = target.style.transform
      .replace(/translate\(.*?\)/i, `translate(${translate.x + dx}px, ${translate.y + dy}px)`)
      .replace(/scale\([0-9|\.]*\)/i, `scale(${scale + options.scaleExtra})`)

    setStyle(target, {
      cursor: `${prefix} grabbing`,
      transition: `${transformCssProp} ${start
        ? options.transitionDuration + ' ' + options.transitionTimingFunction
        : 'ease'}`,
      transform: transform
    })

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)
      if (cb) cb(target)
    })
  },

  release: (cb = options.onRelease) => {
    if (!shown || lock || !grab) return

    // onBeforeRelease event
    if (options.onBeforeRelease) options.onBeforeRelease(target)

    setStyle(target, openStyles)

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)
      grab = false
      if (cb) cb(target)
    })

    return this
  }
}

// -----------------------------------------------------------------------------

function setStyle(el, styles, remember) {
  return setStyleHelper(el, styles, remember)
}

function imgOnload () {
  imgRect = target.getBoundingClientRect()

  // upgrade source if possible
  if (target.hasAttribute('data-original')) {
    srcThumbnail = target.getAttribute('src')

    setStyle(target, {
      width: `${imgRect.width}px`,
      height: `${imgRect.height}px`
    })

    target.setAttribute('src', target.getAttribute('data-original'))
  }

  // force layout update
  target.offsetWidth

  openStyles = {
    position: 'relative',
    zIndex: 999,
    cursor: `${prefix}${options.enableGrab ? 'grab' : 'zoom-out'}`,
    transition: `${transformCssProp}
      ${options.transitionDuration}
      ${options.transitionTimingFunction}`,
    transform: calculateTransform()
  }

  // trigger transition
  originalStyles = setStyle(target, openStyles, true)
}

function calculateTransform () {
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

function addGrabListeners (el) {
  el.addEventListener('mousedown', mousedownHandler)
  el.addEventListener('mousemove', mousemoveHandler)
  el.addEventListener('mouseup', mouseupHandler)
  el.addEventListener('touchstart', touchstartHandler)
  el.addEventListener('touchmove', touchmoveHandler)
  el.addEventListener('touchend', touchendHandler)
}

function removeGrabListeners (el) {
  el.removeEventListener('mousedown', mousedownHandler)
  el.removeEventListener('mousemove', mousemoveHandler)
  el.removeEventListener('mouseup', mouseupHandler)
  el.removeEventListener('touchstart', touchstartHandler)
  el.removeEventListener('touchmove', touchmoveHandler)
  el.removeEventListener('touchend', touchendHandler)
}

function processTouches (touches, cb) {
  const total = touches.length
  let i = touches.length
  let [xs, ys] = [0, 0]
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

    if (total > 1) {
      if (x < minX) minX = x
      else if (x > maxX) maxX = x

      if (y < minY) minY = y
      else if (y > maxY) maxY = y
    }
  }

  if (total > 1) {
    const [distX, distY] = [maxX - minX, maxY - minY]
    if (distX > distY) options.scaleExtra = distX / window.innerWidth
    else options.scaleExtra = distY / window.innerHeight
  }

  cb(xs/touches.length, ys/touches.length)
}

// listeners -----------------------------------------------------------------

function scrollHandler () {
  const scrollTop = window.pageYOffset ||
    (document.documentElement || body.parentNode || body).scrollTop

  if (lastScrollPosition === null) lastScrollPosition = scrollTop

  const deltaY = lastScrollPosition - scrollTop

  if (Math.abs(deltaY) >= options.scrollThreshold) {
    lastScrollPosition = null
    api.close()
  }
}

function keydownHandler (e) {
  const code = e.key || e.code
  if (code === 'Escape' || e.keyCode === 27) api.close()
}

function mousedownHandler (e) {
  e.preventDefault()

  pressTimer = setTimeout(function() {
    press = true
    api.grab(e.clientX, e.clientY, true)
  }, pressDelay)
}

function mousemoveHandler (e) {
  if (press) api.grab(e.clientX, e.clientY)
}

function mouseupHandler () {
  clearTimeout(pressTimer)
  press = false
  api.release()
}

function touchstartHandler (e) {
  e.preventDefault()

  pressTimer = setTimeout(function() {
    press = true
    processTouches(e.touches, (x, y) => api.grab(x, y, true))
  }, pressDelay)
}

function touchmoveHandler (e) {
  if (press) {
    processTouches(e.touches, (x, y) => api.grab(x, y))
  }
}

function touchendHandler (e) {
  if (e.targetTouches.length === 0) {
    clearTimeout(pressTimer)
    press = false
    options.scaleExtra = defaultScaleExtra
    if (grab) api.release()
    else api.close()
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
    ${options.transitionDuration}
    ${options.transitionTimingFunction}`
})

overlay.addEventListener('click', api.close)
document.addEventListener('DOMContentLoaded', api.listen(options.defaultZoomable))

export default api
