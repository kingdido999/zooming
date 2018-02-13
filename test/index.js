mocha.setup('bdd')

window.addEventListener("load", function (event) {
  mocha.run();
})

var expect = chai.expect
var prefix = 'WebkitAppearance' in document.documentElement.style
  ? '-webkit-'
  : ''

describe('API', function () {
  var z = new Zooming({
    defaultZoomable: '#img-default'
  })
  var defaultOpts = Object.assign({}, z.config())
  var el = document.querySelector(defaultOpts.defaultZoomable)
  var opts = {
    defaultZoomable: 'img[data-action="open"]',
    enableGrab: false,
    preloadImage: false,
    closeOnWindowResize: false,
    transitionDuration: 0.2,
    transitionTimingFunction: 'ease',
    bgColor: '#000',
    bgOpacity: 0.8,
    scaleBase: 0.8,
    scaleExtra: 0.3,
    scrollThreshold: 50,
    zIndex: 777,
    customSize: { width: 800, height: 400 },
    onOpen: function () {
      return 1
    },
    onClose: function () {
      return 1
    },
    onGrab: function () {
      return 1
    },
    onMove: function () {
      return 1
    },
    onRelease: function () {
      return 1
    },
    onBeforeOpen: function () {
      return 1
    },
    onBeforeClose: function () {
      return 1
    },
    onBeforeGrab: function () {
      return 1
    },
    onBeforeRelease: function () {
      return 1
    }
  }

  describe('listen', function () {
    it('should set cursor style to zoom-in', function () {
      expect(el.style.cursor).to.equal(prefix + 'zoom-in')
    })
  })

  describe('config', function () {
    before(function () {
      z.config(opts)
    })

    it('should update options correctly', function () {
      expect(z.config()).to.deep.equal(opts)
    })

    after(function () {
      z.config(defaultOpts)
    })
  })

  describe('config for a new instance', function () {
    var y = new Zooming()
    var newOptions = {
      defaultZoomable: 'img[data-action="open"]',
      scrollThreshold: 250
    }

    before(function () {
      y.config(newOptions)
    })

    it('should update options for the new instance correctly', function () {
      var resultOptions = y.config()

      for (var key in resultOptions) {
        if (key in newOptions) {
          expect(resultOptions[key]).to.equal(newOptions[key])
        } else {
          expect(resultOptions[key]).to.equal(defaultOpts[key])
        }
      }
    })
  })

  describe('open', function () {
    it('should open up the image', function (done) {
      z.open(el, function (target) {
        expect(target.style.position).to.equal('relative')
        expect(target.style.zIndex).to.equal(
          (defaultOpts.zIndex + 1).toString()
        )
        expect(target.style.cursor).to.equal(
          prefix + (defaultOpts.enableGrab ? 'grab' : 'zoom-out')
        )
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })

    it('should insert the overlay', function () {
      var overlay = document.body.lastElementChild
      expect(overlay.tagName).to.equal('DIV')

      var style = overlay.style
      expect(style.zIndex).to.equal(defaultOpts.zIndex.toString())
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

  describe('grab', function () {
    it('should grab the image', function (done) {
      var x = window.innerWidth / 2
      var y = window.innerHeight / 2

      z.grab(x, y, defaultOpts.scaleExtra, function (target) {
        expect(target.style.cursor).to.equal('move')
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })
  })

  describe('release', function () {
    it('should release the image', function (done) {
      z.release(function (target) {
        expect(target.style.position).to.equal('relative')
        expect(target.style.zIndex).to.equal(
          (defaultOpts.zIndex + 1).toString()
        )
        expect(target.style.cursor).to.equal(
          prefix + (defaultOpts.enableGrab ? 'grab' : 'zoom-out')
        )
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })
  })

  describe('close', function () {
    it('should close out the image', function (done) {
      z.close(function (target) {
        expect(target.style.position).to.be.empty
        expect(target.style.zIndex).to.be.empty
        expect(target.style.cursor).to.equal(prefix + 'zoom-in')
        expect(target.style.transition).to.be.empty
        expect(target.style.transform).to.be.empty
        done()
      })
    })

    it('should remove the overlay', function () {
      expect(document.body.lastElementChild.tagName).to.not.equal('DIV')
    })
  })
})
