import { listen } from './utils'
import Zooming from './modules/zooming'

listen(document, 'DOMContentLoaded', () => new Zooming())

export default Zooming
