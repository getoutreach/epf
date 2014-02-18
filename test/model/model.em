describe 'Ep.Model', ->

  App = null

  beforeEach ->
    App = Ember.Namespace.create()
    class App.User extends Ep.Model
      name: Ep.attr('string')
      raw: Ep.attr()
    @container = new Ember.Container()
    @container.register 'model:user', App.User

    class SessionStub
      dirtyModels: ~> []

    @container.register 'session:main', SessionStub

    Ep.__container__ = @container

  afterEach ->
    delete Ep.__container__


  describe 'isDirty', ->

    before ->
      @container.lookup('session:main').dirtyModels = []
      

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


  it 'can use .find', ->
    class SessionStub
      find: (type, id) ->
        expect(type).to.eq(App.User)
        expect(id).to.eq(1)
        Ember.RSVP.resolve(type.create(id: id.toString()))

    @container.register 'session:main', SessionStub

    App.User.find(1).then (user) ->
      expect(user.id).to.eq("1")

  describe '.diff', ->

    it 'detects differences in complex object attributes', ->
      left = App.User.create
        raw: {test: 'a'}
      right = App.User.create
        raw: {test: 'b'}

      expect(left.diff(right)).to.eql([ { type: 'attr', name: 'raw' } ])

    it 'detects no difference in complex object attributes', ->
      left = App.User.create
        raw: {test: 'a'}
      right = App.User.create
        raw: {test: 'a'}

      expect(left.diff(right)).to.eql([])