describe 'Ep.Model', ->

  beforeEach ->
    @App = Ember.Namespace.create()
    class @User extends Ep.Model
      name: Ep.attr('string')
    @App.User = @User
    @container = new Ember.Container()
    @container.register 'model:user', @User, instantiate: false
    Ep.__container__ = @container

  afterEach ->
    delete Ep.__container__


  it 'can use .find', ->
    User = @User
    class @SessionStub
      load: (type, id) ->
        expect(type).to.eq(User)
        expect(id).to.eq(1)
        Ember.RSVP.resolve(type.create(id: id.toString()))

    @container.register 'session:main', @SessionStub

    @User.find(1).then (user) ->
      expect(user.id).to.eq("1")