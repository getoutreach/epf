describe 'Ep.Model', ->

  App = null

  beforeEach ->
    App = Ember.Namespace.create()
    class App.User extends Ep.Model
      name: Ep.attr('string')
    @container = new Ember.Container()
    @container.register 'model:user', @User, instantiate: false
    Ep.__container__ = @container

  afterEach ->
    delete Ep.__container__


  describe 'isDirty', ->

    before ->
      class SessionStub
        dirtyModels: ~> []

      @container.register 'session:main', SessionStub

    it 'returns false when detached', ->
      expect(App.User.create().isDirty).to.be.false

    it 'returns true when dirty', ->
      user = null
      class SessionStub
        dirtyModels: ~> Ep.ModelSet.fromArray([user])

      user = App.User.create()
      user.session = SessionStub.create()
      expect(user.isDirty).to.be.true

    it 'returns false when untouched', ->
      user = null
      class SessionStub
        dirtyModels: ~> Ep.ModelSet.create()

      user = App.User.create()
      user.session = SessionStub.create()
      expect(user.isDirty).to.be.false

  describe 'copy', ->
    it 'copies objects in attributes', ->
      u1 = App.User.create()
      u1.user = ["firstname", "lastname"]
      u2 = u1.copy()
      u1.user = ["john", "doe"]
      expect(u1.user).not.to.be.eq(u2.user)

  it 'can use .find', ->
    class SessionStub
      find: (type, id) ->
        expect(type).to.eq(App.User)
        expect(id).to.eq(1)
        Ember.RSVP.resolve(type.create(id: id.toString()))

    @container.register 'session:main', SessionStub

    App.User.find(1).then (user) ->
      expect(user.id).to.eq("1")
