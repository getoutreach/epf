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
    var typeKey = opts.typeKey;
    if(opts.polymorphic) {
      typeKey = this.extractPolymorphicType(serialized);
    }
    var idSerializer = this.serializerFor('id');
    var res = Ep.LazyModel.create({
      id: idSerializer.deserialize(serialized),
      type: this.typeFor(typeKey)
    });
    return res;
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
    var serializer = this.serializerForModel(model);
        serializerOpts = {};
    if(opts.polymorphic) {
      serializerOpts.includeType = true;
    }
    return serializer.serialize(model, serializerOpts);
  },
  
  extractPolymorphicType: function(serialized) {
    var typeKey = serialized['type'];
    Ember.assert("Polymorphic belongsTo must include 'type' property", !!typeKey);
    return typeKey;
  }
  

});
