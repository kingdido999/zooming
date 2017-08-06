import { listen } from './utils'
import Zooming from './modules/zooming'

listen(document, 'DOMContentLoaded', function initZooming() {
  new Zooming()
})

export default Zooming
