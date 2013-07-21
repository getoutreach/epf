require('../collections/model_array');
require('../collections/model_set');
require('./collection_manager');
require('./belongs_to_manager');
require('../model');
require('./merge_strategies');

var get = Ember.get, set = Ember.set;

Ep.Session = Ember.Object.extend({

  mergeStrategy: Ep.PerField,

  _dirtyCheckingSuspended: false,

  init: function() {
    this._super.apply(this, arguments);
    this.models = Ep.ModelSet.create();
    this.collectionManager = Ep.CollectionManager.create();
    this.belongsToManager = Ep.BelongsToManager.create();
    this.shadows = Ep.ModelSet.create();
    this.originals = Ep.ModelSet.create();
    this.newModels = Ep.ModelSet.create();
  },

  create: function(type, hash) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var model = type.create(hash);
    model = this.add(model);
    // relationships set during create and relationships
    // from detached instances must be registered
    // (normally done through observers)
    model._registerRelationships();
    return model;
  },

  adopt: function(model) {
    Ember.assert("Models instances cannot be moved between sessions. Use `add` or `update` instead.", !get(model, 'session') || get(model, 'session') === this);
    set(model, 'session', this);
    if(get(model, 'isNew')) {
      this.newModels.add(model);
    }
    // This will overwrite an existing model with the same
    // clientId. This is useful to evict proxies
    this.models.add(model);

    // relationships set during create and relationships
    // from detached instances must be registered
    // (normally done through observers)
    model._registerRelationships();
    return model;
  },

  /**
    Adds a model to this session. Some cases below:

    If the model is detached (meaning not current associated with a session),
    then the model will be re-used in this session. The entire graph of detached
    objects will be traversed and added to the session.

    If the model is already associated with this session in *loaded form* (not necessarily
    the same instance that is passed in), this method is a NO-OP.

    If the model is already associated with a *different* session then the model
    will be copied to this session. In order to prevent large graphs from being
    copied, all relations will be copied in lazily.

    @method add
    @param {Ep.Model} model The model to add to the session
    @param {Number} [depth=2] The depth of relationships to eagerly traverse for before adding lazily
  */
  add: function(model, depth) {
    this.reifyClientId(model);
    var dest = this.getModel(model);
    if(dest && get(dest, 'isLoaded')) return dest;

    if(typeof depth === 'undefined') {
      depth = 2;
    }

    depth--;

    if(get(model, 'isProxy')) {
      var content = get(model, 'content');
      if(content) {
        return this.add(content);
      }
      dest = model.lazyCopy();
      return this.adopt(dest);
    }

    // re-use if detached
    if(get(model, 'isDetached')) {
      dest = model;
    } else {
      dest = model.constructor.create();
      model.copyAttributes(dest);
    }

    this.adopt(dest);

    model.eachRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        var child = get(model, name);
        if(child) {
          // It is possible we are adding a detached model
          // that has a child set to a model inside this session.
          // In this case we simply trigger observers to updated inverses
          if(get(child, 'session') === this) {
            model.belongsToDidChange(model, name);
          } else {
            if(depth >= 0 || get(child, 'isDetached') || get(child, 'isNew')) {
              child = this.add(child, depth);
            } else {
              child = child.lazyCopy();
            }

            // TODO: think through suspending during add more in depth
            dest.suspendRelationshipObservers(function() {
              set(dest, name, child);
            });
          }
        }
      } else if(relationship.kind === 'hasMany') {
        var children = get(model, name);
        var copied = children.map(function(child) {
          if(depth >= 0 || get(child, 'isDetached') || get(child, 'isNew')) {
            child = this.add(child, depth);
          } else {
            child = child.lazyCopy();
          }
          return child;
        }, this);
        set(dest, name, copied);
      }
    }, this);

    return dest;
  },

  /**
    Removes the model from the session.

    This does not mean that the model has been necessarily deleted,
    just that the session should no longer keep track of it.

    @method remove
    @param {Ep.Model} model The model to remove from the session
  */
  remove: function(model) {
    // TODO: think through relationships that still reference the model
    get(this, 'models').remove(model);
    get(this, 'shadows').remove(model);
    get(this, 'originals').remove(model);
  },

  /**
    Updates a model in this session using the passed in model as a reference.

    If the passed in model is not already associated with this session, this
    is equivalent to adding the model to the session.

    If the model already is associated with this session, then the existing
    model will be updated.

    @method update
    @param {Ep.Model} model A model containing updated properties
  */
  update: function(model) {
    this.reifyClientId(model);
    if(get(model, 'isProxy')) {
      var content = get(model, 'content');
      if(content) {
        return this.update(content);
      }
      throw new Ember.Error("Cannot update with an unloaded model: " + model.toString());
    }
    var dest = this.getModel(model);

    // if the model is detached or does not exist
    // in the target session, updating is semantically
    // equivalent to adding
    if(get(model, 'isDetached') || !dest || !get(dest, 'isLoaded')) {
      return this.add(model);
    }

    // handle deletion
    if(get(model, 'isDeleted')) {
      // no-op if already deleted
      if(!get(dest, 'isDeleted')) {
        this.deleteModel(dest);
      }
      return dest;
    }

    model.copyAttributes(dest);

    model.eachRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        var child = get(model, name);
        if(child) {
          set(dest, name, child);
        }
      } else if(relationship.kind === 'hasMany') {
        var children = get(model, name);
        var destChildren = get(dest, name);
        children.copyTo(destChildren);
      }
    }, this);

    return dest;
  },

  deleteModel: function(model) {
    // if the model is new, deleting should essentially just
    // remove the object from the session
    if(get(model, 'isNew')) {
      var newModels = get(this, 'newModels');
      newModels.remove(model);
    } else {
      this.modelWillBecomeDirty(model);
    }
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
    }

    var session = this;
    return Ep.resolveModel(this.adapter.load(type, id).then(function(model) {
      return session.merge(model);
    }, function(model) {
      throw session.merge(model);
    }), type, id, session);
  },

  find: function(type, query) {
    if (Ember.typeOf(query) === 'object') {
      return this.query(type, query);
    }
    return this.load(type, query);
  },

  query: function(type, query) {
    if(typeof type === "string") {
      type = this.lookupType(type);
    }
    var session = this;
    // TODO: return a model array immediately here
    // and also take into account errors
    return this.adapter.query(type, query).then(function(models) {
      // TODO: model array could automatically add to session?
      var merged = Ep.ModelArray.create({session: session, content: []});
      set(merged, 'meta', get(models, 'meta'));
      models.forEach(function(model) {
        merged.addObject(session.merge(model));
      });
      return merged;
    });
  },

  refresh: function(model) {
    var session = this;
    return this.adapter.refresh(model).then(function(refreshedModel) {
      return session.merge(refreshedModel);
    }, function(refreshedModel) {
      throw session.merge(refreshedModel);
    });
  },

  flush: function() {
    var session = this,
        dirtyModels = get(this, 'dirtyModels'),
        newModels = get(this, 'newModels'),
        shadows = get(this, 'shadows');

    // increment client revisions for all models
    // that could potentially be flushed
    dirtyModels.forEach(function(model) {
      model.incrementProperty('clientRev');
    }, this);
    
    // the adapter will return a list of models regardless
    // of whether the flush succeeded. it is in the merge
    // logic that the errors property of the model is consumed
    var promise = this.adapter.flush(this).then(function(models) {
      var res = models.map(function(model) {
        return session.merge(model);
      });
      return res;
    }, function(models) {
      var res = models.map(function(model) {
        return session.merge(model);
      });
      throw res;
    });

    // optimistically assume updates will be
    // successful update shadows with current
    // models and add shadow to originals
    dirtyModels.forEach(function(model) {
      // track original to merge against new data that
      // hasn't seen client updates
      this.originals.add(shadows.getModel(model));
      // we remove from the shadow, this is an optimization
      // when the model becomes dirty it will be re-added
      this.shadows.remove(model);
    }, this);
    newModels.clear();

    return promise;
  },

  getModel: function(model) {
    return this.models.getModel(model);
  },

  getForId: function(type, id) {
    var clientId = this.adapter.getClientId(type, id);
    return this.models.getForClientId(clientId);
  },

  reifyClientId: function(model) {
    this.adapter.reifyClientId(model);
  },

  remoteCall: function(context, name) {
    var session = this;
    return this.adapter.remoteCall.apply(this.adapter, arguments).then(function(model) {
      return session.merge(model);
    }, function(model) {
      throw session.merge(model);
    });
  },

  modelWillBecomeDirty: function(model) {
    if(this._dirtyCheckingSuspended || get(model, 'isNew')) {
      return;
    }
    var shadow = this.shadows.getModel(model);
    if(!shadow) {
      shadow = model.copy();
      this.shadows.addObject(shadow);
    }
  },

  destroy: function() {
    this._super();
    this.models.forEach(function(model) {
      model.destroy();
    });
    this.models.destroy();
    this.collectionManager.destroy();
    this.belongsToManager.destroy();
    this.shadows.destroy();
    this.originals.destroy();
    this.newModels.destroy();
  },

  dirtyModels: Ember.computed(function() {
    var models = Ep.ModelSet.fromArray(this.shadows.map(function(model) {
      return this.models.getModel(model);
    }, this));

    get(this, 'newModels').forEach(function(model) {
      models.add(model);
    });

    return models;
  }).volatile(),

  suspendDirtyChecking: function(callback, binding) {
    var self = this;

    // could be nested
    if(this._dirtyCheckingSuspended) {
      return callback.call(binding || self);
    }

    try {
      this._dirtyCheckingSuspended = true;
      return callback.call(binding || self);
    } finally {
      this._dirtyCheckingSuspended = false;
    }
  },

  newSession: function() {
    var child = this.container.lookup('session:child');
    set(child, 'parent', this);
    return child;
  },

  lookupType: function(type) {
    return this.container.lookup('model:' + type);
  },

  getShadow: function(model) {
    var shadows = get(this, 'shadows');
    var models = get(this, 'models');
    // shadows are only created when the model is dirtied,
    // if no model exists in the `shadows` property then
    // it is safe to assume the model has not been modified
    return shadows.getModel(model) || models.getModel(model);
  }

});