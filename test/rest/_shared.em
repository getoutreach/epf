setup = ->
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
        hash.data = JSON.parse(hash.data) if hash && typeof hash.data == 'string'
        throw "No data for #{key}" unless json
        json = json(url, type, hash) if typeof json == 'function'
        adapter.runLater ( -> resolve(json) ), 0

    runLater: (callback) ->
      Ember.run.later callback, 0

  @App = Ember.Namespace.create()
  @container = new Ember.Container()
  Ep.setupContainer(@container)

  # TestAdapter already is a subclass
  @RestAdapter = TestRestAdapter.extend()

  @container.register 'adapter:main', @RestAdapter

  @adapter = @container.lookup('adapter:main')
  @session = @adapter.newSession()

  @container = @adapter.container


`export default setup`