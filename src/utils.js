export const cursor = {
  default: 'auto',
  zoomIn: 'zoom-in',
  zoomOut: 'zoom-out',
  grab: 'grab',
  move: 'move'
}

export function listen(el, event, handler, add = true) {
  const options = { passive: false }

  if (add) {
    el.addEventListener(event, handler, options)
  } else {
    el.removeEventListener(event, handler, options)
  }
}

export function loadImage(src, cb) {
  if (src) {
    const img = new Image()

    img.onload = function onImageLoad() {
      if (cb) cb(img)
    }

    img.src = src
  }
}

export function getOriginalSource(el) {
  if (el.dataset.original) {
    return el.dataset.original
  } else if (el.parentNode.tagName === 'A') {
    return el.parentNode.getAttribute('href')
  } else {
    return null
  }
}

export function setStyle(el, styles, remember) {
  checkTrans(styles)

  let s = el.style
  let original = {}

  for (let key in styles) {
    if (remember) {
      original[key] = s[key] || ''
    }

    s[key] = styles[key]
  }

  return original
}

export function bindAll(_this, that) {
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(_this))
  methods.forEach(function bindOne(method) {
    _this[method] = _this[method].bind(that)
  })
}

const trans = {
  transitionProp: 'transition',
  transEndEvent: 'transitionend',
  transformProp: 'transform',
  transformCssProp: 'transform'
}
export const { transformCssProp, transEndEvent } = trans

function checkTrans(styles) {
  const { transitionProp, transformProp } = trans

  if (styles.transition) {
    const value = styles.transition
    delete styles.transition
    styles[transitionProp] = value
  }

  if (styles.transform) {
    const value = styles.transform
    delete styles.transform
    styles[transformProp] = value
  }
}
