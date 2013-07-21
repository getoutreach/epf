require('./operation');

var get = Ember.get, set = Ember.set;

var Node = function(model) {
  this.op = null;
  this.children = Ember.Set.create();
  this.parents = Ember.Set.create();
  this.dirty = false;
  this.dirtyEmbeddedChildren = false;
};

Node.prototype = {
  addChild: function(childNode) {
    this.children.add(childNode);
    childNode.parents.add(this);
  },

  isRoot: function() {
    return this.parents.every(function(parent) {
      return !get(parent, 'dirty') && parent.isRoot();
    });
  },

  toString: function(depth) {
    if(!depth) depth = 0;
    var prefix = "";
    for(var i = 0; i < depth; i++) {
      prefix += "  ";
    }
    return prefix +
      this.op.toString() +
      this.children.map(function(child) { return "\n" + child.toString(depth + 1); });
  }
};

Ep.OperationGraph = Ember.Object.extend({

  models: null,
  shadows: null,
  rootNodes: null,
  adapter: null,
  nodes: null,

  init: function() {
    this.nodes = Ember.MapWithDefault.create({
      defaultValue: function(model) {
        return new Node(model);
      }
    });
    this.rootNodes = Ember.Set.create();
    this.build();
  },

  perform: function() {
    return this.createPromise();
  },

  build: function() {
    var adapter = get(this, 'adapter');
    var models = get(this, 'models');
    var shadows = get(this, 'shadows');
    var rootNodes = get(this, 'rootNodes');
    var nodes = get(this, 'nodes');

    models.forEach(function(model) {
      // skip any promises that aren't loaded
      // TODO: think through edge cases in depth
      if(!get(model, 'isLoaded')) {
        return;
      }

      var shadow = shadows.getModel(model);

      var node = nodes.get(model);
      node.op = Ep.Operation.create({
        model: model,
        shadow: shadow,
        graph: this,
        adapter: adapter
      });

      node.dirty = node.dirty || !!get(node.op, 'dirtyType');

      // Here we walk up the embedded tree and mark the root as dirty
      // If the model is new we won't be able to determine the root here,
      // in this case we rely on the parent being marked dirty based on
      // a change in the embedded has many
      if(node.dirty && adapter.isEmbedded(model) && !get(model, 'isNew')) {
        var root = adapter.findEmbeddedRoot(model, models);
        var rootNode = nodes.get(root);
        rootNode.dirty = true;
        rootNode.dirtyEmbeddedChildren = true;
      }

      var rels = get(node.op, 'dirtyRelationships');
      for(var i = 0; i < rels.length; i++) {
        var d = rels[i];
        var name = d.name;
        var parentModel = model.get(name) || shadows.getModel(d.oldValue);

        // TODO: handle hasMany's depending on adapter configuration
        if(parentModel) {
          // the copies are shallow right now and don't reference each other
          // so we must pull the corresponding instance from the set we are dealing with
          parentModel = models.getModel(parentModel);
          var parentNode = nodes.get(parentModel);
          parentNode.addChild(node);
        }
      }

    }, this);

    nodes.forEach(function(model, node) {
      if(node.dirty && node.isRoot()) {
        rootNodes.add(node);
      }
    }, this);
  },

  createPromise: function() {
    var rootNodes = get(this, 'rootNodes'),
        adapter = get(this, 'adapter'),
        cumulative = [];

    function createNestedPromise(node) {
      // if the node has dirty embedded children then we make sure
      // the operation always updates by passing in forceUpdate
      var promise = node.op.perform(node.dirtyEmbeddedChildren);

      // keep track of all models for the resolution of the entire flush
      promise = promise.then(function(model) {
        cumulative.push(model);
        return model;
      }, function(model) {
        cumulative.push(model);
        throw model;
      });
      if(node.children.length > 0) {
        promise = promise.then(function(model) {
          var childPromises = node.children.map(createNestedPromise);
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

    return Ember.RSVP.all(rootNodes.map(createNestedPromise)).then(function() {
      return cumulative;
    }, function(err) {
      throw cumulative;
    });
  },

  toStringExtension: function() {
    var result = "";
    var rootNodes = get(this, 'rootNodes');
    rootNodes.forEach(function(node) {
      result += "\n" + node.toString(1);
    });
    return result + "\n";
  }


});