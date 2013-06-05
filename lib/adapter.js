var get = Ember.get, set = Ember.set, merge = Ember.merge;

require('./mixins/mappable');

function mustImplement(name) {
  return function() {
    throw new Ember.Error("Your serializer " + this.toString() + " does not implement the required method " + name);
  };
}

var uuid = 1;

Ep.Adapter = Ember.Object.extend(Ep._Mappable, {

  init: function() {
    this._super.apply(this, arguments);
    // TODO: this should be shared by all adapters
    this.idMaps = Ember.MapWithDefault.create({
      defaultValue: function(type) {
        return Ember.Map.create();
      }
    });
  },

  newSession: function() {
    var session = this.container.lookup('session:base');
    set(session, 'adapter', this);
    return session;
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

  findQuery: mustImplement("find"),

  refresh: mustImplement("refresh"),

  flush: mustImplement("flush"),

  remoteCall: mustImplement("remoteCall"),

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
    var session = get(model, 'session');
    var cached = session.shadows.getModel(model);
    if(!cached) return false;
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
  },

  /**
    Three possible cases:

    1. The model already has a clientId and an id.
       Make sure the clientId maps to the id.

    2. The model has no id or clientId. The model must be a new
       record. Generate a clientId and set on the model.

    3. The model has and id but no clientId. Generate a new clientId
       update the mapping, and assign it to the model.
  */
  reifyClientId: function(model) {
    var id = get(model, 'id'),
        clientId = get(model, 'clientId'),
        type = get(model, 'type'),
        idMap = this.idMaps.get(type);

    if(id && clientId) {
      var existingClientId = idMap.get(id);
      Ember.assert("clientId has changed for " + model.toString(), !existingClientId || existingClientId === clientId);
      if(!existingClientId) {
        idMap.set(id, clientId);
      }
    } else if(!clientId) {
      if(id) {
        clientId = idMap.get(id);
      }
      if(!clientId) {
        clientId = this._generateClientId(type);
      }
      set(model, 'clientId', clientId);
      idMap.set(id, clientId);
    } // else NO-OP, nothing to do if they already have a clientId and no id
    return clientId;
  },

  getClientId: function(type, id) {
    var idMap = this.idMaps.get(type);
    return idMap.get(id);
  },

  _generateClientId: function(type) {
    return this._typeToString(type) + (uuid++);
  },

  _typeToString: function(type) {
    return type.toString().split(".")[1].underscore();
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