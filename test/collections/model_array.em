`import ModelArray from 'epf/collections/model_array'`
`import {postSchema} from 'epf-test/support/schemas'`

describe 'ModelArray', ->

  array = null

  beforeEach ->
    postSchema.apply(this)
    array = ModelArray.create(content: [])

  describe 'removeObject', ->

    it 'should remove based on `isEqual` equivalence', ->
      array.addObject @Post.create(clientId: '1')
      array.removeObject @Post.create(clientId: '1')
      expect(array.length).to.eq(0)


  describe '.copyTo', ->

    dest = null

    beforeEach ->
      dest = ModelArray.create(content: [])

    it 'should copy objects', ->
      array.addObjects [@Post.create(clientId: '1'), @Post.create(clientId: '2')]
      array.copyTo(dest)

      expect(dest.length).to.eq(2)

    it 'should remove objects not present in source array', ->
      array.addObject @Post.create(clientId: '1')
      dest.addObject @Post.create(clientId: '2')
      array.copyTo(dest)

      expect(dest.length).to.eq(1)
      expect(dest.objectAt(0).clientId).to.eq('1')


  describe '.load', ->

    beforeEach ->
      @Post.reopen
        load: ->
          @loadCalled = true
          Ember.RSVP.resolve(@)
      array.pushObject(@Post.create(id: "1"))
      array.pushObject(@Post.create(id: "2"))

    it 'should load all models', ->
      array.load().then ->
        expect(array.length).to.eq(2)
        array.forEach (model) ->
          expect(model.loadCalled).to.be.true