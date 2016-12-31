import Zooming from './Zooming'
import { OPTIONS } from './_defaults'

document.addEventListener('DOMContentLoaded', () => {
  new Zooming().listen(OPTIONS.defaultZoomable)
})

export default Zooming
