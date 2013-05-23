
describe "Session", ->

  before ->
    @container = new Ember.Container()
    @container.register('session:main', Orm.RestSerializer)
    @Post = Orm.Model.extend
      title: Orm.attr('string')
      longTitle: Orm.attr('string')
    @container.register('model:post', @Post, instantiate: false)
    @serializer = @container.lookup('serializer:main')