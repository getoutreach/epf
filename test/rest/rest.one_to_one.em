describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)

  context "one->one", ->

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

      @adapter.reopen
        configs:
          post:
            user: {owner: false}

      adapter = @adapter
      session = @session

      @container.register 'model:post', @Post
      @container.register 'model:user', @User


    it 'child can be null', ->
      adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', user_id: null}
      adapter.r['PUT:/posts/1'] = posts: {id: 1, title: 'new title', user_id: null}

      session.load(@Post, 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq("mvcc ftw")
        expect(post.user).to.be.null
        post.title = 'new title'
        session.flush().then ->
          expect(post.title).to.eq('new title')


    it 'loads lazily', ->
      adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', user_id: 2}
      adapter.r['GET:/users/2'] = users: {id: 2, name: 'brogrammer', post_id: 1}

      session.load(@Post, 1).then (post) ->
        expect(adapter.h).to.eql(['GET:/posts/1'])
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        user = post.user
        expect(user.id).to.eq("2")
        expect(user.name).to.be.undefined

        post.user.then ->
          expect(adapter.h).to.eql(['GET:/posts/1', 'GET:/users/2'])
          expect(user.name).to.eq('brogrammer')
          expect(user.post.isEqual(post)).to.be.true


    it 'deletes one side', ->
      adapter.r['DELETE:/users/2'] = {}

      post = @Post.create(id: "1", title: 'parent')
      post.user = @User.create(id: "2", name: 'wes')
      session.merge post

      session.load('post', 1).then (post) ->
        user = post.user
        session.deleteModel(user)
        expect(post.user).to.be.null
        session.flush().then ->
          expect(post.user).to.be.null
          expect(adapter.h).to.eql(['DELETE:/users/2'])


    it 'deletes both', ->
      adapter.r['DELETE:/posts/1'] = {}
      adapter.r['DELETE:/users/2'] = {}

      post = @Post.create(id: "1", title: 'parent')
      post.user = @User.create(id: "2", name: 'wes')
      session.merge post

      session.load('post', 1).then (post) ->
        user = post.user
        session.deleteModel(user)
        session.deleteModel(post)
        session.flush().then ->
          expect(adapter.h).to.eql(['DELETE:/posts/1', 'DELETE:/users/2'])


    it 'creates on server', ->
      adapter.r['POST:/posts'] = -> posts: {client_id: post.clientId, id: 1, title: 'herp', user_id: 2}
      adapter.r['GET:/users/2'] = users: {id: 1, name: 'derp', post_id: 1}

      post = session.create 'post', title: 'herp'

      session.flush().then ->
        expect(adapter.h).to.eql ['POST:/posts']
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('herp')
        expect(post.user).to.not.be.null


  context "one->one embedded", ->

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


      PostSerializer = Ep.RestSerializer.extend
        properties:
          user:
            embedded: 'always'

      adapter = @adapter
      session = @session

      @container.register 'serializer:post', PostSerializer

      @container.register 'model:post', @Post
      @container.register 'model:user', @User


    it 'creates child', ->
      adapter.r['PUT:/posts/1'] = -> posts: {id: "1", title: 'parent', user: {client_id: post.user.clientId, id: '2', name: 'child'}}

      post = session.merge @Post.create(id: "1", title: 'parent')

      post.user = session.create 'user', name: 'child'

      session.flush().then ->
        expect(adapter.h).to.eql(['PUT:/posts/1'])
        expect(post.user.isNew).to.be.false
        expect(post.user.id).to.eq('2')


    it 'creates hierarchy', ->
      adapter.r['POST:/posts'] = -> posts: {client_id: post.clientId, id: 1, title: 'herp', user: {client_id: post.user.clientId, id: 1, name: 'derp', post_id: 1}}

      post = session.create 'post', title: 'herp'
      post.user = session.create 'user', name: 'derp'

      session.flush().then ->
        expect(adapter.h).to.eql ['POST:/posts']
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('herp')
        expect(post.user.name).to.eq('derp')


    it 'deletes parent', ->
      adapter.r['DELETE:/posts/1'] = {}

      post = @Post.create(id: "1", title: 'parent')
      post.user = @User.create(id: "2", name: 'wes')
      post = session.merge post

      session.deleteModel(post)
      session.flush().then ->
        expect(adapter.h).to.eql(['DELETE:/posts/1'])
        expect(post.isDeleted).to.be.true

