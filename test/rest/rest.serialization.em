`import setup from './_shared'`

describe 'rest serialization', ->

  beforeEach ->
    setup.apply(this)
    @serializer = @adapter.serializerFor('payload')


  context 'simple model', ->
    beforeEach ->
      @Post = Ep.Model.extend
        title: Ep.attr('string')
        longTitle: Ep.attr('string')
      @container.register 'model:post', @Post

    describe "overriding a serializer's typeKey", ->

      it 'returns a model of that type', ->
        SpecialPostSerializer = Ep.ModelSerializer.extend
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
        class PostSerializer extends Ep.ModelSerializer
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
        @serializer.reopen
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
        @serializer.reopen
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
      @Post = Ep.Model.extend
        title: Ep.attr()
        object: Ep.attr()
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
      @App = Ember.Namespace.create()
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      class @Comment extends Ep.Model
        post: Ep.belongsTo(@Post)
      @App.Comment = @Comment

      @Post.reopen
        comments: Ep.hasMany(@Comment)

      @container.register 'model:post', @Post
      @container.register 'model:comment', @Comment


    it 'deserializes null hasMany', ->
      data = {post: [{id: 1, title: 'wat', comments: null}] }
      models = @serializer.deserialize(data)
      post = models[0]
      expect(post.comments.length).to.eq(0)


    it 'deserializes null belongsTo', ->
      data = {comments: [{id: 1, title: 'wat', post: null}] }
      models = @serializer.deserialize(data)
      comment = models[0]
      expect(comment.post).to.be.null


  context 'one->many embedded', ->

    beforeEach ->
      @App = Ember.Namespace.create()
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      class @Comment extends Ep.Model
        post: Ep.belongsTo(@Post)
      @App.Comment = @Comment

      @Post.reopen
        comments: Ep.hasMany(@Comment)

      PostSerializer = Ep.ModelSerializer.extend
        properties:
          comments: { embedded: 'always' }

      @container.register 'serializer:post', PostSerializer

      @container.register 'model:post', @Post
      @container.register 'model:comment', @Comment


    it 'deserializes null belongsTo', ->
      data = {comments: [{id: 1, title: 'wat', post: null}] }
      models = @serializer.deserialize(data)
      comment = models[0]
      expect(comment.post).to.be.null


  context 'one->one embedded', ->

    beforeEach ->
      @App = Ember.Namespace.create()
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      class @User extends Ep.Model
        name: Ep.attr('string')
        post: Ep.belongsTo(@Post)
      @App.User = @User

      @Post.reopen
        user: Ep.belongsTo(@User)

      PostSerializer = Ep.ModelSerializer.extend
        properties:
          user: { embedded: 'always' }

      @container.register 'serializer:post', PostSerializer

      @container.register 'model:post', @Post
      @container.register 'model:user', @User


    it 'deserializes null belongsTo', ->
      data = {posts: [{id: 1, title: 'wat', user: null}] }
      models = @serializer.deserialize(data)
      post = models[0]
      expect(post.user).to.be.null
