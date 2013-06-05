require('../adapter');

var get = Ember.get, set = Ember.set;

Ep.LocalAdapter = Ep.Adapter.extend({

  // Dummy serializer for now since mapping logic assumes existence
  serializer: Ep.Serializer.create(),

  load: function(type, id) {
    var cached = this.store.getForId(type, id);
    return Ember.RSVP.resolve(cached);
  },

  // TODO: find

  refresh: function(model) {
    var cached = this.store.getModel(model);
    return Ember.RSVP.resolve(cached); 
  },

  flush: function(session) {
    // TODO: do actual diffs here
    var models = get(session, 'dirtyModels');
    var merges = models.map(function(model) {
      return this.store.merge(model);
    }, this);
    return Ember.RSVP.resolve(merges);
  }


  // TODO: remoteApply

});