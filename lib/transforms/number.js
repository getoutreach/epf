var empty = Ember.isEmpty;

Ep.NumberTransform = Ep.Transform.extend({

  deserialize: function(serialized) {
    return empty(serialized) ? null : Number(serialized);
  },

  serialize: function(deserialized) {
    return empty(deserialized) ? null : Number(deserialized);
  }
});