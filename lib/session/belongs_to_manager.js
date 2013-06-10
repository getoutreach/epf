var get = Ember.get, set = Ember.set;

Ep.BelongsToManager = Ember.Object.extend({

  init: function() {
    this.modelMap = Ember.MapWithDefault.create({
      defaultValue: function() { return Ember.A([]); }
    });
  },

  register: function(parent, key, model) {
    var paths = this.modelMap.get(get(model, 'clientId'));
    var path = paths.find(function(p) { 
      return p.parent.isEqual(parent) && p.key === key;
    });
    if(path) return;
    path = {parent: parent, key: key};
    paths.pushObject(path);
  },

  unregister: function(parent, key, model) {
    // TODO: use more efficent data structure to avoid loop
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
    // copy since observers will mutate
    var paths = this.modelMap.get(get(model, 'clientId')).copy();
    paths.forEach(function(path) {
      set(path.parent, path.key, null);
    });
  }

});