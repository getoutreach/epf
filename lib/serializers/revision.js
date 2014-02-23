var empty = Ember.isEmpty;

Ep.RevisionSerializer = Ep.Serializer.extend({

  deserialize: function(serialized) {
    return serialized ? serialized : undefined;
  },

  serialize: function(deserialized) {
    return deserialized ? deserialized : undefined;
  }
});