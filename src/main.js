import { defaults } from './helpers'
import Zooming from './zooming'

document.addEventListener('DOMContentLoaded', () => {

  // listen to zoomable elements by default
  new Zooming().listen(defaults.zoomable)
})

if (ENV !== 'production') {
  // Enable LiveReload
  document.write(
    '<script src="http://' + (location.host || 'localhost').split(':')[0] +
    ':35729/livereload.js?snipver=1"></' + 'script>'
  )
}

export default Zooming
