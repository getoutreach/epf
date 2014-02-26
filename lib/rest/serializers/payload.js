var get = Ember.get, set = Ember.set;

var materializeRelationships = require('../../utils/materialize_relationships');

Ep.PayloadSerializer = Ep.Serializer.extend({
  mergedProperties: ['aliases'],

  aliases: {},
  metaKey: 'meta',
  errorsKey: 'errors',

  singularize: function(name) {
    return Ember.String.singularize(name);
  },

  typeKeyFor: function(name) {
    var singular = this.singularize(name),
        aliases = get(this, 'aliases'),
        alias = aliases[name];
    return alias || singular;
  },

  rootForTypeKey: function(typeKey) {
    return typeKey;
  },

  serialize: function(model) {
    var root = this.rootForTypeKey(model.typeKey),
        res = {},
        serializer = this.serializerFor(model.typeKey);
    res[root] = serializer.serialize(model);
  },

  deserialize: function(hash, opts) {
    var result = Ep.ModelSet.create(),
        metaKey = get(this, 'metaKey'),
        errorsKey = get(this, 'errorsKey');

    for (var prop in hash) {
      if (!hash.hasOwnProperty(prop)) {
        continue;
      }

      if(prop === metaKey) {
        result.meta = hash[prop];
        continue;
      }

      var value = hash[prop];

      if(prop === errorsKey) {
        var serializer = this.serializerFor('errors'),
            errors = serializer.deserialize(value);
        result.errors = errors;
        continue;
      }

      var typeKey = this.typeKeyFor(prop),
          serializer = this.serializerFor(typeKey);
      if (value instanceof Array) {
        for (var i=0; i < value.length; i++) {
          result.push(serializer.deserialize(value[i]));
        }
      } else {
        result.push(serializer.deserialize(value));
      }
    }

    materializeRelationships(result);

    return result;
  },

  materializeRelationships: function(models) {

    models.forEach(function(model) {

      model.eachRelationship(function(name, relationship) {
        if(relationship.kind === 'belongsTo') {
          var child = get(model, name);
          if(child) {
            child = models.getModel(child) || child;
            set(model, name, child);
          }
        } else if(relationship.kind === 'hasMany') {
          // TODO: merge could be per item
          var children = get(model, name);
          var lazyChildren = Ep.ModelSet.create();
          lazyChildren.addObjects(children);
          children.clear();
          lazyChildren.forEach(function(child) {
            child = models.getModel(child) || child;
            children.addObject(child);
          });
        }
      }, this);

    }, this);

  }

});