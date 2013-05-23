var get = Ember.get, set = Ember.set;

Orm.ModelCache = Ember.Object.extend({

  init: function() {
    this._super();
    this.idMap = Ember.Map.create();
    this.clientIdMap = Ember.Map.create();
  },

  add: function(model) {
    this.clientIdMap.set(get(model, 'clientId'), model);
    if(var id = get(model, 'id')) {
      this.idMap.set(id, model);
    }
  },

  remove: function(model) {
    this.clientIdMap.remove(get(model, 'clientId'));
    if(var id = get(model, 'id')) {
      this.idMap.remove(id);
    }
  },

  getForId: function(id) {
    this.idMap.get(id);
  },

  getForClientId: function(id) {
    this.clientIdMap.get(id);
  }

});