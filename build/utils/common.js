var Docker, Promise, _, chalk, form;

Promise = require('bluebird');

_ = require('lodash');

Docker = require('docker-toolbelt');

form = require('resin-cli-form');

chalk = require('chalk');

module.exports = {
  selectContainerFromDevice: Promise.method(function(deviceIp) {
    var docker;
    docker = new Docker({
      host: deviceIp,
      port: 2375
    });
    return docker.listContainersAsync({
      all: true
    }).then(function(containers) {
      if (_.isEmpty(containers)) {
        throw new Error("No containers found in " + deviceIp);
      }
      return form.ask({
        message: 'Select a container',
        type: 'list',
        choices: _.map(containers, function(container) {
          var containerName, containerStatus, shortContainerId;
          containerName = container.Names[0] || 'Untitled';
          shortContainerId = ('' + container.Id).substr(0, 11);
          containerStatus = container.Status;
          return {
            name: containerName + " (" + shortContainerId + ") - " + containerStatus,
            value: container.Id
          };
        })
      });
    });
  }),
  pipeContainerStream: Promise.method(function(arg) {
    var container, deviceIp, docker, follow, name, outStream, ref;
    deviceIp = arg.deviceIp, name = arg.name, outStream = arg.outStream, follow = (ref = arg.follow) != null ? ref : false;
    docker = new Docker({
      host: deviceIp,
      port: 2375
    });
    container = docker.getContainer(name);
    return container.inspectAsync().then(function(containerInfo) {
      var ref1;
      return containerInfo != null ? (ref1 = containerInfo.State) != null ? ref1.Running : void 0 : void 0;
    }).then(function(isRunning) {
      return container.attachAsync({
        logs: !follow || !isRunning,
        stream: follow && isRunning,
        stdout: true,
        stderr: true
      });
    }).then(function(containerStream) {
      return containerStream.pipe(outStream);
    })["catch"](function(err) {
      err = '' + err.statusCode;
      if (err === '404') {
        return console.log(chalk.red.bold("Container '" + name + "' not found."));
      }
      throw err;
    });
  })
};
