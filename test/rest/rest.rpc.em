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

      @container.register 'model:post', @Post, instantiate: false

    it 'works with loaded model as context', ->
      adapter.r['POST:/posts/1/submit'] = ->
        posts: {id: 1, title: 'submitted', submitted: "true"}

      session.merge @Post.create(id: "1", title: 'test', submitted: false)

      session.load('post', 1).then (post) ->
        session.remoteCall(post, 'submit').then ->
          expect(adapter.h).to.eql(['POST:/posts/1/submit'])
          expect(post.title).to.eq('submitted')
          expect(post.submitted).to.be.true


    # it.only 'works with model name as context', ->
    #   adapter.r['POST:/posts/import'] = ->
    #     posts: [{id: 1, title: 'submitted', submitted: "true"}]

    #   session.remoteCall('post', 'import').then ->
    #     expect(adapter.h).to.eql(['POST:/posts/import'])
    #     # TODO merging data in


    it 'can accept parameters', ->
      adapter.r['POST:/posts/1/submit'] = ->
        posts: {id: 1, title: 'submitted', submitted: "true"}

      session.merge @Post.create(id: "1", title: 'test', submitted: false)

      session.load('post', 1).then (post) ->
        session.remoteCall(post, 'submit', token: 'asd').then ->
          expect(adapter.h).to.eql(['POST:/posts/1/submit'])
          expect(post.title).to.eq('submitted')
          expect(post.submitted).to.be.true