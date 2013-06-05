describe "rest rpc", ->

  adapter = null
  session = null

  beforeEach ->
    require('./_shared').setupRest.apply(this)
    adapter = @adapter
    session = @session

  context 'simple model', ->

    beforeEach ->
      class @Post extends Ep.Model
        title: Ep.attr('string')
        submitted: Ep.attr('boolean')
      @App.Post = @Post

      @container.register 'model:post', @Post, instantiate: false

    it 'calls on loaded model', ->
      adapter.r['POST:/posts/1/submit'] = ->
        posts: {id: 1, title: 'submitted', submitted: "true"}

      session.merge @Post.create(id: "1", title: 'test', submitted: false)

      session.load('post', 1).then (post) ->
        session.remoteCall(post, 'submit').then ->
          expect(adapter.h).to.eql(['POST:/posts/1/submit'])
          expect(post.title).to.eq('submitted')
          expect(post.submitted).to.be.true

    it 'can accept parameters', ->
      adapter.r['POST:/posts/1/submit'] = ->
        posts: {id: 1, title: 'submitted', submitted: "true"}

      session.merge @Post.create(id: "1", title: 'test', submitted: false)

      session.load('post', 1).then (post) ->
        session.remoteCall(post, 'submit', token: 'asd').then ->
          expect(adapter.h).to.eql(['POST:/posts/1/submit'])
          expect(post.title).to.eq('submitted')
          expect(post.submitted).to.be.true