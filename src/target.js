import { cursor, setStyle, getOriginalSource, transformCssProp } from './utils'

// Translate z-axis to fix CSS grid display issue in Chrome:
// https://github.com/kingdido999/zooming/issues/42
const TRANSLATE_Z = 0

export default {
  init(el, instance) {
    this.el = el
    this.instance = instance
    this.srcThumbnail = this.el.getAttribute('src')
    this.srcset = this.el.getAttribute('srcset')
    this.srcOriginal = getOriginalSource(this.el)
    this.rect = this.el.getBoundingClientRect()
    this.translate = null
    this.scale = null
    this.styleOpen = null
    this.styleClose = null
  },

  zoomIn() {
    const {
      zIndex,
      enableGrab,
      transitionDuration,
      transitionTimingFunction
    } = this.instance.options
    this.translate = this.calculateTranslate()
    this.scale = this.calculateScale()

    this.styleOpen = {
      position: 'relative',
      zIndex: zIndex + 1,
      cursor: enableGrab ? cursor.grab : cursor.zoomOut,
      transition: `${transformCssProp}
        ${transitionDuration}s
        ${transitionTimingFunction}`,
      transform: `translate3d(${this.translate.x}px, ${
        this.translate.y
        }px, ${TRANSLATE_Z}px)
        scale(${this.scale.x},${this.scale.y})`,
      height: `${this.rect.height}px`,
      width: `${this.rect.width}px`
    }

    // Force layout update
    this.el.offsetWidth

    // Trigger transition
    this.styleClose = setStyle(this.el, this.styleOpen, true)
  },

  zoomOut() {
    // Force layout update
    this.el.offsetWidth

    setStyle(this.el, { transform: 'none' })
  },

  grab(x, y, scaleExtra) {
    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(this.el, {
      cursor: cursor.move,
      transform: `translate3d(
        ${this.translate.x + dx}px, ${this.translate.y +
        dy}px, ${TRANSLATE_Z}px)
        scale(${this.scale.x + scaleExtra},${this.scale.y + scaleExtra})`
    })
  },

  move(x, y, scaleExtra) {
    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(this.el, {
      transition: transformCssProp,
      transform: `translate3d(
        ${this.translate.x + dx}px, ${this.translate.y +
        dy}px, ${TRANSLATE_Z}px)
        scale(${this.scale.x + scaleExtra},${this.scale.y + scaleExtra})`
    })
  },

  restoreCloseStyle() {
    setStyle(this.el, this.styleClose)
  },

  restoreOpenStyle() {
    setStyle(this.el, this.styleOpen)
  },

  upgradeSource() {
    if (this.srcOriginal) {
      const parentNode = this.el.parentNode

      if (this.srcset) {
        this.el.removeAttribute('srcset')
      }

      const temp = this.el.cloneNode(false)

      // Force compute the hi-res image in DOM to prevent
      // image flickering while updating src
      temp.setAttribute('src', this.srcOriginal)
      temp.style.position = 'fixed'
      temp.style.visibility = 'hidden'
      parentNode.appendChild(temp)

      // Add delay to prevent Firefox from flickering
      setTimeout(
        function updateSrc() {
          this.el.setAttribute('src', this.srcOriginal)
          parentNode.removeChild(temp)
        }.bind(this),
        50
      )
    }
  },

  downgradeSource() {
    if (this.srcOriginal) {
      if (this.srcset) {
        this.el.setAttribute('srcset', this.srcset)
      }
      this.el.setAttribute('src', this.srcThumbnail)
    }
  },

  calculateTranslate() {
    const windowCenter = getWindowCenter()
    const targetCenter = {
      x: this.rect.left + this.rect.width / 2,
      y: this.rect.top + this.rect.height / 2
    }

    // The vector to translate image to the window center
    return {
      x: windowCenter.x - targetCenter.x,
      y: windowCenter.y - targetCenter.y
    }
  },

  calculateScale() {
    const { zoomingHeight, zoomingWidth } = this.el.dataset
    const { customSize, scaleBase } = this.instance.options

    if (!customSize && zoomingHeight && zoomingWidth) {
      return {
        x: zoomingWidth / this.rect.width,
        y: zoomingHeight / this.rect.height
      }
    } else if (customSize && typeof customSize === 'object') {
      return {
        x: customSize.width / this.rect.width,
        y: customSize.height / this.rect.height
      }
    } else {
      const targetHalfWidth = this.rect.width / 2
      const targetHalfHeight = this.rect.height / 2
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

      if (customSize && typeof customSize === 'string') {
        // Use zoomingWidth and zoomingHeight if available
        const naturalWidth = zoomingWidth || this.el.naturalWidth
        const naturalHeight = zoomingHeight || this.el.naturalHeight
        const maxZoomingWidth =
          parseFloat(customSize) * naturalWidth / (100 * this.rect.width)
        const maxZoomingHeight =
          parseFloat(customSize) * naturalHeight / (100 * this.rect.height)

        // Only scale image up to the specified customSize percentage
        if (scale > maxZoomingWidth || scale > maxZoomingHeight) {
          return {
            x: maxZoomingWidth,
            y: maxZoomingHeight
          }
        }
      }

      return {
        x: scale,
        y: scale
      }
    }
  }
}

function getWindowCenter() {
  const docEl = document.documentElement
  const windowWidth = Math.min(docEl.clientWidth, window.innerWidth)
  const windowHeight = Math.min(docEl.clientHeight, window.innerHeight)

  return {
    x: windowWidth / 2,
    y: windowHeight / 2
  }
}
