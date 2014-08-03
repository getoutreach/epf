`import setup from './_shared'`
`import {postWithComments} from '../support/schemas'`

describe "rest", ->

  adapter = null
  session = null

  beforeEach ->
    setup.apply(this)
    adapter = @adapter
    session = @session


  describe 'sideloading', ->

    beforeEach ->
      postWithComments.apply(this)

    it 'sideloads', ->
      adapter.r['GET:/posts/1'] =
        posts: {id: "1", title: 'sideload my children', comments: [2, 3]}
        comments: [{id: "2", body: "here we", post: "1"}, {id: "3",  body: "are", post: "1"}]

      session.load('post', 1).then (post) ->
        expect(adapter.h).to.eql(['GET:/posts/1'])
        expect(post.comments.get('firstObject').body).to.eq('here we')
        expect(post.comments.get('lastObject').body).to.eq('are')
