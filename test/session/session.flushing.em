describe "Ep.Session", ->

  session = null

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

    @adapter = @container.lookup('adapter:main')
    session = @adapter.newSession()


  describe 'flushing', ->


    it 'can update while flush is pending', ->
      post = session.merge @Post.create(id: "1", title: 'original')
      post.title = 'update 1'
      f1 = session.flush()
      post.title = 'update 2'
      expect(post.title).to.eq('update 2')

      f1.then ->
        # TODO: this will show update 1 because we are
        # using 'theirs' by default. switch to 3-way
        expect(post.title).to.eq('update 1')
        post.title = 'update 2'
        session.flush().then ->
          expect(post.title).to.eq('update 2')








