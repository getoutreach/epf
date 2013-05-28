var get = Ember.get, set = Ember.set;
var once = Ember.run.once;
var forEach = Ember.EnumerableUtils.forEach;

Ep.ModelArrayManager = Ember.Object.extend({

  init: function() {
    this.modelMap = Ember.MapWithDefault.create({
      defaultValue: function() { return Ember.A([]); }
    });
  },

  register: function(array, model) {
    var arrays = this.modelMap.get(get(model, 'clientId'));
    arrays.pushObject(array);
  },

  unregister: function(array, model) {
    var arrays = this.modelMap.get(get(model, 'clientId'));
    arrays.removeObject(array);
    if(arrays.length === 0) {
      this.modelMap.remove(get(model, 'clientId'));
    }
  },

  modelWasDeleted: function(model) {
    var arrays = this.modelMap.get(get(model, 'clientId'));
    arrays.forEach(function(array) {
      array.removeObject(model);
    });
  }

});