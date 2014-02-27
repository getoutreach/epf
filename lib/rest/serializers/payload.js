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
    var result = Ep.Payload.create(),
        metaKey = get(this, 'metaKey'),
        errorsKey = get(this, 'errorsKey'),
        context = opts && opts.context;

    if(context && typeof context === 'string') {
      set(result, 'context', []);
    }

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

      /**
        If a context for the payload has been specified
        we need to check each model to see if it is/belongs in
        the context
      */
      function checkForContext(model) {
        if(context) {
          if(typeof context === 'string' && typeKey === context) {
            // context is a typeKey (e.g. for a query)
            result.context.push(model);
          } else if(get(context, 'isModel')) {
            // context is a model
            result.context = model;
          } else if(get(model, 'id') === context.id && get(model, 'typeKey') === context.typeKey) {
            // context is a type/id hash (e.g. for a load)
            result.context = model;
          }
        }
      }

      var typeKey = this.typeKeyFor(prop),
          serializer = this.serializerFor(typeKey);
      if (Ember.isArray(value)) {
        for (var i=0; i < value.length; i++) {
          var model = serializer.deserialize(value[i]);
          checkForContext(model);
          result.add(model);
        }
      } else {
        var model = serializer.deserialize(value);
        checkForContext(model);
        result.add(model);
      }
    }

    materializeRelationships(result);

    return result;
  }

});