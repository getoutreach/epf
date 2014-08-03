var get = Ember.get, set = Ember.set;

import Model from './model';
import ModelSet from '../collections/model_set';

Model.reopen({

  // TODO: revamp this to use jsondiffpatch on all attributes and relationships
  diff: function(model) {
    var diffs = [];

    this.eachLoadedAttribute(function(name, meta) {
      var left = this[name];
      var right = model[name];

      if(left && typeof left.diff === 'function' && right && typeof right.diff === 'function') {
        if(left.diff(right).length > 0) {
          diffs.push({type: 'attr', name: name});
        }
        return;
      }

      // Use jsondiffpatch for raw objects
      if(left && right
        && typeof left === 'object'
        && typeof right === 'object') {
        var delta = jsondiffpatch.diff(left, right);
        if(delta) {
          diffs.push({type: 'attr', name: name});
        }
        return;
      }

      if(left instanceof Date && right instanceof Date) {
        left = left.getTime();
        right = right.getTime();
      }
      if(left !== right) {
        // eventually we will have an actual diff
        diffs.push({type: 'attr', name: name});
      }
    }, this);

    this.eachLoadedRelationship(function(name, relationship) {
      var left = this[name];
      var right = model[name];
      if(relationship.kind === 'belongsTo') {
        if(left && right) {
          if(!left.isEqual(right)) {
            diffs.push({type: 'belongsTo', name: name, relationship: relationship, oldValue: right});
          }
        } else if(left || right) {
          diffs.push({type: 'belongsTo', name: name, relationship: relationship, oldValue: right});
        }
      } else if(relationship.kind === 'hasMany') {
        var dirty = false;
        var cache = ModelSet.create();
        left.forEach(function(model) {
          cache.add(model);
        });
        right.forEach(function(model) {
          if(dirty) return;
          if(!cache.contains(model)) {
            dirty = true;
          } else {
            cache.remove(model);
          }
        });
        if(dirty || get(cache, 'length') > 0) {
          diffs.push({type: 'hasMany', name: name, relationship: relationship});
        }
      }
    }, this);

    return diffs;
  }

});
