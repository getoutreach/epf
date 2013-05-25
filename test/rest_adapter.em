describe "Orm.RestAdapter", ->
  beforeEach ->
    ajaxResults = @ajaxResults = {}
    ajaxCalls = @ajaxCalls = []
    class @RestAdapter extends Orm.RestAdapter
      ajax: (url, type, hash) ->
        new Ember.RSVP*.Promise (resolve, reject) ->
          key = type + ":" + url
          json = ajaxResults[key]
          return reject("no data") unless json
          json = json(url, type, hash) if typeof json == 'function'
          ajaxCalls.push(key)
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

    it 'loads data from the server', (done) ->
      @ajaxResults['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw'}

      session = @adapter.newSession()

      ajaxCalls = @ajaxCalls
      session.load(@Post, 1).then (post) ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(ajaxCalls).to.eql(['GET:/posts/1'])

    it 'saves data to the server', (done) ->
      @ajaxResults['POST:/posts'] = -> posts: {client_id: post.clientId, id: 1, title: 'mvcc ftw'}

      session = @adapter.newSession()

      post = session.create('post')
      post.title = 'mvcc ftw'

      ajaxCalls = @ajaxCalls
      session.flush().then ->
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(ajaxCalls).to.eql(['POST:/posts'])

  context 'lazy parent->children', ->

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

    it 'loads data lazily', ->
      @ajaxResults['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comment_ids: [2]}
      @ajaxResults['GET:/comments/2'] = comments: {id: 2, title: 'first', post_id: 1}

      session = @adapter.newSession()

      ajaxCalls = @ajaxCalls
      session.load(@Post, 1).then (post) ->
        expect(ajaxCalls).to.eql(['GET:/posts/1'])
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(post.comments.length).to.eq(1)
        expect(post.comments.firstObject.text).to.be.undefined

        post.comments.firstObject.then ->
          expect(ajaxCalls).to.eql(['GET:/posts/1', 'GET:/comments/2'])
          expect(post.comments.firstObject.text).to.eq('first')
          expect(post.comments.firstObject.post).to.eq(post)




