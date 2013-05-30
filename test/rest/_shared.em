exports.setupRest = ->
  class TestRestAdapter extends Ep.RestAdapter
    h: null
    r: null
    init: ->
      super()
      @h = []
      @r = {}
    ajax: (url, type, hash) ->
      adapter = @
      new Ember.RSVP*.Promise (resolve, reject) ->
        key = type + ":" + url
        adapter.h.push(key)
        json = adapter.r[key]
        return reject("No data for #{key}") unless json
        json = json(url, type, hash) if typeof json == 'function'
        Ember.run.later ( -> resolve(json) ), 0

  @App = Ember.Namespace.create()
  @container = new Ember.Container()

  # TestAdapter already is a subclass
  @RestAdapter = TestRestAdapter.extend()

  @container.register 'session:base', Ep.Session
  @container.register 'serializer:main', Ep.RestSerializer
  # TODO: adapter mappings are currently reified so in tests that
  # customize these we need to re-instantiate
  @container.register 'adapter:main', @RestAdapter, singleton: false
  @container.register 'store:main', Ep.Store

  @container.typeInjection 'adapter', 'store', 'store:main'
  @container.typeInjection 'adapter', 'serializer', 'serializer:main'

  @adapter = @container.lookup('adapter:main')