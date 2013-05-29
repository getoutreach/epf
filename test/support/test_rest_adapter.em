
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

module.exports = TestRestAdapter