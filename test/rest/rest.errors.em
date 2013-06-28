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
      @App.Post = @Post

      @container.register 'model:post', @Post, instantiate: false


    it 'handles validation errors on update', ->
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


    it 'handles error on create', ->
      adapter.r['POST:/posts'] = ->
        throw status: 422, responseText: JSON.stringify(errors: {title: 'is lamerz'})

      post = session.create 'post', title: 'errorz'
      session.flush().then null, ->
        expect(post.errors.title).to.eq('is lamerz')



    [401, 403, 404].forEach (errorCode) ->

      it "handles #{errorCode} on load", ->
        adapter.r['GET:/posts/1'] = ->
          throw status: errorCode

        session.load('post', 1).then null, (post) ->
          expect(post.hasErrors).to.eq.true
          expect(post.errors.status).to.eq(errorCode)
          expect(adapter.h).to.eql(['GET:/posts/1'])