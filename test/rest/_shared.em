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
        adapter.runLater ( -> resolve(json) ), 0

    runLater: (callback) ->
      Ember.run.later callback, 0

  @App = Ember.Namespace.create()
  @container = new Ember.Container()

  # TestAdapter already is a subclass
  @RestAdapter = TestRestAdapter.extend()

  @container.register 'session:base', Ep.Session, singleton: false
  @container.register 'session:child', Ep.ChildSession, singleton: false
  @container.register 'serializer:main', Ep.RestSerializer
  # TODO: adapter mappings are currently reified so in tests that
  # customize these we need to re-instantiate
  @container.register 'adapter:main', @RestAdapter, singleton: false

  @container.typeInjection 'adapter', 'serializer', 'serializer:main'

  @adapter = @container.lookup('adapter:main')
  # Can't use container since the adapter is non-singleton
  # and injecting into the main session duplicates
  @session = @adapter.newSession()