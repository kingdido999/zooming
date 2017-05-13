import { cursor, setStyle, getOriginalSource, transformCssProp } from '../utils'

export default class Target {
  constructor(el, instance) {
    this.el = el
    this.instance = instance
    this.srcThumbnail = this.el.getAttribute('src')
    this.srcOriginal = getOriginalSource(this.el)
    this.rect = el.getBoundingClientRect()
    this.translate = null
    this.scale = null
    this.styleOpen = null
    this.styleClose = null
  }

  zoomIn() {
    const options = this.instance.options

    // Remove overflow:hidden from target's parent nodes if any. It prevents
    // parent nodes from hiding the target after zooming in
    overflowHiddenParents.disable(this.el)

    this.translate = calculateTranslate(this.rect)
    this.scale = calculateScale(
      this.rect,
      options.scaleBase,
      options.customSize
    )

    // force layout update
    this.el.offsetWidth

    this.styleOpen = {
      position: 'relative',
      zIndex: options.zIndex + 1,
      cursor: options.enableGrab ? cursor.grab : cursor.zoomOut,
      transition: `${transformCssProp}
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`,
      transform: `translate(${this.translate.x}px, ${this.translate.y}px)
        scale(${this.scale.x},${this.scale.y})`,
      width: `${this.rect.width}px`,
      height: `${this.rect.height}px`
    }

    // trigger transition
    this.styleClose = setStyle(this.el, this.styleOpen, true)
  }

  zoomOut() {
    // Restore overflow:hidden to target's parent nodes if any
    overflowHiddenParents.enable(this.el)

    // force layout update
    this.el.offsetWidth

    setStyle(this.el, { transform: 'none' })
  }

  grab(x, y, scaleExtra) {
    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(this.el, {
      cursor: cursor.move,
      transform: `translate(
        ${this.translate.x + dx}px, ${this.translate.y + dy}px)
        scale(${this.scale.x + scaleExtra},${this.scale.y + scaleExtra})`
    })
  }

  move(x, y, scaleExtra) {
    const windowCenter = getWindowCenter()
    const [dx, dy] = [windowCenter.x - x, windowCenter.y - y]

    setStyle(this.el, {
      transition: transformCssProp,
      transform: `translate(
        ${this.translate.x + dx}px, ${this.translate.y + dy}px)
        scale(${this.scale.x + scaleExtra},${this.scale.y + scaleExtra})`
    })
  }

  restoreCloseStyle() {
    setStyle(this.el, this.styleClose)
  }

  restoreOpenStyle() {
    setStyle(this.el, this.styleOpen)
  }

  upgradeSource() {
    if (!this.srcOriginal) return

    const parentNode = this.el.parentNode
    const temp = this.el.cloneNode(false)

    // force compute the hi-res image in DOM to prevent
    // image flickering while updating src
    temp.setAttribute('src', this.srcOriginal)
    temp.style.position = 'fixed'
    temp.style.visibility = 'hidden'
    parentNode.appendChild(temp)

    setTimeout(() => {
      this.el.setAttribute('src', this.srcOriginal)
      parentNode.removeChild(temp)
    }, 100)
  }

  downgradeSource() {
    if (!this.srcOriginal) return

    this.el.setAttribute('src', this.srcThumbnail)
  }
}

function calculateTranslate(rect) {
  const windowCenter = getWindowCenter()
  const targetCenter = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  }

  // The vector to translate image to the window center
  return {
    x: windowCenter.x - targetCenter.x,
    y: windowCenter.y - targetCenter.y
  }
}

function calculateScale(rect, scaleBase, customSize) {
  if (customSize) {
    return {
      x: customSize.width / rect.width,
      y: customSize.height / rect.height
    }
  } else {
    const targetHalfWidth = rect.width / 2
    const targetHalfHeight = rect.height / 2
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

function getWindowCenter() {
  const windowWidth = Math.min(
    document.documentElement.clientWidth,
    window.innerWidth
  )
  const windowHeight = Math.min(
    document.documentElement.clientHeight,
    window.innerHeight
  )

  return {
    x: windowWidth / 2,
    y: windowHeight / 2
  }
}

const overflowHiddenParents = {
  // Map from Element to its overflow:hidden parents
  map: new Map(),

  // Map from parent to its original style
  style: new Map(),

  disable: disableOverflowHiddenParents,
  enable: enableOverflowHiddenParents
}

function isOverflowHidden(el) {
  return getComputedStyle(el).overflow === 'hidden'
}

function getParents(el, match) {
  let parents = []

  for (; el && el !== document; el = el.parentNode) {
    if (match) {
      if (match(el)) {
        parents.push(el)
      }
    } else {
      parents.push(el)
    }
  }

  return parents
}

function getOverflowHiddenParents(el) {
  if (overflowHiddenParents.map.has(el)) {
    return overflowHiddenParents.map.get(el)
  } else {
    const parents = getParents(el.parentNode, isOverflowHidden)
    overflowHiddenParents.map.set(el, parents)
    return parents
  }
}

function disableOverflowHiddenParents(el) {
  getOverflowHiddenParents(el).forEach(parent => {
    if (overflowHiddenParents.style.has(parent)) {
      setStyle(parent, {
        overflow: 'visible'
      })
    } else {
      overflowHiddenParents.style.set(
        parent,
        setStyle(
          parent,
          {
            overflow: 'visible'
          },
          true
        )
      )
    }
  })
}

function enableOverflowHiddenParents(el) {
  if (overflowHiddenParents.map.has(el)) {
    overflowHiddenParents.map.get(el).forEach(parent => {
      setStyle(parent, overflowHiddenParents.style.get(parent))
    })
  }
}
