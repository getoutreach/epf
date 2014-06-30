var get = Ember.get, set = Ember.set;

Ep.InverseManager = Ember.Object.extend({
  
  session: null,

  init: function() {
    this.map = Ember.MapWithDefault.create({
      defaultValue: function() {
        return Ember.MapWithDefault.create({
          defaultValue: function() { return Ep.ModelSet.create(); }
        });
      }
    });
  },
  
  register: function(model) {
    var clientId = get(model, 'clientId');
    Ember.assert("Cannot register an unloaded model", get(model, 'isLoaded'));
    var session = get(this, 'session');
    
    model.eachRelationship(function(name, relationship) {
      // this is a copy that we mutate
      var existingInverses = this.map.get(clientId).get(name),
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
  },
  
  unregister: function (model) {
    var clientId = get(model, 'clientId'), inverses = this.map.get(clientId);
    inverses.forEach(function (name, inverseModels) {
      var copiedInverseModels = Ember.copy(inverseModels);
      copiedInverseModels.forEach(function (inverseModel) {
        this.unregisterRelationship(model, name, inverseModel);
      }, this);
    }, this);
    this.map.remove(clientId);
  },
  
  registerRelationship: function(model, name, inverseModel) {
    var inverse = get(model, 'type').inverseFor(name);
    
    this.map.get(get(model, 'clientId')).get(name).addObject(inverseModel);
    if(inverse) {
      this.map.get(get(inverseModel, 'clientId')).get(inverse.name).addObject(model);
      this._addToInverse(inverseModel, inverse, model);
    }
  },
  
  unregisterRelationship: function(model, name, inverseModel) {
    var inverse =  get(model, 'type').inverseFor(name);
    
    this.map.get(get(model, 'clientId')).get(name).removeObject(inverseModel);
    if(inverse) {
      this.map.get(get(inverseModel, 'clientId')).get(inverse.name).removeObject(model);
      this._removeFromInverse(inverseModel, inverse, model);
    }
  },

  _addToInverse: function(model, inverse, inverseModel) {
    // the model could have been registered when it was lazy
    model = this.session.getModel(model);
    if(!model) return;
    model.suspendRelationshipObservers(function() {
      if(inverse.kind === 'hasMany') {
        get(model, inverse.name).addObject(inverseModel)
      } else if(inverse.kind === 'belongsTo') {
        set(model, inverse.name, inverseModel);
      }
    }, this);
  },
  
  _removeFromInverse: function(model, inverse, inverseModel) {
    // the model could have been registered when it was lazy
    model = this.session.getModel(model);
    if(!model) return;
    model.suspendRelationshipObservers(function() {
      if(inverse.kind === 'hasMany') {
        get(model, inverse.name).removeObject(inverseModel)
      } else if(inverse.kind === 'belongsTo') {
        set(model, inverse.name, null);
      }
    }, this);
  },

});
