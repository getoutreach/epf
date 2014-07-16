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
    this.addPromise(model, Ember.RSVP.resolve(model));
  },

  addPromise: function(model, promise) {
    this._data[get(model, 'clientId')] = promise;
  },

  getPromise: function(model) {
    Ember.assert("Model does not have a client id", get(model, 'clientId'));
    return this._data[get(model, 'clientId')];
  }

});