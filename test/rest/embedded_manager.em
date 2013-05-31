describe 'Ep.EmbeddedManager', ->

  beforeEach ->
    @App = Ember.Namespace.create()
    class @Post extends Ep.Model
      title: Ep.attr('string')
    @App.Post = @Post

    class @Comment extends Ep.Model
      message: Ep.attr('string')
      post: Ep.belongsTo(@Post)
    @App.Comment = @Comment

    @Post.reopen
      comments: Ep.hasMany(@Comment) 
    RestAdapter = Ep.RestAdapter.extend()
    RestAdapter.map @Post,
      comments: { embedded: 'always' }

    @adapter = RestAdapter.create()
    @adapter.serializer = Ep.RestSerializer.create()
    @manager = @adapter._embeddedManager


  it 'can determine if a record is embedded', ->
    @post = @Post.create(id: 1)
    @comment = @Comment.create(id: 2)

    expect(@manager.isEmbedded(@post)).to.be.false
    expect(@manager.isEmbedded(@comment)).to.be.true
    

