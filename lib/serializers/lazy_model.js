var get = Ember.get, set = Ember.set;

Ep.LazyModelSerializer = Ep.Serializer.extend({
  
  serialize: function(model, opts) {
    var idSerializer = this.serializerFor('id'),
        serializedId = idSerializer.serialize(get(model, 'id'));
    if(opts.includeType) {
      return {
        type: get(model, 'typeKey'),
        id: 
      }
    }
  },
  
  deserialize: function(serialized, opts) {
    
  }
  
});
