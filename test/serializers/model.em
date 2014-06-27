describe 'Ep.ModelSerializer', ->

  App = null
  session = null
  serializer = null

  beforeEach ->
    App = Ember.Namespace.create()
    class App.User extends Ep.Model
      name: Ep.attr 'string'
      postCount: Ep.attr 'number', transient: true

    class App.UserSerializer extends Ep.ModelSerializer
      typeKey: 'user'

    @container = new Ember.Container()
    Ep.setupContainer(@container)
    @container.register 'model:user', App.User
    @container.register 'serializer:user', App.UserSerializer
    session = @container.lookup('session:main')
    serializer = @container.lookup('serializer:user')


  describe '.deserialize', ->

    it 'includes transient properties', ->
      data = {id: 1, name: 'Bro', post_count: 12}
      user = serializer.deserialize(data)
      expect(user.postCount).to.eq(12)

  describe '.serialize', ->

    it 'does not include transient properties', ->
      user = session.build 'user', id: 1, name: 'Bro', postCount: 12
      data = serializer.serialize(user)
      expect(data.post_count).to.be.undefined