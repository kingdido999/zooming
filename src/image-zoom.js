+function() {

  /**
   * The main service.
   */
  function ImageZoomService() {
    this._scaleBase = 0.95
    this._image = null
    this._overlay = null
    this._window = window
    this._document = document
    this._body = document.body
  }

  ImageZoomService.prototype.init = function() {
    // Add listener for click event
    this._body.addEventListener('click', this._handleClick.bind(this))

    // Create overlay
    this._overlay = new Overlay(this._body, document.createElement('div'))

    // TODO: Setup cursor style
    // var zoomableImages = this._document.querySelectorAll('[data-action="zoom"]')
    // console.log(zoomableImages)
    //
    // for (var i = 0; i < zoomableImages.length; i++) {
    //   setStyles(zoomableImages[i], {
    //     'cursor': 'pointer',
    //     'cursor': '-webkit-zoom-in',
    //     'cursor': '-moz-zoom-in'
    //   })
    // }
  }

  ImageZoomService.prototype._handleClick = function(event) {
    var target = event.target

    if (!target) return

    if (target.tagName === 'IMG' && target.hasAttribute('data-action')) {
      this._image = new Zoomable(target)

      var action = target.getAttribute('data-action')

      switch (action) {
        case 'zoom':
          this._overlay.show()
          this._body.appendChild(this._overlay.element)
          this._image.enable()
          this._zoom()
          break;
        case 'close':
          this._overlay.hide()
          this._image.disable()
          break;
        default:
          break;
      }
    } else if (this._image.isActive()) {
      this._overlay.hide()
      this._image.disable()
    }
  }

  ImageZoomService.prototype._zoom = function() {
    var imgRect = this._image.getRect()

    var centerX = this._window.innerWidth / 2
    var centerY = this._window.innerHeight / 2

    var imgRectHalfWidth = imgRect.width / 2
    var imgRectHalfHeight = imgRect.height / 2

    var imgX = imgRect.left + imgRectHalfWidth
    var imgY = imgRect.top + imgRectHalfHeight

    var translate = {
      x: centerX - imgX,
      y: centerY - imgY
    }

    var distX = centerX - imgRectHalfWidth
    var distY = centerY - imgRectHalfHeight

    var scale = (distX < distY) ?
    (this._scaleBase + distX / imgRectHalfWidth) :
    (this._scaleBase + distY / imgRectHalfHeight)

    this._image.transform(translate, scale)
  }

  /**
   * An overlay that hide/show DOM body.
   */
  function Overlay(parent, element) {
    this._parent = parent
    this.element = element
    this._styles = {
      'zIndex': 500,
      'background': '#fff',
      'position': 'fixed',
      'top': 0,
      'left': 0,
      'right': 0,
      'bottom': 0,
      '-webkit-transition': 'opacity 300ms',
      '-o-transition': 'opacity 300ms',
      'transition': 'opacity 300ms'
    }

    this._init()
  }

  Overlay.prototype._init = function() {
    setStyles(this.element, this._styles)
  }

  Overlay.prototype.show = function() {
    setStyles(this.element, {
      'filter': 'alpha(opacity=100)',
      'opacity': 1
    })
  }

  Overlay.prototype.hide = function() {
    setStyles(this.element, {
      'filter': 'alpha(opacity=0)',
      'opacity': 0
    })

    this._parent.removeChild(this.element)
  }

  /**
   * The target image.
   */
  function Zoomable(img) {
    this._targetImg = img
    this._rect = this._targetImg.getBoundingClientRect()
    this._styles = {
      '-webkit-transition': 'all 300ms',
      '-o-transition': 'all 300ms',
      'transition': 'all 300ms'
    }

    this._init()
  }

  Zoomable.prototype._init = function() {
    setStyles(this._targetImg, this._styles)
  }

  Zoomable.prototype.isActive = function() {
    return this._targetImg != null
  }

  Zoomable.prototype.enable = function() {
    this._targetImg.setAttribute('data-action', 'close')

    setStyles(this._targetImg, {
      'position': 'relative',
      'zIndex': 999,
      'cursor': 'pointer',
      'cursor': '-webkit-zoom-out',
      'cursor': '-moz-zoom-out'
    })
  }

  Zoomable.prototype.disable = function() {
    this._targetImg.setAttribute('data-action', 'zoom')

    setStyles(this._targetImg, {
      'transform': '',
      'position': '',
      'zIndex': '',
      'cursor': 'pointer',
      'cursor': '-webkit-zoom-in',
      'cursor': '-moz-zoom-in'
    })

    this._targetImg = null
  }

  Zoomable.prototype.getRect = function() {
    return this._rect
  }

  Zoomable.prototype.transform = function(translate, scale) {
    var transform = `translate(${translate.x}px, ${translate.y}px) scale(${scale}, ${scale})`

    setStyles(this._targetImg, {
      '-webkit-transform': transform,
      '-ms-transform': transform,
      'transform': transform,
    })
  }

  /**
   * Set css styles.
   */
  function setStyles(element, styles) {
    for (var prop in styles) {
      element.style[prop] = styles[prop]
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    new ImageZoomService().init()
  })
}()
