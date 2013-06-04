var get = Ember.get, set = Ember.set;

/**
  This default merge strategy is not version aware. It
  uses a set to break cycles in the merge.
*/
Ep.MergeStrategy = Ember.Object.extend({

  init: function() {
    this.cache = Ep.ModelSet.create();
  },

  /**
    Compares the revisions of both modelA and modelB.

    @return 0, 1, or -1 depending on whether src
    has the same revision as dest, src has strictly
    greater revision than dest, or they have conflicting
    revisions respectively.
  */
  compareRevisions: function(src, dest) {
    if(this.cache.contains(dest)) {
      return 0;
    }
    return -1;
  },

  merge: function(src, dest, destGraph) {
    return copy(src, dest, destGraph, this);
  },

  updateRevision: function(src, dest) {
    this.cache.add(dest);
  }

});


Ep.Model.reopen({

  merge: function(graph, strategy) {
    var dest = graph.getModel(this);
    var promise;

    if(dest && get(dest, 'isPromise')) {
      // if the destination is a promise we want to
      // merge it's content
      promise = dest;
      dest = dest.content;
    }

    if(!dest) {
      dest = this.constructor.create();
      if(promise) {
        // update the content of the promise so any lingering
        // references will still function
        // TODO: should we just resolve?
        set(promise, 'content', dest);
      }
    }

    // set id for new records
    set(dest, 'id', get(this, 'id'));
    set(dest, 'clientId', get(this, 'clientId'));
    // TODO: think more about where we clear errors
    set(dest, 'errors', get(this, 'errors'));

    var compare = strategy.compareRevisions(this, dest);

    // we update the revision here instead of after the actual
    // merging takes place in order to break cycles as the graph
    // is traversed
    strategy.updateRevision(this, dest);

    graph.add(dest);

    if(compare === 0) {
      // if the graph contains has the same revision we
      // simply do a no-op, this also stops recursion on
      // graph cycles
    } else if(compare > 0) {
      copy(this, dest, graph, strategy);
    } else {
      strategy.merge(this, dest, graph);
    }

    return dest;
  }

});

function copy(src, dest, graph, strategy) {
  dest.beginPropertyChanges();
  copyAttributes(src, dest);
  copyRelationships(src, dest, graph, strategy);
  dest.endPropertyChanges();
  return dest;
}

// TODO: should not deep merge, instead just create lazy 
// models for all relationships
function copyRelationships(src, dest, graph, strategy) {
  src.eachRelationship(function(name, relationship) {
    if(relationship.kind === 'belongsTo') {
      var child = get(src, name);
      var destChild = get(dest, name);
      if(child && destChild) {
        graph.merge(child, strategy);
      } else if(child) {
        set(dest, name, graph.merge(child, strategy));
      } else if(dest) {
        set(dest, name, null);
      }
    } else if(relationship.kind === 'hasMany') {
      // TODO: merge could be per item
      var children = get(src, name);
      var destChildren = get(dest, name);
      destChildren.clear();
      set(destChildren, 'meta', get(children, 'meta'));
      children.forEach(function(child) {
        destChildren.addObject(graph.merge(child, strategy));
      });
    }
  });
}

function copyAttributes(src, dest) {
  src.eachAttribute(function(name, meta) {
    // TODO: handle non-primitive attributes
    var left = get(src, name);
    var right = get(dest, name);
    if(left !== right) set(dest, name, left);
  });
}
