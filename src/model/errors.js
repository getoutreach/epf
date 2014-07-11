var get = Ember.get, set = Ember.set, copy = Ember.copy;

var Errors = Ember.ObjectProxy.extend(Ember.Copyable, {

  init: function() {
    this._super.apply(this, arguments);
    if(!get(this, 'content')) set(this, 'content', {});
  },

  /**
    Iterate over all the fields and their corresponding errors.
    Calls the function once for each key, passing in the key and error message.

    @method forEach
    @param {Function} callback
    @param {*} self if passed, the `this` value inside the
      callback. By default, `this` is the map.
  */
  forEach: function(callback, self) {
    var keys = Ember.keys(this.content);

    keys.forEach(function(key) {
      var value = get(this.content, key);
      callback.call(self, key, value);
    }, this);
  },

  copy: function() {
    return Errors.create({
      content: copy(this.content)
    });
  }

});

export default Errors;