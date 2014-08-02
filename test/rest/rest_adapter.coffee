`import setup from './_shared'`
`import Model from 'epf/model/model'`

describe "Ep.RestAdapter", ->

  adapter = null
  session = null

  beforeEach ->
    setup.apply(this)
    adapter = @adapter
    session = @session
    Ep.__container__ = @container

    `class Post extends Model {}`
    @Post = Post
    Post.defineSchema
      typeKey: 'post'
      attributes:
        title: {type: 'string'}
      relationships:
        comments: {kind: 'hasMany', type: 'comment'}
    @App.Post = @Post
    @container.register 'model:post', @Post

    `class Comment extends Model {}`
    @Comment = Comment
    Comment.defineSchema
      typeKey: 'comment'
      attributes:
        body: {type: 'string'}
      relationships:
        post: {kind: 'belongsTo', type: 'post'}
        
    debugger
    @App.Comment = @Comment
    @container.register 'model:comment', @Comment

  afterEach ->
    delete Ep.__container__

  describe '.mergePayload', ->

    data =
      post: {id: 1, title: 'ma post', comments: [2, 3]}
      comments: [{id: 2, body: 'yo'}, {id: 3, body: 'sup'}]

    it.only 'should merge with typeKey as context', ->
      post = adapter.mergePayload(data, 'post', session).firstObject
      expect(post.title).to.eq('ma post')
      expect(post).to.eq(session.getModel(post))

    it 'should merge with no context', ->
      models = adapter.mergePayload(data, null, session)
      expect(models.length).to.eq(3)
