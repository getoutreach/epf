require('./serializer');
require('./transforms/json_transforms');

/**
  @class JsonSerializer
  @constructor
  @namespace Orm
  @extends Ep.Serializer
*/

var get = Ember.get, set = Ember.set;

Ep.JsonSerializer = Ep.Serializer.extend({
  init: function() {
    this._super.apply(this, arguments);

    if (!get(this, 'transforms')) {
      this.set('transforms', Ep.JsonTransforms);
    }

    this.sideloadMapping = Ember.Map.create();
    this.metadataMapping = Ember.Map.create();

    this.configure({
      meta: 'meta',
      since: 'since'
    });
  },

  configure: function(type, configuration) {
    var key;

    if (type && !configuration) {
      for(key in type){
        this.metadataMapping.set(get(type, key), key);
      }

      return this._super(type);
    }

    var sideloadAs = configuration.sideloadAs,
        sideloadMapping;

    if (sideloadAs) {
      sideloadMapping = this.aliases.sideloadMapping || Ember.Map.create();
      sideloadMapping.set(sideloadAs, type);
      this.aliases.sideloadMapping = sideloadMapping;
      delete configuration.sideloadAs;
    }

    this._super.apply(this, arguments);
  },

  addId: function(data, key, id) {
    data[key] = id;
  },

  /**
    A hook you can use to customize how the key/value pair is added to
    the serialized data.

    @param {any} hash the JSON hash being built
    @param {String} key the key to add to the serialized data
    @param {any} value the value to add to the serialized data
  */
  addAttribute: function(hash, key, value) {
    hash[key] = value;
  },

  extractAttribute: function(type, hash, attributeName) {
    var key = this._keyForAttributeName(type, attributeName);
    return hash[key];
  },

  extractId: function(type, hash) {
    var primaryKey = this._primaryKey(type);

    if (hash.hasOwnProperty(primaryKey)) {
      // Ensure that we coerce IDs to strings so that record
      // IDs remain consistent between application runs; especially
      // if the ID is serialized and later deserialized from the URL,
      // when type information will have been lost.
      return hash[primaryKey]+'';
    } else {
      return null;
    }
  },

  extractClientId: function(type, hash) {
    var clientKey = this._clientKey(type);

    if (hash.hasOwnProperty(clientKey)) {
      // Ensure that we coerce IDs to strings so that record
      // IDs remain consistent between application runs; especially
      // if the ID is serialized and later deserialized from the URL,
      // when type information will have been lost.
      return hash[clientKey]+'';
    } else {
      return null;
    }
  },

  extractHasMany: function(type, hash, key) {
    return hash[key];
  },

  extractBelongsTo: function(type, hash, key) {
    return hash[key];
  },

  extractBelongsToPolymorphic: function(type, hash, key) {
    var keyForId = this.keyForPolymorphicId(key),
        keyForType,
        id = hash[keyForId];

    if (id) {
      keyForType = this.keyForPolymorphicType(key);
      return {id: id, type: hash[keyForType]};
    }

    return null;
  },

  addBelongsTo: function(hash, record, key, relationship) {
    var type = record.constructor,
        name = relationship.key,
        value = null,
        includeType = (relationship.options && relationship.options.polymorphic),
        embeddedChild,
        child,
        id;

    if (this.embeddedType(type, name)) {
      if (embeddedChild = get(record, name)) {
        value = this.serialize(embeddedChild, { includeId: true, includeType: includeType });
      }

      hash[key] = value;
    } else {
      child = get(record, relationship.key);
      id = get(child, 'id');

      if (relationship.options && relationship.options.polymorphic && !Ember.isNone(id)) {
        type = get(child, 'type');
        this.addBelongsToPolymorphic(hash, key, id, type);
      } else {
        hash[key] = id === undefined ? null : this.serializeId(id);
      }
    }
  },

  addBelongsToPolymorphic: function(hash, key, id, type) {
    var keyForId = this.keyForPolymorphicId(key),
        keyForType = this.keyForPolymorphicType(key);
    hash[keyForId] = id;
    hash[keyForType] = this.rootForType(type);
  },

  /**
    Adds a has-many relationship to the JSON hash being built.

    The default REST semantics are to only add a has-many relationship if it
    is embedded. If the relationship was initially loaded by ID, we assume that
    that was done as a performance optimization, and that changes to the
    has-many should be saved as foreign key changes on the child's belongs-to
    relationship.

    @param {Object} hash the JSON being built
    @param {Ep.Model} record the record being serialized
    @param {String} key the JSON key into which the serialized relationship
      should be saved
    @param {Object} relationship metadata about the relationship being serialized
  */

  addHasMany: function(hash, record, key, relationship) {
    var type = record.constructor,
        name = relationship.key,
        serializedHasMany = [],
        includeType = (relationship.options && relationship.options.polymorphic),
        manyArray, embeddedType;

    // If the has-many is not embedded, there is nothing to do.
    embeddedType = this.embeddedType(type, name);
    if (embeddedType !== 'always') { return; }

    // Get the Ep.ManyArray for the relationship off the record
    manyArray = get(record, name);

    // Build up the array of serialized records
    manyArray.forEach(function (record) {
      serializedHasMany.push(this.serialize(record, { includeId: true, includeType: includeType }));
    }, this);

    // Set the appropriate property of the serialized JSON to the
    // array of serialized embedded records
    hash[key] = serializedHasMany;
  },

  addType: function(hash, type) {
    var keyForType = this.keyForEmbeddedType();
    hash[keyForType] = this.rootForType(type);
  },

  // EXTRACTION

  deserialize: function(data) {
    // TODO: deletion?
    var result = [];

    for (var prop in data) {
      if (!data.hasOwnProperty(prop) ||
          !!this.metadataMapping.get(prop)) {
        continue;
      }

      var type = this.typeFromAlias(prop);
      Ember.assert("Your server returned a hash with the key " + prop + " but you have no mapping for it", !!type);

      var value = data[prop];
      if (value instanceof Array) {
        for (var i=0; i < value.length; i++) {
          result.push(this.deserializeModel(type, value[i]));
        }
      } else {
        result.push(this.deserializeModel(type, value));
      }
    }

    return result;
  },

  extractMeta: function(type, json) {
    var meta = this.configOption(type, 'meta'),
        data = json, value;

    if(meta && json[meta]){
      data = json[meta];
    }

    var result = {};

    this.metadataMapping.forEach(function(property, key){
      if(value = data[property]){
        result[key] = value;
      }
    });

    return result;
  },

  extractEmbeddedType: function(relationship, data) {
    var foundType = relationship.type;
    if(relationship.options && relationship.options.polymorphic) {
      var key = this.keyFor(relationship),
          keyForEmbeddedType = this.keyForEmbeddedType(key);

      foundType = this.typeFromAlias(data[keyForEmbeddedType]);
      delete data[keyForEmbeddedType];
    }

    return foundType;
  },

  /**
    @private

    Configures possible sideload mappings for the types related to a
    particular model. This recursive method ensures that sideloading
    works for related models as well.

    @param {Ep.Model subclass} type
    @param {Ember.A} configured an array of types that have already been configured
  */
  configureSideloadMappingForType: function(type, configured) {
    if (!configured) {configured = Ember.A([]);}
    configured.pushObject(type);

    type.eachRelatedType(function(relatedType) {
      if (!configured.contains(relatedType)) {
        var root = this.defaultSideloadRootForType(relatedType);
        this.aliases.set(root, relatedType);

        this.configureSideloadMappingForType(relatedType, configured);
      }
    }, this);
  },

  /**
    A hook you can use in your serializer subclass to customize
    how a polymorphic association's name is converted into a key for the id.

    @param {String} name the association name to convert into a key

    @returns {String} the key
  */
  keyForPolymorphicId: Ember.K,

  /**
    A hook you can use in your serializer subclass to customize
    how a polymorphic association's name is converted into a key for the type.

    @param {String} name the association name to convert into a key

    @returns {String} the key
  */
  keyForPolymorphicType: Ember.K,

  /**
    A hook you can use in your serializer subclass to customize
    the key used to store the type of a record of an embedded polymorphic association.

    By default, this method returns 'type'.

    @returns {String} the key
  */
  keyForEmbeddedType: function() {
    return 'type';
  },

  // HELPERS

  /**
    @private

    Determines the singular root name for a particular type.

    This is an underscored, lowercase version of the model name.
    For example, the type `App.UserGroup` will have the root
    `user_group`.

    @param {Ep.Model subclass} type
    @returns {String} name of the root element
  */
  rootForType: function(type) {
    var typeString = type.toString();

    Ember.assert("Your model must not be anonymous. It was " + type, typeString.charAt(0) !== '(');

    // use the last part of the name as the URL
    var parts = typeString.split(".");
    var name = parts[parts.length - 1];
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1);
  },

  /**
    @private

    The default root name for a particular sideloaded type.

    @param {Ep.Model subclass} type
    @returns {String} name of the root element
  */
  defaultSideloadRootForType: function(type) {
    return this.pluralize(this.rootForType(type));
  }
});
