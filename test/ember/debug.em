describe.skip 'Debug', ->

  App = null
  session = null

  beforeEach ->
    App = Ember.Namespace.create()
    @container = new Ember.Container()
    Coalesce.setupContainer(@container)

    class App.User extends Coalesce.Model
      name: Coalesce.attr('string')

    class App.Post extends Coalesce.Model
      title: Coalesce.attr('string')
      body: Coalesce.attr('string')
      user: Coalesce.belongsTo(App.User)

    class App.Comment extends Coalesce.Model
      body: Coalesce.attr('string')
      post: Coalesce.belongsTo(App.Post)

    App.Post.reopen
      comments: Coalesce.hasMany(App.Comment)

    App.User.reopen
      posts: Coalesce.hasMany(App.Post)

    @container.register 'model:user', App.User
    @container.register 'model:post', App.Post
    @container.register 'model:comment', App.Comment

    adapter = @container.lookup('adapter:main')
    session = adapter.newSession()


  it 'flags relationship CPs as expensive', ->
    post = session.create('post')
    propertyInfo = post._debugInfo().propertyInfo
    expect(propertyInfo.expensiveProperties).to.have.members(['user', 'comments'])

  it 'groups attributes and relationships correctly', ->
    post = session.create('post')
    groups = post._debugInfo().propertyInfo.groups
    expect(groups.length).to.eq(4)
    expect(groups[0].properties).to.have.members(['id', 'title', 'body'])
    expect(groups[1].properties).to.deep.eq(['user'])
    expect(groups[2].properties).to.deep.eq(['comments'])
