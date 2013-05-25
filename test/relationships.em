describe "relationships", ->
  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    @container.register 'session:base', Orm.Session
    @session = @container.lookup('session:base')

  context 'parent->children', ->

    beforeEach ->
      class @Post extends Orm.Model
        title: Orm.attr('string')
      @App.Post = @Post

      class @Comment extends Orm.Model
        text: Orm.attr('string')
        post: Orm.belongsTo(@Post)
      @App.Comment = @Comment

      @Post.reopen
        comments: Orm.hasMany(@Comment)

      @container.register 'model:post', @Post, instantiate: false
      @container.register 'model:comment', @Comment, instantiate: false

    it 'belongsTo updates inverse for new records', ->
      post = @session.create('post')
      comment = @session.create('comment')
      comment.post = post
      expect(post.comments.firstObject).to.eq(comment)

    it 'hasMany updates inverse for new records', ->
      post = @session.create('post')
      comment = @session.create('comment')
      post.comments.addObject(comment)
      expect(comment.post).to.eq(post)




