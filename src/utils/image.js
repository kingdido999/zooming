import { checkTag, isLink } from './dom'

export function isNotImage () {
  return checkTag('IMG') === false
}

export function loadImage (src, cb) {
  if (!src) return

  const img = new Image()
  img.onload = function () {
    if (cb) cb(img)
  }

  img.src = src
}

export function checkOriginalImage (el, cb) {
  let srcOriginal = null

  if (el.hasAttribute('data-original')) {
    srcOriginal = el.getAttribute('data-original')
  } else if (isLink(el.parentNode)) {
    srcOriginal = el.parentNode.getAttribute('href')
  }

  cb(srcOriginal)
}
