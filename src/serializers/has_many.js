var empty = Ember.isEmpty;

import Serializer from './base';

export default Serializer.extend({

  typeFor: function(typeName) {
    return this.container.lookupFactory('model:' + typeName);
  },

  deserialize: function(serialized, opts) {
    if(!serialized) return [];
    if(!opts.embedded) {
      var idSerializer = this.serializerFor('id');

      serialized = serialized.map(function(id) {
        return {
          id: id
        };
      }, this);
    }
    return this.deserializeModels(serialized, opts);
  },

  deserializeModels: function(serialized, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return serialized.map(function(hash) {
      return serializer.deserialize(hash);
    });
  },

  serialize: function(models, opts) {
    if(opts.embedded) {
      return this.serializeModels(models, opts);
    }
    return undefined;
  },

  serializeModels: function(models, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return models.map(function(model) {
      return serializer.serialize(model);
    });
  }
  
});
