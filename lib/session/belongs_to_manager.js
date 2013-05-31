var get = Ember.get, set = Ember.set;

Ep.BelongsToManager = Ember.Object.extend({

  init: function() {
    this.modelMap = Ember.MapWithDefault.create({
      defaultValue: function() { return Ember.A([]); }
    });
  },

  register: function(parent, key, model) {
    var paths = this.modelMap.get(get(model, 'clientId'));
    var path = {parent: parent, key: key};
    paths.pushObject(path);
  },

  unregister: function(parent, key, model) {
    var paths = this.modelMap.get(get(model, 'clientId'));
    var path = paths.find(function(p) { 
      return p.parent.isEqual(parent) && p.key === key;
    });
    paths.removeObject(path);
    if(paths.length === 0) {
      this.modelMap.remove(get(model, 'clientId'));
    }
  },

  modelWasDeleted: function(model) {
    var paths = this.modelMap.get(get(model, 'clientId'));
    paths.forEach(function(path) {
      set(path.parent, path.key, null);
    });
  }

});