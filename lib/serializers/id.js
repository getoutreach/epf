Ep.IdSerializer = Ep.Serializer.extend({

  deserialize: function(serialized) {
    if(serialized === undefined) return;
    return serialized+'';
  },

  serialize: function(id) {
    if (isNaN(id)) { return id; }
    return +id;
  }

});