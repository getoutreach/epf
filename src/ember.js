import Coalesce from './namespace';
import './ember/initializers';

if (Ember.libraries) {
  Ember.libraries.registerCoreLibrary('Coalesce', Coalesce.VERSION);
}

import f from './ember/setup_container';

export {f as setupContainer};
