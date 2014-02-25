Ep.RestErrorsSerializer = Ep.Serializer.extend({

  deserialize: function(serialized) {
    if(!serialized) return;
    return Ep.RestErrors.create({
      content: serialized
    });
  },

  serialize: function(id) {
    throw new Ember.Error("Errors are not currently serialized down to the server.");
  }

});