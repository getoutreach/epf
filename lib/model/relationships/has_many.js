var get = Ember.get, set = Ember.set, forEach = Ember.ArrayPolyfills.forEach;

require("../model");
require("../../collections/model_array");

Ep.hasMany = function(typeKey, options) {
  Ember.assert("The type passed to Ep.hasMany must be defined", !!typeKey);
  options = options || {};

  var meta = { isRelationship: true, options: options, kind: 'hasMany' };

  if(typeof typeKey === 'string') {
    meta.typeKey = typeKey;
  } else {
    Ember.deprecate("Using a raw class for relationship definitions is deprecated. Please pass in the name of the type (e.g. 'post')");
    meta.type = typeKey;
  }

  return Ember.computed(function(key, value, cached) {
    var content;
    if(arguments.length === 1) {
      content = [];
    } else {
      content = value;
    }
    if(cached) {
      set(cached, 'content', content);
      return cached;
    }
    return Ep.HasManyArray.create({
      owner: this,
      name: key,
      content: content
    });
  }).property().meta(meta);
};

Ep.HasManyArray = Ep.ModelArray.extend({

  name: null,
  owner: null,
  session: Ember.computed.alias('owner.session'),


  objectAtContent: function(index) {
    var content = get(this, 'content'),
        model = content.objectAt(index),
        session = get(this, 'session');

    if (session && model) {
      // This will replace proxies with their actual models
      // if they are loaded
      return session.add(model);
    }
    return model;
  },

  arrayContentWillChange: function(index, removed, added) {
    var model = get(this, 'owner'),
        name = get(this, 'name'),
        session = get(this, 'session');

    if(session) {
      session.modelWillBecomeDirty(model);
      if (!model._suspendedRelationships) {
        for (var i=index; i<index+removed; i++) {
          var inverseModel = this.objectAt(i);
          session.inverseManager.unregisterRelationship(model, name, inverseModel);
        }
      }
    }

    return this._super.apply(this, arguments);
  },

  arrayContentDidChange: function(index, removed, added) {
    this._super.apply(this, arguments);

    var model = get(this, 'owner'),
        name = get(this, 'name'),
        session = get(this, 'session');

    if (session && !model._suspendedRelationships) {
      for (var i=index; i<index+added; i++) {
        var inverseModel = this.objectAt(i);
        session.inverseManager.registerRelationship(model, name, inverseModel);
      }
    }
  },

});
