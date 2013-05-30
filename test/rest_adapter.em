describe "Ep.RestAdapter", ->

  adapter = null

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()

    # TestAdapter already is a subclass
    @RestAdapter = require('./support/test_rest_adapter').extend()

    @container.register 'session:base', Ep.Session
    @container.register 'serializer:main', Ep.RestSerializer
    # TODO: adapter mappings are currently reified so in tests that
    # customize these we need to re-instantiate
    @container.register 'adapter:main', @RestAdapter, singleton: false
    @container.register 'store:main', Ep.Store

    @container.typeInjection 'adapter', 'store', 'store:main'
    @container.typeInjection 'adapter', 'serializer', 'serializer:main'

    @adapter = @container.lookup('adapter:main')
    adapter = @adapter


  context 'simple model', ->

    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      @container.register 'model:post', @Post, instantiate: false


    it 'loads', ->
      @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw'}

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load(@Post, 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(ajaxCalls).to.eql(['GET:/posts/1'])


    it 'loads when plural specified', ->
      @RestAdapter.configure 'plurals',
        post: 'postsandthings'
      # Re-instantiate since mappings are reified
      @adapter = @container.lookup('adapter:main')
      @adapter.r['GET:/postsandthings/1'] = postsandthings: {id: 1, title: 'mvcc ftw'}

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load(@Post, 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(ajaxCalls).to.eql(['GET:/postsandthings/1'])


    it 'saves', ->
      @adapter.r['POST:/posts'] = -> posts: {client_id: post.clientId, id: 1, title: 'mvcc ftw'}

      session = @adapter.newSession()

      post = session.create('post')
      post.title = 'mvcc ftw'

      ajaxCalls = @adapter.h
      session.flush().then ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(ajaxCalls).to.eql(['POST:/posts'])


    it 'updates', ->
      @adapter.r['PUT:/posts/1'] = -> posts: {client_id: post.clientId, id: 1, title: 'updated'}

      @adapter.loaded(@Post.create(id: "1", title: 'test'))

      session = @adapter.newSession()
      post = null
      ajaxCalls = @adapter.h
      session.load('post', 1).then (post) ->
        expect(post.title).to.eq('test')
        post.title = 'updated'
        session.flush().then ->
          expect(post.title).to.eq('updated')
          expect(ajaxCalls).to.eql(['PUT:/posts/1'])


    it 'deletes', ->
      @adapter.r['DELETE:/posts/1'] = {}

      @adapter.loaded(@Post.create(id: "1", title: 'test'))

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load('post', 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('test')
        session.deleteModel(post)
        session.flush().then ->
          expect(post.isDeleted).to.be.true
          expect(ajaxCalls).to.eql(['DELETE:/posts/1'])


    it 'refreshes', ->
      @adapter.loaded(@Post.create(id: "1", title: 'test'))
      @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'something new'}

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load(@Post, 1).then (post) ->
        expect(post.title).to.eq('test')
        expect(ajaxCalls).to.eql([])
        session.refresh(post).then (post) ->
          expect(post.title).to.eq('something new')
          expect(ajaxCalls).to.eql(['GET:/posts/1'])


    it 'finds', ->
      @adapter.r['GET:/posts'] = (url, type, hash) ->
        expect(hash.data).to.eql({q: "aardvarks"})
        posts: [{id: 1, title: 'aardvarks explained'}, {id: 2, title: 'aardvarks in depth'}]

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.find('post', {q: 'aardvarks'}).then (models) ->
        expect(models.length).to.eq(2)
        expect(ajaxCalls).to.eql(['GET:/posts'])


    it 'handles errors on update', ->
      @adapter.r['PUT:/posts/1'] = ->
        throw responseText: JSON.stringify(errors: {title: 'title is too short'})

      @adapter.loaded(@Post.create(id: "1", title: 'test'))

      session = @adapter.newSession()
      post = null
      ajaxCalls = @adapter.h
      session.load('post', 1).then (post) ->
        expect(post.title).to.eq('test')
        post.title = ''
        session.flush().then null, (errors) ->
          expect(post.title).to.eq('')
          expect(post.errors).to.eql({title: 'title is too short'})
          expect(ajaxCalls).to.eql(['PUT:/posts/1'])


    it 'loads then updates', ->
      @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw'}
      @adapter.r['PUT:/posts/1'] = posts: {id: 1, title: 'no more fsm'}

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load(@Post, 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(ajaxCalls).to.eql(['GET:/posts/1'])

        post.title = 'no more fsm'
        session.flush().then ->
          expect(ajaxCalls).to.eql(['GET:/posts/1', 'PUT:/posts/1'])
          expect(post.title).to.eq('no more fsm')


  context 'one->many', ->

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


    it 'loads lazily', ->
      @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comment_ids: [2]}
      @adapter.r['GET:/comments/2'] = comments: {id: 2, message: 'first', post_id: 1}

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load(@Post, 1).then (post) ->
        expect(ajaxCalls).to.eql(['GET:/posts/1'])
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(post.comments.length).to.eq(1)
        comment = post.comments.firstObject
        expect(comment.message).to.be.undefined

        post.comments.firstObject.then ->
          expect(ajaxCalls).to.eql(['GET:/posts/1', 'GET:/comments/2'])
          expect(comment.message).to.eq('first')
          expect(comment.post.equals(post)).to.be.true


    it 'saves', ->
      @adapter.r['POST:/posts'] = -> posts: {client_id: post.clientId, id: 1, title: 'topological sort', comment_ids: []}
      @adapter.r['POST:/comments'] = -> comments: {client_id: comment.clientId, id: 2, message: 'seems good', post_id: 1}

      session = @adapter.newSession()

      post = session.create('post')
      post.title = 'topological sort'

      comment = session.create('comment')
      comment.message = 'seems good'
      comment.post = post

      expect(post.comments.firstObject).to.eq(comment)

      ajaxCalls = @adapter.h
      session.flush().then ->
        expect(post.id).to.not.be.null
        expect(post.title).to.eq('topological sort')
        expect(comment.id).to.not.be.null
        expect(comment.message).to.eq('seems good')
        expect(comment.post).to.eq(post)
        expect(post.comments.firstObject).to.eq(comment)
        expect(ajaxCalls).to.eql(['POST:/posts', 'POST:/comments'])


    it 'updates with unloaded child', ->
      @adapter.r['GET:/posts/1'] = -> posts: {id: 1, title: 'mvcc ftw', comment_ids: [2]}
      @adapter.r['PUT:/posts/1'] = -> posts: {id: 1, title: 'updated', comment_ids: [2]}
      session = @adapter.newSession()
      session.load('post', 1).then (post) ->
        expect(post.title).to.eq('mvcc ftw')
        expect(adapter.h).to.eql(['GET:/posts/1'])
        post.title = 'updated'
        session.flush().then ->
          expect(post.title).to.eq('updated')
          expect(adapter.h).to.eql(['GET:/posts/1', 'PUT:/posts/1'])



    it 'deletes child', ->
      @adapter.r['DELETE:/comments/2'] = {}

      post = @Post.create(id: "1", title: 'parent');
      post.comments.addObject(@Comment.create(id: "2", message: 'child'))
      @adapter.loaded(post)

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load('post', 1).then (post) ->
        comment = post.comments.firstObject
        session.deleteModel(comment)
        expect(post.comments.length).to.eq(0)
        session.flush().then ->
          expect(ajaxCalls).to.eql(['DELETE:/comments/2'])
          expect(post.comments.length).to.eq(0)


    context 'embedded', ->

      beforeEach ->
        @RestAdapter.map @Post,
          comments: { embedded: 'always' }
        # Re-instantiate since mappings are reified
        @adapter = @container.lookup('adapter:main')
        adapter = @adapter


      it 'loads', ->
        @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: [{id: 2, post_id: 1, message: 'first'}]}

        session = @adapter.newSession()

        ajaxCalls = @adapter.h
        session.load(@Post, 1).then (post) ->
          expect(ajaxCalls).to.eql(['GET:/posts/1'])
          expect(post.id).to.eq("1")
          expect(post.title).to.eq('mvcc ftw')
          expect(post.comments.length).to.eq(1)
          comment = post.comments.firstObject
          expect(comment.message).to.eq 'first'
          expect(comment.post.equals(post)).to.be.true


      it 'updates child', ->
        @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: [{id: 2, post_id: 1, message: 'first'}]}
        @adapter.r['PUT:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: [{id: 2, post_id: 1, message: 'first again'}]}

        session = @adapter.newSession()

        session.load(@Post, 1).then (post) ->
          expect(adapter.h).to.eql(['GET:/posts/1'])
          comment = post.comments.firstObject
          comment.title = 'first again'
          session.flush().then ->
            expect(adapter.h).to.eql(['GET:/posts/1', 'PUT:/posts/1'])
            expect(post.comments.firstObject).to.eq(comment)
            expect(comment.title).to.eq('first again')

      it 'adds child', ->
        @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: []}
        @adapter.r['PUT:/posts/1'] =  -> posts: {id: 1, title: 'mvcc ftw', comments: [{id: 2, client_id: comment.clientId, post_id: 1, message: 'reborn'}]}
        session = @adapter.newSession()

        Comment = @Comment
        comment = null
        session.load(@Post, 1).then (post) ->
          expect(adapter.h).to.eql(['GET:/posts/1'])
          expect(post.comments.length).to.eq(0)
          comment = session.create('comment', message: 'reborn')
          comment.post = post
          session.flush().then ->
            expect(adapter.h).to.eql(['GET:/posts/1', 'PUT:/posts/1'])
            expect(comment.message).to.eq('reborn')
            expect(post.comments.firstObject).to.eq(comment)

      #it 'removes child', ->



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

      @container.register 'model:post', @Post, instantiate: false
      @container.register 'model:user', @User, instantiate: false


    it 'child can be null', ->
      @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', user_id: null}

      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load(@Post, 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq("mvcc ftw")
        expect(post.user).to.be.null


    it 'loads lazily', ->
      @adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', user_id: 2}
      @adapter.r['GET:/users/2'] = users: {id: 2, name: 'brogrammer', post_id: 1}
      
      session = @adapter.newSession()

      ajaxCalls = @adapter.h
      session.load(@Post, 1).then (post) ->
        expect(ajaxCalls).to.eql(['GET:/posts/1'])
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        user = post.user
        expect(user.id).to.eq("2")
        expect(user.name).to.be.undefined

        post.user.then ->
          expect(ajaxCalls).to.eql(['GET:/posts/1', 'GET:/users/2'])
          expect(user.name).to.eq('brogrammer')
          expect(user.post.equals(post)).to.be.true


