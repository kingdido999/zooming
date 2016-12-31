import { transformCssProp, setStyle, getWindowCenter, loadImage } from './_helpers'
import { calculateTranslate, calculateScale } from './_trans'

function Target (el, instance) {
  this.el = el
  this.instance = instance
  this.body = document.body
  this.translate = null
  this.scale = null
  this.srcThumbnail = null
  this.style = {
    open: null,
    close: null
  }
}

Target.prototype = {

  open: function () {
    const options = this.instance.options
    const style = this.instance.style

    // load hi-res image if preloadImage option is disabled
    if (!options.preloadImage && this.el.hasAttribute('data-original')) {
      loadImage(this.el.getAttribute('data-original'))
    }

    const rect = this.el.getBoundingClientRect()
    this.translate = calculateTranslate(rect)
    this.scale = calculateScale(rect, options.scaleBase, options.customSize)

    // force layout update
    this.el.offsetWidth

    this.style.open = {
      position: 'relative',
      zIndex: 999,
      cursor: options.enableGrab
        ? style.cursor.grab
        : style.cursor.zoomOut,
      transition: `${transformCssProp}
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`,
      transform: `translate(${this.translate.x}px, ${this.translate.y}px)
        scale(${this.scale.x},${this.scale.y})`
    }

    // trigger transition
    this.style.close = setStyle(this.el, this.style.open, true)
  },

  close: function () {
    setStyle(this.el, { transform: 'none' })
  },

  grab: function (x, y, scaleExtra) {
    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(this.el, {
      cursor: this.instance.style.cursor.move,
      transform: `translate(
        ${this.translate.x + dx}px, ${this.translate.y + dy}px)
        scale(${this.scale.x + scaleExtra},${this.scale.y + scaleExtra})`
    })
  },

  move: function (x, y, scaleExtra) {
    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(this.el, {
      transition: transformCssProp,
      transform: `translate(
        ${this.translate.x + dx}px, ${this.translate.y + dy}px)
        scale(${this.scale.x + scaleExtra},${this.scale.y + scaleExtra})`
    })
  },

  restoreCloseStyle: function () {
    setStyle(this.el, this.style.close)
  },

  restoreOpenStyle: function () {
    setStyle(this.el, this.style.open)
  },

  upgradeSource: function () {
    this.srcThumbnail = this.el.getAttribute('src')
    const dataOriginal = this.el.getAttribute('data-original')
    const temp = this.el.cloneNode(false)

    // force compute the hi-res image in DOM to prevent
    // image flickering while updating src
    temp.setAttribute('src', dataOriginal)
    temp.style.position = 'fixed'
    temp.style.visibility = 'hidden'
    this.body.appendChild(temp)

    setTimeout(() => {
      this.el.setAttribute('src', dataOriginal)
      this.body.removeChild(temp)
    }, 10)
  },

  downgradeSource: function () {
    this.el.setAttribute('src', this.srcThumbnail)
  }
}

export default Target
