var expect = chai.expect

var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''
var defaultOpts = Object.assign({}, Zooming.config())

describe('API', function() {
  var els = document.querySelectorAll(defaultOpts.defaultZoomable)
  var el = els[0]
  var i = els.length

  describe('listen()', function() {
    it('should set cursor style to zoom-in', function() {
      while (i--) {
        var el = els[i]
        expect(el.style.cursor).to.equal(prefix + 'zoom-in')
      }
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
      onOpen: function() { return 'onOpen' },
      onClose: function() { return 'onClose' },
      onRelease: function() { return 'onRelease' },
      onBeforeOpen: function() { return 'onBeforeOpen' },
      onBeforeClose: function() { return 'onBeforeClose' },
      onBeforeGrab: function() { return 'onBeforeGrab' },
      onBeforeMove: function() { return 'onBeforeMove' },
      onBeforeRelease: function() { return 'onBeforeRelease' }
    }

    before(function() {
      Zooming.config(opts)
    })

    it('should update options correctly', function() {
      expect(Zooming.config()).to.deep.equal(opts)
    })

    after(function() {
      Zooming.config(defaultOpts)
    })
  })

  describe('open()', function() {
    it('should open up the image', function(done) {
      Zooming.open(el, function(target) {
        expect(target.style.position).to.equal('relative')
        expect(target.style.zIndex).to.equal('999')
        expect(target.style.cursor).to.equal(prefix + (defaultOpts.enableGrab ? 'grab': 'zoom-out'))
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })

    it('should insert the overlay', function() {
      var overlay = el.parentNode.lastChild
      var style = overlay.style
      expect(overlay.getAttribute('id')).to.equal('zoom-overlay')
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
      Zooming.grab(x, y, defaultOpts.scaleExtra, function(target) {
        expect(target.style.cursor).to.equal('move')
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })
  })

  describe('release()', function() {
    it('should release the image', function(done) {
      Zooming.release(function(target) {
        expect(target.style.position).to.equal('relative')
        expect(target.style.zIndex).to.equal('999')
        expect(target.style.cursor).to.equal(prefix + (defaultOpts.enableGrab ? 'grab': 'zoom-out'))
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })
  })

  describe('close()', function() {
    it('should close out the image', function(done) {
      Zooming.close(function(target) {
        expect(target.style.position).to.be.empty
        expect(target.style.zIndex).to.be.empty
        expect(target.style.cursor).to.equal(prefix + 'zoom-in')
        expect(target.style.transition).to.be.empty
        expect(target.style.transform).to.be.empty
        done()
      })
    })

    it('should remove the overlay', function() {
      var overlay = document.querySelector('#zoom-overlay')
      expect(overlay).to.not.exist
    })
  })
})
