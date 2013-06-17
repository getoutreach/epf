describe "relationships", ->
  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    @container.register 'adapter:main', Ep.LocalAdapter
    @container.register 'session:base', Ep.Session
    @adapter = @container.lookup('adapter:main')
    @session = @adapter.newSession()


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


    it 'hasMany adds to session', ->
      post = @session.merge(@Post.create(id: '1'))
      comment = @session.merge(@Comment.create(id: '2'))

      post.comments.addObject @Comment.create(id: '2')
      expect(post.comments.firstObject).to.eq(comment)


    it 'hasMany content can be set directly', ->
      post = @session.merge(@Post.create(id: '1', comments: [@Comment.create(id: '2')]))
      expect(post.comments.length).to.eq(1)
      expect(post.comments.firstObject.id).to.eq('2')


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


  context 'multiple one->many', ->
    beforeEach ->
      class @Group extends Ep.Model
        name: Ep.attr('string')
      @App.Group = @Group

      class @Member extends Ep.Model
        role: Ep.attr('string')
        group: Ep.belongsTo(@Group)
      @App.Member = @Member

      class @User extends Ep.Model
        name: Ep.attr('string')
        groups: Ep.hasMany(@Group)
        members: Ep.hasMany(@Member)
      @App.User = @User

      @Group.reopen
        members: Ep.hasMany(@Member)
        user: Ep.belongsTo(@User)

      @Member.reopen
        user: Ep.belongsTo(@User)

      @container.register 'model:group', @Group, instantiate: false
      @container.register 'model:member', @Member, instantiate: false
      @container.register 'model:user', @User, instantiate: false


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

