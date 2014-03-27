var get = Ember.get, set = Ember.set, isEmpty = Ember.isEmpty;

Ep.RestErrorsSerializer = Ep.Serializer.extend({

  deserialize: function(serialized, opts) {
    var xhr = opts && opts.xhr;
    
    if(!xhr && (isEmpty(serialized) || isEmptyObject(serialized))) return;
    
    res = Ep.RestErrors.create({
      content: serialized
    });
    
    if(xhr) {
      set(res, 'status', xhr.status);
      set(res, 'xhr', xhr);
    }
    
    return res;
  },

  serialize: function(id) {
    throw new Ember.Error("Errors are not currently serialized down to the server.");
  }

});

function isEmptyObject(obj) {
  return Ember.keys(obj).length === 0;
}
