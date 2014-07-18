var get = Ember.get, set = Ember.set;

import ModelArray from '../collections/model_array';
import Session from './session';

Session.reopen({

  mergeStrategyFor: function(typeKey) {
    Ember.assert('Passed in typeKey must be a string', typeof typeKey === 'string');
    var mergeStrategy = this.container.lookup('merge-strategy:' + typeKey);
    // if none exists, create and register a default
    if(!mergeStrategy) {
      var Strategy = this.container.lookupFactory('merge-strategy:default');
      this.container.register('merge-strategy:' + typeKey, Strategy);
      mergeStrategy = this.container.lookup('merge-strategy:' + typeKey);
    }
    mergeStrategy.typeKey = typeKey;
    return mergeStrategy;
  },

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
  merge: function(model, visited) {
    if(this.parent) {
      model = this.parent.merge(model, visited);
    }

    this.reifyClientId(model);

    if(!visited) visited = new Ember.Set();

    if(visited.contains(model)) {
      return this.getModel(model);
    }
    visited.add(model);

    var adapter = get(this, 'adapter');
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

    if(get(model, 'hasErrors')) {
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
  },

  mergeModels: function(models) {
    var merged = ModelArray.create({session: this, content: []});
    merged.meta = models.meta;
    var session = this;
    models.forEach(function(model) {
      merged.pushObject(session.merge(model));
    });
    return merged;
  },

  _mergeSuccess: function(model) {
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
    set(merged, 'errors', null);
    
    return merged;
  },

  _mergeError: function(model) {
    var models = get(this, 'models'),
        shadows = get(this, 'shadows'),
        newModels = get(this, 'newModels'),
        originals = get(this, 'originals'),
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
    set(merged, 'errors', Ember.copy(get(model, 'errors')));
 
    if(!get(model, 'isNew')) {
      // "rollback" the shadow to have what was returned by the server
      shadows.addData(model);

      // the shadow is now the server version, so no reason to
      // keep the original around
      originals.remove(model);
    }

    return merged;
  },

  _mergeModel: function(dest, ancestor, model) {
    //Ember.assert("Cannot merge a model into it's own session", dest !== model);

    // if the model does not exist, no "merging"
    // is required
    if(!dest) {
      if(get(model, 'isDetached')) {
        dest = model;
      } else {
        dest = model.copy();
      }

      this.adopt(dest);
      return dest;
    }

    // set id for new records
    set(dest, 'id', get(model, 'id'));
    set(dest, 'clientId', get(model, 'clientId'));
    // copy the server revision
    set(dest, 'rev', get(model, 'rev'));
    set(dest, 'isDeleted', get(model, 'isDeleted'));

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

    var strategy = this.mergeStrategyFor(get(model, 'type.typeKey'));
    strategy.merge(dest, ancestor, model);

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
