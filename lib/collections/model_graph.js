require('./model_set');

var get = Ember.get, set = Ember.set;

Ep.ModelGraph = Ember.Object.extend({

  init: function() {
    this.models = Ember.ModelSet.create();
  },

  merge: function(graph, strategy) {
    var models = get(graph, 'models');
    models.forEach(function() {
      this.mergeModel(model, strategy);
    }, this);
    return graph;
  },

  mergeModel: function(model, strategy) {
    model.merge(this, strategy);
  }


});