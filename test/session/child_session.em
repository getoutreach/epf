`import Model from 'epf/model/model'`
`import attr from 'epf/model/attribute'`
`import belongsTo from 'epf/relationships/belongs_to'`
`import hasMany from 'epf/relationships/has_many'`
`import ModelSerializer from 'epf/serializers/model'`
`import setupContainer from 'epf/setup_container'`

describe "ChildSession", ->

  parent = null
  session = null
  adapter = null
  Post = null
  Comment = null

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    Ep.__container__ = @container
    setupContainer(@container)

    class Post extends Model
      title: attr('string')
      comments: hasMany('comment')
      
    @App.Post = Post
      
    class Comment extends Model
      post: belongsTo('post')
      
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

    it 'loads from parent session', ->
      parent.merge Post.create(id: "1", title: "flash gordon")
      session.load(Post, 1).then (post) ->
        expect(post).to.not.eq(parent.getModel(post))
        expect(post.title).to.eq('flash gordon')
      
      
  describe '.add', ->
  
    it 'includes lazy relationships', ->
      parentComment = parent.merge Comment.create(id: "1", post: Post.create(id: "2"))
      comment = session.add(parentComment)
      expect(comment).to.not.eq(parentComment)
      expect(comment.post).to.not.be.bull
      expect(comment.post.session).to.eq(session)
  
