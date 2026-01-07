# Custom Clusters

This package contains definitions for vendor-specific (custom) Matter clusters that are not part of the official Matter specification.

## Overview

Custom clusters are used by device manufacturers to expose proprietary functionality. This package provides TypeScript definitions that allow the Matter.js server to decode and work with these clusters.

## Supported Clusters

| Cluster                             | ID         | Vendor                     | Description                                |
|-------------------------------------|------------|----------------------------|--------------------------------------------|
| `EveCluster`                        | 0x130afc01 | Eve (0x130a/4874)          | Energy monitoring, weather, motion sensors |
| `InovelliCluster`                   | 0x122ffc31 | Inovelli (0x122f/4961)     | LED indicator controls                     |
| `NeoCluster`                        | 0x125dfc11 | Neo (0x125d/4991)          | Power metering                             |
| `HeimanCluster`                     | 0x120bfc01 | Heiman (0x120b/4619)       | Sensor states, alarms                      |
| `ThirdRealityMeteringCluster`       | 0x130dfc02 | ThirdReality (0x130d/4877) | Power metering                             |
| `DraftElectricalMeasurementCluster` | 0x00000b04 | Various                    | Draft Matter 1.0 electrical measurement    |

## Writing a New Custom Cluster

### Basic Structure

Create a new file in `src/clusters/` (e.g., `myvendor.ts`):

```typescript
import { attribute, cluster, uint32, single, bool, int32 } from "@matter/main/model";

@cluster(0xVENDORCLUSTERID)
export class MyVendorCluster {
    @attribute(0xATTRIBUTEID1, uint32)
    myAttribute?: number;

    @attribute(0xATTRIBUTEID2, single)
    myFloatAttribute?: number;

    @attribute(0xATTRIBUTEID3, bool)
    myBoolAttribute?: boolean;
}
```

### Export the Cluster

Add an export to `src/clusters/index.ts`:

```typescript
export * from "./myvendor.js";
```

### Data Types

Use these type mappings when converting from Python Matter Server definitions:

| Python Type | TypeScript Decorator | TypeScript Property Type |
|-------------|----------------------|--------------------------|
| `int`       | `int64`              | `number \| bigint`       |
| `uint`      | `uint64`             | `number \| bigint`       |
| `float32`   | `single`             | `number`                 |
| `float64`   | `double`             | `number`                 |
| `bool`      | `bool`               | `boolean`                |

TypeScript also supports other variants of `int*` and `uint*` types. Please choose the one that matches your use case and the maximum contained value. if not known it is safe to assume 64biut precision for both signed and unsigned types.

### Available Type Imports

From `@matter/main/model`:

```typescript
import {
    // Integer types
    int8,       // Signed 8-bit integer, JavaScript datatype: `number`
    int16,      // Signed 16-bit integer, JavaScript datatype: `number`
    int32,      // Signed 32-bit integer, JavaScript datatype: `number`
    int64,      // Signed 64-bit integer, JavaScript datatype: `number | bigint`
    uint8,      // Unsigned 8-bit integer, JavaScript datatype: `number`
    uint16,     // Unsigned 16-bit integer, JavaScript datatype: `number`
    uint32,     // Unsigned 32-bit integer, JavaScript datatype: `number`
    uint64,     // Unsigned 64-bit integer, JavaScript datatype: `number | bigint`

    // Floating point
    single,     // 32-bit float (float32), JavaScript datatype: `number`
    double,     // 64-bit float (float64), JavaScript datatype: `number`

    // Other types
    bool,       // Boolean, JavaScript datatype: `boolean`
    string,     // UTF-8 string, JavaScript datatype: `string`
    octstr,     // Octet string (binary data), JavaScript (matter.js) datatype: `Bytes`
} from "@matter/main/model";
```

### Hex Value Convention

Use lowercase hex values for consistency:

```typescript
// Good
@cluster(0x130afc01)
@attribute(0x130a0006, int32)

// Avoid
@cluster(0x130AFC01)
@attribute(0x130A0006, int32)
```

## Registration

Clusters defined in this package are automatically registered when the package is imported. The `register.ts` module handles registration with the Matter.js model system.

## Building

```bash
npm run build
```

This compiles the TypeScript definitions to JavaScript in the `dist/` directory.
