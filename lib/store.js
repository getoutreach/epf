var get = Ember.get, set = Ember.set;

require('./session')

var uuid = 1;

/**
  Unlike ember-data, the store is relatively lightweight.

  The store is a read-only model cache that is the client's
  understanding of what it has received from the server.
*/
Ep.Store = Ember.Object.extend(Ep.SessionMixin, {

  init: function() {
    this._super();
    this.sessions = Ember.Set.create();
    this._super.apply(this, arguments);
    this.idMaps = Ember.MapWithDefault.create({
      defaultValue: function(type) {
        return Ember.Map.create();
      }
    });
  },

  registerSession: function(session) {
    this.sessions.add(session);
  },

  unregisterSession: function(session) {
    this.sessions.remove(session);
  },
  
  // TODO: notify live sessions on add/remove


  /**
    Three possible cases:

    1. The model already has a clientId and an id.
       Make sure the clientId maps to the id.

    2. The model has no id or clientId. The model must be a new
       record. Generate a clientId and set on the model.

    3. The model has and id but no clientId. Generate a new clientId
       update the mapping, and assign it to the model.
  */
  reifyClientId: function(model) {
    var id = get(model, 'id'),
        clientId = get(model, 'clientId'),
        type = get(model, 'type'),
        idMap = this.idMaps.get(type);

    if(id && clientId) {
      var existingClientId = idMap.get(id);
      Ember.assert("clientId has changed for " + model.toString(), !existingClientId || existingClientId === clientId);
      if(!existingClientId) {
        idMap.set(id, clientId);
      }
    } else if(!clientId) {
      if(id) {
        clientId = idMap.get(id);
      }
      if(!clientId) {
        clientId = this._generateClientId(type);
      }
      set(model, 'clientId', clientId);
      idMap.set(id, clientId);
    } // else NO-OP, nothing to do if they already have a clientId and no id
    return clientId;
  },

  getClientId: function(type, id) {
    var idMap = this.idMaps.get(type);
    return idMap.get(id);
  },

  _generateClientId: function(type) {
    return this._typeToString(type) + (uuid++);
  },

  _typeToString: function(type) {
    return type.toString().split(".")[1].underscore();
  },

  getForId: function(type, id) {
    debugger
    var clientId = this.getClientId(type, id);
    return this.models.getForClientId(clientId);
  }
});