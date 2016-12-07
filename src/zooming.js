import { options } from './options'

// webkit prefix helper
const prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''

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
    this.press = false
    this._grab = false

    // style
    this.originalStyles
    this.openStyles
    this.translate
    this.scale

    this.srcThumbnail
    this.imgRect
    this.pressTimer
    this.lastScrollPosition = null

    this.pressDelay = 200

    // compatibility stuff
    const trans = this.sniffTransition(this.overlay)
    this.transitionProp = trans.transition
    this.transformProp = trans.transform
    this.transformCssProp = this.transformProp.replace(/(.*)Transform/, '-$1-transform')
    this.transEndEvent = trans.transEnd

    this.options = {}
    this.config(opts)

    this.setStyle(this.overlay, {
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
    this.mousedownHandler = this.mousedownHandler.bind(this)
    this.mousemoveHandler = this.mousemoveHandler.bind(this)
    this.mouseupHandler = this.mouseupHandler.bind(this)
    this.touchstartHandler = this.touchstartHandler.bind(this)
    this.touchmoveHandler = this.touchmoveHandler.bind(this)
    this.touchendHandler = this.touchendHandler.bind(this)
  }

  config (opts) {
    Object.assign(this.options, options)

    if (!opts) return

    for (let key in opts) {
      this.options[key] = opts[key]
    }

    this.setStyle(this.overlay, {
      backgroundColor: this.options.bgColor,
      transition: 'opacity ' +
        this.options.transitionDuration + ' ' +
        this.options.transitionTimingFunction
    })
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

    var img = new Image()

    img.onload = () => {
      this.imgRect = this.target.getBoundingClientRect()

      // upgrade source if possible
      if (this.target.hasAttribute('data-original')) {
        this.srcThumbnail = this.target.getAttribute('src')

        this.setStyle(this.target, {
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
        cursor: prefix + 'grab',
        transition: this.transformCssProp + ' ' +
          this.options.transitionDuration + ' ' +
          this.options.transitionTimingFunction,
        transform: this.calculateTransform()
      }

      // trigger transition
      this.originalStyles = this.setStyle(this.target, this.openStyles, true)
    }

    img.src = this.target.getAttribute('src')

    // insert overlay
    this.parent.appendChild(this.overlay)
    setTimeout(() => {
      this.overlay.style.opacity = this.options.bgOpacity
    }, 30)

    document.addEventListener('scroll', this.scrollHandler)
    document.addEventListener('keydown', this.keydownHandler)

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)
      this.target.addEventListener('mousedown', this.mousedownHandler)
      this.target.addEventListener('mousemove', this.mousemoveHandler)
      this.target.addEventListener('mouseup', this.mouseupHandler)
      this.target.addEventListener('touchstart', this.touchstartHandler)
      this.target.addEventListener('touchmove', this.touchmoveHandler)
      this.target.addEventListener('touchend', this.touchendHandler)

      this._lock = false
      cb = cb || this.options.onOpen
      if (cb) cb(this.target)
    }

    this.target.addEventListener(this.transEndEvent, onEnd)

    return this
  }

  close (cb) {
    if (!this._shown || this._lock || this._grab) return
    this._lock = true

    // onBeforeClose event
    if (this.options.onBeforeClose) this.options.onBeforeClose(this.target)

    // remove overlay
    this.overlay.style.opacity = 0

    this.target.style.transform = ''

    document.removeEventListener('scroll', this.scrollHandler)
    document.removeEventListener('keydown', this.keydownHandler)

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)
      this.target.removeEventListener('mousedown', this.mousedownHandler)
      this.target.removeEventListener('mousemove', this.mousemoveHandler)
      this.target.removeEventListener('mouseup', this.mouseupHandler)
      this.target.removeEventListener('touchstart', this.touchstartHandler)
      this.target.removeEventListener('touchmove', this.touchmoveHandler)
      this.target.removeEventListener('touchend', this.touchendHandler)

      this.setStyle(this.target, this.originalStyles)
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
    }

    this.target.addEventListener(this.transEndEvent, onEnd)

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

    this.setStyle(this.target, {
      cursor: prefix + 'grabbing',
      transition: this.transformCssProp + ' ' + (
        start
        ? this.options.transitionDuration + ' ' + this.options.transitionTimingFunction
        : 'ease'
      ),
      transform: transform
    })

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)
      cb = cb || this.options.onGrab
      if (cb) cb(this.target)
    }

    this.target.addEventListener(this.transEndEvent, onEnd)
  }

  release (cb) {
    if (!this._shown || this._lock || !this._grab) return

    // onBeforeRelease event
    if (this.options.onBeforeRelease) this.options.onBeforeRelease(this.target)

    this.setStyle(this.target, this.openStyles)

    const onEnd = () => {
      this.target.removeEventListener(this.transEndEvent, onEnd)
      this._grab = false

      cb = typeof cb === 'function'
        ? cb
        : this.options.onRelease
      if (cb) cb(this.target)
    }

    this.target.addEventListener(this.transEndEvent, onEnd)

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

  // helpers -------------------------------------------------------------------

  setStyle (el, styles, remember) {
    this.checkTrans(styles)
    let s = el.style
    let original = {}

    for (var key in styles) {
      if (remember) original[key] = s[key] || ''
      s[key] = styles[key]
    }

    return original
  }

  sniffTransition (el) {
    let ret   = {}
    const trans = ['webkitTransition', 'transition', 'mozTransition']
    const tform = ['webkitTransform', 'transform', 'mozTransform']
    const end   = {
      'transition'       : 'transitionend',
      'mozTransition'    : 'transitionend',
      'webkitTransition' : 'webkitTransitionEnd'
    }

    trans.some((prop) => {
      if (el.style[prop] !== undefined) {
        ret.transition = prop
        ret.transEnd = end[prop]
        return true
      }
    })

    tform.some((prop) => {
      if (el.style[prop] !== undefined) {
        ret.transform = prop
        return true
      }
    })

    return ret
  }

  checkTrans (styles) {
    var value
    if (styles.transition) {
      value = styles.transition
      delete styles.transition
      styles[this.transitionProp] = value
    }
    if (styles.transform) {
      value = styles.transform
      delete styles.transform
      styles[this.transformProp] = value
    }
  }

  calculateTransform () {
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

  // listeners -----------------------------------------------------------------

  scrollHandler () {
    var scrollTop = window.pageYOffset ||
      (document.documentElement || this.body.parentNode || this.body).scrollTop

    if (this.lastScrollPosition === null) this.lastScrollPosition = scrollTop

    var deltaY = this.lastScrollPosition - scrollTop

    if (Math.abs(deltaY) >= this.options.scrollThreshold) {
      this.lastScrollPosition = null
      this.close()
    }
  }

  keydownHandler (e) {
    var code = e.key || e.code
    if (code === 'Escape' || e.keyCode === 27) this.close()
  }

  mousedownHandler (e) {
    e.preventDefault()

    this.pressTimer = setTimeout(() => {
      this.press = true
      this.grab(e.clientX, e.clientY, true)
    }, this.pressDelay)
  }

  mousemoveHandler (e) {
    if (this.press) this.grab(e.clientX, e.clientY)
  }

  mouseupHandler () {
    clearTimeout(this.pressTimer)
    this.press = false
    this.release()
  }

  touchstartHandler (e) {
    e.preventDefault()

    this.pressTimer = setTimeout(() => {
      this.press = true
      var touch = e.touches[0]
      this.grab(touch.clientX, touch.clientY, true)
    }, this.pressDelay)
  }

  touchmoveHandler (e) {
    if (this.press) {
      var touch = e.touches[0]
      this.grab(touch.clientX, touch.clientY)
    }
  }

  touchendHandler () {
    clearTimeout(this.pressTimer)
    this.press = false
    if (this._grab) this.release()
    else this.close()
  }
}
