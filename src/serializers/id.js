import Serializer from './base';

export default Serializer.extend({

  deserialize: function(serialized) {
    if(serialized === undefined || serialized === null) return;
    return serialized+'';
  },

  serialize: function(id) {
    if (isNaN(id) || id === null) { return id; }
    return +id;
  }

});
