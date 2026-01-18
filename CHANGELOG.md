# Changelog for the OHF Matter(.js) Server

This page shows a detailed overview of the changes between versions without the need to look into code, especially to see relevant changes while interfaces and features are still in flux.

<!--
	Placeholder for the next version (at the beginning of the line):
	## __WORK IN PROGRESS__
-->

## __WORK IN PROGRESS__

- Enhancement: Added an option to temporarily change the loglevel while the server runs
- Enhancement: Added Dark mode including selection of the theme via button and query parameter
- Enhancement: Streamlined the "No Websocket connection" page and allow reloading of the page
- Enhancement: Allow specifying timeouts for responses in the Websocket client and track them. Throws an error if the response times out
- Enhancement: Add the peer address in the dashboard after the node-id to allow mapping to logs more easily
- Fix: Refactor BigInt aware JSON parsing to avoid issues when importing nodes
- Fix: Show names in the dashboard in the same format as the Python server
- Fix: Fix some datatypes for custom eve cluster attributes
- Fix: Update matter.js to 0.16.6-nightly
    - Fixes around mDNS discovery when starting the server the first time with many devices
    - Fixes some issues in high-traffic situations
    - Do not announce our node as update-provider to prevent issues if users switch back to the Python server
    - Correctly handle node decommissioning by other controllers and optimize decommissioning via ourselves
    - Extend error handling when persisting legacy node details

## 0.2.6 (2026-01-16)

- Enhancement: Show more details in the dashboard for software update states beside "Downloading"
- Fix: Initialize "next node id" correctly when starting the server
- Fix: Only execute custom attribute polling when the node is connected
- Fix: Streamlines Hex-Number displaying in the Dashboard (Cluster-/Attribute-IDs)

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
