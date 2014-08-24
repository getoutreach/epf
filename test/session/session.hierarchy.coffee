`import {postWithComments} from '../support/schemas'`

describe "Session", ->

  beforeEach ->
    @App = Ember.Namespace.create()
    @container = new Ember.Container()
    Ep.setupContainer(@container)
    Ep.__container__ = @container
    @container.register('adapter:main', Ep.RestAdapter)

    postWithComments.apply(this)

    @adapter = @container.lookup('adapter:main')
    @container = @adapter.container

    @adapter.load = (model) -> Ember.RSVP.resolve(model)
    @adapter.flush = (session) ->
      models = session.dirtyModels
      Ember.RSVP.resolve(models.copy(true)).then (models) ->
        models.forEach (model) -> session.merge(model)


  describe 'sibling sessions', ->

    sessionA = null
    sessionB = null
    adapter = null

    beforeEach ->
      sessionA = @adapter.newSession()
      sessionB = @adapter.newSession()

      sessionA.merge @Post.create(id: "1", title: 'original')
      sessionB.merge @Post.create(id: "1", title: 'original')

    it 'updates are isolated', ->
      postA = null
      postB = null

      pA = sessionA.load('post', 1).then (post) ->
        postA = post
        postA.title = "a was here"

      pB = sessionB.load('post', 1).then (post) ->
        postB = post
        postB.title = "b was here"

      Ember.RSVP.all([pA, pB]).then ->
        expect(postA.title).to.eq("a was here")
        expect(postB.title).to.eq("b was here")


  describe "child session", ->

    parent = null
    child = null

    beforeEach ->
      parent = @adapter.newSession()
      child = parent.newSession()

    it '.flushIntoParent flushes updates immediately', ->
      parent.merge @Post.create(id: "1", title: 'original')

      child.load('post', 1).then (childPost) ->

        childPost.title = 'child version'

        parent.load('post', 1).then (parentPost) ->
          expect(parentPost.title).to.eq('original')
          f = child.flushIntoParent()
          expect(parentPost.title).to.eq('child version')
          f

    it '.flush waits for success before updating parent', ->
      parent.merge @Post.create(id: "1", title: 'original')

      child.load('post', 1).then (childPost) ->

        childPost.title = 'child version'

        parent.load('post', 1).then (parentPost) ->
          expect(parentPost.title).to.eq('original')
          f = child.flush()
          expect(parentPost.title).to.eq('original')
          f.then ->
            expect(parentPost.title).to.eq('child version')

    it 'does not mutate parent session relationships', ->
      post = parent.merge @Post.create(id: "1", title: 'parent', comments: [@Comment.create(id: '2', post: @Post.create(id: "1"))])
      expect(post.comments.length).to.eq(1)
      child.add(post)
      expect(post.comments.length).to.eq(1)


    it 'adds hasMany correctly', ->
      parentPost = parent.merge @Post.create(id: "1", title: 'parent', comments: [@Comment.create(id: '2', post: @Post.create(id: "1"))])
      post = child.add(parentPost)
      expect(post).to.not.eq(parentPost)
      expect(post.comments.length).to.eq(1)
      expect(post.comments.firstObject).to.not.eq(parentPost.comments.firstObject)
