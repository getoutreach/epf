describe 'Ep.ModelSet', ->

  beforeEach ->
    class @Post extends Ep.Model
      title: Ep.attr('string')
    @set = Ep.ModelSet.create()

  context 'with model', ->

    beforeEach ->
      @post = @Post.create(title: 'test', id: "1", clientId: "post1")
      @set.add(@post)

    it 'finds via getForClientId', ->
      expect(@set.getForClientId("post1")).to.eq(@post)

    it 'finds via getModel', ->
      expect(@set.getModel(@post)).to.eq(@post)

    it 'finds via getModel with alternate model', ->
      post = @Post.create(title: 'some other', id: "1", clientId: "post1")
      expect(@set.getModel(post)).to.eq(@post)