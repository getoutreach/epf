var get = Ember.get, set = Ember.set;

Ep.EmbeddedHelpersMixin = Ember.Mixin.create({

  serializerFor: function(type) {
    var key = get(type, 'typeKey');
    // TODO: move this to a custom resolver
    return this.container.lookup('serializer:' + key) ||
           this.container.lookup('serializer:main');
  },

  embeddedType: function(type, name) {
    var serializer = this.serializerFor(type);
    if(this === serializer) {
      var config = this.configFor(name);
      return config.embedded;
    }
    return serializer.embeddedType(type, name);
  },

  eachEmbeddedRecord: function(record, callback, binding) {
    this.eachEmbeddedBelongsToRecord(record, callback, binding);
    this.eachEmbeddedHasManyRecord(record, callback, binding);
  },

  eachEmbeddedBelongsToRecord: function(record, callback, binding) {
    this.eachEmbeddedBelongsTo(record.constructor, function(name, relationship, embeddedType) {
      var embeddedRecord = get(record, name);
      if (embeddedRecord) { callback.call(binding, embeddedRecord, embeddedType); }
    });
  },

  eachEmbeddedHasManyRecord: function(record, callback, binding) {
    this.eachEmbeddedHasMany(record.constructor, function(name, relationship, embeddedType) {
      var array = get(record, name);
      for (var i=0, l=get(array, 'length'); i<l; i++) {
        callback.call(binding, array.objectAt(i), embeddedType);
      }
    });
  },

  eachEmbeddedHasMany: function(type, callback, binding) {
    this.eachEmbeddedRelationship(type, 'hasMany', callback, binding);
  },

  eachEmbeddedBelongsTo: function(type, callback, binding) {
    this.eachEmbeddedRelationship(type, 'belongsTo', callback, binding);
  },

  eachEmbeddedRelationship: function(type, kind, callback, binding) {
    type.eachRelationship(function(name, relationship) {
      var embeddedType = this.embeddedType(type, name);

      if (embeddedType) {
        if (relationship.kind === kind) {
          callback.call(binding, name, relationship, embeddedType);
        }
      }
    }, this);
  }

});