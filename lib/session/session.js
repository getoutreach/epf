var get = Ember.get, set = Ember.set;

require('../collections/model_array');
require('../collections/model_set');
require('./collection_manager');
require('./belongs_to_manager')

Ep.SessionMixin = Ember.Mixin.create({

  init: function() {
    this._super.apply(this, arguments);
    this.models = Ep.ModelSet.create();
    this.orphans = Ember.Set.create();
    this.collectionManager = Ep.CollectionManager.create();
    this.belongsToManager = Ep.BelongsToManager.create();
  },

  lookupType: function(type) {
    return this.container.lookup('model:' + type);
  },

  merge: function(model, cache) {
    this.reifyClientId(model);
    var merged = model.merge(this, cache);
    // relationships set during create and relationships
    // from detached instances must be registered
    // (normally done through observers)
    if(model === merged) {
      model._registerRelationships();
    }
    return merged;
  },

  remove: function(model) {
    // TODO: what does this mean for all relationships of the model in the session?
    // TODO: can models be removed?
    return this.models.remove(model);
  },

  add: function(model) {
    Ember.assert("Models cannot be moved between sessions. Use `merge` instead.", !get(model, 'session') || get(model, 'session') === this);
    set(model, 'session', this);
    // It is possible that we are adding a model to the cache
    // which will replace a previously added lazy model.
    // This lazy model could still be used elsewhere, but we
    // keep track of it in `orphans` to clean up later.
    var existing = this.models.getModel(model);
    if(existing && existing !== model) {
      this.models.remove(existing);
      this.orphans.add(existing);
    }
    this.models.add(model);
    return model;
  },

  getModel: function(model) {
    return this.models.getModel(model);
  },

  getForId: function(type, id) {
    throw new Ember.Error("Not implemented");
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
    this.models.destroy();
    this.collectionManager.destroy();
    this.belongsToManager.destroy();
    this.adapter.sessionWasDestroyed(this);
  }

});

Ep.Session = Ember.Object.extend(Ep.SessionMixin, {

  create: function(type, hash) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var model = type.create(hash);
    this.store.reifyClientId(model);
    // since the model is un-attached to a session, merge
    // will re-use it
    this.merge(model);
    return model;
  },

  deleteModel: function(model) {
    set(model, 'isDeleted', true);
    this.collectionManager.modelWasDeleted(model);
    this.belongsToManager.modelWasDeleted(model);
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
  },

  getForId: function(type, id) {
    var clientId = this.store.getClientId(type, id);
    return this.models.getForClientId(clientId);
  },

  reifyClientId: function(model) {
    this.store.reifyClientId(model);
  }

});