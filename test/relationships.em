`import setupContainer from 'epf/ember/setup_container'`
`import Model from 'epf/model/model'`
`import attr from 'epf/model/attribute'`
`import belongsTo from 'epf/relationships/belongs_to'`
`import hasMany from 'epf/relationships/has_many'`

describe "relationships", ->
  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    setupContainer(@container)
    @adapter = @container.lookup('adapter:main')
    @session = @adapter.newSession()


  context 'one->many', ->

    beforeEach ->
      class @User extends Model
        name: attr 'string'

      class @Post extends Model
        title: attr('string')
        user: belongsTo(@User)
      @App.Post = @Post

      class @Comment extends Model
        text: attr('string')
        post: belongsTo(@Post)

      @App.Comment = @Comment

      @Post.reopen
        comments: hasMany(@Comment)

      @container.register 'model:post', @Post
      @container.register 'model:comment', @Comment


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
      unloadedComment = post.comments.firstObject
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
      expect(post.comments.firstObject).to.eq(comment)


    it 'hasMany content can be set directly', ->
      post = @session.create 'post', comments: [@Comment.create(id: '2')]
      expect(post.comments.length).to.eq(1)
      expect(post.comments.firstObject.id).to.eq('2')


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
      class @Post extends Model
        title: attr('string')
      @App.Post = @Post

      class @User extends Model
        name: attr('string')
        post: belongsTo(@Post)
      @App.User = @User

      @Post.reopen
        user: belongsTo(@User)

      @container.register 'model:post', @Post
      @container.register 'model:user', @User


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
      class @Group extends Model
        name: attr('string')
      @App.Group = @Group

      class @Member extends Model
        role: attr('string')
        group: belongsTo(@Group)
      @App.Member = @Member

      class @User extends Model
        name: attr('string')
        groups: hasMany(@Group)
        members: hasMany(@Member)
      @App.User = @User

      @Group.reopen
        members: hasMany(@Member)
        user: belongsTo(@User)

      @Member.reopen
        user: belongsTo(@User)

      @container.register 'model:group', @Group
      @container.register 'model:member', @Member
      @container.register 'model:user', @User


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
