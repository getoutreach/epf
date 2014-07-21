var get = Ember.get, set = Ember.set;

export default Ember.Mixin.create({

  embeddedType: function(type, name) {
    var serializer = this.serializerFactory.serializerForType(type);
    return serializer.embeddedType(type, name);
  },

  eachEmbeddedRecord: function(model, callback, binding) {
    this.eachEmbeddedBelongsToRecord(model, callback, binding);
    this.eachEmbeddedHasManyRecord(model, callback, binding);
  },

  eachEmbeddedBelongsToRecord: function(model, callback, binding) {
    this.eachEmbeddedBelongsTo(get(model, 'type'), function(name, relationship, embeddedType) {
      if(!model.isPropertyLoaded(name)) {
        return;
      }
      var embeddedRecord = get(model, name);
      if (embeddedRecord) { callback.call(binding, embeddedRecord, embeddedType); }
    });
  },

  eachEmbeddedHasManyRecord: function(model, callback, binding) {
    this.eachEmbeddedHasMany(get(model, 'type'), function(name, relationship, embeddedType) {
      if(!model.isPropertyLoaded(name)) {
        return;
      }
      var array = get(model, name);
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
