var get = Ember.get, set = Ember.set;

/**
  Child sessions are useful to keep changes isolated
  from parent sessions until flush time.
*/
Ep.ChildSession = Ep.Session.extend({

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

    var session = this;
    return Ep.resolveModel(this.parent.load(type, id).then(function(model) {
      return session.merge(model);
    }, function(model) {
      throw session.merge(model);
    }), type, id, session);
  },

  query: function(type, query) {
    var session = this;
    return this.parent.query(type, query).then(function(models) {
      // TODO: model array could automatically add to session?
      return session.mergeModels(models);
    });
  },

  refresh: function(model) {
    var session = this;
    return this.parent.refresh(model).then(function(refreshedModel) {
      return session.merge(refreshedModel);
    }, function(refreshedModel) {
      throw session.merge(refreshedModel);
    });
  },

  flush: function() {
    var session = this,
        dirtyModels = get(this, 'dirtyModels'),
        shadows = get(this, 'shadows'),
        parent = this.parent;

    // flush all local updates to the parent session
    var dirty = get(this, 'dirtyModels');
    
    // TODO: merge in latest from parent first? (essentially making this a rebase)
    dirty.forEach(function(model) {
      // update the values of a corresponding model in the parent session
      // if a corresponding model doesn't exist, its added to the parent session
      parent.update(model); 
    });

    // TODO: how do we isolate this flush to *only* child models
    var promise = parent.flush().then(function(models) {
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

    // update shadows with current models
    dirtyModels.forEach(function(model) {
      this.shadows.add(model.copy());
    }, this);

    return promise;
  },

  reifyClientId: function(model) {
    return this.parent.reifyClientId(model);
  },

  getForId: function(type, id) {
    var adapter = get(this.parent, 'adapter');
    var clientId = adapter.getClientId(type, id);
    return this.models.getForClientId(clientId);
  },

  remoteCall: function(context, name, params) {
    var session = this;
    return this.parent.remoteCall.apply(this.parent, arguments).then(function(model) {
      if(Ember.isArray(model)) {
        return session.mergeModels(models);
      } else {
        return session.merge(model);
      }
    }, function(model) {
      if(Ember.isArray(model)) {
        throw session.mergeModels(models);
      }else{
        throw session.merge(model);
      }
    });
  }


});
