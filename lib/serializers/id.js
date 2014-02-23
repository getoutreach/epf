var none = Ember.isNone, empty = Ember.isEmpty;

Ep.IdSerializer = Ep.Serializer.extend({

  deserialize: function(serialized) {
    return serialized+'';
  },

  serialize: function(id) {
    if (isNaN(id)) { return id; }
    return +id;
  }

});