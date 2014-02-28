describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session

  context 'simple model with errors', ->

    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
        category: Ep.attr('string')
      @App.Post = @Post

      @container.register 'model:post', @Post


    context 'on create', ->
      it 'handles validation errors', ->
        adapter.r['PUT:/posts/1'] = ->
          throw status: 422, responseText: JSON.stringify(errors: {title: 'title is too short'})

        session.merge @Post.create(id: "1", title: 'test')
        session.load('post', 1).then (post) ->
          expect(post.title).to.eq('test')
          post.title = ''
          session.flush().then null, ->
            expect(post.hasErrors).to.be.true
            expect(post.title).to.eq('')
            expect(post.errors.title).to.eq('title is too short')
            expect(adapter.h).to.eql(['PUT:/posts/1'])

      it 'handles payload with error properties', ->
        adapter.r['PUT:/posts/1'] = ->
          throw status: 422, responseText: JSON.stringify(post: {id: 1, title: 'test', errors: {title: 'title is too short'}})

        session.merge @Post.create(id: "1", title: 'test')
        session.load('post', 1).then (post) ->
          expect(post.title).to.eq('test')
          post.title = ''
          session.flush().then null, ->
            expect(post.hasErrors).to.be.true
            expect(post.title).to.eq('')
            expect(post.errors.title).to.eq('title is too short')
            expect(adapter.h).to.eql(['PUT:/posts/1'])

      it 'merges payload with error properties and higher rev', ->
        adapter.r['PUT:/posts/1'] = ->
          throw status: 422, responseText: JSON.stringify(post: {id: 1, title: '', category: 'new', rev: 10, errors: {title: 'title is too short'}})

        session.merge @Post.create(id: "1", title: 'test')
        session.load('post', 1).then (post) ->
          expect(post.title).to.eq('test')
          post.title = ''
          session.flush().then null, ->
            expect(post.hasErrors).to.be.true
            expect(post.title).to.eq('')
            expect(post.category).to.eq('new')
            expect(post.errors.title).to.eq('title is too short')
            expect(adapter.h).to.eql(['PUT:/posts/1'])

      it 'merges payload with error and latest client changes against latest client version', ->
        adapter.r['PUT:/posts/1'] = (url, type, hash) ->
          throw status: 422, responseText: JSON.stringify(post: {id: 1, title: 'Something', client_rev: hash.data.post.client_rev, errors: {title: 'cannot be empty'}})

        session.merge @Post.create(id: "1", title: 'test')
        session.load('post', 1).then (post) ->
          expect(post.title).to.eq('test')
          post.title = ''
          session.flush().then null, ->
            expect(post.hasErrors).to.be.true
            expect(post.title).to.eq('Something')
            expect(adapter.h).to.eql(['PUT:/posts/1'])

      it 'empty errors object should deserialize without errors', ->
        adapter.r['PUT:/posts/1'] = ->
          post: {id: 1, title: '', errors: {}}

        session.merge @Post.create(id: "1", title: 'test')
        session.load('post', 1).then (post) ->
          expect(post.title).to.eq('test')
          post.title = ''
          session.flush().then null, ->
            expect(post.hasErrors).to.be.false
            expect(post.title).to.eq('')
            expect(adapter.h).to.eql(['PUT:/posts/1'])


    context 'on create', ->
      it 'handles error', ->
        adapter.r['POST:/posts'] = ->
          throw status: 422, responseText: JSON.stringify(errors: {title: 'is lamerz'})

        post = session.create 'post', title: 'errorz'
        session.flush().then null, ->
          expect(post.errors.title).to.eq('is lamerz')

      it 'merges payload with latest client changes against latest client version', ->
        adapter.r['POST:/posts'] = (url, type, hash) ->
          throw status: 422, responseText: JSON.stringify(post: {title: 'Something', client_id: hash.data.post.client_id, client_rev: hash.data.post.client_rev, errors: {title: 'cannot be empty'}})

        post = session.create 'post', title: ''
        session.flush().then null, ->
          expect(post.title).to.eq('Something')

      it 'succeeds after retry', ->
        adapter.r['POST:/posts'] = ->
          throw status: 422, responseText: JSON.stringify(errors: {title: 'is lamerz'})

        post = session.create 'post', title: 'errorz'
        session.flush().then null, ->
          expect(post.errors.title).to.eq('is lamerz')
          adapter.r['POST:/posts'] = (url, type, hash) ->
            post: {title: 'linkbait', id: 1, client_id: hash.data.post.client_id, client_rev: hash.data.post.client_rev}
          session.title = 'linkbait'
          session.flush().then ->
            expect(post.title).to.eq('linkbait')
            expect(adapter.h).to.eql(['POST:/posts', 'POST:/posts'])


      context 'in child session', ->

        it 'merges payload with latest client changes against latest client version', ->
          adapter.r['POST:/posts'] = (url, type, hash) ->
            throw status: 422, responseText: JSON.stringify(post: {title: 'Something', client_id: hash.data.post.client_id, client_rev: hash.data.post.client_rev, errors: {title: 'cannot be empty'}})

          session = session.newSession()
          post = session.create 'post', title: ''
          session.flush().then null, ->
            expect(post.title).to.eq('Something')

        it 'succeeds after retry', ->
          adapter.r['POST:/posts'] = ->
            throw status: 422, responseText: JSON.stringify(errors: {title: 'is lamerz'})

          session = session.newSession()
          post = session.create 'post', title: 'errorz'
          session.flush().then null, ->
            expect(post.errors.title).to.eq('is lamerz')
            adapter.r['POST:/posts'] = (url, type, hash) ->
              post: {title: 'linkbait', id: 1, client_id: hash.data.post.client_id, client_rev: hash.data.post.client_rev}
            session.title = 'linkbait'
            session.flush().then ->
              expect(post.title).to.eq('linkbait')
              expect(adapter.h).to.eql(['POST:/posts', 'POST:/posts'])


    context 'on load', ->
      [401, 403, 404].forEach (errorCode) ->

        it "handles #{errorCode}", ->
          adapter.r['GET:/posts/1'] = ->
            throw status: errorCode

          session.load('post', 1).then null, (post) ->
            expect(post.hasErrors).to.eq.true
            expect(post.errors.status).to.eq(errorCode)
            expect(adapter.h).to.eql(['GET:/posts/1'])