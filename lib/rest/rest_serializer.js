require('../serializer');

/**
  @class RestSerializer
  @constructor
  @namespace Orm
  @extends Ep.JsonSerializer
*/

var get = Ember.get;

Ep.RestSerializer = Ep.JsonSerializer.extend({

  metaKey: 'meta',

  /**
    Deserializes an entire rest payload, possibly consisting
    of many models.

    @method deserializePayload
    @param hash the serialized representation of the payload
    @param {context} the context for the deserialization (e.g. a model type, instance, or id)
    @return Ep.RestPayload the deserialized payload
  */
  deserializePayload: function(hash, context) {
    var result = [],
        metaKey = get(this, 'metaKey');

    for (var prop in hash) {
      if (!hash.hasOwnProperty(prop) ||
          prop === metaKey) {
        continue;
      }

      var type = this.typeFor(prop);
      Ember.assert("Your server returned a hash with the key " + prop + " but has no corresponding type.", !!type);

      var value = hash[prop];
      if (value instanceof Array) {
        for (var i=0; i < value.length; i++) {
          result.push(this.deserialize(type, value[i]));
        }
      } else {
        result.push(this.deserialize(type, value));
      }
    }

    return result;
  },

  keyForBelongsTo: function(name, type) {
    var key = this._super(name, type);

    if (this.embeddedType(type, name)) {
      return key;
    }

    return key + "_id";
  },

  keyForHasMany: function(name, type) {
    var key = this._super(name, type);

    if (this.embeddedType(type, name)) {
      return key;
    }

    return this.singularize(key) + "_ids";
  },

  keyForPolymorphicId: function(key) {
    return key;
  },

  keyForPolymorphicType: function(key) {
    return key.replace(/_id$/, '_type');
  },

  extractValidationErrors: function(type, json) {
    var errors = {};

    get(type, 'attributes').forEach(function(name) {
      var key = this.keyFor(name, type);
      if (json['errors'].hasOwnProperty(key)) {
        errors[name] = json['errors'][key];
      }
    }, this);

    return errors;
  }
});
