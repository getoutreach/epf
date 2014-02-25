var set = Ember.set;

require('./serializers');
require('./debug');
require('./id_manager');

/**
  Create the default injections.
*/
Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: "epf.container",

    initialize: function(container, application) {
      // Set the container to allow for static `find` methods on model classes
      Ep.__container__ = container;

      application.register('adapter:main', application.Adapter || Ep.RestAdapter);
      application.register('session:base', application.Session || Ep.Session, {singleton: false});
      application.register('session:child', application.ChildSession || Ep.ChildSession, {singleton: false});
      application.register('session:main', application.DefaultSession || Ep.Session);
      application.register('idManager:main', Ep.IdManager)
    }
  });

  Application.initializer({
    name: "epf.injections",

    initialize: function(container, application) {
      application.inject('session', 'adapter', 'adapter:main');
      application.inject('serializer', 'idManager', 'idManager:main');
      application.inject('session', 'idManager', 'idManager:main');
      application.inject('adapter', 'idManager', 'idManager:main');

      application.inject('controller', 'adapter', 'adapter:main');
      application.inject('controller', 'session', 'session:main');
      application.inject('route', 'adapter', 'adapter:main');
      application.inject('route', 'session', 'session:main');
      application.inject('dataAdapter', 'session', 'session:main');
    }
  });

  Application.initializer({
    name: "epf.serializers",

    initialize: function(container, application) {
      application.register('serializer:belongsTo', Ep.BelongsToSerializer);
      application.register('serializer:boolean', Ep.BooleanSerializer);
      application.register('serializer:date', Ep.DateSerializer);
      application.register('serializer:hasMany', Ep.HasManySerializer);
      application.register('serializer:id', Ep.IdSerializer);
      application.register('serializer:number', Ep.NumberSerializer);
      application.register('serializer:model', Ep.ModelSerializer);
      application.register('serializer:payload', Ep.PayloadSerializer);
      application.register('serializer:revision', Ep.RevisionSerializer);
      application.register('serializer:string', Ep.StringSerializer);
    }
  });

  Application.initializer({
    name: "dataAdapter",

    initialize: function(container, application) {
      application.register('dataAdapter:main', Ep.DebugAdapter);
    }
  });
});
