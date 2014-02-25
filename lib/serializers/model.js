var get = Ember.get, set = Ember.set;

var EmbeddedHelpersMixin = require('../rest/embedded_helpers_mixin')

Ep.ModelSerializer = Ep.Serializer.extend(EmbeddedHelpersMixin, {
  mergedProperties: ['properties'],

  /**
    Specifies configurations for individual properties.

    For example:

    ```
    App.PostSerializer = Epf.JsonSerializer.extend({
      properties: {
        title: {
          key: 'TITLE1'
        }
      }
    });
    ```

    @property properties
  */
  properties: {},

  /**
    @private
    Used to cache key to property mappings
  */
  _keyCache: null,

  /**
    @private
    Used to cache property name to key mappings
  */
  _nameCache: null,

  init: function() {
    this._super();
    this._keyCache = {};
    this._nameCache = {};
  },

  /**
    @private

    Looks up the property name corresponding to the
    given key.
  */
  nameFor: function(key) {
    var name;
    if(name = this._nameCache[key]) {
      return name;
    }
    var configs = get(this, 'properties');
    for(var currentName in configs) {
      var current = configs[name];
      var keyName = current.key;
      if(keyName && key === keyName) {
        name = currentName;
      }
    }
    name = name || Ember.String.camelize(key);
    this._nameCache[key] = name;
    return name;
  },

  configFor: function(name) {
    return this.properties[name] || {};
  },

  keyFor: function(name, type, opts) {
    var key;
    if(key = this._keyCache[name]) {
      return key;
    }

    var config = this.configFor(name);
    key = config.key || this.keyForType(name, type, opts);
    this._keyCache[name] = key;
    return key;
  },

  keyForType: function(name, type, opts) {
    return Ember.String.underscore(name);
  },

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
    return get(type, 'typeKey');
  },

  serialize: function(model) {
    var serialized = {};

    this.addMeta(serialized, model);
    this.addAttributes(serialized, model);
    this.addRelationships(serialized, model);

    return serialized;
  },

  addMeta: function(serialized, model) {
    this.addProperty(serialized, model, 'id', 'id');
    this.addProperty(serialized, model, 'clientId', 'string');
    this.addProperty(serialized, model, 'rev', 'revision');
    this.addProperty(serialized, model, 'clientRev', 'revision');
  },

  addAttributes: function(serialized, model) {
    model.eachAttribute(function(name, attribute) {
      this.addProperty(serialized, model, name, attribute.type);
    }, this);
  },

  addRelationships: function(serialized, model) {
    model.eachRelationship(function(name, relationship) {
      var config = this.configFor(name),
          opts = {typeKey: relationship.typeKey, embedded: config.embedded};
      this.addProperty(serialized, model, name, relationship.kind, opts);
    }, this);
  },

  addProperty: function(serialized, model, name, type, opts) {
    var key = this.keyFor(name, type, opts),
        value = get(model, name),
        serializer;
        
    if(type) {
      serializer = this.serializerFor(type);
    }
    if(serializer) {
      value = serializer.serialize(value, opts);
    }
    if(value !== undefined) {
      serialized[key] = value;
    }
  },

  deserialize: function(hash) {
    var model = this.createModel();

    this.extractMeta(model, hash);
    this.extractAttributes(model, hash);
    this.extractRelationships(model, hash);

    return model;
  },

  extractMeta: function(model, hash) {
    this.extractProperty(model, hash, 'id', 'id');
    this.extractProperty(model, hash, 'clientId', 'string');
    this.extractProperty(model, hash, 'rev', 'revision');
    this.extractProperty(model, hash, 'clientRev', 'revision');
    this.extractProperty(model, hash, 'errors', 'errors');
    this.idManager.reifyClientId(model);
  },

  extractAttributes: function(model, hash) {
    model.eachAttribute(function(name, attribute) {
      this.extractProperty(model, hash, name, attribute.type);
    }, this);
  },

  extractRelationships: function(model, hash) {
    model.eachRelationship(function(name, relationship) {
      var config = this.configFor(name),
          opts = {typeKey: relationship.typeKey, embedded: config.embedded};
      this.extractProperty(model, hash, name, relationship.kind, opts);
    }, this);
  },

  extractProperty: function(model, hash, name, type, opts) {
    var key = this.keyFor(name, type, opts),
        value = hash[key],
        serializer;
    if(type) {
      serializer = this.serializerFor(type);
    }
    if(serializer) {
      value = serializer.deserialize(value, opts);
    }
    if(value !== undefined) {
      set(model, name, value);
    }
  },

  createModel: function() {
    return this.typeFor(this.typeKey).create();
  },

  typeFor: function(typeKey) {
    return this.container.lookupFactory('model:' + typeKey);
  }

});