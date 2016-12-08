import { prefix, pressDelay, defaults, sniffTransition, checkTrans } from './helpers'

export default class Zooming {
  constructor(opts) {

    // elements
    this.body = document.body
    this.overlay = document.createElement('div')
    this.target
    this.parent

    // state
    this._shown = false
    this._lock  = false
    this._press = false
    this._grab  = false
    this._lastScrollPosition = null

    // style
    this.originalStyles
    this.openStyles
    this.translate
    this.scale

    this.srcThumbnail
    this.imgRect
    this.pressTimer

    this.trans = sniffTransition(this.overlay)
    this.setStyleHelper = checkTrans(this.trans.transitionProp, this.trans.transformProp)

    this._init(opts)
  }

  config (opts) {
    if (!opts) return this

    for (let key in opts) {
      this.options[key] = opts[key]
    }

    this._setStyle(this.overlay, {
      backgroundColor: this.options.bgColor,
      transition: 'opacity ' +
        this.options.transitionDuration + ' ' +
        this.options.transitionTimingFunction
    })

    return this
  }

  open (el, cb) {
    if (this._shown || this._lock || this._grab) return

    this.target = typeof el === 'string'
      ? document.querySelector(el)
      : el

    if (this.target.tagName !== 'IMG') return

    // onBeforeOpen event
    if (this.options.onBeforeOpen) this.options.onBeforeOpen(this.target)

    this._shown = true
    this._lock = true
    this.parent = this.target.parentNode

    const img = new Image()
    img.onload = this._imgOnload()
    img.src = this.target.getAttribute('src')

    this._insertOverlay()

    document.addEventListener('scroll', this.scrollHandler)
    document.addEventListener('keydown', this.keydownHandler)

    this.target.addEventListener(this.trans.transEndEvent, (function onEnd () {
      this.target.removeEventListener(this.trans.transEndEvent, onEnd)
      if (this.options.enableGrab) this._addGrabListeners()

      this._lock = false
      cb = cb || this.options.onOpen
      if (cb) cb(this.target)
    }).bind(this))

    return this
  }

  close (cb) {
    if (!this._shown || this._lock || this._grab) return
    this._lock = true

    // onBeforeClose event
    if (this.options.onBeforeClose) this.options.onBeforeClose(this.target)

    this._removeOverlay()

    this.target.style.transform = ''

    document.removeEventListener('scroll', this.scrollHandler)
    document.removeEventListener('keydown', this.keydownHandler)

    this.target.addEventListener(this.trans.transEndEvent, (function onEnd () {
      this.target.removeEventListener(this.trans.transEndEvent, onEnd)
      if (this.options.enableGrab) this._removeGrabListeners()

      this._setStyle(this.target, this.originalStyles)
      this.parent.removeChild(this.overlay)
      this._shown = false
      this._lock = false
      this._grab = false

      // downgrade source if possible
      if (this.target.hasAttribute('data-original')) {
        this.target.setAttribute('src', this.srcThumbnail)
      }

      cb = typeof cb === 'function'
        ? cb
        : this.options.onClose
      if (cb) cb(this.target)
    }).bind(this))

    return this
  }

  grab (x, y, start, cb) {
    if (!this._shown || this._lock) return
    this._grab = true

    // onBeforeGrab event
    if (this.options.onBeforeGrab) this.options.onBeforeGrab(this.target)

    const dx = x - window.innerWidth / 2
    const dy = y - window.innerHeight / 2
    const oldTransform = this.target.style.transform
    const transform = oldTransform
          .replace(
            /translate3d\(.*?\)/i,
            'translate3d(' + (this.translate.x + dx) + 'px,' + (this.translate.y + dy) + 'px, 0)')
          .replace(
            /scale\([0-9|\.]*\)/i,
            'scale(' + (this.scale + this.options.scaleExtra) + ')')

    this._setStyle(this.target, {
      cursor: prefix + 'grabbing',
      transition: this.trans.transformCssProp + ' ' + (
        start
        ? this.options.transitionDuration + ' ' + this.options.transitionTimingFunction
        : 'ease'
      ),
      transform: transform
    })

    this.target.addEventListener(this.trans.transEndEvent, (function onEnd () {
      this.target.removeEventListener(this.trans.transEndEvent, onEnd)

      cb = typeof cb === 'function'
        ? cb
        : this.options.onGrab
      if (cb) cb(this.target)
    }).bind(this))
  }

  release (cb) {
    if (!this._shown || this._lock || !this._grab) return

    // onBeforeRelease event
    if (this.options.onBeforeRelease) this.options.onBeforeRelease(this.target)

    this._setStyle(this.target, this.openStyles)

    this.target.addEventListener(this.trans.transEndEvent, (function onEnd () {
      this.target.removeEventListener(this.trans.transEndEvent, onEnd)
      this._grab = false

      cb = typeof cb === 'function'
        ? cb
        : this.options.onRelease
      if (cb) cb(this.target)
    }).bind(this))

    return this
  }

  listen (el) {
    if (typeof el === 'string') {
      const els = document.querySelectorAll(el)
      let i = els.length

      while (i--) {
        this.listen(els[i])
      }

      return this
    }

    el.style.cursor = prefix + 'zoom-in'

    el.addEventListener('click', (e) => {
      e.preventDefault()

      if (this._shown) this.close()
      else this.open(el)
    })

    return this
  }

