###
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

_ = require('lodash')
os = require('os')
Promise = require('bluebird')
umount = Promise.promisifyAll(require('umount'))
fs = Promise.promisifyAll(require('fs'))
drivelist = Promise.promisifyAll(require('drivelist'))
visuals = require('resin-cli-visuals')
form = require('resin-cli-form')
imageWrite = require('etcher-image-write')

module.exports =
	signature: 'flash <image>'
	description: 'Flash an image to a drive'
	help: '''
		Use this command to flash a ResinOS image to a drive.

		Examples:

			$ rdt flash path/to/resinos.img
			$ rdt flash path/to/resinos.img --drive /dev/disk2
			$ rdt flash path/to/resinos.img --drive /dev/disk2 --yes
	'''
	primary: true
	options: [
			signature: 'yes'
			boolean: true
			description: 'confirm non-interactively'
			alias: 'y'
	,
			signature: 'drive'
			parameter: 'drive'
			description: 'drive'
			alias: 'd'
	]
	action: (params, options, done) ->
		form.run [
			{
				message: 'Select drive'
				type: 'drive'
				name: 'drive'
			},
			{
				message: 'This will erase the selected drive. Are you sure?'
				type: 'confirm'
				name: 'yes'
				default: false
			}
		],
			override:
				drive: options.drive

				# If `options.yes` is `false`, pass `undefined`,
				# otherwise the question will not be asked because
				# `false` is a defined value.
				yes: options.yes || undefined
		.then (answers) ->
			drivelist.listAsync().then (drives) ->
				selectedDrive = _.find(drives, device: answers.drive)

				if not selectedDrive?
					throw new Error("Drive not found: #{answers.drive}")

				return selectedDrive
		.then (selectedDrive) ->
			progressBars =
				write: new visuals.Progress('Flashing')
				check: new visuals.Progress('Validating')

			umount.umountAsync(selectedDrive.device).then ->
				Promise.props
					imageSize: fs.statAsync(params.image).get('size'),
					imageStream: Promise.resolve(fs.createReadStream(params.image))
					driveFileDescriptor: fs.openAsync(selectedDrive.raw, 'rs+')
			.then (results) ->
				imageWrite.write
					fd: results.driveFileDescriptor
					device: selectedDrive.raw
					size: selectedDrive.size
				,
					stream: results.imageStream,
					size: results.imageSize
				,
					check: true
			.then (writer) ->
				new Promise (resolve, reject) ->
					writer.on 'progress', (state) ->
						progressBars[state.type].update(state)
					writer.on('error', reject)
					writer.on('done', resolve)
			.then ->
				if (os.platform() is 'win32') and selectedDrive.mountpoint?
					removedrive = Promise.promisifyAll(require('removedrive'))
					return removedrive.ejectAsync(selectedDrive.mountpoint)

				return umount.umountAsync(selectedDrive.device)
		.asCallback(done)

