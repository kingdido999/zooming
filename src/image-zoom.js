+function() {

  function ImageZoomService() {
    this._scaleBase = 1.0
    this._image = null
    this._overlay = null
    this._window = window
    this._document = document
    this._body = document.body
    this._last_known_scroll_position = 0
    this._ticking = false
  }

  ImageZoomService.prototype = {
    init: function() {
      this._body.addEventListener('click', this._handleClick.bind(this))
      this._overlay = new Overlay()
    },

    _zoom: function() {
      this._calculateZoom((function(translate, scale) {
        this._image.zoomIn(translate, scale)
      }).bind(this))

      this._overlay.show()
      this._document.addEventListener('keydown', this._handleKeyDown.bind(this))
      this._document.addEventListener('scroll', this._handleScroll.bind(this))
    },

    _close: function() {
      if (!this._image) return

      this._overlay.hide()
      this._image.zoomOut()
      this._document.removeEventListener('keydown', this._handleKeyDown.bind(this))
      this._document.removeEventListener('scroll', this._handleScroll.bind(this))
      this._image = null
    },

    _calculateZoom: function(callback) {
      var imgRect = this._image.getRect()

      var windowCenter = {
        x: this._window.innerWidth / 2,
        y: this._window.innerHeight / 2
      }

      var imgHalfWidth = imgRect.width / 2
      var imgHalfHeight = imgRect.height / 2

      var imgCenter = {
        x: imgRect.left + imgHalfWidth,
        y: imgRect.top + imgHalfHeight
      }

      // The vector to translate image to the window center
      var translate = {
        x: windowCenter.x - imgCenter.x,
        y: windowCenter.y - imgCenter.y
      }

      // The distance between image edge and window edge
      var distFromImageEdgeToWindowEdge = {
        x: windowCenter.x - imgHalfWidth,
        y: windowCenter.y - imgHalfHeight
      }

      // The additional scale is based on the smaller value of
      // scaling horizontally and scaling vertically
      var scaleHorizontally = distFromImageEdgeToWindowEdge.x / imgHalfWidth
      var scaleVertically = distFromImageEdgeToWindowEdge.y / imgHalfHeight
      var scale = this._scaleBase + Math.min(scaleHorizontally, scaleVertically)

      callback(translate, scale)
    },

    _handleClick: function(event) {
      var target = event.target

      if (!target) return

      if (target.tagName !== 'IMG') this._close()

      if (target.hasAttribute('data-action')) {
        // Make the target image zoomable
        this._image = new Zoomable(target)

        switch (target.getAttribute('data-action')) {
          case 'zoom':
            this._zoom()
            break;
          case 'close':
            this._close()
            break;
          default:
            break;
        }
      }
    },

    _handleKeyDown: function(event) {
      if (event.keyCode === 27) this._close() // Esc
    },

    _handleScroll: function(event) {
      if (!this._ticking) {
        this._window.requestAnimationFrame((function() {
          this._close()
          this._ticking = false
        }).bind(this))
      }
      this._ticking = true
    }
  }

  /**
   * The overlay that hide/show DOM body.
   */
  function Overlay() {
    this._body = document.body
    this._element = document.createElement('div')
    this._element.classList.add('image-zoom-overlay')
  }

  Overlay.prototype = {
    show: function() {
      this._body.classList.add('image-zoom-overlay-show')
      this._body.appendChild(this._element)
    },

    hide: function() {
      this._body.classList.remove('image-zoom-overlay-show')
      this._body.removeChild(this._element)
    }
  }

  /**
   * The target image.
   */
  function Zoomable(img) {
    this._target = img
    this._rect = this._target.getBoundingClientRect()
    this._body = document.body
  }

  Zoomable.prototype = {
    zoomIn: function(translate, scale) {
      this._target.setAttribute('data-action', 'close')
      this._target.classList.add('image-zoom-transition', 'image-zoom-img')

      var transform = 'translate(' + translate.x + 'px,' + translate.y + 'px) ' +
      'scale(' + scale + ',' + scale + ')'

      setStyles(this._target, {
        '-webkit-transform': transform,
        '-ms-transform': transform,
        'transform': transform,
      })
    },

    zoomOut: function() {
      this._target.setAttribute('data-action', 'zoom')
      this._target.classList.remove('image-zoom-img')

      setStyles(this._target, {
        '-webkit-transform': '',
        '-ms-transform': '',
        'transform': '',
      })
    },

    getRect: function() {
      return this._rect
    }
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
