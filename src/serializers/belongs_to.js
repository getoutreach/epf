var get = Ember.get, set = Ember.set;

import Serializer from './base';

/**
  @namespace serializers
  @class BelongsToSerializer
*/
export default class BelongsToSerializer extends Serializer {

  deserialize(serialized, opts) {
    if(!serialized) {
      return null;
    }
    if(!opts.embedded) {
      var idSerializer = this.serializerFor('id');
      serialized = {
        id: idSerializer.deserialize(serialized)
      };
      opts.reifyClientId = false;
    }
    return this.deserializeModel(serialized, opts);
  }

  deserializeModel(serialized, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return serializer.deserialize(serialized, opts);
  }

  serialize(model, opts) {
    if(!model) {
      return null;
    }
    if(opts.embedded) {
      return this.serializeModel(model, opts);
    }
    var idSerializer = this.serializerFor('id');
    return idSerializer.serialize(get(model, 'id'));
  }

  serializeModel(model, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return serializer.serialize(model);
  }

}
