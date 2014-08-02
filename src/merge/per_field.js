var get = Ember.get, set = Ember.set, copy = Ember.copy;

import Base from './base';
import ModelSet from '../collections/model_set';
import isEqual from '../utils/is_equal';

/**
  Merge strategy that merges on a per-field basis.

  Fields which have been editted by both will
  default to "ours".

  Fields which do not have an ancestor will default to
  "theirs".

  @namespace merge
  @class PerField
*/
export default class PerField extends Base {

  merge(ours, ancestor, theirs) {
    ours.beginPropertyChanges();
    this.mergeAttributes(ours, ancestor, theirs);
    this.mergeRelationships(ours, ancestor, theirs);
    ours.endPropertyChanges();
    return ours;
  }

  mergeAttributes(ours, ancestor, theirs) {
    ours.eachAttribute(function(name, meta) {
      this.mergeProperty(ours, ancestor, theirs, name);
    }, this);
  }

  mergeRelationships(ours, ancestor, theirs) {
    var session = get(this, 'session');
    ours.eachRelationship(function(name, relationship) {
      if(relationship.kind === 'belongsTo') {
        this.mergeBelongsTo(ours, ancestor, theirs, name);
      } else if(relationship.kind === 'hasMany') {
        this.mergeHasMany(ours, ancestor, theirs, name);
      }
    }, this);
  }

  mergeBelongsTo(ours, ancestor, theirs, name) {
    this.mergeProperty(ours, ancestor, theirs, name);
  }

  mergeHasMany(ours, ancestor, theirs, name) {
    this.mergeProperty(ours, ancestor, theirs, name);
  }

  mergeProperty(ours, ancestor, theirs, name) {
    var oursValue = get(ours, name),
        ancestorValue = get(ancestor, name),
        theirsValue = get(theirs, name);

    if(!ours.isFieldLoaded(name)) {
      if(theirs.isFieldLoaded(name)) {
        set(ours, name, copy(theirsValue));
      }
      return;
    }
    if(!theirs.isFieldLoaded(name) || isEqual(oursValue, theirsValue)) {
      return;
    }
    // if the ancestor does not have the property loaded we are
    // performing a two-way merge and we just pick theirs
    if(!ancestor.isFieldLoaded(name) || isEqual(oursValue, ancestorValue)) {
      set(ours, name, copy(theirsValue));
    } else {
      // NO-OP
    }
  }

}