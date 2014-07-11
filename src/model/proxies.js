var get = Ember.get, set = Ember.set, Copyable = Ember.Copyable;

import {ModelMixin} from './model';

function triggerLoad(async) {
  return function() {
    if(!get(this, 'content') && !get(this, 'isLoading')) {
      if(async) {
        Ember.run.scheduleOnce('actions', this, this.load);
      } else {
        this.load();
      }
    }
    return this._super.apply(this, arguments);
  }
}

function passThrough(key, defaultValue) {
  return Ember.computed(function(key, value) {
    var content = get(this, 'content');
    if(arguments.length === 1) {
      if(content) {
        return get(content, key);
      } else {
        return defaultValue;
      }
    }
    if(content) {
      return set(content, key, value);
    }
    return value;
  }).property('content.' + key);
}

function passThroughMethod(name, defaultReturn) {
  return function() {
    var content = get(this, 'content');
    if(!content) return defaultReturn;
    return content[name].apply(content, arguments);
  }
}

var ModelProxy = Ember.ObjectProxy.extend(Copyable, ModelMixin, {

  id: passThrough('id'),
  clientId: passThrough('clientId'),
  rev: passThrough('rev'),
  clientRev: passThrough('clientRev'),
  type: passThrough('type'),

  isDirty: false,
  isPromise: false,
  isLoaded: passThrough('isLoaded', false),
  isLoading: false,
  isDeleted: passThrough('isDeleted', false),
  isNew: passThrough('isNew', false),
  isProxy: true,
  errors: passThrough('errors'),

  copy: function() {
    var content = get(this, 'content');
    if(content) {
      return content.copy();
    }
    return this.lazyCopy();
  },

  diff: passThroughMethod('diff', []),
  suspendRelationshipObservers: passThroughMethod('suspendRelationshipObservers'),
  eachAttribute: passThroughMethod('eachAttribute'),
  eachRelationship: passThroughMethod('eachRelationship'),
  _registerRelationships: passThroughMethod('_registerRelationships')

});

/**
  Represents the promise of a model
*/
var ModelPromise = ModelProxy.extend(Ember.DeferredMixin, {

  isPromise: true,

  resolve: function(model) {
    set(this, 'content', model);
    return this._super.apply(this, arguments);
  },

  // volatile as to not trigger a load
  hasIdentifiers: Ember.computed(function() {
    return get(this, 'type') && (get(this, 'id') || get(this, 'clientId'));
  }).volatile(),

  toStringExtension: function() {
    var content = get(this, 'content');
    if(content) {
      return content.toString();
    } else if(get(this, 'hasIdentifiers')) {
      var type = get(this, 'type');
      return "(unloaded " + type.toString() + "):" + this._super();
    } else {
      return "(no identifiers)";
    }
  }

});


var LazyModel = ModelPromise.extend({

  willWatchProperty: triggerLoad(true),
  unknownProperty: triggerLoad(),
  setUnknownProperty: triggerLoad(),
  then: triggerLoad(true),
  _parent: null,

  resolve: function() {
    set(this, 'isLoading', false);
    return this._super.apply(this, arguments);
  },

  load: function() {
    if(get(this, 'isLoading')) return this;

    var session = get(this, 'session'),
        type = get(this, 'type'),
        id = get(this, 'id');
    set(this, 'isLoading', true);

    if(!session && get(this, '_parent')) {
      session = get(this, '_parent.session');
    }

    Ember.assert("Must be attached to a session.", session);
    Ember.assert("Must have an id to load.", id);

    var promise = session.load(type, id);

    if(get(promise, 'isLoaded')) {
      this.resolve(unwrap(promise));
    } else {
      var proxy = this;
      promise.then(function(model) {
        proxy.resolve(model);
        return model;
      }, function(err) {
        proxy.reject(err);
        return err;
      });
    }
    return this;
  },

});

function unwrap(modelOrPromise) {
  if(get(modelOrPromise, 'isProxy')) {
    return get(modelOrPromise, 'content');
  }

  return modelOrPromise;
}

function resolveModel(modelOrPromise, type, id, session) {
  if(modelOrPromise instanceof ModelPromise) {
    return modelOrPromise;
  }

  id = get(modelOrPromise, 'id') || id;
  var clientId = get(modelOrPromise, 'clientId');
  type = get(modelOrPromise, 'type') || type;
  session = get(modelOrPromise, 'session') || session;

  var promise = ModelPromise.create({
    id: id,
    clientId: clientId,
    type: type,
    session: session
  });

  if(typeof modelOrPromise.then !== 'function') {
    promise.resolve(modelOrPromise);
  } else {
    modelOrPromise.then(function(model) {
      promise.resolve(model);
      return model;
    }, function(err) {
      promise.reject(err);
      throw err;
    });
  }

  return promise;
};

export {ModelProxy, ModelPromise, LazyModel, unwrap, resolveModel};