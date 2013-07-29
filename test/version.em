pkg = require('../package.json')

describe 'Ep.VERSION', ->
  it 'sets the version to the current version', ->
    expect(Ep.VERSION).to.eq(pkg.version)
