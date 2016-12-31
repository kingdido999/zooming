import { transformCssProp, setStyle, half, getWindowCenter, loadImage, cursor } from './_helpers'

export default class Target {

  constructor (el, instance) {
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

  open () {
    const options = this.instance.options

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
        ? cursor.grab
        : cursor.zoomOut,
      transition: `${transformCssProp}
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`,
      transform: `translate(${this.translate.x}px, ${this.translate.y}px)
        scale(${this.scale.x},${this.scale.y})`
    }

    // trigger transition
    this.style.close = setStyle(this.el, this.style.open, true)
  }

  close () {
    // force layout update
    this.el.offsetWidth

    setStyle(this.el, { transform: 'none' })
  }

  grab (x, y, scaleExtra) {
    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(this.el, {
      cursor: cursor.move,
      transform: `translate(
        ${this.translate.x + dx}px, ${this.translate.y + dy}px)
        scale(${this.scale.x + scaleExtra},${this.scale.y + scaleExtra})`
    })
  }

  move (x, y, scaleExtra) {
    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(this.el, {
      transition: transformCssProp,
      transform: `translate(
        ${this.translate.x + dx}px, ${this.translate.y + dy}px)
        scale(${this.scale.x + scaleExtra},${this.scale.y + scaleExtra})`
    })
  }

  restoreCloseStyle () {
    setStyle(this.el, this.style.close)
  }

  restoreOpenStyle () {
    setStyle(this.el, this.style.open)
  }

  upgradeSource () {
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
  }

  downgradeSource () {
    this.el.setAttribute('src', this.srcThumbnail)
  }
}

function calculateTranslate (rect) {
  const windowCenter = getWindowCenter()
  const targetCenter = {
    x: rect.left + half(rect.width),
    y: rect.top + half(rect.height)
  }

  // The vector to translate image to the window center
  return {
    x: windowCenter.x - targetCenter.x,
    y: windowCenter.y - targetCenter.y
  }
}

function calculateScale (rect, scaleBase, customSize) {
  if (customSize) {
    return {
      x: customSize.width / rect.width,
      y: customSize.height / rect.height
    }
  } else {
    const targetHalfWidth = half(rect.width)
    const targetHalfHeight = half(rect.height)
    const windowCenter = getWindowCenter()

    // The distance between target edge and window edge
    const targetEdgeToWindowEdge = {
      x: windowCenter.x - targetHalfWidth,
      y: windowCenter.y - targetHalfHeight
    }

    const scaleHorizontally = targetEdgeToWindowEdge.x / targetHalfWidth
    const scaleVertically = targetEdgeToWindowEdge.y / targetHalfHeight

    // The additional scale is based on the smaller value of
    // scaling horizontally and scaling vertically
    const scale = scaleBase + Math.min(scaleHorizontally, scaleVertically)

    return {
      x: scale,
      y: scale
    }
  }
}
