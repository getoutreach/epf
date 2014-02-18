var get = Ember.get, set = Ember.set;

function extractPropertyHook(name) {
  return function(type, hash) {
    return this.extractProperty(type, hash, name);
  };
}


Ep.JsonSerializer.reopen({

  deserialize: function(type, hash) {
    var model = this.createModel(type);
    set(model, 'id', this.extractId(type, hash));
    set(model, 'clientId', this.extractClientId(type, hash));
    set(model, 'rev', this.extractRevision(type, hash));
    set(model, 'clientRev', this.extractClientRevision(type, hash));

    this.deserializeAttributes(model, hash);
    this.deserializeRelationships(model, hash);

    return model;
  },

  createModel: function(type) {
    return type.create();
  },

  extractProperty: function(type, hash, name) {
    var key = this.keyFor(name, type);
    return hash[key];
  },

  extractId: function(type, hash) {
    var key = this.keyFor('id', type);
    if(hash.hasOwnProperty(key)) {
      // Ensure that we coerce IDs to strings so that record
      // IDs remain consistent between application runs; especially
      // if the ID is serialized and later deserialized from the URL,
      // when type information will have been lost.
      return hash[key] + '';
    } else {
      return null;
    }
  },

  extractClientId: extractPropertyHook('clientId'),
  extractRevision: extractPropertyHook('rev'),
  extractClientRevision: extractPropertyHook('clientRev'),

  deserializeAttributes: function(model, hash) {
    model.eachAttribute(function(name, attribute) {
      set(model, name, this.extractAttribute(model, hash, name, attribute));
    }, this);
  },

  extractAttribute: function(model, hash, name, attribute) {
    var key = this.keyFor(name, get(model, 'type'));
    return this.deserializeValue(hash[key], attribute.type);
  },

  deserializeValue: function(value, attributeType) {
    if(attributeType) {
      var transform = this.transformFor(attributeType);

      Ember.assert("You tried to use a attribute type (" + attributeType + ") that has not been registered", transform);
      return transform.deserialize(value);
    }
    return value;
  },

  deserializeRelationships: function(model, hash) {
    model.eachRelationship(function(name, relationship) {
      if (relationship.kind === 'hasMany') {
        this.deserializeHasMany(name, model, hash, relationship);
      } else if (relationship.kind === 'belongsTo') {
        this.deserializeBelongsTo(name, model, hash, relationship);
      }
    }, this);
  },

  deserializeHasMany: function(name, model, data, relationship) {
    var type = get(model, 'type'),
        key = this.keyForHasMany(name, type),
        embeddedType = this.embeddedType(type, name),
        value = this.extractHasMany(type, data, key);

    if(embeddedType) {
      this.deserializeEmbeddedHasMany(name, model, value, relationship);
    } else { // non-embedded
      this.deserializeLazyHasMany(name, model, value, relationship);
    }
  },

  deserializeEmbeddedHasMany: function(name, model, values, relationship) {
    // no-op if null
    if(!values) {
      return;
    }
    get(model, name).pushObjects(values.map(function(data) {
      var type = this.extractEmbeddedType(relationship, data);
      return this.deserialize(type, data);
    }, this));
  },

  deserializeLazyHasMany: function(name, model, values, relationship) {
    // no-op if null
    if(!values) {
      return;
    }
    get(model, name).pushObjects(values.map(function(value) {
      return Ep.LazyModel.create({
        // TODO: coerce to string in a better location
        id: value && value.toString(),
        type: relationship.type
      });
    }, this));
  },

  deserializeBelongsTo: function(name, model, hash, relationship) {
    var type = get(model, 'type'),
        key = this.keyForBelongsTo(name, type),
        embeddedType = this.embeddedType(type, name),
        value;

    if(embeddedType) {
      if(relationship.options && relationship.options.polymorphic) {
        value = this.extractBelongsToPolymorphic(type, hash, key);
      } else {
        value = this.extractBelongsTo(type, hash, key);
      }
      this.deserializeEmbeddedBelongsTo(name, model, value, relationship);
    } else {
      value = this.extractBelongsTo(type, hash, key);
      this.deserializeLazyBelongsTo(name, model, value, relationship);
    }
  },

  deserializeEmbeddedBelongsTo: function(name, model, value, relationship) {
    // no-op if null
    if(!value) {
      return;
    }
    var type = this.extractEmbeddedType(relationship, value);
    var child = this.deserialize(type, value);
    set(model, name, child);
  },

  deserializeLazyBelongsTo: function(name, model, value, relationship) {
    // no-op if null
    if(!value) {
      return;
    }
    set(model, name, Ep.LazyModel.create({
      // TODO: coerce to string in a better location
      id: value && value.toString(),
      type: relationship.type
    }));
  },

  /**
    A hook you can use to customize how the record's type is extracted from
    the serialized data.

    The `extractEmbeddedType` hook is called with:

    * the serialized representation being built
    * the serialized id (after calling the `serializeId` hook)

    By default, it returns the type of the relationship.

    @method extractEmbeddedType
    @param {Object} relationship an object representing the relationship
    @param {any} data the serialized representation that is being built
  */
  extractEmbeddedType: function(relationship, data) {
    var foundType = relationship.type;
    if(relationship.options && relationship.options.polymorphic) {
      var key = this.keyForRelationship(relationship),
          keyForEmbeddedType = this.keyForEmbeddedType(key);

      foundType = this.typeFromAlias(data[keyForEmbeddedType]);
      delete data[keyForEmbeddedType];
    }

    return foundType;
  },

  extractHasMany: Ember.aliasMethod('extractProperty'),
  extractBelongsTo: Ember.aliasMethod('extractProperty')

});