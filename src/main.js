
import "./ext/date";
import Ep from './namespace';

import Adapter from './adapter';
import IdManager from './id_manager';
import './initializers';
import setupContainer from './setup_container';

import ModelArray from './collections/model_array';
import ModelSet from './collections/model_set';

import LocalAdapter from './local/local_adapter';

import MergeStrategy from './merge_strategies/base';
import PerField from './merge_strategies/per_field';

import attr from './model/attribute';
import Model from './model/model';
import './model/diff';
import Errors from './model/errors';
import ModelPromise from './model/promise';

import belongsTo from './relationships/belongs_to';
import './relationships/ext';
import hasMany from './relationships/has_many';
import {HasManyArray} from './relationships/has_many';

import RestErrorsSerializer from './rest/serializers/errors';
import PayloadSerializer from './rest/serializers/payload';
import EmbeddedHelpersMixin from './rest/embedded_helpers_mixin';
import EmbeddedManager from './rest/embedded_manager';
import Operation from './rest/operation';
import OperationGraph from './rest/operation_graph';
import Payload from './rest/payload';
import RestAdapter from './rest/rest_adapter';
import RestErrors from './rest/rest_errors';

import ActiveModelAdapter from './active_model/active_model_adapter';
import ActiveModelSerializer from './active_model/serializers/model';

import Serializer from './serializers/base';
import BelongsToSerializer from './serializers/belongs_to';
import BooleanSerializer from './serializers/boolean';
import DateSerializer from './serializers/date';
import HasManySerializer from './serializers/has_many';
import IdSerializer from './serializers/id';
import NumberSerializer from './serializers/number';
import ModelSerializer from './serializers/model';
import RevisionSerializer from './serializers/revision';
import StringSerializer from './serializers/string';

import ChildSession from './session/child_session';
import CollectionManager from './session/collection_manager';
import InverseManager from './session/inverse_manager';
import './session/merge';
import Session from './session/session';

import isEqual from './utils/isEqual';

import DebugAdapter from './debug/debug_adapter';

Ep.Adapter = Adapter;
Ep.IdManager = IdManager;
Ep.setupContainer = setupContainer;

Ep.ModelArray = ModelArray;
Ep.ModelSet = ModelSet;

Ep.LocalAdapter = LocalAdapter;

Ep.MergeStrategy = MergeStrategy;
Ep.PerField = PerField;

Ep.belongsTo = belongsTo;
Ep.hasMany = hasMany;
Ep.attr = attr;
Ep.Model = Model;
Ep.Errors = Errors;

Ep.ModelPromise = ModelPromise;

Ep.RestErrorsSerializer = RestErrorsSerializer;
Ep.PayloadSerializer = PayloadSerializer;
Ep.EmbeddedHelpersMixin = EmbeddedHelpersMixin;
Ep.EmbeddedManager = EmbeddedManager;
Ep.Operation = Operation;
Ep.OperationGraph = OperationGraph;
Ep.Payload = Payload;
Ep.RestAdapter = RestAdapter;
Ep.RestErrors = RestErrors;

Ep.ActiveModelAdapter = ActiveModelAdapter;
Ep.ActiveModelSerializer = ActiveModelSerializer;

Ep.Serializer = Serializer;
Ep.BelongsToSerializer = BelongsToSerializer;
Ep.BooleanSerializer = BooleanSerializer;
Ep.DateSerializer = DateSerializer;
Ep.HasManySerializer = HasManySerializer;
Ep.IdSerializer = IdSerializer;
Ep.NumberSerializer = NumberSerializer;
Ep.ModelSerializer = ModelSerializer;
Ep.RevisionSerializer = RevisionSerializer;
Ep.StringSerializer = StringSerializer;

Ep.ChildSession = ChildSession;
Ep.CollectionManager = CollectionManager;
Ep.InverseManager = InverseManager;
Ep.Session = Session;

Ep.isEqual = isEqual;

Ep.DebugAdapter = DebugAdapter;

export default Ep;