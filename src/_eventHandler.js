import { scrollTop } from './_helpers'
import { PRESS_DELAY } from './_defaults'
import { processTouches } from './_touch'

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
