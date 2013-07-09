var get = Ember.get, set = Ember.set;

Ep.Session.reopen({

  /**
    Merges new data for a model into this session.

    If the corresponding model inside the session is "dirty"
    and has not been successfully flushed, the local changes
    will be merged against these changes.

    @method merge
    @param {Ep.Model} model The model to merge
    @param {Ep.MergeStrategy} [strategy] The merge strategy to use
  */
  merge: function(model, strategy) {
    var shadows = get(this, 'shadows'),
        newModels = get(this, 'newModels');

    this.reifyClientId(model);
    if(!strategy) strategy = get(this, 'mergeStrategy').create({session: this});

    if(!get(model, 'hasErrors')) {
      var merged;
      this.suspendDirtyChecking(function() {
        merged = this.mergeModel(model, strategy);
      }, this);
      // After a successful merge we update the shadow to the
      // last known value from the server. As an optimization,
      // we only create shadows if the model has been dirtied.
      // TODO: PERF: if the shadow is identical to the client model
      // we can just remove from the shadows
      if(shadows.contains(model) && get(model, 'isLoaded')) {
        shadows.add(model);
      }
      // Once merged, the model cannot be new
      newModels.remove(model);
    } else {
      this.suspendDirtyChecking(function() {
        merged = this.mergeErrors(model, strategy);
      }, this);
      // In the event of an error we reset the returned
      // model is assumed not have our local changes.
      // In this case we use this model to reset the shadow.
      // TODO: what about new models?
      // TODO: what about load errors?
      shadows.add(model);
    }
    return merged;
  },

  mergeModel: function(model, strategy) {
    var dest = this.getModel(model);
    if(model === dest) {
      // TODO: when do we get here?
      // TODO: throw error?
      return model;
    }

    if(get(model, 'isPromise')) {
      return this.mergePromise(model, dest, strategy);
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

    // set id for new records
    set(dest, 'id', get(model, 'id'));
    set(dest, 'clientId', get(model, 'clientId'));
    set(dest, 'isDeleted', get(model, 'isDeleted'));
    // TODO: think more about where we clear errors
    set(dest, 'errors', Ember.copy(get(model, 'errors')));

    this.adopt(dest);

    strategy.merge(model, dest);

    return dest;
  },

  // TODO: we removed the merge logic from the base model promise (make sure that doesn't matter)
  // make sure we are merging a loaded model
  mergePromise: function(promise, dest, strategy) {
    var content = get(promise, 'content');
    if(content) {
      return this.merge(content, strategy);
    }

    // otherwise keep it lazy
    if(!dest) {
      dest = promise.lazyCopy();
      this.adopt(dest);
    }
    return dest;
  },

  mergeErrors: function(model, strategy) {
    var dest = this.getModel(model);
    // In the case of a load error, we do not want the model in the session
    if(!dest) {
      Ember.assert("Errors returned for non-existant model: " + model.toString(), model instanceof Ep.LoadError);
      return model;
    }
    set(dest, 'errors', Ember.copy(get(model, 'errors')));
    return dest;
  }

});
