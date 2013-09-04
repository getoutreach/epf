var get = Ember.get, set = Ember.set, merge = Ember.merge;

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your serializer " + this.toString() + " does not implement the required method " + name);
  };
}

var uuid = 1;

Ep.Adapter = Ember.Object.extend({
  mergedProperties: ['configs'],

  init: function() {
    this._super.apply(this, arguments);
    this.configs = {};
    // TODO: this should be shared by all adapters
    this.idMaps = Ember.MapWithDefault.create({
      defaultValue: function(type) {
        return Ember.Map.create();
      }
    });
  },

  configFor: function(type) {
    var configs = get(this, 'configs'),
        typeKey = get(type, 'typeKey');

    return configs[typeKey] || {};
  },

  newSession: function() {
    var session = this.container.lookup('session:base');
    set(session, 'adapter', this);
    return session;
  },

  serializerFor: function(type) {
    // TODO: move this to a custom resolver
    return this.container.lookup('serializer:' + type) ||
           this.container.lookup('serializer:main');
  },

  load: mustImplement("load"),

  query: mustImplement("find"),

  refresh: mustImplement("refresh"),

  flush: mustImplement("flush"),

  remoteCall: mustImplement("remoteCall"),

  // This can be overridden in the adapter sub-classes
  isDirtyFromRelationships: function(model, cached, relDiff) {
    return relDiff.length > 0;
  },

  shouldSave: function(model) {
    return true;
  },

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
    return get(type, 'typeKey') + (uuid++);
  }

});