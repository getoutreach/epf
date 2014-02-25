var isEmpty = Ember.isEmpty;

Ep.RestErrorsSerializer = Ep.Serializer.extend({

  deserialize: function(serialized) {
    if(isEmpty(serialized) || isEmptyObject(serialized)) return;
    return Ep.RestErrors.create({
      content: serialized
    });
  },

  serialize: function(id) {
    throw new Ember.Error("Errors are not currently serialized down to the server.");
  }

});

function isEmptyObject(obj) {
  return Ember.keys(obj).length === 0;
}