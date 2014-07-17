var get = Ember.get, set = Ember.set;

/**
  Maintains a cache of model-related promises
*/
export default Ember.Object.extend({

  _data: null,

  init: function() {
    this._data = {};
  },

  addModel: function(model) {
    // for now we only add the model if some attributes are loaded,
    // eventually this will be on a per-attribute basis
    if(model.anyPropertiesLoaded()) {
      this.addPromise(model, Ember.RSVP.resolve());
    }
  },

  addPromise: function(model, promise) {
    this._data[get(model, 'clientId')] = promise;
  },

  getPromise: function(model) {
    Ember.assert("Model does not have a client id", get(model, 'clientId'));
    return this._data[get(model, 'clientId')];
  }

});