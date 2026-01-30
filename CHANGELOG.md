# Changelog for the OHF Matter(.js) Server

This page shows a detailed overview of the changes between versions without the need to look into code, especially to see relevant changes while interfaces and features are still in flux.

<!--
	Placeholder for the next version (at the beginning of the line):
	## __WORK IN PROGRESS__
-->

## 0.3.2 (2026-01-30)

- Feature: Expose the Matter version of the device in Node details and the Dashboard (not integrated in HA yet because not returned by the Python server)
- Enhancement: Delay Unavailability information to websocket a bit when "just" re-establishing the subscription
- Enhancement: (ximex) Optimizations for Dashboard code
- Fix: Correctly set the basic Information cluster information for the Controller node
- Fix: Update matter.js to 0.16.8-nightly
     - Fixes cases where devices were not properly reconnecting as soon as a list of IPs (aka mdns discovery) was requested
     - Prevents collecting IPs to overwrite newer IPs when sessions close
     - Ignores File size mismatches for OTA files when checksum matches (unblocks Nanoleaf updates)

## 0.3.1 (2026-01-28)

- Adjustment: Adjust some logging messages

## 0.3.0 (2026-01-28)

- BREAKING: (Only relevant for users that do not use the HomeAssistant Add-On)
    - Now respects the provided FabricID and VendorID when starting the server and migrating data from a former storage!
      Before this version we always used the "first chip.json entry" and took FabricId/VendorId from there. Now the 
      provided parameters are used, and if not matching to any chip.json entry, we startup with an empty storage.
    - Renames the storage directory from "server" to "server-<fabricId>-<vendorId>" to ensure proper separation of 
      multiple servers in one storage
- Enhancement: Introduce /health endpoint to use for (docker) health checks. It returns the server version and number of nodes
- Enhancement: Correctly handles the start up of the server with multiple fabric-ids and vendor-ids in the same storage
- Adjustment: The server-id and storage directory inside the data directory will be renamed on next start to match the multi-fabric structure
- Adjustment: Adhere to the default nodeId 112233 for the controller itself as the Python Matter server did
- Adjustment: For fresh starts the next node id to be commissioned will be 1 as it was for the Python Matter Server
- Fix: Start up the server also when no nodes exist in the migrated json file. Logs a warning
- Fix: Tries to read the backup json-file when the normal json-file is not parseable or does not exist
- Fix: Optimize responsive layout of Dashboard
- Fix: Return errors more consistently to how the Python server was returning them
- Fix: Fixes datatypes for Neo Custom clusters to be decoded correctly
- Fix: Update matter.js to 0.16.8-nightly
    - Fixes many issues with reconnections to devices, especially when IPs change, e.g., in thread networks or such
    - Do not show updates that are available locally for unapplicable version ranges or already updated devices
    - Optimizes mDNS handling in general
    - Optimize re-using sessions pushed by devices instead of creating new ones

## 0.2.9 (2026-01-22)

- Fix: Fixes the datatype for the Eve pressure attribute
- Fix: Return mDNS-discovered IPs for a node when requesting them and also ping these
- Fix: Update matter.js to 0.16.7
    - Fix OTA update availability checks

## 0.2.8 (2026-01-22)

- Fix: Fixes the BLE commissioning capabilities

## 0.2.7 (2026-01-22)

- Enhancement: Optimizes initial migration with empty matter.js storage and inject peers directly
- Enhancement: Added an option to temporarily change the loglevel while the server runs
- Enhancement: Added Dark mode including selection of the theme via button and query parameter
- Enhancement: Streamlined the "No Websocket connection" page and allow reloading of the page
- Enhancement: Allow specifying timeouts for responses in the Websocket client and track them. Throws an error if the response times out
- Enhancement: Add the peer address in the dashboard after the node-id to allow mapping to logs more easily
- Adjustment: Optimize performance by migrating reading and invoking to use the new internal Node-API
- Fix: Refactor BigInt aware JSON parsing to avoid issues when importing nodes
- Fix: Show names in the dashboard in the same format as the Python server
- Fix: Fix some datatypes for custom eve cluster attributes
- Fix: Also respect the chip magic values when reading wildcard attributes
- Fix: Update matter.js to 0.16.6
    - Fixes and optimizations around mDNS discovery when starting the server the first time with many devices
    - Fixes some issues in high-traffic situations
    - Do not announce our node as update-provider to prevent issues if users switch back to the Python server
    - Correctly handle node decommissioning by other controllers and optimize decommissioning via ourselves
    - Extend error handling when persisting legacy node details
    - Optimize startup performance by initializing some internal structures lazy when needed
    - Logging enhancements

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
