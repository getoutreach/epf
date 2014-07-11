var get = Ember.get, set = Ember.set;

export default Ember.Object.extend({

  init: function() {
    this.modelMap = Ember.MapWithDefault.create({
      defaultValue: function() { return Ember.A([]); }
    });
  },

  register: function(array, model) {
    var arrays = this.modelMap.get(get(model, 'clientId'));
    if(arrays.contains(array)) return;
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
    // copy since the observers will mutate
    var arrays = this.modelMap.get(get(model, 'clientId')).copy();
    arrays.forEach(function(array) {
      array.removeObject(model);
    });
  }

});