`import setupContainer from 'coalesce/ember/setup_container'`
`import {userWithPost, groupWithMembersWithUsers} from '../support/schemas'`
`import Model from 'coalesce/model/model'`

describe "relationships", ->
  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    setupContainer(@container)
    Coalesce.__container__ = @container
    @adapter = @container.lookup('adapter:main')
    @session = @adapter.newSession()


  context 'one->many', ->

    beforeEach ->
      `class User extends Model {}`
      User.defineSchema
        typeKey: 'user'
        attributes:
          name: {type: 'string'}
      @App.User = @User = User

      `class Post extends Model {}`
      Post.defineSchema
        typeKey: 'post'
        attributes:
          title: {type: 'string'}
        relationships:
          user: {kind: 'belongsTo', type: 'user'}
          comments: {kind: 'hasMany', type: 'comment'}
      @App.Post = @Post = Post

      `class Comment extends Model {}`
      Comment.defineSchema
        typeKey: 'comment'
        attributes:
          text: {type: 'string'}
        relationships:
          post: {kind: 'belongsTo', type: 'post'}
      @App.Comment = @Comment = Comment

      @container.register 'model:post', Post
      @container.register 'model:comment', Comment
      @container.register 'model:user', User


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


    it 'belongsTo updates inverse on delete when initially added unloaded', ->
      post = @session.merge @session.build 'post', id: 1, comments: [@Comment.create(id: 2)]
      unloadedComment = post.comments.get('firstObject')
      comment = @session.merge @session.build 'comment', id: 2, post: @Post.create(id: 1)
      unloadedComment.post = post
      expect(post.comments.toArray()).to.eql([unloadedComment])
      @session.deleteModel unloadedComment
      expect(post.comments.toArray()).to.eql([])


    it 'belongsTo updates inverse when set during create', ->
      comment = @session.create('comment', post: @session.create('post'))
      post = comment.post
      expect(post.comments.toArray()).to.eql([comment])
      comment.post = null
      expect(post.comments.toArray()).to.eql([])


    it 'belongsTo adds object to session', ->
      post = @session.merge(@Post.create(id: '1'))
      comment = @session.merge(@Comment.create(id: '2'))

      comment.post = @Post.create(id: '1')
      expect(comment.post).to.eq(post)


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


    it 'hasMany updates inverse on create', ->
      post = @session.create('post', comments: [])
      comment = @session.create('comment')
      post.comments.addObject(comment)
      expect(comment.post).to.eq(post)
      @session.deleteModel post
      expect(comment.post).to.be.null


    it 'hasMany adds to session', ->
      post = @session.merge(@Post.create(id: '1', comments: []))
      comment = @session.merge(@Comment.create(id: '2', post: null))

      post.comments.addObject @Comment.create(id: '2')
      expect(post.comments.get('firstObject')).to.eq(comment)


    it 'hasMany content can be set directly', ->
      post = @session.create 'post', comments: [@Comment.create(id: '2')]
      expect(post.comments.get('length')).to.eq(1)
      expect(post.comments.get('firstObject').id).to.eq('2')


    it 'supports watching belongsTo properties that have a detached cached value', ->
      deferred = Ember.RSVP.defer()
      @session.loadModel = (model) ->
        Ember.unwatchPath comment, 'post.title'
        deferred.resolve()
      comment = @session.adopt @session.build 'comment', id: 2, post: @Post.create(id: 1)

      Ember.run ->
        Ember.watchPath comment, 'post.title'
      deferred.promise

    it 'supports watching multiple levels of unloaded belongsTo', ->
      deferred = Ember.RSVP.defer()
      Post = @Post
      User = @User
      @session.loadModel = (model) ->
        if model instanceof Post
          model = model.copy()
          model.title = 'post'
          model.user = User.create id: "2"
          @merge(model)
          Ember.RSVP.resolve(model)
        else
          deferred.resolve()
      comment = @session.adopt @session.build 'comment', id: 2, post: @Post.create(id: 1)

      Ember.run ->
        Ember.watchPath comment, 'post.user.name'
      deferred.promise.then ->
        Ember.unwatchPath comment, 'post.user.name'


  context 'one->one', ->
    beforeEach ->
      userWithPost.apply(this)

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


  context 'multiple one->many', ->
    beforeEach ->
      groupWithMembersWithUsers.apply(this)


    it 'updates inverse on delete', ->

      group = @session.create('group')
      user = @session.create('user')
      member = @session.create('member', group: group, user: user)

      expect(member.user).to.eq(user)
      expect(member.group).to.eq(group)
      expect(user.members.toArray()).to.eql([member])
      expect(group.members.toArray()).to.eql([member])

      @session.deleteModel member

      expect(user.members.toArray()).to.eql([])
      expect(group.members.toArray()).to.eql([])
