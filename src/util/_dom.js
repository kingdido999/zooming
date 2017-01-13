export const body = document.body
export const docElm = document.documentElement
export const isString = checkType('string')
export const isLink = checkTag('A')
export const webkitPrefix = 'WebkitAppearance' in docElm.style
  ? '-webkit-'
  : ''


export function checkType (typeName) {
  return function (el) {
    return typeof el === typeName
  }
}

export function checkTag (tagName) {
  return function (el) {
    return el.tagName === tagName
  }
}

export function getParents (el, match) {
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
