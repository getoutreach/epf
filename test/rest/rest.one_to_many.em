describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session


  context 'one->many', ->

    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
      @App.Post = @Post

      class @Comment extends Ep.Model
        message: Ep.attr('string')
        post: Ep.belongsTo(@Post)
      @App.Comment = @Comment

      @Post.reopen
        comments: Ep.hasMany(@Comment)

      @container.register 'model:post', @Post, instantiate: false
      @container.register 'model:comment', @Comment, instantiate: false


    it 'loads lazily', ->
      adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comment_ids: [2]}
      adapter.r['GET:/comments/2'] = comments: {id: 2, message: 'first', post_id: 1}

      session.load('post', 1).then (post) ->
        expect(adapter.h).to.eql(['GET:/posts/1'])
        expect(post.id).to.eq("1")
        expect(post.title).to.eq('mvcc ftw')
        expect(post.comments.length).to.eq(1)
        comment = post.comments.firstObject
        expect(comment.message).to.be.undefined

        post.comments.firstObject.then ->
          expect(adapter.h).to.eql(['GET:/posts/1', 'GET:/comments/2'])
          expect(comment.message).to.eq('first')
          expect(comment.post.isEqual(post)).to.be.true


    it 'saves', ->
      adapter.r['POST:/posts'] = -> posts: {client_id: post.clientId, id: 1, title: 'topological sort', comment_ids: []}
      adapter.r['POST:/comments'] = -> comments: {client_id: comment.clientId, id: 2, message: 'seems good', post_id: 1}

      post = session.create('post')
      post.title = 'topological sort'

      comment = session.create('comment')
      comment.message = 'seems good'
      comment.post = post

      expect(post.comments.firstObject).to.eq(comment)

      session.flush().then ->
        expect(post.id).to.not.be.null
        expect(post.title).to.eq('topological sort')
        expect(comment.id).to.not.be.null
        expect(comment.message).to.eq('seems good')
        expect(comment.post).to.eq(post)
        expect(post.comments.firstObject).to.eq(comment)
        expect(adapter.h).to.eql(['POST:/posts', 'POST:/comments'])


    it 'saves child', ->
      adapter.r['POST:/comments'] = -> comments: {client_id: comment.clientId, id: 2, message: 'new child', post_id: 1}

      session.merge @Post.create(id: "1", title: 'parent');

      comment = null

      session.load(@Post, 1).then (post) ->
        comment = session.create('comment', message: 'new child')
        comment.post = post
        expect(post.comments.toArray()).to.eql([comment])
        session.flush().then ->
          expect(post.comments.toArray()).to.eql([comment])
          expect(comment.message).to.eq('new child')
          expect(adapter.h).to.eql(['POST:/comments'])


    it 'updates parent, updates child, and saves sibling', ->
      adapter.r['PUT:/posts/1'] = -> post: {id: 1, title: 'polychild', comment_ids: [2]}
      adapter.r['PUT:/comments/2'] = -> comments: {id: 2, title: 'original sibling', post_id: 1}
      adapter.r['POST:/comments'] = -> comments: {client_id: sibling.clientId, id: 3, message: 'sibling', post_id: 1}

      post = @Post.create(id: "1", title: 'parent');
      post.comments.addObject(@Comment.create(id: "2", message: 'child'))
      session.merge post

      comment = null
      sibling = null

      session.load(@Post, 1).then (post) ->
        comment = post.comments.firstObject
        sibling = session.create('comment', message: 'sibling')
        sibling.post = post
        comment.message = 'original sibling'
        post.title = 'polychild'
        expect(post.comments.toArray()).to.eql([comment, sibling])
        session.flush().then ->
          debugger
          expect(post.comments.toArray()).to.eql([comment, sibling])
          expect(adapter.h).to.eql(['PUT:/posts/1', 'PUT:/comments/2', 'POST:/comments'])


    it 'updates with unloaded child', ->
      adapter.r['GET:/posts/1'] = -> posts: {id: 1, title: 'mvcc ftw', comment_ids: [2]}
      adapter.r['PUT:/posts/1'] = -> posts: {id: 1, title: 'updated', comment_ids: [2]}
      session.load('post', 1).then (post) ->
        expect(post.title).to.eq('mvcc ftw')
        expect(adapter.h).to.eql(['GET:/posts/1'])
        post.title = 'updated'
        session.flush().then ->
          expect(post.title).to.eq('updated')
          expect(adapter.h).to.eql(['GET:/posts/1', 'PUT:/posts/1'])


    it 'deletes child', ->
      adapter.r['PUT:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comment_ids: [2]}
      adapter.r['DELETE:/comments/2'] = {}

      post = @Post.create(id: "1", title: 'parent');
      post.comments.addObject(@Comment.create(id: "2", message: 'child'))
      session.merge post

      session.load('post', 1).then (post) ->
        comment = post.comments.firstObject
        session.deleteModel(comment)
        expect(post.comments.length).to.eq(0)
        session.flush().then ->
          expect(adapter.h).to.eql(['DELETE:/comments/2'])
          expect(post.comments.length).to.eq(0)


    it 'deletes child and updates parent', ->
      adapter.r['PUT:/posts/1'] = posts: {id: 1, title: 'childless', comment_ids: [2]}
      adapter.r['DELETE:/comments/2'] = {}

      post = @Post.create(id: "1", title: 'parent');
      post.comments.addObject(@Comment.create(id: "2", message: 'child'))
      session.merge post

      session.load('post', 1).then (post) ->
        comment = post.comments.firstObject
        session.deleteModel(comment)
        expect(post.comments.length).to.eq(0)
        post.title = 'childless'
        session.flush().then ->
          expect(adapter.h).to.eql(['PUT:/posts/1', 'DELETE:/comments/2'])
          expect(post.comments.length).to.eq(0)
          expect(post.title).to.eq('childless')


    it 'deletes parent and child', ->
      adapter.r['DELETE:/posts/1'] = {}
      adapter.r['DELETE:/comments/2'] = {}

      post = @Post.create(id: "1", title: 'parent');
      post.comments.addObject(@Comment.create(id: "2", message: 'child'))
      session.merge post

      session.load('post', 1).then (post) ->
        comment = post.comments.firstObject
        session.deleteModel(comment)
        expect(post.comments.length).to.eq(0)
        session.deleteModel(post)
        session.flush().then ->
          expect(adapter.h).to.eql(['DELETE:/posts/1', 'DELETE:/comments/2'])
          expect(post.isDeleted).to.be.true
          expect(comment.isDeleted).to.be.true


    context 'embedded', ->

      beforeEach ->
        @RestAdapter.map @Post,
          comments: { embedded: 'always' }
        # Re-instantiate since mappings are reified
        @adapter = @container.lookup('adapter:main')
        adapter = @adapter
        session = adapter.newSession()


      it 'loads', ->
        adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: [{id: 2, post_id: 1, message: 'first'}]}

        session.load(@Post, 1).then (post) ->
          expect(adapter.h).to.eql(['GET:/posts/1'])
          expect(post.id).to.eq("1")
          expect(post.title).to.eq('mvcc ftw')
          expect(post.comments.length).to.eq(1)
          comment = post.comments.firstObject
          expect(comment.message).to.eq 'first'
          expect(comment.post.isEqual(post)).to.be.true


      it 'updates child', ->
        adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: [{id: 2, post_id: 1, message: 'first'}]}
        adapter.r['PUT:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: [{id: 2, post_id: 1, message: 'first again'}]}

        session.load(@Post, 1).then (post) ->
          expect(adapter.h).to.eql(['GET:/posts/1'])
          comment = post.comments.firstObject
          comment.message = 'first again'
          session.flush().then ->
            expect(adapter.h).to.eql(['GET:/posts/1', 'PUT:/posts/1'])
            expect(post.comments.firstObject).to.eq(comment)
            expect(comment.message).to.eq('first again')


      it 'adds child', ->
        adapter.r['GET:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: []}
        adapter.r['PUT:/posts/1'] =  -> posts: {id: 1, title: 'mvcc ftw', comments: [{id: 2, client_id: comment.clientId, post_id: 1, message: 'reborn'}]}

        comment = null
        session.load(@Post, 1).then (post) ->
          expect(adapter.h).to.eql(['GET:/posts/1'])
          expect(post.comments.length).to.eq(0)
          comment = session.create('comment', message: 'reborn')
          comment.post = post
          session.flush().then ->
            expect(adapter.h).to.eql(['GET:/posts/1', 'PUT:/posts/1'])
            expect(comment.message).to.eq('reborn')
            expect(post.comments.firstObject).to.eq(comment)


      it 'deletes child', ->
        adapter.r['PUT:/posts/1'] = (url, type, hash) ->
          expect(hash.data.post.comments.length).to.eq(0)
          return posts: {id: 1, title: 'mvcc ftw', comments: []}

        post = @Post.create(id: "1", title: 'parent');
        post.comments.addObject(@Comment.create(id: "2", message: 'child'))
        session.merge post

        session.load('post', 1).then (post) ->
          comment = post.comments.firstObject
          session.deleteModel(comment)
          expect(post.comments.length).to.eq(0)
          session.flush().then ->
            expect(adapter.h).to.eql(['PUT:/posts/1'])
            expect(post.comments.length).to.eq(0)


      it 'deletes multiple children in multiple flushes', ->
        post = @Post.create(id: "1", title: 'parent');
        post.comments.addObject @Comment.create(id: "2", message: 'thing 1')
        post.comments.addObject @Comment.create(id: "3", message: 'thing 2')
        post = session.merge(post)

        adapter.r['PUT:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: [{post_id: "1", id: "3", message: 'thing 2'}]}

        session.deleteModel post.comments.objectAt(0)
        session.flush().then ->
          expect(adapter.h).to.eql(['PUT:/posts/1'])
          expect(post.comments.length).to.eq(1)
          session.deleteModel post.comments.objectAt(0)
          adapter.r['PUT:/posts/1'] = posts: {id: 1, title: 'mvcc ftw', comments: []}
          session.flush().then ->
            expect(adapter.h).to.eql(['PUT:/posts/1', 'PUT:/posts/1'])
            expect(post.comments.length).to.eq(0)


      it 'deletes parent and child', ->
        adapter.r['DELETE:/posts/1'] = {}

        post = @Post.create(id: "1", title: 'parent');
        post.comments.addObject(@Comment.create(id: "2", message: 'child'))
        session.merge post

        # TODO: once we have support for side deletions beef up this test
        session.load('post', 1).then (post) ->
          session.deleteModel(post)
          session.flush().then ->
            expect(adapter.h).to.eql(['DELETE:/posts/1'])
            expect(post.isDeleted).to.be.true