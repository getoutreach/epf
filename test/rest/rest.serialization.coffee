`import setup from './_shared'`
`import Model from 'epf/model/model'`
`import ModelSerializer from 'epf/serializers/model'`
`import {postWithComments, postWithEmbeddedComments, userWithPost} from '../support/schemas'`

describe 'rest serialization', ->

  beforeEach ->
    setup.apply(this)
    @serializer = @adapter.serializerFor('payload')


  context 'simple model', ->
    beforeEach ->
      `class Post extends Model {}`
      Post.defineSchema
        typeKey: 'post'
        attributes:
          title: {type: 'string'}
          longTitle: {type: 'string'}
      @Post = Post
      @container.register 'model:post', @Post

    describe "overriding a serializer's typeKey", ->

      it 'returns a model of that type', ->
        SpecialPostSerializer = ModelSerializer.extend
          typeKey: 'post'

        @container.register 'serializer:special_post', SpecialPostSerializer
        data = {special_posts: [{id: 1, title: 'wat', user: null}] }
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post).to.be.an.instanceof(@Post)

    describe 'deserialize', ->

      it 'reads plural hash key', ->
        data = {posts: {id: 1, title: 'wat', long_title: 'wat omgawd'}}
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post).to.be.an.instanceof(@Post)
        expect(post.title).to.eq('wat')
        expect(post.longTitle).to.eq('wat omgawd')
        expect(post.id).to.eq("1")


      it 'reads singular hash key', ->
        data = {post: {id: 1, title: 'wat', long_title: 'wat omgawd'}}
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post).to.be.an.instanceof(@Post)
        expect(post.title).to.eq('wat')
        expect(post.longTitle).to.eq('wat omgawd')
        expect(post.id).to.eq("1")


      it 'reads array value', ->
        data = {post: [{id: 1, title: 'wat', long_title: 'wat omgawd'}] }
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post).to.be.an.instanceof(@Post)
        expect(post.title).to.eq('wat')
        expect(post.longTitle).to.eq('wat omgawd')
        expect(post.id).to.eq("1")


      it 'obeys custom keys', ->
        PostSerializer = ModelSerializer.extend
          properties:
            title:
              key: 'POST_TITLE'
        @container.register 'serializer:post', PostSerializer
        data = {post: {id: 1, POST_TITLE: 'wat', long_title: 'wat omgawd'}}
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post).to.be.an.instanceof(@Post)
        expect(post.title).to.eq('wat')
        expect(post.longTitle).to.eq('wat omgawd')
        expect(post.id).to.eq("1")


      it 'reifies client_id', ->
        data = {posts: {client_id: null, id: 1, title: 'wat', long_title: 'wat omgawd'}}
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post.clientId).to.not.be.null


      it 'reads revs', ->
        data = {posts: {rev: 123, client_rev: 321, client_id: 1, id: 1, title: 'wat', long_title: 'wat omgawd'}}
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post.rev).to.eq(123)
        expect(post.clientRev).to.eq(321)

      it 'respects aliases', ->
        @serializer.constructor.reopen
          aliases:
            blog_post: 'post'

        data = {blog_post: {id: 1, title: 'wat', long_title: 'wat omgawd'}}
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post).to.be.an.instanceof(@Post)
        expect(post.title).to.eq('wat')
        expect(post.longTitle).to.eq('wat omgawd')
        expect(post.id).to.eq("1")


    describe 'serialization', ->

      beforeEach ->
        @serializer = @adapter.serializerFor('post')


      it 'serializes', ->
        post = @Post.create
          id: 1
          clientId: "2"
          title: "wat"
          longTitle: 'wat omgawd'
          rev: 123
          clientRev: 321
        data = @serializer.serialize(post)
        expect(data).to.eql(client_id: "2", id: 1, title: 'wat', long_title: 'wat omgawd', rev: 123, client_rev: 321)

      it 'obeys custom keys', ->
        @serializer.constructor.reopen
          properties:
            title:
              key: 'POST_TITLE'
        post = @Post.create()
        post.id = 1
        post.clientId = "2"
        post.title = 'wat'
        post.longTitle = 'wat omgawd'
        data = @serializer.serialize(post)
        expect(data).to.eql({client_id: "2", id: 1, POST_TITLE: 'wat', long_title: 'wat omgawd'})


  context 'model with raw and object properties', ->

    beforeEach ->
      `class Post extends Model {}`
      Post.defineSchema
        typeKey: 'post'
        attributes:
          title: {type: 'string'}
          object: {}
      @Post = Post
      @container.register 'model:post', @Post


    describe 'deserialize', ->

      it 'deserializes', ->
        data = {posts: {id: 1, title: 'wat', object: {prop: 'sup'}}}
        models = @serializer.deserialize(data)
        post = models[0]
        expect(post).to.be.an.instanceof(@Post)
        expect(post.title).to.eq('wat')
        expect(post.object.prop).to.eq('sup')
        expect(post.id).to.eq("1")

    describe 'serialization', ->

      beforeEach ->
        @serializer = @adapter.serializerFor('post')

      it 'serializes object', ->
        post = @Post.create
          id: 1
          clientId: "2"
          title: "wat"
          object: {prop: 'sup'}
        data = @serializer.serialize(post)
        expect(data).to.eql(client_id: "2", id: 1, title: 'wat', object: {prop: 'sup'})

      it 'serializes array', ->
        post = @Post.create
          id: 1
          clientId: "2"
          title: "wat"
          object: ['asd']
        data = @serializer.serialize(post)
        expect(data).to.eql(client_id: "2", id: 1, title: 'wat', object: ['asd'])

      it 'serializes empty array', ->
        post = @Post.create
          id: 1
          clientId: "2"
          title: "wat"
          object: []
        data = @serializer.serialize(post)
        expect(data).to.eql(client_id: "2", id: 1, title: 'wat', object: [])

      it 'serializes complex object', ->
        post = @Post.create
          id: 1
          clientId: "2"
          title: "wat"
          object: {tags: ['ruby', 'java']}
        data = @serializer.serialize(post)
        expect(data).to.eql(client_id: "2", id: 1, title: 'wat', object: {tags: ['ruby', 'java']})

  context 'one->many', ->

    beforeEach ->
      postWithComments.apply(this)


    it 'deserializes null hasMany', ->
      data = post: [{id: 1, title: 'wat', comments: null}]
      models = @serializer.deserialize(data)
      post = models[0]
      expect(post.comments.get('length')).to.eq(0)


    it 'deserializes null belongsTo', ->
      data = {comments: [{id: 1, title: 'wat', post: null}] }
      models = @serializer.deserialize(data)
      comment = models[0]
      expect(comment.post).to.be.null


  context 'one->many embedded', ->

    beforeEach ->
      postWithEmbeddedComments.apply(this)


    it 'deserializes null belongsTo', ->
      data = {comments: [{id: 1, title: 'wat', post: null}] }
      models = @serializer.deserialize(data)
      comment = models[0]
      expect(comment.post).to.be.null


  context 'one->one embedded', ->

    beforeEach ->
      userWithPost.apply(this)

      PostSerializer = ModelSerializer.extend
        properties:
          user: { embedded: 'always' }

      @container.register 'serializer:post', PostSerializer


    it 'deserializes null belongsTo', ->
      data = {posts: [{id: 1, title: 'wat', user: null}] }
      models = @serializer.deserialize(data)
      post = models[0]
      expect(post.user).to.be.null
