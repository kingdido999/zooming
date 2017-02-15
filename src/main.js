import DEFAULT_OPTIONS from './_options'
import Zooming from './Zooming'

document.addEventListener('DOMContentLoaded', () => {
  new Zooming().listen(DEFAULT_OPTIONS.defaultZoomable)
})

export default Zooming
