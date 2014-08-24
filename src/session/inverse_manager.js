var get = Ember.get, set = Ember.set;

import ModelSet from '../collections/model_set';
import copy from '../utils/copy';

/**
  Manages updating inverses within a session.

  @class InverseManager
*/
export default class InverseManager {
  
  constructor(session) {
    this.session = session;
    this.map = {};
  }
  
  register(model) {
    var session = this.session;
    
    model.eachLoadedRelationship(function(name, relationship) {
      // this is a copy that we mutate
      var existingInverses = this._inversesFor(model, name),
          inversesToClear = existingInverses.copy();
          
      function checkInverse(inverseModel) {
        session.reifyClientId(inverseModel);
        if(existingInverses.contains(inverseModel)) {
          // nothing to do, already registered
        } else {
          this.registerRelationship(model, name, inverseModel);
        }
        inversesToClear.remove(inverseModel);
      }    
      
      if(relationship.kind === 'belongsTo') {
        var inverseModel = get(model, name);
        if(inverseModel) {
          checkInverse.call(this, inverseModel);
        }
      } else if(relationship.kind === 'hasMany') {
        var inverseModels = get(model, name);
        inverseModels.forEach(function(inverseModel) {
          checkInverse.call(this, inverseModel);
        }, this);
      }
      
      inversesToClear.forEach(function (inverseModel) {
        this.unregisterRelationship(model, name, inverseModel);
      }, this);
    }, this);
  }
  
  unregister(model) {
    var clientId = model.clientId,
        inverses = this._inverses(model);
    for(var name in inverses) {
      var inverseModels = inverses[name],
          copiedInverseModels = copy(inverseModels);

      copiedInverseModels.forEach(function (inverseModel) {
        this.unregisterRelationship(model, name, inverseModel);
      }, this);
    }
    delete this.map[clientId];
  }
  
  registerRelationship(model, name, inverseModel) {
    var inverse = model.constructor.inverseFor(name);
    
    this._inversesFor(model, name).addObject(inverseModel);
    if(inverse) {
      this._inversesFor(inverseModel, inverse.name).addObject(model);
      this._addToInverse(inverseModel, inverse, model);
    }
  }
  
  unregisterRelationship(model, name, inverseModel) {
    var inverse =  model.constructor.inverseFor(name);
    
    this._inversesFor(model, name).removeObject(inverseModel);
    if(inverse) {
      this._inversesFor(inverseModel, inverse.name).removeObject(model);
      this._removeFromInverse(inverseModel, inverse, model);
    }
  }

  _inverses(model) {
    var clientId = model.clientId,
        inverses = this.map[clientId];

    if(!inverses) {
      inverses = this.map[clientId] = {};
    }

    return inverses;
  }

  _inversesFor(model, name) {
    var inverses = this._inverses(model);

    var inversesFor = inverses[name];
    if(!inversesFor) {
      inversesFor = inverses[name] = new ModelSet();
    }

    return inversesFor;
  }

  _addToInverse(model, inverse, inverseModel) {
    model = this.session.models.getModel(model);
    // make sure the inverse is loaded
    if(!model || !model.isFieldLoaded(inverse.name)) return;
    model.suspendRelationshipObservers(function() {
      if(inverse.kind === 'hasMany') {
        get(model, inverse.name).addObject(inverseModel)
      } else if(inverse.kind === 'belongsTo') {
        set(model, inverse.name, inverseModel);
      }
    }, this);
  }
  
  _removeFromInverse(model, inverse, inverseModel) {
    model = this.session.models.getModel(model);
    // make sure the inverse is loaded
    if(!model || !model.isFieldLoaded(inverse.name)) return;
    model.suspendRelationshipObservers(function() {
      if(inverse.kind === 'hasMany') {
        get(model, inverse.name).removeObject(inverseModel)
      } else if(inverse.kind === 'belongsTo') {
        set(model, inverse.name, null);
      }
    }, this);
  }

}
