var get = Ember.get, set = Ember.set;

require('./session')

/**
  Unlike ember-data, the store is relatively lightweight.

  The store is a read-only model cache that is the client's
  understanding of what it has received from the server.
*/
Orm.Store = Ember.Object.extend(Orm.SessionMixin, {

  init: function() {
    this._super();
    this.sessions = Ember.Set.create();
  },

  registerSession: function(session) {
    this.sessions.add(session);
  },

  unregisterSession: function(session) {
    this.sessions.remove(session);
  }

  // TODO: notify live sessions on add/remove

});