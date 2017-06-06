import { bindAll } from '../utils'

const PRESS_DELAY = 200
const MULTITOUCH_SCALE_FACTOR = 2

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

    this.pressTimer = setTimeout(() => {
      processTouches(e.touches, this.options.scaleExtra, (x, y, scaleExtra) => {
        this.grab(x, y, scaleExtra)
      })
    }, PRESS_DELAY)
  },

  touchmove(e) {
    if (this.released) return

    processTouches(e.touches, this.options.scaleExtra, (x, y, scaleExtra) => {
      this.move(x, y, scaleExtra)
    })
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

function isLeftButton(event) {
  return event.button === 0
}

function isPressingMetaKey(event) {
  return event.metaKey || event.ctrlKey
}

function isEscape(event) {
  const code = event.key || event.code
  return code === 'Escape' || event.keyCode === 27
}

function isTouching(event) {
  return event.targetTouches.length > 0
}

function processTouches(touches, currScaleExtra, cb) {
  const total = touches.length
  const firstTouch = touches[0]
  const multitouch = total > 1

  let scaleExtra = currScaleExtra
  let i = touches.length
  let [xs, ys] = [0, 0]

  // keep track of the min and max of touch positions
  let min = { x: firstTouch.clientX, y: firstTouch.clientY }
  let max = { x: firstTouch.clientX, y: firstTouch.clientY }

  while (i--) {
    const t = touches[i]
    const [x, y] = [t.clientX, t.clientY]
    xs += x
    ys += y

    if (multitouch) {
      if (x < min.x) {
        min.x = x
      } else if (x > max.x) {
        max.x = x
      }

      if (y < min.y) {
        min.y = y
      } else if (y > max.y) {
        max.y = y
      }
    }
  }

  if (multitouch) {
    // change scaleExtra dynamically
    const [distX, distY] = [max.x - min.x, max.y - min.y]

    if (distX > distY) {
      scaleExtra = distX / window.innerWidth * MULTITOUCH_SCALE_FACTOR
    } else {
      scaleExtra = distY / window.innerHeight * MULTITOUCH_SCALE_FACTOR
    }
  }

  cb(xs / total, ys / total, scaleExtra)
}
