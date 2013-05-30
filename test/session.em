describe "Ep.Session", ->

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()

    class @Post extends Ep.Model
      title: Ep.attr('string')
    @App.Post = @Post

    @container.register 'model:post', @Post, instantiate: false

    @session = Ep.Session.create(container: @container)


  describe 'with orphaned proxy', ->

    beforeEach ->
      @lazyPost = @session.merge Ep.LazyModel.create
        id: "1"
        type: @Post
      @post = @session.merge @Post.create
        id: "1"
        title: "this is the title"

    it 'has actual record in `models`', ->
      expect(@session.models.toArray()).to.eql([@post])

    it 'has proxy in orphans', ->
      expect(@session.orphans.toArray()).to.eql([@lazyPost])


  it 'can create with hash', ->
    @post = @session.create('post', title: 'test')
    expect(@post.title).to.eq('test')



