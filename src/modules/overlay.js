import { setStyle } from '../utils'

export default class Overlay {
  constructor(instance) {
    this.el = document.createElement('div')
    this.instance = instance
    this.parent = document.body
  }

  init(options) {
    setStyle(this.el, {
      zIndex: options.zIndex,
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

    this.el.addEventListener('click', () => this.instance.close())
  }

  updateStyle(options) {
    setStyle(this.el, {
      zIndex: options.zIndex,
      backgroundColor: options.bgColor,
      transition: `opacity
        ${options.transitionDuration}s
        ${options.transitionTimingFunction}`
    })
  }

  create() {
    this.parent.appendChild(this.el)
  }

  destroy() {
    this.parent.removeChild(this.el)
  }

  show() {
    setTimeout(
      () => this.el.style.opacity = this.instance.options.bgOpacity,
      30
    )
  }

  hide() {
    this.el.style.opacity = 0
  }
}
