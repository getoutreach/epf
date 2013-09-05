var get = Ember.get, set = Ember.set,
    isNone = Ember.isNone;

function BelongsToDescriptor(func, opts) {
  Ember.ComputedProperty.apply(this, arguments);
}

BelongsToDescriptor.prototype = new Ember.ComputedProperty();

BelongsToDescriptor.prototype.get = function(obj, keyName) {
  if(!get(obj, 'isDetached') && this._suspended !== obj) {
    var ret, cache, cached, meta, session, existing;
    meta = Ember.meta(obj);
    cache = meta.cache;
    session = get(obj, 'session');

    if((cached = cache[keyName])
      && (existing = session.fetch(cached))
      && (existing !== cached)) {
      cache[keyName] = existing;
    }
  }

  return Ember.ComputedProperty.prototype.get.apply(this, arguments);
};

Ep.belongsTo = function(type, options) {
  Ember.assert("The type passed to Ep.belongsTo must be defined", !!type);
  options = options || {};

  var meta = { type: type, isRelationship: true, options: options, kind: 'belongsTo' };

  return new BelongsToDescriptor(function(key, value) {
    if(arguments.length === 1) {
      return null;
    } else {
      var session = get(this, 'session');
      if(value && session) {
        value = session.add(value);
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
  belongsToWillChange: Ember.beforeObserver(function(model, key) {
    var oldParent = get(model, key);
    var session = get(model, 'session');
    if(session) {
      session.modelWillBecomeDirty(model);
    }
    if(oldParent && session) {
      session.belongsToManager.unregister(model, key, oldParent);
    }
    if(oldParent && get(oldParent, 'isLoaded')) {
      var inverse = get(model, 'type').inverseFor(key);
      if(inverse) {
        oldParent.suspendRelationshipObservers(function() {
          if(inverse.kind === 'hasMany' && model) {
            get(oldParent, inverse.name).removeObject(model)
          } else if(inverse.kind === 'belongsTo') {
            set(oldParent, inverse.name, null);

            // we need to unregister the inverse here as well since it's
            // observer has been suspended and won't register itself
            if(session) {
              session.modelWillBecomeDirty(oldParent);
              session.belongsToManager.unregister(oldParent, inverse.name, model);
            }
          }
        });
      }
    }
  }),

  /** @private */
  belongsToDidChange: Ember.immediateObserver(function(model, key) {
    var parent = get(model, key);
    var session = get(model, 'session');
    if(parent && session) {
      session.belongsToManager.register(model, key, parent);
    }
    if(parent && get(parent, 'isLoaded')) {
      var inverse = get(model, 'type').inverseFor(key);
      if(inverse) {
        parent.suspendRelationshipObservers(function() {
          if(inverse.kind === 'hasMany' && model) {
            get(parent, inverse.name).addObject(model);
          } else if(inverse.kind === 'belongsTo') {
            set(parent, inverse.name, model);

            // we need to register the inverse here as well since it's
            // observer has been suspended and won't register itself
            if(session) session.belongsToManager.register(parent, inverse.name, model);
          }
        });
      }
    }
  })
});
