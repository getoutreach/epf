`import TestRestAdapter from './_test_adapter'`

setup = ->
  @App = Ember.Namespace.create()
  @container = new Ember.Container()
  Coalesce.setupContainer(@container)

  # TestAdapter already is a subclass
  @RestAdapter = TestRestAdapter.extend()

  @container.register 'adapter:main', @RestAdapter

  @adapter = @container.lookup('adapter:main')
  @session = @adapter.newSession()

  @container = @adapter.container
  
  Coalesce.__container__ = @container


`export default setup`
