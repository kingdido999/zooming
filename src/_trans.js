import { half, getWindowCenter } from './_helpers'

const calculateTranslate = (rect) => {
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

const calculateScale = (rect, scaleBase, customSize) => {
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

export {
  calculateTranslate,
  calculateScale
}
