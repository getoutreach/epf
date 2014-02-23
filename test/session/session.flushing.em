TestContainer = require('../test_container')

describe "Ep.Session", ->

  session = null

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new TestContainer()

    class @Post extends Ep.Model
      title: Ep.attr('string')
    @App.Post = @Post

    @container.register 'model:post', @Post

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
        expect(post.title).to.eq('update 2')
        post.title = 'update 3'
        session.flush().then ->
          expect(post.title).to.eq('update 3')








