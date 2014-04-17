describe 'Debug', ->

  App = null
  session = null

  beforeEach ->
    App = Ember.Namespace.create()
    @container = new Ember.Container()
    Ep.setupContainer(@container)

    class App.User extends Ep.Model
      name: Ep.attr('string')

    class App.Post extends Ep.Model
      title: Ep.attr('string')
      body: Ep.attr('string')
      user: Ep.belongsTo(App.User)

    class App.Comment extends Ep.Model
      body: Ep.attr('string')
      post: Ep.belongsTo(App.Post)

    App.Post.reopen
      comments: Ep.hasMany(App.Comment)

    App.User.reopen
      posts: Ep.hasMany(App.Post)

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
