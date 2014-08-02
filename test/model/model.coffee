`import ModelSet from 'epf/collections/model_set'`
`import Model from 'epf/model/model'`

describe 'Model', ->

  session = null

  beforeEach ->
    `class User extends Model {}`
    User.defineSchema
      attributes:
        name: {type: 'string'}
        raw: {}
        createdAt: {type: 'date'}
    User.typeKey = 'user'
    @User = User
    
    @container = new Ember.Container()
    Ep.setupContainer(@container)
    @container.register 'model:user', User
    session = @container.lookup('session:main')

    Ep.__container__ = @container

  afterEach ->
    delete Ep.__container__

  describe '.isDirty', ->      

    it 'returns false when detached', ->
      expect(new @User().isDirty).to.be.false

    it 'returns true when dirty', ->
      user = null
      Object.defineProperty session, 'dirtyModels',
        get: -> ModelSet.fromArray([user])

      user = new @User()
      user.session = session
      expect(user.isDirty).to.be.true

    it 'returns false when untouched', ->
      Object.defineProperty session, 'dirtyModels',
        get: -> new ModelSet

      user = new @User()
      user.session = session
      expect(user.isDirty).to.be.false

    xit 'is observable', ->
      user = session.merge new @User
        id: '1'
        name: 'Wes'

      expect(user.isDirty).to.be.false
      observerHit = false

      Ember.addObserver user, 'isDirty', ->
        expect(user.isDirty).to.be.true
        observerHit = true

      user.name = 'Brogrammer'
      expect(user.isDirty).to.be.true
      expect(observerHit).to.be.true


  it 'can use .find', ->
    User = @User
    session.find = (type, id) ->
      expect(type).to.eq(User)
      expect(id).to.eq(1)
      Ember.RSVP.resolve(new type(id: id.toString()))

    @User.find(1).then (user) ->
      expect(user.id).to.eq("1")

  describe 'typeKey class var', ->
    xit 'works with global Ember', ->
      class App.SomeThing extends Ep.Model
      typeKey = Ember.get(App.SomeThing, 'typeKey')
      expect(typeKey).to.eq('some_thing')

    xit 'works with modular Ember', ->
      class SomeThing extends Ep.Model
      SomeThing._toString = "my-app@model:some-thing:"
      typeKey = Ember.get(SomeThing, 'typeKey')
      expect(typeKey).to.eq('some_thing')

  describe '.diff', ->

    it 'detects differences in complex object attributes', ->
      left = new @User
        raw: {test: 'a'}
      right = new @User
        raw: {test: 'b'}

      expect(left.diff(right)).to.eql([ { type: 'attr', name: 'raw' } ])

    it 'detects no difference in complex object attributes', ->
      left = new @User
        raw: {test: 'a'}
      right = new @User
        raw: {test: 'a'}

      expect(left.diff(right)).to.eql([])


  describe '.copy', ->
  
    it 'copies dates', ->
      
      date = new Date(2014, 7, 22)
      user = new @User
        createdAt: date
      copy = user.copy()
      expect(user.createdAt.getTime()).to.eq(copy.createdAt.getTime())
        

    it 'deep copies complex object attributes', ->

      user = new @User
        raw: {test: {value: 'a'}}

      copy = user.copy()

      expect(user).to.not.eq(copy)
      expect(user.raw).to.not.eq(copy.raw)
      expect(user.raw.test).to.not.eq(copy.raw.test)
      expect(user.raw).to.eql(copy.raw)

    it 'deep copies array attributes', ->

      user = new @User
        raw: ['a', 'b', 'c']

      copy = user.copy()

      expect(user).to.not.eq(copy)
      expect(user.raw).to.not.eq(copy.raw)
      expect(user.raw).to.eql(copy.raw)
