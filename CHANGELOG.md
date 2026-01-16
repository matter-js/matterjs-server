# Changelog for the OHF Matter(.js) Server

This page shows a detailed overview of the changes between versions without the need to look into code, especially to see relevant changes while interfaces and features are still in flux.

<!--
	Placeholder for the next version (at the beginning of the line):
	## __WORK IN PROGRESS__
-->

## 0.2.5 (2026-01-16)

- Enhancement: Uses a best effort approach to detect the used Fabric label from the Python server 
- Fix: Ensures correct handling and storing of the desired FabricLabel  

## 0.2.4 (2026-01-16)

- Enhancement: Re-adds the energy-polling for Eve devices that did not have an update to the Matter attributes
- Enhancement: Allows using Environment Variables to configure the Matter Server instead of using CLI parameters
- Enhancement: Displays the global cluster attributes always last in the cluster view of the dashboard
- Enhancement: Include custom cluster definitions in the generated dashboard data to show attributes and clusters with names
- Fix: Update matter.js to 0.16.5
   - Correctly handles already downloaded production OTA updates as production updates

## 0.2.3 (2026-01-15)

- Enhancement: Allows a LOG_LEVEL environment variable to control the log level of the Matter server when started via docker container
- Enhancement: Added some basic cluster commands (OnOff and LevelControl) to the dashboard for more simple testing.
- Fix: Prevents displaying of duplicate cluster details in the dashboard
- Fix: Update matter.js to 0.16.4
    - Also report attribute updates for bridges correctly (depending on endpoint-structure, they were partially missing)
    - Also accept invalid attribute-ids in the migrated and data from paired nodes
    - Exclude usage of the Thread interaction queue for command invokes, so you need to know yourself what you are doing 

## 0.2.2 (2026-01-14)

- Fix: update matter.js to 0.16.2

## 0.2.1 (2026-01-13)

- Fix: remove a require-lookup which was not ESM 

## 0.2.0 (2026-01-13)

- Initial release as Drop-In replacement for the [OHF Python-Matter-Server](https://github.com/matter-js/python-matter-server) v8.1.2. Please refer to the README.md for differences.
