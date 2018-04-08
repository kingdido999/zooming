import { listen, setStyle } from './utils'

export default {
  init(instance) {
    this.el = document.createElement('div')
    this.instance = instance
    this.parent = document.body

    setStyle(this.el, {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0
    })

    this.updateStyle(instance.options)
    listen(this.el, 'click', instance.handler.clickOverlay.bind(instance))
  },

  updateStyle(options) {
    setStyle(this.el, {
      zIndex: options.zIndex,
      backgroundColor: options.bgColor,
      transition: `opacity
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`
    })
  },

  insert() {
    this.parent.appendChild(this.el)
  },

  remove() {
    this.parent.removeChild(this.el)
  },

  fadeIn() {
    this.el.offsetWidth
    this.el.style.opacity = this.instance.options.bgOpacity
  },

  fadeOut() {
    this.el.style.opacity = 0
  }
}
