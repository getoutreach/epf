var get = Ember.get, set = Ember.set;


Ep.Operation = Ember.Object.extend({

  model: null,
  shadow: null,
  adapter: null,

  init: function() {
    this.children = Ember.Set.create();
    this.parents = Ember.Set.create();
  },

  dirtyRelationships: Ember.computed(function() {
    var adapter = get(this, 'adapter'),
        model = get(this, 'model'),
        rels = [],
        shadow = get(this, 'shadow');

    // determine which relationships are affected by this flush
    // TODO: we should unify this with dirty checking
    // TODO: right now we assume a relational database and only
    // care about belongsTo
    if(get(model, 'isNew')) {
      model.eachRelationship(function(name, relationship) {
        if(adapter.isRelationshipOwner(relationship)) {
          rels.push({name: name, type: relationship.kind, relationship: relationship, oldValue: null});
        }
      }, this);
    }
    // } else if(get(model, 'isDeleted')) {
    //   var cached = this.store.getForId(model);
    //   model.eachRelationship(function(name, relationship) {
    //     if(relationship.kind === 'belongsTo') {
    //       rels.push({name: name, type: 'belongsTo', relationship: relationship, oldValue: get(cached, 'name')});
    //     }
    //   }, this);
    // }
    else {
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
    } else if(get(this, 'isDirty')) {
      return "updated";
    }
  }),

  perform: function(forceUpdate) {
    var adapter = get(this, 'adapter'),
        dirtyType = get(this, 'dirtyType'),
        model = get(this, 'model'),
        shadow = get(this, 'shadow'),
        promise;

    if(!dirtyType && forceUpdate) {
      dirtyType = "updated";
    }
    if(!dirtyType || !adapter.shouldSave(model)) {
      // return an "identity" promise if we don't want to do anything
      promise = Ember.RSVP.resolve(model);
    } else if(dirtyType === "created") {
      promise = adapter.create(model);
    } else if(dirtyType === "updated") {
      promise = adapter.update(model);
    } else if(dirtyType === "deleted") {
      promise = adapter.deleteModel(model);
    }

    // if the adapter returns errors we replace the
    // model with the shadow which the session will
    // use to replace its shadow
    return promise.then(null, function(model) {
      shadow.set('errors', model.get('errors'));
      throw shadow;
    });
  },

  toStringExtension: function() {
    return "( " + get(this, 'dirtyType') + " " + get(this, 'model') + " )";
  }

});