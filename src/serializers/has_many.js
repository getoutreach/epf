var empty = Ember.isEmpty;

import {LazyModel} from '../model/proxies';
import Serializer from './base';

export default Serializer.extend({

  typeFor: function(typeName) {
    return this.container.lookupFactory('model:' + typeName);
  },

  deserialize: function(serialized, opts) {
    if(!serialized) return [];
    if(opts.embedded) {
      return this.deserializeEmbedded(serialized, opts);
    }
    var idSerializer = this.serializerFor('id'),
        type = this.typeFor(opts.typeKey);
    return serialized.map(function(id) {
      var res = LazyModel.create({
        id: idSerializer.deserialize(id),
        type: type
      });
      return res;
    }, this);
  },

  deserializeEmbedded: function(serialized, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return serialized.map(function(hash) {
      return serializer.deserialize(hash);
    });
  },

  serialize: function(models, opts) {
    if(opts.embedded) {
      return this.serializeEmbedded(models, opts);
    }
    return undefined;
  },

  serializeEmbedded: function(models, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return models.map(function(model) {
      return serializer.serialize(model);
    });
  }
  
});
