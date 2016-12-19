import style from './_style'
import { PRESS_DELAY, EVENT_TYPES_GRAB, options } from './_defaults'
import { loadImage, scrollTop, getWindowCenter, toggleListeners } from './_helpers'
import { sniffTransition, checkTrans, calculateTranslate, calculateScale } from './_trans'
import { processTouches } from './_touch'

// elements
const body = document.body
const overlay = document.createElement('div')
let target, parent

// state
let shown = false       // target is open
let lock  = false       // target is in transform
let released = true     // mouse/finger is not pressing down
let lastScrollPosition = null
let translate, scale, srcThumbnail, pressTimer

const trans = sniffTransition(overlay)
const transformCssProp = trans.transformCssProp
const transEndEvent = trans.transEndEvent
const setStyleHelper = checkTrans(trans.transitionProp, trans.transformProp)

const setStyle = (el, styles, remember) => {
  return setStyleHelper(el, styles, remember)
}

// Event handler ---------------------------------------------------------------

const eventHandler = {

  click: function (e) {
    e.preventDefault()

    if (shown) {
      if (released) api.close()
      else api.release()
    } else {
      api.open(e.currentTarget)
    }
  },

  scroll: function () {
    const st = scrollTop()

    if (lastScrollPosition === null) {
      lastScrollPosition = st
    }

    const deltaY = lastScrollPosition - st

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
      api.grab(e.clientX, e.clientY)
    }, PRESS_DELAY)
  },

  mousemove: function (e) {
    if (released) return
    api.move(e.clientX, e.clientY)
  },

  mouseup: function () {
    clearTimeout(pressTimer)

    if (released) api.close()
    else api.release()
  },

  touchstart: function (e) {
    e.preventDefault()

    pressTimer = setTimeout(() => {
      processTouches(e.touches, (x, y, scaleExtra) => {
        api.grab(x, y, scaleExtra)
      })
    }, PRESS_DELAY)
  },

  touchmove: function (e) {
    if (released) return

    processTouches(e.touches, (x, y, scaleExtra) => {
      api.move(x, y, scaleExtra)
    })
  },

  touchend: function (e) {
    if (e.targetTouches.length > 0) return
    clearTimeout(pressTimer)

    if (released) api.close()
    else api.release()
  }
}

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

    el.style.cursor = style.cursor.zoomIn

    el.addEventListener('click', eventHandler.click)

    if (options.preloadImage && el.hasAttribute('data-original')) {
      loadImage(el.getAttribute('data-original'))
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

    // load hi-res image if preloadImage option is disabled
    if (!options.preloadImage && target.hasAttribute('data-original')) {
      loadImage(target.getAttribute('data-original'))
    }

    const rect = target.getBoundingClientRect()
    translate = calculateTranslate(rect)
    scale = calculateScale(rect, options.scaleBase)

    // force layout update
    target.offsetWidth

    style.target.open = {
      position: 'relative',
      zIndex: 999,
      cursor: options.enableGrab ? style.cursor.grab : style.cursor.zoomOut,
      transition: `${transformCssProp}
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`,
      transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`
    }

    // trigger transition
    style.target.close = setStyle(target, style.target.open, true)

    // insert overlay
    parent.appendChild(overlay)
    setTimeout(() => overlay.style.opacity = options.bgOpacity, 30)

    document.addEventListener('scroll', eventHandler.scroll)
    document.addEventListener('keydown', eventHandler.keydown)

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      lock = false

      if (options.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, eventHandler, true)
      }

      if (target.hasAttribute('data-original')) {
        srcThumbnail = target.getAttribute('src')
        const dataOriginal = target.getAttribute('data-original')
        const temp = target.cloneNode(false)

        // force compute the hi-res image in DOM to prevent
        // image flickering while updating src
        temp.setAttribute('src', dataOriginal)
        temp.style.position = 'absolute'
        temp.style.visibility = 'hidden'
        body.appendChild(temp)

        setTimeout(() => {
          target.setAttribute('src', dataOriginal)
          body.removeChild(temp)
        }, 10)
      }

      if (cb) cb(target)
    })

    return this
  },

  close: (cb = options.onClose) => {
    if (!shown || lock) return

    // onBeforeClose event
    if (options.onBeforeClose) options.onBeforeClose(target)

    lock = true

    // force layout update
    target.offsetWidth

    body.style.cursor = style.cursor.default
    overlay.style.opacity = 0
    setStyle(target, { transform: 'none' })

    document.removeEventListener('scroll', eventHandler.scroll)
    document.removeEventListener('keydown', eventHandler.keydown)

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      shown = false
      lock = false

      if (options.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, eventHandler, false)
      }

      if (target.hasAttribute('data-original')) {
        // downgrade source
        target.setAttribute('src', srcThumbnail)
      }

      // trigger transition
      setStyle(target, style.target.close)

      // remove overlay
      parent.removeChild(overlay)

      if (cb) cb(target)
    })

    return this
  },

  grab: (x, y, scaleExtra = options.scaleExtra, cb) => {
    if (!shown || lock) return

    // onBeforeGrab event
    if (options.onBeforeGrab) options.onBeforeGrab(target)

    released = false

    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(target, {
      cursor: style.cursor.move,
      transform: `translate(${translate.x + dx}px, ${translate.y + dy}px)
        scale(${scale + scaleExtra})`
    })

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)
      if (cb) cb(target)
    })
  },

  move: (x, y, scaleExtra = options.scaleExtra, cb) => {
    if (!shown || lock) return

    // onBeforeMove event
    if (options.onBeforeMove) options.onBeforeMove(target)

    released = false

    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(target, {
      transition: transformCssProp,
      transform: `translate(${translate.x + dx}px, ${translate.y + dy}px)
        scale(${scale + scaleExtra})`
    })

    body.style.cursor = style.cursor.move

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)
      if (cb) cb(target)
    })
  },

  release: (cb = options.onRelease) => {
    if (!shown || lock) return

    // onBeforeRelease event
    if (options.onBeforeRelease) options.onBeforeRelease(target)

    lock = true

    setStyle(target, style.target.open)
    body.style.cursor = style.cursor.default

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      lock = false
      released = true

      if (cb) cb(target)
    })

    return this
  }
}

// Init ------------------------------------------------------------------------

setStyle(overlay, style.overlay.init)
overlay.setAttribute('id', 'zoom-overlay')
overlay.addEventListener('click', () => api.close())
document.addEventListener('DOMContentLoaded', () => {
  api.listen(options.defaultZoomable)
})

export default api
