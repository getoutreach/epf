import ModelArray from '../collections/model_array';
import ModelSet from '../collections/model_set';
import CollectionManager from './collection_manager';
import InverseManager from './inverse_manager';
import Model from '../model/model';
import ModelPromise from '../model/promise';
import Cache from './cache';

var get = Ember.get, set = Ember.set;

var PromiseArray = Ember.ArrayProxy.extend(Ember.PromiseProxyMixin);

export default Ember.Object.extend({
  _dirtyCheckingSuspended: false,

  init: function() {
    this._super.apply(this, arguments);
    this.models = ModelSet.create();
    this.collectionManager = CollectionManager.create();
    this.inverseManager = InverseManager.create({session: this});
    this.shadows = ModelSet.create();
    this.originals = ModelSet.create();
    this.newModels = ModelSet.create();
    this.cache = Cache.create();
  },

  /**
    Instantiates a model but does *not* add it to the session. This is equivalent
    to calling `create` on the model's class itself.
    
    @method create
    @param {String} type the typeKey of the model
    @param {Object} hash the initial attributes of the model
    @return {Model} the instantiated model
  */
  build: function(type, hash) {
    type = this.typeFor(type);
    var model = type.create(hash || {});
    return model;
  },

  /**
    Creates a model within the session.
    
    @method create
    @param {String} type the typeKey of the model
    @param {Object} hash the initial attributes of the model
    @return {Model} the created model
  */
  create: function(type, hash) {
    var model = this.build(type, hash);
    return this.add(model);
  },

  adopt: function(model) {
    this.reifyClientId(model);
    Ember.assert("Models instances cannot be moved between sessions. Use `add` or `update` instead.", !get(model, 'session') || get(model, 'session') === this);
    Ember.assert("An equivalent model already exists in the session!", !this.models.getModel(model) || this.models.getModel(model) === model);

    if(get(model, 'isNew')) {
      this.newModels.add(model);
    }
    // Only loaded models are stored on the session
    if(!get(model, 'session')) {
      this.models.add(model);
      // Need to register with the inverse manager before being added to the
      // session. Otherwise, in a child session, the entire graph will be
      // materialized.
      this.inverseManager.register(model);
    }
    set(model, 'session', this);
    return model;
  },

  /**
    Adds a model to this session. Some cases below:

    If the model is detached (meaning not currently associated with a session),
    then the model will be re-used in this session. The entire graph of detached
    objects will be traversed and added to the session.

    If the model is already associated with this session in *loaded form* (not necessarily
    the same instance that is passed in), this method is a NO-OP.

    If the model is already associated with a *different* session then the model
    will be copied to this session. In order to prevent large graphs from being
    copied, all relations will be copied in lazily.

    TODO: when adding *non-new* models we should think through the semantics.
    For now we assume this only works with new models or models from a parent session.

    @method add
    @param {Ep.Model} model The model to add to the session
  */
  add: function(model) {
    this.reifyClientId(model);

    var dest = this.getModel(model);
    if(dest) return dest;
    
    if(get(model, 'session') === this) return model;

    // If new and detached we can re-use. If the model is
    // detached but *not* new we have undefined semantics
    // so for the time being we just create a lazy copy.
    if(get(model, 'isNew') && get(model, 'isDetached')) {
      dest = model;
    } else if(get(model, 'isNew')) {
      dest = model.copy();
      // TODO: we need to recurse here for new children, otherwise
      // they will become lazy
    } else {
      // TODO: model copy creates lazy copies for the
      // relationships. How do we update the inverse here?
      dest = model.lazyCopy();
    }
    return this.adopt(dest);
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
    var dest = this.getModel(model);

    if(get(model, 'isNew') && !dest) {
      dest = get(model, 'type').create();
      // need to set the clientId for adoption
      set(dest, 'clientId', get(model, 'clientId'));
      this.adopt(dest);
    }

    // if the model is detached or does not exist
    // in the target session, updating is semantically
    // equivalent to adding
    if(get(model, 'isDetached') || !dest) {
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
    model.copyMeta(dest);

    model.eachLoadedRelationship(function(name, relationship) {
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
    this.inverseManager.unregister(model);
  },

  /**
    Returns the model corresponding to the given typeKey and id
    or instantiates a new model if one does not exist.

    @returns {Model}
  */
  fetch: function(type, id) {
    type = this.typeFor(type);
    var typeKey = get(type, 'typeKey');
    // Always coerce to string
    id = id+'';

    var model = this.getForId(typeKey, id);
    // XXX: add isLoaded flag to model
    if(!model) {
      model = this.build(typeKey, {id: id});
      this.adopt(model);
    }

    return model;
  },

  /**
    Loads the model corresponding to the given typeKey and id.

    @returns {Promise}
  */
  load: function(type, id, opts) {
    var model = this.fetch(type, id);
    return this.loadModel(model, opts);
  },

  /**
    Ensures data is loaded for a model.

    @returns {Promise}
  */
  loadModel: function(model, opts) {
    Ember.assert("Cannot load a model with an id", get(model, 'id'));
    // TODO: this should be done on a per-attribute bases
    var promise = this.cache.getPromise(model);

    if(promise) {
      // the cache's promise is not guaranteed to return anything
      promise = promise.then(function() {
        return model;
      });
    } else {
      // XXX: refactor adapter api to use model
      promise = this.adapter.load(model, opts, this);
      this.cache.addPromise(model, promise);
    }

    promise = ModelPromise.create({
      content: model,
      promise: promise
    });

    return promise;
  },

  find: function(type, query, opts) {
    if (Ember.typeOf(query) === 'object') {
      return this.query(type, query, opts);
    }
    return this.load(type, query, opts);
  },

  query: function(type, query, opts) {
    type = this.typeFor(type);
    var typeKey = get(type, 'typeKey');
    // TODO: return a model array immediately here
    // and also take into account errors
    var prom = this.adapter.query(typeKey, query, opts, this);
    return PromiseArray.create({promise:prom});
  },

  refresh: function(model, opts) {
    var session = this;
    return this.adapter.load(model, opts, this);
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
    var promise = this.adapter.flush(this);

    // Optimistically assume updates will be
    // successful. Copy shadow models into
    // originals and remove the shadow.
    dirtyModels.forEach(function(model) {
      // track original to merge against new data that
      // hasn't seen client updates
      var original = this.originals.getModel(model);
      var shadow = this.shadows.getModel(model);
      if(shadow && (!original || original.get('rev') < shadow.get('rev'))) {
        this.originals.add(shadow);
      }
      this.markClean(model);
    }, this);
    newModels.clear();

    return promise;
  },

  getModel: function(model) {
    return this.models.getModel(model);
  },

  getForId: function(typeKey, id) {
    var clientId = this.idManager.getClientId(typeKey, id);
    return this.getForClientId(clientId);
  },

  getForClientId: function(clientId) {
    return this.models.getForClientId(clientId);
  },

  reifyClientId: function(model) {
    this.idManager.reifyClientId(model);
  },

  remoteCall: function(context, name, params, opts) {
    var session = this;

    if(opts && opts.deserializationContext && typeof opts.deserializationContext !== 'string') {
      opts.deserializationContext = get(opts.deserializationContext, 'typeKey');
    }

    return this.adapter.remoteCall(context, name, params, opts, this);
  },

  modelWillBecomeDirty: function(model) {
    if(this._dirtyCheckingSuspended) {
      return;
    }
    this.touch(model);
  },

  destroy: function() {
    this._super();
    this.models.forEach(function(model) {
      model.destroy();
    });
    this.models.destroy();
    this.collectionManager.destroy();
    this.inverseManager.destroy();
    this.shadows.destroy();
    this.originals.destroy();
    this.newModels.destroy();
  },

  dirtyModels: Ember.computed(function() {
    var models = ModelSet.fromArray(this.shadows.map(function(model) {
      return this.models.getModel(model);
    }, this));

    get(this, 'newModels').forEach(function(model) {
      models.add(model);
    });

    return models;
  }).property('shadows.[]', 'newModels.[]'),

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
    var Child = this.container.lookupFactory('session:child');
    var child = Child.create({
      parent: this,
      adapter: this.adapter
    });
    return child;
  },

  /**
    Returns a model class for a particular key. Used by
    methods that take a type key (like `create`, `load`,
    etc.)

    @method typeFor
    @param {String} key
    @returns {subclass of DS.Model}
  */
  typeFor: function(key) {
    if (typeof key !== 'string') {
      return key;
    }

    var factory = this.container.lookupFactory('model:'+key);

    Ember.assert("No model was found for '" + key + "'", factory);

    factory.session = this;
    factory.typeKey = key;

    return factory;
  },

  getShadow: function(model) {
    var shadows = get(this, 'shadows');
    var models = get(this, 'models');
    // shadows are only created when the model is dirtied,
    // if no model exists in the `shadows` property then
    // it is safe to assume the model has not been modified
    return shadows.getModel(model) || models.getModel(model);
  },

  /**
    @private

    Updates the promise cache
  */
  updateCache: function(model) {
    this.cache.addModel(model);
  },

  /**
    Invalidate the cache for a particular model. This has the
    effect of making the next `load` call hit the server.

    @method invalidate
    @param {Ep.Model} model
  */
  invalidate: function(model) {
    this.cache.removeModel(model);
  },

  /**
    Mark a model as clean. This will prevent future
    `flush` calls from persisting this model's state to
    the server until the model is marked dirty again.

    @method markClean
    @param {Ep.Model} model
  */
  markClean: function(model) {
    // as an optimization, model's without shadows
    // are assumed to be clean
    this.shadows.remove(model);
  },

  /**
    Mark a model as dirty. This will cause this model
    to be sent to the adapter during a flush.

    @method touch
    @param {Ep.Model} model
  */
  touch: function(model) {
    if(!get(model, 'isNew')) {
      var shadow = this.shadows.getModel(model);
      if(!shadow) {
        this.shadows.addObject(model.copy())
      }
    }
  },


  /**
    Whether or not the session is dirty.

    @property isDirty
  */
  isDirty: Ember.computed(function() {
    return get(this, 'dirtyModels.length') > 0;
  }).property('dirtyModels.length'),


  /**
    Merge in raw serialized data into this session
    for the corresponding type.

    @method mergeData
    @param {Object} data the raw unserialized data
    @param String [typeKey] the name of the type that the data corresponds to
    @returns {any} the deserialized models that were merged in
  */
  mergeData: function(data, typeKey) {
    return this.adapter.mergeData(data, typeKey, this);
  }

});