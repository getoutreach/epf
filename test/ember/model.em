`import setupContainer from 'epf/ember/setup_container'`
`import Model from 'epf/ember/model'`
`import {attr, hasMany, belongsTo} from 'epf/ember/model'`
`import Attribute from 'epf/model/attribute'`

describe 'ember/model', ->

  session = null
  App = null

  # beforeEach ->
  #   App = Ember.Namespace.create()
  #   @container = new Ember.Container()
  #   setupContainer(@container)
  #   Ep.__container__ = @container
  # 
  #   class @Post extends Model
  #     title: attr 'string'
  #     
  
  describe 'schema macros', ->
  
    describe 'attr', ->
    
      it 'defines an attribute', ->
        class Post extends Model
          title: attr('string')
        expect(Post.fields.get('title')).to.be.an.instanceOf(Attribute)
      
