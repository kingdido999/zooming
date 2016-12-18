const PRESS_DELAY = 200

const TOUCH_SCALE_FACTOR = 2

const EVENT_TYPES_GRAB = [
  'mousedown', 'mousemove', 'mouseup',
  'touchstart', 'touchmove', 'touchend'
]

const options = {
  defaultZoomable: 'img[data-action="zoom"]',
  enableGrab: true,
  preloadImage: true,
  transitionDuration: 0.4,
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0, 1)',
  bgColor: 'rgb(255, 255, 255)',
  bgOpacity: 1,
  scaleBase: 1.0,
  scaleExtra: 0.5,
  scrollThreshold: 40,
  onOpen: null,
  onClose: null,
  onRelease: null,
  onBeforeOpen: null,
  onBeforeClose: null,
  onBeforeGrab: null,
  onBeforeMove: null,
  onBeforeRelease: null
}

export {
  PRESS_DELAY,
  TOUCH_SCALE_FACTOR,
  EVENT_TYPES_GRAB,
  options
}
