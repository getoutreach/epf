var get = Ember.get, set = Ember.set;

import Serializer from './base';

/**
  @namespace serializers
  @class ModelSerializer
*/
export default class ModelSerializer extends Serializer {
  /**
    Specifies configurations for individual properties.

    For example:

    ```
    App.PostSerializer = Coalesce.JsonSerializer.extend({
      properties: {
        title: {
          key: 'TITLE1'
        }
      }
    });
    ```

    @property properties
  */
  constructor(...args) {
    super(args);
    this._keyCache = {};
    this._nameCache = {};
  }

  /**
    @private

    Looks up the property name corresponding to the
    given key.
  */
  nameFor(key) {
    var name;
    if(name = this._nameCache[key]) {
      return name;
    }
    var configs = this.properties;
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
  }

  configFor(name) {
    var properties = this.properties;
    return properties && properties[name] || {};
  }

  keyFor(name, type, opts) {
    var key;
    if(key = this._keyCache[name]) {
      return key;
    }

    var config = this.configFor(name);
    key = config.key || this.keyForType(name, type, opts);
    this._keyCache[name] = key;
    return key;
  }

  keyForType(name, type, opts) {
    return Ember.String.underscore(name);
  }

  /**
    @private

    Determines the singular root name for a particular type.

    This is an underscored, lowercase version of the model name.
    For example, the type `App.UserGroup` will have the root
    `user_group`.

    @param {Coalesce.Model subclass} type
    @returns {String} name of the root element
  */
  rootForType(type) {
    return get(type, 'typeKey');
  }

  serialize(model) {
    var serialized = {};

    this.addMeta(serialized, model);
    this.addAttributes(serialized, model);
    this.addRelationships(serialized, model);

    return serialized;
  }

  addMeta(serialized, model) {
    this.addProperty(serialized, model, 'id', 'id');
    this.addProperty(serialized, model, 'clientId', 'string');
    this.addProperty(serialized, model, 'rev', 'revision');
    this.addProperty(serialized, model, 'clientRev', 'revision');
  }

  addAttributes(serialized, model) {
    model.eachLoadedAttribute(function(name, attribute) {
      // do not include transient properties
      if(attribute.transient) return;
      this.addProperty(serialized, model, name, attribute.type);
    }, this);
  }

  addRelationships(serialized, model) {
    model.eachLoadedRelationship(function(name, relationship) {
      var config = this.configFor(name),
          opts = {typeKey: relationship.typeKey, embedded: config.embedded},
          // we dasherize the kind for lookups for consistency
          kindKey = Ember.String.dasherize(relationship.kind);
      this.addProperty(serialized, model, name, kindKey, opts);
    }, this);
  }

  addProperty(serialized, model, name, type, opts) {
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
  }

  deserialize(hash, opts) {
    var model = this.createModel();

    this.extractMeta(model, hash, opts);
    this.extractAttributes(model, hash);
    this.extractRelationships(model, hash);

    return model;
  }

  extractMeta(model, hash, opts) {
    this.extractProperty(model, hash, 'id', 'id');
    this.extractProperty(model, hash, 'clientId', 'string');
    this.extractProperty(model, hash, 'rev', 'revision');
    this.extractProperty(model, hash, 'clientRev', 'revision');
    this.extractProperty(model, hash, 'errors', 'errors');
    if(!opts || opts.reifyClientId !== false) {
      this.idManager.reifyClientId(model);
    }
  }

  extractAttributes(model, hash) {
    model.eachAttribute(function(name, attribute) {
      this.extractProperty(model, hash, name, attribute.type);
    }, this);
  }

  extractRelationships(model, hash) {
    model.eachRelationship(function(name, relationship) {
      var config = this.configFor(name),
          opts = {typeKey: relationship.typeKey, embedded: config.embedded},
          // we dasherize the kind for lookups for consistency
          kindKey = Ember.String.dasherize(relationship.kind);
      this.extractProperty(model, hash, name, kindKey, opts);
    }, this);
  }

  extractProperty(model, hash, name, type, opts) {
    var key = this.keyFor(name, type, opts),
        value = hash[key],
        serializer;
    if(typeof value === 'undefined') {
      return;
    }
    if(type) {
      serializer = this.serializerFor(type);
    }
    if(serializer) {
      value = serializer.deserialize(value, opts);
    }
    if(typeof value !== 'undefined') {
      set(model, name, value);
    }
  }

  createModel() {
    return this.typeFor(this.typeKey).create();
  }

  typeFor(typeKey) {
    return this.container.lookupFactory('model:' + typeKey);
  }

  serializerFor(typeKey) {
    return this.serializerFactory.serializerFor(typeKey);
  }

  embeddedType(type, name) {
    var config = this.configFor(name);
    return config.embedded;
  }

}
