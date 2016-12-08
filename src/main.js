import { options } from './helpers'
import api from './zooming'

document.addEventListener('DOMContentLoaded', api.listen(options.defaultZoomable))

export default api
