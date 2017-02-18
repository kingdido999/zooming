import { isNotImage, loadImage, checkOriginalImage } from './util/_image'
import { cursor, toggleGrabListeners } from './util/_helpers'
import { transEndEvent } from './util/_trans'
import { isString } from './util/_dom'

import EventHandler from './EventHandler'
import Overlay from './Overlay'
import Target from './Target'

import DEFAULT_OPTIONS from './_options'

/**
 * Zooming instance.
 */
export default class Zooming {

  /**
   * @param {Object} [options] Update default options if provided.
   */
  constructor (options) {

    // elements
    this.target = null
    this.overlay = new Overlay(document.createElement('div'), this)
    this.eventHandler = new EventHandler(this)
    this.body = document.body

    // state
    this.shown = false       // target is open
    this.lock  = false       // target is in transform
    this.released = true     // mouse/finger is not pressing down
    this.lastScrollPosition = null
    this.pressTimer = null

    // init
    this.options = Object.assign({}, DEFAULT_OPTIONS)
    this.config(options)
    this.listen(this.options.defaultZoomable)
    this.overlay.init(this.options)
  }

  /**
   * Make element(s) zoomable.
   * @param  {string|Element} el A css selector or an Element.
   * @return {this}
   */
  listen (el) {
    if (isString(el)) {
      let els = document.querySelectorAll(el), i = els.length

      while (i--) {
        this.listen(els[i])
      }

      return this
    }

    if (isNotImage(el)) return

    el.style.cursor = cursor.zoomIn
    el.addEventListener('click', this.eventHandler.click, { passive: false })

    if (this.options.preloadImage) {
      checkOriginalImage(el, loadImage)
    }

    return this
  }

  /**
   * Update options.
   * @param  {Object} options An Object that contains this.options.
   * @return {this}
   */
  config (options) {
    if (!options) return this.options

    Object.assign(this.options, options)
    this.overlay.updateStyle(this.options)

    return this
  }

  /**
   * Open (zoom in) the Element.
   * @param  {Element} el The Element to open.
   * @param  {Function} [cb=this.options.onOpen] A callback function that will
   * be called when a target is opened and transition has ended. It will get
   * the target element as the argument.
   * @return {this}
   */
  open (el, cb = this.options.onOpen) {
    if (this.shown || this.lock) return

    const target = isString(el)
      ? document.querySelector(el)
      : el

    if (isNotImage(target)) return

    // onBeforeOpen event
    if (this.options.onBeforeOpen) this.options.onBeforeOpen(target)

    if (!this.options.preloadImage) {
      checkOriginalImage(target, loadImage)
    }

    this.target = new Target(target, this)

    this.shown = true
    this.lock = true

    this.target.zoomIn()
    this.overlay.insert()
    this.overlay.show()

    document.addEventListener('scroll', this.eventHandler.scroll)
    document.addEventListener('keydown', this.eventHandler.keydown)

    const onEnd = () => {
      target.removeEventListener(transEndEvent, onEnd)

      this.lock = false

      checkOriginalImage(target, srcOriginal => this.target.upgradeSource(srcOriginal))

      if (this.options.enableGrab) {
        toggleGrabListeners(document, this.eventHandler, true)
      }

      if (cb) cb(target)
    }

    target.addEventListener(transEndEvent, onEnd)

    return this
  }

  /**
   * Close (zoom out) the Element currently opened.
   * @param  {Function} [cb=this.options.onClose] A callback function that will
   * be called when a target is closed and transition has ended. It will get
   * the target element as the argument.
   * @return {this}
   */
  close (cb = this.options.onClose) {
    if (!this.shown || this.lock) return

    const target = this.target.el

    // onBeforeClose event
    if (this.options.onBeforeClose) this.options.onBeforeClose(target)

    this.lock = true

    this.body.style.cursor = cursor.default
    this.overlay.hide()
    this.target.zoomOut()

    document.removeEventListener('scroll', this.eventHandler.scroll)
    document.removeEventListener('keydown', this.eventHandler.keydown)

    const onEnd = () => {
      target.removeEventListener(transEndEvent, onEnd)

      this.shown = false
      this.lock = false

      checkOriginalImage(target, srcOriginal => this.target.downgradeSource(srcOriginal))

      if (this.options.enableGrab) {
        toggleGrabListeners(document, this.eventHandler, false)
      }

      this.target.restoreCloseStyle()
      this.overlay.remove()

      if (cb) cb(target)
    }

    target.addEventListener(transEndEvent, onEnd)

    return this
  }

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
  grab (x, y, scaleExtra = this.options.scaleExtra, cb) {
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
  }

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
  move (x, y, scaleExtra = this.options.scaleExtra, cb) {
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
  }

  /**
   * Release the Element currently grabbed.
   * @param  {Function} [cb=this.options.onRelease] A callback function that
   * will be called when a target is released and transition has ended. It
   * will get the target element as the argument.
   * @return {this}
   */
  release (cb = this.options.onRelease) {
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
  }
}
