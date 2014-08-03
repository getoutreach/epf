`import setup from './_shared'`
`import {postWithEmbeddedComments} from '../support/schemas'`

describe 'EmbeddedManager', ->
  
  adapter = null
  session = null
  manager = null

  beforeEach ->
    setup.apply(this)
    adapter = @adapter
    session = @session
    Ep.__container__ = @container

    postWithEmbeddedComments.apply(this)

    manager = adapter._embeddedManager


  it 'can determine if a record is embedded', ->
    @post = @Post.create(id: 1)
    @comment = @Comment.create(id: 2)

    expect(manager.isEmbedded(@post)).to.be.false
    expect(manager.isEmbedded(@comment)).to.be.true
    
