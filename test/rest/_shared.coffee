`import TestRestAdapter from './_test_adapter'`

setup = ->
  @App = Ember.Namespace.create()
  @container = new Ember.Container()
  Ep.setupContainer(@container)

  # TestAdapter already is a subclass
  @RestAdapter = TestRestAdapter.extend()

  @container.register 'adapter:main', @RestAdapter

  @adapter = @container.lookup('adapter:main')
  @session = @adapter.newSession()

  @container = @adapter.container
  
  Ep.__container__ = @container


`export default setup`
