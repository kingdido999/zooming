import { TOUCH_SCALE_FACTOR, options } from './_defaults'

const processTouches = (touches, cb) => {
  const total = touches.length
  const firstTouch = touches[0]
  const multitouch = total > 1

  let scaleExtra = options.scaleExtra
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

export {
  processTouches
}
