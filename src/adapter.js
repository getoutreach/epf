var get = Ember.get, set = Ember.set, merge = Ember.merge;

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your adapter " + this.toString() + " does not implement the required method " + name);
  };
}

import BaseClass from './utils/base_class';
import SerializerFactory from './factories/serializer';
import Session from './session/session';

export default class Adapter extends BaseClass {

  constructor() {
    this.configs = {};
    this.container = this.setupContainer(this.container);
    this.serializerFactory = new SerializerFactory(this.container);
  }

  setupContainer(container) {
    return container;
  }

  configFor(type) {
    var configs = this.configs,
        typeKey = get(type, 'typeKey');

    return configs[typeKey] || {};
  }

  newSession() {
    return new Session({
      adapter: this,
      idManager: this.idManager,
      container: this.container
    });
  }

  serialize(model, opts) {
    return this.serializerFactory.serializerForModel(model).serialize(model, opts);
  }

  deserialize(typeKey, data, opts) {
    return this.serializerFor(typeKey).deserialize(data, opts);
  }

  serializerFor(typeKey) {
    return this.serializerFactory.serializerFor(typeKey);
  }

  merge(model, session) {
    if(!session) {
      session = this.container.lookup('session:main');
    }
    return session.merge(model);
  }

  mergeData(data, typeKey, session) {
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
  }

  // This can be overridden in the adapter sub-classes
  isDirtyFromRelationships(model, cached, relDiff) {
    return relDiff.length > 0;
  }

  shouldSave(model) {
    return true;
  }

  reifyClientId(model) {
    this.idManager.reifyClientId(model);
  }

}

Adapter.reopen({

  mergeError: Ember.aliasMethod('mergeData'),

  willMergeModel: Ember.K,

  didMergeModel: Ember.K,

  load: mustImplement("load"),

  query: mustImplement("find"),

  refresh: mustImplement("refresh"),

  flush: mustImplement("flush"),

  remoteCall: mustImplement("remoteCall"),

});
