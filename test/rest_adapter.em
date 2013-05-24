
describe "Orm.RestAdapter", ->

  beforeEach ->
    ajaxResults = @ajaxResults = {}
    ajaxCalls = @ajaxCalls = []
    class @RestAdapter extends Orm.RestAdapter
      ajax: (url, type, hash) ->
        new Ember.RSVP*.Promise (resolve, reject) ->
          key = type + ":" + url
          json = ajaxResults[key]
          return reject("no data") unless json
          json = json() if typeof json == 'function'
          ajaxCalls.push(key)
          Ember.run.later ( -> resolve(json) ), 0

    @App = Ember.Namespace.create()
    @container = new Ember.Container()

    @container.register 'session:base', Orm.Session
    @container.register 'serializer:main', Orm.RestSerializer
    @container.register 'adapter:main', @RestAdapter
    @container.register 'store:main', Orm.Store

    @container.typeInjection 'adapter', 'store', 'store:main'
    @container.typeInjection 'adapter', 'serializer', 'serializer:main'

    class @Post extends Orm.Model
      title: Orm.attr('string')
    @App.Post = @Post

    @container.register 'model:post', @Post, instantiate: false

  it 'should load data from the server', (done) ->

    @ajaxResults['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw'}

    adapter = @container.lookup('adapter:main')
    session = adapter.newSession()

    ajaxCalls = @ajaxCalls

    session.load(@Post, 1).then (post) ->
      expect(post.id).to.eq("1")
      expect(post.title).to.eq('mvcc ftw')
      expect(ajaxCalls).to.eql(['GET:/posts/1'])
      done()