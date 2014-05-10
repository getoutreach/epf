describe "Ep.ChildSession", ->

  parent = null
  session = null
  adapter = null
  Post = null
  Comment = null

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    Ep.__container__ = @container
    Ep.setupContainer(@container)

    class Post extends Ep.Model
      title: Ep.attr('string')
      comments: Ep.hasMany('comment')
      
    @App.Post = Post
      
    class Comment extends Ep.Model
      post: Ep.belongsTo('post')
      
    @App.Comment = Comment

    @container.register 'model:post', Post
    @container.register 'model:comment', Comment

    adapter = @container.lookup('adapter:main')

    parent = adapter.newSession()
    session = parent.newSession()

  afterEach ->
    delete Ep.__container__

  describe '.query', ->

    it 'queries', ->
      adapter.query = (type, query) ->
        expect(query).to.eql({q: "herpin"})
        Ember.RSVP.resolve([Post.create(id: "1", title: 'herp'), Post.create(id: "2", title: 'derp')])
      session.query('post', {q: "herpin"}).then (models) ->
        expect(models.length).to.eq(2)


  describe '.load', ->

    it 'loads immediately if loaded in parent session', ->
      parent.merge Post.create(id: "1", title: "flash gordon")
      post = session.load(Post, 1)
      expect(post.isProxy).to.be.true
      expect(post.isLoaded).to.be.true
      expect(post.title).to.eq('flash gordon')
      
      
  describe '.add', ->
  
    it 'includes lazy relationships', ->
      parentComment = parent.merge Comment.create(id: "1", post: Ep.LazyModel.create(type: Post, id: "2"))
      comment = session.add(parentComment)
      expect(comment).to.not.eq(parentComment)
      expect(comment.post).to.not.be.bull
      expect(comment.post.session).to.eq(session)
  
