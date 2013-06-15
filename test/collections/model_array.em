describe 'Ep.ModelArray', ->

  array = null
  Post = null

  beforeEach ->
    class Post extends Ep.Model
      title: Ep.attr('string')
    array = Ep.ModelArray.create(content: [])

  describe 'removeObject', ->

    it 'should remove based on `isEqual` equivalence', ->
      array.addObject Post.create(clientId: '1')
      array.removeObject Post.create(clientId: '1')
      expect(array.length).to.eq(0)


  describe 'copyTo', ->

    dest = null

    beforeEach ->
      dest = Ep.ModelArray.create(content: [])

    it 'should copy objects', ->
      array.addObjects [Post.create(clientId: '1'), Post.create(clientId: '2')]
      array.copyTo(dest)

      expect(dest.length).to.eq(2)

    it 'should remove objects not present in source array', ->
      array.addObject Post.create(clientId: '1')
      dest.addObject Post.create(clientId: '2')
      array.copyTo(dest)

      expect(dest.length).to.eq(1)
      expect(dest.objectAt(0).clientId).to.eq('1')