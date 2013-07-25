var get = Ember.get, set = Ember.set;

Ep.Session.reopen({

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
    @param {Ep.MergeStrategy} [strategy] The merge strategy to use
  */
  merge: function(model, strategy) {
    this.reifyClientId(model);

    if(get(model, 'hasErrors')) {
      return this._mergeError(model, strategy);
    } else {
      return this._mergeSuccess(model, strategy);
    }
  },

  _mergeSuccess: function(model, strategy) {
    var models = get(this, 'models'),
        shadows = get(this, 'shadows'),
        newModels = get(this, 'newModels'),
        originals = get(this, 'originals'),
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
      merged = this._mergeModel(existing, ancestor, model, strategy);
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
        if(shadows.contains(model) && get(model, 'isLoaded')) {
          // TODO: should remove unless client has unflushed changes
          shadows.add(model);
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
    return merged;
  },

  _mergeError: function(model, strategy) {
    var models = get(this, 'models'),
        shadows = get(this, 'shadows'),
        newModels = get(this, 'newModels'),
        originals = get(this, 'originals'),
        merged,
        ancestor,
        existing = models.getModel(model);

    if(!existing) {
      // In the case of a load error, we do not want the model in the session
      Ember.assert("Errors returned for non-existant model: " + model.toString(), model instanceof Ep.LoadError);
      return model;
    }

    // in the error case, it is assumed that the server
    // did not apply the client's changes
    ancestor = originals.getModel(model); // might be null during create

    // only merge if we haven't already seen this version
    if(ancestor && !this._containsRev(existing, model)) {
      this.suspendDirtyChecking(function() {
        merged = this._mergeModel(existing, ancestor, model, strategy);
      }, this);
    } else {
      merged = existing;
    }

    // set the errors on the merged model
    set(merged, 'errors', Ember.copy(get(model, 'errors')));

    if(get(model, 'isLoaded')) {
      // "rollback" the shadow to have what was returned by the server
      shadows.add(model);

      // the shadow is now the server version, so no reason to
      // keep the original around
      originals.remove(model);
    }

    return merged;
  },

  _mergeModel: function(dest, ancestor, model, strategy) {
    if(!strategy) strategy = get(this, 'mergeStrategy').create({session: this});

    if(model === dest) {
      // TODO: when do we get here?
      // TODO: throw error?
      return model;
    }

    if(get(model, 'isPromise')) {
      return this._mergePromise(dest, ancestor, model, strategy);
    }

    var promise;

    if(dest && get(dest, 'isPromise')) {
      // if the destination is a promise we want to
      // merge it's content
      promise = dest;
      dest = dest.content;
    }

    if(!dest) {
      dest = model.constructor.create();
      if(promise) {
        // update the content of the promise so any lingering
        // references will still function
        promise.resolve(dest);
      }
    }

    // once it comes back from the server, it cannot be new
    if(!get(model, 'hasErrors')) {
     set(dest, 'isNew', false);
    }
    // set id for new records
    set(dest, 'id', get(model, 'id'));
    set(dest, 'clientId', get(model, 'clientId'));
    // copy the server revision
    set(dest, 'rev', get(model, 'rev'));
    set(dest, 'isDeleted', get(model, 'isDeleted'));

    this.adopt(dest);

    // as an optimization we might not have created a shadow
    if(!ancestor) {
      ancestor = dest;
    }

    strategy.merge(dest, ancestor, model);

    return dest;
  },

  // Delegate to the content of the promise
  _mergePromise: function(dest, ancestor, promise, strategy) {
    var content = get(promise, 'content');
    if(content) {
      return this._mergeModel(dest, ancestor, content, strategy);
    }

    // otherwise keep it lazy
    if(!dest) {
      dest = promise.lazyCopy();
      this.adopt(dest);
    }
    return dest;
  },

  _containsRev: function(modelA, modelB) {
    if(!get(modelA, 'rev')) return false;
    if(!get(modelB, 'rev')) return false;
    return get(modelA, 'rev') >= get(modelB, 'rev');
  },

  _containsClientRev: function(modelA, modelB) {
    return get(modelA, 'clientRev') >= get(modelB, 'clientRev');
  }

});
