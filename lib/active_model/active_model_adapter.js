/*global jQuery*/

require('../rest/rest_adapter');
require('./serializers');

var decamelize = Ember.String.decamelize,
    underscore = Ember.String.underscore,
    pluralize = Ember.String.pluralize;

/**
  The ActiveModelAdapter is a subclass of the RestAdapter designed to integrate
  with a JSON API that uses an underscored naming convention instead of camelcasing.
  It has been designed to work out of the box with the
  [active_model_serializers](http://github.com/rails-api/active_model_serializers)
  Ruby gem.

  This adapter extends the Ep.RestAdapter by making consistent use of the camelization,
  decamelization and pluralization methods to normalize the serialized JSON into a
  format that is compatible with a conventional Rails backend.

  ## JSON Structure

  The ActiveModelAdapter expects the JSON returned from your server to follow
  the REST adapter conventions substituting underscored keys for camelcased ones.

  ### Conventional Names

  Attribute names in your JSON payload should be the underscored versions of
  the attributes in your Ember.js models.

  For example, if you have a `Person` model:

  ```js
  App.FamousPerson = Ep.Model.extend({
    firstName: Ep.attr('string'),
    lastName: Ep.attr('string'),
    occupation: Ep.attr('string')
  });
  ```

  The JSON returned should look like this:

  ```js
  {
    "famous_person": {
      "first_name": "Barack",
      "last_name": "Obama",
      "occupation": "President"
    }
  }
  ```

  @class ActiveModelAdapter
  @constructor
  @namespace Ep
  @extends RestAdapter
**/
Ep.ActiveModelAdapter = Ep.RestAdapter.extend({
  defaultSerializer: 'payload',

  setupContainer: function(parent) {
    var container = this._super(parent);
    container.register('serializer:model', Ep.ActiveModelSerializer);
    return container;
  },

  pathForType: function(type) {
    var decamelized = decamelize(type);
    var underscored = underscore(decamelized);
    return pluralize(underscored);
  }

});