describe('My First Test', function () {
  beforeEach(function () {
    cy.visit('/index.html')
  })

  it('Opens and closes the first image', function () {
    cy.get('#img-default')
      .click()
      .wait(1000)
      .click()
  })
})