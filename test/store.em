describe 'Ep.Store', ->

  beforeEach ->
    class @Post extends Ep.Model
      title: Ep.attr('string')
    @store = Ep.Store.create()

  describe 'reifyClientId', ->

    it 'sets clientId on new record', ->
      post = @Post.create(title: 'new post')
      expect(post.clientId).to.be.null
      @store.reifyClientId(post)
      expect(post.clientId).to.not.be.null

    it 'should set existing clientId on detached model', ->
      post = @Post.create(title: 'new post', id: "1")
      expect(post.clientId).to.be.null
      @store.reifyClientId(post)
      expect(post.clientId).to.not.be.null

      detached = @Post.create(title: 'different instance', id: "1")
      expect(detached.clientId).to.be.null
      @store.reifyClientId(detached)
      expect(detached.clientId).to.eq(post.clientId)
