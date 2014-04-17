describe 'Ep.LazyModel', ->

  App = null
  session = null

  beforeEach ->
    App = Ember.Namespace.create()
    @container = new Ember.Container()
    Ep.setupContainer(@container)

    class App.Post extends Ep.Model
      title: Ep.attr('string')

    class App.Comment extends Ep.Model
      body: Ep.attr('string')
      post: Ep.belongsTo(App.Post)

    App.Post.reopen
      comments: Ep.hasMany(App.Comment)

    @container.register 'model:post', App.Post
    @container.register 'model:comment', App.Comment

    adapter = @container.lookup('adapter:main')
    session = adapter.newSession()


  it 'loads immediately if already loaded in session', ->
    lazyPost = session.add Ep.LazyModel.create(id: '1', type: App.Post)
    session.merge App.Post.create(id: '1', title: 'wat')
    expect(lazyPost.title).to.eq('wat')
    

  it 'loads belongsTo immediately if already loaded in session', ->
    lazyComment = session.add Ep.LazyModel.create(id: '1', type: App.Comment)
    post = session.merge App.Post.create(id: '1', title: 'wat')
    post.comments.addObject session.merge(App.Comment.create(id: '1', body: 'tmi'))
    expect(lazyComment.post.title).to.eq('wat')


  it 'cached load can resolve multiple times', ->
    session.merge App.Post.create(id: "1", title: "wat")
    promise = session.load(App.Post, 1)
    promise.then (outerPost) ->
      promise.then (innerPost) ->
        expect(outerPost).to.eq(innerPost)


  it 'lazy model can resolve multiple times', ->
    session.merge App.Post.create(id: "1", title: "wat")
    lazyModel = Ep.LazyModel.create(id: "1", type: App.Post, session: session)
    lazyModel.then (outerResolution) ->
      lazyModel.then (innerResolution) ->
        expect(outerResolution).to.eq(innerResolution)
