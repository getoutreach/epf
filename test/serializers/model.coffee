`import Model from 'coalesce/model/model'`

describe 'ModelSerializer', ->

  App = null
  session = null
  serializer = null

  beforeEach ->
    App = Ember.Namespace.create()
    `class User extends Model {}`
    User.defineSchema
      typeKey: 'user'
      attributes:
        name: {type: 'string'}
        postCount: {type: 'number', transient: true}
    App.User = @User = User

    App.UserSerializer = Coalesce.ModelSerializer.extend
      typeKey: 'user'

    @container = new Ember.Container()
    Coalesce.setupContainer(@container)
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
