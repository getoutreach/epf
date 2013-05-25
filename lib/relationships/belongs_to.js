var get = Ember.get, set = Ember.set,
    isNone = Ember.isNone;

Orm.belongsTo = function(type, options) {
  Ember.assert("The first argument DS.belongsTo must be a model type or string, like DS.belongsTo(App.Person)", !!type && (typeof type === 'string' || DS.Model.detect(type)));

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

DS.Model.reopen({
  /** @private */
  belongsToWillChange: Ember.beforeObserver(function(model, key) {
    var oldParent = get(model, key);
    if(oldParent && get(oldParent, 'isLoaded')) {
      var inverse = model.constructor.inverseFor(key);
      if(inverse) {
        oldParent.suspendRelationshipObservers(function() {
          if(inverse.kind === 'hasMany' && model) {
            get(oldParent, inverse.name).removeObject(model)
          } else if(inverse.kind === 'belongsTo') {
            set(oldParent, inverse.name, null);
          }
        });
      }
    }
  }),

  /** @private */
  belongsToDidChange: Ember.immediateObserver(function(model, key) {
    var parent = get(model, key);
    if(parent && get(parent, 'isLoaded')) {
      var inverse = model.constructor.inverseFor(key);
      if(inverse) {
        parent.suspendRelationshipObservers(function() {
          if(inverse.kind === 'hasMany' && model) {
            // TODO: how do we determine where it is placed? should there
            // be a hook to control?
            get(parent, inverse.name).addObject(model)
          } else if(inverse.kind === 'belongsTo') {
            set(parent, inverse.name, model);
          }
        });
      }
    }
  })
});
