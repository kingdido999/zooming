describe('Demo Page Test', function () {
  before(function () {
    cy.visit('/index.html')
  })

  it('Open, grab, release and close the default image', function () {
    cy.get('#img-default')
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/zoom-in/)
      })
      .click()
      .wait(500)
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/grab/)
        expect(img).to.have.css('position').and.equal('relative')
        expect(img).to.have.css('z-index').and.equal('999')
        expect(img).to.have.css('transition')
        expect(img).to.have.css('transform')
      })
      .trigger('mousedown', { button: 0 })
      .wait(500)
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/move/)
        expect(img).to.have.css('position').and.equal('relative')
        expect(img).to.have.css('z-index').and.equal('999')
        expect(img).to.have.css('transition')
        expect(img).to.have.css('transform')
      })
      .trigger('mouseup', { button: 0 })
      .wait(500)
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/grab/)
        expect(img).to.have.css('position').and.equal('relative')
        expect(img).to.have.css('z-index').and.equal('999')
        expect(img).to.have.css('transition')
        expect(img).to.have.css('transform')
      })
      .click()
      .wait(500)
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/zoom-in/)
      })
  })

  it('Open, grab, release and close the custom image', function () {
    cy.get('#img-custom')
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/zoom-in/)
      })
      .click()
      .wait(500)
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/grab/)
        expect(img).to.have.css('position').and.equal('relative')
        expect(img).to.have.css('z-index').and.equal('999')
        expect(img).to.have.css('transition')
        expect(img).to.have.css('transform')
      })
      .trigger('mousedown', { button: 0 })
      .wait(500)
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/move/)
        expect(img).to.have.css('position').and.equal('relative')
        expect(img).to.have.css('z-index').and.equal('999')
        expect(img).to.have.css('transition')
        expect(img).to.have.css('transform')
      })
      .trigger('mouseup', { button: 0 })
      .wait(500)
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/grab/)
        expect(img).to.have.css('position').and.equal('relative')
        expect(img).to.have.css('z-index').and.equal('999')
        expect(img).to.have.css('transition')
        expect(img).to.have.css('transform')
      })
      .click()
      .wait(500)
      .should(img => {
        expect(img).to.have.css('cursor').and.match(/zoom-in/)
      })
  })
})