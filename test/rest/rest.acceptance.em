describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session
    Ep.__container__ = @container

  afterEach ->
    delete Ep.__container__

  describe "managing groups with embedded members", ->

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

      @RestAdapter.map @Group,
        members: { embedded: 'always' }
      # Re-instantiate since mappings are reified
      @adapter = @container.lookup('adapter:main')
      adapter = @adapter
      session = adapter.newSession()

    it 'creates new group and then deletes a member', ->
      adapter.r['POST:/users'] = -> users: {client_id: user.clientId, id: "1", name: "wes"}
      adapter.r['POST:/groups'] = (url, type, hash) ->
        expect(hash.data.group.members[0].role).to.eq('chief')
        return groups: {client_id: group.clientId, id: "2", name: "brogrammers", members: [{client_id: member.clientId, id: "3", role: "chief", post_id: "2", user_id: "1"}], user_id: "1"}

      child = session.newSession()
      user = child.create 'user', name: 'wes'
      group = null
      member = null
      child.flush().then ->
        expect(user.id).to.not.be.null
        expect(adapter.h).to.eql(['POST:/users'])
        child = session.newSession()
        user = child.add(user)
        group = child.create 'group', name: 'brogrammers', user: user
        member = child.create 'member', role: 'chief', user: user, group: group
        child.flush().then ->
          expect(adapter.h).to.eql(['POST:/users', 'POST:/groups'])
          expect(user.id).to.not.be.null
          expect(group.id).to.not.be.null
          expect(group.members.length).to.eq(1)
          expect(user.groups.length).to.eq(1)
          expect(user.members.length).to.eq(1)
          expect(member.id).to.not.be.null

          child = session.newSession()
          member = child.add(member)
          user = child.add(user)
          group = child.add(group)
          child.deleteModel(member)
          expect(user.members.length).to.eq(0)
          expect(group.members.length).to.eq(0)
          expect(user.groups.length).to.eq(1)

          adapter.r['PUT:/groups/2'] = -> groups: {client_id: group.clientId, id: "2", name: "brogrammers", members: [], user_id: "1"}
          child.flush().then ->
            expect(member.get('isDeleted')).to.be.true
            expect(group.members.length).to.eq(0)
            expect(user.members.length).to.eq(0)
            expect(user.groups.length).to.eq(1)
            expect(adapter.h).to.eql(['POST:/users', 'POST:/groups', 'PUT:/groups/2'])


  describe "managing comments", ->

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

      @container.register 'model:post', @Post, instantiate: false
      @container.register 'model:comment', @Comment, instantiate: false


    it 'creates a new comment within a child session', ->
      adapter.r['POST:/comments'] = -> comment: {client_id: comment.clientId, id: "3", message: "#2", post_id: "1"}

      post = session.merge @Post.create(id: "1", title: "brogrammer's guide to beer pong")
      session.merge @Comment.create(id: "2", message: "yo", post: post)

      childSession = session.newSession()
      childPost = childSession.add(post)
      comment = childSession.create 'comment',
        message: '#2',
        post: childPost

      childSession.flush().then ->
        expect(childPost.comments.length).to.eq(2)
        expect(post.comments.length).to.eq(2)


  describe "two levels of embedded", ->

    beforeEach ->
      class @User extends Ep.Model
        name: Ep.attr('string')
      @App.User = @User

      class @Profile extends Ep.Model
        bio: Ep.attr('string')
        user: Ep.belongsTo(@User)
      @App.Profile = @Profile

      class @Tag extends Ep.Model
        name: Ep.attr('string')
        profile: Ep.belongsTo(@Profile)
      @App.User = @User

      @Profile.reopen
        tags: Ep.hasMany(@Tag)

      @User.reopen
        profile: Ep.belongsTo(@Profile)


      @container.register 'model:user', @User, instantiate: false
      @container.register 'model:profile', @Profile, instantiate: false
      @container.register 'model:tags', @Tag, instantiate: false

      @RestAdapter.map @User,
        profile: { embedded: 'always' }

      @RestAdapter.map @Profile,
        tags: { embedded: 'always' }

      # Re-instantiate since mappings are reified
      @adapter = @container.lookup('adapter:main')
      adapter = @adapter
      session = adapter.newSession()

    it 'deletes root', ->
      adapter.r['DELETE:/users/1'] = {}

      user = session.merge @User.create
        id: '1'
        name: 'abby'
        profile: @Profile.create
          id: '2'
          bio: 'asd'
          tags: [@Tag.create(id: '3', name: 'java')]

      session.deleteModel(user)
      session.flush().then ->
        expect(adapter.h).to.eql(['DELETE:/users/1'])
        expect(user.isDeleted).to.be.true








