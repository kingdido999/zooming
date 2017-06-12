var expect = chai.expect
var prefix = 'WebkitAppearance' in document.documentElement.style
  ? '-webkit-'
  : ''

describe('API', function() {
  var testZooming = new Zooming()
  var defaultOpts = Object.assign({}, testZooming.config())
  var els = document.querySelectorAll(defaultOpts.defaultZoomable)
  var el = els[0]

  describe('listen()', function() {
    it('should set cursor style to zoom-in', function() {
      expect(el.style.cursor).to.equal(prefix + 'zoom-in')
    })
  })

  describe('config()', function() {
    var opts = {
      defaultZoomable: 'img[data-action="open"]',
      enableGrab: false,
      preloadImage: false,
      transitionDuration: 0.2,
      transitionTimingFunction: 'ease',
      bgColor: '#000',
      bgOpacity: 0.8,
      scaleBase: 0.8,
      scaleExtra: 0.3,
      scrollThreshold: 50,
      zIndex: 998,
      customSize: { width: 800, height: 400 },
      onOpen: function() {
        return 'onOpen'
      },
      onClose: function() {
        return 'onClose'
      },
      onRelease: function() {
        return 'onRelease'
      },
      onBeforeOpen: function() {
        return 'onBeforeOpen'
      },
      onBeforeClose: function() {
        return 'onBeforeClose'
      },
      onBeforeGrab: function() {
        return 'onBeforeGrab'
      },
      onBeforeRelease: function() {
        return 'onBeforeRelease'
      }
    }

    before(function() {
      testZooming.config(opts)
    })

    it('should update options correctly', function() {
      expect(testZooming.config()).to.deep.equal(opts)
    })

    after(function() {
      testZooming.config(defaultOpts)
    })
  })

  describe('config() new instance', function() {
    var testZooming2 = new Zooming({})
    var defaultZoomable = 'img[data-action="zoom2"]'
    var scrollThreshold = 250
    var newOptions = {
      defaultZoomable: defaultZoomable,
      scrollThreshold: scrollThreshold
    }

    testZooming2.config(newOptions)

    it('should update options correctly', function() {
      var resultOptions = testZooming2.config()

      for (var key in resultOptions) {
        if (key in newOptions) {
          expect(resultOptions[key]).to.equal(newOptions[key])
        } else {
          expect(resultOptions[key]).to.equal(defaultOpts[key])
        }
      }
    })
  })

  describe('open()', function() {
    it('should open up the image', function(done) {
      testZooming.open(el, function(target) {
        expect(target.style.position).to.equal('relative')
        expect(target.style.zIndex).to.equal('999')
        expect(target.style.cursor).to.equal(
          prefix + (defaultOpts.enableGrab ? 'grab' : 'zoom-out')
        )
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })

    it('should insert the overlay', function() {
      var overlay = document.body.lastElementChild
      expect(overlay.tagName).to.equal('DIV')
      var style = overlay.style
      expect(style.zIndex).to.equal('998')
      expect(style.backgroundColor).to.equal(defaultOpts.bgColor)
      expect(style.position).to.equal('fixed')
      expect(style.top).to.equal('0px')
      expect(style.left).to.equal('0px')
      expect(style.right).to.equal('0px')
      expect(style.bottom).to.equal('0px')
      expect(style.opacity).to.equal(defaultOpts.bgOpacity.toString())
      expect(style.transition).to.not.be.empty
    })
  })

  describe('grab()', function() {
    var x = window.innerWidth / 2
    var y = window.innerHeight / 2

    it('should grab the image', function(done) {
      testZooming.grab(x, y, defaultOpts.scaleExtra, function(target) {
        expect(target.style.cursor).to.equal('move')
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })
  })

  describe('release()', function() {
    it('should release the image', function(done) {
      testZooming.release(function(target) {
        expect(target.style.position).to.equal('relative')
        expect(target.style.zIndex).to.equal('999')
        expect(target.style.cursor).to.equal(
          prefix + (defaultOpts.enableGrab ? 'grab' : 'zoom-out')
        )
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })
  })

  describe('close()', function() {
    it('should close out the image', function(done) {
      testZooming.close(function(target) {
        expect(target.style.position).to.be.empty
        expect(target.style.zIndex).to.be.empty
        expect(target.style.cursor).to.equal(prefix + 'zoom-in')
        expect(target.style.transition).to.be.empty
        expect(target.style.transform).to.be.empty
        done()
      })
    })

    it('should remove the overlay', function() {
      expect(document.body.lastElementChild.tagName).to.not.equal('DIV')
    })
  })
})
