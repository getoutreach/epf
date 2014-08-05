import Session from '../session/session';

import IdManager from '../id_manager';

import BelongsToSerializer from '../serializers/belongs_to';
import BooleanSerializer from '../serializers/boolean';
import DateSerializer from '../serializers/date';
import HasManySerializer from '../serializers/has_many';
import IdSerializer from '../serializers/id';
import NumberSerializer from '../serializers/number';
import ModelSerializer from '../serializers/model';
import RevisionSerializer from '../serializers/revision';
import StringSerializer from '../serializers/string';

import PerField from '../merge/per_field';
import DebugAdapter from '../ember/debug/debug_adapter';

import RestAdapter from '../rest/rest_adapter';

export default function setupContainer(container, application) {
  setupSession(container, application);
  setupInjections(container, application);
  setupSerializers(container, application);
  setupMergeStrategies(container, application);
  if(Ember.DataAdapter) {
    setupDataAdapter(container, application);
  }
};

function setupSession(container, application) {
  container.register('adapter:main', container.lookupFactory('adapter:application') || application && application.Adapter || RestAdapter);
  container.register('session:base',  Session);
  container.register('session:main', container.lookupFactory('session:application') || application && application.Session || Session);
  container.register('id-manager:main', IdManager);
}

function setupInjections(container, application) {
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

function setupSerializers(container, application) {
  container.register('serializer:belongs-to', BelongsToSerializer);
  container.register('serializer:boolean', BooleanSerializer);
  container.register('serializer:date', DateSerializer);
  container.register('serializer:has-many', HasManySerializer);
  container.register('serializer:id', IdSerializer);
  container.register('serializer:number', NumberSerializer);
  container.register('serializer:model', ModelSerializer);
  container.register('serializer:revision', RevisionSerializer);
  container.register('serializer:string', StringSerializer);
};


function setupMergeStrategies(container, application) {
  container.register('merge-strategy:per-field', PerField);
  container.register('merge-strategy:default', PerField);
};

function setupDataAdapter(container, application) {
  container.register('data-adapter:main', DebugAdapter);
};
