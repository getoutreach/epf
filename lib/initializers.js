var set = Ember.set;

require('./setup_container');

/**
  Create the default injections.
*/
Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: "epf.container",

    initialize: function(container, application) {
      // Set the container to allow for static `find` methods on model classes
      Ep.__container__ = container;
      Ep.setupContainer(container);
    }
  });

});
