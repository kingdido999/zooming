const PRESS_DELAY = 200

const TOUCH_SCALE_FACTOR = 2

const EVENT_TYPES_GRAB = [
  'mousedown', 'mousemove', 'mouseup',
  'touchstart', 'touchmove', 'touchend'
]

/**
 * A list of options.
 * @type {Object}
 * @property  {string|Element} defaultZoomable
 * Zoomable elements by default. It can be a css selector or an element.
 * @property  {boolean} enableGrab
 * To be able to grab and drag the image for extra zoom-in.
 * @property  {boolean} preloadImage
 * Preload images with attribute "data-original".
 * @property  {number} transitionDuration
 * Transition duration in seconds.
 * @property  {string} transitionTimingFunction
 * Transition timing function.
 * @property  {string} bgColor
 * Overlay background color.
 * @property  {number} bgOpacity
 * Overlay background capacity.
 * @property  {number} scaleBase
 * The base scale factor for zooming. By default scale to fit the window.
 * @property  {number} scaleExtra
 * The extra scale factor when grabbing the image.
 * @property  {number} scrollThreshold
 * How much scrolling it takes before closing out.
 * @property  {Function} onOpen
 * A callback function that will be called when a target is opened and
 * transition has ended. It will get the target element as the argument.
 * @property  {Function} onClose
 * Same as above, except fired when closed.
 * @property  {Function} onRelease
 * Same as above, except fired when released.
 * @property  {Function} onBeforeOpen
 * A callback function that will be called before open.
 * @property  {Function} onBeforeClose
 * A callback function that will be called before close.
 * @property  {Function} onBeforeGrab
 * A callback function that will be called before grab.
 * @property  {Function} onBeforeMove
 * A callback function that will be called before move.
 * @property  {Function} onBeforeRelease
 * A callback function that will be called before release.
 * @example
 * // Default options
 * var options = {
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
 */
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
