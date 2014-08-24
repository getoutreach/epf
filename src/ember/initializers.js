var set = Ember.set;

import setupContainer from './setup_container';

/**
  Create the default injections.
*/
Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: "coalesce.container",

    initialize: function(container, application) {
      // Set the container to allow for static `find` methods on model classes
      Coalesce.__container__ = container;
      setupContainer(container, application);
    }
  });

});
