`import Model from 'epf/model/model'`
`import attr from 'epf/model/attribute'`
`import belongsTo from 'epf/relationships/belongs_to'`
`import hasMany from 'epf/relationships/has_many'`
`import ModelSerializer from 'epf/serializers/model'`

describe "Session", ->

  session = null
  adapter = null

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    Ep.setupContainer(@container)

    class @Post extends Model
      title: attr('string')
    @App.Post = @Post

    class @Comment extends Model
      body: attr('string')
      post: Ep.belongsTo(@Post)
    @App.Comment = @Comment

    @Post.reopen
      comments: Ep.hasMany(@Comment)

    @container.register 'model:post', @Post
    @container.register 'model:comment', @Comment

    adapter = @container.lookup('adapter:main')
    @container = adapter.container
    session = adapter.newSession()

  afterEach ->
    session.destroy()


  describe '.build', ->
  
    it 'instantiates a model', ->
      post = session.build('post')
      expect(post).to.not.be.null
      expect(session.getModel(post)).to.not.eq(post)
      
    it 'instantiates a model with attributes', ->
      post = session.create('post', title: 'test')
      expect(post.title).to.eq('test')
      

  describe '.create', ->

    it 'creates a model', ->
      post = session.create('post')
      expect(post).to.not.be.null
      expect(session.getModel(post)).to.eq(post)

    it 'creates a model with attributes', ->
      post = session.create('post', title: 'test')
      expect(post.title).to.eq('test')


  describe '.deleteModel', ->

    it 'deletes a model', ->
      post = session.merge session.build 'post', id: 1
      session.deleteModel post
      expect(post.isDeleted).to.be.true


  describe '.add', ->

    it 'works with lazy models', ->
      post = @Post.create id: "1"
      added = session.add(post)
      expect(added.session).to.eq(session)

    it 'reuses detached model', ->
      post = @Post.create(title: 'test')
      expect(session.add(post)).to.eq(post)


    it 'overwrites unloaded models', ->
      lazy = @Post.create id: '1'
      session.add(lazy)
      post = session.merge(@Post.create(id: '1', title: 'post'))
      session.add(post)
      expect(session.getModel(lazy)).to.eq(post)
      session.add(lazy)
      expect(session.getModel(lazy)).to.eq(post)


  describe '.invalidate', ->

    it 'causes existing model to be reloaded', ->
      post = session.merge @Post.create id: '1', title: 'refresh me plz'
      hit = false
      adapter.load = (model) ->
        expect(model).to.eq(post)
        hit = true
        Ember.RSVP.resolve(model)
      post.load()
      expect(hit).to.be.false
      session.invalidate(post)
      post.load()
      expect(hit).to.be.true



  describe '.merge', ->

    it 'reuses detached model', ->
      post = @Post.create(id: "1", title: 'test')
      expect(session.merge(post)).to.eq(post)


    it 'handles merging detached model with hasMany child already in session', ->
      comment = session.merge @Comment.create(id: "1", body: "obscurity", post: @Post.create(id: "2"))
      post = session.merge @Post.create(id: "2", comments: [])
      post.comments.addObject(@Comment.create(id: "1", body: "obscurity"))
      expect(post.comments.firstObject).to.eq(comment)


    it 'handles merging detached model with belongsTo child already in session', ->
      post = session.merge @Post.create(id: "2", comments: [@Comment.create(id: "1")])
      comment = session.merge @Comment.create(id: "1", body: "obscurity", post: @Post.create(id: "2", comments: [@Comment.create(id: "1")]))
      expect(comment.post).to.eq(post)
      
      
    it 'handles merging detached model with lazy belongsTo reference', ->
      post = session.merge @Post.create id: "2", comments: []
      comment = session.merge @Comment.create id: "1", body: "obscurity", post: @Post.create(id: "2")
      expect(post.comments.firstObject).to.eq(comment)
      expect(post.isDirty).to.be.false


    it 'handles merging detached model with lazy hasMany reference', ->
      comment = session.merge @Comment.create id: "1", body: "obscurity", post: null
      post = session.merge @Post.create id: "2", comments: [@Comment.create(id: "1")]
      expect(comment.post).to.eq(post)
      expect(comment.isDirty).to.be.false


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


  describe 

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


  describe '.mergeData', ->

    it 'should merge in data', ->
      post = session.mergeData {id: "1", title: "easy peazy"}, 'post'
      expect(post.title).to.eq('easy peazy')
      expect(session.getModel(post)).to.eq(post)
