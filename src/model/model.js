var get = Ember.get, set = Ember.set, Copyable = Ember.Copyable, computed = Ember.computed,
    cacheFor = Ember.cacheFor,
    cacheGet = cacheFor.get,
    metaFor = Ember.meta;

import ModelSet from '../collections/model_set';

var Model = Ember.Object.extend(Copyable, {

  id: null,
  clientId: null,
  rev: null,
  clientRev: 0,
  session: null,
  errors: null,
  isModel: true,
  isDeleted: false,

  _loadPromise: null,

  /**
    Two models are "equal" when they correspond to the same
    key. This does not mean they necessarily have the same data.
  */
  isEqual: function(model) {
    if(!model) return false;
    var clientId = get(this, 'clientId');
    var otherClientId = get(model, 'clientId');
    if(clientId && otherClientId) {
      return clientId === otherClientId;
    }
    // in most cases clientIds will always be set, however
    // during serialization this might not be the case
    var id = get(this, 'id');
    var otherId = get(model, 'id');
    return this.isSameType(model) && id === otherId
  },

  isSameType: function(model) {
    return this.hasType(get(model, 'type'));
  },

  /**
    Model promises are just proxies and do not have the
    literal type of their contents.
  */
  hasType: function(type) {
    return get(this, 'type').detect(type);
  },

  type: computed(function(key, value) {
    return value || this.constructor;
  }),

  typeKey: computed(function() {
    return get(this, 'type.typeKey');
  }),

  toStringExtension: function() {
    return "[" + get(this, 'id') + ", " + get(this, 'clientId') + "]";
  },

  lazyCopy: function() {
    var type = get(this, 'type');
    return type.create({
      id: get(this, 'id'),
      clientId: get(this, 'clientId'),
      isDeleted: get(this, 'isDeleted'),
      errors: get(this, 'errors')
    });
  },

  // these properties are volatile so they don't trigger lazy loads
  // on promises by calling `willWatchProperty` on their dependencies
  hasErrors: computed(function() {
    return !!get(this, 'errors');
  }).volatile(),

  isDetached: computed(function() {
    return !get(this, 'session');
  }).volatile(),

  isManaged: computed(function() {
    return !!get(this, 'session');
  }).volatile(),

  isNew: computed(function() {
    return !get(this, 'id');
  }).property('id'),

  /**
    Whether the model is dirty or not.

    Logically, this corresponds to whether any properties of the
    model have been set since the last flush.
    @property isDirty
  */
  isDirty: computed(function() {
    var session = get(this, 'session');
    if(!session) return false;
    return get(session, 'dirtyModels').contains(this);
  }).property('session.dirtyModels.[]'),

  // creates a shallow copy with lazy children
  // TODO: we should not lazily copy detached children
  copy: function() {
    var dest = this.constructor.create();
    this.copyTo(dest);
    return dest;
  },

  copyTo: function(dest) {
    dest.beginPropertyChanges();
    this.copyAttributes(dest);
    this.copyMeta(dest);
    this.eachLoadedRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        var child = get(this, name);
        set(dest, name, child && child.lazyCopy());
      } else if(relationship.kind === 'hasMany') {
        var children = get(this, name);
        var destChildren = [];
        children.forEach(function(child) {
          destChildren.pushObject(child.lazyCopy());
        });
        set(dest, name, destChildren);
      }
    }, this);
    dest.endPropertyChanges();
    return dest;
  },

  copyAttributes: function(dest) {
    dest.beginPropertyChanges();
    
    this.eachLoadedAttribute(function(name, meta) {
      var left = get(this, name);
      var right = get(dest, name);
      var copy;
      // Ember.copy does not support Date
      if(left instanceof Date) {
        copy = new Date(left.getTime());
      } else {
        copy = Ember.copy(left, true);
      }
      set(dest, name, copy);
    }, this);
    dest.endPropertyChanges();
  },

  copyMeta: function(dest) {
    set(dest, 'id', get(this, 'id'));
    set(dest, 'clientId', get(this, 'clientId'));
    set(dest, 'rev', get(this, 'rev'));
    set(dest, 'clientRev', get(this, 'clientRev'));
    set(dest, 'errors', Ember.copy(get(this, 'errors')));
    set(dest, 'isDeleted', get(this, 'isDeleted'));
  },

  willWatchProperty: function(key) {
    if(get(this, 'isManaged') && this.shouldTriggerLoad(key)) {
      Ember.run.scheduleOnce('actions', this, this.load);
    }
  },

  shouldTriggerLoad: function(key) {
    return this.isAttributeOrRelationship(key) && !this.isPropertyLoaded(key);
  },

  isAttributeOrRelationship: function(key) {
    var proto = this.constructor.proto(),
        descs = Ember.meta(proto).descs,
        desc = descs[key],
        meta = desc && desc._meta;

    return meta && (meta.isAttribute || meta.isRelationship);
  },

  isPropertyLoaded: function(key) {
    if(get(this, 'isNew')) {
      return true;
    }

    var proto = this.constructor.proto(),
        descs = Ember.meta(proto).descs,
        desc = descs[key],
        meta = desc && desc._meta;

    if(meta.isRelationship && meta.kind === 'belongsTo') {
      return typeof this['__' + key] !== 'undefined';
    }

    var meta = metaFor(this),
        cache = meta.cache,
        cached = cacheGet(cache, key);

    return typeof cached !== 'undefined';
  },

  anyPropertiesLoaded: function() { 
    var result = false;
    get(this, 'type.fields').forEach(function(name, meta) {
      result = result || this.isPropertyLoaded(name);
    }, this);
    return result;
  },

  load: sessionAlias('loadModel'),
  refresh: sessionAlias('refresh'),
  deleteModel: sessionAlias('deleteModel'),
  remoteCall: sessionAlias('remoteCall'),
  markClean: sessionAlias('markClean'),
  invalidate: sessionAlias('invalidate'),
  touch: sessionAlias('touch')

});

Model.reopenClass({

  /**
    This is the only static method implemented in order to play nicely
    with Ember's default model conventions in the router. It is preferred
    to explicitly call `load` on a session.

    In order to use this method, you must set the Ep.__container__ property. E.g.

    ```
      Ep.__container__ = App.__container__;
    ```
  */
  find: function(id) {
    if(!Ep.__container__) {
      throw new Ember.Error("The Ep.__container__ property must be set in order to use static find methods.");
    }
    var container = Ep.__container__;
    var session = container.lookup('session:main');
    return session.find(this, id);
  },

  typeKey: computed(function() {
    return Ember.String.underscore(this.toString().split(/[:.]/)[1]);
  })

});

function sessionAlias(name) {
  return function () {
    var session = get(this, 'session');
    Ember.assert("Cannot call " + name + " on a detached model", session);
    var args = [].splice.call(arguments,0);
    args.unshift(this);
    return session[name].apply(session, args);
  };
}

export default Model;
