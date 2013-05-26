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
    if(!this.content) return defaultValue;
    return get(this, 'content' + key);
  }).property('content.' + key);
}

/**
  Represents the promise of a model
*/
Orm.ModelPromise = Ember.ObjectProxy.extend(Orm.ModelMixin, Ember.DeferredMixin, {

  isPromise: true,
  isLoaded: passThrough('isLoaded', false),
  isLoading: false,
  isDeleted: passThrough('isDeleted', false),
  isNew: false,
  clientId: null,

  // pass the clientId through
  contentDidChange: Ember.observer(function() {
    if(!this.clientId) return;
    set(this, 'content.clientId', this.clientId);
  }, 'content'),

  merge: function(session, cache) {
    if(this.content) {
      return content.merge(session, cache);
    }
    if(!cache) cache = Orm.ModelCache.create();
    if(cache.getModel(this)) {
      return;
    }
    cache.add(this);
    var dest = session.getModel(this);
    // NO-OP
    if(!dest) {
      dest = Orm.LazyModel.create({
        id: this.id,
        clientId: this.clientId,
        type: this.type
      });
      session.add(dest);
    }
    return dest;
  }

});


Orm.LazyModel = Orm.ModelPromise.extend({

  willWatchProperty: triggerLoad(),
  unknownProperty: triggerLoad(),
  setUnknownProperty: triggerLoad(),
  then: triggerLoad(),

  load: function() {
    if(!get(this, 'session')) {
      throw new Ember.Error("Must be attached to a session.");
    }
    if(get(this, 'isLoading')) {
      throw new Ember.Error("Already loading.");
    }
    set(this, 'isLoading', true);
    var proxy = this;
    return this.session.load(this.type, this.id).then(function(model) {
      set(proxy, 'content', model);
      set(proxy,'isLoading', false);
      proxy.resolve(model);
      return model;
    }, function(err) {
      proxy.reject(err);
      return err;
    });
  }

});

Orm.resolveModel = function(id, type, session, promise) {
  modelPromise = Orm.ModelPromise.create({
    id: id,
    type: type,
    session: session
  });

  promise.then(function(model) {
    modelPromise.resolve(model);
  }, function(err) {
    modelPromise.reject(model);
  });

  return modelPromise;
};