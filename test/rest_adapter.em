describe "Orm.RestAdapter", ->

  beforeEach ->
    ajaxResults = @ajaxResults = {}
    ajaxCalls = @ajaxCalls = []
    class @RestAdapter extends Orm.RestAdapter
      ajax: (url, type, hash) ->
        new Ember.RSVP*.Promise (resolve, reject) ->
          key = type + ":" + url
          ajaxCalls.push(key)
          json = ajaxResults[key]
          return reject("No data for #{key}") unless json
          json = json(url, type, hash) if typeof json == 'function'
          Ember.run.later ( -> resolve(json) ), 0

    @App = Ember.Namespace.create()
    @container = new Ember.Container()

    @container.register 'session:base', Orm.Session
    @container.register 'serializer:main', Orm.RestSerializer
    @container.register 'adapter:main', @RestAdapter
    @container.register 'store:main', Orm.Store

    @container.typeInjection 'adapter', 'store', 'store:main'
    @container.typeInjection 'adapter', 'serializer', 'serializer:main'

    @adapter = @container.lookup('adapter:main')


  context 'simple model', ->

    beforeEach ->
      class @Post extends Orm.Model
        title: Orm.attr('string')
      @App.Post = @Post

      @container.register 'model:post', @Post, instantiate: false


    it 'loads', ->
      @ajaxResults['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw'}

      session = @adapter.newSession()

      ajaxCalls = @ajaxCalls
      session.load(@Post, 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(ajaxCalls).to.eql(['GET:/posts/1'])


    it 'saves', ->
      @ajaxResults['POST:/posts'] = -> posts: {client_id: post.clientId, id: 1, title: 'mvcc ftw'}

      session = @adapter.newSession()

      post = session.create('post')
      post.title = 'mvcc ftw'

      ajaxCalls = @ajaxCalls
      session.flush().then ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(ajaxCalls).to.eql(['POST:/posts'])


    it 'updates', ->
      @ajaxResults['PUT:/posts/1'] = -> posts: {client_id: post.clientId, id: 1, title: 'updated'}

      @adapter.loaded(@Post.create(id: "1", title: 'test'))

      session = @adapter.newSession()
      post = null
      ajaxCalls = @ajaxCalls
      session.load('post', 1).then (post) ->
        expect(post.title).to.eq('test')
        post.title = 'updated'
        session.flush().then ->
          expect(post.title).to.eq('updated')
          expect(ajaxCalls).to.eql(['PUT:/posts/1'])


    it 'deletes', ->
      @ajaxResults['DELETE:/posts/1'] = {}

      @adapter.loaded(@Post.create(id: "1", title: 'test'))

      session = @adapter.newSession()

      ajaxCalls = @ajaxCalls
      session.load('post', 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('test')
        session.deleteModel(post)
        session.flush().then ->
          expect(post.isDeleted).to.be.true
          expect(ajaxCalls).to.eql(['DELETE:/posts/1'])


    it 'refreshes', ->
      @adapter.loaded(@Post.create(id: "1", title: 'test'))
      @ajaxResults['GET:/posts/1'] = posts: {id: 1, title: 'something new'}

      session = @adapter.newSession()

      ajaxCalls = @ajaxCalls
      session.load(@Post, 1).then (post) ->
        expect(post.title).to.eq('test')
        expect(ajaxCalls).to.eql([])
        session.refresh(post).then (post) ->
          expect(post.title).to.eq('something new')
          expect(ajaxCalls).to.eql(['GET:/posts/1'])


    it 'finds', ->
      @ajaxResults['GET:/posts'] = (url, type, hash) ->
        expect(hash.data).to.eql({q: "aardvarks"})
        posts: [{id: 1, title: 'aardvarks explained'}, {id: 2, title: 'aardvarks in depth'}]

      session = @adapter.newSession()

      ajaxCalls = @ajaxCalls
      session.find('post', {q: 'aardvarks'}).then (models) ->
        expect(models.length).to.eq(2)
        expect(ajaxCalls).to.eql(['GET:/posts'])


    it 'handles errors on update', ->
      @ajaxResults['PUT:/posts/1'] = ->
        throw responseText: JSON.stringify(errors: {title: 'title is too short'})

      @adapter.loaded(@Post.create(id: "1", title: 'test'))

      session = @adapter.newSession()
      post = null
      ajaxCalls = @ajaxCalls
      session.load('post', 1).then (post) ->
        expect(post.title).to.eq('test')
        post.title = ''
        session.flush().then null, (errors) ->
          expect(post.title).to.eq('')
          expect(post.errors).to.eql({title: 'title is too short'})
          expect(ajaxCalls).to.eql(['PUT:/posts/1'])


  context 'parent->children', ->

    beforeEach ->
      class @Post extends Orm.Model
        title: Orm.attr('string')
      @App.Post = @Post

      class @Comment extends Orm.Model
        message: Orm.attr('string')
        post: Orm.belongsTo(@Post)
      @App.Comment = @Comment

      @Post.reopen
        comments: Orm.hasMany(@Comment)

      @container.register 'model:post', @Post, instantiate: false
      @container.register 'model:comment', @Comment, instantiate: false


    it 'loads lazily', ->
      @ajaxResults['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comment_ids: [2]}
      @ajaxResults['GET:/comments/2'] = comments: {id: 2, message: 'first', post_id: 1}

      session = @adapter.newSession()

      ajaxCalls = @ajaxCalls
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
      @ajaxResults['POST:/posts'] = -> posts: {client_id: post.clientId, id: 1, title: 'topological sort', comment_ids: []}
      @ajaxResults['POST:/comments'] = -> comments: {client_id: comment.clientId, id: 2, message: 'seems good', post_id: 1}

      session = @adapter.newSession()

      post = session.create('post')
      post.title = 'topological sort'

      comment = session.create('comment')
      comment.message = 'seems good'
      comment.post = post

      expect(post.comments.firstObject).to.eq(comment)

      ajaxCalls = @ajaxCalls
      session.flush().then ->
        expect(post.id).to.not.be.null
        expect(post.title).to.eq('topological sort')
        expect(comment.id).to.not.be.null
        expect(comment.message).to.eq('seems good')
        expect(comment.post).to.eq(post)
        expect(post.comments.firstObject).to.eq(comment)
        expect(ajaxCalls).to.eql(['POST:/posts', 'POST:/comments'])


    it 'deletes child', ->
      @ajaxResults['DELETE:/comments/2'] = {}

      post = @Post.create(id: "1", title: 'parent');
      post.comments.addObject(@Comment.create(id: "2", message: 'child'))
      @adapter.loaded(post)

      session = @adapter.newSession()

      ajaxCalls = @ajaxCalls
      session.load('post', 1).then (post) ->
        comment = post.comments.firstObject
        session.deleteModel(comment)
        # TODO: figure out how this should be done
        #expect(post.comments.length).to.eq(0)
        session.flush().then ->
          expect(ajaxCalls).to.eql(['DELETE:/comments/2'])
          expect(post.comments.length).to.eq(0)





