describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session

  context 'rpc with simple model', ->

    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
        submitted: Ep.attr('boolean')
      @App.Post = @Post

      @container.register 'model:post', @Post

    it 'works with loaded model as context', ->
      adapter.r['POST:/posts/1/submit'] = ->
        posts: {id: 1, title: 'submitted', submitted: "true"}

      session.merge @Post.create(id: "1", title: 'test', submitted: false)

      session.load('post', 1).then (post) ->
        session.remoteCall(post, 'submit').then ->
          expect(adapter.h).to.eql(['POST:/posts/1/submit'])
          expect(post.title).to.eq('submitted')
          expect(post.submitted).to.be.true

    it 'handles remote calls on the collection', ->
      adapter.r['POST:/posts/randomize'] = ->
        posts: [{id: 1, title: 'submitted', submitted: true}, {id: 2, title: 'submitted2', submitted: true}]

      session.remoteCall('post', 'randomize').then (models) ->
          expect(models.length).to.eq(2)
          expect(models.firstObject.title).to.eq('submitted')
          expect(models.firstObject.submitted).to.be.true
          expect(adapter.h).to.eql(['POST:/posts/randomize'])



    it 'can accept model type as context', ->
      adapter.r['POST:/posts/import'] = ->
        posts: [{id: 1, title: 'submitted', submitted: "true"}]

      session.remoteCall('post', 'import').then (posts) ->
        expect(adapter.h).to.eql(['POST:/posts/import'])
        expect(posts.firstObject.id).to.eq("1")


    it 'can accept parameters', ->
      adapter.r['POST:/posts/1/submit'] = ->
        posts: {id: 1, title: 'submitted', submitted: "true"}

      session.merge @Post.create(id: "1", title: 'test', submitted: false)

      session.load('post', 1).then (post) ->
        session.remoteCall(post, 'submit', token: 'asd').then ->
          expect(adapter.h).to.eql(['POST:/posts/1/submit'])
          expect(post.title).to.eq('submitted')
          expect(post.submitted).to.be.true

    it 'passes through metadata', ->
      adapter.r['POST:/posts/1/submit'] = ->
        meta: {traffic: 'heavy'}, posts: {id: 1, title: 'submitted', submitted: "true"}

      session.merge @Post.create(id: "1", title: 'test', submitted: false)

      session.load('post', 1).then (post) ->
        session.remoteCall(post, 'submit', token: 'asd').then ->
          expect(adapter.h).to.eql(['POST:/posts/1/submit'])
          expect(post.meta.traffic).to.eq('heavy')
          expect(post.title).to.eq('submitted')
          expect(post.submitted).to.be.true

    it 'can accept a method', ->
      adapter.r['PUT:/posts/1/submit'] = ->
        posts: {id: 1, title: 'submitted', submitted: "true"}

      session.merge @Post.create(id: "1", title: 'test', submitted: false)

      session.load('post', 1).then (post) ->
        session.remoteCall(post, 'submit', {token: 'asd'}, {type: 'PUT'}).then ->
          expect(adapter.h).to.eql(['PUT:/posts/1/submit'])
          expect(post.title).to.eq('submitted')
          expect(post.submitted).to.be.true