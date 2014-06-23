var get = Ember.get, set = Ember.set;


Ep.Operation = Ember.Object.extend({

  model: null,
  shadow: null,
  adapter: null,
  _promise: null,
  // forces the operation to be performed
  force: false,

  init: function() {
    this.children = Ember.Set.create();
    this.parents = Ember.Set.create();
  },

  // determine which relationships are affected by this operation
  // TODO: we should unify this with dirty checking
  dirtyRelationships: Ember.computed(function() {
    var adapter = get(this, 'adapter'),
        model = get(this, 'model'),
        rels = [],
        shadow = get(this, 'shadow');

    if(get(model, 'isNew')) {
      // if the model is new, all relationships are considered dirty
      model.eachRelationship(function(name, relationship) {
        if(adapter.isRelationshipOwner(relationship)) {
          rels.push({name: name, type: relationship.kind, relationship: relationship, oldValue: null});
        }
      }, this);
    } else {
      // otherwise we check the diff to see if the relationship has changed,
      // in the case of a delete this won't really matter since it will
      // definitely be dirty
      var diff = model.diff(shadow);
      for(var i = 0; i < diff.length; i++) {
        var d = diff[i];
        if(d.relationship && adapter.isRelationshipOwner(d.relationship)) {
          rels.push(d);
        }
      }
    }

    return rels;
  }),

  isDirty: Ember.computed(function() {
    return !!get(this, 'dirtyType');
  }),

  isDirtyFromUpdates: Ember.computed(function() {
    var model = get(this, 'model'),
        shadow = get(this, 'shadow'),
        adapter = get(this, 'adapter');

    var diff = model.diff(shadow);
    var dirty = false;
    var relDiff = [];
    for(var i = 0; i < diff.length; i++) {
      var d = diff[i];
      if(d.type == 'attr') {
        dirty = true;
      } else {
        relDiff.push(d);
      }
    }
    return dirty || adapter.isDirtyFromRelationships(model, shadow, relDiff);
  }),

  dirtyType: Ember.computed(function() {
    var model = get(this, 'model');
    if(get(model, 'isNew')) {
      return "created";
    } else if(get(model, 'isDeleted')) {
      return "deleted";
    } else if(get(this, 'isDirtyFromUpdates') || get(this, 'force')) {
      return "updated";
    }
  }).property('force'),

  perform: function() {
    if(this._promise) return this._promise;

    var adapter = get(this, 'adapter'),
        session = get(this, 'session'),
        dirtyType = get(this, 'dirtyType'),
        model = get(this, 'model'),
        shadow = get(this, 'shadow'),
        promise;

    if(!dirtyType || !adapter.shouldSave(model)) {
      if(adapter.isEmbedded(model)) {
        // if embedded we want to extract the model from the result
        // of the parent operation
        promise = this._promiseFromEmbeddedParent();
      } else {
        // return an "identity" promise if we don't want to do anything
        promise = Ember.RSVP.resolve();
      }
    } else if(dirtyType === "created") {
      promise = adapter._contextualizePromise(adapter._create(model), model);
    } else if(dirtyType === "updated") {
      promise = adapter._contextualizePromise(adapter._update(model), model);
    } else if(dirtyType === "deleted") {
      promise = adapter._contextualizePromise(adapter._deleteModel(model), model);
    }

    promise = promise.then(function(serverModel) {
      // in the case of new records we need to assign the id
      // of the model so dependent operations can use it
      if(!get(model, 'id')) {
        set(model, 'id', get(serverModel, 'id'));
      }
      if(!serverModel) {
        // if no data returned, assume that the server data
        // is the same as the model
        serverModel = model;
      } else {
        if(get(serverModel, 'meta') && Ember.keys(serverModel).length == 1 ){
          model.meta = serverModel.meta;
          serverModel = model;
        }
        if(!get(serverModel, 'clientRev')) {
          // ensure the clientRev is set on the returned model
          // 0 is the default value
          set(serverModel, 'clientRev', get(model, 'clientRev'));
        }
      }
      return serverModel;
    }, function(serverModel) {
      // if the adapter returns errors we replace the
      // model with the shadow if no other model returned
      // TODO: could be more intuitive to move this logic
      // into adapter._contextualizePromise

      // there won't be a shadow if the model is new
      if(shadow && serverModel === model) {
        shadow.set('errors', serverModel.get('errors'));
        throw shadow;
      }
      throw serverModel;
    });
    return this._promise = promise;
  },

  _embeddedParent: Ember.computed(function() {
    var model = get(this, 'model'),
        parentModel = get(this, 'adapter')._embeddedManager.findParent(model),
        graph = get(this, 'graph');

    Ember.assert("Embedded parent does not exist!", parentModel);

    return graph.getOp(parentModel);
  }),

  _promiseFromEmbeddedParent: function() {
    var model = this.model,
        adapter = get(this, 'adapter'),
        serializer = adapter.serializerForModel(model);

    function findInParent(parentModel) {
      var res = null;
      serializer.eachEmbeddedRecord(parentModel, function(child, embeddedType) {
        if(res) return;
        if(child.isEqual(model)) res = child;
      });
      return res;
    }

    return get(this, '_embeddedParent').perform().then(function(parent) {
      return findInParent(parent);
    }, function(parent) {
      throw findInParent(parent);
    });
  },

  toStringExtension: function() {
    return "( " + get(this, 'dirtyType') + " " + get(this, 'model') + " )";
  },

  addChild: function(child) {
    this.children.add(child);
    child.parents.add(this);
  },

  isRoot: Ember.computed(function() {
    return this.parents.every(function(parent) {
      return !get(parent, 'isDirty') && get(parent, 'isRoot');
    });
  }).volatile()

});
