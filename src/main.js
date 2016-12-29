import Style from './_style'
import EventHandler from './_eventHandler'
import { OPTIONS, EVENT_TYPES_GRAB } from './_defaults'
import { loadImage, getWindowCenter, toggleListeners } from './_helpers'
import { sniffTransition, checkTrans, calculateTranslate, calculateScale } from './_trans'

/**
 * Zooming instance.
 * @param {Object} [options] Update default options if provided.
 */
function Zooming (options) {
  this.options = Object.assign({}, OPTIONS)
  if (options) this.config(options)

  // elements
  this.body = document.body
  this.overlay = document.createElement('div')
  this.target = null
  this.parent = null

  // state
  this.shown = false       // target is open
  this.lock  = false       // target is in transform
  this.released = true     // mouse/finger is not pressing down
  this.lastScrollPosition = null
  this.translate = null
  this.scale = null
  this.srcThumbnail = null
  this.pressTimer = null

  this.style = new Style(this.options)
  this.eventHandler = new EventHandler(this)

  const trans = sniffTransition(this.overlay)
  const setStyleHelper = checkTrans(trans.transitionProp, trans.transformProp)
  this.transformCssProp = trans.transformCssProp
  this.transEndEvent = trans.transEndEvent
  this.setStyle = (el, styles, remember) => {
    return setStyleHelper(el, styles, remember)
  }

  // init overlay
  this.setStyle(this.overlay, this.style.overlay.init)
  this.overlay.addEventListener('click', () => this.close())
}

