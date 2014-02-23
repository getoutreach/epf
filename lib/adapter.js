var get = Ember.get, set = Ember.set, merge = Ember.merge;

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your adapter " + this.toString() + " does not implement the required method " + name);
  };
}

var SerializerForMixin = require('./serializers/serializer_for_mixin');

Ep.Adapter = Ember.Object.extend(SerializerForMixin, {
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

    this.container = this.setupContainer(this.container);
  },

  setupContainer: function(container) {
    return container;
  },

  configFor: function(type) {
    var configs = get(this, 'configs'),
        typeKey = get(type, 'typeKey');

    return configs[typeKey] || {};
  },

  newSession: function() {
    var Session = this.container.lookupFactory('session:base');
    session = Session.create({
      adapter: this
    });
    return session;
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

  reifyClientId: function(model) {
    this.idManager.reifyClientId(model);
  }

});
