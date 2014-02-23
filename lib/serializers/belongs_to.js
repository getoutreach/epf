var get = Ember.get, set = Ember.set;

Ep.BelongsToSerializer = Ep.Serializer.extend({

  typeFor: function(typeName) {
    return this.container.lookupFactory('model:' + typeName);
  },

  deserialize: function(serialized, opts) {
    if(!serialized) {
      return null;
    }
    if(opts.embedded) {
      return this.deserializeEmbedded(serialized, opts);
    }
    var idSerializer = this.serializerFor('id');
    return Ep.LazyModel.create({
      id: idSerializer.deserialize(serialized),
      type: this.typeFor(opts.typeKey)
    });
  },

  deserializeEmbedded: function(serialized, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return serializer.deserialize(serialized);
  },

  serialize: function(model, opts) {
    if(!model) {
      return null;
    }
    if(opts.embedded) {
      return this.serializeEmbedded(model, opts);
    }
    var idSerializer = this.serializerFor('id');
    return idSerializer.serialize(get(model, 'id'));
  },

  serializeEmbedded: function(model, opts) {
    var serializer = this.serializerFor(opts.typeKey);
    return serializer.serialize(model);
  }

});