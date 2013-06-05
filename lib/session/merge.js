var get = Ember.get, set = Ember.set;

Ep.Session.reopen({

  merge: function(model, strategy) {
    this.reifyClientId(model);
    if(!strategy) strategy = get(this, 'mergeStrategy').create({session: this});

    var merged;
    this.suspendDirtyChecking(function() {
      merged = this.mergeModel(model, strategy);
    }, this);
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
    // TODO: think more about where we clear errors
    set(dest, 'errors', get(model, 'errors'));

    this.add(dest);

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
      this.add(dest);
    }
    return dest;
  }

});
