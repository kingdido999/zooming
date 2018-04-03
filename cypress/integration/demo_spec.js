describe('Demo Page Test', function () {
  beforeEach(function () {
    cy.visit('/index.html')
  })

  it('Opens and closes the first image', function () {
    cy.get('#img-default')
      .click()
      .wait(1000)
      .click()
  })

  it('Opens and closes the second image', function () {
    cy.get('#img-custom')
      .click()
      .wait(1000)
      .click()
  })
})