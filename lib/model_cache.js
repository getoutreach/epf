var get = Ember.get, set = Ember.set;

Orm.ModelCache = Ember.Object.extend({

  init: function() {
    this._super.apply(this, arguments);
    // TODO: perf
    this.models = Ember.Set.create();
    this.clientIdMap = Ember.Map.create();
    this.idMaps = Ember.MapWithDefault.create({
      defaultValue: function(type) {
        return Ember.Map.create();
      }
    });
  },

  add: function(model) {
    // TODO how to handle models with same id but different instance?
    // TODO check for === and add merge method?
    // TODO think more about models that don't have ids yet
    this.models.add(model);
    this.clientIdMap.set(get(model, 'clientId'), model);
    if(var id = get(model, 'id')) {
      var idMap = this.idMaps.get(type);
      this.idMap.set(id, model);
    }
  },

  remove: function(model) {
    this.models.remove(model);
    this.clientIdMap.remove(get(model, 'clientId'));
    if(var id = get(model, 'id')) {
      this.idMap.remove(id);
    }
  },

  getForId: function(type, id) {
    var idMap = this.idMaps.get(type);
    this.idMap.get(id);
  },

  getForClientId: function(id) {
    this.clientIdMap.get(id);
  },

});