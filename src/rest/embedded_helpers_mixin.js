var get = Ember.get, set = Ember.set;

import SerializerForMixin from '../serializers/serializer_for_mixin';

export default Ember.Mixin.create(SerializerForMixin, {

  embeddedType: function(type, name) {
    var serializer = this.serializerForType(type);
    if(this === serializer) {
      var config = this.configFor(name);
      return config.embedded;
    }
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
