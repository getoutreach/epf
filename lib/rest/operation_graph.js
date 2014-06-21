require('./operation');

var get = Ember.get, set = Ember.set;

Ep.OperationGraph = Ember.Object.extend({

  models: null,
  shadows: null,
  rootOps: null,
  adapter: null,

  init: function() {
    var graph = this,
        adapter = get(this, 'adapter'),
        session = get(this, 'session');
    this.ops = Ember.MapWithDefault.create({
      defaultValue: function(model) {
        return Ep.Operation.create({
          model: model,
          graph: graph,
          adapter: adapter,
          session: session
        });
      }
    });
    this.rootOps = Ember.Set.create();
    this.build();
  },

  perform: function() {
    return this.createPromise();
  },

  build: function() {
    var adapter = get(this, 'adapter');
    var models = get(this, 'models');
    var shadows = get(this, 'shadows');
    var rootOps = get(this, 'rootOps');
    var ops = get(this, 'ops');

    models.forEach(function(model) {
      // skip any promises that aren't loaded
      // TODO: think through edge cases in depth
      if(!get(model, 'isLoaded')) {
        return;
      }

      var shadow = shadows.getModel(model);

      Ember.assert("Shadow does not exist for non-new model", shadow || get(model, 'isNew'));

      var op = ops.get(model);
      set(op, 'shadow', shadow);

      var rels = get(op, 'dirtyRelationships');
      for(var i = 0; i < rels.length; i++) {
        var d = rels[i];
        var name = d.name;
        var parentModel = model.get(name) || shadows.getModel(d.oldValue);
        // embedded children should not be dependencies
        var serializer = adapter.serializerForModel(model);
        var isEmbeddedRel = serializer.embeddedType(get(model, 'type'), name);

        // TODO: handle hasMany's depending on adapter configuration
        if(parentModel && !isEmbeddedRel) {
          var parentOp = this.getOp(parentModel);
          parentOp.addChild(op);
        }
      }

      var isEmbedded = adapter.isEmbedded(model);

      if(get(op, 'isDirty') && isEmbedded) {
        // walk up the embedded tree and mark root as dirty
        var rootModel = adapter.findEmbeddedRoot(model, models);
        var rootOp = this.getOp(rootModel);
        set(rootOp, 'force', true);

        // ensure the embedded parent is a parent of the operation
        var parentModel = adapter._embeddedManager.findParent(model);
        var parentOp = this.getOp(parentModel);

        // if the child already has some parents, they need to become
        // the parents of the embedded root as well
        op.parents.forEach(function(parent) {
          if(parent === rootOp) return;
          if(adapter.findEmbeddedRoot(parent.model, models) === rootModel) return;
          parent.addChild(rootOp);
        });

        parentOp.addChild(op);
      }

    }, this);

    ops.forEach(function(model, op) {
      if(get(op, 'isDirty') && get(op, 'isRoot')) {
        rootOps.add(op);
      }
    }, this);
  },

  getOp: function(model) {
    // ops is is a normal Ember.Map and doesn't use client
    // ids so we need to make sure that we are looking up
    // with the correct model instance
    var models = get(this, 'models');
    var materializedModel = models.getModel(model);
    // TODO: we do this check since it is possible that some
    // lazy models are not part of `models`, a more robust
    // solution needs to be figured out for dealing with operations
    // on lazy models
    if(materializedModel) model = materializedModel;
    return this.ops.get(model);
  },

  createPromise: function() {
    var rootOps = get(this, 'rootOps'),
        adapter = get(this, 'adapter'),
        cumulative = [];

    function createNestedPromise(op) {
      var promise = op.perform()

      // keep track of all models for the resolution of the entire flush
      promise = promise.then(function(model) {
        cumulative.push(model);
        return model;
      }, function(model) {
        cumulative.push(model);
        throw model;
      });
      if(op.children.length > 0) {
        promise = promise.then(function(model) {
          var childPromises = op.children.map(createNestedPromise);
          return Ember.RSVP.all(childPromises).then(function(models) {
            adapter.rebuildRelationships(models, model);
            // TODO: we return just the model here instead of all models,
            // this works because of the cumulative scoped variable
            // we should try and clean this up
            return model;
          });
        });
      }
      return promise;
    }

    return Ember.RSVP.all(rootOps.map(createNestedPromise)).then(function() {
      return cumulative;
    }, function(err) {
      throw cumulative;
    });
  },

  toStringExtension: function() {
    var result = "";
    var rootOps = get(this, 'rootOps');
    rootOps.forEach(function(op) {
      result += "\n" + op.toString(1);
    });
    // TODO: display children
    return result + "\n";
  }


});