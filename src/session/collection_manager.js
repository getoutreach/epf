var get = Ember.get, set = Ember.set;

/**
  Handles tracking deleted models and removing from collections.

  @class CollectionManager
*/
export default class CollectionManager {

  constructor() {
    this.modelMap = {};
  }

  register(array, model) {
    var clientId = model.clientId,
        arrays = this.modelMap[clientId];
    if(!arrays) {
      arrays = this.modelMap[clientId] = [];
    }
    if(arrays.contains(array)) return;
    arrays.push(array);
  }

  unregister(array, model) {
    var clientId = model.clientId,
        arrays = this.modelMap[clientId];
    if(arrays) {
      _.pull(arrays, array);
      if(arrays.length === 0) {
        delete this.modelMap[clientId];
      }
    }
  }

  modelWasDeleted(model) {
    var clientId = model.clientId,
        arrays = this.modelMap[clientId];

    if(arrays) {
      // clone this operation could mutate this array 
        _.clone(arrays).forEach(function(array) {
        array.removeObject(model);
      });
    }
  }

}