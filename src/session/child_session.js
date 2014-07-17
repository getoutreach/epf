var get = Ember.get, set = Ember.set;

import Session from './session';


/**
  Child sessions are useful to keep changes isolated
  from parent sessions until flush time.
*/
export default Session.extend({

  merge: function(model, visited) {
    var parentModel = this.parent.merge(model, visited);
    return this._super(parentModel, visited);
  },

  /**
    @private

    Child sessions dynamically copy down data from parent.
  */
  getModel: function(model) {
    var res = this._super(model);
    if(!res) {
      res = get(this, 'parent').getModel(model);
      if(res) {
        res = this.adopt(res.copy());
        // TODO: is there a better place for this?
        this.updateCache(res);
      }
    }
    return res;
  },

  /**
    @private

    Child sessions dynamically copy down data from parent.
  */
  getForClientId: function(clientId) {
    var res = this._super(clientId);
    if(!res) {
      res = get(this, 'parent').getForClientId(clientId);
      if(res) {
        res = this.adopt(res.copy());
        // TODO: is there a better place for this?
        this.updateCache(res);
      }
    }
    return res;
  },

  /**
    Update the parent session with all changes local
    to this child session.
  */
  updateParent: function() {
    // flush all local updates to the parent session
    var dirty = get(this, 'dirtyModels'),
        parent = get(this, 'parent');
    
    dirty.forEach(function(model) {
      // XXX: we want to do this, but we need to think about
      // revision numbers. The parent's clientRev needs to tbe
      // the childs normal rev.

      // "rebase" against parent version
      // var parentModel = parent.getModel(model);
      // if(parentModel) {
      //   this.merge(parentModel);
      // }
      
      // update the values of a corresponding model in the parent session
      // if a corresponding model doesn't exist, its added to the parent session
      parent.update(model); 
    }, this);
  },

  /**
    Similar to `flush()` with the additional effect that the models will
    be immediately updated in the parent session. This is useful when
    you want to optimistically assume success.
  */
  flushIntoParent: function() {
    this.updateParent();
    return this.flush();
  }


});
