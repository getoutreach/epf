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

  afterEach ->
    session.destroy()


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


  describe 'merge', ->

    it 'works with proxy with no corresponding record in session', ->
      post = @Post.create(id: '1', title: 'someday')
      lazy = Ep.LazyModel.create
        content: post
      merged = session.merge(lazy)
      expect(merged.id).to.eq('1')


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


  describe 'rollback', ->
    beforeEach ->
      @post1 = session.merge Ep.LazyModel.create
        content: @Post.create({id: '0', title: 'original'})
      @post2 = session.merge Ep.LazyModel.create
        content: @Post.create({id: '1', title: 'original'})
      @post1.set('title', 'dirty')
      @post2.set('title', 'dirty')

    it 'works with a single model', ->
      session.rollback(@post1)
      expect(@post1.get('title')).to.eq('original')
      expect(@post1.get('isDirty')).to.be.false
      expect(@post2.get('title')).to.eq('dirty')
      expect(@post2.get('isDirty')).to.be.true  

    it 'works with a list of models in one arg', ->
      session.rollback([@post1, @post2])
      expect(@post1.get('title')).to.eq('original')
      expect(@post1.get('isDirty')).to.be.false
      expect(@post2.get('title')).to.eq('original')
      expect(@post2.get('isDirty')).to.be.false

    it 'works with a list of models in multiple args', ->
      session.rollback(@post1, @post2)
      expect(@post1.get('title')).to.eq('original')
      expect(@post1.get('isDirty')).to.be.false
      expect(@post2.get('title')).to.eq('original')
      expect(@post2.get('isDirty')).to.be.false

    it 'works with no args on all dirty models', ->
      session.rollback()
      expect(@post1.get('title')).to.eq('original')
      expect(@post1.get('isDirty')).to.be.false
      expect(@post2.get('title')).to.eq('original')
      expect(@post2.get('isDirty')).to.be.false

