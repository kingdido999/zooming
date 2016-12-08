import { options } from './helpers'
import api from './zooming'

document.addEventListener('DOMContentLoaded', () => {
  api.listen(options.defaultZoomable)
})

if (ENV !== 'production') {
  // Enable LiveReload
  document.write(
    '<script src="http://' + (location.host || 'localhost').split(':')[0] +
    ':35729/livereload.js?snipver=1"></' + 'script>'
  )
}

export default api
