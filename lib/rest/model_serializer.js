Ep.RestSerializer = Ep.ModelSerializer.extend({

  keyForType: function(name, type, opts) {
    var key = this._super(name, type);
    if(!opts || !opts.embedded) {
      if(type === 'belongs_to') {
        return key + '_id';
      } else if(type === 'has_many') {
        return Ember.String.singularize(key) + '_ids';
      }
    }
    return key;
  },

});