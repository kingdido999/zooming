import { bindAll } from '../utils'

const PRESS_DELAY = 200

const isLeftButton = e => e.button === 0

const isPressingMetaKey = e => e.metaKey || e.ctrlKey

const isTouching = e => e.targetTouches.length > 0

const isEscape = e => {
  const code = e.key || e.code
  return code === 'Escape' || e.keyCode === 27
}

export default {
  init(instance) {
    bindAll(this, instance)
  },

  click(e) {
    e.preventDefault()

    if (isPressingMetaKey(e)) {
      return window.open(
        this.target.srcOriginal || e.currentTarget.src,
        '_blank'
      )
    } else {
      if (this.shown) {
        if (this.released) this.close()
        else this.release()
      } else {
        this.open(e.currentTarget)
      }
    }
  },

  scroll() {
    const scrollTop =
      window.pageYOffset ||
      (document.documentElement || document.body.parentNode || document.body)
        .scrollTop

    if (this.lastScrollPosition === null) {
      this.lastScrollPosition = scrollTop
    }

    const deltaY = this.lastScrollPosition - scrollTop

    if (Math.abs(deltaY) >= this.options.scrollThreshold) {
      this.lastScrollPosition = null
      this.close()
    }
  },

  keydown(e) {
    if (isEscape(e)) {
      if (this.released) {
        this.close()
      } else {
        this.release(this.close)
      }
    }
  },

  mousedown(e) {
    if (!isLeftButton(e) || isPressingMetaKey(e)) return
    e.preventDefault()

    this.pressTimer = setTimeout(() => {
      this.grab(e.clientX, e.clientY)
    }, PRESS_DELAY)
  },

  mousemove(e) {
    if (this.released) return
    this.move(e.clientX, e.clientY)
  },

  mouseup(e) {
    if (!isLeftButton(e) || isPressingMetaKey(e)) return
    clearTimeout(this.pressTimer)

    if (this.released) {
      this.close()
    } else {
      this.release()
    }
  },

  touchstart(e) {
    e.preventDefault()
    const { clientX, clientY } = e.touches[0]

    this.pressTimer = setTimeout(() => {
      this.grab(clientX, clientY)
    }, PRESS_DELAY)
  },

  touchmove(e) {
    if (this.released) return

    const { clientX, clientY } = e.touches[0]
    this.move(clientX, clientY)
  },

  touchend(e) {
    if (isTouching(e)) return
    clearTimeout(this.pressTimer)

    if (this.released) {
      this.close()
    } else {
      this.release()
    }
  }
}
