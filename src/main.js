import style from './_style'
import options from './_options'
import { loadImage, scrollTop, getWindowCenter, toggleListeners } from './_helpers'
import { sniffTransition, checkTrans, calculateTranslate, calculateScale } from './_trans'
import { processTouches } from './_touch'

const PRESS_DELAY = 200
const EVENT_TYPES_GRAB = [
  'mousedown', 'mousemove', 'mouseup',
  'touchstart', 'touchmove', 'touchend'
]

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
    if (code === 'Escape' || e.keyCode === 27) {
      if (released) api.close()
      else api.release(() => api.close())
    }
  },

  mousedown: function (e) {
    if (e.button !== 0) return
    e.preventDefault()

    pressTimer = setTimeout(function () {
      api.grab(e.clientX, e.clientY)
    }, PRESS_DELAY)
  },

  mousemove: function (e) {
    if (released) return
    api.move(e.clientX, e.clientY)
  },

  mouseup: function (e) {
    if (e.button !== 0) return
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

/**
 * Zooming methods.
 * @type {Object}
 */
const api = {

  /**
   * Make element(s) zoomable.
   * @param  {string|Element} el A css selector or an Element.
   * @return {api}
   */
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

  /**
   * Open (zoom in) the Element.
   * @param  {Element} el The Element to open.
   * @param  {Function} [cb=options.onOpen] A callback function that will be
   * called when a target is opened and transition has ended. It will get
   * the target element as the argument.
   * @return {api}
   */
  open: (el, cb = options.onOpen) => {
    if (shown || lock) return

    target = typeof el === 'string'
      ? document.querySelector(el)
      : el

    if (target.tagName !== 'IMG') return

    const csutomOptions = Object.assign(options)
    
    const overrideOption = ['overlay' /*, scaleBase, duration */]
    overrideOption.forEach(prop => {
      let value = null
      if ((value = target.getAttribute(`data-${prop}`)) != null) {
        csutomOptions[prop] = value
      }
    })

    const windowCenter = getWindowCenter()
    // custom scale window
    if( target.hasAttribute('data-width') && target.hasAttribute('data-height')) {
      windowCenter.x = target.getAttribute('data-width') / 2
      windowCenter.y = target.getAttribute('data-height') / 2
    }

    // onBeforeOpen event
    if (csutomOptions.onBeforeOpen) csutomOptions.onBeforeOpen(target)

    shown = true
    lock = true
    parent = target.parentNode

    // load hi-res image if preloadImage option is disabled
    if (!csutomOptions.preloadImage && target.hasAttribute('data-original')) {
      loadImage(target.getAttribute('data-original'))
    }

    const rect = target.getBoundingClientRect()
    translate = calculateTranslate(rect)
    scale = calculateScale(rect, csutomOptions.scaleBase, windowCenter)

    // force layout update
    target.offsetWidth

    style.target.open = {
      position: 'relative',
      zIndex: 999,
      cursor: csutomOptions.enableGrab ? style.cursor.grab : style.cursor.zoomOut,
      transition: `${transformCssProp}
        ${csutomOptions.transitionDuration}s
        ${csutomOptions.transitionTimingFunction}`,
      transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`
    }

    // trigger transition
    style.target.close = setStyle(target, style.target.open, true)

    // insert overlay
    parent.appendChild(overlay)
    setTimeout(() => overlay.style.opacity = csutomOptions.overlay, 30)

    document.addEventListener('scroll', eventHandler.scroll)
    document.addEventListener('keydown', eventHandler.keydown)

    target.addEventListener(transEndEvent, function onEnd () {
      target.removeEventListener(transEndEvent, onEnd)

      lock = false

      if (csutomOptions.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, eventHandler, true)
      }

      if (target.hasAttribute('data-original')) {
        srcThumbnail = target.getAttribute('src')
        const dataOriginal = target.getAttribute('data-original')
        const temp = target.cloneNode(false)

        // force compute the hi-res image in DOM to prevent
        // image flickering while updating src
        temp.setAttribute('src', dataOriginal)
        temp.style.position = 'fixed'
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

  /**
   * Close (zoom out) the Element currently opened.
   * @param  {Function} [cb=options.onClose] A callback function that will be
   * called when a target is closed and transition has ended. It will get
   * the target element as the argument.
   * @return {api}
   */
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

  /**
   * Grab the Element currently opened given a position and apply extra zoom-in.
   * @param  {number}   x The X-axis of where the press happened.
   * @param  {number}   y The Y-axis of where the press happened.
   * @param  {number}   scaleExtra Extra zoom-in to apply.
   * @param  {Function} [cb=options.scaleExtra] A callback function that will be
   * called when a target is grabbed and transition has ended. It will get
   * the target element as the argument.
   * @return {api}
   */
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

  /**
   * Move the Element currently grabbed given a position and apply extra zoom-in.
   * @param  {number}   x The X-axis of where the press happened.
   * @param  {number}   y The Y-axis of where the press happened.
   * @param  {number}   scaleExtra Extra zoom-in to apply.
   * @param  {Function} [cb=options.scaleExtra] A callback function that will be
   * called when a target is moved and transition has ended. It will get
   * the target element as the argument.
   * @return {api}
   */
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

  /**
   * Release the Element currently grabbed.
   * @param  {Function} [cb=options.onRelease] A callback function that will be
   * called when a target is released and transition has ended. It will get
   * the target element as the argument.
   * @return {api}
   */
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
  },

  /**
   * Update options.
   * @param  {Object} opts An Object that contains options.
   * @return {api}
   */
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
}

// Init ------------------------------------------------------------------------

setStyle(overlay, style.overlay.init)
overlay.setAttribute('id', 'zoom-overlay')
overlay.addEventListener('click', () => api.close())
document.addEventListener('DOMContentLoaded', () => {
  api.listen(options.defaultZoomable)
})

export default api
