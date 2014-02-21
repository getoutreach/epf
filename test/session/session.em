describe "Ep.Session", ->

  session = null

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()

    class @Post extends Ep.Model
      title: Ep.attr('string')
    @App.Post = @Post

    class @Comment extends Ep.Model
      body: Ep.attr('string')
      post: Ep.belongsTo(@Post)
    @App.Comment = @Comment

    @Post.reopen
      comments: Ep.hasMany(@Comment)

    @container.register 'model:post', @Post
    @container.register 'model:comment', @Comment
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
      post = session.merge(@Post.create(id: '1', title: 'post'))
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


    it 'reuses detached model', ->
      post = @Post.create(id: "1", title: 'test')
      expect(session.merge(post)).to.eq(post)


    it 'handles merging detached model with hasMany child already in session', ->
      comment = session.merge @Comment.create(id: "1", body: "obscurity", post: Ep.LazyModel.create(type: @Post, id: "2"))
      post = session.merge @Post.create(id: "2")
      post.comments.addObject(@Comment.create(id: "1", body: "obscurity"))
      expect(post.comments.firstObject).to.eq(comment)


    it 'handles merging detached model with belongsTo child already in session', ->
      post = session.merge @Post.create(id: "2", comments: [Ep.LazyModel.create(type: @Comment, id: "1")])
      comment = session.merge @Comment.create(id: "1", body: "obscurity", post: @Post.create(id: "2"))
      expect(comment.post).to.eq(post)


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


  describe '.markClean', ->

    it 'makes models no longer dirty', ->
      post = session.merge @Post.create(id: "1", title: 'test')
      post.title = 'dirty bastard'
      expect(post.isDirty).to.be.true
      session.markClean(post)
      expect(post.isDirty).to.be.false

    it 'works with already clean models', ->
      post = session.merge @Post.create(id: "1", title: 'test')
      expect(post.isDirty).to.be.false
      session.markClean(post)
      expect(post.isDirty).to.be.false

  describe '.touch', ->

    it 'makes the model dirty', ->
      post = session.merge @Post.create(id: "1", title: 'test')
      expect(post.isDirty).to.be.false
      session.touch(post)
      expect(post.isDirty).to.be.true


  describe '.isDirty', ->

    it 'is true when models are dirty', ->
      post = session.merge @Post.create(id: "1", title: 'test')
      expect(session.isDirty).to.be.false
      session.touch(post)
      expect(session.isDirty).to.be.true

    it 'becomes false after successful flush', ->
      post = session.merge @Post.create(id: "1", title: 'test')
      session.touch(post)
      expect(session.isDirty).to.be.true
      session.flush().then ->
        expect(session.isDirty).to.be.false


