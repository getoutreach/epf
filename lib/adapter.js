var get = Ember.get, set = Ember.set, merge = Ember.merge;

require('./mappable');

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your serializer " + this.toString() + " does not implement the required method " + name);
  };
}

Orm.Adapter = Ember.Object.extend(DS._Mappable, {

  init: function() {
    this._super.apply(this, arguments);
    this.cache = Orm.ModelCache.create();

    this._attributesMap = this.createInstanceMapFor('attributes');
    this._configurationsMap = this.createInstanceMapFor('configurations');
  },

  newSession: function() {
    var session = this.container.lookup('session:base');
    set(session, 'adapter', this);
    this.store.registerSession(session);
    return session;
  },

  sessionWasDestroyed: function() {
    this.store.unregisterSession(session);
  },

  load: mustImplement("load"),

  find: mustImplement("find"),

  refresh: mustImplement("refresh"),

  flush: mustImplement("flush"),

  loaded: function(model) {
    this.store.merge(model);
  },

  deleted: function(model) {
    // TODO: how to treat deleted relations?
    this.store.remove(model);
  },

  // TODO: think about embedded, maybe add _parent to model?
  dirtyType: function(model) {
    if(get(model, 'isNew')) {
      return "created";
    } else if(get(model, 'isDeleted')) {
      return "deleted";
    } else if(this.isDirty(model)) {
      return "updated";
    }
  },

  isDirty: function(model) {
    var cached = this.store.getForId(model.constructor, get(model, 'id'));
    var diff = model.diff(cached);
    var dirty = false;
    var relDiff = [];
    for(var i = 0; i < diff.length; i++) {
      var d = diff[i];
      if(d.type == 'attr') {
        dirty = true;
      } else {
        relDiff.push(d);
      }
    }
    return dirty || this.isDirtyFromRelationships(model, cached, relDiff);
  },

  isDirtyFromRelationships: function(model, cached, relDiff) {
    // This can be overridden in the adapter sub-classes
    return relDiff.length > 0;
  }

});

Orm.Adapter.reopenClass({
  registerTransform: function(attributeType, transform) {
    var registeredTransforms = this._registeredTransforms || {};

    registeredTransforms[attributeType] = transform;

    this._registeredTransforms = registeredTransforms;
  },

  registerEnumTransform: function(attributeType, objects) {
    var registeredEnumTransforms = this._registeredEnumTransforms || {};

    registeredEnumTransforms[attributeType] = objects;

    this._registeredEnumTransforms = registeredEnumTransforms;
  },

  map: DS._Mappable.generateMapFunctionFor('attributes', function(key, newValue, map) {
    var existingValue = map.get(key);

    merge(existingValue, newValue);
  }),

  configure: DS._Mappable.generateMapFunctionFor('configurations', function(key, newValue, map) {
    var existingValue = map.get(key);

    // If a mapping configuration is provided, peel it off and apply it
    // using the DS.Adapter.map API.
    var mappings = newValue && newValue.mappings;
    if (mappings) {
      this.map(key, mappings);
      delete newValue.mappings;
    }

    merge(existingValue, newValue);
  }),

  resolveMapConflict: function(oldValue, newValue) {
    merge(newValue, oldValue);

    return newValue;
  }
});