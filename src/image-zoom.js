+function() {

  function ImageZoomService() {
    this._scaleBase = 1.0
    this._target = null // Zoomable target
    this._window = window
    this._document = document
    this._body = document.body

    // For scrolling
    this._last_known_scroll_position = 0
    this._ticking = false

    this._handleClick = this._handleClick.bind(this)
    this._handleKeyDown = this._handleKeyDown.bind(this)
    this._handleScroll = this._handleScroll.bind(this)
  }

  ImageZoomService.prototype = {
    init: function() {
      this._body.addEventListener('click', this._handleClick)
    },

    _zoom: function() {
      this._calculateZoom((function(translate, scale) {
        this._target.zoomIn(translate, scale)
      }).bind(this))

      this._document.addEventListener('keydown', this._handleKeyDown)
      this._document.addEventListener('scroll', this._handleScroll)
    },

    _close: function() {
      if (!this._target) return

      this._target.zoomOut()
      this._target = null

      this._document.removeEventListener('keydown', this._handleKeyDown)
      this._document.removeEventListener('scroll', this._handleScroll)
    },

    _calculateZoom: function(callback) {
      var imgRect = this._target.getRect()

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

      if (target.tagName === 'IMG' && target.hasAttribute('data-action')) {
        switch (target.getAttribute('data-action')) {
          case 'zoom':
            // Make the target image zoomable
            this._target = new Zoomable(target)
            this._zoom()
            break;
          case 'close':
            this._close()
            break;
          default:
            break;
        }
      } else {
        this._close()
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
   * The zoomable target.
   */
  function Zoomable(target) {
    this._target = target
    this._overlay = null // An overlay that whites out the body
    this._rect = this._target.getBoundingClientRect()
    this._body = document.body

    this._handleTransitionEnd = this._handleTransitionEnd.bind(this)
  }

  Zoomable.prototype = {
    zoomIn: function(translate, scale) {
      this._target.setAttribute('data-action', 'close')
      this._target.classList.add('image-zoom-img')

      // Zoom in the image
      var transform = 'translate(' + translate.x + 'px,' + translate.y + 'px) ' +
      'scale(' + scale + ',' + scale + ')'

      setStyles(this._target, {
        '-webkit-transform': transform,
        '-ms-transform': transform,
        'transform': transform,
      })

      this._overlay = document.createElement('div')

      // If add class to overlay before transforming the image,
      // it will cause image flickering on Safari.
      this._overlay.classList.add('image-zoom-overlay')

      this._body.appendChild(this._overlay)

      // Use setTimeout to apply correct body opacity transition when
      // zooming in, otherwise the transition effect won't trigger.
      window.setTimeout((function() {
        this._body.classList.add('image-zoom-overlay-show')
      }).bind(this), 50)
    },

    zoomOut: function() {
      this._target.setAttribute('data-action', 'zoom')
      this._target.addEventListener('transitionend', this._handleTransitionEnd)
      this._body.classList.remove('image-zoom-overlay-show')

      // Zoom out the image
      setStyles(this._target, {
        '-webkit-transform': '',
        '-ms-transform': '',
        'transform': '',
      })
    },

    getRect: function() {
      return this._rect
    },

    _handleTransitionEnd: function(event) {
      if (this._target.getAttribute('data-action') === 'zoom') {
        this._body.removeChild(this._overlay)
        this._target.classList.remove('image-zoom-img')
      }

      this._target.removeEventListener('transitionend', this._handleTransitionEnd)
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
