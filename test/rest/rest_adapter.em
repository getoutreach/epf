describe "Ep.RestAdapter", ->

  adapter = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter


