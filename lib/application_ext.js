var set = Ember.set;

/**
  Create the default injections.
*/
Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: "epf",

    initialize: function(container, application) {
      application.register('store:main', application.Store || Ep.Store);
      application.register('adapter:main', application.Adapter);
      application.register('session:base', application.Session || Ep.Session, {singleton: false});

      application.inject('adapter', 'store', 'store:main');
      application.inject('adapter', 'serializer', 'serializer:main');

      application.register('session:main', {
        create: function() {
          var container = application.__container__;
          var adapter = container.lookup('adapter:main');
          return adapter.newSession();
        }
      });

      application.inject('controller', 'adapter', 'adapter:main');
      application.inject('controller', 'session', 'session:main');
      application.inject('route', 'adapter', 'adapter:main');
      application.inject('route', 'session', 'session:main');
    }
  });
});
