require('./serializers');
require('./merge_strategies');
require('./debug');
require('./id_manager');

Ep.setupContainer = function(container, application) {
  Ep.setupSession(container, application);
  Ep.setupInjections(container, application);
  Ep.setupSerializers(container, application);
  Ep.setupMergeStrategies(container, application);
  if(Ember.DataAdapter) {
    Ep.setupDataAdapter(container, application);
  }
};

Ep.setupSession = function(container, application) {
  container.register('adapter:main', container.lookupFactory('adapter:application') || application && application.Adapter || Ep.RestAdapter);
  container.register('session:base',  Ep.Session);
  container.register('session:child', Ep.ChildSession);
  container.register('session:main', container.lookupFactory('session:application') || application && application.Session || Ep.Session);
  container.register('id-manager:main', Ep.IdManager);
}

Ep.setupInjections = function(container, application) {
  container.typeInjection('session', 'adapter', 'adapter:main');
  container.typeInjection('serializer', 'idManager', 'id-manager:main');
  container.typeInjection('session', 'idManager', 'id-manager:main');
  container.typeInjection('adapter', 'idManager', 'id-manager:main');

  container.typeInjection('controller', 'adapter', 'adapter:main');
  container.typeInjection('controller', 'session', 'session:main');
  container.typeInjection('route', 'adapter', 'adapter:main');
  container.typeInjection('route', 'session', 'session:main');
  container.typeInjection('data-adapter', 'session', 'session:main');
};

Ep.setupSerializers = function(container, application) {
  container.register('serializer:belongs-to', Ep.BelongsToSerializer);
  container.register('serializer:boolean', Ep.BooleanSerializer);
  container.register('serializer:date', Ep.DateSerializer);
  container.register('serializer:has-many', Ep.HasManySerializer);
  container.register('serializer:id', Ep.IdSerializer);
  container.register('serializer:number', Ep.NumberSerializer);
  container.register('serializer:model', Ep.ModelSerializer);
  container.register('serializer:revision', Ep.RevisionSerializer);
  container.register('serializer:string', Ep.StringSerializer);
};


Ep.setupMergeStrategies = function(container, application) {
  container.register('merge-strategy:per-field', Ep.PerField);
  container.register('merge-strategy:default', Ep.PerField);
};

Ep.setupDataAdapter = function(container, application) {
  container.register('data-adapter:main', Ep.DebugAdapter);
};
