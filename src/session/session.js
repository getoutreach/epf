import ModelArray from '../collections/model_array';
import ModelSet from '../collections/model_set';
import CollectionManager from './collection_manager';
import InverseManager from './inverse_manager';
import Model from '../model/model';
import ModelPromise from '../model/promise';
import Cache from './cache';
import TypeFactory from '../factories/type';
import MergeFactory from '../factories/merge';
import copy from '../utils/copy';
import Error from '../error';

var get = Ember.get, set = Ember.set;

var PromiseArray = Ember.ArrayProxy.extend(Ember.PromiseProxyMixin);

var uuid = 1;

export default class Session {

  constructor({adapter, idManager, container, parent}) {
    this.adapter = adapter;
    this.idManager = idManager;
    this.container = container;
    this.parent = parent;
    this.models = new ModelSet();
    this.collectionManager = new CollectionManager();
    this.inverseManager = new InverseManager(this);
    this.shadows = new ModelSet();
    this.originals = new ModelSet();
    this.newModels = new ModelSet();
    this.cache = new Cache();
    this.typeFactory = new TypeFactory(container);
    this.mergeFactory = new MergeFactory(container);
    this._dirtyCheckingSuspended = false;
    this.name = "session" + uuid++;
  }

  /**
    Instantiates a model but does *not* add it to the session. This is equivalent
    to calling `create` on the model's class itself.
    
    @method create
    @param {String} type the typeKey of the model
    @param {Object} hash the initial attributes of the model
    @return {Model} the instantiated model
  */
  build(type, hash) {
    type = this.typeFor(type);
    var model = type.create(hash || {});
    return model;
  }

  /**
    Creates a model within the session.
    
    @method create
    @param {String} type the typeKey of the model
    @param {Object} hash the initial attributes of the model
    @return {Model} the created model
  */
  create(type, hash) {
    var model = this.build(type, hash);
    return this.add(model);
  }

  adopt(model) {
    this.reifyClientId(model);
    console.assert(!model.session || model.session === this, "Models instances cannot be moved between sessions. Use `add` or `update` instead.");
    console.assert(!this.models.getModel(model) || this.models.getModel(model) === model, "An equivalent model already exists in the session!");

    if(model.isNew) {
      this.newModels.add(model);
    }
    // Only loaded models are stored on the session
    if(!model.session) {
      this.models.add(model);
      // Need to register with the inverse manager before being added to the
      // session. Otherwise, in a child session, the entire graph will be
      // materialized.
      this.inverseManager.register(model);
      model.session = this;
    }
    return model;
  }

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
  add(model) {
    this.reifyClientId(model);

    var dest = this.getModel(model);
    if(dest) return dest;
    
    if(model.session === this) return model;

    // If new and detached we can re-use. If the model is
    // detached but *not* new we have undefined semantics
    // so for the time being we just create a lazy copy.
    if(model.isNew && model.isDetached) {
      dest = model;
    } else if(model.isNew) {
      dest = model.copy();
      // TODO: we need to recurse here for new children, otherwise
      // they will become lazy
    } else {
      // TODO: model copy creates lazy copies for the
      // relationships. How do we update the inverse here?
      dest = model.lazyCopy();
    }
    return this.adopt(dest);
  }

  /**
    Removes the model from the session.

    This does not mean that the model has been necessarily deleted,
    just that the session should no longer keep track of it.

    @method remove
    @param {Ep.Model} model The model to remove from the session
  */
  remove(model) {
    // TODO: think through relationships that still reference the model
    this.models.remove(model);
    this.shadows.remove(model);
    this.originals.remove(model);
  }

