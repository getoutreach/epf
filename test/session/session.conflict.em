# describe 'Ep.Session with conflicts', ->

#   beforeEach ->
#     @App = Ember.Namespace.create()
#     @container = new Ember.Container()

#     class @Post extends Ep.Model
#       title: Ep.attr('string')
#     @App.Post = @Post

#     @container.register 'model:post', @Post, instantiate: false
#     @container.register 'adapter:main', Ep.LocalAdapter
#     @container.register 'store:main', Ep.Store
#     @adapter = @container.lookup 'adapter:main'


#   it 'returns local conflicts', ->
#     @adapter.loaded @Post.create(title: 'original')

#     session1 = @adapter.newSession()
#     session2 = @adapter.newSession()

#     session1.load('post', 1).then (post1) ->
#       post1.title = 'modified by 1'

#       session2.load('post', 1).then (post2) ->
#         expect(post2.title).to.eq('original')
#         expect(post2).to.not.eq(post1)
#         post2.title = 'modified by 2'

#         session2.flush().then ->

#           session1.flush().then null, ->
            
