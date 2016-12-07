import { options } from './helpers'
import Zooming from './zooming'

document.addEventListener('DOMContentLoaded', () => {

  // listen to zoomable elements by default
  new Zooming().listen(options.defaultZoomable)
})

if (ENV !== 'production') {
  // Enable LiveReload
  document.write(
    '<script src="http://' + (location.host || 'localhost').split(':')[0] +
    ':35729/livereload.js?snipver=1"></' + 'script>'
  )
}

export default Zooming
