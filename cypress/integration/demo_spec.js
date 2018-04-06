describe('Demo Page Test', function () {
  beforeEach(function () {
    cy.visit('/index.html')
  })

  it('Open, grab, release and close the image', function () {
    cy.get('#img-default')
      .click()
      .wait(500)
      .trigger('mousedown', { button: 0 })
      .wait(500)
      .trigger('mouseup', { button: 0 })
      .wait(500)
      .click()
  })
})