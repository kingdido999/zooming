import { checkTag, isLink } from './_dom'

export function isValidImage (filename) {
  return (/\.(gif|jpg|jpeg|png)$/i).test(filename)
}

export function isNotImage () {
  return checkTag('IMG') === false
}

export function isImageLink (el) {
  return isLink(el) && isValidImage(el.getAttribute('href'))
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
  } else if (isImageLink(el.parentNode)) {
    srcOriginal = el.parentNode.getAttribute('href')
  }

  cb(srcOriginal)
}
