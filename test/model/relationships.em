describe "relationships", ->
  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    @container.register 'session:base', Ep.Session
    @session = @container.lookup('session:base')
    @session.store = Ep.Store.create()


  context 'one->many', ->

    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      class @Comment extends Ep.Model
        text: Ep.attr('string')
        post: Ep.belongsTo(@Post)
      @App.Comment = @Comment

      @Post.reopen
        comments: Ep.hasMany(@Comment)

      @container.register 'model:post', @Post, instantiate: false
      @container.register 'model:comment', @Comment, instantiate: false


    it 'belongsTo updates inverse', ->
      post = @session.create('post')
      comment = @session.create('comment')
      comment.post = post
      expect(post.comments.toArray()).to.eql([comment])
      comment.post = null
      expect(post.comments.toArray()).to.eql([])


    it 'belongsTo updates inverse on delete', ->
      post = @session.create('post')
      comment = @session.create('comment')
      comment.post = post
      expect(post.comments.toArray()).to.eql([comment])
      @session.deleteModel comment
      expect(post.comments.toArray()).to.eql([])


    it 'belongsTo updates inverse when set during create', ->
      comment = @session.create('comment', post: @session.create('post'))
      post = comment.post
      expect(post.comments.toArray()).to.eql([comment])
      comment.post = null
      expect(post.comments.toArray()).to.eql([])


    it 'hasMany updates inverse', ->
      post = @session.create('post')
      comment = @session.create('comment')
      post.comments.addObject(comment)
      expect(comment.post).to.eq(post)
      post.comments.removeObject(comment)
      expect(comment.post).to.be.null


    it 'hasMany updates inverse on delete', ->
      post = @session.create('post')
      comment = @session.create('comment')
      post.comments.addObject(comment)
      expect(comment.post).to.eq(post)
      @session.deleteModel post
      expect(comment.post).to.be.null


  context 'one->one', ->
    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      class @User extends Ep.Model
        name: Ep.attr('string')
        post: Ep.belongsTo(@Post)
      @App.User = @User

      @Post.reopen
        user: Ep.belongsTo(@User)

      @container.register 'model:post', @Post, instantiate: false
      @container.register 'model:user', @User, instantiate: false


    it 'updates inverse', ->
      post = @session.create('post')
      user = @session.create('user')
      post.user = user
      expect(user.post).to.eq(post)
      post.user = null
      expect(user.post).to.be.null


    it 'updates inverse on delete', ->
      post = @session.create('post')
      user = @session.create('user')
      post.user = user
      expect(user.post).to.eq(post)
      @session.deleteModel post
      expect(user.post).to.be.null




