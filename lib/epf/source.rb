module Epf
  module Source
    def self.bundled_path
      File.expand_path('../../../dist/epf.js', __FILE__)
    end
  end
end
