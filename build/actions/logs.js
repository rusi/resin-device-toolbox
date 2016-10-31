
/*
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */
module.exports = {
  signature: 'logs [deviceIp]',
  description: 'Get or attach to logs of a running container on a resinOS device',
  help: '\nExamples:\n\n	$ rdt logs\n	$ rdt logs -f\n	$ rdt logs 192.168.1.10\n	$ rdt logs 192.168.1.10 -f\n	$ rdt logs 192.168.1.10 -f --app-name myapp',
  primary: true,
  options: [
    {
      signature: 'follow',
      boolean: true,
      description: 'follow log',
      alias: 'f'
    }, {
      signature: 'app-name',
      parameter: 'name',
      description: 'name of container to get logs from',
      alias: 'a'
    }
  ],
  action: function(params, options, done) {
    var Promise, common, forms;
    Promise = require('bluebird');
    forms = require('resin-sync').forms;
    common = require('../utils').common;
    return Promise["try"](function() {
      if (params.deviceIp == null) {
        return forms.selectLocalResinOsDevice();
      }
      return params.deviceIp;
    }).then((function(_this) {
      return function(deviceIp) {
        _this.deviceIp = deviceIp;
        if (options['app-name'] == null) {
          return common.selectContainerFromDevice(_this.deviceIp);
        }
        return options['app-name'];
      };
    })(this)).then((function(_this) {
      return function(appName) {
        return common.pipeContainerStream({
          deviceIp: _this.deviceIp,
          name: appName,
          outStream: process.stdout,
          follow: options['follow']
        });
      };
    })(this));
  }
};
