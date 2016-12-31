import { scrollTop } from './_helpers'
import { PRESS_DELAY, TOUCH_SCALE_FACTOR } from './_defaults'

export default function EventHandler(instance) {

  const handler = {

    click: function (e) {
      e.preventDefault()

      if (instance.shown) {
        if (instance.released) instance.close()
        else instance.release()
      } else {
        instance.open(e.currentTarget)
      }
    },

    scroll: function () {
      const st = scrollTop()

      if (instance.lastScrollPosition === null) {
        instance.lastScrollPosition = st
      }

      const deltaY = instance.lastScrollPosition - st

      if (Math.abs(deltaY) >= instance.options.scrollThreshold) {
        instance.lastScrollPosition = null
        instance.close()
      }
    },

    keydown: function (e) {
      const code = e.key || e.code
      if (code === 'Escape' || e.keyCode === 27) {
        if (instance.released) instance.close()
        else instance.release(() => instance.close())
      }
    },

    mousedown: function (e) {
      if (e.button !== 0) return
      e.preventDefault()

      instance.pressTimer = setTimeout(() => {
        instance.grab(e.clientX, e.clientY)
      }, PRESS_DELAY)
    },

    mousemove: function (e) {
      if (instance.released) return
      instance.move(e.clientX, e.clientY)
    },

    mouseup: function (e) {
      if (e.button !== 0) return
      clearTimeout(instance.pressTimer)

      if (instance.released) instance.close()
      else instance.release()
    },

    touchstart: function (e) {
      e.preventDefault()

      instance.pressTimer = setTimeout(() => {
        processTouches(e.touches, instance.options.scaleExtra,
          (x, y, scaleExtra) => {
            instance.grab(x, y, scaleExtra)
          })
      }, PRESS_DELAY)
    },

    touchmove: function (e) {
      if (instance.released) return

      processTouches(e.touches, instance.options.scaleExtra,
        (x, y, scaleExtra) => {
          instance.move(x, y, scaleExtra)
        })
    },

    touchend: function (e) {
      if (e.targetTouches.length > 0) return
      clearTimeout(instance.pressTimer)

      if (instance.released) instance.close()
      else instance.release()
    }
  }

  for (let fn in handler) {
    handler[fn] = handler[fn].bind(instance)
  }

  return handler
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
      scaleExtra = (distX / window.innerWidth) * TOUCH_SCALE_FACTOR
    } else {
      scaleExtra = (distY / window.innerHeight) * TOUCH_SCALE_FACTOR
    }
  }

  cb(xs / total, ys / total, scaleExtra)
}
