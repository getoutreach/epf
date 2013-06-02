var get = Ember.get, set = Ember.set, merge = Ember.merge;

require('./mixins/mappable');

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your serializer " + this.toString() + " does not implement the required method " + name);
  };
}

Ep.Adapter = Ember.Object.extend(Ep._Mappable, {

  init: function() {
    this._super.apply(this, arguments);
  },

  newSession: function() {
    var session = this.container.lookup('session:base');
    set(session, 'adapter', this);
    set(session, 'store', this.store);
    this.store.registerSession(session);
    return session;
  },

  sessionWasDestroyed: function() {
    this.store.unregisterSession(session);
  },

  /**
    The serializer is injected by the container.
    TODO: clean up this shared configuration logic
  */
  serializer: Ember.computed(function(key, serializer) {
    this._attributesMap = this.createInstanceMapFor('attributes');
    this._configurationsMap = this.createInstanceMapFor('configurations');

    this.registerSerializerTransforms(this.constructor, serializer, {});
    this.registerSerializerMappings(serializer);
    return serializer;
  }),

  load: mustImplement("load"),

  find: mustImplement("find"),

  // TODO: reload (from server) and refresh from store?
  refresh: mustImplement("refresh"),

  flush: mustImplement("flush"),

  remoteCall: function(context, name) {
    var args = [].slice.call(arguments, 2, -1);
    this.remoteApply(context, name, args);
  },

  remoteApply: mustImplement("remoteApply"),

  loaded: function(model) {
    this.store.merge(model);
  },

  deleted: function(model) {
    // TODO: how to treat deleted relations?
    this.store.remove(model);
  },

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
    var cached = this.store.getModel(model);
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
  },

  /**
    @private

    This method recursively climbs the superclass hierarchy and
    registers any class-registered transforms on the adapter's
    serializer.

    Once it registers a transform for a given type, it ignores
    subsequent transforms for the same attribute type.

    @method registerSerializerTransforms
    @param {Class} klass the DS.Adapter subclass to extract the
      transforms from
    @param {DS.Serializer} serializer the serializer to register
      the transforms onto
    @param {Object} seen a hash of attributes already seen
  */
  registerSerializerTransforms: function(klass, serializer, seen) {
    var transforms = klass._registeredTransforms, superclass, prop;
    var enumTransforms = klass._registeredEnumTransforms;

    for (prop in transforms) {
      if (!transforms.hasOwnProperty(prop) || prop in seen) { continue; }
      seen[prop] = true;

      serializer.registerTransform(prop, transforms[prop]);
    }

    for (prop in enumTransforms) {
      if (!enumTransforms.hasOwnProperty(prop) || prop in seen) { continue; }
      seen[prop] = true;

      serializer.registerEnumTransform(prop, enumTransforms[prop]);
    }

    if (superclass = klass.superclass) {
      this.registerSerializerTransforms(superclass, serializer, seen);
    }
  },

  /**
    @private

    This method recursively climbs the superclass hierarchy and
    registers any class-registered mappings on the adapter's
    serializer.

    @method registerSerializerMappings
    @param {Class} klass the DS.Adapter subclass to extract the
      transforms from
    @param {DS.Serializer} serializer the serializer to register the
      mappings onto
  */
  registerSerializerMappings: function(serializer) {
    var mappings = this._attributesMap,
        configurations = this._configurationsMap;

    mappings.forEach(serializer.map, serializer);
    configurations.forEach(serializer.configure, serializer);
  }

});

Ep.Adapter.reopenClass({
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

  map: Ep._Mappable.generateMapFunctionFor('attributes', function(key, newValue, map) {
    var existingValue = map.get(key);

    merge(existingValue, newValue);
  }),

  configure: Ep._Mappable.generateMapFunctionFor('configurations', function(key, newValue, map) {
    var existingValue = map.get(key);

    // If a mapping configuration is provided, peel it off and apply it
    // using the Ep.Adapter.map API.
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