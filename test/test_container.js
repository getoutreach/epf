
function TestContainer() {
  Ember.Container.call(this);
  this.register('adapter:main', Ep.LocalAdapter);
  this.register('session:base', Ep.Session);
  this.register('session:child', Ep.ChildSession);
  this.register('session:main', Ep.Session);
  this.register('id-manager:main', Ep.IdManager);

  this.typeInjection('session', 'adapter', 'adapter:main');
  this.typeInjection('serializer', 'idManager', 'id-manager:main');
  this.typeInjection('session', 'idManager', 'id-manager:main');
  this.typeInjection('adapter', 'idManager', 'id-manager:main');

  this.typeInjection('controller', 'adapter', 'adapter:main');
  this.typeInjection('controller', 'session', 'session:main');
  this.typeInjection('route', 'adapter', 'adapter:main');
  this.typeInjection('route', 'session', 'session:main');
  this.typeInjection('data-adapter', 'session', 'session:main');

  this.register('serializer:belongs-to', Ep.BelongsToSerializer);
  this.register('serializer:boolean', Ep.BooleanSerializer);
  this.register('serializer:date', Ep.DateSerializer);
  this.register('serializer:has-many', Ep.HasManySerializer);
  this.register('serializer:id', Ep.IdSerializer);
  this.register('serializer:number', Ep.NumberSerializer);
  this.register('serializer:model', Ep.ModelSerializer);
  this.register('serializer:revision', Ep.RevisionSerializer);
  this.register('serializer:string', Ep.StringSerializer);

  this.register('merge-strategy:per-field', Ep.PerField);
  this.register('merge-strategy:default', Ep.PerField);
}

TestContainer.prototype = new Ember.Container();

module.exports = TestContainer;
