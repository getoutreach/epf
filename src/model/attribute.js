var get = Ember.get, set = Ember.set;

import Model from './model';

Model.reopenClass({
  attributes: Ember.computed(function() {
    var map = Ember.Map.create();

    this.eachComputedProperty(function(name, meta) {
      if (meta.isAttribute) {
        Ember.assert("You may not set `id` as an attribute on your model. Please remove any lines that look like: `id: Ep.attr('<type>')` from " + this.toString(), name !== 'id');

        meta.name = name;
        map.set(name, meta);
      }
    });

    return map;
  })
});

Model.reopen({
  eachAttribute: function(callback, binding) {
    get(this.constructor, 'attributes').forEach(function(name, meta) {
      callback.call(binding, name, meta);
    }, binding);
  },

  eachLoadedAttribute: function(callback, binding) {
    this.eachAttribute(function(name, meta) {
      if(this.isPropertyLoaded(name)) {
        callback.apply(binding, arguments);
      }
    }, this);
  }
});

export default function(type, options) {
  options = options || {};

  var meta = {
    type: type,
    isAttribute: true,
    options: options
  };

  return Ember.computed(function(key, value) {
    var session = get(this, 'session');

    if (arguments.length > 1) {
      Ember.assert("You may not set `id` as an attribute on your model. Please remove any lines that look like: `id: Ep.attr('<type>')` from " + this.constructor.toString(), key !== 'id');
    } else {
      return;
    }

    if(session) {
      session.modelWillBecomeDirty(this);
    }

    return value;
  }).meta(meta);
};