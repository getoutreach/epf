var get = Ember.get, set = Ember.set, merge = Ember.merge;

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your adapter " + this.toString() + " does not implement the required method " + name);
  };
}

import SerializerForMixin from './serializers/serializer_for_mixin';

export default Ember.Object.extend(SerializerForMixin, {
  mergedProperties: ['configs'],

  init: function() {
    this._super.apply(this, arguments);
    this.configs = {};
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
    return Session.create({
      adapter: this
    });
  },

  load: mustImplement("load"),

  query: mustImplement("find"),

  refresh: mustImplement("refresh"),

  flush: mustImplement("flush"),

  remoteCall: mustImplement("remoteCall"),

  serialize: function(model, opts) {
    return this.serializerForModel(model).serialize(model, opts);
  },

  deserialize: function(typeKey, data, opts) {
    return this.serializerFor(typeKey).deserialize(data, opts);
  },

  merge: function(model, session) {
    if(!session) {
      session = this.container.lookup('session:main');
    }
    return session.merge(model);
  },

  mergeData: function(data, typeKey, session) {
    if(!typeKey) {
      typeKey = this.defaultSerializer;
    }

    var serializer = this.serializerFor(typeKey),
        deserialized = serializer.deserialize(data);

    if(get(deserialized, 'isModel')) {
      return this.merge(deserialized, session);
    } else {
      return Ember.EnumerableUtils.map(deserialized, function(model) {
        return this.merge(model, session);
      }, this);
    }
  },

  mergeError: Ember.aliasMethod('mergeData'),

  willMergeModel: Ember.K,

  didMergeModel: Ember.K,

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
