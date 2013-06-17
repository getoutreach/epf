describe 'Ep.PerField', ->

  session = null
  App = null

  beforeEach ->
    App = Ember.Namespace.create()
    @container = new Ember.Container()

    class App.Comment extends Ep.Model

    class App.User extends Ep.Model

    class App.Post extends Ep.Model
      title: Ep.attr('string')
      body: Ep.attr('string')
      comments: Ep.hasMany(App.Comment)
      user: Ep.belongsTo(App.User)

    App.Comment.reopen
      body: Ep.attr('string')
      post: Ep.belongsTo(App.Post)

    App.User.reopen
      name: Ep.attr('string')
      posts: Ep.hasMany(App.Post)

    class Session extends Ep.Session
      mergeStrategy: Ep.PerField

    @container.register 'model:post', @Post, instantiate: false
    @container.register 'adapter:main', Ep.LocalAdapter
    @container.register 'session:base', Session, singleton: false

    adapter = @container.lookup('adapter:main')
    session = adapter.newSession()


  it 'keeps modified fields from both versions', ->
    post = session.merge App.Post.create(id: '1', title: 'titleA', body: 'bodyA')
    post.title = 'titleB'
    session.merge App.Post.create(id: '1', title: 'titleA', body: 'bodyB')
    expect(post.title).to.eq('titleB')
    expect(post.body).to.eq('bodyB')
    post.comments.addObject App.Comment.create()
    session.merge App.Post.create(id: '1', title: 'titleB', body: 'bodyB', user: App.User.create(id: '2'))
    expect(post.comments.length).to.eq(1)
    expect(post.comments.firstObject.id).to.be.null
    expect(post.user.id).to.eq('2')


  it 'keeps ours if same field modified in both versions', ->
    post = session.merge App.Post.create(id: '1', title: 'titleA', body: 'bodyA')
    post.title = 'titleB'
    post.body = 'bodyB'
    session.merge App.Post.create(id: '1', title: 'titleC', body: 'bodyC')
    expect(post.title).to.eq('titleB')
    expect(post.body).to.eq('bodyB')
    post.comments.addObject App.Comment.create()
    post.user = App.User.create()
    session.merge App.Post.create(id: '1', title: 'titleB', body: 'bodyB', user: App.User.create(id: '2'), comments: [App.Comment.create(id: '3')])
    expect(post.comments.length).to.eq(1)
    expect(post.comments.firstObject.id).to.be.null
    expect(post.user.id).to.be.null


  it 'still merges model if removed from belongsTo in ours', ->
    post = session.merge App.Post.create(id: '1', title: 'herp', user: App.User.create(id: '2'))
    user = post.user
    post.user = null
    session.merge App.Post.create(id: '1', title: 'herp', user: App.User.create(id: '2', name: 'grodon'))
    expect(post.user).to.be.null
    expect(user.name).to.eq('grodon')


  it 'still merges model if removed from hasMany in ours', ->
    post = session.merge App.Post.create(id: '1', title: 'herp', comments: [App.Comment.create(id: '2', body: 'herp')])
    comment = post.comments.firstObject
    post.comments.clear()
    session.merge App.Post.create(id: '1', title: 'herp', comments: [App.Comment.create(id: '2', body: 'derp')])
    expect(post.comments.length).to.eq(0)
    expect(comment.body).to.eq('derp')


  it 'still merges model if sibling added to hasMany', ->
    post = session.merge App.Post.create(id: '1', title: 'herp', comments: [App.Comment.create(id: '2', body: 'herp')])
    post.comments.addObject(session.create(App.Comment, body: 'derp'))
    comment = post.comments.firstObject
    session.merge App.Post.create(id: '1', title: 'herp', comments: [App.Comment.create(id: '2', body: 'derp?', post: post)])
    expect(post.comments.length).to.eq(2)
    expect(comment.body).to.eq('derp?')