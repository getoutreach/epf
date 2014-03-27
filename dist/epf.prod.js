(function (global) {
    function require(file, parentModule) {
        if ({}.hasOwnProperty.call(require.cache, file))
            return require.cache[file];
        var resolved = require.resolve(file);
        if (!resolved)
            throw new Error('Failed to resolve module ' + file);
        var module$ = {
                id: file,
                require: require,
                filename: file,
                exports: {},
                loaded: false,
                parent: parentModule,
                children: []
            };
        if (parentModule)
            parentModule.children.push(module$);
        var dirname = file.slice(0, file.lastIndexOf('/') + 1);
        require.cache[file] = module$.exports;
        resolved.call(module$.exports, module$, module$.exports, dirname, file);
        module$.loaded = true;
        return require.cache[file] = module$.exports;
    }
    require.modules = {};
    require.cache = {};
    require.resolve = function (file) {
        return {}.hasOwnProperty.call(require.modules, file) ? require.modules[file] : void 0;
    };
    require.define = function (file, fn) {
        require.modules[file] = fn;
    };
    var process = function () {
            var cwd = '/';
            return {
                title: 'browser',
                version: 'v0.10.25',
                browser: true,
                env: {},
                argv: [],
                nextTick: global.setImmediate || function (fn) {
                    setTimeout(fn, 0);
                },
                cwd: function () {
                    return cwd;
                },
                chdir: function (dir) {
                    cwd = dir;
                }
            };
        }();
    require.define('/lib/index.js', function (module, exports, __dirname, __filename) {
        require('/vendor/ember-inflector.js', module);
        global.Ep = Ember.Namespace.create();
        require('/lib/version.js', module);
        require('/lib/initializers.js', module);
        require('/lib/model/index.js', module);
        require('/lib/session/index.js', module);
        require('/lib/serializers/index.js', module);
        require('/lib/merge_strategies/index.js', module);
        require('/lib/local/index.js', module);
        require('/lib/rest/index.js', module);
        require('/lib/active_model/index.js', module);
    });
    require.define('/lib/active_model/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/active_model/active_model_adapter.js', module);
    });
    require.define('/lib/active_model/active_model_adapter.js', function (module, exports, __dirname, __filename) {
        require('/lib/rest/rest_adapter.js', module);
        require('/lib/active_model/serializers/index.js', module);
        var decamelize = Ember.String.decamelize, underscore = Ember.String.underscore, pluralize = Ember.String.pluralize;
        Ep.ActiveModelAdapter = Ep.RestAdapter.extend({
            defaultSerializer: 'payload',
            setupContainer: function (parent) {
                var container = this._super(parent);
                container.register('serializer:model', Ep.ActiveModelSerializer);
                return container;
            },
            pathForType: function (type) {
                var decamelized = decamelize(type);
                var underscored = underscore(decamelized);
                return pluralize(underscored);
            }
        });
    });
    require.define('/lib/active_model/serializers/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/active_model/serializers/model.js', module);
    });
    require.define('/lib/active_model/serializers/model.js', function (module, exports, __dirname, __filename) {
        Ep.ActiveModelSerializer = Ep.ModelSerializer.extend({
            keyForType: function (name, type, opts) {
                var key = this._super(name, type);
                if (!opts || !opts.embedded) {
                    if (type === 'belongsTo') {
                        return key + '_id';
                    } else if (type === 'hasMany') {
                        return Ember.String.singularize(key) + '_ids';
                    }
                }
                return key;
            }
        });
    });
    require.define('/lib/rest/rest_adapter.js', function (module, exports, __dirname, __filename) {
        require('/lib/adapter.js', module);
        require('/lib/rest/embedded_manager.js', module);
        require('/lib/rest/operation_graph.js', module);
        require('/lib/rest/rest_errors.js', module);
        require('/lib/rest/serializers/index.js', module);
        var get = Ember.get, set = Ember.set, forEach = Ember.ArrayPolyfills.forEach;
        var EmbeddedHelpersMixin = require('/lib/rest/embedded_helpers_mixin.js', module);
        var materializeRelationships = require('/lib/utils/materialize_relationships.js', module);
        Ep.RestAdapter = Ep.Adapter.extend(EmbeddedHelpersMixin, {
            defaultSerializer: 'payload',
            init: function () {
                this._super.apply(this, arguments);
                this._embeddedManager = Ep.EmbeddedManager.create({
                    adapter: this,
                    container: this.container
                });
                this._pendingOps = {};
            },
            setupContainer: function (parent) {
                var container = parent.child();
                container.register('serializer:errors', Ep.RestErrorsSerializer);
                container.register('serializer:payload', Ep.PayloadSerializer);
                return container;
            },
            load: function (typeKey, id, opts, session) {
                var context = {
                        typeKey: typeKey,
                        id: id
                    };
                var promise = this._load(typeKey, id, opts).then(null, function (payload) {
                        var type = session.typeFor(typeKey);
                        throw Ep.LoadError.create({
                            type: type,
                            id: id,
                            errors: get(payload, 'errors')
                        });
                    });
                return this._mergeAndContextualizePromise(promise, session, context, opts);
            },
            _load: function (typeKey, id, opts) {
                var context = {
                        typeKey: typeKey,
                        id: id
                    };
                opts = Ember.merge({ type: 'GET' }, opts || {});
                return this._remoteCall(context, null, null, opts);
            },
            refresh: function (model, opts, session) {
                return this._mergeAndContextualizePromise(this._refresh(model, opts), session, model, opts);
            },
            _refresh: function (model, opts) {
                opts = Ember.merge({ type: 'GET' }, opts || {});
                return this._remoteCall(model, null, null, opts);
            },
            update: function (model, opts, session) {
                return this._mergeAndContextualizePromise(this._update(model, opts), session, model, opts);
            },
            _update: function (model, opts) {
                opts = Ember.merge({ type: 'PUT' }, opts || {});
                return this._remoteCall(model, null, model, opts);
            },
            create: function (model, opts, session) {
                return this._mergeAndContextualizePromise(this._create(model, opts), session, model, opts);
            },
            _create: function (model, opts) {
                return this._remoteCall(model, null, model, opts);
            },
            deleteModel: function (model, opts, session) {
                return this._mergeAndContextualizePromise(this._deleteModel(model, opts), session, model, opts);
            },
            _deleteModel: function (model, opts) {
                opts = Ember.merge({ type: 'DELETE' }, opts || {});
                return this._remoteCall(model, null, null, opts);
            },
            query: function (typeKey, query, opts, session) {
                return this._mergeAndContextualizePromise(this._query(typeKey, query, opts), session, typeKey, opts);
            },
            _query: function (typeKey, query, opts) {
                opts = Ember.merge({
                    type: 'GET',
                    serialize: false,
                    deserializer: 'payload'
                }, opts || {});
                return this._remoteCall(typeKey, null, query, opts);
            },
            remoteCall: function (context, name, data, opts, session) {
                var serialize = data && !!get(data, 'isModel');
                opts = Ember.merge({
                    serialize: serialize,
                    deserializer: 'payload'
                }, opts || {});
                return this._mergeAndContextualizePromise(this._remoteCall(context, name, data, opts), session, context, opts);
            },
            _remoteCall: function (context, name, data, opts) {
                var adapter = this, url = this.buildUrlFromContext(context), opts = this._normalizeOptions(opts);
                url = this.buildUrlFromContext(context, name);
                method = opts.type || 'POST';
                if (opts.serialize !== false) {
                    var serializer = opts.serializer, serializerOptions = opts.serializerOptions;
                    if (!serializer && context) {
                        serializer = this.serializerForContext(context);
                    }
                    if (serializer && data) {
                        serializer = this.serializerFor(serializer);
                        serializerOptions = Ember.merge({ context: context }, serializerOptions || {});
                        data = serializer.serialize(data, serializerOptions);
                    }
                }
                if (opts.params) {
                    data = Ember.merge(data, opts.params);
                }
                return this._deserializePromise(this.ajax(url, method, { data: data }), context, opts);
            },
            _normalizeOptions: function (opts) {
                opts = opts || {};
                if (opts.serializerOptions && typeof opts.serializerOptions.context === 'function') {
                    opts.serializerOptions.context = get(opts.serializerOptions.context, 'typeKey');
                }
                return opts;
            },
            serializerForContext: function (context) {
                return get(this, 'defaultSerializer');
            },
            _deserializePromise: function (promise, context, opts) {
                var adapter = this;
                return promise.then(function (data) {
                    if (opts.deserialize !== false) {
                        var serializer = opts.deserializer || opts.serializer, serializerOptions = opts.serializerOptions;
                        if (!serializer && context) {
                            serializer = adapter.serializerForContext(context);
                        }
                        if (serializer) {
                            serializer = adapter.serializerFor(serializer);
                            serializerOptions = Ember.merge({ context: context }, serializerOptions || {});
                        }
                        return serializer.deserialize(data, serializerOptions);
                    }
                    return data;
                }, function (xhr) {
                    if (opts.deserialize !== false) {
                        var data;
                        if (xhr.responseText) {
                            data = JSON.parse(xhr.responseText);
                        } else {
                            data = {};
                        }
                        var serializer = opts.errorSerializer || opts.deserializer || opts.serializer, serializerOptions = opts.serializerOptions;
                        if (!serializer && context) {
                            serializer = adapter.serializerForContext(context);
                        }
                        if (serializer) {
                            serializer = adapter.serializerFor(serializer);
                            serializerOptions = Ember.merge({
                                context: context,
                                xhr: xhr
                            }, serializerOptions || {});
                        }
                        throw serializer.deserialize(data, serializerOptions);
                    }
                    throw xhr;
                });
            },
            _mergePromise: function (promise, session, opts) {
                if (opts && opts.deserialize === false) {
                    return promise;
                }
                function merge(deserialized) {
                    if (typeof deserialized.merge === 'function') {
                        return deserialized.merge(session);
                    } else {
                        return session.merge(deserialized);
                    }
                }
                return promise.then(function (deserialized) {
                    return merge(deserialized);
                }, function (deserialized) {
                    throw merge(deserialized);
                });
            },
            _contextualizePromise: function (promise, context, opts) {
                if (opts && opts.deserializationContext !== undefined) {
                    context = opts.deserializationContext;
                }
                function contextualize(merged) {
                    if (context && get(merged, 'isPayload')) {
                        var result = get(merged, 'context');
                        if (!result) {
                            result = context;
                        }
                        set(result, 'meta', get(merged, 'meta'));
                        if (get(merged, 'errors') && !get(result, 'errors')) {
                            set(result, 'errors', get(merged, 'errors'));
                        }
                        return result;
                    }
                    return merged;
                }
                return promise.then(function (merged) {
                    return contextualize(merged);
                }, function (merged) {
                    throw contextualize(merged);
                });
            },
            _mergeAndContextualizePromise: function (promise, session, context, opts) {
                return this._contextualizePromise(this._mergePromise(promise, session, opts), context, opts);
            },
            mergePayload: function (data, context, session) {
                var payload = this.deserialize('payload', data, { context: context });
                if (!session) {
                    session = this.container.lookup('session:main');
                }
                payload.merge(session);
                if (context) {
                    return payload.context;
                }
                return payload;
            },
            willMergeModel: function (model) {
                if (!get(model, 'isLoaded')) {
                    return;
                }
                this._embeddedManager.updateParents(model);
            },
            flush: function (session) {
                var models = get(session, 'dirtyModels').copy(true);
                var shadows = Ep.ModelSet.fromArray(models.map(function (model) {
                        return session.shadows.getModel(model);
                    }));
                this.dirtyEmbedded(models, shadows, session);
                this.removeEmbeddedOrphans(models, shadows, session);
                materializeRelationships(models);
                var op = Ep.OperationGraph.create({
                        models: models,
                        shadows: shadows,
                        adapter: this,
                        session: session
                    });
                return this._performFlush(op, session);
            },
            _performFlush: function (op, session) {
                var models = get(op, 'models'), pending = Ember.Set.create();
                models.forEach(function (model) {
                    var op = this._pendingOps[model.clientId];
                    if (op)
                        pending.add(op);
                }, this);
                var adapter = this;
                if (get(pending, 'length') > 0) {
                    return Ember.RSVP.all(pending.toArray()).then(function () {
                        return adapter._performFlush(op, session);
                    });
                }
                var promise = op.perform();
                models.forEach(function (model) {
                    this._pendingOps[model.clientId] = promise;
                }, this);
                return promise.then(function (res) {
                    models.forEach(function (model) {
                        delete adapter._pendingOps[model.clientId];
                    });
                    return res.map(function (model) {
                        return session.merge(model);
                    });
                }, function (err) {
                    models.forEach(function (model) {
                        delete adapter._pendingOps[model.clientId];
                    });
                    throw err.map(function (model) {
                        return session.merge(model);
                    });
                });
            },
            rebuildRelationships: function (children, parent) {
                parent.suspendRelationshipObservers(function () {
                    for (var i = 0; i < children.length; i++) {
                        var child = children[i];
                        child.eachRelationship(function (name, relationship) {
                            if (relationship.kind === 'belongsTo') {
                                var value = get(child, name);
                                var inverse = child.constructor.inverseFor(name);
                                if (inverse) {
                                    if (this.embeddedType(inverse.type, inverse.name)) {
                                        return;
                                    }
                                    if (inverse.kind === 'hasMany') {
                                        var parentCollection = get(parent, inverse.name);
                                        if (child.get('isDeleted')) {
                                            parentCollection.removeObject(child);
                                        } else if (value && value.isEqual(parent)) {
                                            parentCollection.addObject(child);
                                        }
                                    }
                                }
                            }
                        }, this);
                    }
                }, this);
            },
            isRelationshipOwner: function (relationship) {
                var config = this.configFor(relationship.parentType);
                var owner = config[relationship.key] && config[relationship.key].owner;
                return relationship.kind === 'belongsTo' && owner !== false || relationship.kind === 'hasMany' && owner === true;
            },
            isDirtyFromRelationships: function (model, cached, relDiff) {
                var serializer = this.serializerForModel(model);
                for (var i = 0; i < relDiff.length; i++) {
                    var diff = relDiff[i];
                    if (this.isRelationshipOwner(diff.relationship) || serializer.embeddedType(model.constructor, diff.name) === 'always') {
                        return true;
                    }
                }
                return false;
            },
            shouldSave: function (model) {
                return !this.isEmbedded(model);
            },
            isEmbedded: function (model) {
                return this._embeddedManager.isEmbedded(model);
            },
            removeEmbeddedOrphans: function (models, shadows, session) {
                var orphans = [];
                models.forEach(function (model) {
                    if (!this.isEmbedded(model))
                        return;
                    var root = this.findEmbeddedRoot(model, models);
                    if (!root || root.isEqual(model)) {
                        orphans.push(model);
                    }
                }, this);
                models.removeObjects(orphans);
                shadows.removeObjects(orphans);
            },
            dirtyEmbedded: function (models, shadows, session) {
                models.forEach(function (model) {
                    this.eachEmbeddedRelative(model, function (embeddedModel) {
                        if (get(embeddedModel, 'isLoaded')) {
                            this._embeddedManager.updateParents(embeddedModel);
                        }
                        if (models.contains(embeddedModel)) {
                            return;
                        }
                        embeddedModel = session.getModel(embeddedModel);
                        var copy = embeddedModel.copy();
                        models.add(copy);
                        shadows.add(copy);
                    }, this);
                }, this);
            },
            findEmbeddedRoot: function (model, models) {
                var parent = model;
                while (parent) {
                    model = parent;
                    parent = this._embeddedManager.findParent(model);
                }
                return models.getModel(model);
            },
            eachEmbeddedRelative: function (model, callback, binding, visited) {
                if (!visited)
                    visited = new Ember.Set();
                if (visited.contains(model))
                    return;
                visited.add(model);
                callback.call(binding, model);
                if (!get(model, 'isLoaded'))
                    return;
                this.serializerForModel(model).eachEmbeddedRecord(model, function (embeddedRecord, embeddedType) {
                    this.eachEmbeddedRelative(embeddedRecord, callback, binding, visited);
                }, this);
                var parent = this._embeddedManager.findParent(model);
                if (parent) {
                    this.eachEmbeddedRelative(parent, callback, binding, visited);
                }
            },
            buildUrlFromContext: function (context, action) {
                var typeKey, id;
                if (typeof context === 'string') {
                    typeKey = context;
                } else {
                    typeKey = get(context, 'typeKey');
                    id = get(context, 'id');
                }
                var url = this.buildUrl(typeKey, id);
                if (action) {
                    url = url + '/' + action;
                }
                return url;
            },
            buildUrl: function (typeKey, id) {
                var url = [], host = get(this, 'host'), prefix = this.urlPrefix();
                if (typeKey) {
                    url.push(this.pathForType(typeKey));
                }
                if (id) {
                    url.push(id);
                }
                if (prefix) {
                    url.unshift(prefix);
                }
                url = url.join('/');
                if (!host && url) {
                    url = '/' + url;
                }
                return url;
            },
            urlPrefix: function (path, parentURL) {
                var host = get(this, 'host'), namespace = get(this, 'namespace'), url = [];
                if (path) {
                    if (path.charAt(0) === '/') {
                        if (host) {
                            path = path.slice(1);
                            url.push(host);
                        }
                    } else if (!/^http(s)?:\/\//.test(path)) {
                        url.push(parentURL);
                    }
                } else {
                    if (host) {
                        url.push(host);
                    }
                    if (namespace) {
                        url.push(namespace);
                    }
                }
                if (path) {
                    url.push(path);
                }
                return url.join('/');
            },
            pathForType: function (type) {
                var camelized = Ember.String.camelize(type);
                return Ember.String.pluralize(camelized);
            },
            ajaxError: function (jqXHR) {
                if (jqXHR) {
                    jqXHR.then = null;
                }
                return jqXHR;
            },
            ajax: function (url, type, hash) {
                var adapter = this;
                return new Ember.RSVP.Promise(function (resolve, reject) {
                    hash = adapter.ajaxOptions(url, type, hash);
                    hash.success = function (json) {
                        Ember.run(null, resolve, json);
                    };
                    hash.error = function (jqXHR, textStatus, errorThrown) {
                        Ember.run(null, reject, adapter.ajaxError(jqXHR));
                    };
                    Ember.$.ajax(hash);
                }, 'Ep: RestAdapter#ajax ' + type + ' to ' + url);
            },
            ajaxOptions: function (url, type, hash) {
                hash = hash || {};
                hash.url = url;
                hash.type = type;
                hash.dataType = 'json';
                hash.context = this;
                if (hash.data && type !== 'GET') {
                    hash.contentType = 'application/json; charset=utf-8';
                    hash.data = JSON.stringify(hash.data);
                }
                var headers = get(this, 'headers');
                if (headers !== undefined) {
                    hash.beforeSend = function (xhr) {
                        forEach.call(Ember.keys(headers), function (key) {
                            xhr.setRequestHeader(key, headers[key]);
                        });
                    };
                }
                return hash;
            }
        });
    });
    require.define('/lib/utils/materialize_relationships.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        module.exports = function (models) {
            if (!(models instanceof Ep.ModelSet)) {
                models = Ep.ModelSet.fromArray(models);
            }
            models.forEach(function (model) {
                model.eachRelationship(function (name, relationship) {
                    if (relationship.kind === 'belongsTo') {
                        var child = get(model, name);
                        if (child) {
                            child = models.getModel(child) || child;
                            set(model, name, child);
                        }
                    } else if (relationship.kind === 'hasMany') {
                        var children = get(model, name);
                        var lazyChildren = Ep.ModelSet.create();
                        lazyChildren.addObjects(children);
                        children.clear();
                        lazyChildren.forEach(function (child) {
                            child = models.getModel(child) || child;
                            children.addObject(child);
                        });
                    }
                }, this);
            }, this);
        };
    });
    require.define('/lib/rest/embedded_helpers_mixin.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        var SerializerForMixin = require('/lib/serializers/serializer_for_mixin.js', module);
        module.exports = Ember.Mixin.create(SerializerForMixin, {
            embeddedType: function (type, name) {
                var serializer = this.serializerForType(type);
                if (this === serializer) {
                    var config = this.configFor(name);
                    return config.embedded;
                }
                return serializer.embeddedType(type, name);
            },
            eachEmbeddedRecord: function (record, callback, binding) {
                this.eachEmbeddedBelongsToRecord(record, callback, binding);
                this.eachEmbeddedHasManyRecord(record, callback, binding);
            },
            eachEmbeddedBelongsToRecord: function (record, callback, binding) {
                this.eachEmbeddedBelongsTo(record.constructor, function (name, relationship, embeddedType) {
                    var embeddedRecord = get(record, name);
                    if (embeddedRecord) {
                        callback.call(binding, embeddedRecord, embeddedType);
                    }
                });
            },
            eachEmbeddedHasManyRecord: function (record, callback, binding) {
                this.eachEmbeddedHasMany(record.constructor, function (name, relationship, embeddedType) {
                    var array = get(record, name);
                    for (var i = 0, l = get(array, 'length'); i < l; i++) {
                        callback.call(binding, array.objectAt(i), embeddedType);
                    }
                });
            },
            eachEmbeddedHasMany: function (type, callback, binding) {
                this.eachEmbeddedRelationship(type, 'hasMany', callback, binding);
            },
            eachEmbeddedBelongsTo: function (type, callback, binding) {
                this.eachEmbeddedRelationship(type, 'belongsTo', callback, binding);
            },
            eachEmbeddedRelationship: function (type, kind, callback, binding) {
                type.eachRelationship(function (name, relationship) {
                    var embeddedType = this.embeddedType(type, name);
                    if (embeddedType) {
                        if (relationship.kind === kind) {
                            callback.call(binding, name, relationship, embeddedType);
                        }
                    }
                }, this);
            }
        });
    });
    require.define('/lib/serializers/serializer_for_mixin.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        module.exports = Ember.Mixin.create({
            serializerFor: function (typeKey) {

                var lookupKey = Ember.String.dasherize(typeKey);
                var serializer = this.container.lookup('serializer:' + lookupKey);
                if (!serializer) {
                    var modelExists = !!this.container.lookupFactory('model:' + typeKey);
                    if (!modelExists)
                        return;
                    var Serializer = this.container.lookupFactory('serializer:model');
                    this.container.register('serializer:' + lookupKey, Serializer);
                    serializer = this.container.lookup('serializer:' + lookupKey);
                }
                serializer.typeKey = typeKey;
                return serializer;
            },
            serializerForType: function (type) {
                return this.serializerFor(get(type, 'typeKey'));
            },
            serializerForModel: function (model) {
                var type = get(model, 'type');
                return this.serializerForType(type);
            }
        });
    });
    require.define('/lib/rest/serializers/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/rest/serializers/errors.js', module);
        require('/lib/rest/serializers/payload.js', module);
    });
    require.define('/lib/rest/serializers/payload.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        var materializeRelationships = require('/lib/utils/materialize_relationships.js', module);
        Ep.PayloadSerializer = Ep.Serializer.extend({
            mergedProperties: ['aliases'],
            aliases: {},
            metaKey: 'meta',
            errorsKey: 'errors',
            singularize: function (name) {
                return Ember.String.singularize(name);
            },
            typeKeyFor: function (name) {
                var singular = this.singularize(name), aliases = get(this, 'aliases'), alias = aliases[name];
                return alias || singular;
            },
            rootForTypeKey: function (typeKey) {
                return typeKey;
            },
            serialize: function (model) {
                var typeKey = get(model, 'typeKey'), root = this.rootForTypeKey(typeKey), res = {}, serializer = this.serializerFor(typeKey);
                res[root] = serializer.serialize(model);
                return res;
            },
            deserialize: function (hash, opts) {
                opts = opts || {};
                var result = Ep.Payload.create(), metaKey = get(this, 'metaKey'), errorsKey = get(this, 'errorsKey'), context = opts.context, xhr = opts.xhr;
                if (context && typeof context === 'string') {
                    set(result, 'context', []);
                }
                for (var prop in hash) {
                    if (!hash.hasOwnProperty(prop)) {
                        continue;
                    }
                    if (prop === metaKey) {
                        result.meta = hash[prop];
                        continue;
                    }
                    var value = hash[prop];
                    if (prop === errorsKey) {
                        var serializer = this.serializerFor('errors', opts), errors = serializer.deserialize(value, opts);
                        result.errors = errors;
                        continue;
                    }
                    function checkForContext(model) {
                        if (context) {
                            if (typeof context === 'string' && typeKey === context) {
                                result.context.push(model);
                            } else if (get(context, 'isModel')) {
                                result.context = model;
                            } else if (get(model, 'id') === context.id && get(model, 'typeKey') === context.typeKey) {
                                result.context = model;
                            }
                        }
                    }
                    var typeKey = this.typeKeyFor(prop), serializer = this.serializerFor(typeKey);
                    if (Ember.isArray(value)) {
                        for (var i = 0; i < value.length; i++) {
                            var model = serializer.deserialize(value[i]);
                            checkForContext(model);
                            result.add(model);
                        }
                    } else {
                        var model = serializer.deserialize(value);
                        checkForContext(model);
                        result.add(model);
                    }
                }
                if (xhr) {
                    var errors = get(result, 'errors');
                    if (!errors) {
                        var serializer = this.serializerFor('errors'), errors = serializer.deserialize({}, opts);
                        set(result, 'errors', errors);
                    }
                }
                materializeRelationships(result);
                return result;
            }
        });
    });
    require.define('/lib/rest/serializers/errors.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set, isEmpty = Ember.isEmpty;
        Ep.RestErrorsSerializer = Ep.Serializer.extend({
            deserialize: function (serialized, opts) {
                var xhr = opts && opts.xhr;
                if (!xhr && (isEmpty(serialized) || isEmptyObject(serialized)))
                    return;
                var content = {};
                for (var key in serialized) {
                    content[this.transformPropertyKey(key)] = serialized[key];
                }
                res = Ep.RestErrors.create({ content: content });
                if (xhr) {
                    set(res, 'status', xhr.status);
                    set(res, 'xhr', xhr);
                }
                return res;
            },
            transformPropertyKey: function (name) {
                return Ember.String.camelize(name);
            },
            serialize: function (id) {
                throw new Ember.Error('Errors are not currently serialized down to the server.');
            }
        });
        function isEmptyObject(obj) {
            return Ember.keys(obj).length === 0;
        }
    });
    require.define('/lib/rest/rest_errors.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.RestErrors = Ep.Errors.extend({
            status: null,
            xhr: null,
            copy: function () {
                return Ep.RestErrors.create({
                    content: Ember.copy(this.content),
                    status: this.status,
                    xhr: this.xhr
                });
            }
        });
    });
    require.define('/lib/rest/operation_graph.js', function (module, exports, __dirname, __filename) {
        require('/lib/rest/operation.js', module);
        var get = Ember.get, set = Ember.set;
        Ep.OperationGraph = Ember.Object.extend({
            models: null,
            shadows: null,
            rootOps: null,
            adapter: null,
            init: function () {
                var graph = this, adapter = get(this, 'adapter'), session = get(this, 'session');
                this.ops = Ember.MapWithDefault.create({
                    defaultValue: function (model) {
                        return Ep.Operation.create({
                            model: model,
                            graph: graph,
                            adapter: adapter,
                            session: session
                        });
                    }
                });
                this.rootOps = Ember.Set.create();
                this.build();
            },
            perform: function () {
                return this.createPromise();
            },
            build: function () {
                var adapter = get(this, 'adapter');
                var models = get(this, 'models');
                var shadows = get(this, 'shadows');
                var rootOps = get(this, 'rootOps');
                var ops = get(this, 'ops');
                models.forEach(function (model) {
                    if (!get(model, 'isLoaded')) {
                        return;
                    }
                    var shadow = shadows.getModel(model);

                    var op = ops.get(model);
                    set(op, 'shadow', shadow);
                    var isEmbedded = adapter.isEmbedded(model);
                    if (get(op, 'isDirty') && isEmbedded) {
                        var rootModel = adapter.findEmbeddedRoot(model, models);
                        var rootOp = this.getOp(rootModel);
                        set(rootOp, 'force', true);
                        var parentModel = adapter._embeddedManager.findParent(model);
                        var parentOp = this.getOp(parentModel);
                        parentOp.addChild(op);
                    }
                    var rels = get(op, 'dirtyRelationships');
                    for (var i = 0; i < rels.length; i++) {
                        var d = rels[i];
                        var name = d.name;
                        var parentModel = model.get(name) || shadows.getModel(d.oldValue);
                        var serializer = adapter.serializerForModel(model);
                        var isEmbeddedRel = serializer.embeddedType(get(model, 'type'), name);
                        if (parentModel && !isEmbeddedRel) {
                            var parentOp = this.getOp(parentModel);
                            parentOp.addChild(op);
                        }
                    }
                }, this);
                ops.forEach(function (model, op) {
                    if (get(op, 'isDirty') && get(op, 'isRoot')) {
                        rootOps.add(op);
                    }
                }, this);
            },
            getOp: function (model) {
                var models = get(this, 'models');
                var materializedModel = models.getModel(model);
                if (materializedModel)
                    model = materializedModel;
                return this.ops.get(model);
            },
            createPromise: function () {
                var rootOps = get(this, 'rootOps'), adapter = get(this, 'adapter'), cumulative = [];
                function createNestedPromise(op) {
                    var promise = op.perform();
                    promise = promise.then(function (model) {
                        cumulative.push(model);
                        return model;
                    }, function (model) {
                        cumulative.push(model);
                        throw model;
                    });
                    if (op.children.length > 0) {
                        promise = promise.then(function (model) {
                            var childPromises = op.children.map(createNestedPromise);
                            return Ember.RSVP.all(childPromises).then(function (models) {
                                adapter.rebuildRelationships(models, model);
                                return model;
                            });
                        });
                    }
                    return promise;
                }
                return Ember.RSVP.all(rootOps.map(createNestedPromise)).then(function () {
                    return cumulative;
                }, function (err) {
                    throw cumulative;
                });
            },
            toStringExtension: function () {
                var result = '';
                var rootOps = get(this, 'rootOps');
                rootOps.forEach(function (op) {
                    result += '\n' + op.toString(1);
                });
                return result + '\n';
            }
        });
    });
    require.define('/lib/rest/operation.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.Operation = Ember.Object.extend({
            model: null,
            shadow: null,
            adapter: null,
            _promise: null,
            force: false,
            init: function () {
                this.children = Ember.Set.create();
                this.parents = Ember.Set.create();
            },
            dirtyRelationships: Ember.computed(function () {
                var adapter = get(this, 'adapter'), model = get(this, 'model'), rels = [], shadow = get(this, 'shadow');
                if (get(model, 'isNew')) {
                    model.eachRelationship(function (name, relationship) {
                        if (adapter.isRelationshipOwner(relationship)) {
                            rels.push({
                                name: name,
                                type: relationship.kind,
                                relationship: relationship,
                                oldValue: null
                            });
                        }
                    }, this);
                } else {
                    var diff = model.diff(shadow);
                    for (var i = 0; i < diff.length; i++) {
                        var d = diff[i];
                        if (d.relationship && adapter.isRelationshipOwner(d.relationship)) {
                            rels.push(d);
                        }
                    }
                }
                return rels;
            }),
            isDirty: Ember.computed(function () {
                return !!get(this, 'dirtyType');
            }),
            isDirtyFromUpdates: Ember.computed(function () {
                var model = get(this, 'model'), shadow = get(this, 'shadow'), adapter = get(this, 'adapter');
                var diff = model.diff(shadow);
                var dirty = false;
                var relDiff = [];
                for (var i = 0; i < diff.length; i++) {
                    var d = diff[i];
                    if (d.type == 'attr') {
                        dirty = true;
                    } else {
                        relDiff.push(d);
                    }
                }
                return dirty || adapter.isDirtyFromRelationships(model, shadow, relDiff);
            }),
            dirtyType: Ember.computed(function () {
                var model = get(this, 'model');
                if (get(model, 'isNew')) {
                    return 'created';
                } else if (get(model, 'isDeleted')) {
                    return 'deleted';
                } else if (get(this, 'isDirtyFromUpdates') || get(this, 'force')) {
                    return 'updated';
                }
            }),
            perform: function () {
                if (this._promise)
                    return this._promise;
                var adapter = get(this, 'adapter'), session = get(this, 'session'), dirtyType = get(this, 'dirtyType'), model = get(this, 'model'), shadow = get(this, 'shadow'), promise;
                if (!dirtyType || !adapter.shouldSave(model)) {
                    if (adapter.isEmbedded(model)) {
                        promise = this._promiseFromEmbeddedParent();
                    } else {
                        promise = Ember.RSVP.resolve();
                    }
                } else if (dirtyType === 'created') {
                    promise = adapter._contextualizePromise(adapter._create(model), model);
                } else if (dirtyType === 'updated') {
                    promise = adapter._contextualizePromise(adapter._update(model), model);
                } else if (dirtyType === 'deleted') {
                    promise = adapter._contextualizePromise(adapter._deleteModel(model), model);
                }
                promise = promise.then(function (serverModel) {
                    if (!get(model, 'id')) {
                        set(model, 'id', get(serverModel, 'id'));
                    }
                    if (!serverModel) {
                        serverModel = model;
                    } else {
                        if (get(serverModel, 'meta') && Ember.keys(serverModel).length == 1) {
                            model.meta = serverModel.meta;
                            serverModel = model;
                        }
                        if (!get(serverModel, 'clientRev')) {
                            set(serverModel, 'clientRev', get(model, 'clientRev'));
                        }
                    }
                    return serverModel;
                }, function (serverModel) {
                    if (shadow && serverModel === model) {
                        shadow.set('errors', serverModel.get('errors'));
                        throw shadow;
                    }
                    throw serverModel;
                });
                return this._promise = promise;
            },
            _embeddedParent: Ember.computed(function () {
                var model = get(this, 'model'), parentModel = get(this, 'adapter')._embeddedManager.findParent(model), graph = get(this, 'graph');

                return graph.getOp(parentModel);
            }),
            _promiseFromEmbeddedParent: function () {
                var model = this.model, adapter = get(this, 'adapter'), serializer = adapter.serializerForModel(model);
                function findInParent(parentModel) {
                    var res = null;
                    serializer.eachEmbeddedRecord(parentModel, function (child, embeddedType) {
                        if (res)
                            return;
                        if (child.isEqual(model))
                            res = child;
                    });
                    return res;
                }
                return get(this, '_embeddedParent').perform().then(function (parent) {
                    return findInParent(parent);
                }, function (parent) {
                    throw findInParent(parent);
                });
            },
            toStringExtension: function () {
                return '( ' + get(this, 'dirtyType') + ' ' + get(this, 'model') + ' )';
            },
            addChild: function (child) {
                this.children.add(child);
                child.parents.add(this);
            },
            isRoot: Ember.computed(function () {
                return this.parents.every(function (parent) {
                    return !get(parent, 'isDirty') && get(parent, 'isRoot');
                });
            }).volatile()
        });
    });
    require.define('/lib/rest/embedded_manager.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        var EmbdeddedHelpersMixin = require('/lib/rest/embedded_helpers_mixin.js', module);
        Ep.EmbeddedManager = Ember.Object.extend(EmbdeddedHelpersMixin, {
            adapter: null,
            init: function () {
                this._super.apply(this, arguments);
                this._parentMap = {};
                this._cachedIsEmbedded = Ember.Map.create();
            },
            updateParents: function (model) {
                var type = get(model, 'type'), adapter = get(this, 'adapter'), typeKey = get(type, 'typeKey'), serializer = adapter.serializerFor(typeKey);
                this.eachEmbeddedRecord(model, function (embedded, kind) {
                    this._parentMap[get(embedded, 'clientId')] = model;
                }, this);
            },
            findParent: function (model) {
                var parent = this._parentMap[get(model, 'clientId')];
                return parent;
            },
            isEmbedded: function (model) {
                var type = get(model, 'type'), result = this._cachedIsEmbedded.get(type);
                if (result !== undefined)
                    return result;
                var adapter = get(this, 'adapter'), result = false;
                type.eachRelationship(function (name, relationship) {
                    var serializer = adapter.serializerFor(relationship.typeKey), inverse = type.inverseFor(relationship.key);
                    if (!inverse)
                        return;
                    var config = serializer.configFor(inverse.name);
                    result = result || config.embedded === 'always';
                }, this);
                this._cachedIsEmbedded.set(type, result);
                return result;
            }
        });
    });
    require.define('/lib/adapter.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set, merge = Ember.merge;
        function mustImplement(name) {
            return function () {
                throw new Ember.Error('Your adapter ' + this.toString() + ' does not implement the required method ' + name);
            };
        }
        var SerializerForMixin = require('/lib/serializers/serializer_for_mixin.js', module);
        Ep.Adapter = Ember.Object.extend(SerializerForMixin, {
            mergedProperties: ['configs'],
            init: function () {
                this._super.apply(this, arguments);
                this.configs = {};
                this.container = this.setupContainer(this.container);
            },
            setupContainer: function (container) {
                return container;
            },
            configFor: function (type) {
                var configs = get(this, 'configs'), typeKey = get(type, 'typeKey');
                return configs[typeKey] || {};
            },
            newSession: function () {
                var Session = this.container.lookupFactory('session:base');
                session = Session.create({ adapter: this });
                return session;
            },
            load: mustImplement('load'),
            query: mustImplement('find'),
            refresh: mustImplement('refresh'),
            flush: mustImplement('flush'),
            remoteCall: mustImplement('remoteCall'),
            serialize: function (model, opts) {
                return this.serializerForModel(model).serialize(model, opts);
            },
            deserialize: function (typeKey, data, opts) {
                return this.serializerFor(typeKey).deserialize(data, opts);
            },
            merge: function (model, session) {
                if (!session) {
                    session = this.container.lookup('session:main');
                }
                return session.merge(model);
            },
            mergeData: function (data, typeKey, session) {
                if (!typeKey) {
                    typeKey = this.defaultSerializer;
                }
                var serializer = this.serializerFor(typeKey), deserialized = serializer.deserialize(data);
                if (get(deserialized, 'isModel')) {
                    return this.merge(deserialized, session);
                } else {
                    return Ember.EnumerableUtils.map(deserialized, function (model) {
                        return this.merge(model, session);
                    }, this);
                }
            },
            mergeError: Ember.aliasMethod('mergeData'),
            willMergeModel: Ember.K,
            didMergeModel: Ember.K,
            isDirtyFromRelationships: function (model, cached, relDiff) {
                return relDiff.length > 0;
            },
            shouldSave: function (model) {
                return true;
            },
            reifyClientId: function (model) {
                this.idManager.reifyClientId(model);
            }
        });
    });
    require.define('/lib/rest/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/rest/payload.js', module);
        require('/lib/rest/rest_adapter.js', module);
    });
    require.define('/lib/rest/payload.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.Payload = Ep.ModelSet.extend({
            isPayload: true,
            context: null,
            meta: null,
            merge: function (session) {
                var merged = this.map(function (model) {
                        return session.merge(model);
                    }, this);
                var context = get(this, 'context');
                if (context && Ember.isArray(context)) {
                    context = context.map(function (model) {
                        return session.getModel(model);
                    });
                } else if (context) {
                    context = session.getModel(context);
                }
                var result = Ep.Payload.fromArray(merged);
                result.context = context;
                result.meta = this.meta;
                return result;
            }
        });
    });
    require.define('/lib/local/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/local/local_adapter.js', module);
    });
    require.define('/lib/local/local_adapter.js', function (module, exports, __dirname, __filename) {
        require('/lib/adapter.js', module);
        var get = Ember.get, set = Ember.set;
        Ep.LocalAdapter = Ep.Adapter.extend({
            serializer: Ep.Serializer.create(),
            load: function (type, id) {
                return Ember.RSVP.resolve(null);
            },
            refresh: function (model) {
                return Ember.RSVP.resolve(model.copy());
            },
            flush: function (session) {
                var models = get(session, 'dirtyModels');
                return Ember.RSVP.resolve(models.copy(true)).then(function (models) {
                    models.forEach(function (model) {
                        session.merge(model);
                    });
                });
            }
        });
    });
    require.define('/lib/merge_strategies/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/merge_strategies/base.js', module);
        require('/lib/merge_strategies/per_field.js', module);
    });
    require.define('/lib/merge_strategies/per_field.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set, isEqual = require('/lib/utils/isEqual.js', module);
        Ep.PerField = Ep.MergeStrategy.extend({
            merge: function (ours, ancestor, theirs) {
                ours.beginPropertyChanges();
                this.mergeAttributes(ours, ancestor, theirs);
                this.mergeRelationships(ours, ancestor, theirs);
                ours.endPropertyChanges();
                return ours;
            },
            mergeAttributes: function (ours, ancestor, theirs) {
                ours.eachAttribute(function (name, meta) {
                    var oursValue = get(ours, name), ancestorValue = get(ancestor, name), theirsValue = get(theirs, name);
                    set(ours, name, this.mergeAttribute(name, oursValue, ancestorValue, theirsValue));
                }, this);
            },
            mergeAttribute: function (name, ours, ancestor, theirs) {
                if (isEqual(ours, ancestor)) {
                    return theirs;
                }
                return ours;
            },
            mergeRelationships: function (ours, ancestor, theirs) {
                var session = get(this, 'session');
                ours.eachRelationship(function (name, relationship) {
                    if (relationship.kind === 'belongsTo') {
                        var oursValue = get(ours, name);
                        var theirsValue = get(theirs, name);
                        var originalValue = get(ancestor, name);
                        if (isEqual(oursValue, originalValue)) {
                            set(ours, name, theirsValue);
                        }
                    } else if (relationship.kind === 'hasMany') {
                        var theirChildren = get(theirs, name);
                        var ourChildren = get(ours, name);
                        var originalChildren = get(ancestor, name);
                        if (isEqual(ourChildren, originalChildren)) {
                            var existing = Ep.ModelSet.create();
                            existing.addObjects(ourChildren);
                            theirChildren.forEach(function (model) {
                                if (existing.contains(model)) {
                                    existing.remove(model);
                                } else {
                                    ourChildren.pushObject(model);
                                }
                            }, this);
                            ourChildren.removeObjects(existing);
                        }
                    }
                }, this);
            }
        });
    });
    require.define('/lib/utils/isEqual.js', function (module, exports, __dirname, __filename) {
        module.exports = function (a, b) {
            if (a && 'function' === typeof a.isEqual)
                return a.isEqual(b);
            if (a instanceof Date && b instanceof Date) {
                return a.getTime() === b.getTime();
            }
            return a === b;
        };
    });
    require.define('/lib/merge_strategies/base.js', function (module, exports, __dirname, __filename) {
        Ep.MergeStrategy = Ember.Object.extend({ merge: Ember.required() });
    });
    require.define('/lib/serializers/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/serializers/base.js', module);
        require('/lib/serializers/boolean.js', module);
        require('/lib/serializers/date.js', module);
        require('/lib/serializers/number.js', module);
        require('/lib/serializers/revision.js', module);
        require('/lib/serializers/string.js', module);
        require('/lib/serializers/model.js', module);
        require('/lib/serializers/id.js', module);
        require('/lib/serializers/has_many.js', module);
        require('/lib/serializers/belongs_to.js', module);
    });
    require.define('/lib/serializers/belongs_to.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.BelongsToSerializer = Ep.Serializer.extend({
            typeFor: function (typeName) {
                return this.container.lookupFactory('model:' + typeName);
            },
            deserialize: function (serialized, opts) {
                if (!serialized) {
                    return null;
                }
                if (opts.embedded) {
                    return this.deserializeEmbedded(serialized, opts);
                }
                var idSerializer = this.serializerFor('id');
                var res = Ep.LazyModel.create({
                        id: idSerializer.deserialize(serialized),
                        type: this.typeFor(opts.typeKey)
                    });
                this.idManager.reifyClientId(res);
                return res;
            },
            deserializeEmbedded: function (serialized, opts) {
                var serializer = this.serializerFor(opts.typeKey);
                return serializer.deserialize(serialized);
            },
            serialize: function (model, opts) {
                if (!model) {
                    return null;
                }
                if (opts.embedded) {
                    return this.serializeEmbedded(model, opts);
                }
                var idSerializer = this.serializerFor('id');
                return idSerializer.serialize(get(model, 'id'));
            },
            serializeEmbedded: function (model, opts) {
                var serializer = this.serializerFor(opts.typeKey);
                return serializer.serialize(model);
            }
        });
    });
    require.define('/lib/serializers/has_many.js', function (module, exports, __dirname, __filename) {
        var empty = Ember.isEmpty;
        Ep.HasManySerializer = Ep.Serializer.extend({
            typeFor: function (typeName) {
                return this.container.lookupFactory('model:' + typeName);
            },
            deserialize: function (serialized, opts) {
                if (!serialized)
                    return [];
                if (opts.embedded) {
                    return this.deserializeEmbedded(serialized, opts);
                }
                var idSerializer = this.serializerFor('id'), type = this.typeFor(opts.typeKey);
                return serialized.map(function (id) {
                    var res = Ep.LazyModel.create({
                            id: idSerializer.deserialize(id),
                            type: type
                        });
                    this.idManager.reifyClientId(res);
                    return res;
                }, this);
            },
            deserializeEmbedded: function (serialized, opts) {
                var serializer = this.serializerFor(opts.typeKey);
                return serialized.map(function (hash) {
                    return serializer.deserialize(hash);
                });
            },
            serialize: function (models, opts) {
                if (opts.embedded) {
                    return this.serializeEmbedded(models, opts);
                }
                return undefined;
            },
            serializeEmbedded: function (models, opts) {
                var serializer = this.serializerFor(opts.typeKey);
                return models.map(function (model) {
                    return serializer.serialize(model);
                });
            }
        });
    });
    require.define('/lib/serializers/id.js', function (module, exports, __dirname, __filename) {
        Ep.IdSerializer = Ep.Serializer.extend({
            deserialize: function (serialized) {
                if (serialized === undefined || serialized === null)
                    return;
                return serialized + '';
            },
            serialize: function (id) {
                if (isNaN(id) || id === null) {
                    return id;
                }
                return +id;
            }
        });
    });
    require.define('/lib/serializers/model.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        var EmbeddedHelpersMixin = require('/lib/rest/embedded_helpers_mixin.js', module);
        Ep.ModelSerializer = Ep.Serializer.extend(EmbeddedHelpersMixin, {
            mergedProperties: ['properties'],
            properties: {},
            _keyCache: null,
            _nameCache: null,
            init: function () {
                this._super();
                this._keyCache = {};
                this._nameCache = {};
            },
            nameFor: function (key) {
                var name;
                if (name = this._nameCache[key]) {
                    return name;
                }
                var configs = get(this, 'properties');
                for (var currentName in configs) {
                    var current = configs[name];
                    var keyName = current.key;
                    if (keyName && key === keyName) {
                        name = currentName;
                    }
                }
                name = name || Ember.String.camelize(key);
                this._nameCache[key] = name;
                return name;
            },
            configFor: function (name) {
                return this.properties[name] || {};
            },
            keyFor: function (name, type, opts) {
                var key;
                if (key = this._keyCache[name]) {
                    return key;
                }
                var config = this.configFor(name);
                key = config.key || this.keyForType(name, type, opts);
                this._keyCache[name] = key;
                return key;
            },
            keyForType: function (name, type, opts) {
                return Ember.String.underscore(name);
            },
            rootForType: function (type) {
                return get(type, 'typeKey');
            },
            serialize: function (model) {
                var serialized = {};

                this.addMeta(serialized, model);
                this.addAttributes(serialized, model);
                this.addRelationships(serialized, model);
                return serialized;
            },
            addMeta: function (serialized, model) {
                this.addProperty(serialized, model, 'id', 'id');
                this.addProperty(serialized, model, 'clientId', 'string');
                this.addProperty(serialized, model, 'rev', 'revision');
                this.addProperty(serialized, model, 'clientRev', 'revision');
            },
            addAttributes: function (serialized, model) {
                model.eachAttribute(function (name, attribute) {
                    this.addProperty(serialized, model, name, attribute.type);
                }, this);
            },
            addRelationships: function (serialized, model) {
                model.eachRelationship(function (name, relationship) {
                    var config = this.configFor(name), opts = {
                            typeKey: relationship.typeKey,
                            embedded: config.embedded
                        };
                    this.addProperty(serialized, model, name, relationship.kind, opts);
                }, this);
            },
            addProperty: function (serialized, model, name, type, opts) {
                var key = this.keyFor(name, type, opts), value = get(model, name), serializer;
                if (type) {
                    serializer = this.serializerFor(type);
                }
                if (serializer) {
                    value = serializer.serialize(value, opts);
                }
                if (value !== undefined) {
                    serialized[key] = value;
                }
            },
            deserialize: function (hash) {
                var model = this.createModel();
                this.extractMeta(model, hash);
                this.extractAttributes(model, hash);
                this.extractRelationships(model, hash);
                return model;
            },
            extractMeta: function (model, hash) {
                this.extractProperty(model, hash, 'id', 'id');
                this.extractProperty(model, hash, 'clientId', 'string');
                this.extractProperty(model, hash, 'rev', 'revision');
                this.extractProperty(model, hash, 'clientRev', 'revision');
                this.extractProperty(model, hash, 'errors', 'errors');
                this.idManager.reifyClientId(model);
            },
            extractAttributes: function (model, hash) {
                model.eachAttribute(function (name, attribute) {
                    this.extractProperty(model, hash, name, attribute.type);
                }, this);
            },
            extractRelationships: function (model, hash) {
                model.eachRelationship(function (name, relationship) {
                    var config = this.configFor(name), opts = {
                            typeKey: relationship.typeKey,
                            embedded: config.embedded
                        };
                    this.extractProperty(model, hash, name, relationship.kind, opts);
                }, this);
            },
            extractProperty: function (model, hash, name, type, opts) {
                var key = this.keyFor(name, type, opts), value = hash[key], serializer;
                if (type) {
                    serializer = this.serializerFor(type);
                }
                if (serializer) {
                    value = serializer.deserialize(value, opts);
                }
                if (value !== undefined) {
                    set(model, name, value);
                }
            },
            createModel: function () {
                return this.typeFor(this.typeKey).create();
            },
            typeFor: function (typeKey) {
                return this.container.lookupFactory('model:' + typeKey);
            }
        });
    });
    require.define('/lib/serializers/string.js', function (module, exports, __dirname, __filename) {
        var none = Ember.isNone, empty = Ember.isEmpty;
        Ep.StringSerializer = Ep.Serializer.extend({
            deserialize: function (serialized) {
                return none(serialized) ? null : String(serialized);
            },
            serialize: function (deserialized) {
                return none(deserialized) ? null : String(deserialized);
            }
        });
    });
    require.define('/lib/serializers/revision.js', function (module, exports, __dirname, __filename) {
        var empty = Ember.isEmpty;
        Ep.RevisionSerializer = Ep.Serializer.extend({
            deserialize: function (serialized) {
                return serialized ? serialized : undefined;
            },
            serialize: function (deserialized) {
                return deserialized ? deserialized : undefined;
            }
        });
    });
    require.define('/lib/serializers/number.js', function (module, exports, __dirname, __filename) {
        var empty = Ember.isEmpty;
        Ep.NumberSerializer = Ep.Serializer.extend({
            deserialize: function (serialized) {
                return empty(serialized) ? null : Number(serialized);
            },
            serialize: function (deserialized) {
                return empty(deserialized) ? null : Number(deserialized);
            }
        });
    });
    require.define('/lib/serializers/date.js', function (module, exports, __dirname, __filename) {
        require('/lib/ext/date.js', module);
        Ep.DateSerializer = Ep.Serializer.extend({
            deserialize: function (serialized) {
                var type = typeof serialized;
                if (type === 'string') {
                    return new Date(Ember.Date.parse(serialized));
                } else if (type === 'number') {
                    return new Date(serialized);
                } else if (serialized === null || serialized === undefined) {
                    return serialized;
                } else {
                    return null;
                }
            },
            serialize: function (date) {
                if (date instanceof Date) {
                    var days = [
                            'Sun',
                            'Mon',
                            'Tue',
                            'Wed',
                            'Thu',
                            'Fri',
                            'Sat'
                        ];
                    var months = [
                            'Jan',
                            'Feb',
                            'Mar',
                            'Apr',
                            'May',
                            'Jun',
                            'Jul',
                            'Aug',
                            'Sep',
                            'Oct',
                            'Nov',
                            'Dec'
                        ];
                    var pad = function (num) {
                        return num < 10 ? '0' + num : '' + num;
                    };
                    var utcYear = date.getUTCFullYear(), utcMonth = date.getUTCMonth(), utcDayOfMonth = date.getUTCDate(), utcDay = date.getUTCDay(), utcHours = date.getUTCHours(), utcMinutes = date.getUTCMinutes(), utcSeconds = date.getUTCSeconds();
                    var dayOfWeek = days[utcDay];
                    var dayOfMonth = pad(utcDayOfMonth);
                    var month = months[utcMonth];
                    return dayOfWeek + ', ' + dayOfMonth + ' ' + month + ' ' + utcYear + ' ' + pad(utcHours) + ':' + pad(utcMinutes) + ':' + pad(utcSeconds) + ' GMT';
                } else {
                    return null;
                }
            }
        });
    });
    require.define('/lib/ext/date.js', function (module, exports, __dirname, __filename) {
        Ember.Date = Ember.Date || {};
        var origParse = Date.parse, numericKeys = [
                1,
                4,
                5,
                6,
                7,
                10,
                11
            ];
        Ember.Date.parse = function (date) {
            var timestamp, struct, minutesOffset = 0;
            if (struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date)) {
                for (var i = 0, k; k = numericKeys[i]; ++i) {
                    struct[k] = +struct[k] || 0;
                }
                struct[2] = (+struct[2] || 1) - 1;
                struct[3] = +struct[3] || 1;
                if (struct[8] !== 'Z' && struct[9] !== undefined) {
                    minutesOffset = struct[10] * 60 + struct[11];
                    if (struct[9] === '+') {
                        minutesOffset = 0 - minutesOffset;
                    }
                }
                timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
            } else {
                timestamp = origParse ? origParse(date) : NaN;
            }
            return timestamp;
        };
        if (Ember.EXTEND_PROTOTYPES === true || Ember.EXTEND_PROTOTYPES.Date) {
            Date.parse = Ember.Date.parse;
        }
    });
    require.define('/lib/serializers/boolean.js', function (module, exports, __dirname, __filename) {
        Ep.BooleanSerializer = Ep.Serializer.extend({
            deserialize: function (serialized) {
                var type = typeof serialized;
                if (type === 'boolean') {
                    return serialized;
                } else if (type === 'string') {
                    return serialized.match(/^true$|^t$|^1$/i) !== null;
                } else if (type === 'number') {
                    return serialized === 1;
                } else {
                    return false;
                }
            },
            serialize: function (deserialized) {
                return Boolean(deserialized);
            }
        });
    });
    require.define('/lib/serializers/base.js', function (module, exports, __dirname, __filename) {
        var SerializerForMixin = require('/lib/serializers/serializer_for_mixin.js', module);
        Ep.Serializer = Ember.Object.extend(SerializerForMixin, {
            typeKey: null,
            serialize: Ember.required(),
            deserialize: Ember.required()
        });
    });
    require.define('/lib/session/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/session/session.js', module);
        require('/lib/session/merge.js', module);
        require('/lib/session/child_session.js', module);
    });
    require.define('/lib/session/child_session.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.ChildSession = Ep.Session.extend({
            merge: function (model, visited) {
                var parentModel = this.parent.merge(model, visited);
                return this._super(parentModel, visited);
            },
            fetch: function (model) {
                var res = this._super(model);
                if (!res) {
                    res = get(this, 'parent').fetch(model);
                    if (res) {
                        res = this.adopt(res.copy());
                    }
                }
                return res;
            },
            load: function (type, id) {
                type = this.typeFor(type);
                var typeKey = get(type, 'typeKey');
                id = id + '';
                var cached = this.getForId(type, id);
                if (cached && get(cached, 'isLoaded')) {
                    return Ep.resolveModel(cached);
                }
                var parentModel = get(this, 'parent').getForId(type, id);
                if (parentModel && get(parentModel, 'isLoaded')) {
                    return Ep.resolveModel(this.merge(parentModel));
                }
                return this._super(type, id);
            },
            updateParent: function () {
                var dirty = get(this, 'dirtyModels'), parent = get(this, 'parent');
                dirty.forEach(function (model) {
                    parent.update(model);
                }, this);
            },
            flushIntoParent: function () {
                this.updateParent();
                return this.flush();
            }
        });
    });
    require.define('/lib/session/merge.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.Session.reopen({
            mergeStrategyFor: function (typeKey) {

                var lookupKey = Ember.String.dasherize(typeKey);
                var mergeStrategy = this.container.lookup('merge-strategy:' + lookupKey);
                if (!mergeStrategy) {
                    var Strategy = this.container.lookupFactory('merge-strategy:default');
                    this.container.register('merge-strategy:' + lookupKey, Strategy);
                    mergeStrategy = this.container.lookup('merge-strategy:' + lookupKey);
                }
                mergeStrategy.typeKey = typeKey;
                return mergeStrategy;
            },
            merge: function (model, visited) {
                var adapter = get(this, 'adapter');
                adapter.willMergeModel(model);
                this.reifyClientId(model);
                if (!visited)
                    visited = new Ember.Set();
                if (visited.contains(model)) {
                    return this.getModel(model);
                }
                visited.add(model);
                var detachedChildren = [];
                model.eachChild(function (child) {
                    if (get(child, 'isDetached')) {
                        detachedChildren.push(child);
                    }
                }, this);
                var merged;
                if (get(model, 'hasErrors')) {
                    merged = this._mergeError(model);
                } else {
                    merged = this._mergeSuccess(model);
                }
                if (model.meta) {
                    merged.meta = model.meta;
                }
                for (var i = 0; i < detachedChildren.length; i++) {
                    var child = detachedChildren[i];
                    this.merge(child, visited);
                }
                adapter.didMergeModel(model);
                return merged;
            },
            mergeModels: function (models) {
                var merged = Ep.ModelArray.create({
                        session: this,
                        content: []
                    });
                merged.meta = models.meta;
                var session = this;
                models.forEach(function (model) {
                    merged.pushObject(session.merge(model));
                });
                return merged;
            },
            _mergeSuccess: function (model) {
                var models = get(this, 'models'), shadows = get(this, 'shadows'), newModels = get(this, 'newModels'), originals = get(this, 'originals'), merged, ancestor, existing = models.getModel(model);
                if (existing && this._containsRev(existing, model)) {
                    return existing;
                }
                var hasClientChanges = !existing || this._containsClientRev(model, existing);
                if (hasClientChanges) {
                    ancestor = shadows.getModel(model);
                } else {
                    ancestor = originals.getModel(model);
                }
                this.suspendDirtyChecking(function () {
                    merged = this._mergeModel(existing, ancestor, model);
                }, this);
                if (hasClientChanges) {
                    if (get(merged, 'isDeleted')) {
                        this.remove(merged);
                    } else {
                        if (shadows.contains(model) && get(model, 'isLoaded')) {
                            shadows.add(model);
                        }
                        originals.remove(model);
                        if (!get(merged, 'isNew')) {
                            newModels.remove(merged);
                        }
                    }
                } else {
                }
                return merged;
            },
            _mergeError: function (model) {
                var models = get(this, 'models'), shadows = get(this, 'shadows'), newModels = get(this, 'newModels'), originals = get(this, 'originals'), merged, ancestor, existing = models.getModel(model);
                if (!existing) {
                    return model;
                }
                var hasClientChanges = this._containsClientRev(model, existing);
                if (hasClientChanges) {
                    ancestor = shadows.getModel(model) || existing;
                } else {
                    ancestor = originals.getModel(model);
                }
                if (ancestor && !this._containsRev(existing, model)) {
                    this.suspendDirtyChecking(function () {
                        merged = this._mergeModel(existing, ancestor, model);
                    }, this);
                } else {
                    merged = existing;
                }
                set(merged, 'errors', Ember.copy(get(model, 'errors')));
                if (get(model, 'isLoaded') && !get(model, 'isNew')) {
                    shadows.add(model);
                    originals.remove(model);
                }
                return merged;
            },
            _mergeModel: function (dest, ancestor, model) {
                if (get(model, 'isPromise')) {
                    return this._mergePromise(dest, ancestor, model);
                }
                var promise;
                if (dest && get(dest, 'isPromise')) {
                    promise = dest;
                    dest = dest.content;
                }
                if (!dest) {
                    if (get(model, 'isDetached')) {
                        dest = model;
                    } else {
                        dest = model.copy();
                    }
                    this.adopt(dest);
                    if (promise) {
                        promise.resolve(dest);
                    }
                    return dest;
                }
                set(dest, 'id', get(model, 'id'));
                set(dest, 'clientId', get(model, 'clientId'));
                set(dest, 'rev', get(model, 'rev'));
                set(dest, 'isDeleted', get(model, 'isDeleted'));
                this.adopt(dest);
                if (!ancestor) {
                    ancestor = dest;
                }
                model.eachChild(function (child) {
                    this.reifyClientId(child);
                }, this);
                var strategy = this.mergeStrategyFor(get(model, 'type.typeKey'));
                strategy.merge(dest, ancestor, model);
                return dest;
            },
            _mergePromise: function (dest, ancestor, promise) {
                var content = get(promise, 'content');
                if (content) {
                    return this._mergeModel(dest, ancestor, content);
                }
                if (!dest) {
                    if (get(promise, 'isDetached')) {
                        dest = promise;
                    } else {
                        dest = promise.lazyCopy();
                    }
                    this.adopt(dest);
                }
                return dest;
            },
            _containsRev: function (modelA, modelB) {
                if (!get(modelA, 'rev'))
                    return false;
                if (!get(modelB, 'rev'))
                    return false;
                return get(modelA, 'rev') >= get(modelB, 'rev');
            },
            _containsClientRev: function (modelA, modelB) {
                return get(modelA, 'clientRev') >= get(modelB, 'clientRev');
            }
        });
    });
    require.define('/lib/session/session.js', function (module, exports, __dirname, __filename) {
        require('/lib/collections/model_array.js', module);
        require('/lib/collections/model_set.js', module);
        require('/lib/session/collection_manager.js', module);
        require('/lib/session/inverse_manager.js', module);
        require('/lib/model/index.js', module);
        var get = Ember.get, set = Ember.set;
        Ep.PromiseArray = Ember.ArrayProxy.extend(Ember.PromiseProxyMixin);
        Ep.Session = Ember.Object.extend({
            _dirtyCheckingSuspended: false,
            init: function () {
                this._super.apply(this, arguments);
                this.models = Ep.ModelSet.create();
                this.collectionManager = Ep.CollectionManager.create();
                this.inverseManager = Ep.InverseManager.create({ session: this });
                this.shadows = Ep.ModelSet.create();
                this.originals = Ep.ModelSet.create();
                this.newModels = Ep.ModelSet.create();
            },
            create: function (type, hash) {
                type = this.typeFor(type);
                var model = type.create(hash || {});
                model = this.add(model);
                return model;
            },
            adopt: function (model) {


                if (get(model, 'isNew')) {
                    this.newModels.add(model);
                }
                if (!get(model, 'isProxy') && !get(model, 'session')) {
                    this.models.add(model);
                    this.inverseManager.register(model);
                }
                set(model, 'session', this);
                return model;
            },
            add: function (model) {
                this.reifyClientId(model);
                var dest = this.fetch(model);
                if (dest && get(dest, 'isLoaded'))
                    return dest;
                if (get(model, 'isProxy')) {
                    var content = get(model, 'content');
                    if (content) {
                        return this.add(content);
                    }
                }
                if (get(model, 'isNew') && get(model, 'isDetached')) {
                    dest = model;
                } else if (get(model, 'isNew')) {
                    dest = model.copy();
                } else {
                    dest = model.lazyCopy();
                }
                return this.adopt(dest);
            },
            remove: function (model) {
                get(this, 'models').remove(model);
                get(this, 'shadows').remove(model);
                get(this, 'originals').remove(model);
            },
            update: function (model) {
                this.reifyClientId(model);
                if (get(model, 'isProxy')) {
                    var content = get(model, 'content');
                    if (content) {
                        return this.update(content);
                    }
                    throw new Ember.Error('Cannot update with an unloaded model: ' + model.toString());
                }
                var dest = this.fetch(model);
                if (get(model, 'isNew') && !dest) {
                    dest = get(model, 'type').create();
                    set(dest, 'clientId', get(model, 'clientId'));
                    this.adopt(dest);
                }
                if (get(model, 'isDetached') || !dest || !get(dest, 'isLoaded')) {
                    return this.add(model);
                }
                if (get(model, 'isDeleted')) {
                    if (!get(dest, 'isDeleted')) {
                        this.deleteModel(dest);
                    }
                    return dest;
                }
                model.copyAttributes(dest);
                model.copyMeta(dest);
                model.eachRelationship(function (name, relationship) {
                    if (relationship.kind === 'belongsTo') {
                        var child = get(model, name);
                        if (child) {
                            set(dest, name, child);
                        }
                    } else if (relationship.kind === 'hasMany') {
                        var children = get(model, name);
                        var destChildren = get(dest, name);
                        children.copyTo(destChildren);
                    }
                }, this);
                return dest;
            },
            deleteModel: function (model) {
                if (get(model, 'isNew')) {
                    var newModels = get(this, 'newModels');
                    newModels.remove(model);
                } else {
                    this.modelWillBecomeDirty(model);
                }
                set(model, 'isDeleted', true);
                this.collectionManager.modelWasDeleted(model);
                this.inverseManager.unregister(model);
            },
            load: function (type, id, opts) {
                type = this.typeFor(type);
                var typeKey = get(type, 'typeKey');
                id = id + '';
                var cached = this.getForId(type, id);
                if (cached && get(cached, 'isLoaded')) {
                    return Ep.resolveModel(cached);
                }
                return Ep.resolveModel(this.adapter.load(typeKey, id, opts, this), type, id, this);
            },
            find: function (type, query, opts) {
                if (Ember.typeOf(query) === 'object') {
                    return this.query(type, query, opts);
                }
                return this.load(type, query, opts);
            },
            fetch: function (model) {
                return this.getModel(model);
            },
            query: function (type, query, opts) {
                type = this.typeFor(type);
                var typeKey = get(type, 'typeKey');
                var prom = this.adapter.query(typeKey, query, opts, this);
                return Ep.PromiseArray.create({ promise: prom });
            },
            refresh: function (model, opts) {
                var session = this;
                return this.adapter.refresh(model, opts, this);
            },
            flush: function () {
                var session = this, dirtyModels = get(this, 'dirtyModels'), newModels = get(this, 'newModels'), shadows = get(this, 'shadows');
                dirtyModels.forEach(function (model) {
                    model.incrementProperty('clientRev');
                }, this);
                var promise = this.adapter.flush(this);
                dirtyModels.forEach(function (model) {
                    var original = this.originals.getModel(model);
                    var shadow = this.shadows.getModel(model);
                    if (shadow && (!original || original.get('rev') < shadow.get('rev'))) {
                        this.originals.add(shadow);
                    }
                    this.markClean(model);
                }, this);
                newModels.clear();
                return promise;
            },
            getModel: function (model) {
                return this.models.getModel(model);
            },
            getForId: function (type, id) {
                var clientId = this.idManager.getClientId(type, id);
                return this.models.getForClientId(clientId);
            },
            reifyClientId: function (model) {
                this.idManager.reifyClientId(model);
            },
            remoteCall: function (context, name, params, opts) {
                var session = this;
                if (opts && opts.deserializationContext && typeof opts.deserializationContext !== 'string') {
                    opts.deserializationContext = get(opts.deserializationContext, 'typeKey');
                }
                return this.adapter.remoteCall(context, name, params, opts, this);
            },
            modelWillBecomeDirty: function (model) {
                if (this._dirtyCheckingSuspended) {
                    return;
                }
                this.touch(model);
            },
            destroy: function () {
                this._super();
                this.models.forEach(function (model) {
                    model.destroy();
                });
                this.models.destroy();
                this.collectionManager.destroy();
                this.inverseManager.destroy();
                this.shadows.destroy();
                this.originals.destroy();
                this.newModels.destroy();
            },
            dirtyModels: Ember.computed(function () {
                var models = Ep.ModelSet.fromArray(this.shadows.map(function (model) {
                        return this.models.getModel(model);
                    }, this));
                get(this, 'newModels').forEach(function (model) {
                    models.add(model);
                });
                return models;
            }).property('shadows.[]', 'newModels.[]'),
            suspendDirtyChecking: function (callback, binding) {
                var self = this;
                if (this._dirtyCheckingSuspended) {
                    return callback.call(binding || self);
                }
                try {
                    this._dirtyCheckingSuspended = true;
                    return callback.call(binding || self);
                } finally {
                    this._dirtyCheckingSuspended = false;
                }
            },
            newSession: function () {
                var Child = this.container.lookupFactory('session:child');
                var child = Child.create({
                        parent: this,
                        adapter: this.adapter
                    });
                return child;
            },
            typeFor: function (key) {
                if (typeof key !== 'string') {
                    return key;
                }
                var factory = this.container.lookupFactory('model:' + key);

                factory.session = this;
                factory.typeKey = key;
                return factory;
            },
            getShadow: function (model) {
                var shadows = get(this, 'shadows');
                var models = get(this, 'models');
                return shadows.getModel(model) || models.getModel(model);
            },
            markClean: function (model) {
                this.shadows.remove(model);
            },
            touch: function (model) {
                if (!get(model, 'isNew')) {
                    var shadow = this.shadows.getModel(model);
                    if (!shadow) {
                        this.shadows.addObject(model.copy());
                    }
                }
            },
            isDirty: Ember.computed(function () {
                return get(this, 'dirtyModels.length') > 0;
            }).property('dirtyModels.length'),
            mergeData: function (data, typeKey) {
                return this.adapter.mergeData(data, typeKey, this);
            }
        });
    });
    require.define('/lib/model/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/model/model.js', module);
        require('/lib/model/proxies.js', module);
        require('/lib/model/attribute.js', module);
        require('/lib/model/debug.js', module);
        require('/lib/model/relationships/belongs_to.js', module);
        require('/lib/model/relationships/has_many.js', module);
        require('/lib/model/relationships/ext.js', module);
        require('/lib/model/errors.js', module);
        require('/lib/model/diff.js', module);
    });
    require.define('/lib/model/diff.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        var jsondiffpatch = require('/node_modules/jsondiffpatch/src/jsondiffpatch.js', module);
        Ep.Model.reopen({
            diff: function (model) {
                var diffs = [];
                this.eachAttribute(function (name, meta) {
                    var left = get(this, name);
                    var right = get(model, name);
                    if (left && typeof left.diff === 'function' && right && typeof right.diff === 'function') {
                        if (left.diff(right).length > 0) {
                            diffs.push({
                                type: 'attr',
                                name: name
                            });
                        }
                        return;
                    }
                    if (left && right && typeof left === 'object' && typeof right === 'object') {
                        var delta = jsondiffpatch.diff(left, right);
                        if (delta) {
                            diffs.push({
                                type: 'attr',
                                name: name
                            });
                        }
                        return;
                    }
                    if (left instanceof Date && right instanceof Date) {
                        left = left.getTime();
                        right = right.getTime();
                    }
                    if (left !== right) {
                        diffs.push({
                            type: 'attr',
                            name: name
                        });
                    }
                }, this);
                this.eachRelationship(function (name, relationship) {
                    var left = get(this, name);
                    var right = get(model, name);
                    if (relationship.kind === 'belongsTo') {
                        if (left && right) {
                            if (!left.isEqual(right)) {
                                diffs.push({
                                    type: 'belongsTo',
                                    name: name,
                                    relationship: relationship,
                                    oldValue: right
                                });
                            }
                        } else if (left || right) {
                            diffs.push({
                                type: 'belongsTo',
                                name: name,
                                relationship: relationship,
                                oldValue: right
                            });
                        }
                    } else if (relationship.kind === 'hasMany') {
                        var dirty = false;
                        var cache = Ep.ModelSet.create();
                        left.forEach(function (model) {
                            cache.add(model);
                        });
                        right.forEach(function (model) {
                            if (dirty)
                                return;
                            if (!cache.contains(model)) {
                                dirty = true;
                            } else {
                                cache.remove(model);
                            }
                        });
                        if (dirty || get(cache, 'length') > 0) {
                            diffs.push({
                                type: 'hasMany',
                                name: name,
                                relationship: relationship
                            });
                        }
                    }
                }, this);
                return diffs;
            }
        });
    });
    require.define('/node_modules/jsondiffpatch/src/jsondiffpatch.js', function (module, exports, __dirname, __filename) {
        (function () {
            'use strict';
            var jdp = {};
            if (typeof jsondiffpatch != 'undefined') {
                jdp = jsondiffpatch;
            }
            var jsondiffpatch = jdp;
            jdp.version = '0.0.11';
            jdp.config = {
                textDiffMinLength: 60,
                detectArrayMove: true,
                includeValueOnArrayMove: false
            };
            var arrayIndexOf = typeof Array.prototype.indexOf === 'function' ? function (array, item) {
                    return array.indexOf(item);
                } : function (array, item) {
                    var length = array.length;
                    for (var i = 0; i < length; i++) {
                        if (array[i] === item) {
                            return i;
                        }
                    }
                    return -1;
                };
            var sequenceDiffer = {
                    diff: function (array1, array2, objectHash, objectInnerDiff) {
                        var commonHead = 0, commonTail = 0, index, index1;
                        var len1 = array1.length;
                        var len2 = array2.length;
                        var diff;
                        var hashCache1 = [];
                        var hashCache2 = [];
                        var areTheSame = typeof objectHash == 'function' ? function (value1, value2, index1, index2) {
                                if (value1 === value2)
                                    return true;
                                if (typeof value1 != 'object' || typeof value2 != 'object')
                                    return false;
                                var hash1, hash2;
                                if (typeof index1 == 'number') {
                                    hash1 = hashCache1[index1];
                                    if (typeof hash1 == 'undefined') {
                                        hashCache1[index1] = hash1 = objectHash(value1);
                                    }
                                } else {
                                    hash1 = objectHash(value1);
                                }
                                if (typeof index2 == 'number') {
                                    hash2 = hashCache2[index2];
                                    if (typeof hash2 == 'undefined') {
                                        hashCache2[index2] = hash2 = objectHash(value2);
                                    }
                                } else {
                                    hash2 = objectHash(value2);
                                }
                                return hash1 === hash2;
                            } : function (value1, value2) {
                                return value1 === value2;
                            };
                        var areTheSameByIndex = function (index1, index2) {
                            return areTheSame(array1[index1], array2[index2], index1, index2);
                        };
                        var tryObjectInnerDiff = function (index1, index2) {
                            if (!objectInnerDiff) {
                                return;
                            }
                            if (typeof array1[index1] != 'object' || typeof array2[index2] != 'object') {
                                return;
                            }
                            var result = objectInnerDiff(array1[index1], array2[index2]);
                            if (typeof result == 'undefined') {
                                return;
                            }
                            if (!diff) {
                                diff = { _t: 'a' };
                            }
                            diff[index2] = result;
                        };
                        while (commonHead < len1 && commonHead < len2 && areTheSameByIndex(commonHead, commonHead)) {
                            tryObjectInnerDiff(commonHead, commonHead);
                            commonHead++;
                        }
                        while (commonTail + commonHead < len1 && commonTail + commonHead < len2 && areTheSameByIndex(len1 - 1 - commonTail, len2 - 1 - commonTail)) {
                            tryObjectInnerDiff(len1 - 1 - commonTail, len2 - 1 - commonTail);
                            commonTail++;
                        }
                        if (commonHead + commonTail === len1) {
                            if (len1 === len2) {
                                return diff;
                            }
                            diff = diff || { _t: 'a' };
                            for (index = commonHead; index < len2 - commonTail; index++) {
                                diff[index] = [array2[index]];
                            }
                            return diff;
                        } else if (commonHead + commonTail === len2) {
                            diff = diff || { _t: 'a' };
                            for (index = commonHead; index < len1 - commonTail; index++) {
                                diff['_' + index] = [
                                    array1[index],
                                    0,
                                    0
                                ];
                            }
                            return diff;
                        }
                        var lcs = this.lcs(array1.slice(commonHead, len1 - commonTail), array2.slice(commonHead, len2 - commonTail), {
                                areTheSameByIndex: function (index1, index2) {
                                    return areTheSameByIndex(index1 + commonHead, index2 + commonHead);
                                }
                            });
                        diff = diff || { _t: 'a' };
                        var removedItems = [];
                        for (index = commonHead; index < len1 - commonTail; index++) {
                            if (arrayIndexOf(lcs.indices1, index - commonHead) < 0) {
                                diff['_' + index] = [
                                    array1[index],
                                    0,
                                    0
                                ];
                                removedItems.push(index);
                            }
                        }
                        var removedItemsLength = removedItems.length;
                        for (index = commonHead; index < len2 - commonTail; index++) {
                            var indexOnArray2 = arrayIndexOf(lcs.indices2, index - commonHead);
                            if (indexOnArray2 < 0) {
                                var isMove = false;
                                if (jdp.config.detectArrayMove) {
                                    if (removedItemsLength > 0) {
                                        for (index1 = 0; index1 < removedItemsLength; index1++) {
                                            if (areTheSameByIndex(removedItems[index1], index)) {
                                                diff['_' + removedItems[index1]].splice(1, 2, index, 3);
                                                if (!jdp.config.includeValueOnArrayMove) {
                                                    diff['_' + removedItems[index1]][0] = '';
                                                }
                                                tryObjectInnerDiff(removedItems[index1], index);
                                                removedItems.splice(index1, 1);
                                                isMove = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (!isMove) {
                                    diff[index] = [array2[index]];
                                }
                            } else {
                                tryObjectInnerDiff(lcs.indices1[indexOnArray2] + commonHead, lcs.indices2[indexOnArray2] + commonHead);
                            }
                        }
                        return diff;
                    },
                    getArrayIndexBefore: function (d, indexAfter) {
                        var index, indexBefore = indexAfter;
                        for (var prop in d) {
                            if (d.hasOwnProperty(prop)) {
                                if (isArray(d[prop])) {
                                    if (prop.slice(0, 1) === '_') {
                                        index = parseInt(prop.slice(1), 10);
                                    } else {
                                        index = parseInt(prop, 10);
                                    }
                                    if (d[prop].length === 1) {
                                        if (index < indexAfter) {
                                            indexBefore--;
                                        } else {
                                            if (index === indexAfter) {
                                                return -1;
                                            }
                                        }
                                    } else if (d[prop].length === 3) {
                                        if (d[prop][2] === 0) {
                                            if (index <= indexAfter) {
                                                indexBefore++;
                                            }
                                        } else {
                                            if (d[prop][2] === 3) {
                                                if (index <= indexAfter) {
                                                    indexBefore++;
                                                }
                                                if (d[prop][1] > indexAfter) {
                                                    indexBefore--;
                                                } else {
                                                    if (d[prop][1] === indexAfter) {
                                                        return index;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return indexBefore;
                    },
                    patch: function (array, d, objectInnerPatch, path) {
                        var index, index1;
                        var numerically = function (a, b) {
                            return a - b;
                        };
                        var numericallyBy = function (name) {
                            return function (a, b) {
                                return a[name] - b[name];
                            };
                        };
                        var toRemove = [];
                        var toInsert = [];
                        var toModify = [];
                        for (index in d) {
                            if (index !== '_t') {
                                if (index[0] == '_') {
                                    if (d[index][2] === 0 || d[index][2] === 3) {
                                        toRemove.push(parseInt(index.slice(1), 10));
                                    } else {
                                        throw new Error('only removal or move can be applied at original array indices, invalid diff type: ' + d[index][2]);
                                    }
                                } else {
                                    if (d[index].length === 1) {
                                        toInsert.push({
                                            index: parseInt(index, 10),
                                            value: d[index][0]
                                        });
                                    } else {
                                        toModify.push({
                                            index: parseInt(index, 10),
                                            diff: d[index]
                                        });
                                    }
                                }
                            }
                        }
                        toRemove = toRemove.sort(numerically);
                        for (index = toRemove.length - 1; index >= 0; index--) {
                            index1 = toRemove[index];
                            var indexDiff = d['_' + index1];
                            var removedValue = array.splice(index1, 1)[0];
                            if (indexDiff[2] === 3) {
                                toInsert.push({
                                    index: indexDiff[1],
                                    value: removedValue
                                });
                            }
                        }
                        toInsert = toInsert.sort(numericallyBy('index'));
                        var toInsertLength = toInsert.length;
                        for (index = 0; index < toInsertLength; index++) {
                            var insertion = toInsert[index];
                            array.splice(insertion.index, 0, insertion.value);
                        }
                        var toModifyLength = toModify.length;
                        if (toModifyLength > 0) {
                            if (typeof objectInnerPatch != 'function') {
                                throw new Error('to patch items in the array an objectInnerPatch function must be provided');
                            }
                            for (index = 0; index < toModifyLength; index++) {
                                var modification = toModify[index];
                                objectInnerPatch(array, modification.index.toString(), modification.diff, path);
                            }
                        }
                        return array;
                    },
                    lcs: function (array1, array2, options) {
                        options.areTheSameByIndex = options.areTheSameByIndex || function (index1, index2) {
                            return array1[index1] === array2[index2];
                        };
                        var matrix = this.lengthMatrix(array1, array2, options);
                        var result = this.backtrack(matrix, array1, array2, array1.length, array2.length);
                        if (typeof array1 == 'string' && typeof array2 == 'string') {
                            result.sequence = result.sequence.join('');
                        }
                        return result;
                    },
                    lengthMatrix: function (array1, array2, options) {
                        var len1 = array1.length;
                        var len2 = array2.length;
                        var x, y;
                        var matrix = [len1 + 1];
                        for (x = 0; x < len1 + 1; x++) {
                            matrix[x] = [len2 + 1];
                            for (y = 0; y < len2 + 1; y++) {
                                matrix[x][y] = 0;
                            }
                        }
                        matrix.options = options;
                        for (x = 1; x < len1 + 1; x++) {
                            for (y = 1; y < len2 + 1; y++) {
                                if (options.areTheSameByIndex(x - 1, y - 1)) {
                                    matrix[x][y] = matrix[x - 1][y - 1] + 1;
                                } else {
                                    matrix[x][y] = Math.max(matrix[x - 1][y], matrix[x][y - 1]);
                                }
                            }
                        }
                        return matrix;
                    },
                    backtrack: function (lenghtMatrix, array1, array2, index1, index2) {
                        if (index1 === 0 || index2 === 0) {
                            return {
                                sequence: [],
                                indices1: [],
                                indices2: []
                            };
                        }
                        if (lenghtMatrix.options.areTheSameByIndex(index1 - 1, index2 - 1)) {
                            var subsequence = this.backtrack(lenghtMatrix, array1, array2, index1 - 1, index2 - 1);
                            subsequence.sequence.push(array1[index1 - 1]);
                            subsequence.indices1.push(index1 - 1);
                            subsequence.indices2.push(index2 - 1);
                            return subsequence;
                        }
                        if (lenghtMatrix[index1][index2 - 1] > lenghtMatrix[index1 - 1][index2]) {
                            return this.backtrack(lenghtMatrix, array1, array2, index1, index2 - 1);
                        } else {
                            return this.backtrack(lenghtMatrix, array1, array2, index1 - 1, index2);
                        }
                    }
                };
            jdp.sequenceDiffer = sequenceDiffer;
            jdp.dateReviver = function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)(Z|([+\-])(\d{2}):(\d{2}))$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
                    }
                }
                return value;
            };
            var diff_match_patch_autoconfig = function () {
                var dmp;
                if (jdp.config.diff_match_patch) {
                    dmp = new jdp.config.diff_match_patch.diff_match_patch();
                }
                if (typeof diff_match_patch != 'undefined') {
                    if (typeof diff_match_patch == 'function') {
                        dmp = new diff_match_patch();
                    } else if (typeof diff_match_patch == 'object' && typeof diff_match_patch.diff_match_patch == 'function') {
                        dmp = new diff_match_patch.diff_match_patch();
                    }
                }
                if (dmp) {
                    jdp.config.textDiff = function (txt1, txt2) {
                        return dmp.patch_toText(dmp.patch_make(txt1, txt2));
                    };
                    jdp.config.textPatch = function (txt1, patch) {
                        var results = dmp.patch_apply(dmp.patch_fromText(patch), txt1);
                        for (var i = 0; i < results[1].length; i++) {
                            if (!results[1][i]) {
                                throw new Error('text patch failed');
                            }
                        }
                        return results[0];
                    };
                    return true;
                }
            };
            var isArray = jdp.isArray = typeof Array.isArray == 'function' ? Array.isArray : function (a) {
                    return typeof a == 'object' && a instanceof Array;
                };
            var isDate = jdp.isDate = function (d) {
                    return d instanceof Date || Object.prototype.toString.call(d) === '[object Date]';
                };
            var arrayDiff = function (o, n) {
                return sequenceDiffer.diff(o, n, jdp.config.objectHash, jdp.diff);
            };
            var objectDiff = function (o, n) {
                var odiff, pdiff, prop, addPropDiff;
                addPropDiff = function (name) {
                    pdiff = diff(o[name], n[name]);
                    if (typeof pdiff != 'undefined') {
                        if (typeof odiff == 'undefined') {
                            odiff = {};
                        }
                        odiff[name] = pdiff;
                    }
                };
                for (prop in n) {
                    if (n.hasOwnProperty(prop)) {
                        addPropDiff(prop);
                    }
                }
                for (prop in o) {
                    if (o.hasOwnProperty(prop)) {
                        if (typeof n[prop] == 'undefined') {
                            addPropDiff(prop);
                        }
                    }
                }
                return odiff;
            };
            var diff = jdp.diff = function (o, n) {
                    var ntype, otype, nnull, onull, d;
                    if (o === n) {
                        return;
                    }
                    if (o !== o && n !== n) {
                        return;
                    }
                    ntype = typeof n;
                    otype = typeof o;
                    nnull = n === null;
                    onull = o === null;
                    if (otype == 'object' && isDate(o)) {
                        otype = 'date';
                    }
                    if (ntype == 'object' && isDate(n)) {
                        ntype = 'date';
                        if (otype == 'date') {
                            if (o.getTime() === n.getTime()) {
                                return;
                            }
                        }
                    }
                    if (nnull || onull || ntype == 'undefined' || ntype != otype || ntype == 'number' || otype == 'number' || ntype == 'boolean' || otype == 'boolean' || ntype == 'string' || otype == 'string' || ntype == 'date' || otype == 'date' || ntype === 'object' && isArray(n) != isArray(o)) {
                        d = [];
                        if (typeof o != 'undefined') {
                            if (typeof n != 'undefined') {
                                var longText = ntype == 'string' && otype == 'string' && Math.min(o.length, n.length) > jdp.config.textDiffMinLength;
                                if (longText && !jdp.config.textDiff) {
                                    diff_match_patch_autoconfig();
                                }
                                if (longText && jdp.config.textDiff) {
                                    d.push(jdp.config.textDiff(o, n), 0, 2);
                                } else {
                                    d.push(o);
                                    d.push(n);
                                }
                            } else {
                                d.push(o);
                                d.push(0, 0);
                            }
                        } else {
                            d.push(n);
                        }
                        return d;
                    } else {
                        if (isArray(n)) {
                            return arrayDiff(o, n);
                        } else {
                            return objectDiff(o, n);
                        }
                    }
                };
            var objectGet = function (obj, key) {
                if (isArray(obj)) {
                    return obj[parseInt(key, 10)];
                }
                return obj[key];
            };
            jdp.getByKey = objectGet;
            var objectSet = function (obj, key, value) {
                if (isArray(obj) && obj._key) {
                    var getKey = obj._key;
                    if (typeof obj._key != 'function') {
                        getKey = function (item) {
                            return item[obj._key];
                        };
                    }
                    for (var i = 0; i < obj.length; i++) {
                        if (getKey(obj[i]) === key) {
                            if (typeof value == 'undefined') {
                                obj.splice(i, 1);
                                i--;
                            } else {
                                obj[i] = value;
                            }
                            return;
                        }
                    }
                    if (typeof value != 'undefined') {
                        obj.push(value);
                    }
                    return;
                }
                if (typeof value == 'undefined') {
                    if (isArray(obj)) {
                        obj.splice(key, 1);
                    } else {
                        delete obj[key];
                    }
                } else {
                    obj[key] = value;
                }
            };
            var textDiffReverse = function (td) {
                if (!jdp.config.textDiffReverse) {
                    jdp.config.textDiffReverse = function (d) {
                        var i, l, lines, line, lineTmp, header = null, headerRegex = /^@@ +\-(\d+),(\d+) +\+(\d+),(\d+) +@@$/, lineHeader, lineAdd, lineRemove;
                        var diffSwap = function () {
                            if (lineAdd !== null) {
                                lines[lineAdd] = '-' + lines[lineAdd].slice(1);
                            }
                            if (lineRemove !== null) {
                                lines[lineRemove] = '+' + lines[lineRemove].slice(1);
                                if (lineAdd !== null) {
                                    lineTmp = lines[lineAdd];
                                    lines[lineAdd] = lines[lineRemove];
                                    lines[lineRemove] = lineTmp;
                                }
                            }
                            lines[lineHeader] = '@@ -' + header[3] + ',' + header[4] + ' +' + header[1] + ',' + header[2] + ' @@';
                            header = null;
                            lineHeader = null;
                            lineAdd = null;
                            lineRemove = null;
                        };
                        lines = d.split('\n');
                        for (i = 0, l = lines.length; i < l; i++) {
                            line = lines[i];
                            var lineStart = line.slice(0, 1);
                            if (lineStart === '@') {
                                if (header !== null) {
                                }
                                header = headerRegex.exec(line);
                                lineHeader = i;
                                lineAdd = null;
                                lineRemove = null;
                                lines[lineHeader] = '@@ -' + header[3] + ',' + header[4] + ' +' + header[1] + ',' + header[2] + ' @@';
                            } else if (lineStart == '+') {
                                lineAdd = i;
                                lines[i] = '-' + lines[i].slice(1);
                            } else if (lineStart == '-') {
                                lineRemove = i;
                                lines[i] = '+' + lines[i].slice(1);
                            }
                        }
                        if (header !== null) {
                        }
                        return lines.join('\n');
                    };
                }
                return jdp.config.textDiffReverse(td);
            };
            var reverse = jdp.reverse = function (d) {
                    var prop, rd;
                    if (typeof d == 'undefined') {
                        return;
                    } else if (d === null) {
                        return null;
                    } else if (typeof d == 'object' && !isDate(d)) {
                        if (isArray(d)) {
                            if (d.length < 3) {
                                if (d.length === 1) {
                                    return [
                                        d[0],
                                        0,
                                        0
                                    ];
                                } else {
                                    return [
                                        d[1],
                                        d[0]
                                    ];
                                }
                            } else {
                                if (d[2] === 0) {
                                    return [d[0]];
                                } else {
                                    if (d[2] === 2) {
                                        return [
                                            textDiffReverse(d[0]),
                                            0,
                                            2
                                        ];
                                    } else {
                                        throw new Error('invalid diff type');
                                    }
                                }
                            }
                        } else {
                            rd = {};
                            if (d._t === 'a') {
                                for (prop in d) {
                                    if (d.hasOwnProperty(prop) && prop !== '_t') {
                                        var index, reverseProp = prop;
                                        if (prop.slice(0, 1) === '_') {
                                            index = parseInt(prop.slice(1), 10);
                                        } else {
                                            index = parseInt(prop, 10);
                                        }
                                        if (isArray(d[prop])) {
                                            if (d[prop].length === 1) {
                                                reverseProp = '_' + index;
                                            } else {
                                                if (d[prop].length === 2) {
                                                    reverseProp = sequenceDiffer.getArrayIndexBefore(d, index);
                                                } else {
                                                    if (d[prop][2] === 0) {
                                                        reverseProp = index.toString();
                                                    } else {
                                                        if (d[prop][2] === 3) {
                                                            reverseProp = '_' + d[prop][1];
                                                            rd[reverseProp] = [
                                                                d[prop][0],
                                                                index,
                                                                3
                                                            ];
                                                            continue;
                                                        } else {
                                                            reverseProp = sequenceDiffer.getArrayIndexBefore(d, index);
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            reverseProp = sequenceDiffer.getArrayIndexBefore(d, index);
                                        }
                                        rd[reverseProp] = reverse(d[prop]);
                                    }
                                }
                                rd._t = 'a';
                            } else {
                                for (prop in d) {
                                    if (d.hasOwnProperty(prop)) {
                                        rd[prop] = reverse(d[prop]);
                                    }
                                }
                            }
                            return rd;
                        }
                    } else if (typeof d === 'string' && d.slice(0, 2) === '@@') {
                        return textDiffReverse(d);
                    }
                    return d;
                };
            var patch = jdp.patch = function (o, pname, d, path) {
                    var p, nvalue, subpath = '', target;
                    if (typeof pname != 'string') {
                        path = d;
                        d = pname;
                        pname = null;
                    } else {
                        if (typeof o != 'object') {
                            pname = null;
                        }
                    }
                    if (path) {
                        subpath += path;
                    }
                    subpath += '/';
                    if (pname !== null) {
                        subpath += pname;
                    }
                    if (typeof d == 'object') {
                        if (isArray(d)) {
                            if (d.length < 3) {
                                nvalue = d[d.length - 1];
                                if (pname !== null) {
                                    objectSet(o, pname, nvalue);
                                }
                                return nvalue;
                            } else {
                                if (d[2] === 0) {
                                    if (pname !== null) {
                                        objectSet(o, pname);
                                    } else {
                                        return;
                                    }
                                } else {
                                    if (d[2] === 2) {
                                        if (!jdp.config.textPatch) {
                                            diff_match_patch_autoconfig();
                                        }
                                        if (!jdp.config.textPatch) {
                                            throw new Error('textPatch function not found');
                                        }
                                        try {
                                            nvalue = jdp.config.textPatch(objectGet(o, pname), d[0]);
                                        } catch (text_patch_err) {
                                            throw new Error('cannot apply patch at "' + subpath + '": ' + text_patch_err);
                                        }
                                        if (pname !== null) {
                                            objectSet(o, pname, nvalue);
                                        }
                                        return nvalue;
                                    } else {
                                        if (d[2] === 3) {
                                            throw new Error('Not implemented diff type: ' + d[2]);
                                        } else {
                                            throw new Error('invalid diff type: ' + d[2]);
                                        }
                                    }
                                }
                            }
                        } else {
                            if (d._t == 'a') {
                                target = pname === null ? o : objectGet(o, pname);
                                if (typeof target != 'object' || !isArray(target)) {
                                    throw new Error('cannot apply patch at "' + subpath + '": array expected');
                                } else {
                                    sequenceDiffer.patch(target, d, jsondiffpatch.patch, subpath);
                                }
                            } else {
                                target = pname === null ? o : objectGet(o, pname);
                                if (typeof target != 'object' || isArray(target)) {
                                    throw new Error('cannot apply patch at "' + subpath + '": object expected');
                                } else {
                                    for (p in d) {
                                        if (d.hasOwnProperty(p)) {
                                            patch(target, p, d[p], subpath);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return o;
                };
            var unpatch = jdp.unpatch = function (o, pname, d, path) {
                    if (typeof pname != 'string') {
                        return patch(o, reverse(pname), d);
                    }
                    return patch(o, pname, reverse(d), path);
                };
            if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
                module.exports = jdp;
            } else if (typeof define === 'function' && define.amd) {
                define(jdp);
            } else {
                if (typeof window !== 'undefined') {
                    window.jsondiffpatch = jdp;
                } else {
                    self.jsondiffpatch = jdp;
                }
            }
        }());
    });
    require.define('/lib/model/errors.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.Errors = Ember.ObjectProxy.extend(Ember.Copyable, {
            init: function () {
                this._super.apply(this, arguments);
                if (!get(this, 'content'))
                    set(this, 'content', {});
            },
            forEach: function (callback, self) {
                var keys = Ember.keys(this.content);
                keys.forEach(function (key) {
                    var value = get(this.content, key);
                    callback.call(self, key, value);
                }, this);
            },
            copy: function () {
                return Ep.Errors.create({ content: Ember.copy(this.content) });
            }
        });
    });
    require.define('/lib/model/relationships/ext.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.Model.reopen({
            didDefineProperty: function (proto, key, value) {
                if (value instanceof Ember.Descriptor) {
                    var meta = value.meta();
                    if (meta.isRelationship && meta.kind === 'belongsTo') {
                        Ember.addObserver(proto, key, null, 'belongsToDidChange');
                        Ember.addBeforeObserver(proto, key, null, 'belongsToWillChange');
                    }
                    meta.parentType = proto.constructor;
                }
            },
            _suspendedRelationships: false,
            suspendRelationshipObservers: function (callback, binding) {
                var observers = get(this.constructor, 'relationshipNames').belongsTo;
                var self = this;
                if (this._suspendedRelationships) {
                    return callback.call(binding || self);
                }
                try {
                    this._suspendedRelationships = true;
                    Ember._suspendObservers(self, observers, null, 'belongsToDidChange', function () {
                        Ember._suspendBeforeObservers(self, observers, null, 'belongsToWillChange', function () {
                            callback.call(binding || self);
                        });
                    });
                } finally {
                    this._suspendedRelationships = false;
                }
            }
        });
        Ep.Model.reopenClass({
            typeForRelationship: function (name) {
                var relationship = get(this, 'relationshipsByName').get(name);
                return relationship && relationship.type;
            },
            inverseFor: function (name) {
                var inverseType = this.typeForRelationship(name);
                if (!inverseType) {
                    return null;
                }
                var options = this.metaForProperty(name).options;
                var inverseName, inverseKind;
                if (options.inverse) {
                    inverseName = options.inverse;
                    inverseKind = Ember.get(inverseType, 'relationshipsByName').get(inverseName).kind;
                } else {
                    var possibleRelationships = findPossibleInverses(this, inverseType);
                    if (possibleRelationships.length === 0) {
                        return null;
                    }

                    inverseName = possibleRelationships[0].name;
                    inverseKind = possibleRelationships[0].kind;
                }
                function findPossibleInverses(type, inverseType, possibleRelationships) {
                    possibleRelationships = possibleRelationships || [];
                    var relationshipMap = get(inverseType, 'relationships');
                    if (!relationshipMap) {
                        return;
                    }
                    var relationships = relationshipMap.get(type);
                    if (relationships) {
                        possibleRelationships.push.apply(possibleRelationships, relationshipMap.get(type));
                    }
                    if (type.superclass) {
                        findPossibleInverses(type.superclass, inverseType, possibleRelationships);
                    }
                    return possibleRelationships;
                }
                return {
                    type: inverseType,
                    name: inverseName,
                    kind: inverseKind
                };
            },
            relationships: Ember.computed(function () {
                var map = new Ember.MapWithDefault({
                        defaultValue: function () {
                            return [];
                        }
                    });
                this.eachComputedProperty(function (name, meta) {
                    if (meta.isRelationship) {
                        reifyRelationshipType(meta);
                        var relationshipsForType = map.get(meta.type);
                        relationshipsForType.push({
                            name: name,
                            kind: meta.kind
                        });
                    }
                });
                return map;
            }),
            relationshipNames: Ember.computed(function () {
                var names = {
                        hasMany: [],
                        belongsTo: []
                    };
                this.eachComputedProperty(function (name, meta) {
                    if (meta.isRelationship) {
                        names[meta.kind].push(name);
                    }
                });
                return names;
            }),
            relatedTypes: Ember.computed(function () {
                var type, types = Ember.A([]);
                this.eachComputedProperty(function (name, meta) {
                    if (meta.isRelationship) {
                        reifyRelationshipType(meta);
                        type = meta.type;

                        if (!types.contains(type)) {

                            types.push(type);
                        }
                    }
                });
                return types;
            }),
            relationshipsByName: Ember.computed(function () {
                var map = Ember.Map.create(), type;
                this.eachComputedProperty(function (name, meta) {
                    if (meta.isRelationship) {
                        reifyRelationshipType(meta);
                        meta.key = name;
                        type = meta.type;
                        map.set(name, meta);
                    }
                });
                return map;
            }),
            fields: Ember.computed(function () {
                var map = Ember.Map.create();
                this.eachComputedProperty(function (name, meta) {
                    if (meta.isRelationship) {
                        map.set(name, meta.kind);
                    } else if (meta.isAttribute) {
                        map.set(name, 'attribute');
                    }
                });
                return map;
            }),
            eachRelationship: function (callback, binding) {
                get(this, 'relationshipsByName').forEach(function (name, relationship) {
                    callback.call(binding, name, relationship);
                });
            },
            eachRelatedType: function (callback, binding) {
                get(this, 'relatedTypes').forEach(function (type) {
                    callback.call(binding, type);
                });
            }
        });
        Ep.Model.reopen({
            eachRelationship: function (callback, binding) {
                this.constructor.eachRelationship(callback, binding);
            }
        });
        Ep.ModelMixin.reopen({
            eachRelatedModel: function (callback, binding, cache) {
                if (!cache)
                    cache = Ember.Set.create();
                if (cache.contains(this))
                    return;
                cache.add(this);
                callback.call(binding || this, this);
                if (!get(this, 'isLoaded'))
                    return;
                this.eachRelationship(function (name, relationship) {
                    if (relationship.kind === 'belongsTo') {
                        var child = get(this, name);
                        if (!child)
                            return;
                        this.eachRelatedModel.call(child, callback, binding, cache);
                    } else if (relationship.kind === 'hasMany') {
                        var children = get(this, name);
                        children.forEach(function (child) {
                            this.eachRelatedModel.call(child, callback, binding, cache);
                        }, this);
                    }
                }, this);
            },
            eachChild: function (callback, binding) {
                this.eachRelationship(function (name, relationship) {
                    if (relationship.kind === 'belongsTo') {
                        var child = get(this, name);
                        if (child) {
                            callback.call(binding, child);
                        }
                    } else if (relationship.kind === 'hasMany') {
                        var children = get(this, name);
                        children.forEach(function (child) {
                            callback.call(binding, child);
                        }, this);
                    }
                }, this);
            }
        });
        function reifyRelationshipType(relationship) {
            if (!relationship.type) {
                relationship.type = Ep.__container__.lookupFactory('model:' + relationship.typeKey);
            }
            if (!relationship.typeKey) {
                relationship.typeKey = get(relationship.type, 'typeKey');
            }
        }
    });
    require.define('/lib/model/relationships/has_many.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set, forEach = Ember.ArrayPolyfills.forEach;
        require('/lib/model/model.js', module);
        require('/lib/collections/model_array.js', module);
        Ep.hasMany = function (typeKey, options) {

            options = options || {};
            var meta = {
                    isRelationship: true,
                    options: options,
                    kind: 'hasMany'
                };
            if (typeof typeKey === 'string') {
                meta.typeKey = typeKey;
            } else {

                meta.type = typeKey;
            }
            return Ember.computed(function (key, value, cached) {
                var content;
                if (arguments.length === 1) {
                    content = [];
                } else {
                    content = value;
                }
                if (cached) {
                    set(cached, 'content', content);
                    return cached;
                }
                return Ep.HasManyArray.create({
                    owner: this,
                    name: key,
                    content: content
                });
            }).property().meta(meta);
        };
        Ep.HasManyArray = Ep.ModelArray.extend({
            name: null,
            owner: null,
            session: Ember.computed.alias('owner.session'),
            objectAtContent: function (index) {
                var content = get(this, 'content'), model = content.objectAt(index), session = get(this, 'session');
                if (session && model) {
                    return session.add(model);
                }
                return model;
            },
            arrayContentWillChange: function (index, removed, added) {
                var model = get(this, 'owner'), name = get(this, 'name'), session = get(this, 'session');
                if (session) {
                    session.modelWillBecomeDirty(model);
                    if (!model._suspendedRelationships) {
                        for (var i = index; i < index + removed; i++) {
                            var inverseModel = this.objectAt(i);
                            session.inverseManager.unregisterRelationship(model, name, inverseModel);
                        }
                    }
                }
                return this._super.apply(this, arguments);
            },
            arrayContentDidChange: function (index, removed, added) {
                this._super.apply(this, arguments);
                var model = get(this, 'owner'), name = get(this, 'name'), session = get(this, 'session');
                if (session && !model._suspendedRelationships) {
                    for (var i = index; i < index + added; i++) {
                        var inverseModel = this.objectAt(i);
                        session.inverseManager.registerRelationship(model, name, inverseModel);
                    }
                }
            }
        });
    });
    require.define('/lib/collections/model_array.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.ModelArray = Ember.ArrayProxy.extend({
            session: null,
            meta: null,
            arrayContentWillChange: function (index, removed, added) {
                for (var i = index; i < index + removed; i++) {
                    var model = this.objectAt(i);
                    var session = get(this, 'session');
                    if (session) {
                        session.collectionManager.unregister(this, model);
                    }
                }
                this._super.apply(this, arguments);
            },
            arrayContentDidChange: function (index, removed, added) {
                this._super.apply(this, arguments);
                for (var i = index; i < index + added; i++) {
                    var model = this.objectAt(i);
                    var session = get(this, 'session');
                    if (session) {
                        session.collectionManager.register(this, model);
                    }
                }
            },
            removeObject: function (obj) {
                var loc = get(this, 'length') || 0;
                while (--loc >= 0) {
                    var curObject = this.objectAt(loc);
                    if (curObject.isEqual(obj))
                        this.removeAt(loc);
                }
                return this;
            },
            contains: function (obj) {
                for (var i = 0; i < get(this, 'length'); i++) {
                    var m = this.objectAt(i);
                    if (obj.isEqual(m))
                        return true;
                }
                return false;
            },
            copyTo: function (dest) {
                var existing = Ep.ModelSet.create();
                existing.addObjects(dest);
                this.forEach(function (model) {
                    if (existing.contains(model)) {
                        existing.remove(model);
                    } else {
                        dest.pushObject(model);
                    }
                });
                dest.removeObjects(existing);
            },
            diff: function (arr) {
                var diff = Ember.A();
                this.forEach(function (model) {
                    if (!arr.contains(model)) {
                        diff.push(model);
                    }
                }, this);
                arr.forEach(function (model) {
                    if (!this.contains(model)) {
                        diff.push(model);
                    }
                }, this);
                return diff;
            },
            isEqual: function (arr) {
                return this.diff(arr).length === 0;
            }
        });
    });
    require.define('/lib/model/model.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        require('/lib/collections/model_set.js', module);
        Ep.ModelMixin = Ember.Mixin.create({
            id: null,
            clientId: null,
            rev: null,
            clientRev: 0,
            session: null,
            errors: null,
            isModel: true,
            isEqual: function (model) {
                var clientId = get(this, 'clientId');
                var otherClientId = get(model, 'clientId');
                if (clientId && otherClientId) {
                    return clientId === otherClientId;
                }
                var id = get(this, 'id');
                var otherId = get(model, 'id');
                return this.isSameType(model) && id === otherId;
            },
            isSameType: function (model) {
                return this.hasType(get(model, 'type'));
            },
            hasType: function (type) {
                return get(this, 'type').detect(type);
            },
            type: Ember.computed(function (key, value) {
                return value || this.constructor;
            }),
            typeKey: Ember.computed(function () {
                return get(this, 'type.typeKey');
            }),
            toStringExtension: function () {
                return '[' + get(this, 'id') + ', ' + get(this, 'clientId') + ']';
            },
            lazyCopy: function () {
                return Ep.LazyModel.create({
                    id: get(this, 'id'),
                    clientId: get(this, 'clientId'),
                    type: get(this, 'type'),
                    isDeleted: get(this, 'isDeleted'),
                    errors: get(this, 'errors')
                });
            },
            hasErrors: Ember.computed(function () {
                return !!get(this, 'errors');
            }).volatile(),
            isDetached: Ember.computed(function () {
                return !get(this, 'session');
            }).volatile(),
            isManaged: Ember.computed(function () {
                return !!get(this, 'session');
            }).volatile()
        });
        Ep.Model = Ember.Object.extend(Ember.Copyable, Ep.ModelMixin, {
            isPromise: false,
            isProxy: false,
            isDeleted: false,
            isLoaded: true,
            isNew: Ember.computed(function () {
                return !get(this, 'id');
            }).property('id'),
            isDirty: Ember.computed(function () {
                var session = get(this, 'session');
                if (!session)
                    return false;
                return get(session, 'dirtyModels').contains(this);
            }).property('session.dirtyModels.[]'),
            copy: function () {
                var dest = this.constructor.create();
                dest.beginPropertyChanges();
                this.copyAttributes(dest);
                this.copyMeta(dest);
                this.eachRelationship(function (name, relationship) {
                    if (relationship.kind === 'belongsTo') {
                        var child = get(this, name);
                        if (child) {
                            set(dest, name, child.lazyCopy());
                        }
                    } else if (relationship.kind === 'hasMany') {
                        var children = get(this, name);
                        var destChildren = get(dest, name);
                        children.forEach(function (child) {
                            destChildren.pushObject(child.lazyCopy());
                        });
                    }
                }, this);
                dest.endPropertyChanges();
                return dest;
            },
            copyAttributes: function (dest) {
                dest.beginPropertyChanges();
                this.eachAttribute(function (name, meta) {
                    var left = get(this, name);
                    var right = get(dest, name);
                    var copy;
                    if (left instanceof Date) {
                        copy = new Date(left.getTime());
                    } else {
                        copy = Ember.copy(left, true);
                    }
                    set(dest, name, copy);
                }, this);
                dest.endPropertyChanges();
            },
            copyMeta: function (dest) {
                set(dest, 'id', get(this, 'id'));
                set(dest, 'clientId', get(this, 'clientId'));
                set(dest, 'rev', get(this, 'rev'));
                set(dest, 'clientRev', get(this, 'clientRev'));
                set(dest, 'errors', Ember.copy(get(this, 'errors')));
                set(dest, 'isDeleted', get(this, 'isDeleted'));
            }
        });
        Ep.Model.reopenClass({
            find: function (id) {
                if (!Ep.__container__) {
                    throw new Ember.Error('The Ep.__container__ property must be set in order to use static find methods.');
                }
                var container = Ep.__container__;
                var session = container.lookup('session:main');
                return session.find(this, id);
            },
            typeKey: Ember.computed(function () {
                return Ember.String.underscore(this.toString().split('.')[1]);
            })
        });
    });
    require.define('/lib/collections/model_set.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set, isNone = Ember.isNone, fmt = Ember.String.fmt;
        function guidFor(model) {
            return get(model, 'clientId');
        }
        Ep.ModelSet = Ember.CoreObject.extend(Ember.MutableEnumerable, Ember.Copyable, Ember.Freezable, {
            length: 0,
            clear: function () {
                if (this.isFrozen) {
                    throw new Error(Ember.FROZEN_ERROR);
                }
                var len = get(this, 'length');
                if (len === 0) {
                    return this;
                }
                var guid;
                this.enumerableContentWillChange(len, 0);
                Ember.propertyWillChange(this, 'firstObject');
                Ember.propertyWillChange(this, 'lastObject');
                for (var i = 0; i < len; i++) {
                    guid = guidFor(this[i]);
                    delete this[guid];
                    delete this[i];
                }
                set(this, 'length', 0);
                Ember.propertyDidChange(this, 'firstObject');
                Ember.propertyDidChange(this, 'lastObject');
                this.enumerableContentDidChange(len, 0);
                return this;
            },
            isEqual: function (obj) {
                if (!Ember.Enumerable.detect(obj))
                    return false;
                var loc = get(this, 'length');
                if (get(obj, 'length') !== loc)
                    return false;
                while (--loc >= 0) {
                    if (!obj.contains(this[loc]))
                        return false;
                }
                return true;
            },
            add: Ember.aliasMethod('addObject'),
            remove: Ember.aliasMethod('removeObject'),
            pop: function () {
                if (get(this, 'isFrozen'))
                    throw new Error(Ember.FROZEN_ERROR);
                var obj = this.length > 0 ? this[this.length - 1] : null;
                this.remove(obj);
                return obj;
            },
            push: Ember.aliasMethod('addObject'),
            shift: Ember.aliasMethod('pop'),
            unshift: Ember.aliasMethod('push'),
            addEach: Ember.aliasMethod('addObjects'),
            removeEach: Ember.aliasMethod('removeObjects'),
            init: function (items) {
                this._super();
                if (items)
                    this.addObjects(items);
            },
            nextObject: function (idx) {
                return this[idx];
            },
            firstObject: Ember.computed(function () {
                return this.length > 0 ? this[0] : undefined;
            }),
            lastObject: Ember.computed(function () {
                return this.length > 0 ? this[this.length - 1] : undefined;
            }),
            addObject: function (obj) {
                if (get(this, 'isFrozen'))
                    throw new Error(Ember.FROZEN_ERROR);
                if (isNone(obj))
                    return this;
                var guid = guidFor(obj), idx = this[guid], len = get(this, 'length'), added;
                if (idx >= 0 && idx < len && (this[idx] && this[idx].isEqual(obj))) {
                    if (this[idx] !== obj) {
                        this[idx] = obj;
                    }
                    return this;
                }
                added = [obj];
                this.enumerableContentWillChange(null, added);
                Ember.propertyWillChange(this, 'lastObject');
                len = get(this, 'length');
                this[guid] = len;
                this[len] = obj;
                set(this, 'length', len + 1);
                Ember.propertyDidChange(this, 'lastObject');
                this.enumerableContentDidChange(null, added);
                return this;
            },
            removeObject: function (obj) {
                if (get(this, 'isFrozen'))
                    throw new Error(Ember.FROZEN_ERROR);
                if (isNone(obj))
                    return this;
                var guid = guidFor(obj), idx = this[guid], len = get(this, 'length'), isFirst = idx === 0, isLast = idx === len - 1, last, removed;
                if (idx >= 0 && idx < len && (this[idx] && this[idx].isEqual(obj))) {
                    removed = [obj];
                    this.enumerableContentWillChange(removed, null);
                    if (isFirst) {
                        Ember.propertyWillChange(this, 'firstObject');
                    }
                    if (isLast) {
                        Ember.propertyWillChange(this, 'lastObject');
                    }
                    if (idx < len - 1) {
                        last = this[len - 1];
                        this[idx] = last;
                        this[guidFor(last)] = idx;
                    }
                    delete this[guid];
                    delete this[len - 1];
                    set(this, 'length', len - 1);
                    if (isFirst) {
                        Ember.propertyDidChange(this, 'firstObject');
                    }
                    if (isLast) {
                        Ember.propertyDidChange(this, 'lastObject');
                    }
                    this.enumerableContentDidChange(removed, null);
                }
                return this;
            },
            contains: function (obj) {
                return this[guidFor(obj)] >= 0;
            },
            copy: function (deep) {
                var C = this.constructor, ret = new C(), loc = get(this, 'length');
                set(ret, 'length', loc);
                while (--loc >= 0) {
                    ret[loc] = deep ? this[loc].copy() : this[loc];
                    ret[guidFor(this[loc])] = loc;
                }
                return ret;
            },
            toString: function () {
                var len = this.length, idx, array = [];
                for (idx = 0; idx < len; idx++) {
                    array[idx] = this[idx];
                }
                return fmt('Ep.ModelSet<%@>', [array.join(',')]);
            },
            getModel: function (model) {
                var idx = this[guidFor(model)];
                if (idx === undefined)
                    return;
                return this[idx];
            },
            getForClientId: function (clientId) {
                var idx = this[clientId];
                if (idx === undefined)
                    return;
                return this[idx];
            }
        });
        Ep.ModelSet.reopenClass({
            fromArray: function (models) {
                var res = this.create();
                res.addObjects(models);
                return res;
            }
        });
    });
    require.define('/lib/model/relationships/belongs_to.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set, isNone = Ember.isNone;
        function BelongsToDescriptor(func, opts) {
            Ember.ComputedProperty.apply(this, arguments);
        }
        BelongsToDescriptor.prototype = new Ember.ComputedProperty();
        BelongsToDescriptor.prototype.get = function (obj, keyName) {
            if (!get(obj, 'isDetached') && this._suspended !== obj) {
                var ret, cache, cached, meta, session, existing;
                meta = Ember.meta(obj);
                cache = meta.cache;
                session = get(obj, 'session');
                if ((cached = cache[keyName]) && (existing = session.fetch(cached)) && existing !== cached) {
                    cache[keyName] = existing;
                }
            }
            return Ember.ComputedProperty.prototype.get.apply(this, arguments);
        };
        Ep.belongsTo = function (typeKey, options) {

            options = options || {};
            var meta = {
                    isRelationship: true,
                    options: options,
                    kind: 'belongsTo'
                };
            if (typeof typeKey === 'string') {
                meta.typeKey = typeKey;
            } else {

                meta.type = typeKey;
            }
            return new BelongsToDescriptor(function (key, value, oldValue) {
                if (arguments.length === 1) {
                    return null;
                } else {
                    var session = get(this, 'session');
                    if (session) {
                        session.modelWillBecomeDirty(this, key, value, oldValue);
                        if (value) {
                            value = session.add(value);
                        }
                    }
                    return value;
                }
            }).meta(meta);
        };
        Ep.Model.reopen({
            init: function () {
                this._super();
                this.eachRelationship(function (name, relationship) {
                    if (relationship.kind === 'belongsTo') {
                        this.belongsToDidChange(this, name);
                    }
                }, this);
            },
            belongsToWillChange: Ember.beforeObserver(function (model, name) {
                var inverseModel = get(model, name);
                var session = get(model, 'session');
                if (session) {
                    if (inverseModel) {
                        session.inverseManager.unregisterRelationship(model, name, inverseModel);
                    }
                }
            }),
            belongsToDidChange: Ember.immediateObserver(function (model, name) {
                var inverseModel = get(model, name);
                var session = get(model, 'session');
                if (session && inverseModel) {
                    session.inverseManager.registerRelationship(model, name, inverseModel);
                }
            })
        });
    });
    require.define('/lib/model/debug.js', function (module, exports, __dirname, __filename) {
        Ep.Model.reopen({
            _debugInfo: function () {
                var attributes = ['id'], relationships = {
                        belongsTo: [],
                        hasMany: []
                    }, expensiveProperties = [];
                this.eachAttribute(function (name, meta) {
                    attributes.push(name);
                }, this);
                this.eachRelationship(function (name, relationship) {
                    relationships[relationship.kind].push(name);
                    expensiveProperties.push(name);
                });
                var groups = [
                        {
                            name: 'Attributes',
                            properties: attributes,
                            expand: true
                        },
                        {
                            name: 'Belongs To',
                            properties: relationships.belongsTo,
                            expand: true
                        },
                        {
                            name: 'Has Many',
                            properties: relationships.hasMany,
                            expand: true
                        },
                        {
                            name: 'Flags',
                            properties: [
                                'isLoaded',
                                'isDirty',
                                'isDeleted',
                                'isNew',
                                'isPromise',
                                'isProxy'
                            ]
                        }
                    ];
                return {
                    propertyInfo: {
                        includeOtherProperties: true,
                        groups: groups,
                        expensiveProperties: expensiveProperties
                    }
                };
            }
        });
    });
    require.define('/lib/model/attribute.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.Model.reopenClass({
            attributes: Ember.computed(function () {
                var map = Ember.Map.create();
                this.eachComputedProperty(function (name, meta) {
                    if (meta.isAttribute) {

                        meta.name = name;
                        map.set(name, meta);
                    }
                });
                return map;
            })
        });
        Ep.Model.reopen({
            eachAttribute: function (callback, binding) {
                get(this.constructor, 'attributes').forEach(function (name, meta) {
                    callback.call(binding, name, meta);
                }, binding);
            }
        });
        Ep.attr = function (type, options) {
            options = options || {};
            var meta = {
                    type: type,
                    isAttribute: true,
                    options: options
                };
            return Ember.computed(function (key, value, oldValue) {
                if (arguments.length > 1) {

                }
                var session = get(this, 'session');
                if (session && value !== oldValue) {
                    session.modelWillBecomeDirty(this, key, value, oldValue);
                }
                return value;
            }).meta(meta);
        };
    });
    require.define('/lib/model/proxies.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        function triggerLoad(async) {
            return function () {
                if (!get(this, 'content') && !get(this, 'isLoading')) {
                    if (async) {
                        Ember.run.later(this, 'load', 0);
                    } else {
                        this.load();
                    }
                }
                return this._super.apply(this, arguments);
            };
        }
        function passThrough(key, defaultValue) {
            return Ember.computed(function (key, value) {
                var content = get(this, 'content');
                if (arguments.length === 1) {
                    if (content) {
                        return get(content, key);
                    } else {
                        return defaultValue;
                    }
                }
                if (content) {
                    return set(content, key, value);
                }
                return value;
            }).property('content.' + key);
        }
        function passThroughMethod(name, defaultReturn) {
            return function () {
                var content = get(this, 'content');
                if (!content)
                    return defaultReturn;
                return content[name].apply(content, arguments);
            };
        }
        Ep.ModelProxy = Ember.ObjectProxy.extend(Ember.Copyable, Ep.ModelMixin, {
            id: passThrough('id'),
            clientId: passThrough('clientId'),
            rev: passThrough('rev'),
            clientRev: passThrough('clientRev'),
            type: passThrough('type'),
            isDirty: false,
            isPromise: false,
            isLoaded: passThrough('isLoaded', false),
            isLoading: false,
            isDeleted: passThrough('isDeleted', false),
            isNew: passThrough('isNew', false),
            isProxy: true,
            errors: passThrough('errors'),
            copy: function () {
                var content = get(this, 'content');
                if (content) {
                    return content.copy();
                }
                return this.lazyCopy();
            },
            diff: passThroughMethod('diff', []),
            suspendRelationshipObservers: passThroughMethod('suspendRelationshipObservers'),
            eachAttribute: passThroughMethod('eachAttribute'),
            eachRelationship: passThroughMethod('eachRelationship'),
            _registerRelationships: passThroughMethod('_registerRelationships')
        });
        Ep.LoadError = Ep.ModelProxy.extend({});
        Ep.ModelPromise = Ep.ModelProxy.extend(Ember.DeferredMixin, {
            isPromise: true,
            resolve: function (model) {
                set(this, 'content', model);
                return this._super.apply(this, arguments);
            },
            hasIdentifiers: Ember.computed(function () {
                return get(this, 'type') && (get(this, 'id') || get(this, 'clientId'));
            }).volatile(),
            toStringExtension: function () {
                var content = get(this, 'content');
                if (content) {
                    return content.toString();
                } else if (get(this, 'hasIdentifiers')) {
                    var type = get(this, 'type');
                    return '(unloaded ' + type.toString() + '):' + this._super();
                } else {
                    return '(no identifiers)';
                }
            }
        });
        Ep.LazyModel = Ep.ModelPromise.extend({
            willWatchProperty: triggerLoad(true),
            unknownProperty: triggerLoad(),
            setUnknownProperty: triggerLoad(),
            then: triggerLoad(true),
            resolve: function () {
                set(this, 'isLoading', false);
                return this._super.apply(this, arguments);
            },
            load: function () {
                if (get(this, 'isLoading'))
                    return this;
                var session = get(this, 'session');
                var type = get(this, 'type');
                var id = get(this, 'id');
                set(this, 'isLoading', true);


                var promise = this.session.load(type, id);
                if (get(promise, 'isLoaded')) {
                    this.resolve(Ep.unwrap(promise));
                } else {
                    var proxy = this;
                    promise.then(function (model) {
                        proxy.resolve(model);
                        return model;
                    }, function (err) {
                        proxy.reject(err);
                        return err;
                    });
                }
                return this;
            }
        });
        Ep.unwrap = function (modelOrPromise) {
            if (get(modelOrPromise, 'isProxy')) {
                return get(modelOrPromise, 'content');
            }
            return modelOrPromise;
        };
        Ep.resolveModel = function (modelOrPromise, type, id, session) {
            if (modelOrPromise instanceof Ep.ModelPromise) {
                return modelOrPromise;
            }
            id = get(modelOrPromise, 'id') || id;
            var clientId = get(modelOrPromise, 'clientId');
            type = get(modelOrPromise, 'type') || type;
            session = get(modelOrPromise, 'session') || session;
            var promise = Ep.ModelPromise.create({
                    id: id,
                    clientId: clientId,
                    type: type,
                    session: session
                });
            if (typeof modelOrPromise.then !== 'function') {
                promise.resolve(modelOrPromise);
            } else {
                modelOrPromise.then(function (model) {
                    promise.resolve(model);
                    return model;
                }, function (err) {
                    promise.reject(err);
                    throw err;
                });
            }
            return promise;
        };
    });
    require.define('/lib/session/inverse_manager.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.InverseManager = Ember.Object.extend({
            session: null,
            init: function () {
                this.map = Ember.MapWithDefault.create({
                    defaultValue: function () {
                        return Ember.MapWithDefault.create({
                            defaultValue: function () {
                                return Ep.ModelSet.create();
                            }
                        });
                    }
                });
            },
            register: function (model) {
                var clientId = get(model, 'clientId');

                var session = get(this, 'session');
                model.eachRelationship(function (name, relationship) {
                    var existingInverses = this.map.get(clientId).get(name), inversesToClear = existingInverses.copy();
                    function checkInverse(inverseModel) {
                        session.reifyClientId(inverseModel);
                        if (existingInverses.contains(inverseModel)) {
                        } else {
                            this.registerRelationship(model, name, inverseModel);
                        }
                        inversesToClear.remove(inverseModel);
                    }
                    if (relationship.kind === 'belongsTo') {
                        var inverseModel = get(model, name);
                        if (inverseModel) {
                            checkInverse.call(this, inverseModel);
                        }
                    } else if (relationship.kind === 'hasMany') {
                        var inverseModels = get(model, name);
                        inverseModels.forEach(function (inverseModel) {
                            checkInverse.call(this, inverseModel);
                        }, this);
                    }
                    inversesToClear.forEach(function (inverseModel) {
                        this.unregisterRelationship(model, name, inverseModel);
                    }, this);
                }, this);
            },
            unregister: function (model) {
                var clientId = get(model, 'clientId'), inverses = this.map.get(clientId);
                inverses.forEach(function (name, inverseModels) {
                    inverseModels.forEach(function (inverseModel) {
                        this.unregisterRelationship(model, name, inverseModel);
                    }, this);
                }, this);
                this.map.remove(clientId);
            },
            registerRelationship: function (model, name, inverseModel) {
                var inverse = model.constructor.inverseFor(name);
                this.map.get(get(model, 'clientId')).get(name).addObject(inverseModel);
                if (inverse) {
                    this.map.get(get(inverseModel, 'clientId')).get(inverse.name).addObject(model);
                    this._addToInverse(inverseModel, inverse, model);
                }
            },
            unregisterRelationship: function (model, name, inverseModel) {
                var inverse = model.constructor.inverseFor(name);
                this.map.get(get(model, 'clientId')).get(name).removeObject(inverseModel);
                if (inverse) {
                    this.map.get(get(inverseModel, 'clientId')).get(inverse.name).removeObject(model);
                    this._removeFromInverse(inverseModel, inverse, model);
                }
            },
            _addToInverse: function (model, inverse, inverseModel) {
                model = this.session.getModel(model);
                if (!model)
                    return;
                model.suspendRelationshipObservers(function () {
                    if (inverse.kind === 'hasMany') {
                        get(model, inverse.name).addObject(inverseModel);
                    } else if (inverse.kind === 'belongsTo') {
                        set(model, inverse.name, inverseModel);
                    }
                }, this);
            },
            _removeFromInverse: function (model, inverse, inverseModel) {
                model = this.session.getModel(model);
                if (!model)
                    return;
                model.suspendRelationshipObservers(function () {
                    if (inverse.kind === 'hasMany') {
                        get(model, inverse.name).removeObject(inverseModel);
                    } else if (inverse.kind === 'belongsTo') {
                        set(model, inverse.name, null);
                    }
                }, this);
            }
        });
    });
    require.define('/lib/session/collection_manager.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set;
        Ep.CollectionManager = Ember.Object.extend({
            init: function () {
                this.modelMap = Ember.MapWithDefault.create({
                    defaultValue: function () {
                        return Ember.A([]);
                    }
                });
            },
            register: function (array, model) {
                var arrays = this.modelMap.get(get(model, 'clientId'));
                if (arrays.contains(array))
                    return;
                arrays.pushObject(array);
            },
            unregister: function (array, model) {
                var arrays = this.modelMap.get(get(model, 'clientId'));
                arrays.removeObject(array);
                if (arrays.length === 0) {
                    this.modelMap.remove(get(model, 'clientId'));
                }
            },
            modelWasDeleted: function (model) {
                var arrays = this.modelMap.get(get(model, 'clientId')).copy();
                arrays.forEach(function (array) {
                    array.removeObject(model);
                });
            }
        });
    });
    require.define('/lib/initializers.js', function (module, exports, __dirname, __filename) {
        var set = Ember.set;
        require('/lib/serializers/index.js', module);
        require('/lib/debug/index.js', module);
        require('/lib/id_manager.js', module);
        Ember.onLoad('Ember.Application', function (Application) {
            Application.initializer({
                name: 'epf.container',
                initialize: function (container, application) {
                    Ep.__container__ = container;
                    application.register('adapter:main', application.Adapter || Ep.RestAdapter);
                    application.register('session:base', application.Session || Ep.Session);
                    application.register('session:child', application.ChildSession || Ep.ChildSession);
                    application.register('session:main', application.DefaultSession || Ep.Session);
                    application.register('id-manager:main', Ep.IdManager);
                }
            });
            Application.initializer({
                name: 'epf.injections',
                initialize: function (container, application) {
                    application.inject('session', 'adapter', 'adapter:main');
                    application.inject('serializer', 'idManager', 'id-manager:main');
                    application.inject('session', 'idManager', 'id-manager:main');
                    application.inject('adapter', 'idManager', 'id-manager:main');
                    application.inject('controller', 'adapter', 'adapter:main');
                    application.inject('controller', 'session', 'session:main');
                    application.inject('route', 'adapter', 'adapter:main');
                    application.inject('route', 'session', 'session:main');
                    application.inject('data-adapter', 'session', 'session:main');
                }
            });
            Application.initializer({
                name: 'epf.serializers',
                initialize: function (container, application) {
                    application.register('serializer:belongs-to', Ep.BelongsToSerializer);
                    application.register('serializer:boolean', Ep.BooleanSerializer);
                    application.register('serializer:date', Ep.DateSerializer);
                    application.register('serializer:has-many', Ep.HasManySerializer);
                    application.register('serializer:id', Ep.IdSerializer);
                    application.register('serializer:number', Ep.NumberSerializer);
                    application.register('serializer:model', Ep.ModelSerializer);
                    application.register('serializer:revision', Ep.RevisionSerializer);
                    application.register('serializer:string', Ep.StringSerializer);
                }
            });
            Application.initializer({
                name: 'epf.mergeStrategies',
                initialize: function (container, application) {
                    application.register('merge-strategy:per-field', Ep.PerField);
                    application.register('merge-strategy:default', Ep.PerField);
                }
            });
            Application.initializer({
                name: 'data-adapter',
                initialize: function (container, application) {
                    application.register('data-adapter:main', Ep.DebugAdapter);
                }
            });
        });
    });
    require.define('/lib/id_manager.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, set = Ember.set, merge = Ember.merge;
        var uuid = 1;
        Ep.IdManager = Ember.Object.extend({
            init: function () {
                this._super.apply(this, arguments);
                this.idMaps = Ember.MapWithDefault.create({
                    defaultValue: function (type) {
                        return Ember.Map.create();
                    }
                });
            },
            reifyClientId: function (model) {
                var id = get(model, 'id'), clientId = get(model, 'clientId'), type = get(model, 'type'), idMap = this.idMaps.get(type);
                if (id && clientId) {
                    var existingClientId = idMap.get(id);

                    if (!existingClientId) {
                        idMap.set(id, clientId);
                    }
                } else if (!clientId) {
                    if (id) {
                        clientId = idMap.get(id);
                    }
                    if (!clientId) {
                        clientId = this._generateClientId(type);
                    }
                    set(model, 'clientId', clientId);
                    idMap.set(id, clientId);
                }
                return clientId;
            },
            getClientId: function (type, id) {
                var idMap = this.idMaps.get(type);
                return idMap.get(id);
            },
            _generateClientId: function (type) {
                return get(type, 'typeKey') + uuid++;
            }
        });
    });
    require.define('/lib/debug/index.js', function (module, exports, __dirname, __filename) {
        require('/lib/debug/debug_info.js', module);
        require('/lib/debug/debug_adapter.js', module);
    });
    require.define('/lib/debug/debug_adapter.js', function (module, exports, __dirname, __filename) {
        var get = Ember.get, capitalize = Ember.String.capitalize, underscore = Ember.String.underscore;
        if (Ember.DataAdapter) {
            var PromiseArray = Ember.ArrayProxy.extend(Ember.PromiseProxyMixin);
            Ep.DebugAdapter = Ember.DataAdapter.extend({
                getFilters: function () {
                    return [
                        {
                            name: 'isNew',
                            desc: 'New'
                        },
                        {
                            name: 'isModified',
                            desc: 'Modified'
                        },
                        {
                            name: 'isClean',
                            desc: 'Clean'
                        }
                    ];
                },
                detect: function (klass) {
                    return klass !== Ep.Model && Ep.Model.detect(klass);
                },
                columnsForType: function (type) {
                    var columns = [
                            {
                                name: 'id',
                                desc: 'Id'
                            },
                            {
                                name: 'clientId',
                                desc: 'Client Id'
                            },
                            {
                                name: 'rev',
                                desc: 'Revision'
                            },
                            {
                                name: 'clientRev',
                                desc: 'Client Revision'
                            }
                        ], count = 0, self = this;
                    Ember.A(get(type, 'attributes')).forEach(function (name, meta) {
                        if (count++ > self.attributeLimit) {
                            return false;
                        }
                        var desc = capitalize(underscore(name).replace('_', ' '));
                        columns.push({
                            name: name,
                            desc: desc
                        });
                    });
                    return columns;
                },
                getRecords: function (type) {
                    return PromiseArray.create({ promise: this.get('session').query(type) });
                },
                getRecordColumnValues: function (record) {
                    var self = this, count = 0, columnValues = { id: get(record, 'id') };
                    record.eachAttribute(function (key) {
                        if (count++ > self.attributeLimit) {
                            return false;
                        }
                        var value = get(record, key);
                        columnValues[key] = value;
                    });
                    return columnValues;
                },
                getRecordKeywords: function (record) {
                    var keywords = [], keys = Ember.A(['id']);
                    record.eachAttribute(function (key) {
                        keys.push(key);
                    });
                    keys.forEach(function (key) {
                        keywords.push(get(record, key));
                    });
                    return keywords;
                },
                getRecordFilterValues: function (record) {
                    return {
                        isNew: record.get('isNew'),
                        isModified: record.get('isDirty') && !record.get('isNew'),
                        isClean: !record.get('isDirty')
                    };
                },
                getRecordColor: function (record) {
                    var color = 'black';
                    if (record.get('isNew')) {
                        color = 'green';
                    } else if (record.get('isDirty')) {
                        color = 'blue';
                    }
                    return color;
                },
                observeRecord: function (record, recordUpdated) {
                    var releaseMethods = Ember.A(), self = this, keysToObserve = Ember.A([
                            'id',
                            'clientId',
                            'rev',
                            'clientRev',
                            'isNew',
                            'isDirty',
                            'isDeleted'
                        ]);
                    record.eachAttribute(function (key) {
                        keysToObserve.push(key);
                    });
                    keysToObserve.forEach(function (key) {
                        var handler = function () {
                            recordUpdated(self.wrapRecord(record));
                        };
                        Ember.addObserver(record, key, handler);
                        releaseMethods.push(function () {
                            Ember.removeObserver(record, key, handler);
                        });
                    });
                    var release = function () {
                        releaseMethods.forEach(function (fn) {
                            fn();
                        });
                    };
                    return release;
                }
            });
        }
    });
    require.define('/lib/debug/debug_info.js', function (module, exports, __dirname, __filename) {
        require('/lib/model/index.js', module);
        Ep.ModelMixin.reopen({
            _debugInfo: function () {
                var attributes = ['id'], relationships = {
                        belongsTo: [],
                        hasMany: []
                    }, expensiveProperties = [];
                this.eachAttribute(function (name, meta) {
                    attributes.push(name);
                }, this);
                this.eachRelationship(function (name, relationship) {
                    relationships[relationship.kind].push(name);
                    expensiveProperties.push(name);
                });
                var groups = [
                        {
                            name: 'Attributes',
                            properties: attributes,
                            expand: true
                        },
                        {
                            name: 'Belongs To',
                            properties: relationships.belongsTo,
                            expand: true
                        },
                        {
                            name: 'Has Many',
                            properties: relationships.hasMany,
                            expand: true
                        },
                        {
                            name: 'Flags',
                            properties: [
                                'isLoaded',
                                'isDirty',
                                'isDeleted',
                                'hasErrors',
                                'isProxy'
                            ]
                        }
                    ];
                return {
                    propertyInfo: {
                        includeOtherProperties: true,
                        groups: groups,
                        expensiveProperties: expensiveProperties
                    }
                };
            }
        });
    });
    require.define('/lib/version.js', function (module, exports, __dirname, __filename) {
        Ep.VERSION = '0.1.4';
        Ember.libraries && Ember.libraries.register('EPF', Ep.VERSION);
    });
    require.define('/vendor/ember-inflector.js', function (module, exports, __dirname, __filename) {
        (function () {
            Ember.String.pluralize = function (word) {
                return Ember.Inflector.inflector.pluralize(word);
            };
            Ember.String.singularize = function (word) {
                return Ember.Inflector.inflector.singularize(word);
            };
        }());
        (function () {
            var BLANK_REGEX = /^\s*$/;
            function loadUncountable(rules, uncountable) {
                for (var i = 0, length = uncountable.length; i < length; i++) {
                    rules.uncountable[uncountable[i]] = true;
                }
            }
            function loadIrregular(rules, irregularPairs) {
                var pair;
                for (var i = 0, length = irregularPairs.length; i < length; i++) {
                    pair = irregularPairs[i];
                    rules.irregular[pair[0]] = pair[1];
                    rules.irregularInverse[pair[1]] = pair[0];
                }
            }
            function Inflector(ruleSet) {
                ruleSet = ruleSet || {};
                ruleSet.uncountable = ruleSet.uncountable || {};
                ruleSet.irregularPairs = ruleSet.irregularPairs || {};
                var rules = this.rules = {
                        plurals: ruleSet.plurals || [],
                        singular: ruleSet.singular || [],
                        irregular: {},
                        irregularInverse: {},
                        uncountable: {}
                    };
                loadUncountable(rules, ruleSet.uncountable);
                loadIrregular(rules, ruleSet.irregularPairs);
            }
            Inflector.prototype = {
                plural: function (regex, string) {
                    this.rules.plurals.push([
                        regex,
                        string
                    ]);
                },
                singular: function (regex, string) {
                    this.rules.singular.push([
                        regex,
                        string
                    ]);
                },
                uncountable: function (string) {
                    loadUncountable(this.rules, [string]);
                },
                irregular: function (singular, plural) {
                    loadIrregular(this.rules, [[
                            singular,
                            plural
                        ]]);
                },
                pluralize: function (word) {
                    return this.inflect(word, this.rules.plurals);
                },
                singularize: function (word) {
                    return this.inflect(word, this.rules.singular);
                },
                inflect: function (word, typeRules) {
                    var inflection, substitution, result, lowercase, isBlank, isUncountable, isIrregular, isIrregularInverse, rule;
                    isBlank = BLANK_REGEX.test(word);
                    if (isBlank) {
                        return word;
                    }
                    lowercase = word.toLowerCase();
                    isUncountable = this.rules.uncountable[lowercase];
                    if (isUncountable) {
                        return word;
                    }
                    isIrregular = this.rules.irregular[lowercase];
                    if (isIrregular) {
                        return isIrregular;
                    }
                    isIrregularInverse = this.rules.irregularInverse[lowercase];
                    if (isIrregularInverse) {
                        return isIrregularInverse;
                    }
                    for (var i = typeRules.length, min = 0; i > min; i--) {
                        inflection = typeRules[i - 1];
                        rule = inflection[0];
                        if (rule.test(word)) {
                            break;
                        }
                    }
                    inflection = inflection || [];
                    rule = inflection[0];
                    substitution = inflection[1];
                    result = word.replace(rule, substitution);
                    return result;
                }
            };
            Ember.Inflector = Inflector;
        }());
        (function () {
            Ember.Inflector.defaultRules = {
                plurals: [
                    [
                        /$/,
                        's'
                    ],
                    [
                        /s$/i,
                        's'
                    ],
                    [
                        /^(ax|test)is$/i,
                        '$1es'
                    ],
                    [
                        /(octop|vir)us$/i,
                        '$1i'
                    ],
                    [
                        /(octop|vir)i$/i,
                        '$1i'
                    ],
                    [
                        /(alias|status)$/i,
                        '$1es'
                    ],
                    [
                        /(bu)s$/i,
                        '$1ses'
                    ],
                    [
                        /(buffal|tomat)o$/i,
                        '$1oes'
                    ],
                    [
                        /([ti])um$/i,
                        '$1a'
                    ],
                    [
                        /([ti])a$/i,
                        '$1a'
                    ],
                    [
                        /sis$/i,
                        'ses'
                    ],
                    [
                        /(?:([^f])fe|([lr])f)$/i,
                        '$1$2ves'
                    ],
                    [
                        /(hive)$/i,
                        '$1s'
                    ],
                    [
                        /([^aeiouy]|qu)y$/i,
                        '$1ies'
                    ],
                    [
                        /(x|ch|ss|sh)$/i,
                        '$1es'
                    ],
                    [
                        /(matr|vert|ind)(?:ix|ex)$/i,
                        '$1ices'
                    ],
                    [
                        /^(m|l)ouse$/i,
                        '$1ice'
                    ],
                    [
                        /^(m|l)ice$/i,
                        '$1ice'
                    ],
                    [
                        /^(ox)$/i,
                        '$1en'
                    ],
                    [
                        /^(oxen)$/i,
                        '$1'
                    ],
                    [
                        /(quiz)$/i,
                        '$1zes'
                    ]
                ],
                singular: [
                    [
                        /s$/i,
                        ''
                    ],
                    [
                        /(ss)$/i,
                        '$1'
                    ],
                    [
                        /(n)ews$/i,
                        '$1ews'
                    ],
                    [
                        /([ti])a$/i,
                        '$1um'
                    ],
                    [
                        /((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)(sis|ses)$/i,
                        '$1sis'
                    ],
                    [
                        /(^analy)(sis|ses)$/i,
                        '$1sis'
                    ],
                    [
                        /([^f])ves$/i,
                        '$1fe'
                    ],
                    [
                        /(hive)s$/i,
                        '$1'
                    ],
                    [
                        /(tive)s$/i,
                        '$1'
                    ],
                    [
                        /([lr])ves$/i,
                        '$1f'
                    ],
                    [
                        /([^aeiouy]|qu)ies$/i,
                        '$1y'
                    ],
                    [
                        /(s)eries$/i,
                        '$1eries'
                    ],
                    [
                        /(m)ovies$/i,
                        '$1ovie'
                    ],
                    [
                        /(x|ch|ss|sh)es$/i,
                        '$1'
                    ],
                    [
                        /^(m|l)ice$/i,
                        '$1ouse'
                    ],
                    [
                        /(bus)(es)?$/i,
                        '$1'
                    ],
                    [
                        /(o)es$/i,
                        '$1'
                    ],
                    [
                        /(shoe)s$/i,
                        '$1'
                    ],
                    [
                        /(cris|test)(is|es)$/i,
                        '$1is'
                    ],
                    [
                        /^(a)x[ie]s$/i,
                        '$1xis'
                    ],
                    [
                        /(octop|vir)(us|i)$/i,
                        '$1us'
                    ],
                    [
                        /(alias|status)(es)?$/i,
                        '$1'
                    ],
                    [
                        /^(ox)en/i,
                        '$1'
                    ],
                    [
                        /(vert|ind)ices$/i,
                        '$1ex'
                    ],
                    [
                        /(matr)ices$/i,
                        '$1ix'
                    ],
                    [
                        /(quiz)zes$/i,
                        '$1'
                    ],
                    [
                        /(database)s$/i,
                        '$1'
                    ]
                ],
                irregularPairs: [
                    [
                        'person',
                        'people'
                    ],
                    [
                        'man',
                        'men'
                    ],
                    [
                        'child',
                        'children'
                    ],
                    [
                        'sex',
                        'sexes'
                    ],
                    [
                        'move',
                        'moves'
                    ],
                    [
                        'cow',
                        'kine'
                    ],
                    [
                        'zombie',
                        'zombies'
                    ]
                ],
                uncountable: [
                    'equipment',
                    'information',
                    'rice',
                    'money',
                    'species',
                    'series',
                    'fish',
                    'sheep',
                    'jeans',
                    'police'
                ]
            };
        }());
        (function () {
            if (Ember.EXTEND_PROTOTYPES) {
                String.prototype.pluralize = function () {
                    return Ember.String.pluralize(this);
                };
                String.prototype.singularize = function () {
                    return Ember.String.singularize(this);
                };
            }
        }());
        (function () {
            Ember.Inflector.inflector = new Ember.Inflector(Ember.Inflector.defaultRules);
        }());
        (function () {
        }());
    });
    global.epf = require('/lib/index.js');
}.call(this, this));