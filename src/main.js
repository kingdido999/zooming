import Zooming from './Zooming'
import OPTIONS from './_options'

document.addEventListener('DOMContentLoaded', () => {
  new Zooming().listen(OPTIONS.defaultZoomable)
})

export default Zooming
