var none = Ember.isNone, empty = Ember.isEmpty;

Ep.StringSerializer = Ep.Serializer.extend({

  deserialize: function(serialized) {
    return none(serialized) ? null : String(serialized);
  },

  serialize: function(deserialized) {
    return none(deserialized) ? null : String(deserialized);
  }

});