Zooming.prototype = {

  /**
   * Make element(s) zoomable.
   * @param  {string|Element} el A css selector or an Element.
   * @return {this}
   */
  listen: function (el) {
    if (typeof el === 'string') {
      let els = document.querySelectorAll(el), i = els.length

      while (i--) {
        this.listen(els[i])
      }

      return this
    }

    if (el.tagName !== 'IMG') return

    el.style.cursor = this.style.cursor.zoomIn

    el.addEventListener('click', this.eventHandler.click)

    if (this.options.preloadImage && el.hasAttribute('data-original')) {
      loadImage(el.getAttribute('data-original'))
    }

    return this
  },

  /**
   * Open (zoom in) the Element.
   * @param  {Element} el The Element to open.
   * @param  {Function} [cb=this.options.onOpen] A callback function that will
   * be called when a target is opened and transition has ended. It will get
   * the target element as the argument.
   * @return {this}
   */
  open: function (el, cb = this.options.onOpen) {
    if (this.shown || this.lock) return

    this.target = typeof el === 'string'
      ? document.querySelector(el)
      : el

    if (this.target.tagName !== 'IMG') return

    // onBeforeOpen event
    if (this.options.onBeforeOpen) this.options.onBeforeOpen(this.target)

    this.shown = true
    this.lock = true
    this.parent = this.target.parentNode

    // load hi-res image if preloadImage option is disabled
    if (!this.options.preloadImage && this.target.hasAttribute('data-original')) {
      loadImage(this.target.getAttribute('data-original'))
    }

    const rect = this.target.getBoundingClientRect()
    this.translate = calculateTranslate(rect)
    this.scale = calculateScale(rect, this.options.scaleBase)

    // force layout update
    this.target.offsetWidth

    this.style.target.open = {
      position: 'relative',
      zIndex: 999,
      cursor: this.options.enableGrab
        ? this.style.cursor.grab
        : this.style.cursor.zoomOut,
      transition: `${this.transformCssProp}
        ${this.options.transitionDuration}s
        ${this.options.transitionTimingFunction}`,
      transform: `translate(${this.translate.x}px, ${this.translate.y}px)
        scale(${this.scale})`
    }

    // trigger transition
    this.style.target.close = this.setStyle(this.target, this.style.target.open, true)

    // insert this.overlay
    this.parent.appendChild(this.overlay)
    setTimeout(() => this.overlay.style.opacity = this.options.bgOpacity, 30)

    document.addEventListener('scroll', this.eventHandler.scroll)
    document.addEventListener('keydown', this.eventHandler.keydown)

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)

      this.lock = false

      if (this.options.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, this.eventHandler, true)
      }

      if (this.target.hasAttribute('data-original')) {
        this.srcThumbnail = this.target.getAttribute('src')
        const dataOriginal = this.target.getAttribute('data-original')
        const temp = this.target.cloneNode(false)

        // force compute the hi-res image in DOM to prevent
        // image flickering while updating src
        temp.setAttribute('src', dataOriginal)
        temp.style.position = 'fixed'
        temp.style.visibility = 'hidden'
        this.body.appendChild(temp)

        setTimeout(() => {
          this.target.setAttribute('src', dataOriginal)
          this.body.removeChild(temp)
        }, 10)
      }

      if (cb) cb(this.target)
    }

    this.target.addEventListener(this.transEndEvent, onEnd)

    return this
  },

  /**
   * Close (zoom out) the Element currently opened.
   * @param  {Function} [cb=this.options.onClose] A callback function that will
   * be called when a target is closed and transition has ended. It will get
   * the target element as the argument.
   * @return {this}
   */
  close: function (cb = this.options.onClose) {
    if (!this.shown || this.lock) return

    // onBeforeClose event
    if (this.options.onBeforeClose) this.options.onBeforeClose(this.target)

    this.lock = true

    // force layout update
    this.target.offsetWidth

    this.body.style.cursor = this.style.cursor.default
    this.overlay.style.opacity = 0
    this.setStyle(this.target, { transform: 'none' })

    document.removeEventListener('scroll', this.eventHandler.scroll)
    document.removeEventListener('keydown', this.eventHandler.keydown)

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)

      this.shown = false
      this.lock = false

      if (this.options.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, this.eventHandler, false)
      }

      if (this.target.hasAttribute('data-original')) {
        // downgrade source
        this.target.setAttribute('src', this.srcThumbnail)
      }

      // trigger transition
      this.setStyle(this.target, this.style.target.close)

      // remove overlay
      this.parent.removeChild(this.overlay)

      if (cb) cb(this.target)
    }

    this.target.addEventListener(this.transEndEvent, onEnd)

    return this
  },

  /**
   * Grab the Element currently opened given a position and apply extra zoom-in.
   * @param  {number}   x The X-axis of where the press happened.
   * @param  {number}   y The Y-axis of where the press happened.
   * @param  {number}   scaleExtra Extra zoom-in to apply.
   * @param  {Function} [cb=this.options.scaleExtra] A callback function that
   * will be called when a target is grabbed and transition has ended. It
   * will get the target element as the argument.
   * @return {this}
   */
  grab: function (x, y, scaleExtra = this.options.scaleExtra, cb) {
    if (!this.shown || this.lock) return

    // onBeforeGrab event
    if (this.options.onBeforeGrab) this.options.onBeforeGrab(this.target)

    this.released = false

    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    this.setStyle(this.target, {
      cursor: this.style.cursor.move,
      transform: `translate(
        ${this.translate.x + dx}px, ${this.translate.y + dy}px)
        scale(${this.scale + scaleExtra})`
    })

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)
      if (cb) cb(this.target)
    }

    this.target.addEventListener(this.transEndEvent, onEnd)
  },

  /**
   * Move the Element currently grabbed given a position and apply extra zoom-in.
   * @param  {number}   x The X-axis of where the press happened.
   * @param  {number}   y The Y-axis of where the press happened.
   * @param  {number}   scaleExtra Extra zoom-in to apply.
   * @param  {Function} [cb=this.options.scaleExtra] A callback function that
   * will be called when a target is moved and transition has ended. It will
   * get the target element as the argument.
   * @return {this}
   */
  move: function (x, y, scaleExtra = this.options.scaleExtra, cb) {
    if (!this.shown || this.lock) return

    // onBeforeMove event
    if (this.options.onBeforeMove) this.options.onBeforeMove(this.target)

    this.released = false

    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    this.setStyle(this.target, {
      transition: this.transformCssProp,
      transform: `translate(
        ${this.translate.x + dx}px, ${this.translate.y + dy}px)
        scale(${this.scale + scaleExtra})`
    })

    this.body.style.cursor = this.style.cursor.move

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)
      if (cb) cb(this.target)
    }

    this.target.addEventListener(this.transEndEvent, onEnd)
  },

  /**
   * Release the Element currently grabbed.
   * @param  {Function} [cb=this.options.onRelease] A callback function that
   * will be called when a target is released and transition has ended. It
   * will get the target element as the argument.
   * @return {this}
   */
  release: function (cb = this.options.onRelease) {
    if (!this.shown || this.lock) return

    // onBeforeRelease event
    if (this.options.onBeforeRelease) this.options.onBeforeRelease(this.target)

    this.lock = true

    this.setStyle(this.target, this.style.target.open)
    this.body.style.cursor = this.style.cursor.default

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)

      this.lock = false
      this.released = true

      if (cb) cb(this.target)
    }

    this.target.addEventListener(this.transEndEvent, onEnd)

    return this
  },

  /**
   * Update this.options.
   * @param  {Object} options An Object that contains this.options.
   * @return {this}
   */
  config: function (options) {
    if (!options) return this.options

    for (let key in options) {
      this.options[key] = options[key]
    }

    this.setStyle(this.overlay, {
      backgroundColor: this.options.bgColor,
      transition: `opacity
        ${this.options.transitionDuration}s
        ${this.options.transitionTimingFunction}`
    })

    return this
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Zooming().listen(OPTIONS.defaultZoomable)
})

export default Zooming
