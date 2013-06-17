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

    adapter = @container.lookup('adapter:main')
    session = adapter.newSession()


  describe 'create', ->


    it 'works with hash', ->
      post = session.create('post', title: 'test')
      expect(post.title).to.eq('test')


  describe 'add', ->


    it 'works with lazy models', ->
      post = Ep.LazyModel.create
        id: "1"
        type: @Post
      added = session.add(post)
      expect(added.session).to.eq(session)


    it 'reuses detached model', ->
      post = @Post.create(title: 'test')
      expect(session.add(post)).to.eq(post)


    it 'overwrites unloaded models', ->
      lazy = Ep.LazyModel.create(id: '1', type: @Post)
      session.add(lazy)
      post = @Post.create(id: '1', title: 'post')
      session.add(post)
      expect(session.getModel(lazy)).to.eq(post)
      session.add(lazy)
      expect(session.getModel(lazy)).to.eq(post)


  context 'with orphaned proxy', ->

    beforeEach ->
      @lazyPost = session.merge Ep.LazyModel.create
        id: "1"
        type: @Post
      @post = session.merge @Post.create
        id: "1"
        title: "this is the title"

    it 'has actual record in `models`', ->
      expect(session.models.toArray()).to.eql([@post])

    it 'has proxy in orphans', ->
      expect(session.orphans.toArray()).to.eql([@lazyPost])



