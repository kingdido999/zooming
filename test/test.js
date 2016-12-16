/* eslint-disable */

var expect = chai.expect
var should = chai.should()

var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''
var options = Zooming.config()

describe('API', function() {
  var els = document.querySelectorAll('img[data-action="zoom"]')
  var i = els.length

  describe('listen()', function() {
    it('should set cursor style to zoom-in', function() {
      while (i--) {
        var el = els[i]
        expect(el.style.cursor).to.equal(prefix + 'zoom-in')
      }
    })
  })

  describe('open()', function() {
    var el = els[0]

    it('should open up the image', function(done) {
      Zooming.open(el, function(target) {
        expect(target.style.position).to.equal('relative')
        expect(target.style.zIndex).to.equal('999')
        expect(target.style.cursor).to.equal(prefix + (options.enableGrab ? 'grab': 'zoom-out'))
        expect(target.style.transition).to.not.be.empty
        expect(target.style.transform).to.not.be.empty
        done()
      })
    })
  })

  describe('grab()', function() {
    var x = window.innerWidth / 2
    var y = window.innerHeight / 2

    it('should grab the image', function(done) {
      Zooming.grab(x, y, true, function(target) {
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
        expect(target.style.cursor).to.equal(prefix + (options.enableGrab ? 'grab': 'zoom-out'))
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
  })
})
