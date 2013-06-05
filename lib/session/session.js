var get = Ember.get, set = Ember.set;

require('../collections/model_array');
require('../collections/model_set');
require('./collection_manager');
require('./belongs_to_manager');
require('../model');

Ep.SessionMixin = Ember.Mixin.create({

  init: function() {
    this._super.apply(this, arguments);
    this.models = Ep.ModelSet.create();
    this.orphans = Ember.Set.create();
    this.collectionManager = Ep.CollectionManager.create();
    this.belongsToManager = Ep.BelongsToManager.create();
    if(!this.mergeStrategy) this.mergeStrategy = Ep.MergeStrategy;
  },

  lookupType: function(type) {
    return this.container.lookup('model:' + type);
  },

  merge: function(model, strategy) {
    this.reifyClientId(model);
    if(!strategy) strategy = get(this, 'mergeStrategy').create();
    var merged = model.merge(this, strategy);
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
  },

  modelWillBecomeDirty: function(model) {
    // NO-OP by default
  },

});

Ep.Session = Ember.Object.extend(Ep.SessionMixin, {

  _flushing: false,
  _dirtyCheckingSuspended: false,

  init: function() {
    this._super.apply(this, arguments);
    this.shadows = Ep.ModelSet.create();
    this.newModels = Ep.ModelSet.create();
  },

  create: function(type, hash) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var model = type.create(hash);
    this.store.reifyClientId(model);
    // TODO: re-use models again
    return this.merge(model);
  },

  update: function(model) {
    // TODO: the difference between merge and update
    // should be around updating the shadow copy
    // right now that is just done at the end of flush
    // so it doesn't matter
    var merged;
    var args = arguments;
    // unlike merge, we don't suspend dirty checking
    merged = this.constructor.proto().merge.apply(this, args);
    if(get(merged, 'isNew')) {
      this.newModels.addObject(merged);
    }
    return merged;
  },

  merge: function(model, strategy) {
    var merged;
    var args = arguments;
    this.suspendDirtyChecking(function() {
      merged = this._super.apply(this, args);
    }, this);
    if(get(merged, 'isNew')) {
      this.newModels.addObject(merged);
    }
    return merged;
  },

  deleteModel: function(model) {
    this.modelWillBecomeDirty(model);
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
    if (Ember.typeOf(query) === 'object') {
      return this.findQuery(type, query);
    }
    return this.load(type, query);
  },

  findQuery: function(type, query) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var session = this;
    return this.adapter.findQuery(type, query).then(function(models) {
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
    if(this._flushing) {
      // TODO: remove this lock and make concurrent
      throw new Ember.Error("Must wait until previous flush completes");
    }
    var session = this;
    this._flushing = true;
    // TODO: handle errors
    return this.adapter.flush(this).then(function(models) {
      models.forEach(function(model) {
        session.merge(model);
        session._flushing = false;
        // TODO: move this to reset method
        session.shadows = Ep.ModelSet.create();
        session.newModels = Ep.ModelSet.create();
      });
      return models;
    });
  },

  getForId: function(type, id) {
    var clientId = this.store.getClientId(type, id);
    return this.models.getForClientId(clientId);
  },

  reifyClientId: function(model) {
    this.store.reifyClientId(model);
  },

  remoteCall: function(context, name) {
    var session = this;
    return this.adapter.remoteCall.apply(this.adapter, arguments).then(function(model) {
      return session.merge(model);
    });
  },

  modelWillBecomeDirty: function(model) {
    if(this._dirtyCheckingSuspended) {
      return;
    }
    if(this._flushing) {
      // TODO: remove this lock and make concurrent
      throw new Ember.Error("Cannot dirty models while flushing.");
    }
    this._super(model);
    if(this.newModels.contains(model)) return;
    var shadow = this.shadows.getModel(model);
    if(!shadow) {
      shadow = model.copy();
      this.shadows.addObject(shadow);
      // increment local revision
      model.incrementProperty('clientRevision');
    }
  },

  destroy: function() {
    this._super();
    this.newModels.destroy();
    this.shadows.destroy();
  },

  dirtyModels: Ember.computed(function() {
    return this.shadows.map(function(model) {
      return this.models.getModel(model);
    }, this).addObjects(this.newModels);
  }).volatile(),

  suspendDirtyChecking: function(callback, binding) {
    var self = this;

    // could be nested
    if(this._dirtyCheckingSuspended) {
      return callback.call(binding || self);
    }

    try {
      this._dirtyCheckingSuspended = true;
      callback.call(binding || self);
    } finally {
      this._dirtyCheckingSuspended = false;
    }
  },

  newSession: function() {
    return Ep.ChildSession.create({
      container: this.container,
      parent: this,
      store: this.store
    });
  }

});

Ep.ChildSession = Ep.Session.extend({

  init: function() {
    this._super.apply(this, arguments);

    var child = this,
        parent = this.parent;

    this.adapter = Ep.Adapter.createWithMixins({
      load: function() {
        return parent.load.apply(parent, arguments);
      },

      findQuery: function() {
        return parent.findQuery.apply(parent, arguments);
      },

      refresh: function() {
        return parent.refresh.apply(parent, arguments);
      },

      flush: function() {
        var dirty = get(child, 'dirtyModels');
        dirty.forEach(function(model) {
          parent.update(model);
        });
        return parent.flush.apply(parent, arguments);
      }
    });
  },


});