`import setupContainer from 'epf/ember/setup_container'`
`import PerField from 'epf/merge_strategies/per_field'`
`import Model from 'epf/model/model'`
`import attr from 'epf/model/attribute'`
`import belongsTo from 'epf/relationships/belongs_to'`
`import hasMany from 'epf/relationships/has_many'`

describe 'PerField', ->

  session = null
  App = null

  beforeEach ->
    App = Ember.Namespace.create()
    @container = new Ember.Container()
    setupContainer(@container)

    class App.Comment extends Model

    class App.User extends Model

    class App.Post extends Model
      title: attr('string')
      body: attr('string')
      comments: hasMany(App.Comment)
      user: belongsTo(App.User)
      createdAt: attr('date')

    App.Comment.reopen
      body: attr('string')
      post: belongsTo(App.Post)

    App.User.reopen
      name: attr('string')
      posts: hasMany(App.Post)

    @container.register 'model:post', App.Post
    @container.register 'model:user', App.User
    @container.register 'model:comment', App.Comment

    adapter = @container.lookup('adapter:main')
    session = adapter.newSession()


  it 'keeps modified fields from both versions', ->
    post = session.merge App.Post.create(id: '1', title: 'titleA', body: 'bodyA', createdAt: new Date(1985, 7, 22))
    post.title = 'titleB'
    session.merge App.Post.create(id: '1', title: 'titleA', body: 'bodyB', createdAt: null, comments: [])
    expect(post.title).to.eq('titleB')
    expect(post.body).to.eq('bodyB')
    expect(post.createdAt).to.be.null
    post.comments.addObject session.create 'comment'
    session.merge App.Post.create(id: '1', title: 'titleB', body: 'bodyB', user: App.User.create(id: '2', posts: [App.Post.create(id: '1')]))
    expect(post.comments.length).to.eq(1)
    expect(post.comments.firstObject.id).to.be.null
    expect(post.user.id).to.eq('2')


  it 'keeps ours if same field modified in both versions', ->
    post = session.merge App.Post.create(id: '1', title: 'titleA', body: 'bodyA')
    post.title = 'titleB'
    post.body = 'bodyB'
    session.merge App.Post.create(id: '1', title: 'titleC', body: 'bodyC', user: null, comments: [])
    expect(post.title).to.eq('titleB')
    expect(post.body).to.eq('bodyB')
    post.comments.addObject App.Comment.create()
    post.user = App.User.create()
    session.merge App.Post.create(id: '1', title: 'titleB', body: 'bodyB', user: App.User.create(id: '2'), comments: [App.Comment.create(id: '3')])
    expect(post.comments.length).to.eq(1)
    expect(post.comments.firstObject.id).to.be.null
    expect(post.user.id).to.be.null


  it 'keeps ours if only modified in ours', ->
    post = session.merge App.Post.create(id: '1', title: 'titleA', body: 'bodyA', user: App.User.create(id: '2', posts: [App.Post.create(id: '1')]), comments: [App.Comment.create(id: '3', user: App.User.create(id: '2'), post: App.Post.create(id: '1'))])
    session.create App.Comment, post: post
    expect(post.comments.length).to.eq(2)
    newData = App.Post.create(id: '1', title: 'titleA', body: 'bodyA', user: App.User.create(id: '2', posts: [App.Post.create(id: '1')]), comments: [App.Comment.create(id: '3', user: App.User.create(id: '2'), post: App.Post.create(id: '1'))])
    newData.comments.firstObject.post = newData
    session.merge newData
    expect(post.comments.length).to.eq(2)


  it 'still merges model if removed from belongsTo in ours', ->
    post = session.merge App.Post.create(id: '1', title: 'herp', user: App.User.create(id: '2', posts: [App.Post.create(id: '1')]))
    user = post.user
    post.user = null

    session.merge App.Post.create(id: '1', title: 'herp', user: App.User.create(id: '2', name: 'grodon', posts: [App.Post.create(id: '1')]))
    expect(post.user).to.be.null
    expect(user.name).to.eq('grodon')


  it 'still merges model if removed from hasMany in ours', ->
    post = session.merge App.Post.create(id: '1', title: 'herp', comments: [App.Comment.create(id: '2', body: 'herp', post: App.Post.create(id: '1'))])
    comment = post.comments.firstObject
    post.comments.clear()
    expect(post.comments.length).to.eq(0)
    session.merge App.Post.create(id: '1', title: 'herp', comments: [App.Comment.create(id: '2', body: 'derp', post: App.Post.create(id: '1'))])
    expect(post.comments.length).to.eq(0)
    expect(comment.body).to.eq('derp')


  it 'still merges model if sibling added to hasMany', ->
    post = session.merge App.Post.create(id: '1', title: 'herp', comments: [App.Comment.create(id: '2', body: 'herp', post: App.Post.create(id: '1'))])
    post.comments.addObject(session.create(App.Comment, body: 'derp'))
    comment = post.comments.firstObject
    session.merge App.Post.create(id: '1', title: 'herp', comments: [App.Comment.create(id: '2', body: 'derp?', post: App.Post.create(id: '1'))])
    expect(post.comments.length).to.eq(2)
    expect(comment.body).to.eq('derp?')


  it 'will preserve local updates after multiple merges', ->
    post = session.merge(App.Post.create(id: '1', title: 'A'))
    post.title = 'B'
    session.merge App.Post.create(id: '1', title: 'C')
    expect(post.title).to.eq('B')
    session.merge App.Post.create(id: '1', title: 'C')
    expect(post.title).to.eq('B')
