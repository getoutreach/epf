var get = Ember.get, set = Ember.set;

import Operation from './operation';

export default class OperationGraph {

  constructor(models, shadows, adapter, session) {
    this.models = models;
    this.shadows = shadows;
    this.adapter = adapter;
    this.session = session;
    var graph = this;
    this.ops = Ember.MapWithDefault.create({
      defaultValue: function(model) {
        return new Operation(model, graph, adapter, session);
      }
    });
    this.build();
  }

  perform() {
    var adapter = this.adapter,
        cumulative = [];

    function createNestedPromise(op) {
      var promise;

      // perform after all parents have performed
      if(op.parents.length > 0) {
        promise = Ember.RSVP.all(op.parents.toArray()).then(function() {
          return op.perform();
        });
      } else {
        promise = op.perform();
      }

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
          return Ember.RSVP.all(op.children.toArray()).then(function(models) {
            adapter.rebuildRelationships(models, model);
            return model;
          }, function(models) {
            // XXX: should we still rebuild relationships since this request succeeded?
            throw model;
          });
        });
      }
      return promise;
    }

    var promises = [];
    this.ops.forEach(function(model, op) {
      promises.push(createNestedPromise(op));
    }); 

    return Ember.RSVP.all(promises).then(function() {
      return cumulative;
    }, function(err) {
      throw cumulative;
    });
  }

  build() {
    var adapter = this.adapter,
        models = this.models,
        shadows = this.shadows,
        ops = this.ops;

    models.forEach(function(model) {
      // skip any promises that aren't loaded
      // TODO: think through edge cases in depth
      // XXX:
      // if(!get(model, 'isLoaded')) {
      //   return;
      // }

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
        var isEmbeddedRel = adapter.embeddedType(model.constructor, name);

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
  }

  getOp(model) {
    // ops is is a normal Ember.Map and doesn't use client
    // ids so we need to make sure that we are looking up
    // with the correct model instance
    var models = this.models,
        materializedModel = models.getModel(model);
    // TODO: we do this check since it is possible that some
    // lazy models are not part of `models`, a more robust
    // solution needs to be figured out for dealing with operations
    // on lazy models
    if(materializedModel) model = materializedModel;
    return this.ops.get(model);
  }

}