describe "Ep.ChildSession", ->

  parent = null
  session = null
  adapter = null
  Post = null

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()

    class Post extends Ep.Model
      title: Ep.attr('string')
    @App.Post = Post

    @container.register 'model:post', Post
    @container.register 'adapter:main', Ep.LocalAdapter
    @container.register 'session:base', Ep.Session, singleton: false
    @container.register 'session:child', Ep.ChildSession, singleton: false
    @container.register 'serializer:main', Ep.RestSerializer

    @container.typeInjection 'adapter', 'serializer', 'serializer:main'

    adapter = @container.lookup('adapter:main')

    parent = adapter.newSession()
    session = parent.newSession()


  describe 'query', ->

    it 'works', ->
      adapter.query = (type, query) ->
        expect(query).to.eql({q: "herpin"})
        Ember.RSVP.resolve([Post.create(id: "1", title: 'herp'), Post.create(id: "2", title: 'derp')])
      session.query('post', {q: "herpin"}).then (models) ->
        expect(models.length).to.eq(2)


  describe 'load', ->

    it 'loads immediately if loaded in parent session', ->
      parent.merge Post.create(id: "1", title: "flash gordon")
      post = session.load(Post, 1)
      expect(post.isProxy).to.be.true
      expect(post.isLoaded).to.be.true
      expect(post.title).to.eq('flash gordon')







