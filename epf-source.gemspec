# -*- encoding: utf-8 -*-
require 'json'

package = JSON.parse(File.read('package.json'))

Gem::Specification.new do |gem|
  gem.name        = 'epf-source'
  gem.version     = package['version']
  gem.authors     = ['Gordon L. Hempton']
  gem.email       = ['ghempton@gmail.com']
  gem.date        = Time.now.strftime('%Y-%m-%d')
  gem.summary     = 'Epf source code wrapper'
  gem.description = 'Epf source code wrapper for ruby libs.'
  gem.homepage    = 'https://github.com/GroupTalent/epf'

  gem.files       = ['dist/epf.js', 'dist/epf.js.map', 'lib/epf/source.rb']

  gem.license     = 'MIT'
end
