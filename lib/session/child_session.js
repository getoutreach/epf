var get = Ember.get, set = Ember.set;

/**
  Child sessions are useful to keep changes isolated
  from parent sessions until flush time.
*/
Ep.ChildSession = Ep.Session.extend({

  merge: function(model, visited) {
    var parentModel = this.parent.merge(model, visited);
    return this._super(parentModel, visited);
  },

  fetch: function(model) {
    var res = this._super(model);
    if(!res) {
      res = get(this, 'parent').fetch(model);
      if(res) {
        res = this.adopt(res.copy());

        // Unlike hasMany's, belongsTo do not lookup on the
        // session during property access. Therefore, we need
        // to adopt manually.
        res.eachRelationship(function(name, relationship) {
          if(relationship.kind === 'belongsTo') {
            var child = get(res, name);
            if(child) {
              set(child, 'session', this);
            }
          }
        }, this);
      }
    }
    return res;
  },

  load: function(type, id) {
    type = this.modelFor(type);
    // always coerce to string
    id = id.toString();

    var cached = this.getForId(type, id);
    if(cached && get(cached, 'isLoaded')) {
      return Ep.resolveModel(cached);
    }

    // load and resolve immediately if the parent already has it loaded
    var parentModel = get(this, 'parent').getForId(type, id);
    if(parentModel && get(parentModel, 'isLoaded')) {
      return Ep.resolveModel(this.merge(parentModel));
    }

    return this._super(type, id);
  },

  /**
    Update the parent session with all changes local
    to this child session.
  */
  updateParent: function() {
    // flush all local updates to the parent session
    var dirty = get(this, 'dirtyModels'),
        parent = get(this, 'parent');
    
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
  },

  /**
    Similar to `flush()` with the additional effect that the models will
    be immediately updated in the parent session. This is useful when
    you want to optimistically assume success.
  */
  flushIntoParent: function() {
    this.updateParent();
    return this.flush();
  }


});
