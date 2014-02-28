describe 'Ep.EmbeddedManager', ->

  adapter = null
  session = null
  manager = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session
    Ep.__container__ = @container

    @App = Ember.Namespace.create()
    class @Post extends Ep.Model
      title: Ep.attr('string')
    @App.Post = @Post
    @container.register 'model:post', @Post

    class @Comment extends Ep.Model
      message: Ep.attr('string')
      post: Ep.belongsTo(@Post)
    @App.Comment = @Comment
    @container.register 'model:comment', @Comment

    @Post.reopen
      comments: Ep.hasMany(@Comment) 

    PostSerializer = Ep.ModelSerializer.extend
      properties:
        comments:
          embedded: 'always'
    @container.register 'serializer:post', PostSerializer

    manager = adapter._embeddedManager


  it 'can determine if a record is embedded', ->
    @post = @Post.create(id: 1)
    @comment = @Comment.create(id: 2)

    expect(manager.isEmbedded(@post)).to.be.false
    expect(manager.isEmbedded(@comment)).to.be.true
    

