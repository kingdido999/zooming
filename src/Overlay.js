import { setStyle } from './_helpers'

function Overlay (el, instance) {
  this.el = el
  this.instance = instance
  this.parent = null
}

Overlay.prototype = {
  init: function () {
    const options = this.instance.options

    setStyle(this.el, {
      zIndex: 998,
      backgroundColor: options.bgColor,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0,
      transition: `opacity
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`
    })

    this.el.addEventListener('click', this.instance.close())
  },

  updateStyle: function () {
    const options = this.instance.options

    setStyle(this.el, {
      backgroundColor: options.bgColor,
      transition: `opacity
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`
    })
  },

  setParent: function (parent) {
    this.parent = parent
  },

  insert: function () {
    this.parent.appendChild(this.el)
  },

  remove: function () {
    this.parent.removeChild(this.el)
  },

  show: function () {
    setTimeout(() => this.el.style.opacity = this.instance.options.bgOpacity, 30)
  },

  hide: function () {
    this.el.style.opacity = 0
  }
}

export default Overlay
