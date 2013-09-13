var set = Ember.set;

require('./transforms');
require('./debug');

/**
  Create the default injections.
*/
Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: "epf.container",

    initialize: function(container, application) {
      // Set the container to allow for static `find` methods on model classes
      Ep.__container__ = container;

      application.register('store:main', application.Store || Ep.Store);
      application.register('adapter:main', application.Adapter || Ep.RestAdapter);
      application.register('session:base', application.Session || Ep.Session, {singleton: false});
      application.register('session:child', application.ChildSession || Ep.ChildSession, {singleton: false});
      application.register('session:main', application.DefaultSession || Ep.Session);
      application.register('serializer:main', application.Serializer || Ep.RestSerializer);

      container.optionsForType('model', { instantiate: false });
    }
  });

  Application.initializer({
    name: "epf.injections",

    initialize: function(container, application) {
      application.inject('adapter', 'serializer', 'serializer:main');
      application.inject('session', 'adapter', 'adapter:main');

      application.inject('controller', 'adapter', 'adapter:main');
      application.inject('controller', 'session', 'session:main');
      application.inject('route', 'adapter', 'adapter:main');
      application.inject('route', 'session', 'session:main');
      application.inject('dataAdapter', 'session', 'session:main');
    }
  });

  Application.initializer({
    name: "epf.transforms",

    initialize: function(container, application) {
      application.register('transform:boolean', Ep.BooleanTransform);
      application.register('transform:date', Ep.DateTransform);
      application.register('transform:number', Ep.NumberTransform);
      application.register('transform:string', Ep.StringTransform);
    }
  });

  Application.initializer({
    name: "dataAdapter",

    initialize: function(container, application) {
      application.register('dataAdapter:main', Ep.DebugAdapter);
    }
  });
});
