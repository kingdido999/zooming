const webkitPrefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''

const divide = (denominator) => {
  return (numerator) => {
    return numerator / denominator
  }
}

const half = divide(2)

const preloadImage = (url) => (new Image()).src = url

const scrollTop = () => {
  const body = document.body

  return window.pageYOffset ||
    (document.documentElement || body.parentNode || body).scrollTop
}

const getWindowCenter = () => {
  return {
    x: half(window.innerWidth),
    y: half(window.innerHeight)
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
  preloadImage,
  scrollTop,
  getWindowCenter,
  toggleListeners
}