  _init (opts) {
    // config options
    this.options = {}
    Object.assign(this.options, defaults)
    this.config(opts)

    // initial overlay setup
    this._setStyle(this.overlay, {
      zIndex: 998,
      background: this.options.bgColor,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0,
      transition: 'opacity ' +
        this.options.transitionDuration + ' ' +
        this.options.transitionTimingFunction
    })

    this.overlay.addEventListener('click', this.close)

    this.scrollHandler = this.scrollHandler.bind(this)
    this.keydownHandler = this.keydownHandler.bind(this)

    if (this.options.enableGrab) {
      this.mousedownHandler = this.mousedownHandler.bind(this)
      this.mousemoveHandler = this.mousemoveHandler.bind(this)
      this.mouseupHandler = this.mouseupHandler.bind(this)
      this.touchstartHandler = this.touchstartHandler.bind(this)
      this.touchmoveHandler = this.touchmoveHandler.bind(this)
      this.touchendHandler = this.touchendHandler.bind(this)
    }
  }

  _imgOnload () {
    this.imgRect = this.target.getBoundingClientRect()

    // upgrade source if possible
    if (this.target.hasAttribute('data-original')) {
      this.srcThumbnail = this.target.getAttribute('src')

      this._setStyle(this.target, {
        width: this.imgRect.width + 'px',
        height: this.imgRect.height + 'px'
      })

      this.target.setAttribute('src', this.target.getAttribute('data-original'))
    }

    // force layout update
    this.target.offsetWidth

    this.openStyles = {
      position: 'relative',
      zIndex: 999,
      cursor: prefix + (this.options.enableGrab ? 'grab' : 'zoom-out'),
      transition: this.trans.transformCssProp + ' ' +
        this.options.transitionDuration + ' ' +
        this.options.transitionTimingFunction,
      transform: this._calculateTransform()
    }

    // trigger transition
    this.originalStyles = this._setStyle(this.target, this.openStyles, true)
  }

  _insertOverlay () {
    this.parent.appendChild(this.overlay)

    setTimeout(() => {
      this.overlay.style.opacity = this.options.bgOpacity
    }, 30)
  }

  _removeOverlay () {
    this.overlay.style.opacity = 0
  }

  _setStyle (el, styles, remember) {
    return this.setStyleHelper(el, styles, remember)
  }

  _calculateTransform () {
    const imgHalfWidth = this.imgRect.width / 2
    const imgHalfHeight = this.imgRect.height / 2

    const imgCenter = {
      x: this.imgRect.left + imgHalfWidth,
      y: this.imgRect.top + imgHalfHeight
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
    this.translate = {
      x: windowCenter.x - imgCenter.x,
      y: windowCenter.y - imgCenter.y
    }

    // The additional scale is based on the smaller value of
    // scaling horizontally and scaling vertically
    this.scale = this.options.scaleBase + Math.min(scaleHorizontally, scaleVertically)

    const transform =
        'translate3d(' + this.translate.x + 'px,' + this.translate.y + 'px, 0) ' +
        'scale(' + this.scale + ')'

    return transform
  }

  _addGrabListeners () {
    this.target.addEventListener('mousedown', this.mousedownHandler)
    this.target.addEventListener('mousemove', this.mousemoveHandler)
    this.target.addEventListener('mouseup', this.mouseupHandler)
    this.target.addEventListener('touchstart', this.touchstartHandler)
    this.target.addEventListener('touchmove', this.touchmoveHandler)
    this.target.addEventListener('touchend', this.touchendHandler)
  }

  _removeGrabListeners () {
    this.target.removeEventListener('mousedown', this.mousedownHandler)
    this.target.removeEventListener('mousemove', this.mousemoveHandler)
    this.target.removeEventListener('mouseup', this.mouseupHandler)
    this.target.removeEventListener('touchstart', this.touchstartHandler)
    this.target.removeEventListener('touchmove', this.touchmoveHandler)
    this.target.removeEventListener('touchend', this.touchendHandler)
  }

  // listeners -----------------------------------------------------------------

  scrollHandler () {
    const scrollTop = window.pageYOffset ||
      (document.documentElement || this.body.parentNode || this.body).scrollTop

    if (this._lastScrollPosition === null) this._lastScrollPosition = scrollTop

    const deltaY = this._lastScrollPosition - scrollTop

    if (Math.abs(deltaY) >= this.options.scrollThreshold) {
      this._lastScrollPosition = null
      this.close()
    }
  }

  keydownHandler (e) {
    const code = e.key || e.code
    if (code === 'Escape' || e.keyCode === 27) this.close()
  }

  mousedownHandler (e) {
    e.preventDefault()

    this.pressTimer = setTimeout(() => {
      this._press = true
      this.grab(e.clientX, e.clientY, true)
    }, pressDelay)
  }

  mousemoveHandler (e) {
    if (this._press) this.grab(e.clientX, e.clientY)
  }

  mouseupHandler () {
    clearTimeout(this.pressTimer)
    this._press = false
    this.release()
  }

  touchstartHandler (e) {
    e.preventDefault()

    this.pressTimer = setTimeout(() => {
      this._press = true
      const touch = e.touches[0]
      this.grab(touch.clientX, touch.clientY, true)
    }, pressDelay)
  }

  touchmoveHandler (e) {
    if (this._press) {
      const touch = e.touches[0]
      this.grab(touch.clientX, touch.clientY)
    }
  }

  touchendHandler () {
    clearTimeout(this.pressTimer)
    this._press = false
    if (this._grab) this.release()
    else this.close()
  }
}
