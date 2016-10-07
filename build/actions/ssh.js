
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
var getSubShellCommand;

getSubShellCommand = function(command) {
  var os;
  os = require('os');
  if (os.platform() === 'win32') {
    return {
      program: 'cmd.exe',
      args: ['/s', '/c', command]
    };
  } else {
    return {
      program: '/bin/sh',
      args: ['-c', command]
    };
  }
};

module.exports = {
  signature: 'ssh [deviceIp]',
  description: 'Get a shell into a resinOS device',
  help: 'If you\'re running Windows, this command only supports `cmd.exe`.\n\nUse this command to get a shell into the running application container of\nyour device.\n\nThe \'--host\' option will get you a shell into the Host OS of the ResinOS device.\nNo option will return a list of containers to enter or you can explicitly select\none by passing its name to the --container option\n\nExamples:\n\n	$ resin ssh\n	$ resin ssh --host\n	$ resin ssh --container chaotic_water\n	$ resin ssh --container chaotic_water --port 22222\n	$ resin ssh --verbose',
  primary: true,
  options: [
    {
      signature: 'verbose',
      boolean: true,
      description: 'increase verbosity',
      alias: 'v'
    }, {
      signature: 'host',
      boolean: true,
      description: 'get a shell into the host OS',
      alias: 'h'
    }, {
      signature: 'container',
      parameter: 'container',
      "default": null,
      description: 'name of container to access',
      alias: 'h'
    }, {
      signature: 'port',
      parameter: 'port',
      description: 'ssh port number (default: 22222)',
      alias: 'h'
    }
  ],
  action: function(params, options, done) {
    var Docker, Promise, _, child_process, findAvahiDevices, form, selectContainerFromDevice, selectLocalResinOSDevice, verbose;
    child_process = require('child_process');
    Promise = require('bluebird');
    Docker = require('docker-toolbelt');
    _ = require('lodash');
    form = require('resin-cli-form');
    findAvahiDevices = require('../utils/discover').findAvahiDevices;
    if (options.host === true && (options.container != null)) {
      throw new Error('Please pass either --host or --container option');
    }
    selectLocalResinOSDevice = function() {
      return findAvahiDevices().then(function(devices) {
        if (_.isEmpty(devices)) {
          throw new Error('You don\'t have any local ResinOS devices');
        }
        return form.ask({
          message: 'Select a device',
          type: 'list',
          "default": devices[0].ip,
          choices: _.map(devices, function(device) {
            return {
              name: (device.name || 'Untitled') + " (" + device.ip + ")",
              value: device.ip
            };
          })
        });
      });
    };
    selectContainerFromDevice = Promise.method(function(deviceIp) {
      var docker;
      docker = new Docker({
        host: deviceIp,
        port: 2375
      });
      return docker.listContainersAsync().then(function(containers) {
        if (_.isEmpty(containers)) {
          throw new Error("No containers are running in " + deviceIp);
        }
        return form.ask({
          message: 'Select a container',
          type: 'list',
          choices: _.map(containers, function(container) {
            return {
              name: (container.Names[0] || 'Untitled') + " (" + container.Id + ")",
              value: container.Id
            };
          })
        });
      });
    });
    if (options.port == null) {
      options.port = 22222;
    }
    verbose = options.verbose ? '-vvv' : '';
    return Promise["try"](function() {
      if (params.deviceIp == null) {
        return selectLocalResinOSDevice();
      }
      return params.deviceIp;
    }).then(function(deviceIp) {
      _.assign(options, {
        deviceIp: deviceIp
      });
      if (options.host) {
        return;
      }
      if (options.container == null) {
        return selectContainerFromDevice(deviceIp);
      }
      return options.container;
    }).then(function(container) {
      var command, subShellCommand;
      command = "ssh " + verbose + " -t -p " + options.port + " -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ControlMaster=no root@" + options.deviceIp;
      if (!options.host) {
        command += " docker exec -ti " + container + " /bin/sh";
      }
      subShellCommand = getSubShellCommand(command);
      return child_process.spawn(subShellCommand.program, subShellCommand.args, {
        stdio: 'inherit'
      });
    }).nodeify(done);
  }
};
