`import Model from 'epf/model/model'`
`import ModelSet from 'epf/collections/model_set'`

describe 'ModelSet', ->

  beforeEach ->
    `class Post extends Model {}`
    Post.defineSchema
      typeKey: 'post'
      attributes:
        title: {type: 'string'}
    @Post = Post
    @set = new ModelSet()


  it 'removes based on isEqual', ->

    postA = @Post.create(id: "1", title: "one", clientId: "post1")
    postB = @Post.create(id: "1", title: "one", clientId: "post1")

    expect(postA).to.not.eq(postB)
    expect(postA.isEqual(postB)).to.be.true

    @set.add(postA)

    expect(@set.size).to.eq(1)

    @set.delete(postB)

    expect(@set.size).to.eq(0)


  it 'adds based on isEqual and always overwrites', ->

    postA = @Post.create(id: "1", title: "one", clientId: "post1")
    postB = @Post.create(id: "1", title: "one", clientId: "post1")

    expect(postA).to.not.eq(postB)
    expect(postA.isEqual(postB)).to.be.true

    @set.add(postA)

    expect(@set.size).to.eq(1)

    @set.add(postB)

    expect(@set.size).to.eq(1)
    expect(@set[0]).to.eq(postB)


  it 'copies', ->

    postA = @Post.create(id: "1", title: "one", clientId: "post1")
    postB = @Post.create(id: "2", title: "two", clientId: "post2")

    @set.add(postA)
    @set.add(postB)

    copy = @set.copy()

    expect(copy).to.not.eq(@set)

    copyA = copy.getModel(postA)
    copyB = copy.getModel(postB)

    expect(copyA).to.eq(postA)
    expect(copyB).to.eq(postB)
    


  it 'deep copies', ->

    postA = @Post.create(id: "1", title: "one", clientId: "post1")
    postB = @Post.create(id: "2", title: "two", clientId: "post2")

    @set.add(postA)
    @set.add(postB)

    copy = @set.copy(true)

    expect(copy).to.not.eq(@set)

    copyA = copy.getModel(postA)
    copyB = copy.getModel(postB)

    expect(copyA).to.not.eq(postA)
    expect(copyB).to.not.eq(postB)
    expect(copyA.isEqual(postA)).to.be.true
    expect(copyB.isEqual(postB)).to.be.true


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
