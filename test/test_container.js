
function TestContainer() {
  Ember.Container.call(this);
  this.register('adapter:main', Ep.LocalAdapter);
  this.register('session:base', Ep.Session, {singleton: false});
  this.register('session:child', Ep.ChildSession, {singleton: false});
  this.register('session:main', Ep.Session);
  this.register('idManager:main', Ep.IdManager);

  this.typeInjection('session', 'adapter', 'adapter:main');
  this.typeInjection('serializer', 'idManager', 'idManager:main');
  this.typeInjection('session', 'idManager', 'idManager:main');
  this.typeInjection('adapter', 'idManager', 'idManager:main');

  this.typeInjection('controller', 'adapter', 'adapter:main');
  this.typeInjection('controller', 'session', 'session:main');
  this.typeInjection('route', 'adapter', 'adapter:main');
  this.typeInjection('route', 'session', 'session:main');
  this.typeInjection('dataAdapter', 'session', 'session:main');

  this.register('serializer:belongs-to', Ep.BelongsToSerializer);
  this.register('serializer:boolean', Ep.BooleanSerializer);
  this.register('serializer:date', Ep.DateSerializer);
  this.register('serializer:has-many', Ep.HasManySerializer);
  this.register('serializer:id', Ep.IdSerializer);
  this.register('serializer:number', Ep.NumberSerializer);
  this.register('serializer:model', Ep.ModelSerializer);
  this.register('serializer:revision', Ep.RevisionSerializer);
  this.register('serializer:string', Ep.StringSerializer);
}

TestContainer.prototype = new Ember.Container();

module.exports = TestContainer;
