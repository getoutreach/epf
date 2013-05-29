var get = Ember.get, set = Ember.set;

function triggerLoad() {
  return function() {
    if(!get(this, 'content') && !get(this, 'isLoading')) {
      this.load();
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

/**
  Represents the promise of a model
*/
Ep.ModelPromise = Ember.ObjectProxy.extend(Ep.ModelMixin, Ember.DeferredMixin, {

  id: passThrough('id'),
  clientId: passThrough('clientId'),
  type: passThrough('type'),

  isPromise: true,
  isLoaded: passThrough('isLoaded', false),
  isLoading: false,
  isDeleted: passThrough('isDeleted', false),
  isNew: false,

  resolve: function(model) {
    set(this, 'content', model);
    return this._super.apply(this, arguments);
  },

  then: function() {
    // TODO: this isn't right
    return Ep.resolveModel(this._super.apply(this, arguments));
  },

  merge: function(session, cache) {
    var content = get(this, 'content');
    if(content) {
      return content.merge(session, cache);
    }
    if(!cache) cache = Ep.ModelCache.create();
    var dest;
    if(get(this, 'hasIdentifiers')) {
      if(dest = cache.getModel(this)) {
        return dest;
      }
      dest = session.getModel(this);
    }
    if(!dest) {
      dest = Ep.ModelPromise.create({
        id: get(this, 'id'),
        clientId: get(this, 'clientId'),
        type: get(this, 'type'),
        session: session
      });
      this.then(function(model) {
        dest.resolve(session.merge(model));
      }, function(err) {
        dest.reject(err);
        throw err;
      });
    }
    // TODO: if there are no identifiers we should still track on the session for cleanup
    if(get(dest, 'hasIdentifiers')) {
      session.add(dest);
      cache.add(dest);
    }
    return dest;
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
  },

  diff: passThroughMethod('diff', []),
  suspendRelationshipObservers: passThroughMethod('suspendRelationshipObservers'),
  eachAttribute: passThroughMethod('eachAttribute'),
  eachRelationship: passThroughMethod('eachRelationship')

});


Ep.LazyModel = Ep.ModelPromise.extend({

  willWatchProperty: triggerLoad(),
  unknownProperty: triggerLoad(),
  setUnknownProperty: triggerLoad(),
  then: triggerLoad(),

  load: function() {
    debugger
    if(!get(this, 'session')) {
      throw new Ember.Error("Must be attached to a session.");
    }
    if(get(this, 'isLoading')) {
      throw new Ember.Error("Already loading.");
    }
    set(this, 'isLoading', true);
    var proxy = this;
    return this.session.load(get(this, 'type'), get(this, 'id')).then(function(model) {
      set(proxy,'isLoading', false);
      proxy.resolve(model);
      return model;
    }, function(err) {
      proxy.reject(err);
      return err;
    });
  },

  merge: function(session, cache) {
    var content = get(this, 'content');
    if(content) {
      return content.merge(session, cache);
    }
    if(!cache) cache = Ep.ModelCache.create();
    var dest;
    if(dest = cache.getModel(this)) {
      return dest;
    }
    dest = session.getModel(this);
    // NO-OP
    if(!dest) {
      dest = Ep.LazyModel.create({
        id: get(this, 'id'),
        clientId: get(this, 'clientId'),
        type: get(this, 'type'),
        session: session
      });
      session.add(dest);
    }
    cache.add(dest);
    return dest;
  }

});

Ep.resolveModel = function(modelOrPromise, type, id, session) {
  if(modelOrPromise instanceof Ep.ModelPromise) {
    return modelOrPromise;
  }

  id = get(modelOrPromise, 'id') || id;
  var clientId = get(modelOrPromise, 'clientId');
  type = get(modelOrPromise, 'type') || type;
  session = get(modelOrPromise, 'session') || session;

  var promise = Ep.ModelPromise.create({
    id: id,
    clientId: id,
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