`import setup from './_shared'`
`import {postWithComments} from '../support/schemas'`

describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    setup.apply(this)
    adapter = @adapter
    session = @session
    Coalesce.__container__ = @container

  afterEach ->
    delete Coalesce.__container__

  context 'many children', ->

    beforeEach ->

      postWithComments.apply(this)

      @container.register 'model:post', @Post
      @container.register 'model:comment', @Comment

    it 'loads model with many children to empty session fast', ->
      # Tell mocha to highlight testcase if it take longer than this threshold
      # As alternative it is possible to set `@timeout 500` to fail the test
      @slow 500

      adapter.r['GET:/posts'] = posts: [{id: 1, title: 'is it fast?', rev: 1, comments: [1..100]}],
      comments: ({id: i, message: "message#{i}", post: 1, rev: 1} for i in [1..100])

      session.query('post').then (posts) ->
        expect(posts[0].comments.get('length')).to.eq(100)


    it 'loads model with many children repeatedly fast when rev is set', ->
      # Tell mocha to highlight testcase if it take longer than this threshold
      # As alternative it is possible to set `@timeout 2500` to fail the test
      @slow 2500

      adapter.r['GET:/posts'] = posts: [{id: 1, title: 'still fast?', rev: 1, comments: [1..100]}],
      comments: ({id: i, message: "message#{i}", post: 1, rev: 1} for i in [1..100])

      session.query('post').then (posts) ->
        session.query('post').then (posts) ->
          expect(posts[0].comments.get('length')).to.eq(100)
