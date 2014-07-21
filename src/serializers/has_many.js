var empty = Ember.isEmpty;

import Serializer from './base';

/**
  @namespace serializers
  @class HasManySerializer
*/
export default class HasManySerializer extends Serializer {

  deserialize(serialized, opts) {
    if(!serialized) return [];
    if(!opts.embedded) {
      var idSerializer = this.serializerFor('id');
      serialized = serialized.map(function(id) {
        return {
          id: id
        };
      }, this);
      opts.reifyClientId = false;
    }
    return this.deserializeModels(serialized, opts);
  }

  deserializeModels(serialized, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return serialized.map(function(hash) {
      return serializer.deserialize(hash, opts);
    });
  }

  serialize(models, opts) {
    if(opts.embedded) {
      return this.serializeModels(models, opts);
    }
    return undefined;
  }

  serializeModels(models, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return models.map(function(model) {
      return serializer.serialize(model);
    });
  }
  
}
