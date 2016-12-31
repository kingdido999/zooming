import Target from './Target'
import Overlay from './Overlay'
import EventHandler from './EventHandler'
import { OPTIONS, EVENT_TYPES_GRAB } from './_defaults'
import { loadImage, toggleListeners, transEndEvent, cursor } from './_helpers'

/**
 * Zooming instance.
 * @param {Object} [options] Update default options if provided.
 */
function Zooming (options) {
  // elements
  this.body = document.body
  this.overlay = new Overlay(document.createElement('div'), this)
  this.target = null

  // state
  this.shown = false       // target is open
  this.lock  = false       // target is in transform
  this.released = true     // mouse/finger is not pressing down
  this.lastScrollPosition = null
  this.pressTimer = null

  this.options = Object.assign({}, OPTIONS)
  if (options) this.config(options)

  this.eventHandler = new EventHandler(this)
  this.overlay.init()
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

    el.style.cursor = cursor.zoomIn
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

    const target = typeof el === 'string'
      ? document.querySelector(el)
      : el

    if (target.tagName !== 'IMG') return

    this.target = new Target(target, this)

    // onBeforeOpen event
    if (this.options.onBeforeOpen) this.options.onBeforeOpen(target)

    this.shown = true
    this.lock = true

    this.target.open()
    this.overlay.setParent(target.parentNode)
    this.overlay.insert()
    this.overlay.show()

    document.addEventListener('scroll', this.eventHandler.scroll)
    document.addEventListener('keydown', this.eventHandler.keydown)

    const onEnd = () => {
      target.removeEventListener(transEndEvent, onEnd)

      this.lock = false

      if (this.options.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, this.eventHandler, true)
      }

      if (target.hasAttribute('data-original')) {
        this.target.upgradeSource()
      }

      if (cb) cb(target)
    }

    target.addEventListener(transEndEvent, onEnd)

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

    const target = this.target.el

    // onBeforeClose event
    if (this.options.onBeforeClose) this.options.onBeforeClose(target)

    this.lock = true

    this.body.style.cursor = cursor.default
    this.overlay.hide()
    this.target.close()

    document.removeEventListener('scroll', this.eventHandler.scroll)
    document.removeEventListener('keydown', this.eventHandler.keydown)

    const onEnd = () => {
      target.removeEventListener(transEndEvent, onEnd)

      this.shown = false
      this.lock = false

      if (this.options.enableGrab) {
        toggleListeners(document, EVENT_TYPES_GRAB, this.eventHandler, false)
      }

      if (target.hasAttribute('data-original')) {
        this.target.downgradeSource()
      }

      this.target.restoreCloseStyle()
      this.overlay.remove()

      if (cb) cb(target)
    }

    target.addEventListener(transEndEvent, onEnd)

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

    const target = this.target.el

    // onBeforeGrab event
    if (this.options.onBeforeGrab) this.options.onBeforeGrab(target)

    this.released = false
    this.target.grab(x, y, scaleExtra)

    const onEnd = () => {
      target.removeEventListener(transEndEvent, onEnd)
      if (cb) cb(target)
    }

    target.addEventListener(transEndEvent, onEnd)
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

    const target = this.target.el

    // onBeforeMove event
    if (this.options.onBeforeMove) this.options.onBeforeMove(target)

    this.released = false

    this.target.move(x, y, scaleExtra)
    this.body.style.cursor = cursor.move

    const onEnd = () => {
      target.removeEventListener(transEndEvent, onEnd)
      if (cb) cb(target)
    }

    target.addEventListener(transEndEvent, onEnd)
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

    const target = this.target.el

    // onBeforeRelease event
    if (this.options.onBeforeRelease) this.options.onBeforeRelease(target)

    this.lock = true

    this.target.restoreOpenStyle()
    this.body.style.cursor = cursor.default

    const onEnd = () => {
      target.removeEventListener(transEndEvent, onEnd)

      this.lock = false
      this.released = true

      if (cb) cb(target)
    }

    target.addEventListener(transEndEvent, onEnd)

    return this
  },

  /**
   * Update options.
   * @param  {Object} options An Object that contains this.options.
   * @return {this}
   */
  config: function (options) {
    if (!options) return this.options

    for (let key in options) {
      this.options[key] = options[key]
    }

    this.overlay.updateStyle()

    return this
  }
}

export default Zooming
