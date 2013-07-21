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
    var models = get(this, 'models'),
        shadows = get(this, 'shadows'),
        newModels = get(this, 'newModels'),
        originals = get(this, 'originals'),
        merged,
        ancestor;

    this.reifyClientId(model);

    var existing = models.getModel(model);

    // revisions for comparison
    var rev = get(model, 'rev'),
        clientRev = get(model, 'clientRev');

    if(existing) {
      var existingRev = existing && get(existing, 'rev'),
          existingClientRev = existing && get(existing, 'clientRev');

      // no-op if client has already seen this version
      if(existingRev !== null && existingRev >= rev) {
        return existing;
      }
    }

    var hasErrors = get(model, 'hasErrors');

    // In the case of a load error, we do not want the model in the session
    if(hasErrors && !existing) {
      Ember.assert("Errors returned for non-existant model: " + model.toString(), model instanceof Ep.LoadError);
      return model;
    }

    var hasClientChanges = !existing || clientRev >= existingClientRev;

    // In the event of an error, the model will
    // still have the latest client revision, but
    // the server will not have applied an update
    if(hasClientChanges && !hasErrors) {
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

    // TODO: think this through more
    // // to avoid overly deep merges, if we are recusing in
    // // from the merge algorithm outside of the graph, we
    // // return a lazy stub here
    // if(!siblings.contains(model)) {
    //   return dest || model.lazyCopy();
    // }

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
    // TODO this should only be done if no errors
    set(dest, 'isNew', false);
    // set id for new records
    set(dest, 'id', get(model, 'id'));
    set(dest, 'clientId', get(model, 'clientId'));
    // copy the server revision
    set(dest, 'rev', get(model, 'rev'));
    set(dest, 'isDeleted', get(model, 'isDeleted'));
    // TODO: think more about where we clear errors
    set(dest, 'errors', Ember.copy(get(model, 'errors')));

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
      return this.merge(dest, ancestor, content, strategy);
    }

    // otherwise keep it lazy
    if(!dest) {
      dest = promise.lazyCopy();
      this.adopt(dest);
    }
    return dest;
  },

});
