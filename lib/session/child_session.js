var get = Ember.get, set = Ember.set;

/**
  Child sessions are useful to keep changes isolated
  from parent sessions until flush time.
*/
Ep.ChildSession = Ep.Session.extend({

  load: function(type, id) {
    var session = this;
    return this.parent.load(type, id).then(function(model) {
      return session.merge(model);
    }, function(model) {
      throw session.merge(model);
    });
  },

  findQuery: function(type, query) {
    // TODO
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
    if(this.flushing.length > 0) {
      throw new Ember.Error("Cannot flush if another flush is pending.");
    }

    var session = this,
        dirtyModels = get(this, 'dirtyModels'),
        shadows = get(this, 'shadows'),
        parent = this.parent;

    // flush all local updates to the parent session
    var dirty = get(this, 'dirtyModels');
    // TODO: merge in latest from parent first?
    dirty.forEach(function(model) {
      parent.update(model);
    });

    // TODO: how do we isolate this flush to *only* child models
    var promise = parent.flush().then(function(models) {
      var res = models.map(function(model) {
        return session.merge(model);
      });
      return models;
    }, function(models) {
      var res = models.map(function(model) {
        return session.merge(model);
      });
      throw models;
    });

    // copy shadows into flushing
    shadows.forEach(function(model) {
      this.flushing.add(model);
    }, this);

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

  remoteCall: function(context, name) {
    var session = this;
    return this.parent.remoteCall.apply(this.parent, arguments).then(function(model) {
      return session.merge(model);
    }, function(model) {
      throw session.merge(model);
    });
  }


});