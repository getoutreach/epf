var empty = Ember.isEmpty;

import Serializer from './base';

export default Serializer.extend({

  deserialize: function(serialized) {
    return serialized ? serialized : undefined;
  },

  serialize: function(deserialized) {
    return deserialized ? deserialized : undefined;
  }
});