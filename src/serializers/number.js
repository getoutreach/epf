var empty = Ember.isEmpty;

import Serializer from './base';

export default Serializer.extend({

  deserialize: function(serialized) {
    return empty(serialized) ? null : Number(serialized);
  },

  serialize: function(deserialized) {
    return empty(deserialized) ? null : Number(deserialized);
  }
});