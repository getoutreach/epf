describe "Ep.ChildSession", ->

  parent = null
  session = null
  adapter = null

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()

    class @Post extends Ep.Model
      title: Ep.attr('string')
    @App.Post = @Post

    @container.register 'model:post', @Post, instantiate: false
    @container.register 'adapter:main', Ep.LocalAdapter
    @container.register 'session:base', Ep.Session, singleton: false

    @container.typeInjection 'adapter', 'serializer', 'serializer:main'

    adapter = @container.lookup('adapter:main')

    parent = adapter.newSession()
    session = parent.newSession()

  it 'supports findQuery', ->
    Post = @Post
    adapter.findQuery = (type, query) ->
      expect(query).to.eql({q: "herpin"})
      Ember.RSVP.resolve([Post.create(id: "1", title: 'herp'), Post.create(id: "2", title: 'derp')])
    session.findQuery('post', {q: "herpin"}).then (models) ->
      expect(models.length).to.eq(2)







