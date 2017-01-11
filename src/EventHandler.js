import { scrollTop, bindAll } from './_helpers'

const PRESS_DELAY = 200
const MULTITOUCH_SCALE_FACTOR = 2

export default class EventHandler {

  constructor (instance) {
    bindAll(this, instance)
  }

  click (e) {
    e.preventDefault()

    if (this.shown) {
      if (this.released) this.close()
      else this.release()
    } else {
      this.open(e.currentTarget)
    }
  }

  scroll () {
    const st = scrollTop()

    if (this.lastScrollPosition === null) {
      this.lastScrollPosition = st
    }

    const deltaY = this.lastScrollPosition - st

    if (Math.abs(deltaY) >= this.options.scrollThreshold) {
      this.lastScrollPosition = null
      this.close()
    }
  }

  keydown (e) {
    const code = e.key || e.code
    if (code === 'Escape' || e.keyCode === 27) {
      if (this.released) this.close()
      else this.release(() => this.close())
    }
  }

  mousedown (e) {
    if (e.button !== 0) return
    e.preventDefault()

    this.pressTimer = setTimeout(() => {
      this.grab(e.clientX, e.clientY)
    }, PRESS_DELAY)
  }

  mousemove (e) {
    if (this.released) return
    this.move(e.clientX, e.clientY)
  }

  mouseup (e) {
    if (e.button !== 0) return
    clearTimeout(this.pressTimer)

    if (this.released) this.close()
    else this.release()
  }

  touchstart (e) {
    e.preventDefault()

    this.pressTimer = setTimeout(() => {
      processTouches(e.touches, this.options.scaleExtra,
        (x, y, scaleExtra) => {
          this.grab(x, y, scaleExtra)
        })
    }, PRESS_DELAY)
  }

  touchmove (e) {
    if (this.released) return

    processTouches(e.touches, this.options.scaleExtra,
      (x, y, scaleExtra) => {
        this.move(x, y, scaleExtra)
      })
  }

  touchend (e) {
    if (e.targetTouches.length > 0) return
    clearTimeout(this.pressTimer)

    if (this.released) this.close()
    else this.release()
  }
}

function processTouches (touches, currScaleExtra, cb) {
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

    if (!multitouch) continue

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

  if (multitouch) {
    // change scaleExtra dynamically
    const [distX, distY] = [max.x - min.x, max.y - min.y]

    if (distX > distY) {
      scaleExtra = (distX / window.innerWidth) * MULTITOUCH_SCALE_FACTOR
    } else {
      scaleExtra = (distY / window.innerHeight) * MULTITOUCH_SCALE_FACTOR
    }
  }

  cb(xs / total, ys / total, scaleExtra)
}
