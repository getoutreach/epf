describe "Ep.Session", ->

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()

    # TestAdapter already is a subclass
    @RestAdapter = require('./support/test_rest_adapter').extend()

    @container.register 'session:base', Ep.Session
    @container.register 'serializer:main', Ep.RestSerializer
    # TODO: adapter mappings are currently reified so in tests that
    # customize these we need to re-instantiate
    @container.register 'adapter:main', @RestAdapter, singleton: false
    @container.register 'store:main', Ep.Store

    @container.typeInjection 'adapter', 'store', 'store:main'
    @container.typeInjection 'adapter', 'serializer', 'serializer:main'

    @adapter = @container.lookup('adapter:main')

    class @Post extends Ep.Model
      title: Ep.attr('string')
    @App.Post = @Post

    @container.register 'model:post', @Post, instantiate: false

    @session = @adapter.newSession()


  describe 'with orphaned proxy', ->

    beforeEach ->
      @lazyPost = @session.merge Ep.LazyModel.create
        id: "1"
        type: @Post
      @post = @session.merge @Post.create
        id: "1"
        title: "this is the title"

    it 'has actual record in `models`', ->
      expect(@session.models.toArray()).to.eql([@post])

    it 'has proxy in orphans', ->
      expect(@session.orphans.toArray()).to.eql([@lazyPost])


  it 'can create with hash', ->
    @post = @session.create('post', title: 'test')
    expect(@post.title).to.eq('test')



