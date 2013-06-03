var get = Ember.get, set = Ember.set,
    isNone = Ember.isNone;

Ep.belongsTo = function(type, options) {
  Ember.assert("The first argument Ep.belongsTo must be a model type or string, like Ep.belongsTo(App.Person)", !!type && (typeof type === 'string' || Ep.Model.detect(type)));

  options = options || {};

  var meta = { type: type, isRelationship: true, options: options, kind: 'belongsTo' };

  return Ember.computed(function(key, value) {
    if(arguments.length === 1) {
      return null;
    } else {
      return value;
    }
  }).property().meta(meta);
};

/**
  These observers observe all `belongsTo` relationships on the model. See
  `relationships/ext` to see how these observers get their dependencies.

*/

Ep.Model.reopen({
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
            // TODO: how do we determine where it is placed? should there
            // be a hook to control?
            get(parent, inverse.name).addObject(model)
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
