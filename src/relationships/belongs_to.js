var get = Ember.get, set = Ember.set,
    cacheFor = Ember.cacheFor,
    cacheGet = cacheFor.get,
    cacheSet = cacheFor.set,
    metaFor = Ember.meta;

import Model from '../model/model';

/**
  @private

  Custom CP descriptor which updates the cache when accessed
*/
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
    this.materialize(obj, keyName);
  }

  return Ember.ComputedProperty.prototype.get.apply(this, arguments);
};

/**
  @private

  As an optimization, we store the raw model that was passed into the setter
  of a belongsTo in the cache. When the belongsTo is accessed or watched we
  then materialize. This is useful in places like child sessions where we only
  want to fetch a model from the parent on-demand.
*/
BelongsToDescriptor.prototype.materialize = function(obj, keyName) {
  var meta = metaFor(obj),
      cache = meta.cache,
      session = get(obj, 'session'),
      cached, existing;

  if((cached = cacheGet(cache, keyName))
    && (existing = session.add(cached))
    && (existing !== cached)) {
    cacheSet(cache, keyName, existing);
  }
};

export default function(typeKey, options) {
  Ember.assert("The type passed to belongsTo must be defined", !!typeKey);
  options = options || {};

  var meta = { isRelationship: true, options: options, kind: 'belongsTo' };

  if(typeof typeKey === 'string') {
    meta.typeKey = typeKey;
  } else {
    Ember.deprecate("Using a raw class for relationship definitions is deprecated. Please pass in the name of the type (e.g. 'post')");
    meta.type = typeKey;
  }

  return new BelongsToDescriptor(function(key, value) {
    if(arguments.length === 1) {
      return undefined;
    } else {
      var session = get(this, 'session');
      set(this, 'hasData', true);
      if(session) {
        session.modelWillBecomeDirty(this);
        if(value) {
          value = session.add(value);
        }
      } else if(value) {
        value = BelongsToReference(this, value);
      }
      return value;
    }
  }).meta(meta);
};

/**
  @private

  We need a custom wrapper around related models with a session
  that points to the parent model's session. This is due to
  the way belongsTo CP's are lazily materialized and how
  Ember's internal chain watchers behave.
*/
function BelongsToReference(parent, value) {
  var res = get(value, 'type').createWithMixins({
    session: Ember.computed.alias('_parent.session')
  });
  value.copyTo(res);
  set(res, '_parent', parent);
  return res;
}

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
