require('../serializer');

/**
  @class JsonSerializer
  @constructor
  @namespace Orm
  @extends Ep.Serializer
*/
var get = Ember.get, set = Ember.set;

Ep.JsonSerializer = Ep.Serializer.extend(Ep.EmbeddedHelpersMixin, {
  mergedProperties: ['properties'],

  /**
    Specifies configurations for individual properties.

    For example:

    ```
    App.PostSerializer = Epf.JsonSerializer.extend({
      properties: {
        title: {
          key: 'TITLE1'
        },
        comments: {
          embedded: 'always'
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

  keyFor: function(name, type) {
    var key;
    if(key = this._keyCache[name]) {
      return key;
    }

    var config = this.configFor(name);
    key = config.key || Ember.String.underscore(name);
    this._keyCache[name] = key;
    return key;
  },

  keyForBelongsTo: Ember.aliasMethod('keyFor'),
  keyForHasMany: Ember.aliasMethod('keyFor'),

  keyForRelationship: function(relationship) {
    var type = relationship.parentType,
        name = relationship.key;

    switch (description.kind) {
      case 'belongsTo':
        return this.keyForBelongsTo(name, type);
      case 'hasMany':
        return this.keyForHasMany(name, type);
    }
  },

  keyForEmbeddedType: function() {
    return 'type';
  },

  transformFor: function(attributeType) {
    return this.container.lookup('transform:' + attributeType);
  },

  pluralize: function(name) {
    return Ember.String.pluralize(name);
  },

  singularize: function(name) {
    return Ember.String.singularize(name);
  },

  typeFor: function(name) {
    var singular = this.singularize(name);
    return this.container.lookup('model:' + name);
  }

});