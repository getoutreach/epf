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
      // after a successful merge we remove
      // the shadow and the backup
      // (will be re-added to shadow when it becomes dirty)
      shadows.remove(model);
      newModels.remove(model);
    } else {
      this.suspendDirtyChecking(function() {
        merged = this.mergeErrors(model, strategy);
      }, this);
      // In the event of an error we reset the returned
      // model is assumed not have our local changes.
      // In this case we use this model to reset the shadow.
      // TODO: what about new models?
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
        // TODO: should we just resolve?
        set(promise, 'content', dest);
      }
    }

    // set id for new records
    set(dest, 'id', get(model, 'id'));
    set(dest, 'clientId', get(model, 'clientId'));
    set(dest, 'isDeleted', get(model, 'isDeleted'));
    // TODO: think more about where we clear errors
    set(dest, 'errors', get(model, 'errors'));

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
    if(!dest) {
      throw new Ember.Error("Errors returned for non-existant model: " + model.toString());
    }
    set(dest, 'errors', get(model, 'errors'));
    return dest;
  }

});
