import { ClusterModel, Matter, Schema } from "@matter/main/model";
import { ClusterRegistry } from "@matter/main/types";

import { ClusterTypeOfModel } from "./builder.js";
import * as Clusters from "./clusters/index.js";

for (const ClusterDefinition of Object.values(Clusters)) {
    const ClusterSchema = Schema.Required(ClusterDefinition);
    Matter.children.push(ClusterSchema);

    console.log("Registering Schema", ClusterSchema);

    const ClusterType = ClusterTypeOfModel(ClusterSchema as ClusterModel);
    ClusterRegistry.register(ClusterType);
}
