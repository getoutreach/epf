var get = Ember.get, set = Ember.set,
    cacheFor = Ember.cacheFor,
    cacheGet = cacheFor.get,
    cacheSet = cacheFor.set,
    metaFor = Ember.meta;

import Model from '../model/model';
import isEqual from '../utils/isEqual';

export default function belongsTo(typeKey, options) {
  Ember.assert("The type passed to belongsTo must be defined", !!typeKey);
  options = options || {};

  var meta = { isRelationship: true, options: options, kind: 'belongsTo' };

  if(typeof typeKey === 'string') {
    meta.typeKey = typeKey;
  } else {
    meta.type = typeKey;
  }

  return Ember.computed(function(key, value) {
    var session = get(this, 'session');
    var prop = "__" + key;
    var oldValue = this[prop];
    if(arguments.length === 1) {
      value = oldValue;
    }
    var changed = !isEqual(value, oldValue);
    if(changed) {
      this.belongsToWillChange(this, key);
      if(session) {
        session.modelWillBecomeDirty(this);
      }
    }
    if(session && value) {
      value = session.add(value);
    }
    if(arguments.length > 1) {
      this[prop] = value;
      if(changed) {
        this.belongsToDidChange(this, key);
      }
    }
    return value;
  }).volatile().meta(meta);
};

/**
  These observers observe all `belongsTo` relationships on the model. See
  `relationships/ext` to see how these observers get their dependencies.
*/
Model.reopen({

  init: function() {
    this._super();
    // manually trigger change events to updated inverses
    this.eachLoadedRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        this.belongsToDidChange(this, name);
      }
    }, this);
  },

  /** @private */
  belongsToWillChange: Ember.beforeObserver(function(model, name) {
    if(this._suspendedRelationships) {
      return;
    }
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
    if(this._suspendedRelationships) {
      return;
    }
    var inverseModel = get(model, name);
    var session = get(model, 'session');
    if(session && inverseModel) {
      session.inverseManager.registerRelationship(model, name, inverseModel);
    }
  })
});
