`import Model from 'epf/model/model'`

describe 'Ep.Adapter', ->

  beforeEach ->
    @container = new Ember.Container()
    Ep.setupContainer(@container)
    `class Post extends Model {}`
    Post.defineSchema
      typeKey: 'post'
      attributes:
        title: {type: 'string'}
    @Post = Post
    @adapter = @container.lookup('adapter:main')

  describe 'reifyClientId', ->


    it 'sets clientId on new record', ->
      post = @Post.create(title: 'new post')
      expect(post.clientId).to.be.null
      @adapter.reifyClientId(post)
      expect(post.clientId).to.not.be.null


    it 'should set existing clientId on detached model', ->
      post = @Post.create(title: 'new post', id: "1")
      expect(post.clientId).to.be.null
      @adapter.reifyClientId(post)
      expect(post.clientId).to.not.be.null

      detached = @Post.create(title: 'different instance', id: "1")
      expect(detached.clientId).to.be.null
      @adapter.reifyClientId(detached)
      expect(detached.clientId).to.eq(post.clientId)