  /**
    Updates a model in this session using the passed in model as a reference.

    If the passed in model is not already associated with this session, this
    is equivalent to adding the model to the session.

    If the model already is associated with this session, then the existing
    model will be updated.

    @method update
    @param {Ep.Model} model A model containing updated properties
  */
  update(model) {
    this.reifyClientId(model);
    var dest = this.getModel(model);

    if(model.isNew && !dest) {
      dest = model.constructor.create();
      // need to set the clientId for adoption
      dest.clientId = model.clientId;
      this.adopt(dest);
    }

    // if the model is detached or does not exist
    // in the target session, updating is semantically
    // equivalent to adding
    if(model.isDetached || !dest) {
      return this.add(model);
    }

    // handle deletion
    if(model.isDeleted) {
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
  }

  deleteModel(model) {
    // if the model is new, deleting should essentially just
    // remove the object from the session
    if(model.isNew) {
      var newModels = this.newModels;
      newModels.remove(model);
    } else {
      this.modelWillBecomeDirty(model);
    }
    model.isDeleted = true;
    this.collectionManager.modelWasDeleted(model);
    this.inverseManager.unregister(model);
  }

  /**
    Returns the model corresponding to the given typeKey and id
    or instantiates a new model if one does not exist.

    @returns {Model}
  */
  fetch(type, id) {
    type = this.typeFor(type);
    var typeKey = type.typeKey;
    // Always coerce to string
    id = id+'';

    var model = this.getForId(typeKey, id);
    // XXX: add isLoaded flag to model
    if(!model) {
      model = this.build(typeKey, {id: id});
      this.adopt(model);
    }

    return model;
  }

  /**
    Loads the model corresponding to the given typeKey and id.

    @returns {Promise}
  */
  load(type, id, opts) {
    var model = this.fetch(type, id);
    return this.loadModel(model, opts);
  }

  /**
    Ensures data is loaded for a model.

    @returns {Promise}
  */
  loadModel(model, opts) {
    console.assert(model.id, "Cannot load a model with an id");
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
  }

  find(type, query, opts) {
    if (Ember.typeOf(query) === 'object') {
      return this.query(type, query, opts);
    }
    return this.load(type, query, opts);
  }

  query(type, query, opts) {
    type = this.typeFor(type);
    var typeKey = type.typeKey;
    // TODO: return a model array immediately here
    // and also take into account errors
    var prom = this.adapter.query(typeKey, query, opts, this);
    return PromiseArray.create({promise:prom});
  }

  refresh(model, opts) {
    var session = this;
    return this.adapter.load(model, opts, this);
  }

  flush() {
    var session = this,
        dirtyModels = this.dirtyModels,
        newModels = this.newModels,
        shadows = this.shadows;

    // increment client revisions for all models
    // that could potentially be flushed
    dirtyModels.forEach(function(model) {
      model.clientRev += 1;
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
      if(shadow && (!original || original.rev < shadow.rev)) {
        this.originals.add(shadow);
      }
      this.markClean(model);
    }, this);
    newModels.clear();

    return promise;
  }

  getModel(model) {
    var res = this.models.getModel(model);
    if(!res && this.parent) {
      res = this.parent.getModel(model);
      if(res) {
        res = this.adopt(res.copy());
        // TODO: is there a better place for this?
        this.updateCache(res);
      }
    }
    return res;
  }

  getForId(typeKey, id) {
    var clientId = this.idManager.getClientId(typeKey, id);
    return this.getForClientId(clientId);
  }

  getForClientId(clientId) {
    var res = this.models.getForClientId(clientId);
    if(!res && this.parent) {
      res = this.parent.getForClientId(clientId);
      if(res) {
        res = this.adopt(res.copy());
        // TODO: is there a better place for this?
        this.updateCache(res);
      }
    }
    return res;
  }

  reifyClientId(model) {
    this.idManager.reifyClientId(model);
  }

  remoteCall(context, name, params, opts) {
    var session = this;

    if(opts && opts.deserializationContext && typeof opts.deserializationContext !== 'string') {
      opts.deserializationContext = get(opts.deserializationContext, 'typeKey');
    }

    return this.adapter.remoteCall(context, name, params, opts, this);
  }

  modelWillBecomeDirty(model) {
    if(this._dirtyCheckingSuspended) {
      return;
    }
    this.touch(model);
  }

  destroy() {
    this._super();
    this.models.forEach(function(model) {
      model.destroy();
    });
    this.models.destroy();
    this.shadows.destroy();
    this.originals.destroy();
    this.newModels.destroy();
  }

  get dirtyModels() {
    var models = new ModelSet(Array.from(this.shadows).map(function(model) {
      return this.models.getModel(model);
    }, this));

    this.newModels.forEach(function(model) {
      models.add(model);
    });

    return models;
  }

  suspendDirtyChecking(callback, binding) {
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
  }

  newSession() {
    var child = this.constructor.create({
      parent: this,
      adapter: this.adapter,
      container: this.container,
      idManager: this.idManager
    });
    return child;
  }

  /**
    Returns a model class for a particular key. Used by
    methods that take a type key (like `create`, `load`,
    etc.)

    @method typeFor
    @param {String} key
    @returns {subclass of DS.Model}
  */
  typeFor(key) {
    if (typeof key !== 'string') {
      return key;
    }

    return this.typeFactory.typeFor(key);
  }

  getShadow(model) {
    var shadows = this.shadows;
    var models = this.models;
    // shadows are only created when the model is dirtied,
    // if no model exists in the `shadows` property then
    // it is safe to assume the model has not been modified
    return shadows.getModel(model) || models.getModel(model);
  }

  /**
    @private

    Updates the promise cache
  */
  updateCache(model) {
    this.cache.addModel(model);
  }

  /**
    Invalidate the cache for a particular model. This has the
    effect of making the next `load` call hit the server.

    @method invalidate
    @param {Ep.Model} model
  */
  invalidate(model) {
    this.cache.removeModel(model);
  }

  /**
    Mark a model as clean. This will prevent future
    `flush` calls from persisting this model's state to
    the server until the model is marked dirty again.

    @method markClean
    @param {Ep.Model} model
  */
  markClean(model) {
    // as an optimization, model's without shadows
    // are assumed to be clean
    this.shadows.remove(model);
  }

  /**
    Mark a model as dirty. This will cause this model
    to be sent to the adapter during a flush.

    @method touch
    @param {Ep.Model} model
  */
  touch(model) {
    if(!model.isNew) {
      var shadow = this.shadows.getModel(model);
      if(!shadow) {
        this.shadows.addObject(model.copy())
      }
    }
  }


  /**
    Whether or not the session is dirty.

    @property isDirty
  */
  get isDirty() {
    return this.dirtyModels.size > 0;
  }


  /**
    Merge in raw serialized data into this session
    for the corresponding type.

    @method mergeData
    @param {Object} data the raw unserialized data
    @param String [typeKey] the name of the type that the data corresponds to
    @returns {any} the deserialized models that were merged in
  */
  mergeData(data, typeKey) {
    return this.adapter.mergeData(data, typeKey, this);
  }

  /**
    Update the parent session with all changes local
    to this child session.

    @method updateParent
  */
  updateParent() {
    if(!this.parent) {
      throw new Error("Session does not have a parent");
    }
    // flush all local updates to the parent session
    var dirty = this.dirtyModels,
        parent = this.parent;
    
    dirty.forEach(function(model) {
      // XXX: we want to do this, but we need to think about
      // revision numbers. The parent's clientRev needs to tbe
      // the childs normal rev.

      // "rebase" against parent version
      // var parentModel = parent.getModel(model);
      // if(parentModel) {
      //   this.merge(parentModel);
      // }
      
      // update the values of a corresponding model in the parent session
      // if a corresponding model doesn't exist, its added to the parent session
      parent.update(model); 
    }, this);
  }

  /**
    Similar to `flush()` with the additional effect that the models will
    be immediately updated in the parent session. This is useful when
    you want to optimistically assume success.

    @method flushIntoParent
  */
  flushIntoParent() {
    if(!this.parent) {
      throw new Error("Session does not have a parent");
    }
    this.updateParent();
    return this.flush();
  }


  /**
    Merges new data for a model into this session.

    If the corresponding model inside the session is "dirty"
    and has not been successfully flushed, the local changes
    will be merged against these changes.

    By default, if no server versioning information is specified,
    this data is assumed to be more current than what is in
    the session. If no client versioning information is specified,
    this data is assumed to have not seen the latest client changes.

    @method merge
    @param {Ep.Model} model The model to merge
    @param {Ember.Set} [visited] Cache used to break recursion. This is required for non-version-aware backends.
  */
  merge(model, visited) {
    if(this.parent) {
      model = this.parent.merge(model, visited);
    }

    this.reifyClientId(model);

    if(!visited) visited = new Ember.Set();

    if(visited.contains(model)) {
      return this.getModel(model);
    }
    visited.add(model);

    var adapter = this.adapter;
    adapter.willMergeModel(model);

    this.updateCache(model);

    var detachedChildren = [];
    // Since we re-use objects during merge if they are detached,
    // we need to precompute all detached children
    model.eachChild(function(child) {
      if(get(child, 'isDetached')) {
        detachedChildren.push(child);
      }
    }, this);

    var merged;

    if(model.hasErrors) {
      merged = this._mergeError(model);
    } else {
      merged = this._mergeSuccess(model);
    }

    if(model.meta){
      merged.meta = model.meta;
    }
    
    for(var i = 0; i < detachedChildren.length; i++) {
      var child = detachedChildren[i];
      this.merge(child, visited);
    }

    adapter.didMergeModel(model);
    return merged;
  }

  mergeModels(models) {
    var merged = ModelArray.create({session: this, content: []});
    merged.meta = models.meta;
    var session = this;
    models.forEach(function(model) {
      merged.pushObject(session.merge(model));
    });
    return merged;
  }

  _mergeSuccess(model) {
    var models = this.models,
        shadows = this.shadows,
        newModels = this.newModels,
        originals = this.originals,
        merged,
        ancestor,
        existing = models.getModel(model);

    if(existing && this._containsRev(existing, model)) {
      return existing;
    }

    var hasClientChanges = !existing || this._containsClientRev(model, existing);

    if(hasClientChanges) {
      // If has latest client rev, merge against the shadow
      ancestor = shadows.getModel(model);
    } else {
      // If doesn't have the latest client rev, merge against original
      ancestor = originals.getModel(model);
    }

    this.suspendDirtyChecking(function() {
      merged = this._mergeModel(existing, ancestor, model);
    }, this);

    if(hasClientChanges) {
      // after merging, if the record is deleted, we remove
      // it entirely from the session
      if(get(merged, 'isDeleted')) {
        this.remove(merged);
      } else {
        // After a successful merge we update the shadow to the
        // last known value from the server. As an optimization,
        // we only create shadows if the model has been dirtied.
        if(shadows.contains(model)) {
          // TODO: should remove unless client has unflushed changes
          shadows.addData(model);
        }

        // Once the server has seen our local changes, the original
        // is no longer needed
        originals.remove(model);

        if(!get(merged, 'isNew')) {
          newModels.remove(merged);
        }
      }
    } else {
      // TODO: what should we do with the shadow if the merging ancestor
      // is the original? In order to update, it would require knowledge
      // of how the server handles merging (if at all)
    }
    
    // clear the errors on the merged model
    // TODO: we need to do a proper merge here
    merged.errors = null;
    
    return merged;
  }

  _mergeError(model) {
    var models = this.models,
        shadows = this.shadows,
        newModels = this.newModels,
        originals = this.originals,
        merged,
        ancestor,
        existing = models.getModel(model);

    if(!existing) {
      // Two cases where this would happen:
      // 1. Load errors
      // 2. Error during create inside child session
      return model;
    }

    var hasClientChanges = this._containsClientRev(model, existing);
    if(hasClientChanges) {
      // If has latest client rev, merge against the shadow.

      // If a shadow does not exist this could be an error during
      // a create operation. In this case, if the server has seen
      // the client's changes we should merge using the new model
      // as the ancestor. This case could happen if the server manipulates
      // the response to return valid values without saving.
      ancestor = shadows.getModel(model) || existing;
    } else {
      // If doesn't have the latest client rev, merge against original
      ancestor = originals.getModel(model);
    }

    // only merge if we haven't already seen this version
    if(ancestor && !this._containsRev(existing, model)) {
      this.suspendDirtyChecking(function() {
        merged = this._mergeModel(existing, ancestor, model);
      }, this);
    } else {
      merged = existing;
    }

    // set the errors on the merged model
    // TODO: we need to do a proper merge here
    merged.errors = copy(model.errors);
 
    if(!model.isNew) {
      // "rollback" the shadow to have what was returned by the server
      shadows.addData(model);

      // the shadow is now the server version, so no reason to
      // keep the original around
      originals.remove(model);
    }

    return merged;
  }

  _mergeModel(dest, ancestor, model) {
    // if the model does not exist, no "merging"
    // is required
    if(!dest) {
      if(model.isDetached) {
        dest = model;
      } else {
        dest = model.copy();
      }

      this.adopt(dest);
      return dest;
    }

    // set id for new records
    dest.id = model.id;
    dest.clientId = model.clientId;
    // copy the server revision
    dest.rev = model.rev;
    dest.isDeleted = model.isDeleted;

    //XXX: why do we need this? at this point shouldn't the dest always be in
    // the session?
    this.adopt(dest);

    // as an optimization we might not have created a shadow
    if(!ancestor) {
      ancestor = dest;
    }
    
    // Reify child client ids before merging. This isn't semantically
    // required, but many data structures that might be used in the merging
    // process use client ids.
    model.eachChild(function(child) {
      this.reifyClientId(child);
    }, this);

    var strategy = this.mergeFactory.mergeFor(model.typeKey);
    strategy.merge(dest, ancestor, model);

    return dest;
  }

  _containsRev(modelA, modelB) {
    if(!get(modelA, 'rev')) return false;
    if(!get(modelB, 'rev')) return false;
    return get(modelA, 'rev') >= get(modelB, 'rev');
  }

  _containsClientRev(modelA, modelB) {
    return get(modelA, 'clientRev') >= get(modelB, 'clientRev');
  }
  
  toString() {
    var res = this.name;
    if(this.parent) {
      res += "(child of " + this.parent.toString() + ")";
    }
    return res;
  }

}

// necessary to play with ember's container
Session.create = function(props) { return new this(props) };
