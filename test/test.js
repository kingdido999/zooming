/* eslint-disable */

var expect = chai.expect
var should = chai.should()

var prefix = 'WebkitAppearance' in document.documentElement.style ? '-webkit-' : ''
var options = Zooming.config()

describe('API', function() {
  var els = document.querySelectorAll('img[data-action="zoom"]')
  var i = els.length

  describe('listen()', function() {
    while (i--) {
      var el = els[i]
      it('should set cursor style to zoom-in', function() {
        expect(el.style.cursor).to.equal(prefix + 'zoom-in')
      })
    }
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
})
