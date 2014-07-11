import Adapter from '../adapter';
import Serializer from '../serializers/base';

var get = Ember.get, set = Ember.set;

export default Adapter.extend({

  // Dummy serializer for now since mapping logic assumes existence
  serializer: Serializer.create(),

  load: function(type, id) {
    return Ember.RSVP.resolve(null);
  },

  // TODO: find

  refresh: function(model) {
    return Ember.RSVP.resolve(model.copy()); 
  },

  flush: function(session) {
    // TODO: do actual diffs here
    var models = get(session, 'dirtyModels');
    return Ember.RSVP.resolve(models.copy(true)).then(function(models) {
      models.forEach(function(model) {
        session.merge(model);
      });
    });
  }


  // TODO: remoteApply

});