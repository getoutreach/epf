var get = Ember.get, set = Ember.set;

/**
  Unlike ember-data, the store is a lightweight wrapper
  around a model cache that is session-aware. Only adapters
  are explicitly aware of the store.
*/
Orm.Store = Ember.Object.extend({

  init: function() {
    this._super();
    this.sessions = Ember.Set.create();
    this.cache = Orm.ModelCache.create();
    // TODO: map to map models to sessions?
  },

  registerSession: function(session) {
    this.sessions.add(session);
  },

  unregisterSession: function(session) {
    this.sessions.remove(session);
  },

  getModel: function(type, id) {
    return this.cache.getForId(type, id);
  },

  load: function(model) {
    cache.add(model);
    // TODO: notify all live sessions
  },

  remove: function(model) {
    cache.remove(model);
    // TODO: notify all live sessions
  }

});