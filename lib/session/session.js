var get = Ember.get, set = Ember.set;

require('../collections/model_array');
require('../collections/model_cache');
require('./model_array_manager');

Ep.SessionMixin = Ember.Mixin.create({

  init: function() {
    this._super.apply(this, arguments);
    this.cache = Ep.ModelCache.create();
    this.orphans = Ember.Set.create();
    this.arrayManager = Ep.ModelArrayManager.create();
  },

  lookupType: function(type) {
    return this.container.lookup('model:' + type);
  },

  merge: function(model, cache) {
    debugger
    return model.merge(this, cache);
  },

  remove: function(model) {
    // TODO: what does this mean for all relationships of the model in the session?
    // TODO: can models be removed?
    return this.cache.remove(model);
  },

  add: function(model) {
    set(model, 'session', this);
    // It is possible that we are adding a model to the cache
    // which will replace a previously added lazy model.
    // This lazy model could still be used elsewhere, but we
    // keep track of it in `orphans` to clean up later.
    var existing = this.cache.getModel(model);
    if(existing && existing !== model) {
      this.cache.remove(existing);
      this.orphans.add(existing);
    }
    return this.cache.add(model);
  },

  getModel: function(model) {
    return this.cache.getModel(model);
  },

  getForId: function(type, id) {
    return this.cache.getForId(type, id);
  },

  destroy: function() {
    this._super();
    this.ophans.forEach(function(model) {
      model.destroy();
    });
    this.models.forEach(function(model) {
      model.destroy();
    });
    this.orphans.destroy();
    this.cache.destroy();
    this.arrayManager.destroy();
    this.adapter.sessionWasDestroyed(this);
  },

  models: Ember.computed.alias('cache.models'),

});

Ep.Session = Ember.Object.extend(Ep.SessionMixin, {

  create: function(type, hash) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var model = type.create(hash);
    this.adapter.assignClientId(model);
    this.add(model);
    return model;
  },

  deleteModel: function(model) {
    set(model, 'isDeleted', true);
    this.arrayManager.modelWasDeleted(model);
  },

  load: function(type, id) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    // always coerce to string
    id = id.toString();

    var cached = this.getForId(type, id);
    if(cached && get(cached, 'isLoaded')) {
      return Ep.resolveModel(cached);
    } else {
      var session = this;
      // TODO: handle errors
      return Ep.resolveModel(this.adapter.load(type, id).then(function(model) {
        return session.merge(model);
      }), type, id, session);
    }
  },

  find: function(type, query) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var session = this;
    return this.adapter.find(type, query).then(function(models) {
      var merged = Ep.ModelArray.create({content: models, session: session});
      return merged;
    });
  },

  refresh: function(model) {
    var session = this;
    // TODO: handle errors
    return this.adapter.refresh(model).then(function(refreshedModel) {
      return session.merge(refreshedModel);
    });
  },

  flush: function() {
    var session = this;
    // TODO: handle errors
    return this.adapter.flush(this).then(function(models) {
      models.forEach(function(model) {
        session.merge(model);
      });
    });
  }

});