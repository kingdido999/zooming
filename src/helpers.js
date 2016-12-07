// webkit prefix helper
const prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''
const pressDelay = 200

const options = {
  defaultZoomable: 'img[data-action="zoom"]',
  transitionDuration: '.4s',
  transitionTimingFunction: 'cubic-bezier(.4,0,0,1)',
  bgColor: '#fff',
  bgOpacity: 1,
  scaleBase: 1.0,
  scaleExtra: 0.5,
  scrollThreshold: 40,
  onOpen: null,
  onClose: null,
  onGrab: null,
  onRelease: null,
  onBeforeOpen: null,
  onBeforeClose: null,
  onBeforeGrab: null,
  onBeforeRelease: null
}

export { prefix, pressDelay, options }
