describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session


  describe 'sideloading', ->

    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      class @Comment extends Ep.Model
        message: Ep.attr('string')
        post: Ep.belongsTo(@Post)
      @App.Comment = @Comment

      @Post.reopen
        comments: Ep.hasMany(@Comment)

      @container.register 'model:post', @Post
      @container.register 'model:comment', @Comment


    it 'sideloads', ->
      adapter.r['GET:/posts/1'] = posts: {id: "1", title: 'sideload my children', comments: [2, 3]}, comments: [{id: "2",  message: "here we", post: "1"}, {id: "3",  message: "are", post: "1"}]

      session.load('post', 1).then (post) ->
        expect(adapter.h).to.eql(['GET:/posts/1'])
        expect(post.comments.firstObject.message).to.eq('here we')
        expect(post.comments.lastObject.message).to.eq('are')