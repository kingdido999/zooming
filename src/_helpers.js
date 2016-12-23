const body = document.body
const docElm = document.documentElement
const webkitPrefix = 'WebkitAppearance' in document.documentElement.style
  ? '-webkit-'
  : ''

const divide = (denominator) => {
  return (numerator) => {
    return numerator / denominator
  }
}

const half = divide(2)

const loadImage = (url, cb) => {
  const img = new Image()
  img.onload = () => {
    if (cb) cb(img)
  }
  img.src = url
}

const scrollTop = () => {
  return window.pageYOffset ||
    (docElm || body.parentNode || body).scrollTop
}

const getWindowCenter = () => {
  const docWidth = docElm.clientWidth || body.clientWidth
  const docHeight = docElm.clientHeight || body.clientHeight

  return {
    x: half(docWidth),
    y: half(docHeight)
  }
}

const toggleListeners = (el, types, handler, add = true) => {
  types.forEach(t => {
    if (add) {
      el.addEventListener(t, handler[t])
    } else {
      el.removeEventListener(t, handler[t])
    }
  })
}

export {
  webkitPrefix,
  half,
  loadImage,
  scrollTop,
  getWindowCenter,
  toggleListeners
}
