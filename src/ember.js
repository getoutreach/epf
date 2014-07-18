import Ep from './namespace';
import './ember/initializers';

if (Ember.libraries) {
  Ember.libraries.registerCoreLibrary('EPF', Ep.VERSION);
}

import f from './ember/setup_container';

export {f as setupContainer};