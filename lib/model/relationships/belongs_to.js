var get = Ember.get, set = Ember.set,
    cacheFor = Ember.cacheFor,
    cacheGet = cacheFor.get,
    cacheSet = cacheFor.set,
    metaFor = Ember.meta;

function BelongsToDescriptor(func, opts) {
  Ember.ComputedProperty.apply(this, arguments);
}

function inherit(o) {
  function F() {}; // Dummy constructor
  F.prototype = o; 
  return new F(); 
}

BelongsToDescriptor.prototype = inherit(Ember.ComputedProperty.prototype);
BelongsToDescriptor.prototype.constructor = BelongsToDescriptor;

BelongsToDescriptor.prototype.get = function(obj, keyName) {
  if(!get(obj, 'isDetached') && this._suspended !== obj) {
    var meta = metaFor(obj),
        cache = meta.cache,
        session = get(obj, 'session'),
        cached, existing;

    if((cached = cacheGet(cache, keyName))
      && (existing = session.add(cached))
      && (existing !== cached)) {
      cacheSet(cache, keyName, existing);
    }
  }

  return Ember.ComputedProperty.prototype.get.apply(this, arguments);
};

Ep.belongsTo = function(typeKey, options) {
  Ember.assert("The type passed to Ep.belongsTo must be defined", !!typeKey);
  options = options || {};

  var meta = { isRelationship: true, options: options, kind: 'belongsTo' };

  if(typeof typeKey === 'string') {
    meta.typeKey = typeKey;
  } else {
    Ember.deprecate("Using a raw class for relationship definitions is deprecated. Please pass in the name of the type (e.g. 'post')");
    meta.type = typeKey;
  }

  return new BelongsToDescriptor(function(key, value, oldValue) {
    if(arguments.length === 1) {
      return null;
    } else {
      var session = get(this, 'session');
      if(session) {
        session.modelWillBecomeDirty(this, key, value, oldValue);
        if(value) {
          value = session.add(value);
        }
      }
      return value;
    }
  }).meta(meta);
};

/**
  These observers observe all `belongsTo` relationships on the model. See
  `relationships/ext` to see how these observers get their dependencies.

*/

Ep.Model.reopen({

  init: function() {
    this._super();
    // manually trigger change events to updated inverses
    this.eachRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        this.belongsToDidChange(this, name);
      }
    }, this);
  },

  /** @private */
  belongsToWillChange: Ember.beforeObserver(function(model, name) {
    var inverseModel = get(model, name);
    var session = get(model, 'session');
    if(session) {
      if(inverseModel) {
        session.inverseManager.unregisterRelationship(model, name, inverseModel);
      }
    }
  }),

  /** @private */
  belongsToDidChange: Ember.immediateObserver(function(model, name) {
    var inverseModel = get(model, name);
    var session = get(model, 'session');
    if(session && inverseModel) {
      session.inverseManager.registerRelationship(model, name, inverseModel);
    }
  })
});
